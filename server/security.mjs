import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('base64url');
export const hash=value=>createHash('sha256').update(value).digest('base64url');
export function equal(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function cookie(request,name){const value=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?value:null;}
export const sessionCookie=(value,age)=>`__Host-edge_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const loginCookie=(value,age)=>`__Host-edge_login=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export function assertOrigin(request,origin){if(request.headers.get('origin')!==origin)throw Object.assign(new Error('Invalid request origin'),{status:403});}
export function assertIdentity(payload,{issuer,clientId,nonce}){
 if(payload.iss!==issuer||!(Array.isArray(payload.aud)?payload.aud.includes(clientId):payload.aud===clientId)||!equal(payload.nonce,nonce)||typeof payload.sub!=='string'||!payload.sub)throw new Error('Invalid identity');
 if(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==clientId)throw new Error('Invalid authorized party');
}
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
