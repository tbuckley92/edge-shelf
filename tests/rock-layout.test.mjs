import test from 'node:test';import assert from 'node:assert/strict';import {resolveRocks,validateRocks} from '../dist/rock-layout.mjs';
test('rock grouping never loses unassigned pieces and ignores removed placements',()=>{
 const config=[{id:'a',style:'ice',size:'large',foreground:'ice',pieceIds:['b','c','removed']}];
 const result=resolveRocks(config,['a','b','c','d']);assert.equal(result.length,4);assert.equal(new Set(result.map(r=>r.id)).size,4);assert.ok(result.every(r=>r.pieceIds.length===1));assert.equal(result[1].style,'ice');assert.deepEqual(result.flatMap(r=>r.pieceIds).sort(),['a','b','c','d']);
 assert.deepEqual(validateRocks(result,['a','b','c','d']),result);
 assert.throws(()=>validateRocks([{...config[0],size:'__proto__'}],['b','c']));
});
test('legacy groups split all 3000 copies with stable themes and unique platform IDs',()=>{
 const order=Array.from({length:3000},(_,i)=>'copy-'+i),config=Array.from({length:1000},(_,i)=>({id:'rock-'+i,style:'lava',size:'large',foreground:'stones',pieceIds:order.slice(i*3,i*3+3)}));
 const result=resolveRocks(config,order);assert.equal(result.length,3000);assert.deepEqual(result.flatMap(r=>r.pieceIds),order);assert.equal(new Set(result.map(r=>r.id)).size,3000);assert.ok(result.every(r=>r.style==='lava'&&r.size==='small'));assert.deepEqual(resolveRocks(result,order),result);
});
