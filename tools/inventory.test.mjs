import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ITEMS, MAX_STACK, addGold, addItem, applyDrop, bestHealItem, buy, countOf, emptyInventory, parseInventory,
  removeItem, sell, serializeInventory, slimeDrop, useItem,
} from '../src/items/inventory.ts';
import { QUESTS } from '../src/story/quests.ts';

test('아이템을 넣고 빼고, 한 칸은 최대 개수를 넘지 않는다', () => {
  let inv = addItem(emptyInventory(), 'potion', 3);
  assert.equal(countOf(inv, 'potion'), 3);
  inv = removeItem(inv, 'potion', 2);
  assert.equal(countOf(inv, 'potion'), 1);
  assert.equal(removeItem(inv, 'potion', 2), null);
  assert.deepEqual(removeItem(inv, 'potion').items, {}, '다 쓰면 칸이 사라진다');
  assert.equal(countOf(addItem(inv, 'potion', 500), 'potion'), MAX_STACK);
  assert.equal(addGold(emptyInventory(), -10).gold, 0);
});

test('물약은 모자란 체력만큼만 채우고, 체력이 가득하거나 없으면 쓰지 않는다', () => {
  const inv = addItem(emptyInventory(), 'potion', 1);
  assert.deepEqual(useItem(inv, 'potion', 40, 100), { inventory: emptyInventory(), heal: 50 });
  assert.equal(useItem(inv, 'potion', 80, 100).heal, 20);
  assert.equal(useItem(inv, 'potion', 100, 100), null);
  assert.equal(useItem(inv, 'potion', 0, 100), null, '쓰러진 뒤에는 못 쓴다');
  assert.equal(useItem(emptyInventory(), 'potion', 10, 100), null);
  assert.equal(useItem(addItem(emptyInventory(), 'slime-gel'), 'slime-gel', 10, 100), null, '재료는 못 쓴다');
});

test('빠른 사용은 모자란 체력에 알맞은 회복 아이템을 고른다', () => {
  const both = addItem(addItem(emptyInventory(), 'potion', 2), 'lunch', 1);
  assert.equal(bestHealItem(both, 30), 'potion');
  assert.equal(bestHealItem(both, 120), 'lunch');
  assert.equal(bestHealItem(addItem(emptyInventory(), 'potion'), 120), 'potion', '큰 것이 없으면 있는 것');
  assert.equal(bestHealItem(addItem(emptyInventory(), 'slime-gel'), 30), undefined);
});

test('잡화점: 골드가 있으면 사고, 모자라면 못 사고, 재료는 판다', () => {
  let inv = addGold(emptyInventory(), 50);
  inv = buy(inv, 'potion', 2);
  assert.deepEqual([inv.gold, countOf(inv, 'potion')], [50 - ITEMS.potion.price * 2, 2]);
  assert.equal(buy(inv, 'lunch'), null, '골드가 모자라다');
  assert.equal(buy(inv, 'slime-gel'), null, '팔지 않는 물건');
  inv = sell(addItem(inv, 'slime-gel', 3), 'slime-gel', 3);
  assert.equal(inv.gold, 10 + ITEMS['slime-gel'].sellPrice * 3);
  assert.equal(sell(inv, 'slime-gel'), null);
});

test('슬라임은 골드 3~6과 가끔 점액을 떨어뜨린다', () => {
  assert.deepEqual(slimeDrop(() => 0), { gold: 3, items: [{ id: 'slime-gel', count: 1 }, { id: 'potion', count: 1 }] });
  assert.deepEqual(slimeDrop(() => 0.99), { gold: 6, items: [] });
  const inv = applyDrop(emptyInventory(), slimeDrop(() => 0));
  assert.deepEqual(inv, { gold: 3, items: { 'slime-gel': 1, potion: 1 } });
});

test('퀘스트 보상의 아이템은 모두 있는 아이템이다', () => {
  for (const q of QUESTS) for (const item of q.rewardItems ?? []) assert.ok(ITEMS[item.id] && item.count > 0, q.id);
  assert.ok(QUESTS.some((q) => q.rewardGold > 0));
});

test('가방은 저장했다가 그대로 불러오고, 깨진 값은 버린다', () => {
  const inv = { gold: 123, items: { potion: 4, 'slime-gel': 2 } };
  assert.deepEqual(parseInventory(serializeInventory(inv)), inv);
  assert.deepEqual(parseInventory(null), emptyInventory());
  assert.deepEqual(parseInventory('nope'), emptyInventory());
  assert.deepEqual(parseInventory(JSON.stringify({ version: 2, gold: 5, items: {} })), emptyInventory());
  assert.deepEqual(parseInventory(JSON.stringify({ version: 1, gold: -5, items: { potion: 1000, sword: 1, lunch: 0, 'slime-gel': 1.5 } })),
    { gold: 0, items: { potion: MAX_STACK } });
});
