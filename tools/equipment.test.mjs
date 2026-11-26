import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCESSORY_SLOT_IDS, ARMOR_SLOT_IDS, ENHANCE_SLOT_IDS, GEAR, GEAR_IDS, MAX_RANK, PROMOTION_STAGES, SLOT_IDS,
  addGear, armorAppearanceLabel, armorAppearanceRank, armorPromotionStatus, buyGear, canAffordPromotion, canSmithyWork,
  enhanceCost, enhanceSlot, equip, gearBonus, gearForSale, grantSlotRank, isArmorSlot, isEnhanceSlot,
  promoteSlotWithCost, promotionRecipe, rankLabel, sellGear, slotDisplayName, slotFor, slotIconId, slotStats,
  startingGear, unequip, weaponAppearanceLabel, zeroSlotLevels,
} from '../src/items/equipment.ts';
import { CHARACTER_SAVE_VERSION, newCharacter, parseCharacter, serializeCharacter } from '../src/entities/characterData.ts';
import { allocate, zeroStats } from '../src/entities/attributes.ts';
import { emptyInventory, addGold, addItem, countOf, enemyDrop } from '../src/items/inventory.ts';
import { weaponVisualForRank } from '../src/entities/weaponPose.ts';
import { QUESTS } from '../src/story/quests.ts';

test('장비 칸은 기본 5칸(강화·승급 분리) + 장신구 2칸이며, 시작 보너스는 STR +1, DEF +1이다', () => {
  assert.deepEqual(SLOT_IDS, ['weapon', 'head', 'body', 'hands', 'feet', 'accessory1', 'accessory2']);
  assert.deepEqual(ENHANCE_SLOT_IDS, ['weapon', 'head', 'body', 'hands', 'feet']);
  assert.deepEqual(ARMOR_SLOT_IDS, ['head', 'body', 'hands', 'feet']);
  assert.deepEqual(ACCESSORY_SLOT_IDS, ['accessory1', 'accessory2']);
  for (const s of ENHANCE_SLOT_IDS) assert.equal(isEnhanceSlot(s), true);
  for (const s of ARMOR_SLOT_IDS) assert.equal(isArmorSlot(s), true);
  assert.equal(isArmorSlot('weapon'), false);
  for (const s of ACCESSORY_SLOT_IDS) assert.equal(isEnhanceSlot(s), false);
  assert.deepEqual(startingGear().enhance, zeroSlotLevels());
  assert.deepEqual(startingGear().rank, zeroSlotLevels());
  assert.deepEqual(startingGear().equipped, {});
  assert.deepEqual(gearBonus(startingGear()), { str: 1, def: 1 });
  for (const id of GEAR_IDS) {
    assert.equal(GEAR[id].kind, 'accessory', id);
    assert.ok(GEAR[id].name && Object.keys(GEAR[id].stats).length > 0, id);
  }
});

test('강화는 골드만 필요하고 상한이 없으며 높을수록 비용이 커지고, 능력치만 오르며 외형은 바뀌지 않는다', () => {
  assert.equal(canSmithyWork('doran'), true);
  assert.equal(canSmithyWork('marta'), true);
  assert.equal(canSmithyWork('fern'), false);

  // 모든 강화 단계에서 비용이 엄격하게 증가하며 상한이 없다
  for (const slot of ENHANCE_SLOT_IDS) {
    let prev = 0;
    for (let lv = 0; lv < 35; lv++) {
      const cost = enhanceCost(slot, lv);
      assert.ok(cost > prev, `${slot} +${lv} 비용(${cost}) > 이전(${prev})`);
      prev = cost;
    }
  }

  let inv = addGold(emptyInventory(), 500_000);
  let gear = startingGear();
  // 페른에서는 강화 불가, 골드 부족 시 불가
  assert.equal(enhanceSlot(inv, gear, 'weapon', 'fern'), null);
  assert.equal(enhanceSlot({ gold: 10, items: {} }, gear, 'weapon', 'doran'), null);

  // 도란의 대장간에서 상한 없이 +30까지 강화 가능(재료 0개, 골드만 소모)
  for (let lv = 0; lv < 30; lv++) {
    const res = enhanceSlot(inv, gear, 'weapon', 'doran');
    assert.ok(res, `weapon +${lv + 1}`);
    assert.equal(res.level, lv + 1);
    inv = res.inventory;
    gear = res.gear;
  }
  assert.equal(gear.enhance.weapon, 30);
  assert.equal(gear.rank.weapon, 0, '강화만으로는 승급 단계가 오르지 않는다');
  assert.equal(weaponVisualForRank(gear.rank.weapon), 'wooden-sword', '강화만으로는 칼 외형이 바뀌지 않는다');
  assert.equal(slotIconId('weapon', gear.rank.weapon), 'wooden-sword');
  assert.equal(gearBonus(gear).str, 31, '강화는 능력치만 올린다');
});

