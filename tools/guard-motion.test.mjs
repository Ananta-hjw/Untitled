import assert from 'node:assert/strict';
import test from 'node:test';
import { guardMotion } from '../src/entities/guardMotion.ts';

test('막기는 검을 세우고 발을 축으로 버틴 뒤 안정되며 좌우가 대칭이다', () => {
  assert.ok(guardMotion(0, 'right').swordAngle < -.1);
  assert.ok(guardMotion(120, 'right').swordAngle === 0);
  assert.ok(guardMotion(60, 'right').bodyAngle > guardMotion(240, 'right').bodyAngle);
  assert.notEqual(guardMotion(400, 'right').bodyAngle, guardMotion(800, 'right').bodyAngle);
  for (const t of [0, 30, 60, 100, 180, 250, 600, 1200]) {
    const r = guardMotion(t, 'down-right'), l = guardMotion(t, 'down-left');
    assert.equal(l.bodyAngle, -r.bodyAngle);
    assert.equal(l.swordAngle, r.swordAngle);
    assert.ok(Math.abs(r.bodyAngle) < .03);
    for (const facing of ['up', 'down']) assert.equal(guardMotion(t, facing).bodyAngle, 0);
  }
});
