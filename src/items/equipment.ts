import type { StatBlock, StatId } from '../entities/attributes.ts';
import { MAX_GOLD, type Inventory } from './inventory.ts';

/**
 * 장비: 일곱 칸(무기·머리·몸·장갑·신발·장신구 2)과 장비 목록, 착용·해제·구매·판매.
 * 아이콘은 src/assets/icons/items/<장비 id>.png (없으면 화면에서 임시 그림을 그린다).
 * Phaser를 쓰지 않아 tools/equipment.test.mjs가 직접 불러 검사한다.
 */

export type SlotId = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory1' | 'accessory2';
export const SLOT_IDS: SlotId[] = ['weapon', 'head', 'body', 'hands', 'feet', 'accessory1', 'accessory2'];
/** 장비 종류. 장신구는 두 칸 어디에나 낀다. */
export type GearKind = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';

export const SLOT_INFO: Record<SlotId, { name: string; kind: GearKind }> = {
  weapon: { name: '무기', kind: 'weapon' },
  head: { name: '머리', kind: 'head' },
  body: { name: '몸', kind: 'body' },
  hands: { name: '장갑', kind: 'hands' },
  feet: { name: '신발', kind: 'feet' },
  accessory1: { name: '장신구 1', kind: 'accessory' },
  accessory2: { name: '장신구 2', kind: 'accessory' },
};

export type GearId =
  | 'practice-sword' | 'iron-sword' | 'cloth-hood' | 'worn-tunic' | 'leather-armor'
  | 'leather-gloves' | 'light-boots' | 'clover-charm' | 'blue-bead';

export interface GearDef {
  id: GearId;
  name: string;
  description: string;
  kind: GearKind;
  stats: Partial<StatBlock>;
  /** 도란의 대장간에서 살 때 값. 없으면 팔지 않는다 */
  price?: number;
  sellPrice: number;
}

export const GEAR: Record<GearId, GearDef> = {
  'practice-sword': { id: 'practice-sword', name: '연습용 검', description: '날이 무딘 수련용 검. 손에 익었다.', kind: 'weapon', stats: { str: 1 }, sellPrice: 5 },
  'iron-sword': { id: 'iron-sword', name: '철검', description: '도란이 두들긴 튼튼한 검.', kind: 'weapon', stats: { str: 4 }, price: 300, sellPrice: 120 },
  'cloth-hood': { id: 'cloth-hood', name: '천 두건', description: '햇볕과 먼지를 막아 준다.', kind: 'head', stats: { def: 1, vit: 1 }, price: 80, sellPrice: 30 },
  'worn-tunic': { id: 'worn-tunic', name: '낡은 수련복', description: '수련소에서 입던 옷.', kind: 'body', stats: { def: 1 }, sellPrice: 5 },
  'leather-armor': { id: 'leather-armor', name: '가죽 갑옷', description: '두꺼운 가죽을 덧댄 갑옷.', kind: 'body', stats: { def: 3, vit: 2 }, price: 260, sellPrice: 100 },
  'leather-gloves': { id: 'leather-gloves', name: '가죽 장갑', description: '손잡이가 미끄러지지 않는다.', kind: 'hands', stats: { str: 1, dex: 1 }, price: 90, sellPrice: 35 },
  'light-boots': { id: 'light-boots', name: '가벼운 장화', description: '발이 가벼워 몸을 빨리 뺄 수 있다.', kind: 'feet', stats: { dex: 3 }, price: 120, sellPrice: 45 },
  'clover-charm': { id: 'clover-charm', name: '네잎 부적', description: '행운을 부른다는 작은 부적.', kind: 'accessory', stats: { luk: 3 }, price: 150, sellPrice: 60 },
  'blue-bead': { id: 'blue-bead', name: '푸른 구슬 목걸이', description: '마음이 맑아지는 푸른 구슬.', kind: 'accessory', stats: { int: 3 }, price: 150, sellPrice: 60 },
};
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
export const MAX_GEAR_STACK = 9;

export interface Gear {
  /** 가방에 있는(끼지 않은) 장비 개수 */
  bag: Partial<Record<GearId, number>>;
  equipped: Partial<Record<SlotId, GearId>>;
}

/** 처음 상태: 연습용 검과 낡은 수련복을 입고 있다. */
export function startingGear(): Gear {
  return { bag: {}, equipped: { weapon: 'practice-sword', body: 'worn-tunic' } };
}

