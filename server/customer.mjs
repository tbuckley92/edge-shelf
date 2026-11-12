import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {HttpError} from './security.mjs';
// Encrypt each short-lived Shopify token with a key derived from its high-entropy
// session cookie. Neither plaintext token nor decrypting key is stored in the DB.
const key=session=>createHash('sha256').update('edge-shelf/customer-token/v1\0'+session).digest();
export function sealToken(token,session){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(session),iv);const data=Buffer.concat([c.update(token,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url');}
export function openToken(value,session){try{const b=Buffer.from(value,'base64url'),c=createDecipheriv('aes-256-gcm',key(session),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8')}catch{throw new HttpError(401,'Sign in again to update your Shopify details.');}}
export const identityQuery='query ShelfIdentity { customer { id firstName lastName emailAddress { emailAddress } phoneNumber { phoneNumber } } }';
export const nameMutation='mutation ShelfName($input: CustomerUpdateInput!) { customerUpdate(input: $input) { customer { id firstName lastName } userErrors { field message } } }';
export async function updateCustomerName(endpoint,token,customerId,firstName,lastName){
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify({query:nameMutation,variables:{input:{firstName,lastName}}}),signal:AbortSignal.timeout(10000)});
 if(response.status===401)throw new HttpError(401,'Sign in again to update your Shopify details.');
 if(!response.ok)throw new HttpError(502,'Shopify could not save your name. Please try again.');
 const result=await response.json(),payload=result.data?.customerUpdate;
 if(result.errors?.length||!payload||payload.userErrors?.length||payload.customer?.id!==customerId)throw new HttpError(422,'Shopify could not accept that name. Please check it and try again.');
 return payload.customer;
}
