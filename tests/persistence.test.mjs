import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {readState,writeState,validateState} from '../server/state.mjs';import {packShelves} from '../dist/packing.mjs';
// Execute the production repository queries on PostgreSQL WASM; no mocked SQL responses.
function adapter(db){const tag=(strings,...values)=>{
 if(!Array.isArray(strings)||!strings.raw)return {list:strings};
 let query='',params=[];for(let i=0;i<strings.length;i++){query+=strings[i];if(i<values.length){const value=values[i];if(value?.list){query+='('+value.list.map(v=>{params.push(v);return '$'+params.length}).join(',')+')'}else{params.push(value?.json?JSON.stringify(value.json):value);query+='$'+params.length}}}
 return db.query(query,params).then(r=>r.rows);
 };tag.json=json=>({json});return tag;}
test('production save/read queries restore duplicates, order, settings and reject stale/foreign writes',async()=>{
 const db=new PGlite(),sql=adapter(db);try{
 await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));
 const a=randomUUID(),b=randomUUID();await db.query("insert into shelf.profiles(id,issuer,subject,shopify_customer_id) values($1,'iss','a','ca'),($2,'iss','b','cb')",[a,b]);await db.exec("insert into shelf.products(id) values('cow')");await db.exec('set role shelf_backend');
 const products=new Map([['cow',{w:60,h:50,d:30}]]);products.finishes=new Set(['ice']);
 const items=[{id:randomUUID(),productId:'cow'},{id:randomUUID(),productId:'cow'}],shelves=items.map(()=>({id:randomUUID(),settings:{finish:'ice',fixture:'strip',weather:'rain',colour:'blue',brightness:80,speed:12}}));
 let state={layoutId:randomUUID(),revision:0,items,order:items.map(i=>i.id),shelves,marketingPreference:false};
 async function as(owner,fn){await db.exec('begin');try{await db.query("select set_config('shelf.owner',$1,true)",[owner]);const result=await fn();await db.exec('commit');return result}catch(error){await db.exec('rollback');throw error}}
 const saved=await as(a,()=>writeState(sql,a,validateState(state,products),products,packShelves));assert.equal(saved.revision,1);
 const deviceTwo=await as(a,()=>readState(sql,a));assert.deepEqual(deviceTwo.order,state.order);assert.deepEqual(deviceTwo.shelves,shelves);assert.equal(deviceTwo.items.length,2);assert.equal(deviceTwo.profile.marketing_preference,false);
 await assert.rejects(as(a,()=>writeState(sql,a,state,products,packShelves)),e=>e.status===409);
 const other=await as(b,()=>readState(sql,b));assert.equal(other.items.length,0);
 await assert.rejects(as(b,()=>writeState(sql,b,{...state,revision:1},products,packShelves)),e=>e.status===409);
 state={...state,revision:1,order:[...state.order].reverse()};await as(a,()=>writeState(sql,a,state,products,packShelves));assert.deepEqual((await as(a,()=>readState(sql,a))).order,state.order);
 const theft={...state,layoutId:randomUUID(),revision:0};await assert.rejects(as(b,()=>writeState(sql,b,theft,products,packShelves)));
 assert.equal((await as(a,()=>readState(sql,a))).revision,2);
 }finally{await db.close()}
});
