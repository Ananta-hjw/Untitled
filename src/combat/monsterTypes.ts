import { ENEMY, PROGRESSION } from '../config.ts';

export type MonsterKind = keyof typeof MONSTERS;
export type EnemyKey = Exclude<MonsterKind, 'slime'> | 'slime-green' | 'slime-blue' | 'retainer-ash';
export function monsterKind(key: EnemyKey): MonsterKind | undefined {
  if (key === 'slime-green' || key === 'slime-blue') return 'slime';
  return key === 'retainer-ash' ? undefined : key;
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
  // 수호(바르덴)의 하급 권속. 2장 동쪽 고갯길. 느리고 단단하며 얼음 껍질이 정면 공격을 막는다(FROST_SHELL).
  'frost-beetle': { name: '서리 딱정벌레', hp: 70, damage: 12, xp: 22, height: 105, speed: 70,
    windupMs: 720, strikeMs: 200, returnMs: 240, recoverMs: 1400, color: 0x9fd8ee },
  'fog-crow': { name: '안개 까마귀', hp: 22, damage: 5, xp: 12, height: 76, speed: 205,
    windupMs: 360, strikeMs: 180, returnMs: 180, recoverMs: 900, color: 0x9daac7 },
  'swamp-lurker': { name: '늪의 잠복 마물', hp: 135, damage: 15, defense: 1.1, xp: 55, height: 130, speed: 78,
    windupMs: 760, strikeMs: 450, returnMs: 320, recoverMs: 1450, color: 0x747e53 },
  'reed-stalker': { name: '갈대밭의 마물', hp: 46, damage: 9, xp: 19, height: 105, speed: 115,
    windupMs: 530, strikeMs: 150, returnMs: 260, recoverMs: 1250, color: 0x537f7d },
  'mist-phantom': { name: '안개 환영', hp: 32, damage: 9, xp: 18, height: 110, speed: 142,
    windupMs: 460, strikeMs: 130, returnMs: 220, recoverMs: 1100, color: 0xa8b8ba },
  // 안개섬의 종 설치 전투가 들어오기 전에는 원화 확인용으로만 표시한다.
  'mist-weaver': { name: '안개를 잣는 자', hp: 1, damage: 0, xp: 0, height: 208, speed: 0,
    windupMs: 0, strikeMs: 0, returnMs: 0, recoverMs: 0, color: 0x8d9fac },
  // 1장 보스. 레벨 7에서 체력 1000·공격력 41·방어 1.2 (combat/bossPattern.ts의 패턴을 쓴다)
  'corrosion-executioner': { name: '부식의 집행자', hp: 400, damage: 21.6, defense: 1.2, xp: 80, height: 150, speed: 95,
    windupMs: 950, strikeMs: 340, returnMs: 260, recoverMs: 1300, color: 0x5e5468 },
} as const;

/** 잠근 방향으로 실제 위치를 옮겨 돌진·덮치기 공격을 하는 몬스터 */
export function isCharger(kind: MonsterKind | undefined): boolean {
  return kind === 'fog-crow' || kind === 'iron-scale-lizard' || kind === 'corrosion-executioner';
}

/**
 * 서리 딱정벌레의 얼음 껍질: 바라보는 쪽에서 frontDegrees 안으로 들어온 공격은 막힌다(피해 없음).
 * 옆과 뒤로 돌아가 베거나, 패링·저스트 회피 뒤의 반격(counter)으로 친다. 몸을 천천히 돌려서(turnMs마다 8방향 한 칸)
 * 빠르게 돌면 등을 잡을 수 있다.
 */
export const FROST_SHELL = { frontDegrees: 60, turnMs: 260 };

/** 이 몬스터가 attacker 쪽에서 온 공격을 껍질로 막는지. facing은 몬스터가 바라보는 방향(화면 좌표). */
export function shellBlocks(kind: MonsterKind | undefined, facing: { x: number; y: number }, toAttackerX: number, toAttackerY: number, counter = false): boolean {
  if (kind !== 'frost-beetle' || counter) return false;
  const a = Math.hypot(facing.x, facing.y), b = Math.hypot(toAttackerX, toAttackerY);
  if (!a || !b) return false;
  return (facing.x * toAttackerX + facing.y * toAttackerY) / (a * b) >= Math.cos(FROST_SHELL.frontDegrees * Math.PI / 180);
}

/** 몬스터 한 마리의 능력치 (레벨을 반영한 값) */
export interface MonsterStats {
  name: string; hp: number; damage: number; xp: number; height: number; speed: number;
  windupMs: number; strikeMs: number; returnMs: number; recoverMs: number; color: number;
  /** 방어: 받는 피해를 이 값으로 나눈다 (없으면 1) */
  defense?: number;
}

/** 방어를 반영해 몬스터가 실제로 받는 피해 (최소 1) */
export function monsterDamageTaken(damage: number, defense = 1): number {
  return Math.max(1, Math.round(damage / defense));
}

/** 잿빛 나방의 부식성 가루에 닿으면 잠깐 느려진다 (게임 시계 ms, 이동 속도 배율). */
export const ASH_SLOW = { durationMs: 2000, speedScale: 0.55 };

export const WATER_SHOT = { speed: 360, lifetimeMs: 1800, radiusX: 24, radiusY: 30 };
/** damageScale: 몬스터 공격력에 곱하는 배율 (보스의 부식 산탄 등). 없으면 1. melee: 근접 스텝 공격 여부 */
export interface EnemyHit { fromX: number; fromY: number; toX: number; toY: number; radiusX: number; radiusY: number; dx: number; dy: number; damageScale?: number; melee?: boolean }
/** Swept ellipse: prevents fast projectiles and charges tunnelling between game steps. */
export function enemyHitReaches(hit: EnemyHit, x: number, y: number): boolean {
  const ax = (x - hit.fromX) / hit.radiusX, ay = (y - hit.fromY) / hit.radiusY;
  const dx = (hit.toX - hit.fromX) / hit.radiusX, dy = (hit.toY - hit.fromY) / hit.radiusY;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, (ax * dx + ay * dy) / length)) : 0;
  return (ax - dx * t) ** 2 + (ay - dy * t) ** 2 <= 1;
}
