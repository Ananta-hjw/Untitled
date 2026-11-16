import assert from 'node:assert/strict';
import test from 'node:test';
import { MANA, SPIN_SLASH, VERTICAL_SPEED_RATIO } from '../src/config.ts';
import { addMana, inSpinRadius, maxManaForLevel, regenMana } from '../src/combat/mana.ts';

test('최대 마나는 레벨마다 오르고, 레벨 1에서 회전 베기를 두 번 쓸 수 있다', () => {
  assert.equal(maxManaForLevel(1), MANA.base);
  assert.equal(maxManaForLevel(3), MANA.base + 2 * MANA.perLevel);
  assert.ok(maxManaForLevel(1) >= SPIN_SLASH.cost * 2);
});

test('마나는 게임 시계로 저절로 차고 최대를 넘지 않는다', () => {
  assert.equal(regenMana(0, 30, 2000), MANA.regenPerSecond * 2);
  assert.equal(regenMana(29.9, 30, 10000), 30);
  assert.equal(regenMana(5, 30, -100), 5);
  assert.equal(addMana(29, 30, MANA.perHit), 30);
  assert.equal(addMana(3, 30, -10), 0);
});

test('회전 베기는 지면 타원 안의 적에게만 닿는다', () => {
  const r = SPIN_SLASH.radius;
  assert.equal(inSpinRadius(r - 1, 0, r, VERTICAL_SPEED_RATIO), true);
  assert.equal(inSpinRadius(r + 1, 0, r, VERTICAL_SPEED_RATIO), false);
  assert.equal(inSpinRadius(0, r * VERTICAL_SPEED_RATIO - 1, r, VERTICAL_SPEED_RATIO), true);
  assert.equal(inSpinRadius(0, r * VERTICAL_SPEED_RATIO + 1, r, VERTICAL_SPEED_RATIO), false);
});
