import {readState,writeState} from './state.mjs';
import {packShelves} from '../dist/packing.mjs';
import {randomUUID} from 'node:crypto';
import {HttpError} from './security.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function readCollectionManager(sql,owner){
 const [data]=await sql`select
 coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'revision',l.revision) order by l.id) from shelf.layouts l where l.owner_id=p.id),'[]'::jsonb) as versions,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'productId',i.product_id,'status',i.status,'locations',
 coalesce((select jsonb_agg(jsonb_build_object('layoutId',x.layout_id,'shelfId',x.shelf_id,'name',l.name,'row',s.position+1) order by l.name,s.position) from shelf.placements x join shelf.layouts l on l.id=x.layout_id left join shelf.shelves s on s.id=x.shelf_id where x.owner_id=p.id and x.item_id=i.id),'[]'::jsonb)) order by i.id) from shelf.owned_items i where i.owner_id=p.id),'[]'::jsonb) as items
 from shelf.profiles p where p.id=${owner}`;
 if(!data)throw new HttpError(404,'Collection unavailable.');return data;
}
export async function manageCollection(sql,owner,body,products){
 if(!body||!['status','removePlacement','add','place'].includes(body.action)||!Array.isArray(body.versions)||body.versions.length>100)throw new HttpError(400,'Invalid collection action.');
 await sql`select id from shelf.profiles where id=${owner} for update`;
 const versions=await sql`select id,revision from shelf.layouts where owner_id=${owner} order by id for update`;
 if(body.versions.length!==versions.length||versions.some(v=>!body.versions.some(b=>b.id===v.id&&b.revision===v.revision)))throw new HttpError(409,'Your shelves changed elsewhere. Reload this page before editing.');
 if(body.action==='add'){
  if(!products.has(body.productId)||!['current','previous','wishlist'].includes(body.status))throw new HttpError(400,'Choose a piece and status.');
  const [count]=await sql`select count(*)::int as n from shelf.owned_items where owner_id=${owner}`;
  if(count.n>=3000)throw new HttpError(400,'Collection limit reached.');
  await sql`insert into shelf.owned_items(id,owner_id,product_id,status) values(${randomUUID()},${owner},${body.productId},${body.status})`;
 }else{
  if(!uuid.test(body.itemId))throw new HttpError(400,'Invalid piece.');
  const [item]=await sql`select id,status from shelf.owned_items where id=${body.itemId} and owner_id=${owner} for update`;
  if(!item)throw new HttpError(404,'Piece unavailable.');
  if(body.action==='place'){
   if(item.status!=='current')throw new HttpError(400,'Only current pieces can be placed on shelves.');
   const state=await readState(sql,owner);if(!state.layoutId)state.layoutId=randomUUID();
   if(!state.order.includes(body.itemId))state.order.push(body.itemId);
   const byId=new Map(state.items.map(i=>[i.id,products.get(i.productId)]));
   const rows=packShelves(state.order,byId,state.shelves.map(s=>s.settings.pieceIds||[]));
   while(state.shelves.length<rows.length)state.shelves.push({id:randomUUID(),settings:{finish:'ice',weather:'none',fixture:'spot',colour:'warm',brightness:70,speed:15}});
   await writeState(sql,owner,state,products,packShelves);
  }else if(body.action==='status'){
   if(!['current','previous','wishlist'].includes(body.status))throw new HttpError(400,'Invalid status.');
   await sql`update shelf.owned_items set status=${body.status} where id=${body.itemId} and owner_id=${owner}`;
   if(body.status!=='current')await sql`delete from shelf.placements where item_id=${body.itemId} and owner_id=${owner}`;
  }else{
   if(!uuid.test(body.layoutId)||(body.shelfId!==null&&!uuid.test(body.shelfId)))throw new HttpError(400,'Invalid shelf.');
   const removed=await sql`delete from shelf.placements where item_id=${body.itemId} and owner_id=${owner} and layout_id=${body.layoutId} and shelf_id is not distinct from ${body.shelfId}::uuid returning item_id`;
   await sql`insert into shelf.audit_events(actor_id,owner_id,action,changes) values(${owner},${owner},'placements.remove',${sql.json({itemId:body.itemId,layoutId:body.layoutId,shelfId:body.shelfId})})`;
   if(!removed.length)throw new HttpError(409,'This placement changed. Reload before editing.');
  }
  // Remove stale grouping hints only from rows where this copy is no longer placed.
  await sql`update shelf.shelves s set settings=jsonb_set(s.settings,'{pieceIds}',coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(s.settings->'pieceIds','[]'::jsonb)) v where v<>to_jsonb(${body.itemId}::text)),'[]'::jsonb)) where s.owner_id=${owner} and not exists(select 1 from shelf.placements x where x.item_id=${body.itemId} and x.shelf_id=s.id and x.owner_id=${owner})`;
 }
 if(!versions.length)await sql`insert into shelf.layouts(id,owner_id) values(${randomUUID()},${owner})`;
 await sql`update shelf.layouts set revision=revision+1 where owner_id=${owner}`;
 return readCollectionManager(sql,owner);
}
