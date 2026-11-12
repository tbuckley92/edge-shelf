import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {prepareAvatar,saveAvatar,readAvatar,readPublicAvatar} from '../server/avatar.mjs';
import {PGlite} from '@electric-sql/pglite';
import {readProfile,updateProfile,validateProfile,readPublicProfile,adminOverview,setEmployeeBadge} from '../server/profile.mjs';
import {sealToken,openToken,updateCustomerName} from '../server/customer.mjs';
import {validateState,writeState,readState} from '../server/state.mjs';
import {packShelves} from '../dist/packing.mjs';
import handler from '../netlify/functions/api.mjs';
function adapter(db){const tag=(strings,...values)=>{if(!strings.raw)return {list:strings};let q='',p=[];for(let i=0;i<strings.length;i++){q+=strings[i];if(i<values.length){const v=values[i];if(v?.list)q+='('+v.list.map(x=>{p.push(x);return '$'+p.length}).join(',')+')';else{p.push(v?.json?JSON.stringify(v.json):v);q+='$'+p.length}}}return db.query(q,p).then(r=>r.rows)};tag.json=json=>({json});return tag}
const privacy={nickname:true,country:false,collection:false,level:true,badges:false,firstName:false,lastName:false};
const input=revision=>({revision,nickname:'Bear collector',firstName:'',lastName:'',phone:'+447700900123',country:'GB',avatar:'forest',publicSharing:true,privacy});
test('profile validation rejects privilege escalation, email editing and malformed privacy',()=>{
 assert.equal(validateProfile(input(0)).nickname,'Bear collector');
 for(const patch of [{role:'admin'},{email:'x@example.com'},{badges:['official_employee']},{phone:'1234'},{privacy:{nickname:true}},{revision:-1}])assert.throws(()=>validateProfile({...input(0),...patch}),e=>e.status===400);
});
test('customer token encryption is bound to the session; tampering fails closed',()=>{
 const token='shopify-private-token',session='a'.repeat(43),sealed=sealToken(token,session);
 assert.ok(!sealed.includes(token));assert.equal(openToken(sealed,session),token);
 assert.throws(()=>openToken(sealed,'b'.repeat(43)),e=>e.status===401);
 assert.throws(()=>openToken(sealed.slice(0,-4)+'xxxx',session),e=>e.status===401);
});
test('profile endpoints enforce authentication and CSRF before storage',async()=>{
 for(const route of ['profile','admin'])assert.equal((await handler(new Request('https://example.com/api/'+route))).status,401);
 for(const [route,method] of [['profile','PUT'],['admin/badge','POST']])assert.equal((await handler(new Request('https://example.com/api/'+route,{method,headers:{Origin:'https://evil.example'},body:'{}'}))).status,403);
});
test('profile migration preserves collections, isolates users, projects public fields and audits privileged badge grants',async()=>{
 const db=new PGlite(),sql=adapter(db),a=randomUUID(),b=randomUUID();
 try{
 await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));
 await db.query("insert into shelf.profiles(id,issuer,subject,shopify_customer_id,display_name) values($1,'issuer','a','customer-a','Existing nickname'),($2,'issuer','b','customer-b','Other')",[a,b]);
 await db.exec("insert into shelf.products(id) values('bear')");
 await db.query("insert into shelf.owned_items(id,owner_id,product_id) values($1,$2,'bear'),($3,$2,'bear')",[randomUUID(),a,randomUUID()]);
 await db.exec(await fs.readFile('supabase/migrations/20261112073058_collector_profiles.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112075814_profile_avatars_privacy.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112083300_collection_status_frames.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112091800_named_displays.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112095223_rock_platforms.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112103624_rock_atmosphere.sql','utf8'));
 await db.exec('update shelf.profiles set profile_revision=0');
 const baseline=await db.query('select count(*)::int as n from shelf.owned_items');assert.equal(baseline.rows[0].n,2);
 await db.query("update shelf.profiles set email='private@example.com' where id=$1",[a]);
 async function as(owner,fn){await db.exec('begin;set local role shelf_backend');try{await db.query("select set_config('shelf.owner',$1,true)",[owner||'']);const result=await fn();await db.exec('commit');return result}catch(e){await db.exec('rollback');throw e}}
 let p=await as(a,()=>readProfile(sql,a));assert.equal(p.level,2);assert.equal(p.display_name,'Existing nickname');assert.equal(p.public_sharing,false);
 await assert.rejects(as(b,()=>readProfile(sql,a)),e=>e.status===404);
 await assert.rejects(as(null,()=>readPublicProfile(sql,a)),e=>e.status===404);
 await assert.rejects(as(a,()=>setEmployeeBadge(sql,a,{ownerId:a,active:true,reason:'Self grant'})),e=>e.status===403);
 await assert.rejects(as(a,()=>sql`insert into shelf.admin_roles(owner_id,role) values(${a},'admin')`),/permission denied/);
 await assert.rejects(as(a,()=>sql`insert into shelf.user_badges(owner_id,badge_key,awarded_by) values(${a},'official_employee',${a})`),/row-level security/);
 p=await as(a,()=>updateProfile(sql,a,validateProfile(input(0)),async()=>{throw Error('No name update expected')}));assert.equal(p.profile_revision,1);
 await assert.rejects(as(a,()=>updateProfile(sql,a,validateProfile(input(0)),async()=>{})),e=>e.status===409);
 let pub=await as(null,()=>readPublicProfile(sql,a));assert.deepEqual(pub,{nickname:'Bear collector',avatar:'forest',avatar_style:'initials',level:2});
 assert.ok(!JSON.stringify(pub).includes('private@example.com'));assert.ok(!('phone' in pub));assert.ok(!('country' in pub));
 await as(a,()=>updateProfile(sql,a,validateProfile({...input(1),privacy:{...privacy,collection:true,badges:true}}),async()=>{}));
 pub=await as(null,()=>readPublicProfile(sql,a));assert.deepEqual(pub.collection,[{productId:'bear',quantity:2}]);
 await db.query("insert into shelf.admin_roles(owner_id,role) values($1,'admin')",[b]);
 await as(b,()=>setEmployeeBadge(sql,b,{ownerId:a,active:true,reason:'Verified Edge employee'}));
 assert.equal((await as(a,()=>readProfile(sql,a))).badges[0].key,'official_employee');
 assert.equal((await as(a,()=>readProfile(sql,a))).isAdmin,false);
 const overview=await as(b,()=>adminOverview(sql,b));assert.equal(overview.users.length,2);assert.ok(overview.events.some(e=>e.reason==='Verified Edge employee'));
 assert.ok(overview.events.some(e=>e.action==='profiles.update'));
 await assert.rejects(as(b,()=>sql`delete from shelf.audit_events`),/permission denied/);
 await as(b,()=>setEmployeeBadge(sql,b,{ownerId:a,active:false,reason:'Employment ended'}));assert.equal((await as(a,()=>readProfile(sql,a))).badges.length,0);
 await as(a,()=>updateProfile(sql,a,validateProfile({...input(2),publicSharing:false}),async()=>{}));await assert.rejects(as(null,()=>readPublicProfile(sql,a)),e=>e.status===404);
 // Names are independently controlled, even when the public profile is enabled.
 await db.query("update shelf.profiles set first_name='PrivateFirst',last_name='PrivateLast' where id=$1",[a]);
 const current=await as(a,()=>readProfile(sql,a));
 await as(a,()=>updateProfile(sql,a,validateProfile({...input(current.profile_revision),firstName:'PrivateFirst',lastName:'PrivateLast',privacy:{...privacy,firstName:true,lastName:false}}),async()=>{}));
 const names=await as(null,()=>readPublicProfile(sql,a));assert.equal(names.firstName,'PrivateFirst');assert.ok(!('lastName' in names));assert.ok(!('email' in names));
 const jpg=await sharp({create:{width:60,height:90,channels:3,background:'#c09163'}}).jpeg().toBuffer(),bytes=await prepareAvatar(jpg);
 const beforePhoto=await as(a,()=>readProfile(sql,a));
 const savedPhoto=await as(a,()=>saveAvatar(sql,a,bytes,beforePhoto.profile_revision));
 assert.equal(savedPhoto.avatar_style,'photo');assert.equal((await as(a,()=>readAvatar(sql,a))).headers.get('content-type'),'image/webp');
 await assert.rejects(as(b,()=>readAvatar(sql,a)),e=>e.status===404);
 assert.equal((await as(null,()=>readPublicAvatar(sql,a))).status,200);
 await assert.rejects(as(a,()=>saveAvatar(sql,a,bytes,beforePhoto.profile_revision)),e=>e.status===409);
 await db.query('update shelf.profiles set public_sharing=false where id=$1',[a]);
 await assert.rejects(as(null,()=>readPublicAvatar(sql,a)),e=>e.status===404);
 await assert.rejects(prepareAvatar(Buffer.from('<svg onload="alert(1)"></svg>')),e=>e.status===400);
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,384);assert.equal(metadata.height,384);assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);
 // An owned copy can remain off the shelf and still contributes to level.

 const products=new Map([['bear',{w:30,h:40,d:20}]]);products.finishes=new Set(['ice']);
 const items=[{id:randomUUID(),productId:'bear'},{id:randomUUID(),productId:'bear'}];
 const state={layoutId:randomUUID(),revision:0,items,order:[],shelves:[]};
 await as(a,()=>sql`insert into shelf.layouts(id,owner_id) values(${state.layoutId},${a})`);
 await as(a,()=>writeState(sql,a,validateState(state,products),products,packShelves));
 assert.equal((await as(a,()=>readProfile(sql,a))).level,2);assert.deepEqual((await as(a,()=>readState(sql,a))).order,[]);
 await as(a,()=>writeState(sql,a,validateState({...state,revision:1,items:items.slice(0,1)},products),products,packShelves));assert.equal((await as(a,()=>readProfile(sql,a))).level,2,'display save does not delete inventory');
 await db.exec('create role anon;create role authenticated;set role anon');await assert.rejects(db.exec('select * from shelf.profiles'),/permission denied/);await assert.rejects(db.exec('select * from shelf.sessions'),/permission denied/);
 }finally{await db.close()}
});
