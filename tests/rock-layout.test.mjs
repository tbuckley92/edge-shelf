import test from 'node:test';import assert from 'node:assert/strict';import {resolveRocks,validateRocks} from '../dist/rock-layout.mjs';
test('rock grouping never loses unassigned pieces and ignores removed placements',()=>{
 const config=[{id:'a',style:'ice',size:'large',foreground:'ice',pieceIds:['b','c','removed']}];
 const result=resolveRocks(config,['a','b','c','d']);assert.equal(result.length,3);assert.equal(new Set(result.map(r=>r.id)).size,3);assert.deepEqual(result.flatMap(r=>r.pieceIds).sort(),['a','b','c','d']);
 assert.deepEqual(validateRocks(result,['a','b','c','d']),result);
 assert.throws(()=>validateRocks([{...config[0],size:'__proto__'}],['b','c']));
});