test('승급은 골드+재료가 모두 필요하며, 무기 승급 시 즉시 외형이 바뀐다(1단계=도란의 검, 2~5단계=N단계 진화)', () => {
  assert.deepEqual(
    PROMOTION_STAGES.map(s => [s.rank, s.label]),
    [[0, '기본'], [1, '1단계 진화'], [2, '2단계 진화'], [3, '3단계 진화'], [4, '4단계 진화'], [5, '5단계 진화']],
  );
  assert.match(weaponAppearanceLabel(1), /도란의 검/);
  assert.match(weaponAppearanceLabel(2), /2단계 진화/);
  assert.equal(rankLabel(MAX_RANK), '5단계 진화');

  const gear0 = startingGear();
  const recipe1 = promotionRecipe('weapon', 0);
  assert.ok(recipe1 && recipe1.gold > 0 && recipe1.materials.length > 0);
  // 골드만 있고 재료가 없으면 승급 불가
  const goldOnly = addGold(emptyInventory(), 10_000);
  assert.equal(canAffordPromotion(goldOnly, 'weapon', 0), false);
  assert.equal(promoteSlotWithCost(goldOnly, gear0, 'weapon', 'doran'), null);

  // 재료만 있고 골드가 부족하면 승급 불가
  let matsOnly = emptyInventory();
  for (const m of recipe1.materials) matsOnly = addItem(matsOnly, m.id, m.count);
  assert.equal(canAffordPromotion(matsOnly, 'weapon', 0), false);
  assert.equal(promoteSlotWithCost(matsOnly, gear0, 'weapon', 'doran'), null);

  // 골드 + 재료가 모두 충분하면 승급 성공, 재료·골드 차감 및 외형 변경
  let inv = addGold(matsOnly, recipe1.gold + 500);
  const res1 = promoteSlotWithCost(inv, gear0, 'weapon', 'doran');
  assert.ok(res1);
  assert.equal(res1.rank, 1);
  assert.equal(res1.appearanceChanged, true);
  assert.equal(res1.inventory.gold, 500);
  for (const m of recipe1.materials) assert.equal(countOf(res1.inventory, m.id), 0);
  assert.equal(weaponVisualForRank(res1.gear.rank.weapon), 'iron-sword');
  assert.equal(gearBonus(res1.gear).str, 6);
  assert.match(slotDisplayName('weapon', 0, 1), /무기 \+0 · 1단계 진화/);

  // 2단계 승급
  const recipe2 = promotionRecipe('weapon', 1);
  let inv2 = addGold(emptyInventory(), recipe2.gold);
  for (const m of recipe2.materials) inv2 = addItem(inv2, m.id, m.count);
  const res2 = promoteSlotWithCost(inv2, res1.gear, 'weapon', 'marta');
  assert.ok(res2);
  assert.equal(res2.rank, 2);
  assert.equal(res2.appearanceChanged, true);
  assert.equal(weaponVisualForRank(res2.gear.rank.weapon), 'long-sword');

  // 5단계(최대 승급) 이후에는 추가 승급 불가
  assert.equal(promotionRecipe('weapon', MAX_RANK), null);
});

