import type { StatBlock, StatId } from '../entities/attributes.ts';
import { MAX_GOLD, countOf, removeItem, type Inventory, type ItemId } from './inventory.ts';

/**
 * 장비 시스템 (강화 / 승급 분리 + 장신구 교체 하이브리드):
 * - 기본 5칸(무기·머리·몸·장갑·신발):
 *   1) 강화(enhance): 골드만 필요, 상한 없음(단계가 높을수록 골드 비용이 커짐). 능력치만 오르며 외형은 바뀌지 않는다.
 *   2) 승급(rank, 0~5): 골드 + 재료가 필요. 승급 능력치 보너스와 함께 외형이 'N단계 진화'로 바뀐다.
 *      - 무기: 무기 칸을 승급할 때마다 즉시 외형이 바뀐다 (1장 끝 도란의 검 이벤트로 1단계 진화 무료 부여).
 *      - 방어구(머리·몸·장갑·신발): 4부위의 승급 단계가 전부 1 이상이면 1단계 진화, 전부 2 이상이면 2단계 진화 식으로
 *        네 부위가 모두 같은 승급 이상에 도달할 때마다 방어구 외형(색)이 바뀐다.
 * - 장신구 2칸(accessory1·accessory2): 퀘스트 유품·상점 장신구를 기존처럼 자유롭게 교체 착용한다.
 * Phaser를 쓰지 않아 tools/equipment.test.mjs가 직접 불러 검사한다.
 */

export type EnhanceSlotId = 'weapon' | 'head' | 'body' | 'hands' | 'feet';
export type ArmorSlotId = 'head' | 'body' | 'hands' | 'feet';
export type AccessorySlotId = 'accessory1' | 'accessory2';
export type SlotId = EnhanceSlotId | AccessorySlotId;

export const ENHANCE_SLOT_IDS: EnhanceSlotId[] = ['weapon', 'head', 'body', 'hands', 'feet'];
export const ARMOR_SLOT_IDS: ArmorSlotId[] = ['head', 'body', 'hands', 'feet'];
export const ACCESSORY_SLOT_IDS: AccessorySlotId[] = ['accessory1', 'accessory2'];
export const SLOT_IDS: SlotId[] = [...ENHANCE_SLOT_IDS, ...ACCESSORY_SLOT_IDS];

export type GearKind = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';

export const SLOT_INFO: Record<SlotId, { name: string; kind: GearKind; enhanceable: boolean; description: string }> = {
  weapon: { name: '무기', kind: 'weapon', enhanceable: true, description: '공격력(힘)을 높이는 주 무기 칸. 승급 시 검 외형이 진화한다.' },
  head: { name: '머리', kind: 'head', enhanceable: true, description: '방어력과 체력을 높이는 머리 칸. 방어구 4부위 모두 같은 단계로 승급하면 방어구 외형이 진화한다.' },
  body: { name: '몸', kind: 'body', enhanceable: true, description: '방어력과 체력을 높이는 몸통 칸. 방어구 4부위 모두 같은 단계로 승급하면 방어구 외형이 진화한다.' },
  hands: { name: '장갑', kind: 'hands', enhanceable: true, description: '힘과 민첩을 높이는 장갑 칸. 방어구 4부위 모두 같은 단계로 승급하면 방어구 외형이 진화한다.' },
  feet: { name: '신발', kind: 'feet', enhanceable: true, description: '민첩과 방어력을 높이는 신발 칸. 방어구 4부위 모두 같은 단계로 승급하면 방어구 외형이 진화한다.' },
  accessory1: { name: '장신구 1', kind: 'accessory', enhanceable: false, description: '유품·부적 등 장신구를 자유롭게 끼고 뺄 수 있는 칸.' },
  accessory2: { name: '장신구 2', kind: 'accessory', enhanceable: false, description: '유품·부적 등 장신구를 자유롭게 끼고 뺄 수 있는 칸.' },
};

export function isEnhanceSlot(slot: SlotId): slot is EnhanceSlotId {
  return SLOT_INFO[slot].enhanceable;
}

export function isArmorSlot(slot: SlotId): slot is ArmorSlotId {
  return slot === 'head' || slot === 'body' || slot === 'hands' || slot === 'feet';
}

