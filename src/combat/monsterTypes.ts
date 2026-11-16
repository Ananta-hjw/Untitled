import { ENEMY, PROGRESSION } from '../config.ts';

export type MonsterKind = 'slime' | 'waterdrop-mushroom' | 'iron-scale-lizard' | 'ashen-moth';
export type EnemyKey = 'slime-green' | 'slime-blue' | 'waterdrop-mushroom' | 'iron-scale-lizard' | 'ashen-moth' | 'retainer-ash';
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
} as const;

/** 잿빛 나방의 부식성 가루에 닿으면 잠깐 느려진다 (게임 시계 ms, 이동 속도 배율). */
export const ASH_SLOW = { durationMs: 2000, speedScale: 0.55 };

export const WATER_SHOT = { speed: 360, lifetimeMs: 1800, radiusX: 24, radiusY: 30 };
export interface EnemyHit { fromX: number; fromY: number; toX: number; toY: number; radiusX: number; radiusY: number; dx: number; dy: number }
/** Swept ellipse: prevents fast projectiles and charges tunnelling between game steps. */
export function enemyHitReaches(hit: EnemyHit, x: number, y: number): boolean {
  const ax = (x - hit.fromX) / hit.radiusX, ay = (y - hit.fromY) / hit.radiusY;
  const dx = (hit.toX - hit.fromX) / hit.radiusX, dy = (hit.toY - hit.fromY) / hit.radiusY;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, (ax * dx + ay * dy) / length)) : 0;
  return (ax - dx * t) ** 2 + (ay - dy * t) ** 2 <= 1;
}