test('방어구 외형은 머리·몸·장갑·신발 4부위의 승급이 모두 같아질 때(전부 1, 전부 2...)마다 바뀐다', () => {
  let gear = startingGear();
  let inv = addGold(emptyInventory(), 50_000);
  inv = addItem(inv, 'iron-shard', 50);
  inv = addItem(inv, 'slime-gel', 50);
  inv = addItem(inv, 'bronze-ingot', 50);

  // 3부위만 1단계로 승급하면 방어구 외형은 아직 0(기본)
  for (const slot of ['head', 'body', 'hands']) {
    const res = promoteSlotWithCost(inv, gear, slot, 'doran');
    assert.ok(res);
    assert.equal(res.appearanceChanged, false, `${slot}만 올려서는 아직 방어구 외형 변화 없음`);
    assert.equal(armorAppearanceRank(res.gear), 0);
    inv = res.inventory;
    gear = res.gear;
  }
  const midStatus = armorPromotionStatus(gear);
  assert.equal(midStatus.stage, 0);
  assert.equal(midStatus.nextStage, 1);
  assert.equal(midStatus.readyCount, 3);
  assert.deepEqual(midStatus.missing, ['feet']);

  // 마지막 신발까지 1단계 승급 -> 4부위 전부 1단계! 방어구 외형 1단계 진화 해금!
  const fourth = promoteSlotWithCost(inv, gear, 'feet', 'doran');
  assert.ok(fourth);
  assert.equal(fourth.appearanceChanged, true);
  assert.equal(fourth.armorStage, 1);
  assert.equal(armorAppearanceRank(fourth.gear), 1);
  assert.match(armorAppearanceLabel(1), /1단계 진화/);
  inv = fourth.inventory;
  gear = fourth.gear;

  // 몸통만 2단계로 먼저 올려도 아직 1단계 외형 유지
  const body2 = promoteSlotWithCost(inv, gear, 'body', 'marta');
  assert.ok(body2);
  assert.equal(body2.appearanceChanged, false);
  assert.equal(armorAppearanceRank(body2.gear), 1);
  inv = body2.inventory;
  gear = body2.gear;

  // 나머지 3부위(머리·장갑·신발)까지 전부 2단계가 되는 순간 2단계 진화 외형 해금!
  for (const [idx, slot] of ['head', 'hands', 'feet'].entries()) {
    const res = promoteSlotWithCost(inv, gear, slot, 'marta');
    assert.ok(res);
    assert.equal(res.appearanceChanged, idx === 2);
    assert.equal(armorAppearanceRank(res.gear), idx === 2 ? 2 : 1);
    inv = res.inventory;
    gear = res.gear;
  }
});

test('1장 끝 도란의 검 퀘스트만 무기 1단계 무료 승급(도란의 검 외형)을 부여하고, 2장에는 승급 이벤트가 없다', () => {
  const promoteQuests = QUESTS.filter(q => q.rewardPromote && q.rewardPromote.length > 0);
  assert.deepEqual(promoteQuests.map(q => q.id), ['first-sword']);
  assert.deepEqual(promoteQuests[0].rewardPromote, [{ slot: 'weapon', targetRank: 1 }]);

  const granted = grantSlotRank(startingGear(), 'weapon', 1);
  assert.equal(granted.rank, 1);
  assert.equal(granted.appearanceChanged, true);
  assert.equal(weaponVisualForRank(granted.gear.rank.weapon), 'iron-sword');
  assert.equal(gearBonus(granted.gear).str, 6);

  // 몬스터 전리품에서 승급 재료를 얻을 수 있다
  assert.ok(enemyDrop('corrosion-executioner', () => 0.5).items.some(i => i.id === 'iron-shard'));
  assert.ok(enemyDrop('swamp-lurker', () => 0.5).items.some(i => i.id === 'bronze-ingot'));
});

test('장신구는 구매·판매·착용·해제가 되고 빈 장신구 칸부터 들어간다. 기본 5칸에는 끼거나 벗을 수 없다', () => {
  const rich = addGold(emptyInventory(), 1000);
  const bought1 = buyGear(rich, startingGear(), 'clover-charm', 'doran');
  assert.equal(bought1.inventory.gold, 1000 - GEAR['clover-charm'].price);
  const bought2 = buyGear(bought1.inventory, bought1.gear, 'blue-bead', 'doran');
  assert.equal(slotFor(bought2.gear, 'clover-charm'), 'accessory1');
  assert.equal(equip(bought2.gear, 'clover-charm', 'weapon'), null);
  assert.equal(unequip(bought2.gear, 'weapon'), null);

  let worn = equip(bought2.gear, 'clover-charm');
  assert.equal(worn.equipped.accessory1, 'clover-charm');
  assert.equal(slotFor(worn, 'blue-bead'), 'accessory2');
  worn = equip(worn, 'blue-bead');
  assert.equal(worn.equipped.accessory2, 'blue-bead');
  assert.deepEqual(gearBonus(worn), { str: 1, def: 1, luk: 3, int: 3 });

  const removed = unequip(worn, 'accessory1');
  assert.equal(removed.equipped.accessory1, undefined);
  assert.equal(removed.bag['clover-charm'], 1);
  const sold = sellGear({ gold: 0, items: {} }, removed, 'clover-charm');
  assert.equal(sold.inventory.gold, GEAR['clover-charm'].sellPrice);
  assert.equal(sellGear(sold.inventory, sold.gear, 'clover-charm'), null);
});

