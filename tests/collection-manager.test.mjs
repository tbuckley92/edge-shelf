import {defaultPillarEffects} from '../dist/pillar-effects.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
import {readCollectionManager,manageCollection} from '../server/collection-manager.mjs';import {readProfile} from '../server/profile.mjs';import {readState,validateState,writeState} from '../server/state.mjs';import {packShelves} from '../dist/packing.mjs';import {listDisplays,mutateDisplay} from '../server/displays.mjs';
function adapter(db){const tag=(strings,...values)=>{if(!strings.raw)return {list:strings};let query='',params=[];for(let i=0;i<strings.length;i++){query+=strings[i];if(i<values.length){const value=values[i];if(value?.list)query+='('+value.list.map(v=>{params.push(v);return '$'+params.length}).join(',')+')';else{params.push(value?.json?JSON.stringify(value.json):value);query+='$'+params.length}}}return db.query(query,params).then(r=>r.rows)};tag.json=json=>({json});return tag;}
test('named cabinets and rocks preserve inventory, statuses, independent placements and owner isolation',async()=>{
 const db=new PGlite(),sql=adapter(db),a=randomUUID(),b=randomUUID(),products=new Map([['bear',{w:20,h:20,d:20}],['large',{w:150,h:20}]]);products.finishes=new Set(['ice','rock']);
 try{
 await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));for(const f of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile('supabase/migrations/'+f,'utf8'));
 await db.query("insert into shelf.profiles(id,issuer,subject,shopify_customer_id) values($1,'iss','a','a'),($2,'iss','b','b')",[a,b]);await db.exec("insert into shelf.products(id) values('bear'),('large');set role shelf_backend");
 async function as(owner,fn){await db.exec('begin');try{await db.query("select set_config('shelf.owner',$1,true)",[owner]);const result=await fn();await db.exec('commit');return result}catch(e){await db.exec('rollback');throw e}}
 let data=await as(a,()=>readCollectionManager(sql,a));async function manage(body){data=await as(a,()=>manageCollection(sql,a,{...body,versions:data.versions,collectionRevision:data.collectionRevision},products));return data}
 for(const status of ['current','previous','wishlist'])await manage({action:'add',productId:'bear',status});
 assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 let cabinet=await as(a,()=>mutateDisplay(sql,a,{action:'create',name:'Ice Cabinet',type:'cabinet',frame:'ice',defaultFinish:'ice',populate:'all'},products));
 let rocks=await as(a,()=>mutateDisplay(sql,a,{action:'create',name:'Rock Garden',type:'rocks',frame:'rock',defaultFinish:'rock',populate:'all'},products));
 assert.equal(cabinet.order.length,3);assert.equal(rocks.order.length,3);assert.equal(rocks.shelves.length,0);assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 assert.equal((await as(b,()=>listDisplays(sql,b))).length,0);await assert.rejects(as(b,()=>readState(sql,b,rocks.layoutId)),e=>e.status===404);
 const inventoryBefore=cabinet.items;await as(a,()=>writeState(sql,a,validateState({...cabinet,items:[],order:[],shelves:[]},products),products,packShelves));assert.equal((await as(a,()=>readState(sql,a,rocks.layoutId))).order.length,3);assert.deepEqual((await as(a,()=>readState(sql,a,rocks.layoutId))).items,inventoryBefore);
 data=await as(a,()=>readCollectionManager(sql,a));const wish=data.items.find(i=>i.status==='wishlist');await manage({action:'place',itemId:wish.id,displayId:cabinet.layoutId});assert.equal(data.items.find(i=>i.id===wish.id).locations.length,2);
 const staleRocks=await as(a,()=>readState(sql,a,rocks.layoutId));await manage({action:'status',itemId:wish.id,status:'previous'});assert.equal(data.items.find(i=>i.id===wish.id).locations.length,2,'status changes preserve all placements');
 await assert.rejects(as(a,()=>writeState(sql,a,staleRocks,products,packShelves)),e=>e.status===409);
 const loc=data.items.find(i=>i.id===wish.id).locations.find(l=>l.layoutId===rocks.layoutId);await manage({action:'removePlacement',itemId:wish.id,...loc});assert.equal(data.items.find(i=>i.id===wish.id).locations.length,1);
 rocks=await as(a,()=>readState(sql,a,rocks.layoutId));rocks=await as(a,()=>mutateDisplay(sql,a,{action:'addStatus',displayId:rocks.layoutId,revision:rocks.revision,status:'previous'},products));assert.equal(rocks.order.length,3);
 rocks=await as(a,()=>mutateDisplay(sql,a,{action:'addProduct',displayId:rocks.layoutId,revision:rocks.revision,productId:'large',status:'wishlist'},products));assert.equal(rocks.order.length,4,'rocks accept oversized cabinet pieces');assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 await assert.rejects(as(b,()=>mutateDisplay(sql,b,{action:'remove',displayId:rocks.layoutId,revision:rocks.revision,itemId:wish.id},products)),e=>e.status===404);
 await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'create',name:'Ice Cabinet',type:'rocks',frame:'rock',defaultFinish:'rock'},products)),e=>e.status===400);
 rocks=await as(a,()=>mutateDisplay(sql,a,{action:'rename',displayId:rocks.layoutId,revision:rocks.revision,name:'Dream Rocks'},products));assert.equal(rocks.name,'Dream Rocks');assert.equal((await as(a,()=>readState(sql,a,rocks.layoutId))).name,'Dream Rocks');
 const other=await as(b,()=>mutateDisplay(sql,b,{action:'create',name:'Other',type:'cabinet',frame:'black',defaultFinish:'ice'},products));await assert.rejects(as(b,()=>mutateDisplay(sql,b,{action:'addItems',displayId:other.layoutId,revision:other.revision,itemIds:[wish.id]},products)),e=>e.status===400);
 const pillarStyles=['egyptian','aztec','ice','lava','jungle','greek','tree','gothic','crystal','coral'];
 let pillars=await as(a,()=>mutateDisplay(sql,a,{action:'create',name:'Ancient Gallery',type:'pillars',frame:'classic',defaultFinish:'ice',populate:'all'},products));
 assert.equal(pillars.type,'pillars');assert.equal(pillars.shelves.length,0);assert.deepEqual(pillars.items,rocks.items);assert.deepEqual(pillars.order.slice().sort(),rocks.order.slice().sort());
 const pillarConfig=pillarStyles.map((style,i)=>({id:'column-'+i,style,size:'small',foreground:'none',effects:{...defaultPillarEffects,weather:i%2?'snow':'plasma',fogSpeed:i*10},pieceIds:pillars.order[i]?[pillars.order[i]]:[]}));
 pillars=await as(a,()=>mutateDisplay(sql,a,{action:'configureRocks',displayId:pillars.layoutId,revision:pillars.revision,rocks:pillarConfig},products));
 assert.deepEqual(pillars.rockConfig.map(r=>r.style),pillarStyles);assert.deepEqual(pillars.rockConfig.map(r=>r.effects),pillarConfig.map(r=>r.effects));assert.deepEqual((await as(a,()=>readState(sql,a,pillars.layoutId))).rockConfig,pillars.rockConfig);
 await assert.rejects(as(b,()=>mutateDisplay(sql,b,{action:'configureRocks',displayId:pillars.layoutId,revision:pillars.revision,rocks:pillarConfig},products)),e=>e.status===404);
 await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'configureRocks',displayId:pillars.layoutId,revision:pillars.revision,rocks:[{...pillarConfig[0],style:'waterfall'}]},products)),e=>e.status===400);
 pillars=await as(a,()=>mutateDisplay(sql,a,{action:'configureAtmosphere',displayId:pillars.layoutId,revision:pillars.revision,atmosphere:{fog:false,density:20,speed:10,colour:'#aabbcc',background:'sky'}},products));assert.equal(pillars.atmosphere.fog,false);
 const pillarPiece=pillars.order[0];pillars=await as(a,()=>mutateDisplay(sql,a,{action:'remove',displayId:pillars.layoutId,revision:pillars.revision,itemId:pillarPiece},products));assert.equal(pillars.order.includes(pillarPiece),false);assert.deepEqual(pillars.items,rocks.items);assert.equal(pillars.shelves.length,0);
 const config=[{id:'platform-one',style:'waterfall',size:'small',foreground:'shrubs',pieceIds:rocks.order.slice(0,1)}];
 const atmosphere={fog:true,density:85,speed:20,colour:'#aaccdd',background:'mountains'};
 const preAtmosphere=rocks;rocks=await as(a,()=>mutateDisplay(sql,a,{action:'configureAtmosphere',displayId:rocks.layoutId,revision:rocks.revision,atmosphere},products));
 assert.deepEqual(rocks.atmosphere,atmosphere);assert.deepEqual(rocks.order,preAtmosphere.order);assert.deepEqual(rocks.items,preAtmosphere.items);
 assert.deepEqual((await as(a,()=>readState(sql,a,rocks.layoutId))).atmosphere,atmosphere);
 await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'configureAtmosphere',displayId:rocks.layoutId,revision:preAtmosphere.revision,atmosphere},products)),e=>e.status===409);
 await assert.rejects(as(b,()=>mutateDisplay(sql,b,{action:'configureAtmosphere',displayId:rocks.layoutId,revision:rocks.revision,atmosphere},products)),e=>e.status===404);
 await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'configureAtmosphere',displayId:rocks.layoutId,revision:rocks.revision,atmosphere:{...atmosphere,density:101}},products)),e=>e.status===400);
 const beforeConfig=rocks;rocks=await as(a,()=>mutateDisplay(sql,a,{action:'configureRocks',displayId:rocks.layoutId,revision:rocks.revision,rocks:config},products));
 assert.deepEqual(rocks.order,beforeConfig.order);assert.deepEqual(rocks.items,beforeConfig.items);assert.equal(rocks.rockConfig.length,4);assert.equal(rocks.rockConfig[0].pieceIds.length,1);
 assert.deepEqual((await as(a,()=>readState(sql,a,rocks.layoutId))).rockConfig,rocks.rockConfig);
 await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'configureRocks',displayId:rocks.layoutId,revision:beforeConfig.revision,rocks:[]},products)),e=>e.status===409);
 await assert.rejects(as(b,()=>mutateDisplay(sql,b,{action:'configureRocks',displayId:rocks.layoutId,revision:rocks.revision,rocks:[]},products)),e=>e.status===404);
 for(const invalid of [[{...config[0],pieceIds:rocks.order.slice(0,2)}],[{...config[0],pieceIds:[randomUUID()]}],[config[0],{...config[0],id:'duplicate-copy'}]])await assert.rejects(as(a,()=>mutateDisplay(sql,a,{action:'configureRocks',displayId:rocks.layoutId,revision:rocks.revision,rocks:invalid},products)),e=>e.status===400);
 assert.equal((await as(a,()=>readProfile(sql,a))).level,1);
 const old=data;data=await as(a,()=>readCollectionManager(sql,a));await assert.rejects(as(a,()=>manageCollection(sql,a,{action:'status',versions:old.versions,collectionRevision:old.collectionRevision,itemId:wish.id,status:'current'},products)),e=>e.status===409);
 }finally{await db.close()}
});
