import type { MonsterKind } from '../combat/monsterTypes.ts';

/**
 * 골드와 아이템.
 *
 * - 회복 물약: 체력을 조금 채운다. 메리나의 잡화점에서 산다.
 * - 도시락: 체력을 많이 채운다. 지금은 상점에서도 판다(세레나의 도시락 퀘스트가 생기면 보상으로 바꿀 수 있다).
 * - 슬라임 점액: 슬라임이 가끔 떨어뜨리는 재료. 잡화점에 판다.
 * - 여행용 건빵·푸른 이슬·해독 약초: 2장의 떠돌이 행상인 페른이 파는 여행 물품(docs/story-chapter2.md).
 *   건빵은 싸고 약한 회복, 푸른 이슬은 마나 회복, 해독 약초는 잿빛 나방의 느려짐을 푼다.
 * 상점마다 파는 물건이 다르다(SHOP_STOCK). 파는 쪽은 어느 상점이든 sellPrice로 사 준다.
 * 골드는 슬라임과 퀘스트 보상으로 얻는다. 쓰러져도 잃지 않는다.
 * 이 파일은 Phaser를 쓰지 않아 tools/inventory.test.mjs가 직접 불러 검사한다.
 */

export type ItemId = 'potion' | 'lunch' | 'slime-gel' | 'travel-biscuit' | 'blue-dew' | 'antidote-herb'
  | 'serena-lunch' | 'sia-pebble' | 'vernel-memo'
  // 2장 서브 퀘스트: 페른이 새로 파는 말린 무화과, 리네아의 편지지, 도르의 약초 주머니
  | 'dried-fig' | 'linea-letter-paper' | 'dor-herb-pouch' | 'dried-fish'
  // 대장간 승급 재료: 철광석 조각(1단계), 청동 주괴(2단계), 공명 광석(3~5단계)
  | 'iron-shard' | 'bronze-ingot' | 'resonance-ore';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  kind: 'consumable' | 'material' | 'keepsake';
  /** 쓰면 채우는 체력 */
  heal?: number;
  /** 쓰면 채우는 마나 */
  mana?: number;
  /** 쓰면 푸는 상태 (slow: 잿빛 나방·부식 웅덩이의 느려짐) */
  cures?: 'slow';
  /** 물품 창의 효과 줄을 대신하는 설명 (기념품의 숨은 효과 등) */
  note?: string;
  /** 잡화점에서 살 때 값. 없으면 팔지 않는다 */
  price?: number;
  /** 잡화점에 팔 때 받는 값. 0이면 팔 수 없다 */
  sellPrice: number;
}

/** 도르의 약초 주머니가 가방에 있으면 회복 물약이 더 채우는 체력 */
export const HERB_POUCH_BONUS = 10;

