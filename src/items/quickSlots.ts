import { ITEMS, type ItemId } from './inventory.ts';
import type { SaveStorage } from '../entities/saveData.ts';

export type QuickSlots = [ItemId | null, ItemId | null];
export const QUICK_SLOTS_KEY = 'untitled-rpg.quick-slots';
export const emptyQuickSlots = (): QuickSlots => [null, null];

export function parseQuickSlots(raw: string | null): QuickSlots {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.version !== 1 || !Array.isArray(data.slots) || data.slots.length !== 2) return emptyQuickSlots();
    const pick = (id: unknown): ItemId | null => typeof id === 'string' && Object.hasOwn(ITEMS, id)
      && ITEMS[id as ItemId].kind === 'consumable' ? id as ItemId : null;
    return [pick(data.slots[0]), pick(data.slots[1])];
  } catch { return emptyQuickSlots(); }
}

export function loadQuickSlots(storage: SaveStorage | undefined): QuickSlots {
  try { return parseQuickSlots(storage?.getItem(QUICK_SLOTS_KEY) ?? null); }
  catch { return emptyQuickSlots(); }
}
export function saveQuickSlots(storage: SaveStorage | undefined, slots: QuickSlots): void {
  try { storage?.setItem(QUICK_SLOTS_KEY, JSON.stringify({ version: 1, slots })); }
  catch { /* 저장할 수 없는 환경에서도 이번 실행의 등록은 유지한다. */ }
}
