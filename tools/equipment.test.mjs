import assert from 'node:assert/strict';
import test from 'node:test';
import { GEAR, GEAR_IDS, SLOT_IDS, addGear, buyGear, equip, gearBonus, sellGear, slotFor, startingGear, unequip } from '../src/items/equipment.ts';
import { CHARACTER_SAVE_VERSION, newCharacter, parseCharacter, serializeCharacter } from '../src/entities/characterData.ts';
import { allocate, zeroStats } from '../src/entities/attributes.ts';

test('장비 칸은 일곱 개이고, 처음에는 나무검과 낡은 수련복을 입고 있다', () => {
  assert.deepEqual(SLOT_IDS, ['weapon', 'head', 'body', 'hands', 'feet', 'accessory1', 'accessory2']);
  assert.deepEqual(startingGear().equipped, { weapon: 'wooden-sword', body: 'worn-tunic' });
  assert.deepEqual(gearBonus(startingGear()), { str: 1, def: 1 });
  for (const id of GEAR_IDS) assert.ok(GEAR[id].name && Object.keys(GEAR[id].stats).length > 0, id);
});

test('사서 끼면 원래 장비는 가방으로 돌아가고, 벗을 수 있으며, 맞지 않는 칸에는 못 낀다', () => {
  // 철검은 팔지 않고 도란이 건넨다(퀘스트 보상으로 가방에 들어온다).
  assert.equal(buyGear({ gold: 1000, items: {} }, startingGear(), 'iron-sword'), null);
  const bought = { gear: addGear(startingGear(), 'iron-sword') };
  const armor = buyGear({ gold: 1000, items: {} }, startingGear(), 'leather-armor');
  assert.equal(armor.inventory.gold, 1000 - GEAR['leather-armor'].price);
  const worn = equip(bought.gear, 'iron-sword');
  assert.equal(worn.equipped.weapon, 'iron-sword');
  assert.equal(worn.bag['wooden-sword'], 1);
  assert.equal(worn.bag['iron-sword'], undefined);
  assert.equal(equip(worn, 'wooden-sword', 'head'), null);
  const bare = unequip(worn, 'weapon');
  assert.equal(bare.equipped.weapon, undefined);
  assert.equal(bare.bag['iron-sword'], 1);
  assert.equal(unequip(bare, 'weapon'), null);
  assert.equal(buyGear({ gold: 10, items: {} }, startingGear(), 'leather-armor'), null);
  assert.equal(buyGear({ gold: 999, items: {} }, startingGear(), 'wooden-sword'), null, '나무검은 팔지 않는다');
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

test('예전 저장의 연습용 검은 나무검으로 읽는다', () => {
  const old = JSON.stringify({ version: CHARACTER_SAVE_VERSION, alloc: {}, gear: { bag: { 'practice-sword': 1 }, equipped: { weapon: 'practice-sword' } } });
  assert.deepEqual(parseCharacter(old, 1).gear, { bag: { 'wooden-sword': 1 }, equipped: { weapon: 'wooden-sword' } });
});

test('대장간의 짧은 검·긴 검은 살 수 있고 나무검 < 짧은 검 < 긴 검 < 철검 순으로 강하다. 철검은 살 수 없다', () => {
  const bought = buyGear({ gold: 200, items: {} }, startingGear(), 'short-sword');
  assert.equal(bought.inventory.gold, 200 - GEAR['short-sword'].price);
  assert.ok(GEAR['wooden-sword'].stats.str < GEAR['short-sword'].stats.str);
  assert.ok(GEAR['short-sword'].stats.str < GEAR['long-sword'].stats.str);
  assert.ok(GEAR['long-sword'].stats.str < GEAR['iron-sword'].stats.str);
  assert.equal(GEAR['long-sword'].stats.str, 4);
  assert.equal(GEAR['iron-sword'].stats.str, 6);
  assert.ok(buyGear({ gold: 1000, items: {} }, startingGear(), 'long-sword'));
  assert.equal(GEAR['iron-sword'].price, undefined);
  assert.equal(buyGear({ gold: 99999, items: {} }, startingGear(), 'iron-sword'), null);
});

test('무기 칸에 낄 수 있는 모든 검은 주인공 그림의 무기 모양이 있다', async () => {
  const { weaponId } = await import('../src/entities/weaponPose.ts');
  for (const id of GEAR_IDS.filter((id) => GEAR[id].kind === 'weapon')) assert.ok(weaponId(id), id);
});

test('여행자의 망토는 페른이 팔고 도란의 대장간에는 없다', async () => {
  const { GEAR, gearForSale, buyGear } = await import('../src/items/equipment.ts');
  const { emptyInventory, addGold } = await import('../src/items/inventory.ts');
  assert.deepEqual(gearForSale('fern'), ['travel-cloak']);
  assert.ok(!gearForSale('doran').includes('travel-cloak'));
  assert.ok(gearForSale('doran').includes('short-sword'));
  assert.deepEqual(GEAR['travel-cloak'].stats, { def: 2, dex: 2 });
  const gear = { equipped: {}, bag: {} };
  const rich = addGold(emptyInventory(), 500);
  assert.equal(buyGear(rich, gear, 'travel-cloak'), null, '대장간에서는 못 산다');
  assert.equal(buyGear(rich, gear, 'travel-cloak', 'fern').inventory.gold, 280);
});
