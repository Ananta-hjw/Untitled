import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { weaponId, weaponPose } from '../src/entities/weaponPose.ts';
const data=JSON.parse(readFileSync(new URL('../src/assets/hero/academy/frames.json',import.meta.url)));
test('착용 가능한 검만 외형으로 연결하고 전투 기준점은 그대로 유지한다',()=>{
  assert.equal(weaponId('wooden-sword'),'wooden-sword');assert.equal(weaponId('iron-sword'),'iron-sword');
  assert.equal(weaponId(undefined),null);assert.equal(weaponId('cloth-hood'),null);
  // 대장간의 짧은 검·긴 검은 그림이 생길 때까지 철검 모양으로 그린다(맨손이 되면 칼날 판정도 사라진다).
  assert.equal(weaponId('short-sword'),'iron-sword');assert.equal(weaponId('long-sword'),'iron-sword');
  for(const f of data.frames){
    const p=weaponPose(f);assert.equal(p.sheathed,f.blade===null);
    if(f.blade)assert.deepEqual(p.blade,f.blade);
    for(const point of [p.blade.base,p.blade.tip])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
    assert.ok(Math.hypot(p.blade.tip.x-p.blade.base.x,p.blade.tip.y-p.blade.base.y)>0);
  }
});
