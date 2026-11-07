// Run with migration/admin connection only, never a browser key.
import postgres from 'postgres';
import fs from 'node:fs/promises';
const sql=postgres(process.env.MIGRATION_DATABASE_URL,{ssl:'require',max:1,prepare:false});
const catalog=JSON.parse(await fs.readFile('dist/catalog.json'));const assets=JSON.parse(await fs.readFile('dist/assets.json'));
try{await sql.begin(async tx=>{for(const p of catalog)await tx`insert into shelf.products(id,translations,width_cm,height_cm,depth_cm,assets) values(${p.id},${tx.json({en:{name:p.name}})},${p.w||null},${p.h||null},${p.d||null},${tx.json(assets[p.id]||{})}) on conflict(id) do update set translations=excluded.translations,width_cm=excluded.width_cm,height_cm=excluded.height_cm,depth_cm=excluded.depth_cm,assets=excluded.assets`;});console.log('Catalogue seeded');}finally{await sql.end()}
