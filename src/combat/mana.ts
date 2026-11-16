import { MANA } from '../config.ts';

/**
 * 마나 계산 (순수 함수). Phaser를 쓰지 않아 tools/mana.test.mjs가 직접 불러 검사한다.
 * 마나는 소수로 흘러가고(저절로 차는 양), 화면에는 내림한 값을 보여 준다.
 */

/** 레벨별 최대 마나 */
export function maxManaForLevel(level: number): number {
  return MANA.base + MANA.perLevel * (Math.max(1, level) - 1);
}

/** ms(게임 시계)만큼 저절로 찬 마나. 최대를 넘지 않는다. */
export function regenMana(mp: number, max: number, ms: number): number {
  return Math.min(max, mp + MANA.regenPerSecond * Math.max(0, ms) / 1000);
}

/** 마나를 더한다(검으로 벨 때 등). 0과 최대 사이로 맞춘다. */
export function addMana(mp: number, max: number, amount: number): number {
  return Math.max(0, Math.min(max, mp + amount));
}

/** 회전 베기가 닿는지: 주인공 발에서 본 적의 발 위치가 지면 타원(가로 radius, 세로 radius × verticalRatio) 안인지 */
export function inSpinRadius(dx: number, dy: number, radius: number, verticalRatio: number): boolean {
  return Math.hypot(dx, dy / verticalRatio) <= radius;
}
