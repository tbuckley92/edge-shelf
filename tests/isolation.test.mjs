import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('migration enforces two-customer isolation at PostgreSQL layer',async()=>{
 const db=new PGlite();try{
 await db.exec(await fs.readFile('migrations/001_edge_shelf.sql','utf8'));
 const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
 const la='20000000-0000-4000-8000-000000000001',lb='20000000-0000-4000-8000-000000000002';
 const ia='30000000-0000-4000-8000-000000000001',ib='30000000-0000-4000-8000-000000000002';
 await db.query(`insert into shelf.profiles(id,issuer,subject,shopify_customer_id) values($1,'issuer','a','customer-a'),($2,'issuer','b','customer-b')`,[a,b]);
 await db.exec("insert into shelf.products(id) values('cow')");
 await db.query('insert into shelf.layouts(id,owner_id) values($1,$2),($3,$4)',[la,a,lb,b]);
 await db.query("insert into shelf.owned_items(id,owner_id,product_id) values($1,$2,'cow'),($3,$4,'cow')",[ia,a,ib,b]);
 await db.exec('set role shelf_backend');
 assert.equal((await db.query('select * from shelf.owned_items')).rows.length,0);
 await db.query("select set_config('shelf.owner',$1,false)",[a]);
 assert.deepEqual((await db.query('select id from shelf.owned_items')).rows.map(r=>r.id),[ia]);
 assert.equal((await db.query('select * from shelf.profiles')).rows.length,1);
 assert.equal((await db.query('update shelf.owned_items set comment=$1 where id=$2 returning id',['hacked',ib])).rows.length,0);
 await assert.rejects(db.query('update shelf.owned_items set owner_id=$1 where id=$2',[b,ia]),/row-level security/);
 await assert.rejects(db.query("insert into shelf.owned_items(id,owner_id,product_id) values('30000000-0000-4000-8000-000000000003',$1,'cow')",[b]),/row-level security/);
 await assert.rejects(db.query('insert into shelf.placements(owner_id,layout_id,item_id,position) values($1,$2,$3,0)',[a,la,ib]),/foreign key/);
 await assert.rejects(db.exec("insert into shelf.entitlements(owner_id,feature,source,source_reference) values('10000000-0000-4000-8000-000000000001','premium','manual','forged')"),/permission denied/);
 await db.exec('begin');await db.query("select set_config('shelf.owner',$1,true)",[b]);assert.deepEqual((await db.query('select id from shelf.owned_items')).rows.map(r=>r.id),[ib]);await db.exec('rollback');assert.deepEqual((await db.query('select id from shelf.owned_items')).rows.map(r=>r.id),[ia]);
 await db.exec('reset role; create role anon; create role authenticated; set role anon');await assert.rejects(db.exec('select * from shelf.owned_items'),/permission denied/);
 await db.exec('reset role; set role authenticated');await assert.rejects(db.exec('select * from shelf.owned_items'),/permission denied/);
 }finally{await db.close()}
});
