import { BLOCK, HIT_FEEL, JUST_DODGE } from '../config.ts';
import { slowMotionScale } from './justDodge.ts';
import { parrySlowOutScale } from './parry.ts';

/**
 * 타격감 계산: 게임 시간 배율(히트스톱·느린 화면)과 맞은 적의 찌그러짐.
 * Phaser를 쓰지 않는 순수 함수다. tools/hit-feel.test.mjs가 직접 불러 검사한다.
 */

export type StrikeHitKind = 'normal' | 'crit' | 'finisher' | 'counter';
export type HitKind = StrikeHitKind | 'kill' | 'parry' | 'chainBreak' | 'unbound' | 'imperfectGuard' | 'hurt';

/** 이 종류의 타격에서 게임 시간을 멈출 길이(실제 시간 ms) */
export function hitStopMs(kind: HitKind): number {
  switch (kind) {
    case 'crit': return HIT_FEEL.critHitStopMs;
    case 'finisher': return HIT_FEEL.finisherHitStopMs;
    case 'counter': return HIT_FEEL.counterHitStopMs;
    case 'kill': return HIT_FEEL.killHitStopMs;
    case 'parry': return HIT_FEEL.parryHitStopMs;
    case 'chainBreak': return HIT_FEEL.chainBreakHitStopMs;
    case 'unbound': return HIT_FEEL.unboundHitStopMs;
    case 'imperfectGuard': return HIT_FEEL.imperfectGuardHitStopMs;
    case 'hurt': return HIT_FEEL.hurtHitStopMs;
    default: return HIT_FEEL.hitStopMs;
  }
}

/** 이번 프레임에 게임 시간이 흐르는 배율. 히트스톱 중이면 0, 아니면 느린 화면 또는 패링 슬로우아웃 배율. */
export function gameTimeScale(
  hitStopLeftMs: number,
  slowMotionLeftMs: number,
  parrySlowOutLeftMs = 0,
  parrySlowOutScaleVal = BLOCK.slowOutScale,
  parrySlowOutDurationMs = BLOCK.slowOutMs,
): number {
  if (hitStopLeftMs > 0) return 0;
  if (slowMotionLeftMs > 0) return slowMotionScale(slowMotionLeftMs, JUST_DODGE.slowScale, JUST_DODGE.rampMs);
  return parrySlowOutScale(parrySlowOutLeftMs, parrySlowOutScaleVal, parrySlowOutDurationMs);
}

/**
 * 맞은 순간부터 elapsedMs가 지났을 때의 배율. 맞는 순간 가로로 납작해지고(scaleX↑ scaleY↓)
 * 몇 번 출렁이며 원래 모양(1, 1)으로 돌아온다.
 */
export function hitSquash(elapsedMs: number, durationMs = HIT_FEEL.squashMs, amount = HIT_FEEL.squash): { scaleX: number; scaleY: number } {
  if (elapsedMs >= durationMs || elapsedMs < 0) return { scaleX: 1, scaleY: 1 };
  const t = elapsedMs / durationMs;
  const wave = (1 - t) * (1 - t) * Math.cos(t * Math.PI * 3);
  return { scaleX: 1 + amount * wave, scaleY: 1 - amount * 0.85 * wave };
}

/**
 * 한 번의 칼질이 어떤 타격인지 정한다. 반격 > 마무리 일격 > 치명타 > 일반 순으로 무겁다.
 * 반격에는 치명타를 굴리지 않는다. roll은 0 이상 1 미만의 수다.
 */
export function strikeKind(counter: boolean, finisher: boolean, roll: number): { kind: StrikeHitKind; crit: boolean } {
  const crit = !counter && roll < HIT_FEEL.critChance;
  if (counter) return { kind: 'counter', crit: false };
  if (finisher) return { kind: 'finisher', crit };
  return { kind: crit ? 'crit' : 'normal', crit };
}

/** 피해 배율: 치명타면 critDamage를 곱한다. */
export function critMultiplier(crit: boolean): number {
  return crit ? HIT_FEEL.critDamage : 1;
}

/** 여러 적을 한 번에 베었을 때는 가장 무거운 타격 하나로 연출한다. */
export function heavierKind<K extends HitKind>(a: K | undefined, b: K): K {
  const order: HitKind[] = ['normal', 'imperfectGuard', 'crit', 'kill', 'finisher', 'counter', 'parry', 'chainBreak', 'unbound', 'hurt'];
  return a === undefined || order.indexOf(b) > order.indexOf(a) ? b : a;
}
