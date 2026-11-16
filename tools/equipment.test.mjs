import assert from 'node:assert/strict';
import test from 'node:test';
import { GEAR, GEAR_IDS, SLOT_IDS, buyGear, equip, gearBonus, sellGear, slotFor, startingGear, unequip } from '../src/items/equipment.ts';
import { CHARACTER_SAVE_VERSION, newCharacter, parseCharacter, serializeCharacter } from '../src/entities/characterData.ts';
import { allocate, zeroStats } from '../src/entities/attributes.ts';

test('장비 칸은 일곱 개이고, 처음에는 연습용 검과 낡은 수련복을 입고 있다', () => {
  assert.deepEqual(SLOT_IDS, ['weapon', 'head', 'body', 'hands', 'feet', 'accessory1', 'accessory2']);
  assert.deepEqual(startingGear().equipped, { weapon: 'practice-sword', body: 'worn-tunic' });
  assert.deepEqual(gearBonus(startingGear()), { str: 1, def: 1 });
  for (const id of GEAR_IDS) assert.ok(GEAR[id].name && Object.keys(GEAR[id].stats).length > 0, id);
});

test('사서 끼면 원래 장비는 가방으로 돌아가고, 벗을 수 있으며, 맞지 않는 칸에는 못 낀다', () => {
  const bought = buyGear({ gold: 1000, items: {} }, startingGear(), 'iron-sword');
  assert.equal(bought.inventory.gold, 1000 - GEAR['iron-sword'].price);
  const worn = equip(bought.gear, 'iron-sword');
  assert.equal(worn.equipped.weapon, 'iron-sword');
  assert.equal(worn.bag['practice-sword'], 1);
  assert.equal(worn.bag['iron-sword'], undefined);
  assert.equal(equip(worn, 'practice-sword', 'head'), null);
  const bare = unequip(worn, 'weapon');
  assert.equal(bare.equipped.weapon, undefined);
  assert.equal(bare.bag['iron-sword'], 1);
  assert.equal(unequip(bare, 'weapon'), null);
  assert.equal(buyGear({ gold: 10, items: {} }, startingGear(), 'iron-sword'), null);
  assert.equal(buyGear({ gold: 999, items: {} }, startingGear(), 'practice-sword'), null, '연습용 검은 팔지 않는다');
  const sold = sellGear({ gold: 0, items: {} }, bare, 'iron-sword');
  assert.equal(sold.inventory.gold, GEAR['iron-sword'].sellPrice);
  assert.equal(sellGear(sold.inventory, sold.gear, 'iron-sword'), null);
});

test('장신구는 빈 칸부터 두 칸에 낄 수 있다', () => {
  let gear = { bag: { 'clover-charm': 1, 'blue-bead': 1 }, equipped: {} };
  assert.equal(slotFor(gear, 'clover-charm'), 'accessory1');
  gear = equip(gear, 'clover-charm');
  assert.equal(slotFor(gear, 'blue-bead'), 'accessory2');
  gear = equip(gear, 'blue-bead');
  assert.deepEqual(gearBonus(gear), { luk: 3, int: 3 });
});

test('상태·장비 저장은 그대로 읽고, 깨진 값이나 받을 수 없는 포인트는 버린다', () => {
  const data = { alloc: allocate(zeroStats(), 'str', 2), gear: equip(buyGear({ gold: 999, items: {} }, startingGear(), 'light-boots').gear, 'light-boots') };
  assert.deepEqual(parseCharacter(serializeCharacter(data), 2), data);
  assert.deepEqual(parseCharacter(serializeCharacter(data), 1).alloc, zeroStats(), '레벨 1에는 포인트가 없다');
  assert.deepEqual(parseCharacter(null, 5), newCharacter());
  assert.deepEqual(parseCharacter('{oops', 5), newCharacter());
  const odd = JSON.stringify({ version: CHARACTER_SAVE_VERSION, alloc: { str: -3, luk: 'x' },
    gear: { bag: { 'iron-sword': 2, moon: 1, 'cloth-hood': -1 }, equipped: { head: 'iron-sword', weapon: 'iron-sword', toString: 'x' } } });
  assert.deepEqual(parseCharacter(odd, 5), { alloc: zeroStats(), gear: { bag: { 'iron-sword': 2 }, equipped: { weapon: 'iron-sword' } } });
});
