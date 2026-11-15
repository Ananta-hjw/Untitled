/**
 * 골드와 아이템.
 *
 * - 회복 물약: 체력을 조금 채운다. 메리나의 잡화점에서 산다.
 * - 도시락: 체력을 많이 채운다. 지금은 상점에서도 판다(세레나의 도시락 퀘스트가 생기면 보상으로 바꿀 수 있다).
 * - 슬라임 점액: 슬라임이 가끔 떨어뜨리는 재료. 잡화점에 판다.
 * 골드는 슬라임과 퀘스트 보상으로 얻는다. 쓰러져도 잃지 않는다.
 * 이 파일은 Phaser를 쓰지 않아 tools/inventory.test.mjs가 직접 불러 검사한다.
 */

export type ItemId = 'potion' | 'lunch' | 'slime-gel';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  kind: 'consumable' | 'material';
  /** 쓰면 채우는 체력 */
  heal?: number;
  /** 잡화점에서 살 때 값. 없으면 팔지 않는다 */
  price?: number;
  /** 잡화점에 팔 때 받는 값 */
  sellPrice: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  potion: { id: 'potion', name: '회복 물약', description: '체력을 50 채운다.', kind: 'consumable', heal: 50, price: 20, sellPrice: 8 },
  lunch: { id: 'lunch', name: '도시락', description: '든든한 한 끼. 체력을 150 채운다.', kind: 'consumable', heal: 150, price: 55, sellPrice: 20 },
  'slime-gel': { id: 'slime-gel', name: '슬라임 점액', description: '끈적한 재료. 잡화점에서 사 준다.', kind: 'material', sellPrice: 4 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
/** 한 칸에 들고 다닐 수 있는 최대 개수 */
export const MAX_STACK = 99;
export const MAX_GOLD = 999_999;
/** 물약을 연달아 마시지 못하게 하는 간격 (게임 시계 ms) */
export const USE_COOLDOWN_MS = 800;

export interface Inventory {
  gold: number;
  items: Partial<Record<ItemId, number>>;
}

export function emptyInventory(): Inventory {
  return { gold: 0, items: {} };
}

export function countOf(inv: Inventory, id: ItemId): number {
  return inv.items[id] ?? 0;
}

export function addGold(inv: Inventory, amount: number): Inventory {
  return { ...inv, gold: Math.max(0, Math.min(MAX_GOLD, inv.gold + Math.round(amount))) };
}

/** 넣은 뒤의 가방. 칸이 가득 차서 못 넣은 개수는 버린다. */
export function addItem(inv: Inventory, id: ItemId, count = 1): Inventory {
  const next = Math.min(MAX_STACK, countOf(inv, id) + count);
  return { ...inv, items: { ...inv.items, [id]: next } };
}

/** 모자라면 null */
export function removeItem(inv: Inventory, id: ItemId, count = 1): Inventory | null {
  const have = countOf(inv, id);
  if (have < count) return null;
  const items = { ...inv.items };
  if (have === count) delete items[id];
  else items[id] = have - count;
  return { ...inv, items };
}

/**
 * 아이템을 쓴다. 없거나, 쓸 수 없는 아이템이거나, 체력이 가득하면 null.
 * heal은 실제로 채워지는 양(최대 체력을 넘지 않는다).
 */
export function useItem(inv: Inventory, id: ItemId, hp: number, maxHp: number): { inventory: Inventory; heal: number } | null {
  const def = ITEMS[id];
  if (def.kind !== 'consumable' || !def.heal || hp >= maxHp || hp <= 0) return null;
  const inventory = removeItem(inv, id);
  if (!inventory) return null;
  return { inventory, heal: Math.min(def.heal, maxHp - hp) };
}

/** 체력이 모자랄 때 마실 물약: 모자란 만큼에 가장 알맞은 것 (작은 것부터) */
export function bestHealItem(inv: Inventory, missing: number): ItemId | undefined {
  const owned = ITEM_IDS.filter((id) => ITEMS[id].heal && countOf(inv, id) > 0)
    .sort((a, b) => ITEMS[a].heal! - ITEMS[b].heal!);
  return owned.find((id) => ITEMS[id].heal! >= missing) ?? owned[owned.length - 1];
}

/** 산다. 골드가 모자라거나 팔지 않는 물건이거나 가방이 가득하면 null. */
export function buy(inv: Inventory, id: ItemId, count = 1): Inventory | null {
  const price = ITEMS[id].price;
  if (price === undefined || count < 1) return null;
  if (countOf(inv, id) + count > MAX_STACK) return null;
  const cost = price * count;
  if (inv.gold < cost) return null;
  return addItem({ ...inv, gold: inv.gold - cost }, id, count);
}

/** 판다. 모자라면 null */
export function sell(inv: Inventory, id: ItemId, count = 1): Inventory | null {
  const removed = removeItem(inv, id, count);
  return removed ? addGold(removed, ITEMS[id].sellPrice * count) : null;
}

export interface Drop { gold: number; items: Array<{ id: ItemId; count: number }> }

/** 슬라임 한 마리가 떨어뜨리는 것. rand는 0 이상 1 미만의 수를 돌려준다. */
export function slimeDrop(rand: () => number): Drop {
  const gold = 3 + Math.floor(rand() * 4);
  const items: Drop['items'] = [];
  if (rand() < 0.35) items.push({ id: 'slime-gel', count: 1 });
  if (rand() < 0.04) items.push({ id: 'potion', count: 1 });
  return { gold, items };
}

export function applyDrop(inv: Inventory, drop: Drop): Inventory {
  let next = addGold(inv, drop.gold);
  for (const item of drop.items) next = addItem(next, item.id, item.count);
  return next;
}

// ---------------------------------------------------------------- 저장

export const INVENTORY_SAVE_KEY = 'untitled-rpg.inventory';
export const INVENTORY_SAVE_VERSION = 1;

/** 저장된 문자열을 읽는다. 깨졌으면 빈 가방, 모르는 아이템이나 이상한 개수는 그 칸만 버린다. */
export function parseInventory(raw: string | null): Inventory {
  if (!raw) return emptyInventory();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyInventory();
  }
  if (typeof data !== 'object' || data === null) return emptyInventory();
  const { version, gold, items } = data as { version?: unknown; gold?: unknown; items?: unknown };
  if (version !== INVENTORY_SAVE_VERSION) return emptyInventory();
  const inv = emptyInventory();
  if (Number.isInteger(gold) && (gold as number) >= 0) inv.gold = Math.min(MAX_GOLD, gold as number);
  if (typeof items === 'object' && items !== null) {
    for (const [id, count] of Object.entries(items)) {
      if (!(ITEM_IDS as string[]).includes(id) || !Number.isInteger(count) || (count as number) <= 0) continue;
      inv.items[id as ItemId] = Math.min(MAX_STACK, count as number);
    }
  }
  return inv;
}

export function serializeInventory(inv: Inventory): string {
  return JSON.stringify({ version: INVENTORY_SAVE_VERSION, gold: inv.gold, items: inv.items });
}
