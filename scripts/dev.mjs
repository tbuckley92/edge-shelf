// Local QA server only. Not imported or bundled by Netlify.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import handler from '../netlify/functions/api.mjs';import {qa} from './qa-store.mjs';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__qa'){res.setHeader('Set-Cookie','edge_qa=1; Path=/; SameSite=Lax');res.setHeader('Location','/?qa=1');res.writeHead(302);return res.end()}
 if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})});const response=req.headers.cookie?.includes('edge_qa=1')?await qa(request):await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()))}
 const file=path.resolve('dist','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(path.resolve('dist')+path.sep))throw Error();let bytes=await fs.readFile(file);
 if(req.headers.cookie?.includes('edge_qa=1')&&file.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/<body([^>]*)>/,'<body$1><aside style="text-align:center;background:#fff3cc;padding:8px;font-size:12px">Local UI fixture — simulated collection</aside>'));
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch(e){res.writeHead(404);res.end('Not found')}});
server.listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0',()=>console.log('Edge Shelf local preview ready'));