/** 승급(진화) 최대 단계: 0(기본) ~ 5(5단계 진화). */
export const MAX_RANK = 5;

export interface PromotionStageDef {
  rank: number;
  label: string;
}

export const PROMOTION_STAGES: readonly PromotionStageDef[] = [
  { rank: 0, label: '기본' },
  { rank: 1, label: '1단계 진화' },
  { rank: 2, label: '2단계 진화' },
  { rank: 3, label: '3단계 진화' },
  { rank: 4, label: '4단계 진화' },
  { rank: 5, label: '5단계 진화' },
];

export function sanitizeEnhanceLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.floor(level));
}

export function clampRank(rank: number): number {
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(MAX_RANK, Math.floor(rank)));
}

export function rankLabel(rank: number): string {
  return PROMOTION_STAGES[clampRank(rank)].label;
}

/** 무기 외형 설명(1단계는 1장 도란의 검, 2~5단계는 추후 확정 예정). */
export function weaponAppearanceLabel(rank: number): string {
  const r = clampRank(rank);
  if (r === 0) return '기본 (나무검)';
  if (r === 1) return '1단계 진화 (도란의 검)';
  return `${r}단계 진화 (외형 추후 확정)`;
}

/** 방어구 세트 외형 설명(4부위 승급 일치 시 진화, 세부 색·외형은 추후 확정 예정). */
export function armorAppearanceLabel(stage: number): string {
  const s = clampRank(stage);
  if (s === 0) return '기본';
  return `${s}단계 진화 (외형 추후 확정)`;
}

/** 장비 창·대장간에 표시할 칸 제목 (예: "무기 +3 · 1단계 진화"). */
export function slotDisplayName(slot: EnhanceSlotId, enhance: number, rank: number): string {
  return `${SLOT_INFO[slot].name} +${sanitizeEnhanceLevel(enhance)} · ${rankLabel(rank)}`;
}

/**
 * 각 강화 칸의 표시 아이콘 ID.
 * - 무기: 무기 승급 단계(rank)에만 반응(강화로는 바뀌지 않는다).
 * - 몸: 방어구 4부위 일치 승급 단계(armorStage)에만 반응.
 * 세부 외형이 확정되면 단계별 전용 아이콘으로 교체한다.
 */
export function slotIconId(slot: EnhanceSlotId, rank: number, armorStage = 0): string {
  const r = clampRank(rank);
  if (slot === 'weapon') return r === 0 ? 'wooden-sword' : r === 1 ? 'iron-sword' : 'long-sword';
  if (slot === 'body') {
    const a = clampRank(armorStage);
    return a === 0 ? 'worn-tunic' : a === 1 ? 'leather-armor' : 'travel-cloak';
  }
  if (slot === 'head') return 'cloth-hood';
  if (slot === 'hands') return 'leather-gloves';
  return 'light-boots';
}

/**
 * 강화(+1당 능력치 +1, 상한 없음)와 승급(단계당 큰 능력치 도약)을 합산한 칸 능력치.
 * - 무기: 기본 STR +1, 강화 +1당 STR +1, 승급 1단계당 STR +5 (승급 1 = 도란의 검 STR +6)
 * - 몸: 기본 DEF +1, 유효치(강화 + 승급×4)로 DEF/VIT 배분
 * - 머리·장갑·신발: 유효치(강화 + 승급×3)로 주·보조 능력치 배분
 */
export function slotStats(slot: EnhanceSlotId, enhance: number, rank: number): Partial<StatBlock> {
  const lv = sanitizeEnhanceLevel(enhance);
  const rk = clampRank(rank);
  if (slot === 'weapon') return { str: 1 + lv + rk * 5 };
  if (slot === 'body') {
    const power = lv + rk * 4;
    const vit = Math.floor((power * 4) / 10);
    const def = 1 + (power - vit);
    return vit > 0 ? { def, vit } : { def };
  }
  const power = lv + rk * 3;
  if (power === 0) return {};
  if (slot === 'head') {
    const vit = Math.floor(power / 2);
    const def = power - vit;
    return vit > 0 ? { def, vit } : { def };
  }
  if (slot === 'hands') {
    const dex = Math.floor(power / 2);
    const str = power - dex;
    return dex > 0 ? { str, dex } : { str };
  }
  const def = Math.floor((power * 3) / 10);
  const dex = power - def;
  return def > 0 ? { dex, def } : { dex };
}

