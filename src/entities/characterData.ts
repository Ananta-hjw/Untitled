import { STAT_IDS, pointsEarned, pointsSpent, zeroStats, type StatBlock } from './attributes.ts';
import { parseGear, startingGear, type Gear } from '../items/equipment.ts';

/**
 * 상태창·장비창의 저장: 분배한 능력치 포인트와 장비 (untitled-rpg.character, 진행·가방과 따로 저장).
 * Phaser를 쓰지 않아 tools/equipment.test.mjs가 직접 불러 검사한다.
 */

export const CHARACTER_SAVE_KEY = 'untitled-rpg.character';
export const CHARACTER_SAVE_VERSION = 1;

export interface CharacterData {
  alloc: StatBlock;
  gear: Gear;
}

export function newCharacter(): CharacterData {
  return { alloc: zeroStats(), gear: startingGear() };
}

/**
 * 저장된 문자열을 읽는다. 깨졌으면 새 캐릭터.
 * 분배한 포인트가 지금 레벨에서 받을 수 있는 것보다 많으면(이상한 저장) 분배만 처음으로 되돌린다.
 */
export function parseCharacter(raw: string | null, level: number): CharacterData {
  if (!raw) return newCharacter();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return newCharacter();
  }
  if (typeof data !== 'object' || data === null || (data as { version?: unknown }).version !== CHARACTER_SAVE_VERSION) return newCharacter();
  const { alloc, gear } = data as { alloc?: unknown; gear?: unknown };
  const stats = zeroStats();
  if (typeof alloc === 'object' && alloc !== null) {
    for (const id of STAT_IDS) {
      const value = (alloc as Record<string, unknown>)[id];
      if (Number.isInteger(value) && (value as number) > 0) stats[id] = value as number;
    }
  }
  return { alloc: pointsSpent(stats) <= pointsEarned(level) ? stats : zeroStats(), gear: parseGear(gear) };
}

export function serializeCharacter(data: CharacterData): string {
  return JSON.stringify({ version: CHARACTER_SAVE_VERSION, alloc: data.alloc, gear: data.gear });
}
