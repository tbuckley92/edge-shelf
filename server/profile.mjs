import {HttpError} from './security.mjs';
import {avatarPresets} from '../dist/avatar-presets.mjs';

export const privacyKeys=['nickname','country','collection','level','badges','firstName','lastName'];
export const avatarKeys=['stone','forest','ocean','sunset','plum','gold'];
export const profileFields='id,display_name,first_name,last_name,email,phone,country,avatar,public_sharing,privacy,profile_revision,created_at';
const clean=(v,max,label)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new HttpError(400,'Invalid '+label+'.');return v.trim();};
export function validateProfile(body){
 if(!body||!Number.isSafeInteger(body.revision)||body.revision<0)throw new HttpError(400,'Invalid profile revision.');
 const allowed=new Set(['revision','nickname','firstName','lastName','phone','country','avatar','publicSharing','privacy','avatarStyle']);
 if(Object.keys(body).some(k=>!allowed.has(k)))throw new HttpError(400,'This profile field cannot be edited.');
 const nickname=clean(body.nickname,40,'nickname'),firstName=clean(body.firstName,100,'first name'),lastName=clean(body.lastName,100,'last name');
 const phone=clean(body.phone,20,'phone number'),country=clean(body.country,2,'country').toUpperCase();
 if(phone&&!/^\+[1-9]\d{6,14}$/.test(phone))throw new HttpError(400,'Use an international phone number, for example +447700900123.');
 if(country&&!/^[A-Z]{2}$/.test(country))throw new HttpError(400,'Choose a country.');
 const avatarStyle=body.avatarStyle??'initials';
 if(!['initials','photo',...avatarPresets.map(p=>p.id)].includes(avatarStyle))throw new HttpError(400,'Choose a profile picture.');
 // Accept old tabs without publishing newly introduced name fields.
 if(body.privacy&&Object.hasOwn(body.privacy,'avatar')){body={...body,privacy:{...body.privacy,firstName:body.privacy.firstName??false,lastName:body.privacy.lastName??false}};delete body.privacy.avatar;}
 if(!avatarKeys.includes(body.avatar)||typeof body.publicSharing!=='boolean'||!body.privacy||Object.keys(body.privacy).length!==privacyKeys.length||privacyKeys.some(k=>typeof body.privacy[k]!=='boolean'))throw new HttpError(400,'Invalid privacy settings.');
 return {revision:body.revision,nickname,firstName,lastName,phone,country,avatar:body.avatar,avatarStyle,publicSharing:body.publicSharing,privacy:Object.fromEntries(privacyKeys.map(k=>[k,body.privacy[k]]))};
}
export async function readProfile(sql,owner){
 const [p]=await sql`select p.id,p.display_name,p.first_name,p.last_name,p.email,p.phone,p.country,p.avatar,p.avatar_style,p.avatar_version,p.public_sharing,p.privacy,p.profile_revision,p.created_at,
  (select count(*)::int from shelf.owned_items i where i.owner_id=p.id) as level,
  coalesce((select jsonb_agg(jsonb_build_object('key',d.key,'label',d.label,'kind',d.kind,'awarded_at',b.awarded_at) order by b.awarded_at) from shelf.user_badges b join shelf.badge_definitions d on d.key=b.badge_key where b.owner_id=p.id and b.revoked_at is null),'[]'::jsonb) as badges,
  exists(select 1 from shelf.admin_roles r where r.owner_id=p.id and r.role='admin') as "isAdmin"
  from shelf.profiles p where p.id=${owner}`;
 if(!p)throw new HttpError(404,'Profile not found.');return p;
}
export async function updateProfile(sql,owner,p,updateName){
 const [old]=await sql`select first_name,last_name,profile_revision from shelf.profiles where id=${owner} for update`;
 if(old.profile_revision!==p.revision)throw new HttpError(409,'Your profile changed elsewhere. Reload it before saving.');
 if(p.avatarStyle==='photo'){const rows=await sql`select owner_id from shelf.avatar_images where owner_id=${owner}`;if(!rows.length)throw new HttpError(400,'Upload a photo first.');}
 if((old.first_name||'')!==p.firstName||(old.last_name||'')!==p.lastName)await updateName(p.firstName,p.lastName);
 await sql`update shelf.profiles set display_name=${p.nickname||null},first_name=${p.firstName||null},last_name=${p.lastName||null},phone=${p.phone||null},country=${p.country||null},avatar=${p.avatar},avatar_style=${p.avatarStyle},public_sharing=${p.publicSharing},privacy=${sql.json(p.privacy)},profile_revision=profile_revision+1 where id=${owner}`;
 return readProfile(sql,owner);
}
export function publicProjection(p,items,badges){
 if(!p?.public_sharing)return null;
 const visible=p.privacy||{};
 const result={};
 if(visible.nickname)result.nickname=p.display_name||'Collector';
 if(visible.country)result.country=p.country;
 result.avatar=p.avatar;result.avatar_style=p.avatar_style;
 if(p.avatar_style==='photo')result.avatar_version=p.avatar_version;
 if(visible.firstName)result.firstName=p.first_name;
 if(visible.lastName)result.lastName=p.last_name;
 if(visible.level)result.level=items.reduce((n,i)=>n+i.quantity,0);
 if(visible.collection)result.collection=items;
 if(visible.badges)result.badges=badges;
 return result;
}
export async function readPublicProfile(sql,id){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(404,'This profile is private or unavailable.');
 await sql`select set_config('shelf.public_profile',${id},true)`;
 const [p]=await sql`select display_name,first_name,last_name,country,avatar,avatar_style,avatar_version,public_sharing,privacy from shelf.profiles where id=${id}::uuid and public_sharing=true`;
 if(!p)throw new HttpError(404,'This profile is private or unavailable.');
 const items=(p.privacy.collection||p.privacy.level)?await sql`select product_id as "productId",count(*)::int as quantity from shelf.owned_items where owner_id=${id}::uuid group by product_id`:[];
 const badges=p.privacy.badges?await sql`select d.key,d.label,d.kind from shelf.user_badges b join shelf.badge_definitions d on d.key=b.badge_key where b.owner_id=${id}::uuid and b.revoked_at is null`:[];
 return publicProjection(p,items,badges);
}
export async function requireAdmin(sql,owner){
 const roles=await sql`select role from shelf.admin_roles where owner_id=${owner} and role='admin'`;
 if(!roles.length)throw new HttpError(403,'Administrator access required.');
}
export async function adminOverview(sql,owner){
 await requireAdmin(sql,owner);
 const users=await sql`select p.id,p.display_name,p.created_at,(select count(*)::int from shelf.owned_items i where i.owner_id=p.id) as level,exists(select 1 from shelf.user_badges b where b.owner_id=p.id and b.badge_key='official_employee' and b.revoked_at is null) as official from shelf.profiles p order by p.created_at desc limit 100`;
 const events=await sql`select id,actor_id,owner_id,action,reason,changes,created_at from shelf.audit_events order by created_at desc limit 100`;
 return {users,events};
}
export async function setEmployeeBadge(sql,actor,body){
 await requireAdmin(sql,actor);
 if(!body||!/^[0-9a-f-]{36}$/i.test(body.ownerId)||typeof body.active!=='boolean'||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>300)throw new HttpError(400,'Choose a collector and provide a reason (5–300 characters).');
 await sql`select set_config('shelf.audit_reason',${body.reason.trim()},true)`;
 if(body.active)await sql`insert into shelf.user_badges(owner_id,badge_key,awarded_by) values(${body.ownerId}::uuid,'official_employee',${actor}) on conflict(owner_id,badge_key) do update set revoked_at=null,awarded_by=excluded.awarded_by,awarded_at=now()`;
 else await sql`update shelf.user_badges set revoked_at=now() where owner_id=${body.ownerId}::uuid and badge_key='official_employee' and revoked_at is null`;
 return {ok:true};
}
