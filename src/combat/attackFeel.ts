import { ATTACK_FEEL } from '../config.ts';
import type { StrikeHitKind } from './hitFeel.ts';

/**
 * 공격 손맛 계산: 상태별 검기 스타일, 연속 히트 카운터, 반격 돌진 일섬 거리,
 * 공격·처치 미세 줌 펀치, 탄성 데미지 숫자 모션.
 * Phaser를 쓰지 않는 순수 모듈이라 tools/attack-feel.test.mjs가 직접 불러 검사한다.
 */

export type TrailStyle = 'stage1' | 'stage2' | 'finisher' | 'counter' | 'resonance';

export interface HitComboState {
  count: number;
  lastAt: number;
}

/** 콤보 단계·반격·공명 상태에 따라 검기 색과 질감을 결정한다. */
export function attackTrailStyle(stage: number, counter: boolean, resonating: boolean): TrailStyle {
  if (counter) return 'counter';
  if (resonating) return 'resonance';
  if (stage >= 2) return 'finisher';
  if (stage === 1) return 'stage2';
  return 'stage1';
}

/** 연속 히트 카운터를 올린다. timeoutMs가 지났으면 새로 1부터 센다. */
export function nextHitCombo(
  previous: HitComboState,
  now: number,
  add = 1,
  timeoutMs = ATTACK_FEEL.comboTimeoutMs,
): HitComboState {
  const gain = Math.max(1, Math.floor(add));
  const alive = previous.count > 0 && Number.isFinite(previous.lastAt) && now >= previous.lastAt && now - previous.lastAt <= timeoutMs;
  return { count: alive ? previous.count + gain : gain, lastAt: now };
}

/** 히트 카운터가 아직 살아 있는지. */
export function isHitComboActive(
  state: HitComboState,
  now: number,
  timeoutMs = ATTACK_FEEL.comboTimeoutMs,
): boolean {
  return state.count > 0 && Number.isFinite(state.lastAt) && now >= state.lastAt && now - state.lastAt <= timeoutMs;
}

/**
 * 반격 돌진 일섬 거리 계산.
 * - 일반 공격: 기본 전진 거리(baseDistance) 유지.
 * - 반격 돌진 일섬(counter): 목표 적 앞(counterRushStopGap)까지 단번에 꽂히도록 거리를 늘린다.
 */
export function counterLungeDistance(
  baseDistance: number,
  targetDistance: number | undefined,
  counter: boolean,
): number {
  if (!counter) return baseDistance;
  if (targetDistance === undefined || !Number.isFinite(targetDistance)) return ATTACK_FEEL.counterRushDefaultLunge;
  const desired = targetDistance - ATTACK_FEEL.counterRushStopGap;
  return Math.max(ATTACK_FEEL.counterRushMinLunge, Math.min(ATTACK_FEEL.counterRushMaxLunge, desired));
}

/** 공격 종류와 처치 여부에 따른 미세 카메라 줌 펀치 최대 배율(1 = 줌 없음). */
export function attackZoomPeak(
  kind: StrikeHitKind | undefined,
  killed: boolean,
  lastKill: boolean,
): number {
  if (lastKill) return ATTACK_FEEL.lastKillZoomPeak;
  let peak = 1;
  if (kind === 'crit') peak = Math.max(peak, ATTACK_FEEL.critZoomPeak);
  else if (kind === 'finisher') peak = Math.max(peak, ATTACK_FEEL.finisherZoomPeak);
  else if (kind === 'counter') peak = Math.max(peak, ATTACK_FEEL.counterZoomPeak);
  if (killed) peak = Math.max(peak, ATTACK_FEEL.killZoomPeak);
  return peak;
}

/**
 * 데미지 숫자의 탄성 팝인 배율과 알파.
 * t ∈ [0, 1]: 초반 0~0.16 구간에서 크게 튀었다가 탄성 있게 안착하고, 끝 0.72~1에서 사라진다.
 */
export function damageNumberMotion(t: number, heavy: boolean): { scaleMult: number; riseRatio: number; alpha: number } {
  const clamped = Math.max(0, Math.min(1, t));
  const peak = heavy ? 1.75 : 1.48;
  const pop = clamped < 0.16
    ? peak - (peak - 1) * (1 - (1 - clamped / 0.16) * (1 - clamped / 0.16))
    : 1;
  const riseRatio = 1 - (1 - clamped) * (1 - clamped);
  const alpha = clamped >= 1 ? 0 : clamped < 0.68 ? 1 : Math.max(0, 1 - (clamped - 0.68) / 0.32);
  return { scaleMult: pop, riseRatio, alpha };
}