export const ITEMS: Record<ItemId, ItemDef> = {
  potion: { id: 'potion', name: '회복 물약', description: '체력을 50 채운다.', kind: 'consumable', heal: 50, price: 20, sellPrice: 8 },
  lunch: { id: 'lunch', name: '도시락', description: '든든한 한 끼. 체력을 150 채운다.', kind: 'consumable', heal: 150, price: 55, sellPrice: 20 },
  'slime-gel': { id: 'slime-gel', name: '슬라임 점액', description: '끈적한 재료. 대장간 1단계 승급 재료로 쓰거나 상점에 팔 수 있다.', kind: 'material', sellPrice: 4 },
  'travel-biscuit': { id: 'travel-biscuit', name: '여행용 건빵', description: '딱딱하지만 오래 가는 건빵. 체력을 30 채운다.', kind: 'consumable', heal: 30, price: 10, sellPrice: 4 },
  'blue-dew': { id: 'blue-dew', name: '푸른 이슬', description: '새벽 약초에서 받은 푸른 물. 마나를 40 채운다.', kind: 'consumable', mana: 40, price: 30, sellPrice: 12 },
  'antidote-herb': { id: 'antidote-herb', name: '해독 약초', description: '씹으면 몸이 가벼워진다. 잿빛 가루의 느려짐을 푼다.', kind: 'consumable', cures: 'slow', price: 15, sellPrice: 6 },
  'serena-lunch': { id: 'serena-lunch', name: '세레나의 도시락', description: '세레나가 정성껏 싸 준 도시락. 체력을 220 채운다.', kind: 'consumable', heal: 220, sellPrice: 0 },
  'sia-pebble': { id: 'sia-pebble', name: '시아의 조약돌', description: '시아가 개울가에서 오빠 몫으로 하나 더 주워 둔 매끈한 조약돌.', kind: 'keepsake', sellPrice: 0 },
  'vernel-memo': { id: 'vernel-memo', name: '베르넬의 연구 메모', description: '들판 석판 조각에 새겨진 낯선 유적 표식을 베르넬이 옮겨 적은 쪽지.', kind: 'keepsake', sellPrice: 0 },
  'dried-fig': { id: 'dried-fig', name: '말린 무화과', description: '페른이 남쪽 장터에서 떼어 온 달콤한 무화과. 체력을 90 채운다.', kind: 'consumable', heal: 90, price: 35, sellPrice: 14 },
  'dried-fish': { id: 'dried-fish', name: '말린 생선', description: '나루 어부가 바람에 말린 강 생선. 짭짤해서 힘이 난다. 체력을 70 채운다.', kind: 'consumable', heal: 70, sellPrice: 10 },
  'linea-letter-paper': { id: 'linea-letter-paper', name: '리네아의 편지지', description: '리네아가 새 공책에서 떼어 준 편지지. "가는 곳마다 한 장씩 써 보내."', kind: 'keepsake', sellPrice: 0 },
  'dor-herb-pouch': { id: 'dor-herb-pouch', name: '도르의 약초 주머니', description: '도르가 말린 약초를 채워 준 작은 주머니. 회복 물약에 약초를 한 줌 섞어 마신다.', kind: 'keepsake', sellPrice: 0,
    note: `가방에 있으면 회복 물약이 체력을 ${HERB_POUCH_BONUS} 더 채운다 · 팔 수 없다` },
  'iron-shard': { id: 'iron-shard', name: '철광석 조각', description: '단단한 철광석 조각. 대장간에서 장비 승급 재료로 쓴다.', kind: 'material', sellPrice: 12 },
  'bronze-ingot': { id: 'bronze-ingot', name: '청동 주괴', description: '불순물을 걷어 낸 청동 주괴. 대장간에서 2단계 이상 승급 재료로 쓴다.', kind: 'material', sellPrice: 25 },
  'resonance-ore': { id: 'resonance-ore', name: '공명 광석', description: '은은한 울림이 배어 있는 희귀 광석. 대장간에서 고단계 승급 재료로 쓴다.', kind: 'material', sellPrice: 45 },
};

/** 이 아이템을 쓸 때 더 채우는 체력 (도르의 약초 주머니 + 회복 물약) */
export function healBonus(inv: Inventory, id: ItemId): number {
  return id === 'potion' && countOf(inv, 'dor-herb-pouch') > 0 ? HERB_POUCH_BONUS : 0;
}

/** 상점 */
export type ShopId = 'merina' | 'fern';
/** 상점마다 파는 물건 (보여 주는 순서) */
export const SHOP_STOCK: Record<ShopId, ItemId[]> = {
  merina: ['potion', 'lunch'],
  fern: ['potion', 'travel-biscuit', 'blue-dew', 'antidote-herb'],
};

/** 상점이 지금 파는 물건: 기본 물건과 이야기로 늘어난 물건(예: 행상인의 짐 뒤 페른의 말린 무화과) */
export function shopStock(shop: ShopId, extra: readonly ItemId[] = []): ItemId[] {
  return [...SHOP_STOCK[shop], ...extra.filter(id => !SHOP_STOCK[shop].includes(id))];
}

