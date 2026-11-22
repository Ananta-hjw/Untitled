import type { NpcDef } from '../world/npcs.ts';

/**
 * 동료: 플레이어가 조작하지 않고 주인공을 따라다니며 스스로 싸우는 사람 (Phaser를 쓰지 않아
 * tools/companion.test.mjs가 직접 불러 검사한다). 싸움은 1장 수비대의 entities/npcCombat.ts(NpcFighter)를 그대로 쓴다.
 *
 * - 따라오기: 주인공에게서 followDistance보다 멀면 다가오고, runDistance보다 멀면 뛰며, warpDistance보다 멀면
 *   (길이 막혔거나 맵을 옮긴 뒤) 주인공 뒤로 옮겨 온다.
 * - 싸우기: 주인공에게서 leash 안의 적만 노린다(멀리 혼자 쫓아가지 않는다). 보스는 노리지 않는다.
 * - 쓰러지지 않는다: 체력이 다하면 무릎을 꿇었다가 recoverMs 뒤 다시 일어난다. 주인공이 동료를 지킬 필요가 없다.
 * - 연계: 주인공이 패링·저스트 회피로 적을 휘청이게 하면 동료가 focusMs 동안 그 적을 먼저 노리고, 휘청이는 적에게는 더 세게 친다.
 * - 동료는 주인공보다 약하다: 피해는 주인공 피해의 damageScale.
 */
export const COMPANION = {
  followDistance: 120,
  runDistance: 360,
  warpDistance: 1000,
  /** 따라올 때 주인공 걸음에 대한 빠르기 (가까울 때 / 멀 때) */
  walkScale: 0.95,
  runScale: 1.35,
  /** 주인공에게서 이 거리 안의 적만 노린다 */
  leash: 520,
  recoverMs: 8000,
  focusMs: 2500,
  /** 주인공 피해(평균)에 대한 동료의 피해 비율, 휘청이는 적에게 더하는 배율 */
  damageScale: 0.35,
  staggerBonus: 1.5,
} as const;

/** 함께 다닐 수 있는 동료 */
export type CompanionId = 'joan';

export interface CompanionDef {
  id: CompanionId;
  name: string;
  /**
   * 전투 수치는 테온의 프로필을 재사용한다. 외형은 visualSkin의 조안 SD를 쓴다.
   * 조안의 걷기·전투 시트가 준비되면 별도 전투 프로필로 교체한다.
   */
  skin: 'teon';
  visualSkin: 'joan';
  height: number;
}

export const COMPANIONS: Record<CompanionId, CompanionDef> = {
  joan: { id: 'joan', name: '조안', skin: 'teon', visualSkin: 'joan', height: 142 },
};

export const COMPANION_SAVE_KEY = 'untitled-rpg.companion';

export function isCompanionId(id: unknown): id is CompanionId {
  return typeof id === 'string' && Object.hasOwn(COMPANIONS, id);
}

/** 저장된 동료를 읽는다. 깨졌거나 모르는 값이면 없음 */
export function parseCompanion(raw: string | null): CompanionId | undefined {
  return isCompanionId(raw) ? raw : undefined;
}

/** 동료를 그리는 데 쓰는 NPC 정의 (대화하지 않고, 돌아다니지 않는다) */
export function companionNpcDef(id: CompanionId, at: { x: number; y: number }): NpcDef {
  const def = COMPANIONS[id];
  return {
    id: `companion-${id}`, skin: def.skin, visualSkin: def.visualSkin, name: def.name, role: '동료',
    x: at.x, y: at.y, height: def.height, dialogue: 'npc-joan',
  };
}

/** 주인공 뒤의 자리: 주인공이 바라보는 반대쪽으로 followDistance (바닥 원근으로 세로는 짧게) */
export function followSpot(hero: { x: number; y: number }, facing: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(facing.x, facing.y) || 1;
  return { x: hero.x - (facing.x / length) * COMPANION.followDistance, y: hero.y - (facing.y / length) * COMPANION.followDistance * 0.6 };
}

export type FollowPlan =
  | { kind: 'stay' }
  | { kind: 'move'; x: number; y: number; scale: number }
  | { kind: 'warp' };

/** 동료가 이번에 할 이동: 가까우면 서 있고, 멀면 다가오거나 뛰고, 너무 멀면 옮겨 온다. x, y는 단위 방향 */
export function followPlan(self: { x: number; y: number }, hero: { x: number; y: number }): FollowPlan {
  const dx = hero.x - self.x, dy = hero.y - self.y, distance = Math.hypot(dx, dy);
  if (distance >= COMPANION.warpDistance) return { kind: 'warp' };
  if (distance <= COMPANION.followDistance) return { kind: 'stay' };
  return { kind: 'move', x: dx / distance, y: dy / distance, scale: distance >= COMPANION.runDistance ? COMPANION.runScale : COMPANION.walkScale };
}

/** 이 적을 노려도 되는지: 살아 있고, 보스가 아니고, 주인공에게서 leash 안 */
export function canEngage(enemy: { x: number; y: number; alive: boolean; boss: boolean }, hero: { x: number; y: number }): boolean {
  return enemy.alive && !enemy.boss && Math.hypot(enemy.x - hero.x, enemy.y - hero.y) <= COMPANION.leash;
}

/** 동료가 한 번 칠 때의 피해 (최소 1) */
export function companionDamage(heroDamageMin: number, heroDamageMax: number, staggered: boolean): number {
  const base = ((heroDamageMin + heroDamageMax) / 2) * COMPANION.damageScale;
  return Math.max(1, Math.round(base * (staggered ? COMPANION.staggerBonus : 1)));
}
