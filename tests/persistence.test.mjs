import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {readState,writeState,validateState} from '../server/state.mjs';import {packShelves} from '../dist/packing.mjs';
// Execute the production repository queries on PostgreSQL WASM; no mocked SQL responses.
function adapter(db){const tag=(strings,...values)=>{
 if(!Array.isArray(strings)||!strings.raw)return {list:strings};
 tag.calls++;let query='',params=[];for(let i=0;i<strings.length;i++){query+=strings[i];if(i<values.length){const value=values[i];if(value?.list){query+='('+value.list.map(v=>{params.push(v);return '$'+params.length}).join(',')+')'}else{params.push(value?.json?JSON.stringify(value.json):value);query+='$'+params.length}}}
 return db.query(query,params).then(r=>r.rows);
 };tag.calls=0;tag.json=json=>({json});return tag;}
test('production save/read queries restore duplicates, order, settings and reject stale/foreign writes',async()=>{
 const db=new PGlite(),sql=adapter(db);try{
 await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));
 await db.exec(await fs.readFile('supabase/migrations/20261112083300_collection_status_frames.sql','utf8'));
 const a=randomUUID(),b=randomUUID();await db.query("insert into shelf.profiles(id,issuer,subject,shopify_customer_id) values($1,'iss','a','ca'),($2,'iss','b','cb')",[a,b]);await db.exec("insert into shelf.products(id) values('cow')");await db.exec('set role shelf_backend');
 const products=new Map([['cow',{w:60,h:50,d:30}]]);products.finishes=new Set(['ice']);
 const items=[{id:randomUUID(),productId:'cow'},{id:randomUUID(),productId:'cow'}],shelves=items.map(()=>({id:randomUUID(),settings:{background:null,bgX:50,bgY:50,bgDim:25,pieceIds:[],finish:'ice',fixture:'strip',weather:'rain',colour:'blue',brightness:80,speed:12,fog:45,fogSpeed:2,fogColour:"#abcdef",lightColour:"#123456"}}));
 let state={layoutId:randomUUID(),revision:0,items,order:items.map(i=>i.id),shelves,marketingPreference:false};
 async function as(owner,fn){await db.exec('begin');try{await db.query("select set_config('shelf.owner',$1,true)",[owner]);const result=await fn();await db.exec('commit');return result}catch(error){await db.exec('rollback');throw error}}
 const saved=await as(a,()=>writeState(sql,a,validateState(state,products),products,packShelves));assert.equal(saved.revision,1);
 const deviceTwo=await as(a,()=>readState(sql,a));assert.deepEqual(deviceTwo.order,state.order);assert.deepEqual(deviceTwo.shelves,shelves);assert.equal(deviceTwo.items.length,2);assert.equal(deviceTwo.profile.marketing_preference,null);
 await assert.rejects(as(a,()=>writeState(sql,a,state,products,packShelves)),e=>e.status===409);
 const other=await as(b,()=>readState(sql,b));assert.equal(other.items.length,0);
 await assert.rejects(as(b,()=>writeState(sql,b,{...state,revision:1},products,packShelves)),e=>e.status===409);
 state={...state,revision:1,order:[...state.order].reverse(),shelves:[...state.shelves].reverse().map((s,n)=>({...s,settings:{...s.settings,pieceIds:[state.order[1-n]]}}))};await as(a,()=>writeState(sql,a,state,products,packShelves));assert.deepEqual((await as(a,()=>readState(sql,a))).order,state.order);
 assert.deepEqual((await as(a,()=>readState(sql,a))).shelves,state.shelves);
 const theft={...state,layoutId:randomUUID(),revision:0};await assert.rejects(as(b,()=>writeState(sql,b,theft,products,packShelves)));
 assert.equal((await as(a,()=>readState(sql,a))).revision,2);
 // A large collection must not add one database round trip per piece/shelf.
 const bulkItems=Array.from({length:300},()=>({id:randomUUID(),productId:'cow'}));
 const bulkShelves=bulkItems.map(()=>({id:randomUUID(),settings:{...shelves[0].settings}}));
 const bulk={...state,revision:2,items:bulkItems,order:bulkItems.map(i=>i.id),shelves:bulkShelves};
 const before=sql.calls;await as(a,()=>writeState(sql,a,validateState(bulk,products),products,packShelves));
 assert.equal(sql.calls-before,8,'300 pieces save with eight bulk queries');
 const bulkRead=await as(a,()=>readState(sql,a));assert.equal(bulkRead.items.length,300);assert.deepEqual(bulkRead.order,bulk.order);
 bulk.shelves[0].settings.brightness=25;bulk.revision=3;
 await as(a,()=>writeState(sql,a,validateState(bulk,products),products,packShelves));
 assert.equal((await as(a,()=>readState(sql,a))).shelves[0].settings.brightness,25);
 const bad={...bulk,revision:4,shelves:[]};await assert.rejects(as(a,()=>writeState(sql,a,bad,products,packShelves)));
 assert.equal((await as(a,()=>readState(sql,a))).items.length,300,'failed bulk writes roll back');
 await as(a,()=>writeState(sql,a,{...bulk,revision:4,items:[],order:[],shelves:[]},products,packShelves));
 const empty=await as(a,()=>readState(sql,a));assert.equal(empty.items.length,0);assert.equal(empty.shelves.length,0);
 console.log('Bulk save: 300 pieces / 300 shelves = 8 database queries (previously 906).');
 }finally{await db.close()}
});
