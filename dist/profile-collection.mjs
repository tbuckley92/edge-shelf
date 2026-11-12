export function setupCollectionManager({catalog,assets,request,onChange}){
 const $=s=>document.querySelector(s),labels={current:'Current collection',previous:'Previously owned',wishlist:'Wishlist'};
 let data={items:[],versions:[]},busy=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
 function options(select){for(const [value,label] of Object.entries(labels))select.add(new Option(label,value));}
 async function change(body){if(busy)return;busy=true;$('#collectionStatus').textContent='Saving…';render();try{data=await request('collection/manage',{method:'POST',body:JSON.stringify({...body,versions:data.versions,collectionRevision:data.collectionRevision})});await onChange();$('#collectionStatus').textContent='Collection saved.';}catch(e){$('#collectionStatus').textContent=e.message;}finally{busy=false;render()}}
 function render(){const target=$('#collectionList');target.replaceChildren();const filter=$('#collectionFilter').value;const items=data.items.filter(i=>filter==='all'||i.status===filter);$('#addCollectionItem').disabled=busy;if(!items.length){target.append(el('p','No pieces in this list yet.'));return}
  const counts=new Map();for(const item of data.items)counts.set(item.productId,(counts.get(item.productId)||0)+1);
  const copy=new Map();for(const item of items){const p=catalog.get(item.productId),name=p?.name||'Edge Sculpture',card=el('article',null,'collection-card managed-copy'),img=new Image();img.alt='';img.loading='lazy';img.src=assets[item.productId]?.src||p?.img||'';copy.set(item.productId,(copy.get(item.productId)||0)+1);card.append(img,el('h3',name));if(counts.get(item.productId)>1)card.append(el('p','Copy '+copy.get(item.productId)+' · '+item.id.slice(0,6)));
   const label=el('label','Status'),select=el('select');options(select);select.value=item.status;select.disabled=busy;select.setAttribute('aria-label','Status for '+name+' '+item.id.slice(0,6));select.onchange=()=>change({action:'status',itemId:item.id,status:select.value});label.append(select);card.append(label);
   const locations=el('div',null,'piece-locations');for(const loc of item.locations){const chip=el('span',null,'location-chip'),text=loc.name+' · '+(loc.type==='pillars'?'Pillar':loc.type==='rocks'?'Rock':loc.row?'Shelf '+loc.row:'Awaiting space'),link=el('a',text);link.href=(loc.type==='pillars'?'/pillars.html?id=':loc.type==='rocks'?'/rocks.html?id=':'/display.html?id=')+loc.layoutId;const remove=el('button','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+name+' from '+text);remove.onclick=()=>change({action:'removePlacement',itemId:item.id,layoutId:loc.layoutId,shelfId:loc.shelfId});chip.append(link,remove);locations.append(chip)}
   if(!item.locations.length)locations.append(el('p','Not displayed'));
   if(data.displays?.length){const select=el('select');select.setAttribute('aria-label','Display for '+name);for(const d of data.displays)select.add(new Option(d.name,d.id));select.disabled=busy;const place=el('button','Add to display','place-copy');place.disabled=busy;place.onclick=()=>change({action:'place',itemId:item.id,displayId:select.value});locations.append(select,place)}else{const link=el('a','Create a display');link.href='/';locations.append(link)}
   card.append(locations);target.append(card);
  }
 }
 function search(){const q=$('#collectionSearch').value.toLowerCase(),select=$('#collectionProduct');select.replaceChildren();for(const p of [...catalog.values()].filter(p=>p.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)))select.add(new Option(p.name,p.id));}
 $('#collectionFilter').onchange=render;$('#collectionSearch').oninput=search;$('#addCollectionItem').onclick=()=>{const productId=$('#collectionProduct').value;if(productId)change({action:'add',productId,status:$('#newItemStatus').value})};search();
 return {load:async()=>{data=await request('collection/manage');render()}};
}
