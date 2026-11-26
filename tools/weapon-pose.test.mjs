import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { weaponId, weaponLengthScale, weaponPose, weaponVisualForRank } from '../src/entities/weaponPose.ts';
const data=JSON.parse(readFileSync(new URL('../src/assets/hero/academy/frames.json',import.meta.url)));
test('착용 가능한 검만 외형으로 연결하고 승급 단계별 외형과 전투 기준점을 유지한다',()=>{
  assert.equal(weaponId('wooden-sword'),'wooden-sword');assert.equal(weaponId('iron-sword'),'iron-sword');
  assert.equal(weaponId(undefined),null);assert.equal(weaponId('cloth-hood'),null);
  assert.equal(weaponId('short-sword'),'short-sword');assert.equal(weaponId('long-sword'),'long-sword');
  assert.equal(weaponVisualForRank(0),'wooden-sword');
  assert.equal(weaponVisualForRank(1),'iron-sword');
  assert.equal(weaponVisualForRank(2),'long-sword');
  assert.ok(weaponLengthScale('short-sword') < weaponLengthScale('iron-sword'));
  assert.ok(weaponLengthScale('long-sword') > weaponLengthScale('iron-sword'));
  for(const f of data.frames){
    const p=weaponPose(f);assert.equal(p.sheathed,f.blade===null);
    if(f.blade)assert.deepEqual(p.blade,f.blade);
    for(const point of [p.blade.base,p.blade.tip])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
    assert.ok(Math.hypot(p.blade.tip.x-p.blade.base.x,p.blade.tip.y-p.blade.base.y)>0);
  }
});
