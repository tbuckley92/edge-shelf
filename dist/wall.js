const wall=document.querySelector('.wall'), dialog=document.querySelector('dialog');
// A shared centimetre scale keeps vertical sizing consistent with shelf width.
const sizeObserver = new ResizeObserver(entries => {
 const width = entries[0].contentRect.width;
 if (width > 0) wall.style.setProperty('--cm', (width / 100) + 'px');
});
sizeObserver.observe(wall);

function read(key,fallback){return fallback}
function save(){queueSave()}
let layouts=[], order=[], byId=new Map(), finishes={}, chosen=null;
let catalog=new Map(), assets={}, ownedItems=[], shelfIds=[], layoutId=null, revision=0, signedIn=false, frameStyle='classic',displayName='',defaultFinish='ice';
const defaultSettings={finish:'ice',weather:'none',fixture:'spot',colour:'warm',brightness:70,speed:15};
if(!finishes||typeof finishes!=='object')finishes={};

const lights={warm:'255,229,179',cool:'226,242,255',amber:'255,178,82',blue:'153,212,255',off:'255,255,255'};
let rowSettings=read('edge-row-settings',{});
if(!rowSettings||typeof rowSettings!=='object')rowSettings={};
const legacy={fixture:read('edge-wall-fixture','spot'),colour:read('edge-wall-led','warm'),brightness:read('edge-wall-brightness',70),speed:read('edge-wall-cycle-seconds',15)};
function settings(n){
 const value={...legacy,...rowSettings[shelfIds[n]]};
 return {background:value.background||null,bgX:value.bgX??50,bgY:value.bgY??50,bgDim:value.bgDim??25,pieceIds:(value.pieceIds||[]).filter(id=>byId.has(id)),fogSpeed:Number.isFinite(value.fogSpeed)?Math.max(.25,Math.min(3,value.fogSpeed)):1,
 fogColour:/^#[0-9a-f]{6}$/i.test(value.fogColour)?value.fogColour:'#edf7ff',
 lightColour:/^#[0-9a-f]{6}$/i.test(value.lightColour)?value.lightColour:'#ffe5b3',
 weather:['rain','snow'].includes(value.weather)?value.weather:'none',
 fixture:['none','spot','strip'].includes(value.fixture)?value.fixture:'spot',
 colour:[...Object.keys(lights),'rainbow','custom'].includes(value.colour)?value.colour:'warm',
 fog:Number.isFinite(value.fog)?Math.max(0,Math.min(100,value.fog)):(['ice','snow'].includes(value.finish||'ice')?30:0),
 brightness:Number.isFinite(+value.brightness)?Math.max(0,Math.min(100,+value.brightness)):70,
 speed:Number.isFinite(+value.speed)?Math.max(3,Math.min(60,+value.speed)):15};
}
wall.classList.add('cabinet');wall.style.setProperty('--backwall','linear-gradient(100deg,#222827,#39413e 50%,#252c29)');wall.style.setProperty('--caption','#eceee5');
function colourRGB(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16)).join(',')}
function rainbowRGB(hue){
 const sector=hue/60,x=1-Math.abs(sector%2-1);
 return [[1,x,0],[x,1,0],[0,1,x],[0,x,1],[x,0,1],[1,0,x]][Math.floor(sector)%6].map(v=>Math.round((.3+.7*v)*255)).join(',');
}
let rainbowFrame=0;
function animateRainbow(time){
 for(const row of wall.querySelectorAll('.row[data-mounted]')){
 if(!row.classList.contains('effects-visible'))continue;
 const s=settings(row.dataset.row);
 if(s.fixture!=='none'&&s.colour==='rainbow'&&s.brightness>0)row.style.setProperty('--light',rainbowRGB((time/1000*360/s.speed)%360));
 }
 if(!document.hidden)rainbowFrame=requestAnimationFrame(animateRainbow);
}
function syncRainbow(){cancelAnimationFrame(rainbowFrame);if(!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&[...wall.querySelectorAll('.row[data-mounted].effects-visible')].some(r=>settings(r.dataset.row).colour==='rainbow'))rainbowFrame=requestAnimationFrame(animateRainbow)}
document.addEventListener('visibilitychange',syncRainbow);
function applyLighting(row){
 const s=settings(row.dataset.row);row.style.setProperty('--row-photo',s.background?'url("/api/background?shelf='+shelfIds[Number(row.dataset.row)]+'&image='+s.background+'")':'none');row.style.setProperty('--bg-x',s.bgX+'%');row.style.setProperty('--bg-y',s.bgY+'%');row.style.setProperty('--bg-dim',s.bgDim/100);row.dataset.photo=s.background?'true':'false';row.dataset.fixture=s.fixture;applyWeather(row,s.weather);row.style.setProperty('--fog-strength',s.fog/100);
 row.style.setProperty('--fog-duration',(10/s.fogSpeed)+'s');row.style.setProperty('--fog-colour',colourRGB(s.fogColour));
 row.style.setProperty('--light',s.colour==='rainbow'?rainbowRGB(0):s.colour==='custom'?colourRGB(s.lightColour):lights[s.colour]);
 row.style.setProperty('--power',s.fixture==='none'||s.colour==='off'?0:s.brightness/100);
 row.style.setProperty('--rim',s.fixture==='none'||s.colour==='off'?0:s.brightness/300);
}
const shelfMenu=document.querySelector('#shelfMenu');
let originalPhoto=null;
let editingRow=null, originalSettings=null, originalFinish=null, savingShelf=false;
function openShelf(n){
 editingRow=n;originalSettings=rowSettings[shelfIds[n]]?{...rowSettings[shelfIds[n]]}:null;shelfMenu.querySelector('h2').textContent='Shelf '+(n+1);
 const row=wall.querySelector('[data-row="'+n+'"]'),s=settings(n);
 originalPhoto=s.background;originalFinish=row.dataset.finish;shelfMenu.querySelector('[name=finish]').value=originalFinish;
 document.querySelector('#saveStatus').textContent='';
 for(const key of ['fixture','colour','brightness','speed','weather','fog','fogSpeed','fogColour','lightColour','bgX','bgY','bgDim'])shelfMenu.querySelector('[name='+key+']').value=s[key];
 document.querySelector('#backgroundFile').value='';document.querySelector('#backgroundStatus').textContent='JPG, PNG or WebP · up to 20 MB';
 menuLabels();shelfMenu.classList.remove('closing');shelfMenu.showModal();
 requestAnimationFrame(()=>{
  const room=window.innerHeight-shelfMenu.getBoundingClientRect().height-76;
  const bounds=row.getBoundingClientRect();
  const desired=76+Math.max(0,(room-bounds.height)/2);
  window.scrollBy({top:bounds.top-desired,behavior:'smooth'});
 });
}
function menuLabels(){
 document.querySelector('#removeBackground').disabled=!rowSettings[shelfIds[editingRow]]?.background;
 const colour=shelfMenu.querySelector('[name=colour]').value;
 const noLights=shelfMenu.querySelector('[name=fixture]').value==='none';
 for(const key of ['colour','brightness','lightColour'])shelfMenu.querySelector('[name='+key+']').closest('label').hidden=noLights;
 shelfMenu.querySelector('.speed-setting').hidden=noLights||colour!=='rainbow';
 for(const key of ['brightness','speed','fog','fogSpeed'])shelfMenu.querySelector('[data-output='+key+']').textContent=shelfMenu.querySelector('[name='+key+']').value+(key==='speed'?'s':key==='fogSpeed'?'×':'%');
}
shelfMenu.addEventListener('input',event=>{
 if(event.target.type==='file')return;
 if(event.target.name==='lightColour')shelfMenu.querySelector('[name=colour]').value='custom';
 if(editingRow===null)return;const n=editingRow,row=wall.querySelector('[data-row="'+n+'"]');
 const finish=shelfMenu.querySelector('[name=finish]').value;paint(row,finish);row.dataset.finish=finish;
 rowSettings[shelfIds[n]]={background:settings(n).background,bgX:+shelfMenu.querySelector('[name=bgX]').value,bgY:+shelfMenu.querySelector('[name=bgY]').value,bgDim:+shelfMenu.querySelector('[name=bgDim]').value,pieceIds:settings(n).pieceIds,finish,fogSpeed:+shelfMenu.querySelector('[name=fogSpeed]').value,fogColour:shelfMenu.querySelector('[name=fogColour]').value,lightColour:shelfMenu.querySelector('[name=lightColour]').value,fog:+shelfMenu.querySelector('[name=fog]').value,weather:shelfMenu.querySelector('[name=weather]').value,fixture:shelfMenu.querySelector('[name=fixture]').value,colour:shelfMenu.querySelector('[name=colour]').value,brightness:+shelfMenu.querySelector('[name=brightness]').value,speed:+shelfMenu.querySelector('[name=speed]').value};
 applyLighting(row);menuLabels();syncRainbow();document.querySelector('#saveStatus').textContent='Unsaved changes';
});
document.querySelector('#saveShelf').onclick=()=>{
 if(editingRow===null||savingShelf)return;
 const n=editingRow,row=wall.querySelector('[data-row="'+n+'"]');
 rowSettings[shelfIds[n]]={...settings(n),finish:row.dataset.finish};
 // Commit the preview locally before closing; the queued snapshot retains it.
 originalSettings={...rowSettings[shelfIds[n]]};originalFinish=row.dataset.finish;
 const photoShelf=shelfIds[n],obsolete=originalPhoto,retainedPhoto=rowSettings[photoShelf].background;originalPhoto=retainedPhoto;
 persist(true).then(()=>{if(obsolete&&obsolete!==retainedPhoto)discardPhoto(photoShelf,obsolete)}).catch(()=>{});closeTray();
};
let closingTimer=null;
function closeTray(){
 if(savingShelf||!shelfMenu.open||closingTimer)return;
 shelfMenu.classList.add('closing');
 closingTimer=setTimeout(()=>{shelfMenu.close();shelfMenu.classList.remove('closing');closingTimer=null},matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
}
shelfMenu.querySelector('.close-menu').onclick=e=>{e.preventDefault();closeTray()};
shelfMenu.addEventListener('cancel',e=>{e.preventDefault();closeTray()});
shelfMenu.addEventListener('close',()=>{
 if(editingRow===null)return;
 const n=editingRow,row=wall.querySelector('[data-row="'+n+'"]');
 const pendingPhoto=rowSettings[shelfIds[n]]?.background;if(pendingPhoto&&pendingPhoto!==originalPhoto)discardPhoto(shelfIds[n],pendingPhoto);
 if(originalSettings)rowSettings[shelfIds[n]]=originalSettings;else delete rowSettings[shelfIds[n]];
 if(row){row.dataset.finish=originalFinish;paint(row,originalFinish);applyLighting(row)}
 editingRow=null;pruneShelves();syncRainbow();
});
const weatherObserver=new IntersectionObserver(entries=>{
 for(const entry of entries)entry.target.classList.toggle('weather-visible',entry.isIntersecting);
},{rootMargin:'100px'});
function applyWeather(row,type){
 let layer=row.querySelector('.weather');
 if(layer?.dataset.type===type)return;
 if(layer){weatherObserver.unobserve(layer);layer.remove()}
 if(type==='none')return;
 layer=document.createElement('div');layer.className='weather';layer.dataset.type=type;layer.setAttribute('aria-hidden','true');
 for(let i=0;i<(type==='rain'?42:32);i++){
 const particle=document.createElement('i');
 particle.style.left=((i*37+11)%100)+'%';
 particle.style.setProperty('--delay',(-i*.53)+'s');
 particle.style.setProperty('--duration',(type==='rain'?.65+(i%5)*.13:3.5+(i%7)*.4)+'s');
 particle.style.setProperty('--size',(1.3+(i%5)*.65)+'px');
 particle.style.setProperty('--depth',(.25+(i%5)*.14));
 particle.style.setProperty('--drift',((i%2?-1:1)*(7+i%11))+'px');
 particle.style.setProperty('--blur',(i%6===0?1.1:0)+'px');
 layer.append(particle);
 if(type==='rain'&&i%3===0){
  const splash=document.createElement('b');splash.style.left=particle.style.left;
  splash.style.setProperty('--delay',(-i*.53+.4)+'s');
  splash.style.setProperty('--duration',(.65+(i%5)*.13)+'s');layer.append(splash);
 }
 }
 row.querySelector('.display').append(layer);weatherObserver.observe(layer);
}
for(const [key,m] of Object.entries(materials))shelfMenu.querySelector('[name=finish]').add(new Option(m.label,key));
// Preserve the viewport, including while replacing a focused piece button.
function renderInPlace(focusId=null){
 const x=window.scrollX,y=window.scrollY;
 wall.style.minHeight=wall.offsetHeight+'px';
 render();
 if(focusId){const button=wall.querySelector('[data-id="'+focusId+'"]');button?.focus({preventScroll:true})}
 window.scrollTo({left:x,top:y,behavior:'instant'});
 // A shorter packing must not clamp the current viewport at the document end.
 const wallTop=wall.getBoundingClientRect().top+window.scrollY;
 wall.style.minHeight=Math.max(0,y+window.innerHeight-wallTop)+'px';
 requestAnimationFrame(()=>window.scrollTo({left:x,top:y,behavior:'instant'}));
}
function reorder(from,to){
 if(from<0||to<0||from>=order.length||to>=order.length||from===to)return;
 const moved=order[from],other=order[to];
 for(const s of Object.values(rowSettings))if(s.pieceIds)s.pieceIds=s.pieceIds.map(id=>id===moved?other:id===other?moved:id);
 [order[from],order[to]]=[order[to],order[from]];
 renderInPlace(moved);queueSave();
}
function openDetails(index){
 const p=byId.get(order[index]);if(!p)return;chosen=p.id;

 dialog.querySelector('h2').textContent=p.name;
 dialog.querySelector('.dimensions').textContent=[p.h>0?'Height '+p.h+' cm':null,p.w>0?'Width '+p.w+' cm':null,p.d>0?'Depth '+p.d+' cm':null].filter(Boolean).join(' · ');
 dialog.querySelector('.product-link').href='https://edgesculpture.es/products/'+encodeURIComponent(p.productId);
 const preview=dialog.querySelector('.product-image'),source=wall.querySelector('[data-id="'+p.id+'"] img');
 preview.hidden=!source;preview.alt=p.name;if(source)preview.src=source.src;
 dialog.classList.remove('closing');dialog.showModal();
}
let detailCloseTimer=null;
function closeDetails(){
 if(!dialog.open||detailCloseTimer)return;
 dialog.classList.add('closing');
 detailCloseTimer=setTimeout(()=>{dialog.close();dialog.classList.remove('closing');detailCloseTimer=null},matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
}
dialog.querySelector('.close-details').onclick=closeDetails;
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDetails()});
function fallback(btn){const mark=document.createElement('span');mark.className='missing';mark.textContent='Image unavailable';btn.replaceChildren(mark)}
function showArt(btn){
 const p=byId.get(btn.dataset.id),asset=assets[p.productId];if(!asset){fallback(btn);return}
 const image=new Image();image.alt=p.name;image.draggable=false;image.decoding='async';image.src=asset.src;
 image.onerror=()=>{if(btn.isConnected)fallback(btn)};
 const light=document.createElement('span');light.className='surface-light';light.setAttribute('aria-hidden','true');
 light.style.setProperty('--silhouette','url("'+asset.src+'")');const marker=document.createElement('span');marker.className='piece-status '+p.status;marker.textContent={current:'✓',previous:'↶',wishlist:'♡'}[p.status];marker.title={current:'Currently owned',previous:'Previously owned',wishlist:'Wishlist'}[p.status];marker.setAttribute('aria-label',marker.title);btn.replaceChildren(image,light,marker);
}
const observer={disconnect(){},observe:showArt};
const effectObserver=new IntersectionObserver(entries=>{
 for(const entry of entries)entry.target.classList.toggle('effects-visible',entry.isIntersecting);syncRainbow();
},{rootMargin:'50px'});
const shelfObserver=new IntersectionObserver(entries=>{
 for(const entry of entries){const row=entry.target,n=Number(row.dataset.row);
  if(entry.isIntersecting)mountShelf(row,n);
  else if(!row.classList.contains('shelf-selected')&&editingRow!==n&&(!drag||!row.contains(drag.btn))){
   row.querySelectorAll('.weather').forEach(layer=>weatherObserver.unobserve(layer));
   row.replaceChildren();delete row.dataset.mounted;
  }
 }
 syncRainbow();
},{rootMargin:'650px'});
function pruneShelves(){
 for(const row of wall.querySelectorAll('.row[data-mounted]')){const r=row.getBoundingClientRect();if((r.bottom < -650 || r.top > innerHeight+650)&&Number(row.dataset.row)!==editingRow){row.querySelectorAll('.weather').forEach(layer=>weatherObserver.unobserve(layer));row.replaceChildren();delete row.dataset.mounted}}
}
function ensureShelves(count){while(shelfIds.length<count){const id=crypto.randomUUID();shelfIds.push(id);rowSettings[id]={...defaultSettings,finish:defaultFinish}}}
function paint(row,key){const m=materials[key];row.style.setProperty('--texture',m.texture);row.style.setProperty('--tone',m.tone);row.style.setProperty('--top',m.top);
 row.dataset.fantasy=m.body?'true':'false';row.dataset.foreground=m.foreground?'true':'false';
 row.style.setProperty('--shelf-foreground',m.foreground||'none');row.style.setProperty('--foreground-rise',m.foregroundRise||4);
 row.style.setProperty('--fantasy-body',m.body||'none');row.style.setProperty('--fantasy-fringe',m.fringe||'none');row.style.setProperty('--fringe-ratio',m.fringeRatio||6);
}
function mountShelf(row,n){
 if(row.dataset.mounted)return;row.dataset.mounted='true';const layout=layouts[n];
 row.innerHTML='<div class="display"><span class="row-background" aria-hidden="true"></span><button type="button" class="shelf-move" aria-label="Move shelf '+(n+1)+'" title="Drag shelf; use arrow keys to move">⠿ Move shelf</button><div class="lighting" aria-hidden="true"><i class="strip"></i></div><div class="ledge"><span class="top"></span><span class="front"></span><span class="fantasy-body" aria-hidden="true"></span><span class="fantasy-fringe" aria-hidden="true"></span></div><div class="slots"></div><span class="shelf-foreground" aria-hidden="true"></span><span class="shelf-mist mist-back" aria-hidden="true"></span><span class="shelf-mist mist-front" aria-hidden="true"></span><button type="button" class="shelf-gear" aria-label="Settings for shelf '+(n+1)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.2-.6-2 3.4 1.7 1.7v2.5L2.2 15l2 3.4 2.2-.6 2 .9L9 21h4l.6-2.3 2-.9 2.2.6 2-3.4-1.7-1.8v-2.5L19.8 9l-2-3.4-2.2.6-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg></button></div>';
 row.dataset.finish=Object.hasOwn(materials,rowSettings[shelfIds[n]]?.finish)?rowSettings[shelfIds[n]].finish:Object.hasOwn(materials,finishes[n])?finishes[n]:defaultFinish;
 paint(row,row.dataset.finish);applyLighting(row);
 row.querySelector('.shelf-gear').onclick=()=>openShelf(n);
 for(const item of layout.items){
 const p=byId.get(item.id),btn=document.createElement('button');btn.className='piece';btn.dataset.id=p.id;btn.dataset.index=order.indexOf(p.id);
 btn.title=p.name+' · '+p.w+' × '+p.h+' cm';btn.setAttribute('aria-label','Details for '+btn.title+' · '+({current:'Currently owned',previous:'Previously owned',wishlist:'Wishlist'}[p.status]));
 btn.style.setProperty('--x',item.x);btn.style.setProperty('--w',p.w);btn.style.setProperty('--h',p.h);btn.style.setProperty('--piece-depth',p.d||30);
 const lamp=document.createElement('i');lamp.className='lamp';lamp.style.setProperty('--x',item.x);lamp.style.setProperty('--w',p.w);row.querySelector('.lighting').append(lamp);
 row.querySelector('.slots').append(btn);observer.observe(btn);
 }
}
function render(){
 const started=performance.now();shelfObserver.disconnect();effectObserver.disconnect();weatherObserver.disconnect();
 wall.replaceChildren();layouts=packShelves(order,byId,shelfIds.map(id=>rowSettings[id]?.pieceIds));ensureShelves(layouts.length);
 const fragment=document.createDocumentFragment();
 layouts.forEach((layout,n)=>{
  const row=document.createElement('section');row.className='row';row.dataset.row=n;row.dataset.shelfId=shelfIds[n];row.style.zIndex=layouts.length-n;
  row.style.setProperty('--clearance',layout.clearance);
  row.style.setProperty('--shelf-depth',Math.max(6,...layout.items.map(item=>(byId.get(item.id).d||30)*.16)));
  fragment.append(row);
 });wall.append(fragment);
 for(const row of wall.children){shelfObserver.observe(row);effectObserver.observe(row);const r=row.getBoundingClientRect();if(r.bottom>-650&&r.top<innerHeight+650)mountShelf(row,Number(row.dataset.row))}
 syncRainbow();
 const missing=order.map(id=>byId.get(id)).filter(p=>!(p.w>0&&p.h>0)||p.w>100),pending=document.querySelector('#pending');
 pending.hidden=!missing.length;pending.replaceChildren();
 if(missing.length){const heading=document.createElement('strong');heading.textContent='Awaiting dimensions or a wider shelf';pending.append(heading);for(const p of missing){const line=document.createElement('button');line.dataset.id=p.id;line.textContent=p.name;line.onclick=()=>openDetails(order.indexOf(p.id));pending.append(line)}}
 document.querySelector('#emptyCollection').hidden=ownedItems.length>0||!signedIn;
 performance.clearMeasures('edge-render');performance.measure('edge-render',{start:started,end:performance.now()});
}
let drag=null,ignoreUntil=0;
function hit(x,y){
 const row=document.elementFromPoint(x,y)?.closest('.row');if(!row)return null;
 const pieces=[...row.querySelectorAll('.piece')];if(!pieces.length)return null;
 return pieces.reduce((best,p)=>{const r=p.getBoundingClientRect(),b=best.getBoundingClientRect();return Math.abs(x-r.left-r.width/2)<Math.abs(x-b.left-b.width/2)?p:best});
}
function clearInsertPreview(){
 if(!drag?.insertion)return;
 const row=drag.insertion.row,n=Number(row.dataset.row);
 for(const item of layouts[n].items)row.querySelector('[data-id="'+item.id+'"]')?.style.setProperty('--x',item.x);
 row.classList.remove('insert-preview');drag.insertion=null;
}
function insertionAt(x,y){
 const row=document.elementFromPoint(x,y)?.closest('.row');if(!row)return null;
 const n=Number(row.dataset.row),bounds=row.getBoundingClientRect(),position=(x-bounds.left)/bounds.width*100,id=drag.btn.dataset.id;
 const members=layouts[n].items.filter(item=>item.id!==id);
 const index=members.filter(item=>position>item.x+byId.get(item.id).w/2).length;
 const groups=insertOnShelf(layouts.map(r=>r.items.map(i=>i.id)),id,n,index,byId);
 return groups?{row,n,groups}:null;
}
function commitInsertion(groups,id){
 const entries=groups.map((pieces,n)=>({pieces,id:shelfIds[n]})),occupied=entries.filter(e=>e.pieces.length),empty=entries.filter(e=>!e.pieces.length);
 const placed=new Set(groups.flat());order=[...occupied.flatMap(e=>e.pieces),...order.filter(id=>!placed.has(id))];
 shelfIds=[...occupied.map(e=>e.id),...empty.map(e=>e.id),...shelfIds.slice(groups.length)];
 for(const e of entries)rowSettings[e.id]={...rowSettings[e.id],pieceIds:e.pieces};
 renderInPlace(id);queueSave();
}
function clearSwapPreview(){
 if(!drag)return;drag.target?.classList.remove('swap-displaced');drag.preview?.remove();drag.preview=null;
}
function moveGhost(){
 if(!drag?.ghost)return;
 drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';
 const insertion=insertionAt(drag.x,drag.y);clearInsertPreview();
 if(insertion){
  clearSwapPreview();drag.target=null;drag.insertion=insertion;insertion.row.classList.add('insert-preview');
  const preview=packShelves(insertion.groups[insertion.n],byId)[0];
  for(const item of preview.items)if(item.id!==drag.btn.dataset.id)insertion.row.querySelector('[data-id="'+item.id+'"]')?.style.setProperty('--x',item.x);
  return;
 }
 const candidate=hit(drag.x,drag.y),target=candidate===drag.btn?null:candidate;
 if(target!==drag.target){
  clearSwapPreview();drag.target=target;
  const image=target?.querySelector('img');
  if(image){drag.preview=image.cloneNode();drag.preview.className='swap-preview';drag.preview.setAttribute('aria-hidden','true');document.body.append(drag.preview);target.classList.add('swap-displaced')}
 }
 if(drag.preview){
  const origin=drag.btn.getBoundingClientRect(),destination=drag.target.getBoundingClientRect();
  Object.assign(drag.preview.style,{left:(origin.left+origin.width/2)+'px',top:origin.bottom+'px',width:destination.width+'px',height:destination.height+'px'});
 }
}
function autoscroll(){if(!drag?.ghost)return;const zone=65,y=drag.y;const speed=y<zone?-Math.ceil((zone-y)/5):y>innerHeight-zone?Math.ceil((y-innerHeight+zone)/5):0;if(speed)window.scrollBy(0,speed);moveGhost();drag.frame=requestAnimationFrame(autoscroll)}
function begin(){
 if(!drag||drag.ghost)return;
 const img=drag.btn.querySelector('img');const ghost=img?img.cloneNode():document.createElement('div');
 if(!img)ghost.textContent=drag.btn.title;
 ghost.className='ghost';const bounds=drag.btn.getBoundingClientRect();ghost.style.width=bounds.width+'px';ghost.style.height=bounds.height+'px';document.body.append(ghost);drag.ghost=ghost;
 drag.btn.classList.add('dragging');drag.btn.setAttribute('aria-pressed','true');
 if(drag.pointer!==undefined)drag.btn.setPointerCapture(drag.pointer);
 autoscroll();
}
function end(drop){
 if(!drag)return;const d=drag,insertion=d.insertion;clearInsertPreview();clearSwapPreview();drag=null;clearTimeout(d.timer);cancelAnimationFrame(d.frame);
 d.btn.classList.remove('dragging');d.btn.removeAttribute('aria-pressed');d.target?.classList.remove('target');d.ghost?.remove();
 pruneShelves();
 if(d.ghost){ignoreUntil=Date.now()+600;if(drop&&insertion)commitInsertion(insertion.groups,d.btn.dataset.id);else if(drop&&d.target)reorder(Number(d.btn.dataset.index),Number(d.target.dataset.index))}
}
function press(btn,x,y,extra={}){
 drag={btn,x,y,startX:x,startY:y,...extra};
 if(extra.pointer===undefined)drag.timer=setTimeout(begin,450);
}
function track(x,y){
 if(!drag)return;drag.x=x;drag.y=y;
 // Movement before the hold completes belongs to scrolling, never to reordering.
 if(!drag.ghost&&drag.pointer!==undefined&&Math.hypot(x-drag.startX,y-drag.startY)>3)begin();
 if(!drag.ghost&&drag.touch!==undefined&&Math.hypot(x-drag.startX,y-drag.startY)>8){ignoreUntil=Date.now()+600;end(false);return}
 moveGhost();
}
wall.onpointerdown=e=>{
 if(e.pointerType==='touch')return;
 const btn=e.target.closest('.piece');if(!btn||e.button!==0||drag)return;
 e.preventDefault();btn.focus({preventScroll:true});press(btn,e.clientX,e.clientY,{pointer:e.pointerId});
};
window.addEventListener('pointermove',e=>{if(drag?.pointer===e.pointerId)track(e.clientX,e.clientY)});
window.addEventListener('pointerup',e=>{if(drag?.pointer===e.pointerId)end(true)});
window.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)end(false)});
wall.addEventListener('touchstart',e=>{
 if(e.touches.length!==1){end(false);return}
 const btn=e.target.closest('.piece');if(!btn||drag)return;
 const t=e.touches[0];press(btn,t.clientX,t.clientY,{touch:t.identifier});
},{passive:true});
window.addEventListener('touchmove',e=>{
 if(drag?.touch===undefined)return;
 const t=[...e.touches].find(t=>t.identifier===drag.touch);if(!t)return;
 if(drag.ghost)e.preventDefault();
 track(t.clientX,t.clientY);
},{passive:false});
window.addEventListener('touchend',e=>{if(drag?.touch!==undefined&&[...e.changedTouches].some(t=>t.identifier===drag.touch))end(true)});
window.addEventListener('touchcancel',()=>end(false));
window.addEventListener('blur',()=>end(false));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();end(false)}});
window.addEventListener('scroll',()=>{if(drag?.touch!==undefined&&!drag.ghost){ignoreUntil=Date.now()+600;end(false)}},{passive:true});
wall.addEventListener('contextmenu',e=>{if(e.target.closest('.piece,.shelf-move'))e.preventDefault()});

