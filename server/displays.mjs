import {validateRocks} from '../dist/rock-layout.mjs';
import {randomUUID} from 'node:crypto';
import {HttpError} from './security.mjs';
import {readState,writeState} from './state.mjs';
import {packShelves} from '../dist/packing.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses=['current','previous','wishlist'];
export async function listDisplays(sql,owner){
 return sql`select l.id,l.name,l.frame,l.display_type as type,l.default_finish as "defaultFinish",l.revision,
 (select count(*)::int from shelf.placements x where x.owner_id=${owner} and x.layout_id=l.id) as count,
 coalesce((select jsonb_agg(t.product_id) from (select i.product_id from shelf.placements x join shelf.owned_items i on i.id=x.item_id where x.owner_id=${owner} and x.layout_id=l.id order by x.position limit 3) t),'[]'::jsonb) as previews
 from shelf.layouts l where l.owner_id=${owner} order by l.created_at,l.id`;
}
function name(value){if(typeof value!=='string'||!value.trim()||value.trim().length>60||/[\u0000-\u001f\u007f]/.test(value))throw new HttpError(400,'Use a display name between 1 and 60 characters.');return value.trim()}
export async function mutateDisplay(sql,owner,body,products){
 if(!body||!['create','rename','addStatus','addItems','addProduct','remove','configureRocks'].includes(body.action))throw new HttpError(400,'Invalid display action.');
 // Serialize inventory additions with collection management, always owner then layout.
 await sql`select id from shelf.profiles where id=${owner} for update`;
 let id=body.displayId;
 if(body.action==='create'){
  const title=name(body.name),type=body.type,frame=body.frame??'classic',finish=body.defaultFinish??'ice';
  if(!['cabinet','rocks'].includes(type)||!['classic','black','temple','rock','ice'].includes(frame)||!products.finishes.has(finish)||(!['none','all',...statuses].includes(body.populate??'none')))throw new HttpError(400,'Choose a display type, frame and shelf finish.');
  const [count]=await sql`select count(*)::int as n from shelf.layouts where owner_id=${owner}`;
  if(count.n>=50)throw new HttpError(400,'You can create up to 50 displays.');
  const existing=await sql`select id from shelf.layouts where owner_id=${owner} and name=${title}`;
  if(existing.length)throw new HttpError(400,'You already have a display with that name.');
  id=randomUUID();await sql`insert into shelf.layouts(id,owner_id,name,display_type,frame,default_finish) values(${id},${owner},${title},${type},${frame},${finish})`;
 }else{
  if(!uuid.test(id)||!Number.isSafeInteger(body.revision))throw new HttpError(400,'Invalid display.');
  const [current]=await sql`select revision from shelf.layouts where id=${id} and owner_id=${owner} for update`;
  if(!current)throw new HttpError(404,'Display unavailable.');
  if(current.revision!==body.revision)throw new HttpError(409,'This display changed elsewhere. Reload before editing.');
 }
 if(body.action==='configureRocks'){
  const state=await readState(sql,owner,id);
  if(state.type!=='rocks')throw new HttpError(400,'Rock settings require a rock display.');
  let config;try{config=validateRocks(body.rocks,state.order)}catch(e){throw new HttpError(400,e.message)}
  await sql`update shelf.layouts set rock_config=${sql.json(config)},revision=revision+1 where id=${id} and owner_id=${owner}`;
  await sql`insert into shelf.audit_events(actor_id,owner_id,action,changes) values(${owner},${owner},'display.configureRocks',${sql.json({displayId:id,platformCount:config.length})})`;
  return readState(sql,owner,id);
 }
 if(body.action==='rename'){
  const title=name(body.name);const existing=await sql`select id from shelf.layouts where owner_id=${owner} and name=${title} and id<>${id}`;
  if(existing.length)throw new HttpError(400,'You already have a display with that name.');
  await sql`update shelf.layouts set name=${title},revision=revision+1 where id=${id} and owner_id=${owner}`;
  await sql`insert into shelf.audit_events(actor_id,owner_id,action,changes) values(${owner},${owner},'display.rename',${sql.json({displayId:id})})`;
  return readState(sql,owner,id);
 }
 let createdId=null;
 if(body.action==='addProduct'){
  if(!products.has(body.productId)||!statuses.includes(body.status))throw new HttpError(400,'Choose a product and collection status.');
  const [count]=await sql`select count(*)::int as n from shelf.owned_items where owner_id=${owner}`;
  if(count.n>=3000)throw new HttpError(400,'Collection limit reached.');
  await sql`update shelf.profiles set collection_revision=collection_revision+1 where id=${owner}`;
  createdId=randomUUID();await sql`insert into shelf.owned_items(id,owner_id,product_id,status) values(${createdId},${owner},${body.productId},${body.status})`;
 }
 const state=await readState(sql,owner,id),available=new Set(state.items.map(i=>i.id));
 if(body.action==='remove'){
  if(!uuid.test(body.itemId)||!state.order.includes(body.itemId))throw new HttpError(404,'Placement unavailable.');
  state.order=state.order.filter(i=>i!==body.itemId);for(const s of state.shelves)if(s.settings.pieceIds)s.settings.pieceIds=s.settings.pieceIds.filter(i=>i!==body.itemId);
 }else{
  let add=[];
  if(body.action==='addItems'){
   if(!Array.isArray(body.itemIds)||body.itemIds.length>3000||body.itemIds.some(i=>!available.has(i)))throw new HttpError(400,'Choose pieces from your collection.');add=body.itemIds;
  }
  if(createdId)add=[createdId];
  const status=body.action==='create'?body.populate:body.action==='addStatus'?body.status:null;
  if(status&&status!=='none'){
   if(!['all',...statuses].includes(status))throw new HttpError(400,'Invalid status filter.');
   add=state.items.filter(i=>status==='all'||i.status===status).map(i=>i.id);
  }
  state.order=[...new Set([...state.order,...add])];
 }
 const byId=new Map(state.items.map(i=>[i.id,products.get(i.productId)]));
 const rows=state.type==='rocks'?[]:packShelves(state.order,byId,state.shelves.map(s=>s.settings.pieceIds||[]));
 while(state.shelves.length<rows.length)state.shelves.push({id:randomUUID(),settings:{finish:state.defaultFinish,weather:'none',fixture:'spot',colour:'warm',brightness:70,speed:15}});
 const saved=await writeState(sql,owner,state,products,packShelves);
 await sql`insert into shelf.audit_events(actor_id,owner_id,action,changes) values(${owner},${owner},${'display.'+body.action},${sql.json({displayId:id,count:state.order.length})})`;
 return {...state,revision:saved.revision};
}
