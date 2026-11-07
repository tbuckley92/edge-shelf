import {background} from '../../server/background.mjs';
import catalog from '../../dist/catalog.json' with {type:'json'};
import {packShelves} from '../../dist/packing.mjs';
import {login,callback,authenticated,logout} from '../../server/auth.mjs';
import {assertOrigin,HttpError} from '../../server/security.mjs';
import {validateState,readState,writeState} from '../../server/state.mjs';
import {materialKeys} from '../../server/material-keys.mjs';
const products=new Map(catalog.map(p=>[p.id,p]));products.finishes=new Set(materialKeys);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async function handler(request){
 try{
  const path=new URL(request.url).pathname.replace(/^\/\.netlify\/functions\/api/,'/api');
  if(request.method==='GET'&&path==='/api/auth/login')return await login();
  if(request.method==='GET'&&path==='/api/auth/callback')return await callback(request);
  if(request.method==='GET'&&path==='/api/collection')return json(await authenticated(request,(sql,id)=>readState(sql,id)));
  if(['POST','PUT','DELETE','PATCH'].includes(request.method))assertOrigin(request,process.env.APP_ORIGIN);
  if(path==='/api/background'&&['GET','POST','DELETE'].includes(request.method))return await background(request);
  if(request.method==='POST'&&path==='/api/auth/logout')return await logout(request);
  if(request.method==='PUT'&&path==='/api/collection'){
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'JSON required.');
   const raw=await request.text();if(Buffer.byteLength(raw)>1000000)throw new HttpError(413,'Collection is too large.');
   let body;try{body=JSON.parse(raw)}catch{throw new HttpError(400,'Invalid JSON.');}
   const state=validateState(body,products);
   return json(await authenticated(request,(sql,id)=>writeState(sql,id,state,products,packShelves)));
  }
  return json({error:'Not found'},404);
 }catch(error){
  // Do not log query parameters, tokens, SQL parameters or private collection data.
  const status=error.status||500;
  if(status>=500)console.error('Edge Shelf request failed', {type:error.name,code:/^[A-Z0-9_]{2,64}$/.test(error.code||'')?error.code:'UNCLASSIFIED'});
  return json({error:status<500||status===503?error.message:'Could not complete this request. Please try again.'},status);
 }
}