/** 물품 창에 보여 줄 효과 한 줄 (예: "체력 50 회복") */
export function itemEffectText(id: ItemId): string {
  const def = ITEMS[id];
  if (def.note) return def.note;
  if (def.kind === 'keepsake') return '소중한 기념품 · 팔 수 없다';
  if (def.kind !== 'consumable') return '승급 재료 · 상점 판매 가능';
  return [def.heal ? `체력 ${def.heal} 회복` : '', def.mana ? `마나 ${def.mana} 회복` : '', def.cures === 'slow' ? '느려짐 해소' : '']
    .filter(Boolean).join(' · ');
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
/** 한 칸에 들고 다닐 수 있는 최대 개수 */
export const MAX_STACK = 99;
export const MAX_GOLD = 999_999;
/** 물약을 연달아 마시지 못하게 하는 간격 (게임 시계 ms) */
export const USE_COOLDOWN_MS = 20_000;

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

/** 아이템을 쓸 때의 몸 상태 */
export interface UseStatus { hp: number; maxHp: number; mp: number; maxMp: number; slowed: boolean }
export interface UseResult { inventory: Inventory; heal: number; mana: number; cured: boolean }

/** 지금 쓰면 효과가 있는지 (체력·마나가 모자라거나 느려져 있을 때). 쓰러진 뒤에는 못 쓴다. */
export function canUse(id: ItemId, status: UseStatus): boolean {
  const def = ITEMS[id];
  if (def.kind !== 'consumable' || status.hp <= 0) return false;
  return (!!def.heal && status.hp < status.maxHp) || (!!def.mana && status.mp < status.maxMp) || (def.cures === 'slow' && status.slowed);
}

/**
 * 아이템을 쓴다. 없거나, 재료이거나, 써도 아무 효과가 없으면 null(가방은 그대로).
 * heal·mana는 실제로 채워지는 양(최대치를 넘지 않는다).
 */
export function useConsumable(inv: Inventory, id: ItemId, status: UseStatus): UseResult | null {
  if (!canUse(id, status)) return null;
  const inventory = removeItem(inv, id);
  if (!inventory) return null;
  const def = ITEMS[id];
  return {
    inventory,
    heal: def.heal ? Math.max(0, Math.min(def.heal + healBonus(inv, id), status.maxHp - status.hp)) : 0,
    mana: def.mana ? Math.max(0, Math.min(def.mana, status.maxMp - status.mp)) : 0,
    cured: def.cures === 'slow' && status.slowed,
  };
}

/** 체력 회복 아이템을 쓴다. 없거나, 체력 회복이 아니거나, 체력이 가득하면 null. */
export function useItem(inv: Inventory, id: ItemId, hp: number, maxHp: number): { inventory: Inventory; heal: number } | null {
  if (!ITEMS[id].heal) return null;
  const result = useConsumable(inv, id, { hp, maxHp, mp: 0, maxMp: 0, slowed: false });
  return result && { inventory: result.inventory, heal: result.heal };
}

/** 체력이 모자랄 때 마실 물약: 모자란 만큼에 가장 알맞은 것 (작은 것부터) */
export function bestHealItem(inv: Inventory, missing: number): ItemId | undefined {
  const owned = ITEM_IDS.filter((id) => ITEMS[id].heal && countOf(inv, id) > 0)
    .sort((a, b) => ITEMS[a].heal! - ITEMS[b].heal!);
  return owned.find((id) => ITEMS[id].heal! >= missing) ?? owned[owned.length - 1];
}

/** 산다. 골드가 모자라거나 팔지 않는 물건(그 상점에 없는 물건)이거나 가방이 가득하면 null. */
export function buy(inv: Inventory, id: ItemId, count = 1, shop?: ShopId, extra: readonly ItemId[] = []): Inventory | null {
  const price = ITEMS[id].price;
  if (price === undefined || count < 1 || (shop && !shopStock(shop, extra).includes(id))) return null;
  if (countOf(inv, id) + count > MAX_STACK) return null;
  const cost = price * count;
  if (inv.gold < cost) return null;
  return addItem({ ...inv, gold: inv.gold - cost }, id, count);
}

/** 판다. 모자라거나 팔 수 없는 물건(기념품 등)이면 null */
export function sell(inv: Inventory, id: ItemId, count = 1): Inventory | null {
  if (ITEMS[id].sellPrice <= 0 || ITEMS[id].kind === 'keepsake') return null;
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

/** 몬스터 종류별 전리품(골드 + 승급 재료). */
export function enemyDrop(kind: MonsterKind | undefined, rand: () => number): Drop {
  if (kind === 'slime') return slimeDrop(rand);
  const gold = 5 + Math.floor(rand() * 5);
  const items: Drop['items'] = [];
  if (kind === 'corrosion-executioner') {
    items.push({ id: 'iron-shard', count: 3 });
  } else if (kind === 'swamp-lurker') {
    items.push({ id: 'bronze-ingot', count: 2 });
  } else if (kind === 'reed-stalker' || kind === 'mist-phantom') {
    if (rand() < 0.35) items.push({ id: 'bronze-ingot', count: 1 });
  } else if (kind === 'ashen-moth' || kind === 'corrosion-tracker') {
    if (rand() < 0.35) items.push({ id: 'iron-shard', count: 1 });
  } else if (rand() < 0.2) {
    items.push({ id: 'iron-shard', count: 1 });
  }
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