/** 대장간·상점 구분: 로웬 도란의 대장간, 물안개 나루 마르타의 대장간(강화·승급 가능), 페른의 수레(장신구 전용) */
export type GearShopId = 'doran' | 'fern' | 'marta';

/** 이 상점이 대장간(강화·승급 가능)인지 */
export function canSmithyWork(shop: GearShopId): boolean {
  return shop === 'doran' || shop === 'marta';
}

/**
 * 강화 비용(골드만 필요, 강화 상한 없음).
 * 강화 단계가 높아질수록 비용이 가파르게 늘어나며(2차 곡선), 모든 단계에서 cost(lv+1) > cost(lv)를 보장한다.
 */
export function enhanceCost(slot: EnhanceSlotId, currentLevel: number): number {
  const lv = sanitizeEnhanceLevel(currentLevel);
  const raw = 40 + lv * 25 + lv * lv * 10;
  const weighted = slot === 'weapon' ? raw * 1.15 : raw;
  return Math.round(weighted / 10) * 10;
}

export interface MaterialNeed {
  id: ItemId;
  count: number;
}

export interface PromotionRecipe {
  targetRank: number;
  gold: number;
  materials: readonly MaterialNeed[];
}

const PROMOTION_TABLE: ReadonlyArray<{ weaponGold: number; armorGold: number; materials: readonly MaterialNeed[] }> = [
  // 0 → 1단계 진화
  { weaponGold: 200, armorGold: 150, materials: [{ id: 'iron-shard', count: 2 }, { id: 'slime-gel', count: 2 }] },
  // 1 → 2단계 진화
  { weaponGold: 500, armorGold: 380, materials: [{ id: 'bronze-ingot', count: 3 }, { id: 'iron-shard', count: 2 }] },
  // 2 → 3단계 진화
  { weaponGold: 1100, armorGold: 850, materials: [{ id: 'resonance-ore', count: 3 }, { id: 'bronze-ingot', count: 3 }] },
  // 3 → 4단계 진화
  { weaponGold: 2200, armorGold: 1700, materials: [{ id: 'resonance-ore', count: 6 }, { id: 'bronze-ingot', count: 4 }] },
  // 4 → 5단계 진화
  { weaponGold: 4000, armorGold: 3200, materials: [{ id: 'resonance-ore', count: 10 }, { id: 'iron-shard', count: 5 }] },
];

/** 현재 승급 단계에서 다음 단계로 승급할 때 필요한 골드와 재료. 최대 승급(5단계)이면 null. */
export function promotionRecipe(slot: EnhanceSlotId, currentRank: number): PromotionRecipe | null {
  const rk = clampRank(currentRank);
  if (rk >= MAX_RANK) return null;
  const row = PROMOTION_TABLE[rk];
  return {
    targetRank: rk + 1,
    gold: slot === 'weapon' ? row.weaponGold : row.armorGold,
    materials: row.materials,
  };
}

/** 골드와 재료가 모두 충분한지 확인한다. */
export function canAffordPromotion(inv: Inventory, slot: EnhanceSlotId, currentRank: number): boolean {
  const recipe = promotionRecipe(slot, currentRank);
  if (!recipe || inv.gold < recipe.gold) return false;
  return recipe.materials.every((m) => countOf(inv, m.id) >= m.count);
}

// ---------------------------------------------------------------- 장신구 (교체형 유품·부적)

export type GearId =
  | 'clover-charm'
  | 'blue-bead'
  | 'wildflower-bracelet'
  | 'bronze-bell-earring'
  | 'reed-knot-bracelet';

export interface GearDef {
  id: GearId;
  name: string;
  description: string;
  kind: 'accessory';
  stats: Partial<StatBlock>;
  /** 살 때 값. 없으면 상점에서 팔지 않는다(퀘스트 유품 등). */
  price?: number;
  /** 파는 곳. 없으면 도란의 대장간 */
  shop?: GearShopId;
  /** 팔 때 값. 0이면 팔 수 없는 기념품 */
  sellPrice: number;
}

