import sharp from 'sharp';
import {cookie,HttpError} from './security.mjs';
const endpoint='https://jlbdhvcqsrhbmycahdwc.supabase.co/functions/v1/shelf-background';
export async function background(request){
 const token=cookie(request,'__Host-edge_session');if(!token)throw new HttpError(401,'Sign in to continue.');
 const url=new URL(request.url),upstream=new URL(endpoint);upstream.search=url.search;
 let body;
 if(request.method==='POST'){
  if(Number(request.headers.get('content-length'))>1000000)throw new HttpError(413,'Photo is too large.');
  const bytes=Buffer.from(await request.arrayBuffer());if(bytes.length>1000000)throw new HttpError(413,'Photo is too large.');
  try{body=await sharp(bytes,{limitInputPixels:20000000}).rotate().resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer()}catch{throw new HttpError(400,'Please choose a JPG, PNG or WebP photo.');}
  if(body.length>800000)throw new HttpError(413,'Please choose a smaller photo.');
 }
 const result=await fetch(upstream,{method:request.method,headers:{'x-edge-session':token,'Content-Type':'image/webp'},body,signal:AbortSignal.timeout(25000)});
 return new Response(result.body,{status:result.status,headers:{'Content-Type':result.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
