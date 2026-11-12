import {api,el,loadAssets,statusLabels,statusIcons,signout} from './display-api.mjs';
import {createPicker,setupRename} from './display-picker.mjs';
import {defaultAtmosphere} from './rock-atmosphere.mjs';
import {resolveRocks} from './rock-layout.mjs';
const $=s=>document.querySelector(s),scene=$('#rockScene'),orbit=$('#rockOrbit'),demo=new URLSearchParams(location.search).get('demo')==='1';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mod=(v,n)=>((v%n)+n)%n;
let state,catalog,assets,rocks=[],items=new Map(),position=0,target=0,frame=0,grid=false,busy=false,selectedKey='',paused=false,visible=true,editing=null;
const labels={moss:'Moss',waterfall:'Waterfall',ice:'Ice',lava:'Lava'};
const fronts={shrubs:'texture-layered-grass-foreground-v1.webp',stones:'texture-layered-volcanic-foreground-v1.webp',ice:'texture-layered-ice-foreground-v1.webp'};
const scrollStep=140;
let atmosphere={...defaultAtmosphere};
const clamp=v=>Math.max(0,Math.min(Math.max(0,rocks.length-1),v));
const currentRock=()=>rocks[mod(Math.round(position),rocks.length)];
const art=item=>assets[item.productId]?.src||catalog.get(item.productId)?.img||'';
const name=id=>catalog.get(items.get(id)?.productId)?.name||'Edge Sculpture';
function picture(src,cls){const img=new Image();img.src=src;img.alt='';img.draggable=false;img.className=cls;return img}
function drawRock(r){
 const node=el('button',undefined,'floating-slot');node.type='button';node.dataset.id=r.id;node.tabIndex=0;node.dataset.size=r.size;
 const bob=el('span',undefined,'rock-bob');bob.style.animationDelay=-(rocks.indexOf(r)*1.47)+'s';bob.style.animationDuration=(5.8+(rocks.indexOf(r)%4)*.7)+'s';
 bob.append(picture('/assets/'+(r.style==='moss'?'floating-rock-v1.webp':'floating-rock-'+r.style+'-v1.webp'),'rock-art'));
 const count=r.pieceIds.length,zone=el('span',undefined,'rock-sculptures');
 for(const id of r.pieceIds){const item=items.get(id),slot=el('span',undefined,'rock-sculpture');slot.append(el('span',undefined,'rock-contact'),picture(art(item),'rock-piece'));const badge=el('span',statusIcons[item.status],'rock-piece-status '+item.status);badge.title=statusLabels[item.status];badge.classList.add('platform-status');badge.style.left=(9+(r.pieceIds.indexOf(id)+.82)*82/Math.max(1,count))+'%';bob.append(badge);zone.append(slot)}
 zone.style.setProperty('--pieces',Math.max(1,count));bob.append(zone);
 if(r.foreground!=='none')for(const place of ['left','centre','right']){const cluster=el('span',undefined,'rock-edge-cluster '+place+' '+r.foreground);cluster.style.backgroundImage='url(/assets/'+fronts[r.foreground]+')';bob.append(cluster);}
 node.append(bob);node.setAttribute('aria-label',labels[r.style]+' rock: '+(r.pieceIds.map(name).join(', ')||'empty'));
 node.onclick=()=>{const id=r.pieceIds[0];if(id)openDetails(id);else{position=target=rocks.indexOf(r);render();openEditor()}};
 return node;
}
function render(){
 if(!state)return;const n=rocks.length;$('#rockEmpty').hidden=n>0;$('#rockSelected').hidden=!n;$('#pieceNavigator').hidden=!n||grid;$('#rockDepth').disabled=n<2;$('#prevRock').disabled=n<2||position<.01;$('#nextRock').disabled=n<2||position>=n-1-.01;
 if(!n){orbit.replaceChildren();$('#rockCounter').textContent='';return}
 scene.style.setProperty('--world-progress',reduced.matches?'0.5':String(position/Math.max(1,n-1)));
 const selected=mod(Math.round(position),n),r=rocks[selected];$('#rockCounter').textContent=(selected+1)+' / '+n+' rocks';
 renderNavigator(selected);
 if(selectedKey!==r.id){selectedKey=r.id;renderSelected(r)}
 const base=Math.round(position),radius=Math.min(scene.clientWidth*.29,270),spacing=scene.clientWidth<650?125:145;
 const keys=new Set();for(let index=Math.max(0,base-4);index<=Math.min(n-1,base+4);index++){
  const rock=rocks[index],key=rock.id;keys.add(key);let node=[...orbit.children].find(n=>n.dataset.id===key);
  if(!node){node=drawRock(rock);orbit.append(node)}
  // Keep the helix path, but pull non-active platforms sharply into the distance.
  // Unlike cyclic cosine depth, focus never brightens distant turns again.
  const distance=index-position,angle=distance*1.15,focus=Math.exp(-2.4*distance*distance),scale=.34+.66*focus,x=Math.sin(angle)*radius,y=distance*spacing;
  const width=scene.clientWidth<650?Math.min(220,scene.clientWidth*.53):Math.min(370,scene.clientWidth*.36,scene.clientHeight*.65);
  node.style.width=width+'px';node.style.height=width*1.48+'px';node.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale})`;// Continuous atmospheric absorption avoids crossing a hard fog z-index boundary.
  node.style.opacity=.025+.975*Math.pow(focus,1.15);node.style.zIndex=String(10+Math.round(focus*90));node.style.filter='saturate('+(.35+.65*focus)+') blur('+((1-focus)*1.8)+'px)';node.setAttribute('aria-current',index===selected?'true':'false');
 }for(const node of [...orbit.children])if(!keys.has(node.dataset.id))node.remove();
}
function renderSelected(r){
 $('#selectedName').textContent=labels[r.style]+' rock';$('#selectedStatus').textContent=r.pieceIds.length?'One piece per rock':'Empty rock';
 const list=$('#selectedPieces');list.replaceChildren();
 for(const id of r.pieceIds){const item=items.get(id),row=el('div',undefined,'selected-piece-row');row.append(el('span',statusIcons[item.status]+' '+name(id)));const link=el('a','View product ↗');link.href='https://edgesculpture.es/products/'+encodeURIComponent(item.productId);link.target='_blank';link.rel='noopener';row.append(link);const details=el('button','Details');details.onclick=()=>openDetails(id);row.append(details);if(!demo){const remove=el('button','Remove from display');remove.onclick=()=>removePiece(id);row.append(remove)}list.append(row)}
 if(!r.pieceIds.length)list.append(el('p','Empty platform — choose pieces in Rock settings.','hint'));
}
function syncScroll(){position=target=clamp(scene.scrollTop/scrollStep);render()}
function rotate(value){if(!rocks.length)return;target=clamp(value);scene.scrollTo({top:target*scrollStep,behavior:reduced.matches?'instant':'smooth'});if(reduced.matches)syncScroll()}
function sizeTrack(){const height=scene.clientHeight;$('#helixViewport').style.height=height+'px';$('#helixTrack').style.height=(height+Math.max(0,rocks.length-1)*scrollStep)+'px';render()}
scene.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;syncScroll()})},{passive:true});
$('#prevRock').onclick=()=>rotate(Math.round(position)-1);$('#nextRock').onclick=()=>rotate(Math.round(position)+1);
scene.addEventListener('keydown',e=>{if(e.target.closest('input,button'))return;const moves={ArrowUp:-1,ArrowDown:1,PageUp:-4,PageDown:4};if(e.key in moves){e.preventDefault();rotate(Math.round(position)+moves[e.key])}else if(e.key==='Home'||e.key==='End'){e.preventDefault();rotate(e.key==='Home'?0:rocks.length-1)}});
new ResizeObserver(sizeTrack).observe(scene);
const strip=$('#pieceStrip'),stripTrack=$('#pieceStripTrack'),depthSlider=$('#rockDepth'),thumbnailStep=76;
let stripDrag=null,suppressStripClick=false;
function scrub(value){position=target=clamp(value);scene.scrollTo({top:position*scrollStep,behavior:'instant'});render()}
function renderNavigator(selected){
 depthSlider.max=Math.max(0,rocks.length-1);depthSlider.value=position;
 const title=rocks[selected].pieceIds.map(name).join(', ')||'Empty rock';
 depthSlider.setAttribute('aria-valuetext',(selected+1)+' of '+rocks.length+': '+title);$('#navigatorName').textContent=title;
 const first=Math.max(0,Math.floor(position)-8),last=Math.min(rocks.length-1,Math.ceil(position)+8),keep=new Set();
 for(let i=first;i<=last;i++){
  keep.add(String(i));let button=stripTrack.querySelector('[data-index="'+i+'"]');
  if(!button){const r=rocks[i],id=r.pieceIds[0];button=el('button',undefined,'piece-thumb');button.type='button';button.dataset.index=i;button.style.left=i*thumbnailStep+'px';const img=picture(id?art(items.get(id)):'/assets/floating-rock-v1.webp','');button.append(img,el('span',String(i+1)));button.setAttribute('aria-label','Go to '+(id?name(id):'empty rock')+', '+(i+1)+' of '+rocks.length);stripTrack.append(button)}
  button.setAttribute('aria-current',String(i===selected));button.tabIndex=i===selected?0:-1;
 }
 for(const child of [...stripTrack.children])if(!keep.has(child.dataset.index))child.remove();
 stripTrack.style.transform='translateX('+(-position*thumbnailStep-thumbnailStep/2)+'px)';
}
depthSlider.addEventListener('input',()=>scrub(Number(depthSlider.value)));
depthSlider.addEventListener('keydown',e=>{const moves={ArrowUp:-1,ArrowLeft:-1,ArrowDown:1,ArrowRight:1,PageUp:-5,PageDown:5};if(e.key in moves){e.preventDefault();scrub(Math.round(position)+moves[e.key])}else if(e.key==='Home'||e.key==='End'){e.preventDefault();scrub(e.key==='Home'?0:rocks.length-1)}});
depthSlider.addEventListener('change',()=>rotate(Math.round(position)));
strip.addEventListener('pointerdown',e=>{if(e.button!==0)return;suppressStripClick=false;stripDrag={id:e.pointerId,x:e.clientX,y:e.clientY,start:position,moved:false};});
strip.addEventListener('pointermove',e=>{if(!stripDrag||stripDrag.id!==e.pointerId)return;const dx=e.clientX-stripDrag.x,dy=e.clientY-stripDrag.y;if(!stripDrag.moved){if(Math.abs(dx)<6)return;if(Math.abs(dy)>Math.abs(dx)){stripDrag=null;return}stripDrag.moved=true;strip.setPointerCapture(e.pointerId)}e.preventDefault();scrub(stripDrag.start-dx/thumbnailStep);});
function endStripDrag(e){if(!stripDrag||e.pointerId!==stripDrag.id)return;const moved=stripDrag.moved;stripDrag=null;if(strip.hasPointerCapture(e.pointerId))strip.releasePointerCapture(e.pointerId);if(moved){suppressStripClick=true;rotate(Math.round(position))}}
strip.addEventListener('pointerup',endStripDrag);strip.addEventListener('pointercancel',endStripDrag);
strip.addEventListener('click',e=>{if(suppressStripClick){suppressStripClick=false;return}const button=e.target.closest('[data-index]');if(button)rotate(Number(button.dataset.index))});
strip.addEventListener('keydown',e=>{const delta={ArrowLeft:-1,ArrowRight:1};if(e.key in delta){e.preventDefault();strip.focus();rotate(Math.round(position)+delta[e.key])}else if(e.key==='Home'||e.key==='End'){e.preventDefault();strip.focus();rotate(e.key==='Home'?0:rocks.length-1)}});


function motion(){scene.classList.toggle('motion-paused',paused||document.hidden||!visible||grid);if(document.hidden||!visible){cancelAnimationFrame(frame);frame=0}}
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;motion()}).observe(scene);document.addEventListener('visibilitychange',motion);
$('#pauseMotion').onclick=()=>{paused=!paused;$('#pauseMotion').textContent=paused?'Resume floating':'Pause floating';$('#pauseMotion').setAttribute('aria-pressed',String(paused));motion()};
function renderGrid(){const root=$('#rockGrid');root.replaceChildren();rocks.forEach((r,index)=>{const card=el('button',undefined,'rock-grid-card');card.append(picture('/assets/'+(r.style==='moss'?'floating-rock-v1.webp':'floating-rock-'+r.style+'-v1.webp'),''),el('strong',labels[r.style]+' rock'),el('span',r.pieceIds.map(name).join(' · ')||'Empty platform'));card.onclick=()=>{grid=false;position=target=index;toggleView();scene.scrollTop=index*scrollStep;scene.focus()};root.append(card)})}
function toggleView(){$('#toggleGrid').textContent=grid?'Orbit view':'Grid view';$('#toggleGrid').setAttribute('aria-pressed',String(grid));scene.hidden=grid;$('#rockGrid').hidden=!grid;if(grid)renderGrid();else sizeTrack();render();motion()}
$('#toggleGrid').onclick=()=>{grid=!grid;toggleView()};
function applyState(next,focusId){state=next;atmosphere={...defaultAtmosphere,...state.atmosphere};paintAtmosphere();items=new Map(state.items.map(i=>[i.id,i]));rocks=resolveRocks(state.rockConfig,state.order);selectedKey='';orbit.replaceChildren();stripTrack.replaceChildren();$('#displayTitle').textContent=state.name;document.title=state.name+' · Edge Shelf';const index=focusId?rocks.findIndex(r=>r.id===focusId):-1;position=target=index>=0?index:clamp(Math.round(position));sizeTrack();scene.scrollTop=position*scrollStep;render();if(grid)renderGrid()}
const context={getState:()=>state,beforeMutate:async()=>{if(busy)throw Error('Please wait for this change to save.');},applyState,focusPiece:id=>{rotate(rocks.findIndex(r=>r.pieceIds.includes(id)))}};
async function removePiece(id){if(busy)return;busy=true;try{applyState(await api('displays',{method:'POST',body:JSON.stringify({action:'remove',displayId:state.layoutId,revision:state.revision,itemId:id})}));$('#rockStatus').textContent='Removed from this display. Your collection is unchanged.';return true}catch(e){$('#rockStatus').textContent=e.message;$('#pieceDetailStatus').textContent=e.message;return false}finally{busy=false}}
const details=$('#rockDetails');let detailItem=null,detailCloseTimer=null;
function openDetails(id){const item=items.get(id),p=catalog.get(item?.productId);if(!p)return;detailItem=id;details.querySelector('h2').textContent=p.name;details.querySelector('.dimensions').textContent=[p.h>0?'Height '+p.h+' cm':null,p.w>0?'Width '+p.w+' cm':null,p.d>0?'Depth '+p.d+' cm':null].filter(Boolean).join(' · ');details.querySelector('.product-link').href='https://edgesculpture.es/products/'+encodeURIComponent(item.productId);const img=details.querySelector('.product-image');img.src=art(item);img.alt=p.name;$('#pieceStatus').textContent=statusIcons[item.status]+' '+statusLabels[item.status];$('#removeDetailPiece').hidden=demo;$('#pieceDetailStatus').textContent='';details.classList.remove('closing');details.showModal()}
function closeDetails(){if(!details.open||detailCloseTimer)return;details.classList.add('closing');detailCloseTimer=setTimeout(()=>{details.close();details.classList.remove('closing');detailCloseTimer=null},reduced.matches?0:320)}
details.querySelector('.close-details').onclick=closeDetails;details.addEventListener('cancel',e=>{e.preventDefault();closeDetails()});$('#removeDetailPiece').onclick=async()=>{if(await removePiece(detailItem))closeDetails()};
const atmosphereDialog=$('#atmosphereEditor');
function paintAtmosphere(){
 scene.style.setProperty('--fog-colour',atmosphere.colour);
 scene.style.setProperty('--fog-density',atmosphere.fog?atmosphere.density/100:0);
 scene.style.setProperty('--fog-duration',(105-atmosphere.speed*.9)+'s');
 scene.classList.toggle('fog-still',atmosphere.speed===0);
 scene.classList.toggle('world-mountains',atmosphere.background==='mountains');
 $('#fogDensityValue').textContent=atmosphere.density+'%';$('#fogSpeedValue').textContent=atmosphere.speed===0?'Still':atmosphere.speed+'%';
}
function cancelAtmosphere(){if(busy)return;atmosphere={...defaultAtmosphere,...state.atmosphere};paintAtmosphere();atmosphereDialog.close()}
$('#editAtmosphere').onclick=()=>{if(!state||busy)return;$('#fogEnabled').checked=atmosphere.fog;$('#fogDensity').value=atmosphere.density;$('#fogSpeed').value=atmosphere.speed;$('#fogColour').value=atmosphere.colour;$('#worldBackground').value=atmosphere.background;$('#atmosphereStatus').textContent='';paintAtmosphere();atmosphereDialog.showModal()};
$('#closeAtmosphere').onclick=cancelAtmosphere;atmosphereDialog.addEventListener('cancel',e=>{e.preventDefault();cancelAtmosphere()});
$('#atmosphereForm').addEventListener('input',()=>{atmosphere={fog:$('#fogEnabled').checked,density:Number($('#fogDensity').value),speed:Number($('#fogSpeed').value),colour:$('#fogColour').value,background:$('#worldBackground').value};paintAtmosphere()});
$('#atmosphereForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('#saveAtmosphere').disabled=true;try{const next=demo?{...state,atmosphere:{...atmosphere}}:await api('displays',{method:'POST',body:JSON.stringify({action:'configureAtmosphere',displayId:state.layoutId,revision:state.revision,atmosphere})});const savedPosition=position;applyState(next);position=target=savedPosition;scene.scrollTop=position*scrollStep;render();atmosphereDialog.close();$('#rockStatus').textContent=demo?'Demo atmosphere updated — nothing saved to your account.':'Atmosphere saved.'}catch(e){$('#atmosphereStatus').textContent=e.message}finally{busy=false;$('#saveAtmosphere').disabled=false}};
reduced.addEventListener('change',render);
const dialog=$('#rockEditor'),form=$('#rockForm');
function openEditor(add=false){if(busy)return;editing=add?{id:crypto.randomUUID(),style:'moss',size:'small',foreground:'none',pieceIds:[]}:structuredClone(currentRock());if(!editing)return;$('#rockStyle').value=editing.style;$('#rockForeground').value=editing.foreground;$('#rockEditorTitle').textContent=add?'Add a rock':'Rock settings';$('#removeEmptyRock').hidden=add||editing.pieceIds.length>0;$('#rockEditorStatus').textContent='';
 for(let i=0;i<1;i++){const select=$('#rockPiece'+i);select.replaceChildren();const empty=el('option','Empty slot');empty.value='';select.append(empty);for(const id of state.order){const opt=el('option',name(id)+' · '+statusLabels[items.get(id).status]);opt.value=id;select.append(opt)}select.value=editing.pieceIds[i]||''}dialog.showModal();}
$('#editRock').onclick=()=>openEditor();$('#addRock').onclick=()=>openEditor(true);$('#closeRockEditor').onclick=()=>dialog.close();
async function saveConfig(config,focusId){if(busy)return;busy=true;$('#saveRock').disabled=true;$('#removeEmptyRock').disabled=true;try{const next=demo?{...state,rockConfig:config}:await api('displays',{method:'POST',body:JSON.stringify({action:'configureRocks',displayId:state.layoutId,revision:state.revision,rocks:config})});applyState(next,focusId);dialog.close();$('#rockStatus').textContent=demo?'Demo changes only — nothing saved to your account.':'Rock settings saved.'}catch(e){$('#rockEditorStatus').textContent=e.message}finally{busy=false;$('#saveRock').disabled=false;$('#removeEmptyRock').disabled=false}}
form.onsubmit=e=>{e.preventDefault();const pieceIds=[$('#rockPiece0').value].filter(Boolean);if(new Set(pieceIds).size!==pieceIds.length){$('#rockEditorStatus').textContent='Choose each copy only once.';return}const updated={...editing,style:$('#rockStyle').value,size:'small',foreground:$('#rockForeground').value,pieceIds},selected=new Set(pieceIds);let found=false;
 const config=rocks.flatMap(r=>{if(r.id===updated.id){found=true;return [updated]}const ids=r.pieceIds.filter(id=>!selected.has(id));return r.pieceIds.length&&!ids.length?[]:[{...r,pieceIds:ids}]});if(!found)config.push(updated);saveConfig(resolveRocks(config,state.order),updated.id)};
$('#removeEmptyRock').onclick=()=>saveConfig(rocks.filter(r=>r.id!==editing.id));
async function start(){
 ({catalog,assets}=await loadAssets());
 if(demo){const choices=[...catalog.values()].filter(p=>/^(Panda Cub|Dragon - Red|Tiger Cub - Bengal|Bear Cub|Horse Bust - Bay|Owl - Golden|Fox Bust|Elephant Calf)$/.test(p.name)).slice(0,8),demoItems=choices.map((p,i)=>({id:'demo-'+i,productId:p.id,status:['current','previous','wishlist'][i%3]}));
 const ids=demoItems.map(i=>i.id);applyState({name:'Edge Rocks · Demo',items:demoItems,order:ids,rockConfig:[{id:'demo-large',style:'waterfall',size:'large',foreground:'shrubs',pieceIds:ids.slice(0,3)},{id:'demo-ice',style:'ice',size:'medium',foreground:'ice',pieceIds:ids.slice(3,5)},{id:'demo-lava',style:'lava',size:'small',foreground:'stones',pieceIds:ids.slice(5,6)}]});$('#rockStatus').textContent='Try the rock settings. Demo changes are not saved to your account.';
 }else{const id=new URLSearchParams(location.search).get('id');if(!id){location.replace('/');return}const data=await api('bootstrap?display='+encodeURIComponent(id));if(data.state.type!=='rocks'){location.replace('/display.html?id='+data.state.layoutId);return}applyState(data.state);$('#adminMenuLink').hidden=!data.profile.isAdmin;signout();const picker=createPicker(context);$('#addPiece').hidden=false;$('#addPiece').onclick=()=>picker.open();setupRename(context)}
 $('#addRock').hidden=false;const menu=$('#shelfNavigation'),toggle=$('#menuToggle');toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden))};document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!toggle.contains(e.target)){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});
}
start().catch(e=>{$('#rockStatus').textContent=e.message;if(e.status===401){const link=el('a','Sign in to Edge Shelf');link.href='/api/auth/login';$('#rockStatus').append(link)}});