wall.onclick=e=>{const btn=e.target.closest('.piece');if(btn&&Date.now()>ignoreUntil)openDetails(Number(btn.dataset.index))};
const status=document.querySelector('#loadStatus');
function report(message){status.hidden=!message;status.textContent=message}
async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
 if(response.status===204)return null;
 let data;try{data=await response.json()}catch{throw new Error('The collection service is unavailable.')}
 if(!response.ok){const error=new Error(data.error||'Could not save.');error.status=response.status;throw error}return data;
}
function snapshot(includePreview=false){for(const s of Object.values(rowSettings))if(s.pieceIds)s.pieceIds=s.pieceIds.filter(id=>byId.has(id));return {version:2,layoutId,revision,items:ownedItems,order:[...order],shelves:shelfIds.map(id=>({id,settings:{...defaultSettings,...(!includePreview&&editingRow!==null&&id===shelfIds[editingRow]?originalSettings:rowSettings[id])}})),frame:frameStyle}}
let saveChain=Promise.resolve(),saveTimer=null,conflict=false,pendingSaves=0;
function persist(includePreview=false){
 clearTimeout(saveTimer);saveTimer=null;const data=snapshot(includePreview);
 pendingSaves++;const work=saveChain.catch(()=>{}).then(async()=>{
  if(conflict)throw new Error('Collection changed elsewhere. Reload before saving.');
  data.revision=revision;report('Saving…');
  try{const result=await api('collection',{method:'PUT',body:JSON.stringify(data)});revision=result.revision;document.querySelector('#collectorLevel').textContent='Level '+data.items.filter(i=>(i.status||'current')==='current').length;window.dispatchEvent(new CustomEvent('edge:level',{detail:data.items.filter(i=>(i.status||'current')==='current').length}));report(pendingSaves>1?'Saving…':'Saved');document.querySelector('#retrySave').hidden=true;}
  catch(error){if(error.status===409)conflict=true;report(error.message);document.querySelector('#retrySave').hidden=false;throw error}
 }).finally(()=>pendingSaves--);saveChain=work;return work;
}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist().catch(()=>{}),200)}
document.querySelector('#retrySave').onclick=()=>persist().then(()=>document.querySelector('#retrySave').hidden=true).catch(()=>{});
function rebuildItems(){byId=new Map(ownedItems.filter(i=>catalog.has(i.productId)).map(i=>[i.id,{...catalog.get(i.productId),id:i.id,productId:i.productId,status:i.status||'current'}]));order=order.filter(id=>byId.has(id))}
 document.querySelector('#storePiece').onclick=async()=>{order=order.filter(id=>id!==chosen);for(const s of Object.values(rowSettings))if(s.pieceIds)s.pieceIds=s.pieceIds.filter(id=>id!==chosen);dialog.close();rebuildItems();renderInPlace();try{await persist()}catch(e){report(e.message)}};
