export const avatarPresets=[
 {id:'bear',label:'Bear',code:'1f43b'}, {id:'lion',label:'Lion',code:'1f981'},
 {id:'tiger',label:'Tiger',code:'1f42f'}, {id:'panda',label:'Panda',code:'1f43c'},
 {id:'owl',label:'Owl',code:'1f989'}, {id:'fox',label:'Fox',code:'1f98a'},
 {id:'dragon',label:'Dragon',code:'1f432'}, {id:'monkey',label:'Monkey',code:'1f435'}
];
export function avatarSource(p,publicId=null){
 if(p.avatar_style==='photo'&&p.avatar_version)return '/api/avatar'+(publicId?'/'+encodeURIComponent(publicId):'')+'?v='+encodeURIComponent(p.avatar_version);
 if(avatarPresets.some(x=>x.id===p.avatar_style))return '/avatars/'+p.avatar_style+'.svg';
 return null;
}
export function renderAvatar(node,p,{name='',publicId=null}={}){
 node.replaceChildren();const source=avatarSource(p,publicId);
 if(source){const img=new Image();img.alt='';img.width=112;img.height=112;img.src=source;img.className=p.avatar_style==='photo'?'avatar-photo':'avatar-preset';node.append(img)}
 else node.textContent=name?Array.from(name)[0].toUpperCase():'E';
}
