import { BLOCK } from '../config.ts';
import type { EnemyHit, MonsterKind } from './monsterTypes.ts';

/**
 * 적 지연 추적(Late Tracking) 및 근접 전진 스텝(Forward Lunge) 순수 계산 모듈.
 *
 * - 예고(windup) 시간은 유지해 패링 타이밍을 읽기 쉽게 두되,
 *   예고 앞쪽 약 68~72%(안광 번쩍이기 직전)까지는 적이 플레이어 쪽으로 계속 방향을 튼다.
 * - 안광(glint) 시점에 조준이 잠기므로 그 뒤 패링·저스트 회피는 공정하게 작동하며,
 *   근접 적은 타격 구간에 잠긴 2D 방향으로 실제 몸을 전진 스텝(Lunge)해 걸어서 날먹하는 회피를 차단한다.
 * Phaser를 쓰지 않아 tools/enemy-tracking.test.mjs가 직접 불러 검사한다.
 */

export interface MeleeLungeConfig {
  /** 최대 전진 거리 (px) */
  distance: number;
  /** 제자리에 서서 패링을 기다리는 플레이어 뒤로 지나치지 않도록 유지하는 최소 정면 간격 (px) */
  stopGap: number;
  /** 전진 끝점에서 칼날/앞발이 더 뻗어 나가는 전방 사거리 (px) */
  reachForward: number;
  /** 타격 캡슐 가로 반지름 (px) */
  radiusX: number;
  /** 타격 캡슐 세로 반지름 (px) */
  radiusY: number;
}

const DEFAULT_LUNGE: MeleeLungeConfig = {
  distance: 78,
  stopGap: 42,
  reachForward: 56,
  radiusX: 74,
  radiusY: 58,
};

const MELEE_LUNGE_BY_KIND: Partial<Record<MonsterKind, MeleeLungeConfig>> = {
  'corrosion-tracker': { distance: 96, stopGap: 40, reachForward: 60, radiusX: 76, radiusY: 60 },
  'mist-phantom': { distance: 96, stopGap: 40, reachForward: 60, radiusX: 76, radiusY: 60 },
  'ashen-moth': { distance: 84, stopGap: 42, reachForward: 56, radiusX: 74, radiusY: 58 },
  'reed-stalker': { distance: 84, stopGap: 42, reachForward: 56, radiusX: 74, radiusY: 58 },
  'frost-beetle': { distance: 60, stopGap: 44, reachForward: 48, radiusX: 70, radiusY: 52 },
};

const TURN_RATE_BY_KIND: Partial<Record<MonsterKind, number>> = {
  // 서리 딱정벌레는 느리게 돌아 등 뒤를 잡는 개성을 유지한다.
  'frost-beetle': 2.2,
  'swamp-lurker': 3.2,
  'corrosion-executioner': 4.6,
  'iron-scale-lizard': 5.0,
  'waterdrop-mushroom': 5.0,
};

/**
 * 준비 동작 중 적이 조준을 잠그는 시각(elapsed ms).
 * 안광이 번쩍이는 시점(impactLeadAt - glintLeadMs)과 맞물려 그 전까지만 지연 추적한다.
 */
export function trackLockMs(
  windupMs: number,
  strikeMs: number,
  immediateStrike: boolean,
  glintLeadMs = BLOCK.glintLeadMs,
): number {
  if (windupMs <= 0) return 0;
  const impactLeadAt = immediateStrike ? windupMs : windupMs + strikeMs;
  const beforeGlint = Math.max(windupMs * 0.48, impactLeadAt - glintLeadMs);
  return Math.min(windupMs * 0.72, beforeGlint);
}

/** 몬스터별 지연 추적 최대 회전 속도 (rad/s). */
export function trackingTurnRate(kind: MonsterKind | undefined): number {
  return (kind && TURN_RATE_BY_KIND[kind]) ?? 6.2;
}

/** 몬스터별 근접 전진 스텝(Lunge) 설정. */
export function meleeLungeConfig(kind: MonsterKind | undefined): MeleeLungeConfig {
  return (kind && MELEE_LUNGE_BY_KIND[kind]) ?? DEFAULT_LUNGE;
}

/**
 * 현재 조준 단위 벡터(aim)를 목표 방향(targetDx, targetDy) 쪽으로 최대 maxTurnRate × dtSec 라디안만큼 부드럽게 회전한다.
 */
export function stepAimTracking(
  aim: { x: number; y: number },
  targetDx: number,
  targetDy: number,
  dtSec: number,
  maxTurnRate: number,
): { x: number; y: number } {
  const aimLen = Math.hypot(aim.x, aim.y);
  const ax = aimLen > 1e-6 ? aim.x / aimLen : 1;
  const ay = aimLen > 1e-6 ? aim.y / aimLen : 0;
  const targetLen = Math.hypot(targetDx, targetDy);
  if (targetLen <= 1e-6 || dtSec <= 0 || maxTurnRate <= 0) return { x: ax, y: ay };
  const tx = targetDx / targetLen;
  const ty = targetDy / targetLen;
  const dot = Math.max(-1, Math.min(1, ax * tx + ay * ty));
  const cross = ax * ty - ay * tx;
  const delta = Math.atan2(cross, dot);
  const maxStep = maxTurnRate * dtSec;
  if (Math.abs(delta) <= maxStep) return { x: tx, y: ty };
  const step = Math.sign(delta) * maxStep;
  const cos = Math.cos(step);
  const sin = Math.sin(step);
  return { x: ax * cos - ay * sin, y: ax * sin + ay * cos };
}

/**
 * 목표와의 거리를 반영한 실제 근접 전진 거리.
 * 정면에서 패링을 기다리는 플레이어 뒤로 통과하지 않도록 stopGap 앞에서 멈추되,
 * 뒤로 물러나는 플레이어를 추격할 수 있게 최소 전진 거리는 보장한다.
 */
export function plannedMeleeLunge(kind: MonsterKind | undefined, targetDistance: number): number {
  const cfg = meleeLungeConfig(kind);
  const minStep = Math.round(cfg.distance * 0.48);
  if (!Number.isFinite(targetDistance) || targetDistance <= 0) return cfg.distance;
  return Math.max(minStep, Math.min(cfg.distance, targetDistance - cfg.stopGap));
}

/** 근접 전진 스텝(Lunge)의 스윕 타격 캡슐을 생성한다. */
export function buildMeleeLungeHit(
  kind: MonsterKind | undefined,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  aim: { x: number; y: number },
): EnemyHit {
  const cfg = meleeLungeConfig(kind);
  const len = Math.hypot(aim.x, aim.y) || 1;
  const dx = aim.x / len;
  const dy = aim.y / len;
  return {
    fromX,
    fromY,
    toX: toX + dx * cfg.reachForward,
    toY: toY + dy * cfg.reachForward,
    radiusX: cfg.radiusX,
    radiusY: cfg.radiusY,
    dx,
    dy,
    melee: true,
  };
}
