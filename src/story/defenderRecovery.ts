import type { SaveStorage } from '../entities/saveData.ts';
import type { NpcId } from '../world/npcs.ts';
import { GUARDS, isGuardId } from '../world/guards.ts';
import { chapterPhase } from './chapterOne.ts';
import type { QuestState } from './quests.ts';

export const DEFENDER_SAVE_KEY = 'untitled-rpg.defender-injuries';
const ids = new Set<NpcId>(['ruan', 'teon', ...GUARDS.map(g => g.id)]);

/** Only incapacitating injuries persist; combat HP and animation timers remain transient. */
export function loadDefenderInjuries(storage: SaveStorage | undefined, state: QuestState): Set<NpcId> {
  if (chapterPhase(state) === 'day') {
    try { storage?.removeItem(DEFENDER_SAVE_KEY); } catch { /* unavailable storage */ }
    return new Set();
  }
  try {
    const raw: unknown = JSON.parse(storage?.getItem(DEFENDER_SAVE_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id): id is NpcId => typeof id === 'string' && ids.has(id as NpcId)) : []);
  } catch { return new Set(); }
}

export function saveDefenderInjuries(storage: SaveStorage | undefined, injured: ReadonlySet<NpcId>): void {
  try { storage?.setItem(DEFENDER_SAVE_KEY, JSON.stringify([...injured].filter(id => ids.has(id)))); }
  catch { /* Keep the current scene playable when storage is unavailable. */ }
}

export type DefenderRecovery = 'injured' | 'rest' | 'sentry';
export function defenderRecovery(id: NpcId, state: QuestState, injured: ReadonlySet<NpcId>): DefenderRecovery | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day' || !ids.has(id)) return undefined;
  const step = state['village-raid']?.step ?? 0;
  if (phase === 'raid') return (id === 'teon' && step >= 1) || (id === 'ruan' && step >= 5) || injured.has(id) ? 'injured' : undefined;
  if (id === 'ruan') return 'rest';
  // First-sword follows the next day's search and the healer's initial treatment.
  if (state['first-sword']?.status === 'done') return undefined;
  if (id === 'teon') return 'sentry';
  return isGuardId(id) && injured.has(id) ? 'rest' : undefined;
}
