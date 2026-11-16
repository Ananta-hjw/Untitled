import { ENEMY, PROGRESSION } from '../config.ts';

export type MonsterKind = 'slime' | 'waterdrop-mushroom' | 'iron-scale-lizard';
export type EnemyKey = 'slime-green' | 'slime-blue' | 'waterdrop-mushroom' | 'iron-scale-lizard' | 'retainer-ash';
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
} as const;

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
