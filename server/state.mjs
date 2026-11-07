import {HttpError} from './security.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=()=>{throw new HttpError(400,'Invalid collection data.');};
export function validateState(body,products){
 if(!body||!uuid.test(body.layoutId)||!Number.isSafeInteger(body.revision)||body.revision<0||!Array.isArray(body.items)||body.items.length>3000||!Array.isArray(body.shelves)||body.shelves.length>3000)fail();
 const ids=new Set(),shelfIds=new Set();
 const items=body.items.map(item=>{
  if(!item||!uuid.test(item.id)||ids.has(item.id)||!products.has(item.productId))fail();ids.add(item.id);
  return {id:item.id,productId:item.productId};
 });
 const shelves=body.shelves.map(shelf=>{
  if(!shelf||!uuid.test(shelf.id)||shelfIds.has(shelf.id))fail();shelfIds.add(shelf.id);
  const s=shelf.settings||{};
  if(!['none','rain','snow'].includes(s.weather)||!['none','spot','strip'].includes(s.fixture)||!['warm','cool','amber','blue','off','rainbow','custom'].includes(s.colour)||!Number.isFinite(s.brightness)||s.brightness<0||s.brightness>100||!Number.isFinite(s.speed)||s.speed<3||s.speed>60||typeof s.finish!=='string'||!products.finishes.has(s.finish))fail();
  const fog=s.fog===undefined?(['ice','snow'].includes(s.finish)?30:0):s.fog;
  if(!Number.isFinite(fog)||fog<0||fog>100)fail();
  const fogSpeed=s.fogSpeed===undefined?1:s.fogSpeed,fogColour=s.fogColour===undefined?'#edf7ff':s.fogColour,lightColour=s.lightColour===undefined?'#ffe5b3':s.lightColour;
  if(!Number.isFinite(fogSpeed)||fogSpeed<.25||fogSpeed>3||!/^#[0-9a-f]{6}$/i.test(fogColour)||!/^#[0-9a-f]{6}$/i.test(lightColour))fail();
  const pieceIds=s.pieceIds===undefined?[]:s.pieceIds;
  if(!Array.isArray(pieceIds)||pieceIds.length>3000||new Set(pieceIds).size!==pieceIds.length||pieceIds.some(id=>!ids.has(id)))fail();
  const background=s.background??null,bgX=s.bgX??50,bgY=s.bgY??50,bgDim=s.bgDim??25;
  if((background!==null&&!uuid.test(background))||[bgX,bgY,bgDim].some(v=>!Number.isFinite(v)||v<0||v>100))fail();
  return {id:shelf.id,settings:{background,bgX,bgY,bgDim,pieceIds,fogSpeed,fogColour,lightColour,fog,weather:s.weather,fixture:s.fixture,colour:s.colour,brightness:s.brightness,speed:s.speed,finish:s.finish}};
 });
 if(!Array.isArray(body.order)||body.order.length!==items.length||new Set(body.order).size!==items.length||body.order.some(id=>!ids.has(id)))fail();
 if(body.marketingPreference!==undefined&&body.marketingPreference!==null&&typeof body.marketingPreference!=='boolean')fail();
 return {layoutId:body.layoutId,revision:body.revision,items,shelves,order:body.order,marketingPreference:body.marketingPreference};
}
export async function readState(sql,owner){
 const [profile]=await sql`select display_name,marketing_preference from shelf.profiles where id=${owner}`;
 const [layout]=await sql`select id,revision from shelf.layouts where owner_id=${owner} and name='My shelves'`;
 if(!layout)return {profile,layoutId:null,revision:0,items:[],order:[],shelves:[]};
 const items=await sql`select id,product_id as "productId" from shelf.owned_items where owner_id=${owner}`;
 const placements=await sql`select item_id from shelf.placements where owner_id=${owner} and layout_id=${layout.id} order by position`;
 const shelves=await sql`select id,settings from shelf.shelves where owner_id=${owner} and layout_id=${layout.id} order by position`;
 return {profile,layoutId:layout.id,revision:layout.revision,items,order:placements.map(p=>p.item_id),shelves};
}
export async function writeState(sql,owner,state,products,packShelves){
 // Atomic optimistic concurrency: stale devices never silently overwrite another device.
 await sql`insert into shelf.layouts(id,owner_id) values(${state.layoutId},${owner}) on conflict do nothing`;
 const changed=await sql`update shelf.layouts set revision=revision+1 where id=${state.layoutId} and owner_id=${owner} and revision=${state.revision} returning revision`;
 if(!changed.length)throw new HttpError(409,'This collection changed on another device. Reload before saving.');
 await sql`delete from shelf.placements where layout_id=${state.layoutId} and owner_id=${owner}`;
 // Ownership checks also cover attempted reuse of another collector's IDs.
 const itemRows=await sql`insert into shelf.owned_items(id,owner_id,product_id)
 select x.id,${owner}::uuid,x.product_id from jsonb_to_recordset(${sql.json(state.items.map(i=>({id:i.id,product_id:i.productId})))}::jsonb) as x(id uuid,product_id text)
 on conflict(id) do update set product_id=excluded.product_id where shelf.owned_items.owner_id=${owner} returning id`;
 if(itemRows.length!==state.items.length)throw new HttpError(403,'Item is unavailable.');
 const retained=state.items.map(i=>i.id);
 if(retained.length)await sql`delete from shelf.owned_items where owner_id=${owner} and id not in ${sql(retained)}`;
 else await sql`delete from shelf.owned_items where owner_id=${owner}`;
 const shelfRows=await sql`insert into shelf.shelves(id,owner_id,layout_id,position,settings)
 select x.id,${owner}::uuid,${state.layoutId}::uuid,x.position,x.settings
 from jsonb_to_recordset(${sql.json(state.shelves.map((s,position)=>({id:s.id,position,settings:s.settings})))}::jsonb) as x(id uuid,position integer,settings jsonb)
 on conflict(id) do update set position=excluded.position,settings=excluded.settings where shelf.shelves.owner_id=${owner} and shelf.shelves.layout_id=${state.layoutId} returning id`;
 if(shelfRows.length!==state.shelves.length)throw new HttpError(403,'Shelf is unavailable.');
 const shelfIds=state.shelves.map(s=>s.id);
 if(shelfIds.length)await sql`delete from shelf.shelves where owner_id=${owner} and layout_id=${state.layoutId} and id not in ${sql(shelfIds)}`;
 else await sql`delete from shelf.shelves where owner_id=${owner} and layout_id=${state.layoutId}`;
 const itemCatalog=new Map(state.items.map(i=>[i.id,products.get(i.productId)]));
 const rows=packShelves(state.order,itemCatalog,state.shelves.map(s=>s.settings.pieceIds)),placement=new Map();
 if(rows.length>state.shelves.length)throw new HttpError(400,'Missing shelves.');
 rows.forEach((row,index)=>row.items.forEach(item=>placement.set(item.id,state.shelves[index].id)));
 await sql`insert into shelf.placements(owner_id,layout_id,item_id,shelf_id,position)
 select ${owner}::uuid,${state.layoutId}::uuid,x.item_id,x.shelf_id,x.position
 from jsonb_to_recordset(${sql.json(state.order.map((id,position)=>({item_id:id,shelf_id:placement.get(id)||null,position})))}::jsonb) as x(item_id uuid,shelf_id uuid,position integer)`;
 if(state.marketingPreference!==undefined)await sql`update shelf.profiles set marketing_preference=${state.marketingPreference},marketing_updated_at=now() where id=${owner} and marketing_preference is distinct from ${state.marketingPreference}`;
 return {revision:changed[0].revision};
}
