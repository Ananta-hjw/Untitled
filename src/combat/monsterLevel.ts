import type { MapId } from '../world/maps.ts';

/**
 * 몬스터 레벨과 사냥터 권장 레벨.
 *  - 사냥터마다 몬스터 레벨 범위가 있다(AREA_LEVELS). 같은 맵의 몬스터는 배치 순서대로 그 범위를 돌아가며 받는다.
 *  - 레벨이 1 오를 때마다 체력·경험치는 LEVEL_SCALE.hp·xp만큼, 공격력은 LEVEL_SCALE.damage만큼 늘어난다(레벨 1 기준 배율).
 *  - 주인공이 몬스터보다 XP_PENALTY.freeGap 레벨을 넘게 높으면, 넘는 레벨마다 경험치가 perLevel씩 줄어든다(최소 minScale).
 * Phaser를 쓰지 않아 tools/monster-level.test.mjs가 직접 불러 검사한다.
 */

export interface LevelRange { min: number; max: number }

/** 사냥터 권장 레벨(= 그곳 몬스터의 레벨 범위). 습격·해 질 무렵처럼 따로 정한 적은 별도 레벨을 쓴다. */
export const AREA_LEVELS: Partial<Record<MapId, LevelRange>> = {
  'south-field': { min: 1, max: 3 },
  'west-forest': { min: 4, max: 6 },
  'east-stream': { min: 7, max: 9 },
  'east-pass': { min: 8, max: 10 },
  'reed-swamp': { min: 11, max: 11 },
};

/** 해 질 무렵 남쪽 들판의 잿빛 나방, 습격의 권속 */
export const DUSK_MOTH_LEVEL = 4;
export const RAID_LEVELS = { tracker: 5, moth: 5, executioner: 7 };

export const LEVEL_SCALE = { hp: 0.25, damage: 0.15, xp: 0.25 };
export const XP_PENALTY = { freeGap: 2, perLevel: 0.2, minScale: 0.1 };

/** 맵의 index번째 몬스터 레벨: 범위를 차례로 돈다(1, 2, 3, 1, 2, 3 …). 범위가 없는 맵은 1 */
export function spawnLevel(map: MapId, index: number): number {
  const range = AREA_LEVELS[map];
  if (!range) return 1;
  return range.min + (index % (range.max - range.min + 1));
}

export interface ScalableStats { hp: number; damage: number; xp: number }

/** 레벨에 맞춘 체력·공격력·경험치 (나머지 값은 그대로) */
export function scaleMonster<T extends ScalableStats>(base: T, level: number): T {
  const steps = Math.max(0, level - 1);
  return {
    ...base,
    hp: Math.round(base.hp * (1 + LEVEL_SCALE.hp * steps)),
    damage: Math.round(base.damage * (1 + LEVEL_SCALE.damage * steps)),
    xp: Math.round(base.xp * (1 + LEVEL_SCALE.xp * steps)),
  } as T;
}

/** 레벨 차이를 반영한 경험치. 주인공이 너무 높으면 줄어든다(최소 1). */
export function xpForKill(xp: number, monsterLevel: number, playerLevel: number): number {
  const over = playerLevel - monsterLevel - XP_PENALTY.freeGap;
  const scale = over > 0 ? Math.max(XP_PENALTY.minScale, 1 - XP_PENALTY.perLevel * over) : 1;
  return Math.max(1, Math.round(xp * scale));
}

/** 입장 안내에 붙이는 권장 레벨 글 (없으면 빈 문자열) */
export function levelHint(map: MapId): string {
  const range = AREA_LEVELS[map];
  if (!range) return '';
  return ` · 권장 Lv. ${range.min === range.max ? range.min : `${range.min}~${range.max}`}`;
}