export const GEAR: Record<GearId, GearDef> = {
  'clover-charm': { id: 'clover-charm', name: '네잎 부적', description: '행운을 부른다는 작은 부적.', kind: 'accessory', stats: { luk: 3 }, price: 150, sellPrice: 60 },
  'blue-bead': { id: 'blue-bead', name: '푸른 구슬 목걸이', description: '마음이 맑아지는 푸른 구슬.', kind: 'accessory', stats: { int: 3 }, price: 150, sellPrice: 60 },
  // 1장 서브 퀘스트 "축제 장식용 들꽃" 보상: 리네아가 엮어 준 약속의 팔찌라 상점에 팔 수 없다.
  'wildflower-bracelet': { id: 'wildflower-bracelet', name: '리네아의 들꽃 팔찌', description: '리네아가 하늘색 들꽃으로 엮어 준 팔찌. 손목에 차면 마음이 놓인다.', kind: 'accessory', stats: { vit: 2 }, sellPrice: 0 },
  // 2장 물안개 나루 마르타의 대장간: 종을 부었던 집안의 청동 장신구
  'bronze-bell-earring': { id: 'bronze-bell-earring', name: '청동 방울 귀걸이', description: '울리지 않게 속을 막은 작은 청동 방울. 머리가 맑아진다.', kind: 'accessory', stats: { int: 4, luk: 2 }, price: 300, sellPrice: 115, shop: 'marta' },
  // 2장 페른의 수레: 길 떠나는 사람의 장신구
  'reed-knot-bracelet': { id: 'reed-knot-bracelet', name: '갈대 매듭 팔찌', description: '물가 사람들이 무사히 돌아오라고 엮는 갈대 매듭 팔찌.', kind: 'accessory', stats: { vit: 3, dex: 3 }, price: 300, sellPrice: 115, shop: 'fern' },
};
export const GEAR_IDS = Object.keys(GEAR) as GearId[];
export const MAX_GEAR_STACK = 9;

export type SlotLevels = Record<EnhanceSlotId, number>;

export interface Gear {
  /** 기본 5칸의 강화 단계 (+0, +1, ... 제한 없음 · 능력치만 상승) */
  enhance: SlotLevels;
  /** 기본 5칸의 승급 단계 (0~5 · 외형 진화 + 승급 보너스) */
  rank: SlotLevels;
  /** 가방에 있는(끼지 않은) 장신구 개수 */
  bag: Partial<Record<GearId, number>>;
  /** 장신구 2칸에 착용 중인 장신구 */
  equipped: Partial<Record<AccessorySlotId, GearId>>;
}

export function zeroSlotLevels(): SlotLevels {
  return { weapon: 0, head: 0, body: 0, hands: 0, feet: 0 };
}

/** 처음 상태: 모든 칸 강화 +0·승급 0(기본 보너스 무기 STR+1·몸 DEF+1), 장신구 비어 있음. */
export function startingGear(): Gear {
  return { enhance: zeroSlotLevels(), rank: zeroSlotLevels(), bag: {}, equipped: {} };
}

/**
 * 방어구 세트 외형 단계: 머리·몸·장갑·신발 네 부위 승급 단계의 최솟값.
 * 전부 1 이상이면 1단계 진화, 전부 2 이상이면 2단계 진화 식으로 4부위가 모두 맞춰질 때만 외형이 바뀐다.
 */
export function armorAppearanceRank(gear: Gear): number {
  return clampRank(Math.min(...ARMOR_SLOT_IDS.map((slot) => clampRank(gear.rank[slot]))));
}

export interface ArmorPromotionStatus {
  stage: number;
  nextStage: number | null;
  readyCount: number;
  total: number;
  missing: ArmorSlotId[];
}

export function armorPromotionStatus(gear: Gear): ArmorPromotionStatus {
  const stage = armorAppearanceRank(gear);
  if (stage >= MAX_RANK) {
    return { stage, nextStage: null, readyCount: ARMOR_SLOT_IDS.length, total: ARMOR_SLOT_IDS.length, missing: [] };
  }
  const nextStage = stage + 1;
  const missing = ARMOR_SLOT_IDS.filter((slot) => clampRank(gear.rank[slot]) < nextStage);
  return { stage, nextStage, readyCount: ARMOR_SLOT_IDS.length - missing.length, total: ARMOR_SLOT_IDS.length, missing };
}

export interface EnhanceResult {
  inventory: Inventory;
  gear: Gear;
  slot: EnhanceSlotId;
  level: number;
  cost: number;
}

