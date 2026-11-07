import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(await fs.readFile('dist/catalog.json','utf8'));
await fs.mkdir('dist/assets',{recursive:true});
let manifest={};try{manifest=JSON.parse(await fs.readFile('dist/assets.json','utf8'))}catch{}
let cursor=0,failed=0;
async function worker(){while(cursor<catalog.length){const p=catalog[cursor++];if(!p.img)continue;
 const fingerprint=createHash('sha256').update(p.img+':'+p.cut+':v1').digest('hex').slice(0,16);
 const dest=`assets/${fingerprint}.webp`;
 if(manifest[p.id]?.src===dest){try{await fs.access('dist/'+dest);continue}catch{}}
 try{
 const url=new URL(p.img);url.searchParams.set('width','640');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('HTTP '+response.status);
 const {data,info}=await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info;
 if(!p.cut){const queue=new Int32Array(w*h);let head=0,tail=0;
 const visit=i=>{let j=i*4;if(data[j+3]&&Math.min(data[j],data[j+1],data[j+2])>=237){data[j+3]=0;queue[tail++]=i;}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
 while(head<tail){let i=queue[head++];if(i%w)visit(i-1);if(i%w<w-1)visit(i+1);if(i>=w)visit(i-w);if(i<w*(h-1))visit(i+w)}
 }
 let l=w,r=-1,t=h,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=36){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y)}
 if(r<l)throw new Error('Empty alpha');
 const width=r-l+1,height=b-t+1;
 await sharp(data,{raw:{width:w,height:h,channels:4}}).extract({left:l,top:t,width,height}).webp({quality:88}).toFile('dist/'+dest);
 manifest[p.id]={src:dest,width,height,contact:{x:.5,y:1},source:p.img,review:'automatic-alpha-boundary'};
 }catch(error){failed++;console.error(p.id+': '+error.message)}
 }}
await Promise.all(Array.from({length:6},worker));
await fs.writeFile('dist/assets.json',JSON.stringify(manifest));
console.log(JSON.stringify({prepared:Object.keys(manifest).length,failed}));if(failed)process.exitCode=1;