test('리네아의 들꽃 팔찌는 장신구 칸에 끼워 VIT +2를 얻고 상점에서 사거나 팔 수 없다', () => {
  assert.equal(GEAR['wildflower-bracelet'].kind, 'accessory');
  assert.deepEqual(GEAR['wildflower-bracelet'].stats, { vit: 2 });
  assert.equal(GEAR['wildflower-bracelet'].price, undefined);
  const bag = addGear(startingGear(), 'wildflower-bracelet');
  assert.equal(buyGear({ gold: 9999, items: {} }, bag, 'wildflower-bracelet'), null);
  assert.equal(sellGear({ gold: 0, items: {} }, bag, 'wildflower-bracelet'), null, '기념품 장신구는 팔 수 없다');
  const worn = equip(bag, 'wildflower-bracelet');
  assert.equal(worn.equipped.accessory1, 'wildflower-bracelet');
  assert.equal(gearBonus(worn).vit, 2);
});

test('상점별 장신구: 도란(1장 부적), 마르타(청동 방울 귀걸이), 페른(갈대 매듭 팔찌)이 분리된다', () => {
  assert.deepEqual(gearForSale('doran'), ['clover-charm', 'blue-bead']);
  assert.deepEqual(gearForSale('marta'), ['bronze-bell-earring']);
  assert.deepEqual(gearForSale('fern'), ['reed-knot-bracelet']);
  const rich = addGold(emptyInventory(), 2000), gear = startingGear();
  assert.equal(buyGear(rich, gear, 'bronze-bell-earring', 'doran'), null);
  assert.equal(buyGear(rich, gear, 'bronze-bell-earring', 'fern'), null);
  assert.equal(buyGear(rich, gear, 'bronze-bell-earring', 'marta').gear.bag['bronze-bell-earring'], 1);
  assert.equal(buyGear(rich, gear, 'reed-knot-bracelet', 'doran'), null);
  assert.equal(buyGear(rich, gear, 'reed-knot-bracelet', 'fern').gear.bag['reed-knot-bracelet'], 1);
});

test('상태·장비 저장은 무제한 강화와 승급 단계·장신구를 유지하고 예전 저장도 호환 변환한다', () => {
  let g = grantSlotRank(startingGear(), 'weapon', 1).gear;
  g = { ...g, enhance: { ...g.enhance, weapon: 35, feet: 12 } };
  g = equip(addGear(g, 'wildflower-bracelet'), 'wildflower-bracelet');
  const data = { alloc: allocate(zeroStats(), 'str', 2), gear: g };
  assert.deepEqual(parseCharacter(serializeCharacter(data), 2), data);
  assert.deepEqual(parseCharacter(serializeCharacter(data), 1).alloc, zeroStats(), '레벨 1에는 포인트가 없다');
  assert.deepEqual(parseCharacter(null, 5), newCharacter());
  assert.deepEqual(parseCharacter('{oops', 5), newCharacter());

  // 깨진 값은 안전하게 걸러 낸다 (rank는 0~5 클램프, enhance는 무제한 비음수)
  const odd = JSON.stringify({
    version: CHARACTER_SAVE_VERSION,
    alloc: { str: -3, luk: 'x' },
    gear: {
      enhance: { weapon: 42, head: -2, body: 4 },
      rank: { weapon: 99, head: -1, body: 2 },
      bag: { 'clover-charm': 2, moon: 1, 'blue-bead': -1 },
      equipped: { weapon: 'clover-charm', accessory1: 'clover-charm', toString: 'x' },
    },
  });
  assert.deepEqual(parseCharacter(odd, 5), {
    alloc: zeroStats(),
    gear: {
      enhance: { weapon: 42, head: 0, body: 4, hands: 0, feet: 0 },
      rank: { weapon: MAX_RANK, head: 0, body: 2, hands: 0, feet: 0 },
      bag: { 'clover-charm': 2 },
      equipped: { accessory1: 'clover-charm' },
    },
  });

  // 예전(아이템 교체형) 저장 파일 자동 변환 확인
  const legacy = JSON.stringify({
    version: CHARACTER_SAVE_VERSION,
    alloc: {},
    gear: {
      bag: { 'practice-sword': 1, 'light-boots': 1, 'blue-bead': 1 },
      equipped: { weapon: 'iron-sword', body: 'leather-armor', accessory1: 'wildflower-bracelet' },
    },
  });
  const migrated = parseCharacter(legacy, 5).gear;
  assert.deepEqual(migrated.rank, { weapon: 1, head: 0, body: 1, hands: 0, feet: 1 });
  assert.deepEqual(migrated.enhance, { weapon: 0, head: 0, body: 0, hands: 0, feet: 0 });
  assert.deepEqual(migrated.bag, { 'blue-bead': 1 });
  assert.deepEqual(migrated.equipped, { accessory1: 'wildflower-bracelet' });
});
