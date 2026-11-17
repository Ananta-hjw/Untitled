import assert from 'node:assert/strict';
import test from 'node:test';
import { RESONANCE } from '../src/config.ts';
import { resonanceTaken, canResonate, chargeOnParry, maxCharge, orbFill, parseCharge } from '../src/combat/resonance.ts';

test('패링 한 번에 구슬이 1/3씩 차고, 다섯 개(15번)가 가득 차면 더 늘지 않는다', () => {
  let charge = 0;
  charge = chargeOnParry(charge, RESONANCE);
  assert.deepEqual(orbFill(charge, RESONANCE).map(v => +v.toFixed(3)), [0.333, 0, 0, 0, 0]);
  for (let i = 0; i < 3; i++) charge = chargeOnParry(charge, RESONANCE);
  assert.deepEqual(orbFill(charge, RESONANCE).map(v => +v.toFixed(3)), [1, 0.333, 0, 0, 0]);
  for (let i = 0; i < 20; i++) charge = chargeOnParry(charge, RESONANCE);
  assert.equal(charge, maxCharge(RESONANCE));
  assert.deepEqual(orbFill(charge, RESONANCE), [1, 1, 1, 1, 1]);
});

test('공명은 구슬 다섯 개(패링 15번)가 다 차야 쓸 수 있고, 공명 중에는 다시 쓸 수 없다', () => {
  assert.equal(canResonate(3, RESONANCE, false), false);
  assert.equal(canResonate(14, RESONANCE, false), false);
  assert.equal(canResonate(15, RESONANCE, false), true);
  assert.equal(canResonate(15, RESONANCE, true), false);
});

test('공명 중 받는 피해는 80%(최소 1), 아니면 그대로', () => {
  assert.equal(resonanceTaken(10, true, RESONANCE), 8);
  assert.equal(resonanceTaken(1, true, RESONANCE), 1);
  assert.equal(resonanceTaken(10, false, RESONANCE), 10);
  assert.equal(RESONANCE.damageScale, 1.2);
  assert.equal(RESONANCE.durationMs, 10000);
});

test('이야기로 능력이 늘면(패링당 조각·시간) 같은 함수가 그 값을 따른다', () => {
  const stronger = { ...RESONANCE, perParry: 2 };
  assert.equal(chargeOnParry(0, stronger), 2);
});

test('저장된 게이지가 이상하면 0으로 읽는다', () => {
  assert.equal(parseCharge('7', RESONANCE), 7);
  assert.equal(parseCharge(null, RESONANCE), 0);
  assert.equal(parseCharge('99', RESONANCE), 0);
  assert.equal(parseCharge('1.5', RESONANCE), 0);
});
