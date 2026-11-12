// Shared platform semantics. Inventory and placements remain authoritative.
export const rockStyles=['moss','waterfall','ice','lava'];
export const rockSizes={small:1,medium:2,large:3};
export const rockForegrounds=['none','shrubs','stones','ice'];
export function resolveRocks(config,order){
 const available=new Set(order),used=new Set(),rocks=[];
 for(const r of config||[]){const pieceIds=r.pieceIds.filter(id=>available.has(id)&&!used.has(id)).slice(0,rockSizes[r.size]);pieceIds.forEach(id=>used.add(id));rocks.push({...r,pieceIds});}
 for(const id of order)if(!used.has(id)){let key=id,n=0;while(rocks.some(r=>r.id===key))key=id+'-'+(++n);rocks.push({id:key,style:'moss',size:'small',foreground:'none',pieceIds:[id]});}
 return rocks;
}
export function validateRocks(config,order){
 if(!Array.isArray(config)||config.length>3100)throw Error('Too many platforms.');
 const available=new Set(order),used=new Set(),ids=new Set();let empty=0;
 const result=config.map(r=>{
  if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,60}$/.test(r.id)||ids.has(r.id)||!rockStyles.includes(r.style)||!Object.hasOwn(rockSizes,r.size)||!rockForegrounds.includes(r.foreground)||!Array.isArray(r.pieceIds)||r.pieceIds.length>rockSizes[r.size])throw Error('Choose a valid rock style, size and foreground.');
  ids.add(r.id);if(!r.pieceIds.length)empty++;
  for(const id of r.pieceIds){if(!available.has(id)||used.has(id))throw Error('Each displayed copy can occupy only one rock.');used.add(id);}
  return {id:r.id,style:r.style,size:r.size,foreground:r.foreground,pieceIds:[...r.pieceIds]};
 });
 if(empty>100)throw Error('Keep no more than 100 empty platforms.');
 // Omitted pieces receive their own default platform; never silently remove a piece.
 return resolveRocks(result,order);
}
