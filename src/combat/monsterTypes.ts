import { ENEMY, PROGRESSION } from '../config.ts';

export type MonsterKind = 'slime' | 'waterdrop-mushroom' | 'iron-scale-lizard' | 'ashen-moth' | 'corrosion-tracker' | 'corrosion-executioner';
export type EnemyKey = 'slime-green' | 'slime-blue' | 'waterdrop-mushroom' | 'iron-scale-lizard' | 'ashen-moth' | 'corrosion-tracker' | 'corrosion-executioner' | 'retainer-ash';
export function monsterKind(key: EnemyKey): MonsterKind | undefined {
  return key.startsWith('slime-') ? 'slime' : key === 'retainer-ash' ? undefined : key as MonsterKind;
}

export const MONSTERS = {
  slime: { name: '슬라임', hp: ENEMY.maxHp, damage: ENEMY.damage, xp: PROGRESSION.slimeXp, height: 95, speed: ENEMY.chaseSpeed,
    windupMs: ENEMY.windupMs, strikeMs: ENEMY.strikeMs, returnMs: ENEMY.returnMs, recoverMs: ENEMY.recoverMs, color: 0x8fe06a },
  'waterdrop-mushroom': { name: '물방울 버섯', hp: 28, damage: 6, xp: 12, height: 115, speed: 85,
    windupMs: 650, strikeMs: 110, returnMs: 220, recoverMs: 1500, color: 0x77bbd7 },
  'iron-scale-lizard': { name: '쇠비늘 도마뱀', hp: 52, damage: 12, xp: 18, height: 105, speed: 145,
    windupMs: 800, strikeMs: 320, returnMs: 220, recoverMs: 1100, color: 0xa88b69 },
  // 소멸(네이룬)의 하급 권속. 해 질 무렵부터 나타나 부식성 가루를 뿌리며 덮친다. 약하지만 닿으면 몸이 무거워진다.
  'ashen-moth': { name: '잿빛 나방', hp: 20, damage: 5, xp: 10, height: 100, speed: 120,
    windupMs: 450, strikeMs: 140, returnMs: 200, recoverMs: 1300, color: 0x9c96b3 },
  // 습격의 권속 (소멸·네이룬 계열 중급). 추적자는 낮게 달려들어 할퀴고, 집행자는 길게 준비한 뒤 무겁게 돌진한다.
  'corrosion-tracker': { name: '부식의 추적자', hp: 30, damage: 7, xp: 12, height: 100, speed: 150,
    windupMs: 420, strikeMs: 120, returnMs: 200, recoverMs: 850, color: 0x6d6278 },
  // 1장 보스. 레벨 7에서 체력 500·공격력 34 (combat/bossPattern.ts의 패턴을 쓴다)
  'corrosion-executioner': { name: '부식의 집행자', hp: 200, damage: 18, xp: 80, height: 150, speed: 95,
    windupMs: 950, strikeMs: 340, returnMs: 260, recoverMs: 1300, color: 0x5e5468 },
} as const;

/** 길게 준비했다가 잠근 방향으로 돌진하는 몬스터 */
export function isCharger(kind: MonsterKind | undefined): boolean {
  return kind === 'iron-scale-lizard' || kind === 'corrosion-executioner';
}

/** 몬스터 한 마리의 능력치 (레벨을 반영한 값) */
export interface MonsterStats {
  name: string; hp: number; damage: number; xp: number; height: number; speed: number;
  windupMs: number; strikeMs: number; returnMs: number; recoverMs: number; color: number;
}

/** 잿빛 나방의 부식성 가루에 닿으면 잠깐 느려진다 (게임 시계 ms, 이동 속도 배율). */
export const ASH_SLOW = { durationMs: 2000, speedScale: 0.55 };

export const WATER_SHOT = { speed: 360, lifetimeMs: 1800, radiusX: 24, radiusY: 30 };
/** damageScale: 몬스터 공격력에 곱하는 배율 (보스의 부식 산탄 등). 없으면 1 */
export interface EnemyHit { fromX: number; fromY: number; toX: number; toY: number; radiusX: number; radiusY: number; dx: number; dy: number; damageScale?: number }
/** Swept ellipse: prevents fast projectiles and charges tunnelling between game steps. */
export function enemyHitReaches(hit: EnemyHit, x: number, y: number): boolean {
  const ax = (x - hit.fromX) / hit.radiusX, ay = (y - hit.fromY) / hit.radiusY;
  const dx = (hit.toX - hit.fromX) / hit.radiusX, dy = (hit.toY - hit.fromY) / hit.radiusY;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, (ax * dx + ay * dy) / length)) : 0;
  return (ax - dx * t) ** 2 + (ay - dy * t) ** 2 <= 1;
}
