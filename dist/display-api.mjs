export async function api(path,options={}){const r=await fetch('/api/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});let data;try{data=await r.json()}catch{throw Error('Display service unavailable. Please try again.')}if(!r.ok){const e=Error(data.error||'Could not complete request.');e.status=r.status;throw e}return data}
export const displayURL=d=>(d.type==='pillars'?'/pillars.html?id=':d.type==='rocks'?'/rocks.html?id=':'/display.html?id=')+(d.id||d.layoutId);
export const statusLabels={current:'Currently owned',previous:'Previously owned',wishlist:'Wishlist'};
export const statusIcons={current:'✓',previous:'↶',wishlist:'♡'};
export const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
export function signout(){document.querySelector('#signOut').onclick=async()=>{await api('auth/logout',{method:'POST'});location.href='/'};document.querySelector('#signOut').hidden=false}
let assetsPromise;export function loadAssets(){return assetsPromise??=Promise.all([fetch('/catalog.json').then(r=>r.json()),fetch('/assets.json').then(r=>r.json())]).then(([products,assets])=>({catalog:new Map(products.map(p=>[p.id,p])),assets}))}