/**
 * 대장간 강화: 골드만 소모해 지정 칸을 +1 강화한다(상한 없음, 외형 변화 없음).
 */
export function enhanceSlot(inv: Inventory, gear: Gear, slot: EnhanceSlotId, shop: GearShopId = 'doran'): EnhanceResult | null {
  if (!canSmithyWork(shop)) return null;
  const current = sanitizeEnhanceLevel(gear.enhance[slot]);
  const cost = enhanceCost(slot, current);
  if (inv.gold < cost) return null;
  const level = current + 1;
  return {
    inventory: { ...inv, gold: inv.gold - cost },
    gear: { ...gear, enhance: { ...gear.enhance, [slot]: level } },
    slot,
    level,
    cost,
  };
}

export interface PromoteResult {
  inventory: Inventory;
  gear: Gear;
  slot: EnhanceSlotId;
  rank: number;
  gold: number;
  materials: readonly MaterialNeed[];
  /** 이번 승급으로 실제 인게임 외형(무기 외형 또는 방어구 4부위 일치 외형)이 바뀌었는지 */
  appearanceChanged: boolean;
  armorStage: number;
}

/**
 * 대장간 승급: 골드 + 재료를 소모해 지정 칸의 승급 단계를 +1 올린다(최대 5단계 진화).
 * 무기는 승급 즉시 외형이 바뀌며, 방어구는 4부위(머리·몸·장갑·신발) 승급이 모두 맞춰졌을 때 외형이 바뀐다.
 */
export function promoteSlotWithCost(inv: Inventory, gear: Gear, slot: EnhanceSlotId, shop: GearShopId = 'doran'): PromoteResult | null {
  if (!canSmithyWork(shop)) return null;
  const current = clampRank(gear.rank[slot]);
  const recipe = promotionRecipe(slot, current);
  if (!recipe || !canAffordPromotion(inv, slot, current)) return null;
  let nextInv: Inventory = { ...inv, gold: inv.gold - recipe.gold };
  for (const mat of recipe.materials) {
    const after = removeItem(nextInv, mat.id, mat.count);
    if (!after) return null;
    nextInv = after;
  }
  const armorBefore = armorAppearanceRank(gear);
  const rank = current + 1;
  const nextGear: Gear = { ...gear, rank: { ...gear.rank, [slot]: rank } };
  const armorAfter = armorAppearanceRank(nextGear);
  const appearanceChanged = slot === 'weapon' ? true : armorAfter > armorBefore;
  return {
    inventory: nextInv,
    gear: nextGear,
    slot,
    rank,
    gold: recipe.gold,
    materials: recipe.materials,
    appearanceChanged,
    armorStage: armorAfter,
  };
}

/**
 * 스토리 이벤트 승급(1장 완료 '도란의 검' 전용):
 * 지정 칸을 무료로 최소 targetRank(1단계 진화)까지 승급한다. 이미 targetRank 이상이면 +1(최대 5단계).
 */
/** 퀘스트 보상: 지정 칸을 비용 없이 levels만큼 +강화한다. */
export function grantEnhance(gear: Gear, slot: EnhanceSlotId, levels: number): { gear: Gear; level: number } {
  const level = sanitizeEnhanceLevel(sanitizeEnhanceLevel(gear.enhance[slot]) + Math.max(0, Math.floor(levels)));
  return { gear: { ...gear, enhance: { ...gear.enhance, [slot]: level } }, level };
}

export function grantSlotRank(gear: Gear, slot: EnhanceSlotId, targetRank: number): { gear: Gear; rank: number; appearanceChanged: boolean; armorStage: number } {
  const current = clampRank(gear.rank[slot]);
  const desired = current < targetRank ? targetRank : current + 1;
  const rank = clampRank(desired);
  const armorBefore = armorAppearanceRank(gear);
  const nextGear: Gear = { ...gear, rank: { ...gear.rank, [slot]: rank } };
  const armorAfter = armorAppearanceRank(nextGear);
  const appearanceChanged = rank > current && (slot === 'weapon' || armorAfter > armorBefore);
  return { gear: nextGear, rank, appearanceChanged, armorStage: armorAfter };
}

export function gearCount(gear: Gear, id: GearId): number {
  return gear.bag[id] ?? 0;
}

