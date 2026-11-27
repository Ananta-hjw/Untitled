import type { MonsterKind } from './monsterTypes.ts';

/**
 * 중급 이상 적의 연타 묶음 (게임 시계 ms).
 * 한 묶음은 타마다의 예비 동작 길이이고, 첫 타가 끝나면 gapMs 쉬고 곧장 다음 타를 준비한다.
 * 예비 동작 중에는 주인공을 따라 방향을 고치며 다가서다가(trackLockMs 전부터는 굳힌다) 친다.
 * 묶음 가운데 유독 긴 예비 동작은 늦게 들어오는 한 타(지연 타)다.
 * 묶음 전체가 한 기술이다: 연타 중에는 다른 기술을 쓰지 않는다(CLAUDE.md).
 * Phaser를 쓰지 않아 tools/enemy-combo.test.mjs가 직접 검사한다.
 */
export const ENEMY_COMBO = {
  /** 한 타가 끝난 뒤 다음 타의 예비 동작까지 */
  gapMs: 120,
  /** 연타 중 패링당했을 때 다음 타까지 (튕겨 나갔다가 바로 다시 친다) */
  parryGapMs: 260,
  /** 연타의 마지막 타까지 모두 정밀 패링하면 이만큼 크게 경직한다 */
  breakStunMs: 1800,
  /** 둘째 타부터의 공격력 배율 */
  followDamageScale: 0.75,
  /** 닿기 이만큼 전부터는 방향을 굳힌다 (그 전까지는 주인공을 따라 고친다) */
  trackLockMs: 150,
  /** 예비 동작 중 다가서는 빠르기 (이동 속도 배율) */
  trackSpeedScale: 1.1,
} as const;

export type ComboPattern = readonly number[];

/** 몬스터별 연타 묶음. 없는 몬스터는 예전처럼 한 번 치고 숨을 고른다. */
export const COMBO_PATTERNS: Partial<Record<MonsterKind, readonly ComboPattern[]>> = {
  // 낮게 달려들어 두세 번 할퀸다. 셋째 타는 늦게 들어온다.
  'corrosion-tracker': [[320, 240], [320, 230, 430]],
  // 갈대 사이에서 두 번 벤다. 둘째 타를 늦게 끊어 치기도 한다.
  'reed-stalker': [[360, 250], [360, 520]],
  // 흐르듯 세 번 이어 치거나, 한 번 치고 길게 숨을 들였다 친다.
  'mist-phantom': [[340, 230, 230], [340, 470]],
  // 무거운 한 방, 또는 한 방 뒤 더 무거운 지연 타.
  'frost-beetle': [[520], [520, 640]],
  // 돌진 한 번, 또는 돌아서 한 번 더 돌진.
  'iron-scale-lizard': [[560], [560, 460]],
  // 습격의 집행자(보스가 아닐 때): 무거운 돌진 한 번, 또는 두 번.
  'corrosion-executioner': [[760], [760, 560]],
};

/** 이 몬스터가 연타 묶음을 쓰는지 */
export function hasCombos(kind: MonsterKind | undefined): boolean {
  return kind !== undefined && COMBO_PATTERNS[kind] !== undefined;
}

/** roll(0 이상 1 미만)로 이번 묶음을 고른다. 묶음이 없으면 undefined */
export function pickCombo(kind: MonsterKind | undefined, roll: number): ComboPattern | undefined {
  const list = kind ? COMBO_PATTERNS[kind] : undefined;
  if (!list?.length) return undefined;
  const i = Math.min(list.length - 1, Math.max(0, Math.floor(roll * list.length)));
  return list[i];
}

/** 예비 동작 elapsed ms에 아직 주인공을 따라 방향을 고치는 중인지 */
export function isTracking(elapsed: number, windupMs: number, lockMs: number = ENEMY_COMBO.trackLockMs): boolean {
  return elapsed >= 0 && elapsed < windupMs - lockMs;
}
