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
let catalog=new Map(), assets={}, ownedItems=[], shelfIds=[], layoutId=null, revision=0, signedIn=false, marketingPreference=null;
const defaultSettings={finish:'ice',weather:'none',fixture:'spot',colour:'warm',brightness:70,speed:15};
if(!finishes||typeof finishes!=='object')finishes={};

const lights={warm:'255,229,179',cool:'226,242,255',amber:'255,178,82',blue:'153,212,255',off:'255,255,255'};
let rowSettings=read('edge-row-settings',{});
if(!rowSettings||typeof rowSettings!=='object')rowSettings={};
const legacy={fixture:read('edge-wall-fixture','spot'),colour:read('edge-wall-led','warm'),brightness:read('edge-wall-brightness',70),speed:read('edge-wall-cycle-seconds',15)};
function settings(n){
 const value={...legacy,...rowSettings[shelfIds[n]]};
 return {weather:['rain','snow'].includes(value.weather)?value.weather:'none',
 fixture:['none','spot','strip'].includes(value.fixture)?value.fixture:'spot',
 colour:[...Object.keys(lights),'rainbow'].includes(value.colour)?value.colour:'warm',
 brightness:Number.isFinite(+value.brightness)?Math.max(0,Math.min(100,+value.brightness)):70,
 speed:Number.isFinite(+value.speed)?Math.max(3,Math.min(60,+value.speed)):15};
}
wall.classList.add('cabinet');wall.style.setProperty('--backwall','linear-gradient(100deg,#222827,#39413e 50%,#252c29)');wall.style.setProperty('--caption','#eceee5');
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
 const s=settings(row.dataset.row);row.dataset.fixture=s.fixture;applyWeather(row,s.weather);
 row.style.setProperty('--light',s.colour==='rainbow'?rainbowRGB(0):lights[s.colour]);
 row.style.setProperty('--power',s.fixture==='none'||s.colour==='off'?0:s.brightness/100);
 row.style.setProperty('--rim',s.fixture==='none'||s.colour==='off'?0:s.brightness/300);
}
const shelfMenu=document.querySelector('#shelfMenu');
let editingRow=null, originalSettings=null, originalFinish=null, savingShelf=false;
function openShelf(n){
 editingRow=n;originalSettings=rowSettings[shelfIds[n]]?{...rowSettings[shelfIds[n]]}:null;shelfMenu.querySelector('h2').textContent='Shelf '+(n+1);
 const row=wall.querySelector('[data-row="'+n+'"]'),s=settings(n);
 originalFinish=row.dataset.finish;shelfMenu.querySelector('[name=finish]').value=originalFinish;
 document.querySelector('#saveStatus').textContent='';
 for(const key of ['fixture','colour','brightness','speed','weather'])shelfMenu.querySelector('[name='+key+']').value=s[key];
 menuLabels();shelfMenu.classList.remove('closing');shelfMenu.showModal();
 requestAnimationFrame(()=>{
  const room=window.innerHeight-shelfMenu.getBoundingClientRect().height-76;
  const bounds=row.getBoundingClientRect();
  const desired=76+Math.max(0,(room-bounds.height)/2);
  window.scrollBy({top:bounds.top-desired,behavior:'smooth'});
 });
}
function menuLabels(){
 const colour=shelfMenu.querySelector('[name=colour]').value;
 const noLights=shelfMenu.querySelector('[name=fixture]').value==='none';
 for(const key of ['colour','brightness'])shelfMenu.querySelector('[name='+key+']').closest('label').hidden=noLights;
 shelfMenu.querySelector('.speed-setting').hidden=noLights||colour!=='rainbow';
 for(const key of ['brightness','speed'])shelfMenu.querySelector('[data-output='+key+']').textContent=shelfMenu.querySelector('[name='+key+']').value+(key==='speed'?'s':'%');
}
shelfMenu.addEventListener('input',()=>{
 if(editingRow===null)return;const n=editingRow,row=wall.querySelector('[data-row="'+n+'"]');
 const finish=shelfMenu.querySelector('[name=finish]').value;paint(row,finish);row.dataset.finish=finish;
 rowSettings[shelfIds[n]]={finish,weather:shelfMenu.querySelector('[name=weather]').value,fixture:shelfMenu.querySelector('[name=fixture]').value,colour:shelfMenu.querySelector('[name=colour]').value,brightness:+shelfMenu.querySelector('[name=brightness]').value,speed:+shelfMenu.querySelector('[name=speed]').value};
 applyLighting(row);menuLabels();syncRainbow();document.querySelector('#saveStatus').textContent='Unsaved changes';
});
document.querySelector('#saveShelf').onclick=async()=>{
 if(editingRow===null)return;
 const button=document.querySelector('#saveShelf');button.disabled=true;savingShelf=true;for(const control of shelfMenu.querySelectorAll('input,select,button'))control.disabled=true;
 const n=editingRow,row=wall.querySelector('[data-row="'+n+'"]');
 rowSettings[shelfIds[n]]={...settings(n),finish:row.dataset.finish};
 try{await persist(true);originalSettings={...rowSettings[shelfIds[n]]};originalFinish=row.dataset.finish;savingShelf=false;closeTray()}
 catch(error){document.querySelector('#saveStatus').textContent=error.message}
 finally{savingShelf=false;for(const control of shelfMenu.querySelectorAll('input,select,button'))control.disabled=false}
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
function reorder(from,to){
 if(from<0||to<0||from>=order.length||to>=order.length||from===to)return;
 const anchorId=order[to],anchor=wall.querySelector('[data-id="'+anchorId+'"]');
 const oldTop=anchor?.getBoundingClientRect().top??100,oldScroll=window.scrollY;
 order.splice(to,0,order.splice(from,1)[0]);
 // Keep the full document height during replacement so the browser cannot clamp scroll to zero.
 wall.style.minHeight=wall.offsetHeight+'px';
 render();
 const targetRow=layouts.findIndex(r=>r.items.some(i=>i.id===anchorId));if(targetRow>=0)mountShelf(wall.children[targetRow],targetRow);
 const replacement=wall.querySelector('[data-id="'+anchorId+'"]');
 const nextTop=replacement?.getBoundingClientRect().top??oldTop;
 window.scrollTo({top:oldScroll+nextTop-oldTop,behavior:'instant'});
 wall.style.minHeight='';queueSave();
}
function openDetails(index){
 const p=byId.get(order[index]);
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
 light.style.setProperty('--silhouette','url("'+asset.src+'")');btn.replaceChildren(image,light);
}
const observer={disconnect(){},observe:showArt};
const effectObserver=new IntersectionObserver(entries=>{
 for(const entry of entries)entry.target.classList.toggle('effects-visible',entry.isIntersecting);syncRainbow();
},{rootMargin:'50px'});
const shelfObserver=new IntersectionObserver(entries=>{
 for(const entry of entries){const row=entry.target,n=Number(row.dataset.row);
  if(entry.isIntersecting)mountShelf(row,n);
  else if(editingRow!==n&&(!drag||!row.contains(drag.btn))){
   row.querySelectorAll('.weather').forEach(layer=>weatherObserver.unobserve(layer));
   row.replaceChildren();delete row.dataset.mounted;
  }
 }
 syncRainbow();
},{rootMargin:'650px'});
function pruneShelves(){
 for(const row of wall.querySelectorAll('.row[data-mounted]')){const r=row.getBoundingClientRect();if((r.bottom < -650 || r.top > innerHeight+650)&&Number(row.dataset.row)!==editingRow){row.querySelectorAll('.weather').forEach(layer=>weatherObserver.unobserve(layer));row.replaceChildren();delete row.dataset.mounted}}
}
function ensureShelves(count){while(shelfIds.length<count){const id=crypto.randomUUID();shelfIds.push(id);rowSettings[id]={...defaultSettings,finish:['ice','jungle','oak','temple','magma'][shelfIds.length%5]}}}
function paint(row,key){const m=materials[key];row.style.setProperty('--texture',m.texture);row.style.setProperty('--tone',m.tone);row.style.setProperty('--top',m.top)}
function mountShelf(row,n){
 if(row.dataset.mounted)return;row.dataset.mounted='true';const layout=layouts[n];
 row.innerHTML='<div class="display"><div class="lighting" aria-hidden="true"><i class="strip"></i></div><div class="ledge"><span class="top"></span><span class="front"></span></div><div class="slots"></div><button type="button" class="shelf-gear" aria-label="Settings for shelf '+(n+1)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.2-.6-2 3.4 1.7 1.7v2.5L2.2 15l2 3.4 2.2-.6 2 .9L9 21h4l.6-2.3 2-.9 2.2.6 2-3.4-1.7-1.8v-2.5L19.8 9l-2-3.4-2.2.6-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg></button></div>';
 row.dataset.finish=Object.hasOwn(materials,rowSettings[shelfIds[n]]?.finish)?rowSettings[shelfIds[n]].finish:Object.hasOwn(materials,finishes[n])?finishes[n]:['ice','jungle','oak','temple','magma'][n%5];
 paint(row,row.dataset.finish);applyLighting(row);
 row.querySelector('.shelf-gear').onclick=()=>openShelf(n);
 for(const item of layout.items){
 const p=byId.get(item.id),btn=document.createElement('button');btn.className='piece';btn.dataset.id=p.id;btn.dataset.index=order.indexOf(p.id);
 btn.title=p.name+' · '+p.w+' × '+p.h+' cm';btn.setAttribute('aria-label','Details for '+btn.title);
 btn.style.setProperty('--x',item.x);btn.style.setProperty('--w',p.w);btn.style.setProperty('--h',p.h);btn.style.setProperty('--piece-depth',p.d||30);
 const lamp=document.createElement('i');lamp.className='lamp';lamp.style.setProperty('--x',item.x);lamp.style.setProperty('--w',p.w);row.querySelector('.lighting').append(lamp);
 row.querySelector('.slots').append(btn);observer.observe(btn);
 }
}
function render(){
 const started=performance.now();shelfObserver.disconnect();effectObserver.disconnect();weatherObserver.disconnect();
 wall.replaceChildren();layouts=packShelves(order,byId);ensureShelves(layouts.length);
 const fragment=document.createDocumentFragment();
 layouts.forEach((layout,n)=>{
  const row=document.createElement('section');row.className='row';row.dataset.row=n;row.dataset.shelfId=shelfIds[n];
  row.style.setProperty('--clearance',layout.clearance);
  row.style.setProperty('--shelf-depth',Math.max(6,...layout.items.map(item=>(byId.get(item.id).d||30)*.16)));
  fragment.append(row);
 });wall.append(fragment);
 for(const row of wall.children){shelfObserver.observe(row);effectObserver.observe(row);const r=row.getBoundingClientRect();if(r.bottom>-650&&r.top<innerHeight+650)mountShelf(row,Number(row.dataset.row))}
 syncRainbow();
 const missing=order.map(id=>byId.get(id)).filter(p=>!(p.w>0&&p.h>0)||p.w>100),pending=document.querySelector('#pending');
 pending.hidden=!missing.length;pending.replaceChildren();
 if(missing.length){const heading=document.createElement('strong');heading.textContent='Awaiting dimensions or a wider shelf';pending.append(heading);for(const p of missing){const line=document.createElement('p');line.textContent=p.name;pending.append(line)}}
 document.querySelector('#emptyCollection').hidden=order.length>0||!signedIn;
 performance.clearMeasures('edge-render');performance.measure('edge-render',{start:started,end:performance.now()});
}
let drag=null,ignoreUntil=0;
function hit(x,y){
 const row=document.elementFromPoint(x,y)?.closest('.row');if(!row)return null;
 const pieces=[...row.querySelectorAll('.piece')];if(!pieces.length)return null;
 return pieces.reduce((best,p)=>{const r=p.getBoundingClientRect(),b=best.getBoundingClientRect();return Math.abs(x-r.left-r.width/2)<Math.abs(x-b.left-b.width/2)?p:best});
}
function moveGhost(){if(!drag?.ghost)return;drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';const target=hit(drag.x,drag.y);if(target!==drag.target){drag.target?.classList.remove('target');drag.target=target;target?.classList.add('target')}}
function autoscroll(){if(!drag?.ghost)return;const zone=65,y=drag.y;const speed=y<zone?-Math.ceil((zone-y)/5):y>innerHeight-zone?Math.ceil((y-innerHeight+zone)/5):0;if(speed)window.scrollBy(0,speed);moveGhost();drag.frame=requestAnimationFrame(autoscroll)}
function begin(){
 if(!drag||drag.ghost)return;
 const img=drag.btn.querySelector('img');const ghost=img?img.cloneNode():document.createElement('div');
 if(!img)ghost.textContent=drag.btn.title;
 ghost.className='ghost';document.body.append(ghost);drag.ghost=ghost;
 drag.btn.classList.add('dragging');drag.btn.setAttribute('aria-pressed','true');
 if(drag.pointer!==undefined)drag.btn.setPointerCapture(drag.pointer);
 autoscroll();
}
function end(drop){
 if(!drag)return;const d=drag;drag=null;clearTimeout(d.timer);cancelAnimationFrame(d.frame);
 d.btn.classList.remove('dragging');d.btn.removeAttribute('aria-pressed');d.target?.classList.remove('target');d.ghost?.remove();
 pruneShelves();
 if(d.ghost){ignoreUntil=Date.now()+600;if(drop&&d.target)reorder(Number(d.btn.dataset.index),Number(d.target.dataset.index))}
}
function press(btn,x,y,extra={}){
 drag={btn,x,y,startX:x,startY:y,...extra};
 drag.timer=setTimeout(begin,450);
}
function track(x,y){
 if(!drag)return;drag.x=x;drag.y=y;
 // Movement before the hold completes belongs to scrolling, never to reordering.
 if(!drag.ghost&&Math.hypot(x-drag.startX,y-drag.startY)>8){ignoreUntil=Date.now()+600;end(false);return}
 moveGhost();
}
wall.onpointerdown=e=>{
 if(e.pointerType==='touch')return;
 const btn=e.target.closest('.piece');if(!btn||e.button!==0||drag)return;
 press(btn,e.clientX,e.clientY,{pointer:e.pointerId});
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
window.addEventListener('scroll',()=>{if(drag&&!drag.ghost){ignoreUntil=Date.now()+600;end(false)}},{passive:true});
wall.addEventListener('contextmenu',e=>{if(e.target.closest('.piece'))e.preventDefault()});

wall.onclick=e=>{const btn=e.target.closest('.piece');if(btn&&Date.now()>ignoreUntil)openDetails(Number(btn.dataset.index))};
const status=document.querySelector('#loadStatus');
function report(message){status.hidden=!message;status.textContent=message}
async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
 if(response.status===204)return null;
 let data;try{data=await response.json()}catch{throw new Error('The collection service is unavailable.')}
 if(!response.ok){const error=new Error(data.error||'Could not save.');error.status=response.status;throw error}return data;
}
function snapshot(includePreview=false){return {layoutId,revision,items:ownedItems,order:[...order],shelves:shelfIds.map(id=>({id,settings:{...defaultSettings,...(!includePreview&&editingRow!==null&&id===shelfIds[editingRow]?originalSettings:rowSettings[id])}})),marketingPreference}}
let saveChain=Promise.resolve(),saveTimer=null,conflict=false,pendingSaves=0;
function persist(includePreview=false){
 clearTimeout(saveTimer);saveTimer=null;const data=snapshot(includePreview);
 pendingSaves++;const work=saveChain.catch(()=>{}).then(async()=>{
  if(conflict)throw new Error('Collection changed elsewhere. Reload before saving.');
  data.revision=revision;report('Saving…');
  try{const result=await api('collection',{method:'PUT',body:JSON.stringify(data)});revision=result.revision;report('Saved');}
  catch(error){if(error.status===409)conflict=true;report(error.message);document.querySelector('#retrySave').hidden=false;throw error}
 }).finally(()=>pendingSaves--);saveChain=work;return work;
}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist().catch(()=>{}),200)}
document.querySelector('#retrySave').onclick=()=>persist().then(()=>document.querySelector('#retrySave').hidden=true).catch(()=>{});
function rebuildItems(){byId=new Map(ownedItems.filter(i=>catalog.has(i.productId)).map(i=>[i.id,{...catalog.get(i.productId),id:i.id,productId:i.productId}]));order=order.filter(id=>byId.has(id))}
const catalogueDrawer=document.querySelector('#catalogueDrawer');
document.querySelector('#addPiece').onclick=()=>{catalogueDrawer.showModal();searchCatalog()};
document.querySelector('#closeCatalogue').onclick=()=>catalogueDrawer.close();
document.querySelector('#catalogueSearch').oninput=searchCatalog;
function searchCatalog(){
 const term=document.querySelector('#catalogueSearch').value.toLocaleLowerCase(),results=document.querySelector('#catalogueResults');results.replaceChildren();
 for(const p of [...catalog.values()].filter(p=>(p.name+' '+p.id).toLocaleLowerCase().includes(term)).slice(0,40)){
  const row=document.createElement('div');row.className='catalogue-result';
  const img=new Image();img.alt='';img.loading='lazy';img.src=assets[p.id]?.src||p.img;row.append(img);
  const label=document.createElement('span');label.textContent=p.name;row.append(label);
  const button=document.createElement('button');button.className='edge-button';button.textContent='Add owned copy';button.onclick=async()=>{
   button.disabled=true;const item={id:crypto.randomUUID(),productId:p.id};ownedItems.push(item);order.push(item.id);rebuildItems();render();
   try{await persist();catalogueDrawer.close()}catch(error){report(error.message)}finally{button.disabled=false}
  };row.append(button);results.append(row);
 }
}
document.querySelector('#marketingPreference').onchange=e=>{marketingPreference=e.target.checked;queueSave()};
document.querySelector('#signOut').onclick=async()=>{try{await saveChain.catch(()=>{});await api('auth/logout',{method:'POST'});location.reload()}catch(error){report(error.message)}};
window.addEventListener('beforeunload',event=>{if(saveTimer||pendingSaves){event.preventDefault();event.returnValue=''}});
async function start(){
 const [pieces,prepared]=await Promise.all([fetch('catalog.json').then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('assets.json').then(r=>{if(!r.ok)throw Error();return r.json()})]);
 catalog=new Map(pieces.map(p=>[p.id,p]));assets=prepared;
 try{
  const state=await api('collection');signedIn=true;layoutId=state.layoutId||crypto.randomUUID();revision=state.revision;ownedItems=state.items;order=state.order;
  shelfIds=state.shelves.map(s=>s.id);rowSettings=Object.fromEntries(state.shelves.map(s=>[s.id,s.settings]));marketingPreference=state.profile.marketing_preference;
  document.querySelector('#marketingPreference').checked=marketingPreference===true;
  document.querySelector('#loginPanel').hidden=true;document.querySelector('#collectionTools').hidden=false;rebuildItems();render();
 }catch(error){if(error.status!==401)report(error.message)}
}
start().catch(()=>report('Could not load the catalogue. Reload to try again.'));