document.querySelector('#frameStyle').onchange=e=>{frameStyle=e.target.value;wall.dataset.frame=frameStyle;queueSave()};
document.querySelector('#signOut').onclick=async()=>{try{await saveChain.catch(()=>{});await api('auth/logout',{method:'POST'});location.reload()}catch(error){report(error.message)}};
window.addEventListener('beforeunload',event=>{if(saveTimer||pendingSaves){event.preventDefault();event.returnValue=''}});
async function start(){
 const displayId=new URLSearchParams(location.search).get('id');if(!displayId){location.replace('/');return}
 const accountRequest=api('bootstrap?display='+encodeURIComponent(displayId)).then(data=>({data})).catch(error=>({error}));
 const [pieces,prepared]=await Promise.all([fetch('catalog.json').then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('assets.json').then(r=>{if(!r.ok)throw Error();return r.json()})]);
 catalog=new Map(pieces.map(p=>[p.id,p]));assets=prepared;
 try{
  const account=await accountRequest;if(account.error)throw account.error;const state=account.data.state;window.edgeProfile=account.data.profile;window.dispatchEvent(new CustomEvent('edge:profile',{detail:account.data.profile}));if(state.type==='rocks'||state.type==='pillars'){location.replace((state.type==='pillars'?'/pillars.html?id=':'/rocks.html?id=')+state.layoutId);return}signedIn=true;layoutId=state.layoutId;revision=state.revision;displayName=state.name;defaultFinish=state.defaultFinish;document.querySelector('#displayTitle').textContent=displayName;document.title=displayName+' · Edge Shelf';ownedItems=state.items;order=state.order;
  shelfIds=state.shelves.map(s=>s.id);rowSettings=Object.fromEntries(state.shelves.map(s=>[s.id,s.settings]));frameStyle=state.frame||'classic';wall.dataset.frame=frameStyle;document.querySelector('#frameStyle').value=frameStyle;
  document.querySelector('#collectorLevel').textContent='Level '+ownedItems.filter(i=>(i.status||'current')==='current').length;
  document.querySelector('#loginPanel').hidden=true;document.querySelector('#collectionTools').hidden=false;document.querySelector('#addPieceTools').hidden=false;document.querySelector('#signOut').hidden=false;rebuildItems();render();window.dispatchEvent(new CustomEvent('edge:display-ready'));
 }catch(error){if(error.status!==401)report(error.message)}
}
start().catch(()=>report('Could not load the catalogue. Reload to try again.'));

