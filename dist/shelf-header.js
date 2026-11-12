import {renderAvatar} from './avatar-presets.mjs';
const menu=document.querySelector('#shelfNavigation'),toggle=document.querySelector('#menuToggle');
function closeMenu(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu')}
toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));toggle.setAttribute('aria-label',menu.hidden?'Open menu':'Close menu')};
document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){closeMenu();toggle.focus()}});
function paint(p){
 const name=p.display_name||'Edge Collector',avatar=document.querySelector('#shelfAvatar');
 avatar.className='collector-avatar '+p.avatar;renderAvatar(avatar,p,{name});
 document.querySelector('#collectorName').textContent=name;document.querySelector('#collectorLevel').textContent='Level '+p.level;
 document.querySelector('#adminMenuLink').hidden=!p.isAdmin;
 const badges=document.querySelector('#collectorBadges');badges.replaceChildren();
 for(const b of p.badges){const badge=document.createElement('span');badge.className='collector-badge '+b.kind;badge.textContent=(b.kind==='official'?'✓ ':'')+b.label;badges.append(badge)}
}
window.addEventListener('edge:profile',e=>paint(e.detail));if(window.edgeProfile)paint(window.edgeProfile);
