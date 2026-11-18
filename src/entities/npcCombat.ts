import { NPC_COMBAT } from '../config.ts';

export type FighterSkin = keyof typeof NPC_COMBAT.profiles;
export type NpcCombatPose = 'guard' | 'attack' | 'hit' | 'injured';
interface Point { x: number; y: number }
export interface NpcCombatTarget extends Point { id: number; alive: boolean; attacking: boolean }
export interface CombatPlan { pose: NpcCombatPose; moveX: number; moveY: number; strike?: number }

export function isFighterSkin(skin: string): skin is FighterSkin {
  return Object.hasOwn(NPC_COMBAT.profiles, skin);
}

/** 피해와 동작 전환을 게임 시계로 처리한다. 공격 한 번은 한 대상에게 한 번만 닿는다. */
export class NpcFighter {
  readonly skin: FighterSkin;
  hp: number;
  pose: NpcCombatPose = 'guard';
  facingX = 1;
  facingY = 0;
  private readyAt = 0;
  private until = 0;
  private strikeAt?: number;
  private targetId?: number;
  private guardUntil = 0;
  private guardReadyAt = 0;
  private invulnerableUntil = 0;

  constructor(skin: FighterSkin) { this.skin = skin; this.hp = NPC_COMBAT.profiles[skin].hp; }

  injure(): void { this.hp = 0; this.pose = 'injured'; this.strikeAt = undefined; }

  step(now: number, position: Point, targets: readonly NpcCombatTarget[],
    clear: (target: Point) => boolean): CombatPlan {
    const plan: CombatPlan = { pose: this.pose, moveX: 0, moveY: 0 };
    if (this.hp <= 0) return { ...plan, pose: 'injured' };
    if (this.pose === 'hit' && now < this.until) return plan;
    if (this.pose === 'attack') {
      if (this.strikeAt !== undefined && now >= this.strikeAt) {
        const target = targets.find(t => t.id === this.targetId && t.alive);
        if (target && Math.hypot(target.x-position.x, target.y-position.y) <= NPC_COMBAT.hitRange && clear(target)) plan.strike = target.id;
        this.strikeAt = undefined;
      }
      if (now < this.until) return plan;
    }
    this.pose = 'guard';
    plan.pose = 'guard';
    const target = targets.filter(t => t.alive && Math.hypot(t.x-position.x, t.y-position.y) <= NPC_COMBAT.engageRadius && clear(t))
      .sort((a, b) => Math.hypot(a.x-position.x, a.y-position.y) - Math.hypot(b.x-position.x, b.y-position.y))[0];
    if (!target) return plan;
    const dx = target.x-position.x, dy = target.y-position.y, distance = Math.hypot(dx, dy) || 1;
    this.facingX = dx / distance; this.facingY = dy / distance;
    if (now < this.guardUntil) return plan;
    if (target.attacking && distance <= NPC_COMBAT.guardRange && now >= this.guardReadyAt) {
      this.guardUntil = now + NPC_COMBAT.guardMs;
      this.guardReadyAt = now + NPC_COMBAT.guardCooldownMs;
    } else if (distance > NPC_COMBAT.attackRange) {
      plan.moveX = dx / distance; plan.moveY = dy / distance;
    } else if (now >= this.readyAt) {
      this.pose = plan.pose = 'attack';
      this.targetId = target.id;
      this.strikeAt = now + NPC_COMBAT.attackWindupMs;
      this.until = now + NPC_COMBAT.attackMs;
      this.readyAt = now + NPC_COMBAT.attackCooldownMs;
    }
    return plan;
  }

  hit(now: number, position: Point, source: Point, damage: number): 'miss' | 'blocked' | 'hit' | 'injured' {
    if (this.hp <= 0 || now < this.invulnerableUntil) return 'miss';
    this.invulnerableUntil = now + NPC_COMBAT.invulnerableMs;
    if (this.pose === 'guard' && now < this.guardUntil
      && (source.x-position.x)*this.facingX + (source.y-position.y)*this.facingY >= 0) return 'blocked';
    this.hp = Math.max(0, this.hp - Math.max(1, Math.round(damage)));
    this.strikeAt = undefined;
    this.pose = this.hp > 0 ? 'hit' : 'injured';
    this.until = now + NPC_COMBAT.hitMs;
    return this.pose;
  }
}
