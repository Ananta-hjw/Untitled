import assert from 'node:assert/strict';
import test from 'node:test';
import { MANA } from '../src/config.ts';
import { addMana, maxManaForLevel, regenMana } from '../src/combat/mana.ts';

test('최대 마나는 레벨마다 오른다', () => {
  assert.equal(maxManaForLevel(1), MANA.base);
  assert.equal(maxManaForLevel(3), MANA.base + 2 * MANA.perLevel);
});

test('마나는 게임 시계로 저절로 차고 최대를 넘지 않는다', () => {
  assert.equal(regenMana(0, 30, 2000), MANA.regenPerSecond * 2);
  assert.equal(regenMana(29.9, 30, 10000), 30);
  assert.equal(regenMana(5, 30, -100), 5);
  assert.equal(addMana(29, 30, MANA.perHit), 30);
  assert.equal(addMana(3, 30, -10), 0);
});
