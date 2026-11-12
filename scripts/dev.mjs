// Local QA server only. Not imported or bundled by Netlify.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import handler from '../netlify/functions/api.mjs';import {packShelves} from '../dist/packing.mjs';
import {validateProfile,publicProjection} from '../server/profile.mjs';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'};
const catalog=JSON.parse(await fs.readFile('dist/catalog.json'));const items=catalog.map(p=>({id:randomUUID(),productId:p.id}));
const rows=packShelves(items.map(i=>i.id),new Map(items.map(i=>[i.id,catalog.find(p=>p.id===i.productId)])));
let fixture={profile:{marketing_preference:null},layoutId:randomUUID(),revision:0,items,order:items.map(i=>i.id),shelves:rows.map((_,i)=>({id:randomUUID(),settings:{finish:['ice','jungle','oak','temple','magma'][i%5],weather:'none',fixture:'spot',colour:'warm',brightness:70,speed:15}}))};
let profileFixture={id:randomUUID(),display_name:'The Bear Collector',first_name:'Alex',last_name:'Collector',email:'collector@example.com',phone:'',country:'GB',avatar:'forest',avatar_style:'bear',avatar_version:null,public_sharing:false,privacy:{nickname:true,country:false,collection:false,level:true,badges:true,firstName:false,lastName:false},profile_revision:0,created_at:new Date().toISOString(),badges:[],isAdmin:true,accountUrl:'https://example.com/account/profile'};
const qaEvents=[];let qaAvatar=null;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__qa'){res.setHeader('Set-Cookie','edge_qa=1; Path=/; SameSite=Lax');res.setHeader('Location','/?qa=1');res.writeHead(302);return res.end()}
 if(url.pathname.startsWith('/api/')){
  if(req.headers.cookie?.includes('edge_qa=1')){
   let result;
   if(url.pathname==='/api/bootstrap')result={profile:{...profileFixture,level:fixture.items.length},state:fixture};
   else if(url.pathname==='/api/avatar'&&req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);qaAvatar=Buffer.concat(chunks);profileFixture={...profileFixture,avatar_style:'photo',avatar_version:randomUUID(),profile_revision:profileFixture.profile_revision+1};result={avatar_style:'photo',avatar_version:profileFixture.avatar_version,profile_revision:profileFixture.profile_revision};}
   else if(url.pathname.startsWith('/api/avatar')&&qaAvatar){res.setHeader('Content-Type','image/jpeg');return res.end(qaAvatar);}
   else if(url.pathname==='/api/profile'){
    if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;const p=validateProfile(JSON.parse(body));profileFixture={...profileFixture,display_name:p.nickname,first_name:p.firstName,last_name:p.lastName,phone:p.phone,country:p.country,avatar:p.avatar,avatar_style:p.avatarStyle,public_sharing:p.publicSharing,privacy:p.privacy,profile_revision:profileFixture.profile_revision+1};qaEvents.unshift({id:randomUUID(),owner_id:profileFixture.id,actor_id:profileFixture.id,action:'profiles.update',created_at:new Date().toISOString(),changes:{profile:'changed'}})}
    result={...profileFixture,level:fixture.items.length};
   }else if(url.pathname.startsWith('/api/profiles/')){
    const counts=new Map();for(const i of fixture.items)counts.set(i.productId,(counts.get(i.productId)||0)+1);
    result=publicProjection(profileFixture,[...counts].map(([productId,quantity])=>({productId,quantity})),profileFixture.badges);
    if(!result){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'This profile is private or unavailable.'}))}
   }else if(url.pathname==='/api/admin')result={users:[{...profileFixture,level:fixture.items.length}],events:qaEvents};
   else if(url.pathname==='/api/admin/badge'){let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);profileFixture.badges=p.active?[{key:'official_employee',label:'Official Edge Employee',kind:'official'}]:[];qaEvents.unshift({id:randomUUID(),owner_id:profileFixture.id,actor_id:profileFixture.id,action:'user_badges.update',reason:p.reason,created_at:new Date().toISOString(),changes:{badge:'changed'}});result={ok:true}}
   if(result){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result))}
  }
  if(req.headers.cookie?.includes('edge_qa=1')&&url.pathname==='/api/collection'){
   if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;const next=JSON.parse(body);if(next.revision!==fixture.revision){res.writeHead(409,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Stale fixture'}))}fixture={...next,profile:fixture.profile,revision:next.revision+1}}
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(req.method==='GET'?fixture:{revision:fixture.revision}));
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})});const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
 }
 const file=path.resolve('dist','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(path.resolve('dist')+path.sep))throw Error();
 let bytes=await fs.readFile(file);
 if(req.headers.cookie?.includes('edge_qa=1')&&file.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace('<body>','<body><aside style="text-align:center;background:#fff3cc;padding:8px">Local UI fixture — simulated session, no Shopify login</aside>'));
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}});
server.listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0',()=>console.log('Edge Shelf local preview ready'));
