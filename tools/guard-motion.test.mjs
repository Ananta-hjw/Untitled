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
    assert.equal(l.scaleX, r.scaleX);
    assert.equal(l.scaleY, r.scaleY);
    assert.ok(Math.abs(r.bodyAngle) < .03);
    for (const facing of ['up', 'down']) assert.equal(guardMotion(t, facing).bodyAngle, 0);
  }
});

test('막기 착지 압축·패링 반동·차지 패링 웅크림과 방출 자세가 뚜렷하게 구분된다', () => {
  // 막기 시작 직후 무릎 착지 압축 후 100ms에 원복
  const drop = guardMotion(45, 'right');
  const settled = guardMotion(100, 'right');
  assert.ok(drop.scaleX > 1.03 && drop.scaleY < 0.96 && drop.offsetY > 1);
  assert.equal(settled.scaleX, 1);
  assert.equal(settled.scaleY, 1);
  assert.equal(settled.offsetY, 0);

  // 패링 반동은 검과 몸통에 뚜렷한 탄성 충격을 준다
  const recoil = guardMotion(120, 'right', 10, 'guard');
  assert.ok(recoil.swordAngle < -0.2);
  assert.ok(recoil.scaleX > 1.04 && recoil.scaleY < 0.96);

  // 차지 패링 충전은 낮게 웅크리며 검을 아래로 감고, 준비 완료 시 미세한 진동이 생긴다
  const charge = guardMotion(140, 'right', undefined, 'charging');
  const chargeLeft = guardMotion(140, 'left', undefined, 'charging');
  assert.ok(charge.swordAngle > 0.4, '차지 패링 충전 시 검을 낮게 눕힌다');
  assert.ok(charge.scaleX > 1.06 && charge.scaleY < 0.93 && charge.offsetY >= 4.5);
  assert.equal(chargeLeft.bodyAngle, -charge.bodyAngle);
  const readyA = guardMotion(200, 'right', undefined, 'chargeReady');
  const readyB = guardMotion(235, 'right', undefined, 'chargeReady');
  assert.notEqual(readyA.swordAngle, readyB.swordAngle, '차지 패링 완료 대기 시 미세 떨림');

  // 차지 패링 방출은 상체와 검을 위로 터뜨린다
  const release = guardMotion(180, 'right', 10, 'unboundRelease');
  assert.ok(release.swordAngle < -0.35 && release.scaleY > 1.04 && release.offsetY < 0);
});
