import postgres from 'npm:postgres@3.4.8';
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{max:1,prepare:false});
const base=Deno.env.get('SUPABASE_URL')!+'/storage/v1';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const bucket='shelf-backgrounds';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function storage(path:string,method='GET',body?:BodyInit,type='application/json'){
 return fetch(base+path,{method,headers:{Authorization:'Bearer '+key,apikey:key,'Content-Type':type},body});
}
Deno.serve(async req=>{
 try{
  const token=req.headers.get('x-edge-session')||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return reply({error:'Sign in to continue.'},401);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  const hash=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const [session]=await sql`select owner_id from shelf.sessions where token_hash=${hash} and expires_at>now()`;
  if(!session)return reply({error:'Your session expired.'},401);
  const url=new URL(req.url),shelfId=url.searchParams.get('shelf'),imageId=url.searchParams.get('image');
  if(!uuid.test(shelfId||''))return reply({error:'Invalid shelf.'},400);
  const [shelf]=await sql`select settings from shelf.shelves where id=${shelfId} and owner_id=${session.owner_id}`;
  if(!shelf)return reply({error:'Shelf not found.'},404);
  const prefix=session.owner_id+'/'+shelfId;
  if(req.method==='POST'){
   const bytes=new Uint8Array(await req.arrayBuffer());
   if(bytes.length>800000||bytes.length<12||new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WEBP')return reply({error:'Use a compressed WebP image under 800 KB.'},400);
   const create=await storage('/bucket','POST',JSON.stringify({id:bucket,name:bucket,public:false,file_size_limit:800000,allowed_mime_types:['image/webp']}));
   if(!create.ok&&create.status!==409&&create.status!==400)throw Error('bucket');
   const listed=await storage('/object/list/'+bucket,'POST',JSON.stringify({prefix,limit:100}));
   if(!listed.ok)throw Error('list');const files=await listed.json();
   // Expired abandoned previews are removed; current saved photos are retained.
   const stale=files.filter((f:any)=>f.name!==shelf.settings.background+'.webp'&&Date.parse(f.created_at)<Date.now()-86400000);
   if(stale.length)await storage('/object/'+bucket,'DELETE',JSON.stringify({prefixes:stale.map((f:any)=>prefix+'/'+f.name)}));
   if(files.length-stale.length>=10)return reply({error:'Too many pending photos. Save or cancel your changes before uploading more.'},429);
   const id=crypto.randomUUID();const uploaded=await storage('/object/'+bucket+'/'+prefix+'/'+id+'.webp','POST',bytes,'image/webp');
   if(!uploaded.ok)throw Error('upload');return reply({image:id});
  }
  if(!uuid.test(imageId||''))return reply({error:'Invalid photo.'},400);
  const path=prefix+'/'+imageId+'.webp';
  if(req.method==='GET'){
   const image=await storage('/object/authenticated/'+bucket+'/'+path);
   if(!image.ok)return reply({error:'Photo not found.'},404);
   return new Response(image.body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
  }
  if(req.method==='DELETE'){
   if(shelf.settings.background===imageId)return reply({error:'Photo is still in use.'},409);
   const removed=await storage('/object/'+bucket,'DELETE',JSON.stringify({prefixes:[path]}));
   if(!removed.ok)throw Error('delete');return reply({ok:true});
  }
  return reply({error:'Method not allowed.'},405);
 }catch{return reply({error:'Could not process this photo. Please try again.'},503)}
});
