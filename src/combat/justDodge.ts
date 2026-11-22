import { ENEMY } from '../config.ts';

/**
 * 저스트 회피 판정과 느린 화면 계산.
 * Phaser를 쓰지 않는 순수 함수다. tools/just-dodge.test.mjs가 직접 불러 검사한다.
 */

/** 한 프레임 늦게 누른 회피도 인정하는 여유(ms). 게임은 한 프레임을 최대 50ms로 나눈다. */
const LATE_TOLERANCE_MS = 50;

/**
 * 적의 돌진이 (targetX, targetY)에 닿는지. 적이 바라보는 쪽 앞의 일정 범위만 맞는다.
 * facing: 1 = 오른쪽, -1 = 왼쪽
 */
export function strikeReaches(attackerX: number, attackerY: number, facing: number, targetX: number, targetY: number): boolean {
  const forward = (targetX - attackerX) * facing;
  if (forward < -20 || forward > ENEMY.strikeRangeX) return false;
  return Math.abs(targetY - attackerY) <= ENEMY.strikeRangeY;
}

/**
 * 공격이 닿는 시각(strikeAt) 직전 windowMs 안에 회피를 시작했는지.
 * 너무 일찍 피하면 일반 회피다. 공격이 닿은 바로 그 프레임에 누른 것까지는 인정한다.
 */
export function isJustDodge(dodgeStartedAt: number | undefined, strikeAt: number, windowMs: number): boolean {
  if (dodgeStartedAt === undefined) return false;
  const lead = strikeAt - dodgeStartedAt;
  return lead >= -LATE_TOLERANCE_MS && lead <= windowMs;
}

/**
 * 느린 화면에서 게임 시간이 흐르는 배율 (0~1).
 * remainingMs: 느린 화면이 끝날 때까지 남은 실제 시간. 마지막 rampMs 동안 1로 부드럽게 돌아온다.
 */
export function slowMotionScale(remainingMs: number, scale: number, rampMs: number): number {
  if (remainingMs <= 0) return 1;
  if (remainingMs >= rampMs) return scale;
  const t = 1 - remainingMs / rampMs;
  return scale + (1 - scale) * t * t;
}
