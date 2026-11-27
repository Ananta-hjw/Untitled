import { PLAYER, PROGRESSION } from '../config.ts';

/**
 * 경험치와 레벨 계산.
 *
 * Phaser에 의존하지 않는 순수 함수만 둔다. tools/progression.test.mjs가 직접 불러 검사한다.
 * 수치는 src/config.ts의 PROGRESSION에서 조정한다.
 */

export interface Progress {
  level: number;
  /** 현재 레벨에서 모은 경험치 (다음 레벨로 넘어가면 0부터 다시 센다) */
  xp: number;
}

export interface LevelStats {
  maxHp: number;
  damageMin: number;
  damageMax: number;
}

/** 이 레벨에서 다음 레벨까지 필요한 경험치(2차 곡선). 최고 레벨이면 0. */
export function xpToNext(level: number): number {
  if (level >= PROGRESSION.maxLevel) return 0;
  const step = level - 1;
  return PROGRESSION.xpBase + PROGRESSION.xpStep * step + PROGRESSION.xpCurve * step * step;
}

/** 레벨별 최대 체력과 공격력 */
export function statsForLevel(level: number): LevelStats {
  const steps = Math.max(0, Math.min(level, PROGRESSION.maxLevel) - 1);
  const bonus = Math.round(PROGRESSION.damagePerLevel * steps);
  return {
    maxHp: PLAYER.maxHp + PROGRESSION.hpPerLevel * steps,
    damageMin: PLAYER.damageMin + bonus,
    damageMax: PLAYER.damageMax + bonus,
  };
}

/**
 * 경험치를 더한 결과를 돌려준다 (원래 값은 바꾸지 않는다).
 * 한 번에 여러 레벨이 오를 수 있고, 최고 레벨에서는 경험치가 더 쌓이지 않는다.
 */
export function addXp(progress: Progress, amount: number): Progress & { levelsGained: number } {
  let { level, xp } = progress;
  let levelsGained = 0;
  if (level >= PROGRESSION.maxLevel) return { level, xp: 0, levelsGained };

  xp += Math.max(0, amount);
  while (level < PROGRESSION.maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    levelsGained++;
  }
  if (level >= PROGRESSION.maxLevel) xp = 0;
  return { level, xp, levelsGained };
}