export function fits(id: GearId, slot: SlotId): boolean {
  return GEAR[id].kind === SLOT_INFO[slot].kind;
}

/** 장신구가 들어갈 칸: 비어 있는 칸을 먼저, 둘 다 차 있으면 1번 칸 */
export function slotFor(gear: Gear, _id?: GearId): AccessorySlotId {
  return !gear.equipped.accessory1 ? 'accessory1' : !gear.equipped.accessory2 ? 'accessory2' : 'accessory1';
}

function addBag(gear: Gear, id: GearId, count: number): Gear {
  const bag = { ...gear.bag };
  const next = (bag[id] ?? 0) + count;
  if (next <= 0) delete bag[id];
  else bag[id] = Math.min(MAX_GEAR_STACK, next);
  return { ...gear, bag };
}

/** 가방의 장신구를 낀다. 그 칸에 있던 장신구는 가방으로 돌아간다. 없거나 맞지 않는 칸이면 null */
export function equip(gear: Gear, id: GearId, slot: SlotId = slotFor(gear, id)): Gear | null {
  if (gearCount(gear, id) <= 0 || !fits(id, slot)) return null;
  const accSlot = slot as AccessorySlotId;
  let next = addBag(gear, id, -1);
  const previous = gear.equipped[accSlot];
  if (previous) next = addBag(next, previous, 1);
  return { ...next, equipped: { ...next.equipped, [accSlot]: id } };
}

/** 장신구 칸의 장비를 벗어 가방에 넣는다. 기본 칸이거나 비어 있으면 null */
export function unequip(gear: Gear, slot: SlotId): Gear | null {
  if (isEnhanceSlot(slot)) return null;
  const id = gear.equipped[slot];
  if (!id) return null;
  const equipped = { ...gear.equipped };
  delete equipped[slot];
  return addBag({ ...gear, equipped }, id, 1);
}

/** 기본 5칸(강화 + 승급) 보너스 + 착용 중인 장신구 2칸의 능력치 합계 */
export function gearBonus(gear: Gear): Partial<StatBlock> {
  const out: Partial<StatBlock> = {};
  const add = (stats: Partial<StatBlock>) => {
    for (const [stat, value] of Object.entries(stats) as [StatId, number][]) {
      if (value) out[stat] = (out[stat] ?? 0) + value;
    }
  };
  for (const slot of ENHANCE_SLOT_IDS) add(slotStats(slot, gear.enhance[slot], gear.rank[slot]));
  for (const slot of ACCESSORY_SLOT_IDS) {
    const id = gear.equipped[slot];
    if (id) add(GEAR[id].stats);
  }
  return out;
}

/** 받은 장신구를 가방에 넣는다 (퀘스트 보상) */
export function addGear(gear: Gear, id: GearId, count = 1): Gear {
  return addBag(gear, id, count);
}

/** 이 상점이 파는 장신구 (도란의 대장간이 기본) */
export function gearForSale(shop: GearShopId = 'doran'): GearId[] {
  return (Object.keys(GEAR) as GearId[]).filter((id) => GEAR[id].price !== undefined && (GEAR[id].shop ?? 'doran') === shop);
}

/** 장신구를 산다. 골드가 모자라거나 팔지 않는 장신구(그 상점에 없는 것)이거나 가득하면 null */
export function buyGear(inv: Inventory, gear: Gear, id: GearId, shop: GearShopId = 'doran'): { inventory: Inventory; gear: Gear } | null {
  const price = GEAR[id]?.price;
  if (price === undefined || (GEAR[id].shop ?? 'doran') !== shop || inv.gold < price || gearCount(gear, id) >= MAX_GEAR_STACK) return null;
  return { inventory: { ...inv, gold: inv.gold - price }, gear: addBag(gear, id, 1) };
}

/** 가방의(끼지 않은) 장신구를 판다. 없거나 팔 수 없는 기념품이면 null */
export function sellGear(inv: Inventory, gear: Gear, id: GearId): { inventory: Inventory; gear: Gear } | null {
  if (gearCount(gear, id) <= 0 || GEAR[id].sellPrice <= 0) return null;
  return {
    inventory: { ...inv, gold: Math.min(MAX_GOLD, inv.gold + GEAR[id].sellPrice) },
    gear: addBag(gear, id, -1),
  };
}

