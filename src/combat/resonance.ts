/**
 * 공명 게이지와 효과 계산. 게이지는 소수 오차가 없도록 구슬 조각(parts) 단위의 정수로 센다.
 * 이야기 진행으로 능력이 늘면 다른 ResonancePower를 넘기기만 하면 된다.
 * Phaser를 쓰지 않아 tools/resonance.test.mjs가 직접 불러 검사한다.
 */

export interface ResonancePower {
  /** 구슬 수와, 구슬 하나를 채우는 조각 수 */
  orbs: number;
  parts: number;
  /** 패링 한 번에 차는 조각 수 */
  perParry: number;
  /** 공명 한 번에 쓰는 조각 수 */
  cost: number;
  durationMs: number;
  /** 주는 피해 배율, 받는 피해 배율 */
  damageScale: number;
  takenScale: number;
}

export const RESONANCE_SAVE_KEY = 'untitled-rpg.resonance';

export function maxCharge(power: ResonancePower): number {
  return power.orbs * power.parts;
}

/** 패링 한 번: 조각을 채우고 가득 차면 더 늘지 않는다. */
export function chargeOnParry(charge: number, power: ResonancePower): number {
  return Math.min(maxCharge(power), charge + power.perParry);
}

export function canResonate(charge: number, power: ResonancePower, active: boolean): boolean {
  return !active && charge >= power.cost;
}

/** 구슬마다 얼마나 찼는지 (0~1, 왼쪽부터) */
export function orbFill(charge: number, power: ResonancePower): number[] {
  return Array.from({ length: power.orbs }, (_, i) => Math.min(1, Math.max(0, charge - i * power.parts) / power.parts));
}

/** 공명 중 받는 피해: 방어력으로 줄인 피해에 배율을 곱하되 최소 1 */
export function resonanceTaken(damage: number, active: boolean, power: ResonancePower): number {
  return active ? Math.max(1, Math.round(damage * power.takenScale)) : damage;
}

/** 저장된 게이지 읽기: 숫자가 아니거나 범위를 벗어나면 0 */
export function parseCharge(raw: string | null, power: ResonancePower): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= maxCharge(power) ? value : 0;
}