let shelfDrag=null;
function moveShelf(from,to){
 if(from===to||to<0||to>=layouts.length)return;
 const groups=layouts.map((layout,n)=>({id:shelfIds[n],pieces:layout.items.map(p=>p.id)}));
 const [moved]=groups.splice(from,1);groups.splice(to,0,moved);
 const placed=new Set(groups.flatMap(g=>g.pieces));
 order=[...groups.flatMap(g=>g.pieces),...order.filter(id=>!placed.has(id))];
 const spare=shelfIds.slice(layouts.length);shelfIds=[...groups.map(g=>g.id),...spare];
 for(const g of groups)rowSettings[g.id]={...rowSettings[g.id],pieceIds:g.pieces};
 renderInPlace();wall.querySelector('[data-shelf-id="'+moved.id+'"] .shelf-move')?.focus({preventScroll:true});queueSave();
}
function shelfDragFrame(){
 if(!shelfDrag)return;const d=shelfDrag;
 const speed=d.y<100?-Math.ceil((100-d.y)/5):d.y>innerHeight-80?Math.ceil((d.y-innerHeight+80)/5):0;
 if(speed)window.scrollBy(0,speed);
 const rows=[...wall.children];let insertion=rows.filter(r=>Number(r.dataset.row)!==d.from&&d.y>r.getBoundingClientRect().top+r.getBoundingClientRect().height/2).length;
 d.to=insertion;rows.forEach(r=>r.classList.remove('shelf-drop-before','shelf-drop-after'));
 const others=rows.filter(r=>Number(r.dataset.row)!==d.from);
 if(others[insertion])others[insertion].classList.add('shelf-drop-before');else others.at(-1)?.classList.add('shelf-drop-after');
 d.frame=requestAnimationFrame(shelfDragFrame);
}
function endShelfDrag(commit){
 if(!shelfDrag)return;const d=shelfDrag;shelfDrag=null;cancelAnimationFrame(d.frame);
 wall.querySelectorAll('.shelf-selected,.shelf-drop-before,.shelf-drop-after').forEach(r=>r.classList.remove('shelf-selected','shelf-drop-before','shelf-drop-after'));
 document.body.classList.remove('shelf-reordering');if(commit)moveShelf(d.from,d.to);
}
wall.addEventListener('pointerdown',e=>{
 if(e.pointerType==='touch')return;
 const handle=e.target.closest('.shelf-move');if(!handle||e.button!==0||drag||shelfDrag)return;
 e.preventDefault();const row=handle.closest('.row');handle.setPointerCapture(e.pointerId);
 shelfDrag={from:Number(row.dataset.row),to:Number(row.dataset.row),pointer:e.pointerId,y:e.clientY};row.classList.add('shelf-selected');document.body.classList.add('shelf-reordering');shelfDragFrame();
});
window.addEventListener('pointermove',e=>{if(shelfDrag?.pointer===e.pointerId){e.preventDefault();shelfDrag.y=e.clientY}});
window.addEventListener('pointerup',e=>{if(shelfDrag?.pointer===e.pointerId)endShelfDrag(true)});
window.addEventListener('pointercancel',()=>endShelfDrag(false));window.addEventListener('blur',()=>endShelfDrag(false));
window.addEventListener('keydown',e=>{if(e.key==='Escape')endShelfDrag(false)});
wall.addEventListener('keydown',e=>{const handle=e.target.closest('.shelf-move');if(!handle||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const from=Number(handle.closest('.row').dataset.row);moveShelf(from,from+(e.key==='ArrowUp'?-1:1))});

// Own the handle's touch gesture from touchstart, before Safari starts selection.
wall.addEventListener('touchstart',e=>{
 const handle=e.target.closest('.shelf-move');if(!handle)return;
 if(e.touches.length!==1){endShelfDrag(false);return}
 e.preventDefault();if(drag||shelfDrag)return;
 const t=e.touches[0],row=handle.closest('.row');
 window.getSelection()?.removeAllRanges();
 shelfDrag={from:Number(row.dataset.row),to:Number(row.dataset.row),touch:t.identifier,y:t.clientY};
 row.classList.add('shelf-selected');document.body.classList.add('shelf-reordering');shelfDragFrame();
},{passive:false});
window.addEventListener('touchmove',e=>{
 if(shelfDrag?.touch===undefined)return;
 const t=[...e.touches].find(t=>t.identifier===shelfDrag.touch);if(!t)return;
 e.preventDefault();shelfDrag.y=t.clientY;
},{passive:false});
window.addEventListener('touchend',e=>{if(shelfDrag?.touch!==undefined&&[...e.changedTouches].some(t=>t.identifier===shelfDrag.touch)){e.preventDefault();endShelfDrag(true)}},{passive:false});
window.addEventListener('touchcancel',()=>endShelfDrag(false));
wall.addEventListener('selectstart',e=>{if(e.target.closest('.row'))e.preventDefault()});
wall.addEventListener('dragstart',e=>{if(e.target.closest('.row'))e.preventDefault()});

async function discardPhoto(shelf,image){try{await api('background?shelf='+shelf+'&image='+image,{method:'DELETE'})}catch{}}
async function compressBackground(file){
 if(file.size>20000000)throw Error('Choose a photo smaller than 20 MB.');
 const url=URL.createObjectURL(file),image=new Image();
 try{image.src=url;await image.decode();const scale=Math.min(1,1600/image.naturalWidth,1200/image.naturalHeight);const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(!blob||blob.size>1000000)throw Error('Please choose a smaller photo.');return blob;}finally{URL.revokeObjectURL(url)}
}
document.querySelector('#backgroundFile').onchange=async e=>{
 const file=e.target.files[0];if(!file||editingRow===null)return;
 const n=editingRow,id=shelfIds[n],row=wall.querySelector('[data-row="'+n+'"]'),message=document.querySelector('#backgroundStatus');savingShelf=true;document.querySelector('#saveShelf').disabled=true;e.target.disabled=true;
 try{
  message.textContent='Preparing photo…';const blob=await compressBackground(file);
  // Ensure a newly created shelf exists before attaching a private upload.
  await persist();message.textContent='Uploading photo…';
  const response=await fetch('/api/background?shelf='+id,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'image/jpeg'},body:blob});const result=await response.json();if(!response.ok)throw Error(result.error||'Upload failed.');
  const previous=settings(n).background;rowSettings[id]={...rowSettings[id],background:result.image};
  if(previous&&previous!==originalPhoto)discardPhoto(id,previous);
  applyLighting(row);menuLabels();message.textContent='Photo ready. Adjust its position, then Save.';
 }catch(error){message.textContent=error.message}finally{savingShelf=false;document.querySelector('#saveShelf').disabled=false;e.target.disabled=false;e.target.value=''}
};
document.querySelector('#removeBackground').onclick=()=>{if(editingRow===null||savingShelf)return;const id=shelfIds[editingRow],previous=settings(editingRow).background;if(previous&&previous!==originalPhoto)discardPhoto(id,previous);rowSettings[id]={...rowSettings[id],background:null};applyLighting(wall.querySelector('[data-row="'+editingRow+'"]'));menuLabels();document.querySelector('#backgroundStatus').textContent='Photo removed. Save to keep this change.'};

window.edgeDisplay={getState:()=>({layoutId,revision,name:displayName,type:'cabinet',frame:frameStyle,defaultFinish,items:ownedItems,order:[...order],shelves:shelfIds.map(id=>({id,settings:rowSettings[id]}))}),beforeMutate:async()=>{if(saveTimer)await persist();await saveChain;},applyState:state=>{layoutId=state.layoutId;revision=state.revision;ownedItems=state.items;order=state.order;displayName=state.name;defaultFinish=state.defaultFinish;shelfIds=state.shelves.map(s=>s.id);rowSettings=Object.fromEntries(state.shelves.map(s=>[s.id,s.settings]));document.querySelector('#displayTitle').textContent=state.name;rebuildItems();renderInPlace();document.querySelector('#collectorLevel').textContent='Level '+ownedItems.filter(i=>i.status==='current').length;}};

window.edgeDisplay.focusPiece=id=>{const n=layouts.findIndex(r=>r.items.some(i=>i.id===id));if(n<0)return;const row=wall.querySelector('[data-row="'+n+'"]');mountShelf(row,n);row.querySelector('[data-id="'+id+'"]')?.scrollIntoView({block:'center',behavior:'smooth'});};
