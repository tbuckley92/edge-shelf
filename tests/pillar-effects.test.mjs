import test from 'node:test';import assert from 'node:assert/strict';
import {defaultPillarEffects,validatePillarEffects,weatherTypes} from '../dist/pillar-effects.mjs';
import {validateRocks} from '../dist/rock-layout.mjs';
test('pillar effects accept supported modes and reject malformed persisted inputs',()=>{
 for(const weather of weatherTypes)assert.equal(validatePillarEffects({...defaultPillarEffects,weather}).weather,weather);
 for(const bad of [{weather:'script'},{fogSpeed:101},{fogDensity:-1},{weatherSpeed:1.5},{weatherDensity:'50'},{fogColour:'red'},{weatherColour:'url(x)'},{fog:'yes'}])assert.throws(()=>validatePillarEffects({...defaultPillarEffects,...bad}));
 const base={id:'a',style:'greek',size:'small',foreground:'none',pieceIds:['piece']};
 assert.deepEqual(validateRocks([base],['piece'],'pillars'),[base]);
 assert.throws(()=>validateRocks([{...base,effects:{...defaultPillarEffects,fogSpeed:999}}],['piece'],'pillars'));
});
