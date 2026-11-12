import {randomUUID} from 'node:crypto';
import {HttpError} from './security.mjs';
export async function prepareAvatar(bytes){
 if(bytes.length>2000000)throw new HttpError(413,'Please choose a smaller photo.');
 try{
  const {default:sharp}=await import('sharp');
  const source=sharp(bytes,{limitInputPixels:24000000,animated:false});const meta=await source.metadata();
  if(!['jpeg','png','webp'].includes(meta.format))throw Error();
  const result=await source.rotate().resize(384,384,{fit:'cover',position:'attention'}).webp({quality:78}).toBuffer();
  if(result.length>150000)throw Error();return result;
 }catch{throw new HttpError(400,'Choose a JPG, PNG or WebP photo.');}
}
export async function saveAvatar(sql,owner,bytes,revision){
 if(!Number.isSafeInteger(revision)||revision<0)throw new HttpError(400,'Invalid profile revision.');
 const [p]=await sql`select profile_revision from shelf.profiles where id=${owner} for update`;
 if(!p||p.profile_revision!==revision)throw new HttpError(409,'Your profile changed elsewhere. Reload before uploading.');
 const version=randomUUID();
 await sql`insert into shelf.avatar_images(owner_id,image) values(${owner},${bytes}) on conflict(owner_id) do update set image=excluded.image`;
 await sql`update shelf.profiles set avatar_style='photo',avatar_version=${version},profile_revision=profile_revision+1 where id=${owner}`;
 return {avatar_style:'photo',avatar_version:version,profile_revision:revision+1};
}
export async function readAvatar(sql,owner){
 const [row]=await sql`select image from shelf.avatar_images where owner_id=${owner}::uuid`;
 if(!row)throw new HttpError(404,'Photo unavailable.');
 return new Response(new Uint8Array(row.image),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function readPublicAvatar(sql,id){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(404,'Photo unavailable.');
 await sql`select set_config('shelf.public_profile',${id},true)`;
 const [p]=await sql`select id from shelf.profiles where id=${id}::uuid and public_sharing and avatar_style='photo'`;
 if(!p)throw new HttpError(404,'Photo unavailable.');return readAvatar(sql,id);
}
