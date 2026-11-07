import {createRemoteJWKSet,jwtVerify} from 'jose';
import {randomToken,hash,equal,cookie,sessionCookie,loginCookie,assertIdentity,HttpError} from './security.mjs';
import {transaction,ownerContext} from './db.mjs';
let discoveryCache;
export function configuration(){
 const {APP_ORIGIN,SHOP_DOMAIN,SHOPIFY_ISSUER,SHOPIFY_CLIENT_ID,SHOPIFY_CLIENT_SECRET}=process.env;
 if(!APP_ORIGIN||!SHOP_DOMAIN||!SHOPIFY_ISSUER||!SHOPIFY_CLIENT_ID)throw new HttpError(503,'Sign-in is not configured yet.');
 if(new URL(APP_ORIGIN).origin!==APP_ORIGIN||!APP_ORIGIN.startsWith('https://')||!/^[a-z0-9.-]+$/.test(SHOP_DOMAIN))throw new Error('Invalid server configuration');
 return {origin:APP_ORIGIN,domain:SHOP_DOMAIN,issuer:SHOPIFY_ISSUER,clientId:SHOPIFY_CLIENT_ID,secret:SHOPIFY_CLIENT_SECRET,redirect:APP_ORIGIN+'/api/auth/callback'};
}
async function readJSON(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Object.assign(new Error('Identity provider request failed'),{code:'SHOPIFY_HTTP_'+response.status+'_'+(new URL(url).pathname.endsWith('/token')?'TOKEN':'API')});return response.json();}
export async function discovery(config){
 if(discoveryCache?.domain===config.domain&&discoveryCache.until>Date.now())return discoveryCache;
 const [oidc,api]=await Promise.all([readJSON(`https://${config.domain}/.well-known/openid-configuration`),readJSON(`https://${config.domain}/.well-known/customer-account-api`)]);
 if(oidc.issuer!==config.issuer)throw new Error('Unexpected Shopify issuer');
 for(const url of [oidc.authorization_endpoint,oidc.token_endpoint,oidc.jwks_uri,api.graphql_api]){const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='shopify.com')throw new Error('Unexpected Shopify endpoint');}
 return discoveryCache={domain:config.domain,until:Date.now()+300000,oidc,api,keys:createRemoteJWKSet(new URL(oidc.jwks_uri))};
}
export async function login(){
 const c=configuration(),d=await discovery(c),state=randomToken(),browser=randomToken(),verifier=randomToken(),nonce=randomToken();
 await transaction(async sql=>{
  await sql`delete from shelf.oauth_attempts where expires_at<now()`;
  await sql`insert into shelf.oauth_attempts values(${hash(state)},${hash(browser)},${verifier},${nonce},now()+interval '10 minutes')`;
 });
 const url=new URL(d.oidc.authorization_endpoint);
 for(const [key,value] of Object.entries({client_id:c.clientId,scope:'openid email customer-account-api:full',response_type:'code',redirect_uri:c.redirect,state,nonce,code_challenge:hash(verifier),code_challenge_method:'S256'}))url.searchParams.set(key,value);
 return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':loginCookie(browser,600),'Cache-Control':'no-store'}});
}
export async function callback(request){
 const c=configuration(),url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code'),browser=cookie(request,'__Host-edge_login');
 if(!state||!code||!browser||url.searchParams.has('error'))throw new HttpError(400,'Sign-in could not be completed. Please try again.');
 if(url.searchParams.has('iss')&&url.searchParams.get('iss')!==c.issuer)throw new HttpError(400,'Invalid sign-in issuer.');
 const attempt=await transaction(async sql=>(await sql`delete from shelf.oauth_attempts where state_hash=${hash(state)} and browser_hash=${hash(browser)} and expires_at>now() returning verifier,nonce`)[0]);
 if(!attempt)throw new HttpError(400,'Sign-in expired or was already used. Please try again.');
 const d=await discovery(c),body=new URLSearchParams({grant_type:'authorization_code',client_id:c.clientId,redirect_uri:c.redirect,code,code_verifier:attempt.verifier});
 const headers={'Content-Type':'application/x-www-form-urlencoded'};
 if(c.secret)headers.Authorization='Basic '+Buffer.from(`${c.clientId}:${c.secret}`).toString('base64');
 const token=await readJSON(d.oidc.token_endpoint,{method:'POST',headers,body});
 const payload=await verifyIdentityToken(token.id_token,d.keys,c,attempt.nonce);
 // Shopify customer ID is resolved exclusively with the token exchanged above.
 const result=await readJSON(d.api.graphql_api,{method:'POST',headers:{Authorization:token.access_token,'Content-Type':'application/json'},body:JSON.stringify({query:'query ShelfIdentity { customer { id firstName } }'})});
 const customer=result.data?.customer;
 if(result.errors||!/^gid:\/\/shopify\/Customer\/\d+$/.test(customer?.id||''))throw Object.assign(new Error('Customer identity unavailable'),{code:'CUSTOMER_IDENTITY_UNAVAILABLE'});
 const session=randomToken(),seconds=Math.min(Number(token.expires_in)||3600,86400);
 if(seconds<=0)throw new Error('Expired token');
 await transaction(async sql=>{
  await sql`select set_config('shelf.issuer',${c.issuer},true),set_config('shelf.subject',${payload.sub},true)`;
  const [profile]=await sql`insert into shelf.profiles(issuer,subject,shopify_customer_id,display_name) values(${c.issuer},${payload.sub},${customer.id},${customer.firstName||null}) on conflict(issuer,subject) do update set shopify_customer_id=excluded.shopify_customer_id returning id`;
  const old=cookie(request,'__Host-edge_session');if(old)await sql`delete from shelf.sessions where token_hash=${hash(old)}`;
  await sql`delete from shelf.sessions where expires_at<now()`;
  await sql`insert into shelf.sessions(token_hash,owner_id,expires_at) values(${hash(session)},${profile.id},now()+${seconds}*interval '1 second')`;
 });
 // Tokens are not stored or exposed. Reauthentication after expiry uses Shopify's existing session.
 const responseHeaders=new Headers({Location:c.origin,'Cache-Control':'no-store'});
 responseHeaders.append('Set-Cookie',sessionCookie(session,seconds));responseHeaders.append('Set-Cookie',loginCookie('',0));
 return new Response(null,{status:302,headers:responseHeaders});
}
export async function authenticated(request,fn){
 const token=cookie(request,'__Host-edge_session');if(!token)throw new HttpError(401,'Sign in to continue.');
 return transaction(async sql=>{
  const [session]=await sql`select owner_id from shelf.sessions where token_hash=${hash(token)} and expires_at>now()`;
  if(!session)throw new HttpError(401,'Your session expired. Sign in again.');
  await ownerContext(sql,session.owner_id);return fn(sql,session.owner_id);
 });
}
export async function logout(request){const token=cookie(request,'__Host-edge_session');if(token)await transaction(sql=>sql`delete from shelf.sessions where token_hash=${hash(token)}`);return new Response(null,{status:204,headers:{'Set-Cookie':sessionCookie('',0),'Cache-Control':'no-store'}});}

export async function verifyIdentityToken(token,keys,c,nonce){
 const {payload}=await jwtVerify(token,keys,{issuer:c.issuer,audience:c.clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce'],clockTolerance:5,maxTokenAge:'10m'});
 assertIdentity(payload,{...c,nonce});return payload;
}