/** 예전(아이템 교체형) 저장 파일의 무기·방어구 ID를 강화/승급 상태로 부드럽게 변환한다. */
const LEGACY_ITEM_MAP: Record<string, { slot: EnhanceSlotId; enhance: number; rank: number }> = {
  'practice-sword': { slot: 'weapon', enhance: 0, rank: 0 },
  'wooden-sword': { slot: 'weapon', enhance: 0, rank: 0 },
  'short-sword': { slot: 'weapon', enhance: 1, rank: 0 },
  'long-sword': { slot: 'weapon', enhance: 3, rank: 0 },
  'iron-sword': { slot: 'weapon', enhance: 0, rank: 1 },
  'cloth-hood': { slot: 'head', enhance: 2, rank: 0 },
  'bronze-helm': { slot: 'head', enhance: 0, rank: 2 },
  'worn-tunic': { slot: 'body', enhance: 0, rank: 0 },
  'travel-cloak': { slot: 'body', enhance: 0, rank: 1 },
  'leather-armor': { slot: 'body', enhance: 0, rank: 1 },
  'scale-armor': { slot: 'body', enhance: 1, rank: 2 },
  'leather-gloves': { slot: 'hands', enhance: 2, rank: 0 },
  'bronze-bracers': { slot: 'hands', enhance: 2, rank: 1 },
  'light-boots': { slot: 'feet', enhance: 0, rank: 1 },
  'heron-feather-boots': { slot: 'feet', enhance: 1, rank: 2 },
};

/** 저장된 값에서 장비(강화·승급 + 장신구)를 읽는다. 예전 저장 형식도 자동 변환한다. */
export function parseGear(data: unknown): Gear {
  if (typeof data !== 'object' || data === null) return startingGear();
  const { enhance, rank, bag, equipped } = data as { enhance?: unknown; rank?: unknown; bag?: unknown; equipped?: unknown };
  const gear: Gear = startingGear();
  const knownAcc = (id: unknown): id is GearId => typeof id === 'string' && Object.hasOwn(GEAR, id);
  const bumpLegacy = (raw: unknown) => {
    if (typeof raw !== 'string' || !Object.hasOwn(LEGACY_ITEM_MAP, raw)) return;
    const mapped = LEGACY_ITEM_MAP[raw];
    gear.rank[mapped.slot] = Math.max(gear.rank[mapped.slot], mapped.rank);
    gear.enhance[mapped.slot] = Math.max(gear.enhance[mapped.slot], mapped.enhance);
  };

  const hasRank = typeof rank === 'object' && rank !== null;
  const hasEnhance = typeof enhance === 'object' && enhance !== null;

  if (hasRank) {
    for (const slot of ENHANCE_SLOT_IDS) {
      const value = (rank as Record<string, unknown>)[slot];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
        gear.rank[slot] = clampRank(value);
      }
    }
  }
  if (hasEnhance) {
    for (const slot of ENHANCE_SLOT_IDS) {
      const value = (enhance as Record<string, unknown>)[slot];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
        if (hasRank) {
          gear.enhance[slot] = sanitizeEnhanceLevel(value);
        } else {
          // 이전 통합 강화형 저장(rank 없음): 5강마다 승급 1단계 + 상한 초과분 포함 나머지 강화로 변환
          gear.rank[slot] = clampRank(Math.floor(value / 5));
          gear.enhance[slot] = sanitizeEnhanceLevel(value - gear.rank[slot] * 5);
        }
      }
    }
  }
  if (typeof bag === 'object' && bag !== null) {
    for (const [id, count] of Object.entries(bag)) {
      if (!Number.isInteger(count) || (count as number) <= 0) continue;
      if (knownAcc(id)) gear.bag[id] = Math.min(MAX_GEAR_STACK, count as number);
      else if (!hasEnhance && !hasRank) bumpLegacy(id);
    }
  }
  if (typeof equipped === 'object' && equipped !== null) {
    for (const [slot, id] of Object.entries(equipped)) {
      if ((slot === 'accessory1' || slot === 'accessory2') && knownAcc(id)) {
        gear.equipped[slot] = id;
      } else if (!hasEnhance && !hasRank) {
        bumpLegacy(id);
      }
    }
  }
  return gear;
}
