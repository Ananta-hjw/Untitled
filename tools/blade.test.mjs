import assert from 'node:assert/strict';
import test from 'node:test';
import { attackBladeSweep, bladeHitsEllipse, clipBladeSweep } from '../src/combat/blade.ts';

const blade = (x, y) => ({ base: { x, y }, tip: { x: x + 50, y } });

test('검날에 닿는 몸통만 맞고, 기존 고정 범위 안이어도 검에서 멀면 빗나간다', () => {
  const current = blade(0, 0);
  assert.equal(bladeHitsEllipse(current, current, { x: 40, y: 0 }, 8, 12), true);
  assert.equal(bladeHitsEllipse(current, current, { x: 100, y: 0 }, 8, 12), false);
  assert.equal(bladeHitsEllipse(current, current, { x: 40, y: 30 }, 8, 12), false);
  assert.equal(bladeHitsEllipse(current, current, { x: -20, y: 0 }, 8, 12), false);
});

test('저프레임에서 검날이 몸통을 건너뛰어도 지나간 영역으로 명중한다', () => {
  assert.equal(bladeHitsEllipse(blade(0, -30), blade(0, 30), { x: 25, y: 0 }, 5, 5), true);
  assert.equal(bladeHitsEllipse(blade(0, -30), blade(0, 30), { x: 65, y: 0 }, 5, 5), false);
});

test('좌우 반전과 월드 좌표 이동 후에도 같은 위치 관계로 명중한다', () => {
  const transform = (b) => ({
    base: { x: 1000 - b.base.x, y: 600 + b.base.y },
    tip: { x: 1000 - b.tip.x, y: 600 + b.tip.y },
  });
  assert.equal(bladeHitsEllipse(transform(blade(0, -30)), transform(blade(0, 30)),
    { x: 975, y: 600 }, 5, 5), true);
});

test('시작 전·종료 후의 이동을 잘라 유효 시간 안의 궤적만 명중에 사용한다', () => {
  const sweep = clipBladeSweep(blade(0, -100), blade(0, 100), 0, 100, 25, 75);
  assert.deepEqual(sweep.previous, blade(0, -50));
  assert.deepEqual(sweep.current, blade(0, 50));
  assert.equal(bladeHitsEllipse(sweep.previous, sweep.current, { x: 25, y: -75 }, 5, 5), false);
  assert.equal(bladeHitsEllipse(sweep.previous, sweep.current, { x: 25, y: 75 }, 5, 5), false);
  assert.equal(bladeHitsEllipse(sweep.previous, sweep.current, { x: 25, y: 0 }, 5, 5), true);
});

test('유효 구간 밖의 프레임과 중복 시간은 무시하고 정확한 시작·종료 경계를 포함한다', () => {
  const a = blade(0, 0), b = blade(0, 100);
  assert.equal(clipBladeSweep(a, b, 0, 24, 25, 75), undefined);
  assert.equal(clipBladeSweep(a, b, 75, 100, 25, 75), undefined);
  assert.equal(clipBladeSweep(a, b, 30, 30, 25, 75), undefined);
  assert.deepEqual(clipBladeSweep(a, b, 0, 25, 25, 75).current, b);
  assert.deepEqual(clipBladeSweep(a, b, 25, 75, 25, 75).current, b);
});

test('찌르는 자세로 바뀌는 순간의 근거리 궤적을 늦은 명중 시각으로 잘라 버리지 않는다', () => {
  const before = blade(0, -30), after = blade(0, 30);
  assert.equal(clipBladeSweep(before, after, 166, 175, 180, 235), undefined);
  const sweep = attackBladeSweep(before, after, 166, 175, 168, 235);
  assert.equal(sweep.start, 168);
  assert.equal(bladeHitsEllipse(sweep.previous, sweep.current, { x: 25, y: 0 }, 5, 5), true);
});

test('올려 베기의 전환 시각과 프레임 끝이 같아도 검이 지나간 몸통을 한 번 판정한다', () => {
  const before = blade(0, -30), after = blade(0, 30);
  const sweep = attackBladeSweep(before, after, 100, 105, 105, 160);
  assert.equal(bladeHitsEllipse(sweep.previous, sweep.current, { x: 25, y: 0 }, 5, 5), true);
  const next = attackBladeSweep(after, after, 105, 110, 105, 160);
  assert.equal(bladeHitsEllipse(next.previous, next.current, { x: 25, y: 0 }, 5, 5), false);
  assert.equal(attackBladeSweep(before, after, 105, 105, 105, 160), undefined);
});

test('자세 전환 보정은 타격 전이나 종료 후로 번지지 않고 부동소수점 경계를 놓치지 않는다', () => {
  const before = blade(0, -100), after = blade(0, 100);
  assert.equal(attackBladeSweep(before, after, 80, 104, 105, 160), undefined);
  assert.equal(attackBladeSweep(before, after, 160, 180, 105, 160), undefined);
  const clipped = attackBladeSweep(before, after, 100, 200, 105, 160);
  assert.equal(clipped.end, 160);
  assert.equal(bladeHitsEllipse(clipped.previous, clipped.current, { x: 25, y: 90 }, 5, 5), false);
  const edge = attackBladeSweep(blade(0, -30), blade(0, 30), 100, 105 - 1e-8, 105, 160);
  assert.equal(bladeHitsEllipse(edge.previous, edge.current, { x: 25, y: 0 }, 5, 5), true);
  const next = attackBladeSweep(blade(0, 30), blade(0, 30), 105 - 1e-8, 110, 105, 160);
  assert.equal(bladeHitsEllipse(next.previous, next.current, { x: 25, y: 0 }, 5, 5), false);
});