export function gearCount(gear: Gear, id: GearId): number {
  return gear.bag[id] ?? 0;
}

export function fits(id: GearId, slot: SlotId): boolean {
  return GEAR[id].kind === SLOT_INFO[slot].kind;
}

/** 장비가 들어갈 칸: 장신구는 비어 있는 칸을 먼저, 둘 다 차 있으면 1번 칸 */
export function slotFor(gear: Gear, id: GearId): SlotId {
  const kind = GEAR[id].kind;
  if (kind !== 'accessory') return kind;
  return !gear.equipped.accessory1 ? 'accessory1' : !gear.equipped.accessory2 ? 'accessory2' : 'accessory1';
}

function addBag(gear: Gear, id: GearId, count: number): Gear {
  const bag = { ...gear.bag };
  const next = (bag[id] ?? 0) + count;
  if (next <= 0) delete bag[id];
  else bag[id] = Math.min(MAX_GEAR_STACK, next);
  return { ...gear, bag };
}

/** 가방의 장비를 낀다. 그 칸에 있던 장비는 가방으로 돌아간다. 없거나 맞지 않으면 null */
export function equip(gear: Gear, id: GearId, slot: SlotId = slotFor(gear, id)): Gear | null {
  if (gearCount(gear, id) <= 0 || !fits(id, slot)) return null;
  let next = addBag(gear, id, -1);
  const previous = gear.equipped[slot];
  if (previous) next = addBag(next, previous, 1);
  return { ...next, equipped: { ...next.equipped, [slot]: id } };
}

/** 칸의 장비를 벗어 가방에 넣는다. 비어 있으면 null */
export function unequip(gear: Gear, slot: SlotId): Gear | null {
  const id = gear.equipped[slot];
  if (!id) return null;
  const equipped = { ...gear.equipped };
  delete equipped[slot];
  return addBag({ ...gear, equipped }, id, 1);
}

/** 끼고 있는 장비가 더하는 능력치 */
export function gearBonus(gear: Gear): Partial<StatBlock> {
  const out: Partial<StatBlock> = {};
  for (const slot of SLOT_IDS) {
    const id = gear.equipped[slot];
    if (!id) continue;
    for (const [stat, value] of Object.entries(GEAR[id].stats) as [StatId, number][]) out[stat] = (out[stat] ?? 0) + value;
  }
  return out;
}

/** 산다. 골드가 모자라거나 팔지 않거나 가득하면 null */
export function buyGear(inv: Inventory, gear: Gear, id: GearId): { inventory: Inventory; gear: Gear } | null {
  const price = GEAR[id].price;
  if (price === undefined || inv.gold < price || gearCount(gear, id) >= MAX_GEAR_STACK) return null;
  return { inventory: { ...inv, gold: inv.gold - price }, gear: addBag(gear, id, 1) };
}

/** 가방의(끼지 않은) 장비를 판다. 없으면 null */
export function sellGear(inv: Inventory, gear: Gear, id: GearId): { inventory: Inventory; gear: Gear } | null {
  if (gearCount(gear, id) <= 0) return null;
  return {
    inventory: { ...inv, gold: Math.min(MAX_GOLD, inv.gold + GEAR[id].sellPrice) },
    gear: addBag(gear, id, -1),
  };
}

/** 저장된 값에서 장비를 읽는다. 모르는 장비·맞지 않는 칸·이상한 개수는 그 칸만 버린다. */
export function parseGear(data: unknown): Gear {
  if (typeof data !== 'object' || data === null) return startingGear();
  const { bag, equipped } = data as { bag?: unknown; equipped?: unknown };
  const gear: Gear = { bag: {}, equipped: {} };
  const known = (id: unknown): id is GearId => typeof id === 'string' && Object.hasOwn(GEAR, id);
  if (typeof bag === 'object' && bag !== null) {
    for (const [id, count] of Object.entries(bag)) {
      if (known(id) && Number.isInteger(count) && (count as number) > 0) gear.bag[id] = Math.min(MAX_GEAR_STACK, count as number);
    }
  }
  if (typeof equipped === 'object' && equipped !== null) {
    for (const [slot, id] of Object.entries(equipped)) {
      if (Object.hasOwn(SLOT_INFO, slot) && known(id) && fits(id, slot as SlotId)) gear.equipped[slot as SlotId] = id;
    }
  }
  return gear;
}
