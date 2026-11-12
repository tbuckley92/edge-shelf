import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {readCollectionManager,manageCollection} from '../server/collection-manager.mjs';import {readProfile} from '../server/profile.mjs';import {readState,validateState,writeState} from '../server/state.mjs';import {packShelves} from '../dist/packing.mjs';
function adapter(db){const tag=(strings,...values)=>{if(!strings.raw)return {list:strings};let query='',params=[];for(let i=0;i<strings.length;i++){query+=strings[i];if(i<values.length){const value=values[i];if(value?.list)query+='('+value.list.map(v=>{params.push(v);return '$'+params.length}).join(',')+')';else{params.push(value?.json?JSON.stringify(value.json):value);query+='$'+params.length}}}return db.query(query,params).then(r=>r.rows)};tag.json=json=>({json});return tag;}
test('collection statuses, placement removal, framing and stale-device isolation',async()=>{
 const db=new PGlite(),sql=adapter(db),a=randomUUID(),b=randomUUID(),products=new Map([['bear',{w:20,h:20,d:20}]]);products.finishes=new Set(['ice']);
 try{
 for(const f of ['migrations/001_edge_shelf.sql','supabase/migrations/20261112073058_collector_profiles.sql','supabase/migrations/20261112075814_profile_avatars_privacy.sql','supabase/migrations/20261112083300_collection_status_frames.sql'])await db.exec(await fs.readFile(f,'utf8'));
 await db.query("insert into shelf.profiles(id,issuer,subject,shopify_customer_id) values($1,'iss','a','a'),($2,'iss','b','b')",[a,b]);await db.exec("insert into shelf.products(id) values('bear');set role shelf_backend");
 async function as(owner,fn){await db.exec('begin');try{await db.query("select set_config('shelf.owner',$1,true)",[owner]);const result=await fn();await db.exec('commit');return result}catch(e){await db.exec('rollback');throw e}}
 let data=await as(a,()=>manageCollection(sql,a,{action:'add',versions:[],productId:'bear',status:'current'},products));const id=data.items[0].id;
 assert.equal(data.items[0].status,'current');assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 data=await as(a,()=>manageCollection(sql,a,{action:'place',versions:data.versions,itemId:id},products));assert.equal(data.items[0].locations[0].row,1);
 let state=await as(a,()=>readState(sql,a));await as(a,()=>writeState(sql,a,validateState({...state,frame:'temple'},products),products,packShelves));assert.equal((await as(a,()=>readState(sql,a))).frame,'temple');
 await assert.rejects(as(a,()=>manageCollection(sql,a,{action:'status',versions:data.versions,itemId:id,status:'previous'},products)),e=>e.status===409);
 data=await as(a,()=>readCollectionManager(sql,a));const loc=data.items[0].locations[0];
 data=await as(a,()=>manageCollection(sql,a,{action:'removePlacement',versions:data.versions,itemId:id,...loc},products));assert.equal(data.items[0].locations.length,0);assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 data=await as(a,()=>manageCollection(sql,a,{action:'place',versions:data.versions,itemId:id},products));
 const second=randomUUID(),secondRow=randomUUID();await as(a,async()=>{await sql`insert into shelf.layouts(id,owner_id,name) values(${second},${a},'Bears')`;await sql`insert into shelf.shelves(id,owner_id,layout_id,position) values(${secondRow},${a},${second},0)`;await sql`insert into shelf.placements(owner_id,layout_id,item_id,shelf_id,position) values(${a},${second},${id},${secondRow},0)`});
 data=await as(a,()=>readCollectionManager(sql,a));assert.equal(data.items[0].locations.length,2);assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 state=await as(a,()=>readState(sql,a));
 data=await as(a,()=>manageCollection(sql,a,{action:'status',versions:data.versions,itemId:id,status:'previous'},products));assert.equal(data.items[0].locations.length,0);assert.equal((await as(a,()=>readProfile(sql,a))).level,0);
 await assert.rejects(as(a,()=>writeState(sql,a,state,products,packShelves)),e=>e.status===409);
 data=await as(a,()=>manageCollection(sql,a,{action:'add',versions:data.versions,productId:'bear',status:'wishlist'},products));assert.equal(data.items.length,2);assert.equal((await as(a,()=>readProfile(sql,a))).level,0);
 await assert.rejects(as(a,()=>manageCollection(sql,a,{action:'place',versions:data.versions,itemId:id},products)),e=>e.status===400);
 assert.equal((await as(b,()=>readCollectionManager(sql,b))).items.length,0);
 await assert.rejects(as(b,()=>manageCollection(sql,b,{action:'status',versions:[],itemId:id,status:'current'},products)),e=>e.status===404);
 data=await as(a,()=>manageCollection(sql,a,{action:'status',versions:data.versions,itemId:id,status:'current'},products));assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 assert.throws(()=>validateState({...state,items:state.items.map(i=>({...i,status:'wishlist'}))},products));
 const audits=await db.query("select count(*)::int as n from shelf.audit_events"); // owner role cannot read audit unless admin
 assert.equal(audits.rows[0].n,0);
 }finally{await db.close()}
});
