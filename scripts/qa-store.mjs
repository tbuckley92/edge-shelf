// Local UI fixture. Never bundled into Netlify functions.
import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {readProfile,validateProfile,updateProfile,readPublicProfile,adminOverview,setEmployeeBadge} from '../server/profile.mjs';
import {readState,validateState,writeState} from '../server/state.mjs';import {readCollectionManager,manageCollection} from '../server/collection-manager.mjs';import {listDisplays,mutateDisplay} from '../server/displays.mjs';import {materialKeys} from '../server/material-keys.mjs';import {packShelves} from '../dist/packing.mjs';import {prepareAvatar,saveAvatar,readAvatar,readPublicAvatar} from '../server/avatar.mjs';
const db=new PGlite(),owner=randomUUID();const catalog=JSON.parse(await fs.readFile('dist/catalog.json')),products=new Map(catalog.map(p=>[p.id,p]));products.finishes=new Set(materialKeys);
function sql(strings,...values){if(!strings.raw)return {list:strings};let q='',params=[];for(let i=0;i<strings.length;i++){q+=strings[i];if(i<values.length){const v=values[i];if(v?.list)q+='('+v.list.map(v=>{params.push(v);return '$'+params.length}).join(',')+')';else{params.push(v?.json?JSON.stringify(v.json):v);q+='$'+params.length}}}return db.query(q,params).then(r=>r.rows)}sql.json=json=>({json});
await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));for(const f of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile('supabase/migrations/'+f,'utf8'));
await sql`insert into shelf.profiles(id,issuer,subject,shopify_customer_id,display_name,first_name,last_name,email,country,avatar,avatar_style) values(${owner},'fixture','collector','fixture','The Bear Collector','Alex','Collector','collector@example.com','GB','forest','bear')`;
await sql`insert into shelf.products(id) select value from jsonb_array_elements_text(${sql.json(catalog.map(p=>p.id))})`;
await sql`insert into shelf.admin_roles(owner_id,role) values(${owner},'admin')`;
const selected=catalog.filter(p=>/^(Panda Cub|Dragon - Red|Tiger Cub - Bengal|Bear Cub|Horse Bust - Bay|Owl - Golden|Fox Bust|Elephant Calf)$/.test(p.name));
for(const [n,p] of selected.entries())await sql`insert into shelf.owned_items(id,owner_id,product_id,status) values(${randomUUID()},${owner},${p.id},${['current','previous','wishlist'][n%3]})`;
let queue=Promise.resolve();function run(fn){const work=queue.catch(()=>{}).then(async()=>{await db.exec('begin;set local role shelf_backend');await sql`select set_config('shelf.owner',${owner},true)`;try{const r=await fn();await db.exec('commit');return r}catch(e){await db.exec('rollback');throw e}});queue=work;return work}
await run(()=>mutateDisplay(sql,owner,{action:'create',name:'My Ice Cabinet',type:'cabinet',frame:'ice',defaultFinish:'ice',populate:'all'},products));
export function qa(request){return run(async()=>{const url=new URL(request.url),path=url.pathname,method=request.method,json=x=>Response.json(x);let body;if(['POST','PUT'].includes(method)&&path!=='/api/avatar')body=await request.json();
 if(path==='/api/bootstrap')return json({profile:{...await readProfile(sql,owner),accountUrl:'https://example.com/account/profile'},state:await readState(sql,owner,url.searchParams.get('display'))});
 if(path==='/api/displays')return json(method==='GET'?await listDisplays(sql,owner):await mutateDisplay(sql,owner,body,products));
 if(path==='/api/collection/manage')return json(method==='GET'?await readCollectionManager(sql,owner):await manageCollection(sql,owner,body,products));
 if(path==='/api/collection')return json(method==='GET'?await readState(sql,owner,url.searchParams.get('display')):await writeState(sql,owner,validateState(body,products),products,packShelves));
 if(path==='/api/profile')return json({...method==='PUT'?await updateProfile(sql,owner,validateProfile(body),async()=>{}):await readProfile(sql,owner),accountUrl:'https://example.com/account/profile'});
 if(path.startsWith('/api/profiles/'))return json(await readPublicProfile(sql,path.slice('/api/profiles/'.length)));
 if(path==='/api/avatar'&&method==='POST')return json(await saveAvatar(sql,owner,await prepareAvatar(Buffer.from(await request.arrayBuffer())),Number(request.headers.get('x-profile-revision'))));
 if(path==='/api/avatar')return readAvatar(sql,owner);
 if(path.startsWith('/api/avatar/'))return readPublicAvatar(sql,path.slice('/api/avatar/'.length));
 if(path==='/api/admin')return json(await adminOverview(sql,owner));if(path==='/api/admin/badge')return json(await setEmployeeBadge(sql,owner,body));
 return json({error:'Fixture endpoint unavailable.'});
 }).catch(e=>Response.json({error:e.message},{status:e.status||500}))}
