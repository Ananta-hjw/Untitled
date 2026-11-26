import Phaser from 'phaser';
import shotFrame from '../assets/monsters/waterdrop-mushroom/projectile_frame.json';
import { BLOCK, ENEMY, VERTICAL_SPEED_RATIO } from '../config';
import { hitSquash } from './hitFeel';
import { bossParryOutcome, type BossParryOutcome } from './parry';
import { Character } from '../entities/Character';
import type { NavGrid } from '../world/navGrid';
import type { WalkArea } from '../world/walkArea';
import { MonsterSprite } from './MonsterSprite';
import { MONSTERS, WATER_SHOT, isCharger, monsterKind, enemyHitReaches, type EnemyHit, type EnemyKey, type MonsterKind, type MonsterStats } from './monsterTypes';
import { FOG_CROW, fogEscape } from './fogCrow';
import { scaleMonster } from './monsterLevel';
import { BOSS, fanDirections, insideEllipse, retreatDone, shouldVeil, wantsVolley, type BossPhase } from './bossPattern';
import { BossHazards } from './BossHazards';
import { SWAMP_JET, SwampWaterJet } from './SwampWaterJet';

type State = 'wander' | 'chase' | 'windup' | 'recover' | 'roar' | 'retreat' | 'volley' | 'veil' | 'dead';

/** 보스의 부식 효과가 주인공에게 닿았는지 알린다 (웅덩이 틱, 장막이 터질 때). hit: 장막 범위 안이었는지 */
export type HazardHandler = (enemy: Enemy, kind: 'pool' | 'veil', hit: boolean, dirX: number, dirY: number) => void;
/** 적 공격이 닿기 직전 예고 안광을 띄울 위치와 막기 불가 여부 */
export type GlintHandler = (enemy: Enemy, x: number, y: number, unblockable: boolean) => void;
/** 패링 처리 결과: 보스 연타가 이어지는지, 연타 마지막을 파훼했는지, 일반 경직인지 */
export interface ParryBreakResult {
  outcome: BossParryOutcome;
  step: number;
  total: number;
}

/**
 * 슬라임 근접·버섯 원거리·도마뱀 돌진과 습격 임시 권속의 AI.
 *
 *   배회 → (플레이어가 가까우면) 추격 → 사거리 안이면 준비 동작 → 돌진 공격 → 숨 고르기 → 추격 …
 *
 * 준비 동작(몸을 움츠림) 동안 플레이어가 옆으로 빠지면 공격이 빗나간다.
 */
export class Enemy {
  readonly character: Character;
  readonly kind?: MonsterKind;
  /** 레벨을 반영한 능력치 */
  readonly stats: MonsterStats;
  readonly level: number;
  private readonly aim = { x: 1, y: 0 };
  private chargeProgress = 0;
  private projectile?: { image: Phaser.GameObjects.Image; x: number; y: number; dx: number; dy: number; expires: number };
  private readonly waterJet?: SwampWaterJet;
  state: State = 'wander';
  /** 마지막 돌진이 닿은 시각(게임 시계). 저스트 회피 판정에 쓴다. */
  lastStrikeAt?: number;

  private readonly scene: Phaser.Scene;
  private readonly target = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();
  private readonly waypoint = { x: 0, y: 0 };
  private readonly wanderSpeed: number;
  private timer = 0;
  private attackStartedAt?: number;
  private strikeLanded = false;
  /** 이번 공격의 예고 안광을 이미 띄웠는지 */
  private glintShown = false;
  /** 패링으로 경직되어 휘청이는 기한(게임 시계)과 머리 위 경직 표시 */
  private parryStunUntil = 0;
  private parryStunPerfect = false;
  private readonly staggerMark: Phaser.GameObjects.Graphics;
  /** 마지막으로 맞은 시각(게임 시계). 맞은 뒤 잠깐 몸이 출렁인다. */
  private hitAt?: number;
  private escapedAt = -Infinity;
  private decoy?: { image: Phaser.GameObjects.Image; born: number };

  /** 쓰러질 때 흩어지는 파편의 색 */
  readonly color: number;
  /** 1장 보스인지 (combat/bossPattern.ts): 돌진을 잇달아 하고, 보통 공격에 움찔하지 않으며, 절반에서 포효한다 */
  readonly boss: boolean;
  phase: BossPhase = 1;
  /** 이번 연속 공격에서 남은 돌진 수 */
  private chainLeft = 0;
  /** 이번 연속 공격의 전체 타수 및 연속으로 패링당한 횟수 */
  private chainTotal = 1;
  private comboParries = 0;
  /** 다음 돌진을 기다리는 중 (recover가 끝나면 바로 준비 동작) */
  private chainPending = false;
  private retreatStartedAt = 0;
  /** 2페이즈의 부식 웅덩이·산탄·장막 (보스만) */
  readonly hazards?: BossHazards;
  private veilUsed = false;
  private shotReadyAt = 0;
  private volleyDirs: Array<{ x: number; y: number }> = [];

  constructor(scene: Phaser.Scene, key: EnemyKey, x: number, y: number, level = 1, boss = false) {
    this.scene = scene;
    this.boss = boss;
    if (boss) this.hazards = new BossHazards(scene);
    this.kind = monsterKind(key);
    if (this.kind === 'swamp-lurker') this.waterJet = new SwampWaterJet(scene);
    this.level = level;
    this.stats = scaleMonster<MonsterStats>(MONSTERS[this.kind ?? 'slime'], level);
    this.color = key === 'retainer-ash' ? 0x9c96b3 : this.stats.color;
    this.character = new Character(scene, x, y, {
      key,
      monster: this.kind,
      shadowWidth: this.kind === 'mist-phantom' ? 0 : this.kind === 'fog-crow' ? 54 : 100,
      maxHp: this.stats.hp,
      showHpBar: true,
      levelTag: level,
      labelOffset: this.kind ? this.stats.height + (this.kind === 'fog-crow' ? 36 : 8) : 96,
    });
    this.staggerMark = scene.add.graphics().setVisible(false);
    // 안개 환영은 안개 한 줄기에서 몸이 생기며 나타난다.
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.playFade('materialize');
    this.target.set(x, y);
    this.wanderSpeed = Phaser.Math.Between(50, 80);
    this.timer = Phaser.Math.Between(300, 1800);
  }

  /** onStrike: 돌진이 닿는 순간 호출된다. 실제로 맞았는지는 씬이 판정한다. */
  update(
    time: number,
    dt: number,
    player: Character,
    area: WalkArea,
    nav: NavGrid,
    onStrike: (enemy: Enemy, hit?: EnemyHit) => boolean | void,
    onHazard?: HazardHandler,
    chaseTarget?: { x: number; y: number; alive: boolean },
    onGlint?: GlintHandler,
  ): void {
    const c = this.character;
    // 쓰러진 안개 환영은 흩어지는 그림을 게임 시계로 마저 보여 준다.
    if (this.state === 'dead' && c.sprite instanceof MonsterSprite && c.sprite.hasFade) c.sprite.advance(dt * 1000);
    if (this.state === 'dead' || this.kind === 'mist-weaver') return;
    this.hazards?.update(time, dt, player, area, {
      strike: (hit) => {
        this.lastStrikeAt = time;
        return onStrike(this, hit) === true;
      },
      pool: () => onHazard?.(this, 'pool', true, 0, 0),
    });
    this.updateDecoy(time);
    this.updateHitSquash(time);
    this.updateParryStun(time);
    this.updateProjectile(time, dt, player, area, onStrike);
    if (c.sprite instanceof MonsterSprite) c.sprite.advance(dt * 1000);
    // 안개 환영은 안개에서 몸이 다 생길 때까지 움직이지 않는다.
    if (c.sprite instanceof MonsterSprite && c.sprite.materializing) return;

    const opponent = chaseTarget ?? player;
    const dx = opponent.x - c.x;
    const dy = opponent.y - c.y;
    // 보스는 나타나면 주인공이 어디 있든 쫓는다.
    const playerNear = opponent.alive && (this.boss || (Math.abs(dx) < ENEMY.aggroX && Math.abs(dy) < ENEMY.aggroY));

    switch (this.state) {
      case 'wander': {
        if (playerNear) {
          this.state = 'chase';
          break;
        }
        if (this.waterJet) {
          c.setMotion(false);
          break;
        }
        if (time < this.timer) {
          c.setMotion(false);
          break;
        }
        if (!this.stepToward(this.target.x, this.target.y, this.wanderSpeed * dt, area)) {
          area.randomPoint(this.target);
          this.timer = time + Phaser.Math.Between(600, 2400);
        }
        break;
      }

      case 'chase': {
        if (!opponent.alive || (!this.boss && Math.abs(dx) > ENEMY.aggroX * 1.5)) {
          this.state = 'wander';
          this.target.set(c.x, c.y);
          break;
        }
        // 2페이즈: 체력이 1/4 아래로 처음 떨어지면 부식의 장막, 멀리 있으면 부식 산탄
        if (this.boss && shouldVeil(this.phase, c.hp, c.maxHp, this.veilUsed)) {
          this.startVeil(time);
          break;
        }
        if (this.boss && wantsVolley(this.phase, Math.hypot(dx, dy), time, this.shotReadyAt)) {
          this.startVolley(time, dx, dy);
          break;
        }
        const ranged = this.kind === 'waterdrop-mushroom' || this.waterJet !== undefined;
        const charge = isCharger(this.kind);
        const inRange = ranged ? Math.hypot(dx, dy) <= (this.waterJet ? SWAMP_JET.attackRange : 350) && area.hasClearPath(c.x, c.y, opponent.x, opponent.y)
          : charge ? Math.hypot(dx, dy) <= (this.kind === 'fog-crow' ? 165 : 250) && area.hasClearPath(c.x, c.y, opponent.x, opponent.y)
          : Math.abs(dx) < ENEMY.attackRangeX && Math.abs(dy) < ENEMY.attackRangeY;
        if (inRange) {
          // 보스는 1페이즈 2연타(BOSS.chain), 2페이즈 3연타(BOSS.phaseTwoChain) 돌진을 잇달아 한다.
          const total = this.boss ? (this.phase === 2 ? BOSS.phaseTwoChain : BOSS.chain) : 1;
          this.chainTotal = total;
          this.chainLeft = total - 1;
          this.comboParries = 0;
          this.beginWindup(time, dx, ranged || charge ? dy : 0);
          if (this.waterJet && c.sprite instanceof MonsterSprite) {
            const mouth = c.sprite.swampMouthOffset();
            this.waterJet.prepare(area, c, { x: c.x + mouth.x, y: c.y + mouth.y }, this.aim.x, this.aim.y, Math.hypot(dx, dy));
            this.waterJet.warn(0);
          }
          break;
        }
        // 플레이어의 옆자리(같은 높이)로 붙는다.
        const side = dx > 0 ? -1 : 1;
        const goalX = opponent.x + side * (this.waterJet ? SWAMP_JET.standOff : ranged ? 180 : ENEMY.attackRangeX - 25);
        const step = this.stats.speed * dt;
        // 곧장 갈 수 있으면 곧장 가고, 테이블이나 카운터에 막혀 있으면 격자가 알려 주는 길로 돌아간다.
        if (!chaseTarget && !area.hasClearPath(c.x, c.y, goalX, opponent.y) && nav.next(c.x, c.y, this.waypoint)) {
          this.stepToward(this.waypoint.x, this.waypoint.y, step, area);
        } else {
          this.stepToward(goalX, opponent.y, step, area);
        }
        break;
      }

      case 'windup':
        c.setMotion(false);
        this.updateStrike(time, onStrike, area, onGlint);
        break;

      case 'recover':
        c.setMotion(false);
        if (time < this.timer) break;
        if (this.chainPending && opponent.alive) {
          // 연속 공격의 다음 돌진: 쉬는 동안 움직인 주인공 쪽을 다시 겨눈다.
          this.chainPending = false;
          this.beginWindup(time, dx, dy);
        } else {
          this.chainPending = false;
          this.state = 'chase';
        }
        break;

      case 'volley': {
        // 웅크렸다가 겨눈 방향으로 부채꼴 산탄
        c.setMotion(false, this.aim.x);
        const t = 1 - Math.max(0, this.timer - time) / BOSS.shot.windupMs;
        c.sprite.setScale(1 + 0.12 * t, 1 - 0.14 * t);
        if (time >= this.timer) {
          c.sprite.setScale(1);
          this.hazards?.fire(c.x, c.y, this.volleyDirs);
          this.shotReadyAt = time + BOSS.shot.cooldownMs;
          this.state = 'recover';
          this.timer = time + BOSS.shot.recoverMs;
        }
        break;
      }

      case 'veil': {
        // 범위를 그리며 몸을 떨다가 터뜨린다. 시전 중에는 자리를 고정해 바닥 범위와 판정이 어긋나지 않게 한다.
        c.knockback.set(0, 0);
        c.setMotion(false, dx);
        const shake = Math.sin(time / 30) * 3;
        c.sprite.setPosition(shake, 0);
        if (!this.glintShown && this.timer - time <= 300) {
          this.glintShown = true;
          onGlint?.(this, c.x, c.y - Math.round((this.stats.height || 100) * 0.65), true);
        }
        if (time >= this.timer) {
          c.sprite.setPosition(0, 0);
          this.hazards?.burstVeil(time);
          const distance = Math.hypot(dx, dy) || 1;
          onHazard?.(this, 'veil', insideEllipse(dx, dy, BOSS.veil.rx, BOSS.veil.ry), dx / distance, dy / distance);
          if (this.state !== 'veil') break;
          this.state = 'recover';
          this.timer = time + BOSS.veil.recoverMs;
        }
        break;
      }

      case 'roar': {
        // 포효: 제자리에서 몸을 크게 부풀렸다 줄인다.
        c.setMotion(false, dx);
        const pulse = Math.abs(Math.sin((time - (this.timer - BOSS.roarMs)) / 90));
        c.sprite.setScale(1 + 0.12 * pulse, 1 + 0.08 * pulse);
        if (time >= this.timer) {
          c.sprite.setScale(1);
          this.state = 'retreat';
          this.retreatStartedAt = time;
        }
        break;
      }

      case 'retreat': {
        // 주인공을 바라본 채 뒤로 물러나 거리를 벌린 뒤 2페이즈를 시작한다.
        const distance = Math.hypot(dx, dy) || 1;
        const step = BOSS.retreatSpeed * dt;
        const next = area.move(c.x, c.y, (-dx / distance) * step, (-dy / distance) * step, this.scratch);
        const blocked = Math.hypot(next.x - c.x, next.y - c.y) < step * 0.2;
        if (!blocked) c.placeAt(next.x, next.y);
        c.setMotion(!blocked, dx);
        if (c.sprite instanceof MonsterSprite) c.sprite.setMovement(dx, dy);
        if (retreatDone(distance, time - this.retreatStartedAt, blocked)) {
          c.setMotion(false, dx);
          this.phase = 2;
          this.state = 'chase';
        }
        break;
      }
    }
  }

  /**
   * 패링·불완전 막기에 당했을 때:
   * - 보스 연타 중 남은 타격이 있으면 바로 끊지 않고 짧은 박자(BOSS.parryChainGapMs)로 다음 돌진을 이어 간다('continueChain').
   * - 마지막 타까지 정밀 패링으로 받아내면 대경직('chainBreak')에 빠진다.
   */
  onParried(
    time: number,
    durationMs: number,
    dirX: number,
    dirY: number,
    push: number,
    perfect: boolean,
  ): ParryBreakResult {
    const c = this.character;
    if (this.state === 'dead' || this.state === 'roar' || this.state === 'retreat' || this.state === 'veil') {
      return { outcome: 'normalBreak', step: 1, total: 1 };
    }
    if (perfect) this.comboParries += 1;
    const step = this.comboParries;
    const total = Math.max(step, this.chainTotal);
    const outcome = bossParryOutcome(this.boss, this.chainLeft, step, perfect);

    if (outcome === 'continueChain') {
      // 보스 연타 유지: 튕겨 나갔다가 짧은 리듬 간격 뒤에 바로 다음 돌진으로 이어진다.
      this.hazards?.clearAim();
      this.cancelStrike();
      this.chainLeft = Math.max(0, this.chainLeft - 1);
      this.chainPending = true;
      this.parryStunUntil = 0;
      this.staggerMark.setVisible(false);
      this.state = 'recover';
      this.timer = time + BOSS.parryChainGapMs;
      this.hitAt = time;
      const { scaleX, scaleY } = hitSquash(0);
      c.sprite.setScale(scaleX, scaleY).setPosition(0, 0);
      c.flash(perfect ? 0xbef0ff : 0xffb35a);
      c.knockback.set(dirX * push * 0.45, dirY * push * 0.45 * VERTICAL_SPEED_RATIO);
      return { outcome, step, total };
    }

    const stun = outcome === 'chainBreak' ? BOSS.parryChainStunMs : durationMs;
    const pushScale = outcome === 'chainBreak' ? 1.45 : this.boss ? 0.7 : 1;
    this.interrupt(time, stun);
    if (this.state === 'recover') {
      this.hitAt = time;
      this.parryStunUntil = time + stun;
      this.parryStunPerfect = perfect;
      const { scaleX, scaleY } = hitSquash(0);
      c.sprite.setScale(scaleX, scaleY);
      c.flash(outcome === 'chainBreak' ? 0xffe880 : perfect ? 0xbef0ff : 0xffb35a);
      c.knockback.set(dirX * push * pushScale, dirY * push * pushScale * VERTICAL_SPEED_RATIO);
    }
    return { outcome, step, total };
  }

  /** 차지 패링(무량반격) 파훼: 부식의 장막이나 보스 연타까지 모두 끊고 초대형 경직에 빠뜨린다. */
  onUnboundParried(time: number, durationMs: number, dirX: number, dirY: number, push: number): void {
    if (this.state === 'dead' || this.state === 'roar' || this.state === 'retreat') return;
    const c = this.character;
    this.hazards?.clearAim();
    this.hazards?.cancelVeil();
    this.cancelStrike();
    this.chainLeft = 0;
    this.chainPending = false;
    this.comboParries = 0;
    this.state = 'recover';
    this.timer = time + durationMs;
    this.hitAt = time;
    this.parryStunUntil = time + durationMs;
    this.parryStunPerfect = true;
    const { scaleX, scaleY } = hitSquash(0);
    c.sprite.setScale(scaleX, scaleY).setPosition(0, 0);
    c.flash(0xfff2a6);
    c.knockback.set(dirX * push * 1.65, dirY * push * 1.65 * VERTICAL_SPEED_RATIO);
  }

  /** 맞으면 준비 동작이 끊기고 잠깐 멈칫한다. 저스트 회피를 당하면 더 오래 멈춘다. */
  interrupt(time: number, durationMs: number = ENEMY.staggerMs): void {
    if (this.state === 'dead' || this.state === 'roar' || this.state === 'retreat' || this.state === 'veil') return;
    this.hazards?.clearAim();
    this.cancelStrike();
    // 패링·저스트 회피로 멈칫하면 이어 하려던 돌진도 끊긴다.
    this.chainLeft = 0;
    this.chainPending = false;
    this.character.sprite.setScale(1).setPosition(0, 0);
    this.state = 'recover';
    this.timer = time + durationMs;
  }

  /** 패링으로 경직된 동안 몸이 흔들리고 머리 위에 경직 표식이 회전한다. */
  private updateParryStun(time: number): void {
    const active = this.state === 'recover' && time < this.parryStunUntil;
    this.staggerMark.setVisible(active);
    if (!active) {
      if (this.parryStunUntil > 0) {
        this.parryStunUntil = 0;
        if (this.state !== 'veil') this.character.sprite.setPosition(0, 0);
      }
      return;
    }
    const c = this.character;
    const remain = Math.max(0, (this.parryStunUntil - time) / 1200);
    const wobble = Math.sin(time / 42) * (this.parryStunPerfect ? 3.2 : 1.8) * Math.min(1, remain + 0.25);
    c.sprite.setPosition(wobble, 0);
    const headY = c.y - (this.stats.height || 100) - 24;
    const g = this.staggerMark.clear().setDepth(c.y + 420);
    const color = this.parryStunPerfect ? 0xffe270 : 0xffa654;
    const orbit = time / 190;
    for (let i = 0; i < 3; i++) {
      const a = orbit + (i * Math.PI * 2) / 3;
      const sx = c.x + Math.cos(a) * 20;
      const sy = headY + Math.sin(a) * 6;
      const r = this.parryStunPerfect ? 5 : 3.5;
      g.fillStyle(color, 0.95).fillPoints([
        new Phaser.Math.Vector2(sx, sy - r),
        new Phaser.Math.Vector2(sx + r * 0.45, sy),
        new Phaser.Math.Vector2(sx, sy + r),
        new Phaser.Math.Vector2(sx - r * 0.45, sy),
      ], true);
    }
  }

  /** 칼에 맞았을 때: 그 자리에서 납작해졌다가 출렁이며 돌아온다 (게임 시계 기준). */
  onHit(time: number, area?: WalkArea, threat?: { x: number; y: number }): void {
    if (this.kind === 'fog-crow' && this.character.alive && area && threat && time - this.escapedAt >= FOG_CROW.cooldownMs) {
      const c = this.character;
      const point = fogEscape(c, threat, (x, y) => area.hasClearPath(c.x, c.y, x, y)
        && [[0, 0], [-18, 0], [18, 0], [0, -12], [0, 12]].every(([dx, dy]) => area.contains(x + dx, y + dy)));
      if (point && c.sprite instanceof MonsterSprite) {
        this.clearDecoy();
        this.decoy = { image: c.sprite.createAfterimage(c.x, c.y).setAlpha(0.48), born: time };
        this.escapedAt = time;
        this.interrupt(time, FOG_CROW.recoverMs);
        c.knockback.set(0, 0);
        c.placeAt(point.x, point.y);
        this.hitAt = undefined;
        return;
      }
    }
    if (this.state === 'roar') return;
    this.hitAt = time;
    const { scaleX, scaleY } = hitSquash(0);
    this.character.sprite.setScale(scaleX, scaleY);
  }

  private updateDecoy(time: number): void {
    if (!this.decoy) return;
    const age = (time - this.decoy.born) / FOG_CROW.decoyMs;
    if (age >= 1) this.clearDecoy();
    else this.decoy.image.setAlpha(0.48 * (1 - Math.max(0, age)));
  }

  private clearDecoy(): void {
    this.decoy?.image.destroy();
    this.decoy = undefined;
  }

  private updateHitSquash(time: number): void {
    if (this.hitAt === undefined || this.state === 'windup' || this.state === 'volley') return;
    const { scaleX, scaleY } = hitSquash(time - this.hitAt);
    this.character.sprite.setScale(scaleX, scaleY);
    if (scaleX === 1 && scaleY === 1) this.hitAt = undefined;
  }

  /** 포효해서 칼에 맞지 않는 중 (보스의 페이즈 전환) */
  get untouchable(): boolean {
    return this.state === 'roar' || this.kind === 'mist-weaver';
  }

  private startVolley(time: number, dx: number, dy: number): void {
    const c = this.character;
    const distance = Math.hypot(dx, dy) || 1;
    this.aim.x = dx / distance;
    this.aim.y = dy / distance;
    this.volleyDirs = fanDirections(this.aim.x, this.aim.y, BOSS.shot.count, BOSS.shot.spreadDeg);
    this.state = 'volley';
    this.timer = time + BOSS.shot.windupMs;
    this.hazards?.showAim(c.x, c.y, this.volleyDirs, time, this.timer);
    c.setMotion(false, dx);
    if (c.sprite instanceof MonsterSprite) c.sprite.setMovement(dx, dy);
  }

  private startVeil(time: number): void {
    const c = this.character;
    this.veilUsed = true;
    this.glintShown = false;
    this.chainLeft = 0;
    this.chainPending = false;
    this.state = 'veil';
    this.timer = time + BOSS.veil.telegraphMs;
    this.hazards?.startVeil(c.x, c.y, time);
    c.setMotion(false);
  }

  /** 보스 2페이즈 전환: 하던 공격을 멈추고 포효한 뒤 물러난다. */
  startRoar(time: number): void {
    if (this.state === 'dead') return;
    this.cancelStrike();
    this.clearProjectile();
    this.chainLeft = 0;
    this.chainPending = false;
    this.hitAt = undefined;
    this.parryStunUntil = 0;
    this.staggerMark.setVisible(false);
    this.character.sprite.setPosition(0, 0).setScale(1);
    this.character.knockback.set(0, 0);
    this.state = 'roar';
    this.timer = time + BOSS.roarMs;
  }

  kill(): void {
    this.clearDecoy();
    this.hazards?.clear();
    this.hitAt = undefined;
    this.parryStunUntil = 0;
    this.staggerMark.setVisible(false);
    this.state = 'dead';
    this.cancelStrike();
    this.clearProjectile();
    this.character.playDeath();
  }

  respawn(x: number, y: number): void {
    this.clearDecoy();
    this.escapedAt = -Infinity;
    this.hitAt = undefined;
    this.parryStunUntil = 0;
    this.staggerMark.setVisible(false);
    this.clearProjectile();
    this.cancelStrike();
    this.character.revive(x, y);
    const sprite = this.character.sprite;
    if (sprite instanceof MonsterSprite && sprite.hasFade) sprite.playFade('materialize');
    else {
      this.character.setAlpha(0);
      this.scene.tweens.add({ targets: this.character, alpha: 1, duration: 400 });
    }
    this.target.set(x, y);
    this.state = 'wander';
    this.timer = 0;
  }

  private cancelStrike(): void {
    this.attackStartedAt = undefined;
    this.strikeLanded = false;
    this.glintShown = false;
    this.waterJet?.clear();
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.endStrike();
  }

  private beginWindup(time: number, dx: number, dy = 0): void {
    this.state = 'windup';
    this.hitAt = undefined;
    this.attackStartedAt = time;
    this.strikeLanded = false;
    this.glintShown = false;
    const distance = Math.hypot(dx, dy) || 1;
    this.aim.x = dx / distance;
    this.aim.y = dy / distance;
    this.chargeProgress = 0;
    this.character.setMotion(false, dx);
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.setMovement(dx, dy);
    this.character.sprite.setScale(1).setPosition(0, 0);
  }

  /** 명중과 자세 모두 씬의 게임 시계를 사용한다. Tween 완료로 피해를 주지 않는다. */
  private updateStrike(time: number, onStrike: (enemy: Enemy, hit?: EnemyHit) => boolean | void,
    area: WalkArea, onGlint?: GlintHandler): void {
    if (this.attackStartedAt === undefined) return;
    const elapsed = time - this.attackStartedAt;
    const sprite = this.character.sprite;
    const { windupMs, strikeMs, returnMs, recoverMs } = this.stats;
    const strikeAt = windupMs + strikeMs;
    const endAt = strikeAt + returnMs;
    // 공격이 닿기 BLOCK.glintLeadMs 전: 패링 타이밍을 읽어낼 수 있게 무기/앞쪽에서 십자 안광이 번쩍인다.
    const impactLeadAt = this.waterJet || isCharger(this.kind) ? windupMs : strikeAt;
    if (!this.glintShown && elapsed >= Math.max(0, impactLeadAt - BLOCK.glintLeadMs)) {
      this.glintShown = true;
      const c = this.character;
      const gx = c.x + this.aim.x * 36;
      const gy = c.y - Math.round((this.stats.height || 96) * 0.56) + this.aim.y * 12;
      onGlint?.(this, gx, gy, false);
    }
    if (sprite instanceof MonsterSprite) {
      sprite.showAttack(elapsed, windupMs, strikeMs, returnMs);
      if (this.waterJet) {
        if (elapsed < windupMs) this.waterJet.warn(elapsed / windupMs);
        else if (elapsed >= strikeAt) this.waterJet.fade(elapsed - strikeAt, returnMs);
        else {
          const hit = this.waterJet.strike(elapsed - windupMs, strikeMs);
          if (hit && !this.strikeLanded) {
            this.lastStrikeAt = time;
            this.strikeLanded = onStrike(this, hit) === true;
            if (this.state !== 'windup') return;
          }
        }
      } else if (isCharger(this.kind) && elapsed >= windupMs) {
        const progress = Math.min(1, (elapsed - windupMs) / strikeMs);
        if (progress > this.chargeProgress) {
          const c = this.character, fromX = c.x, fromY = c.y;
          const distance = (progress - this.chargeProgress) * (this.kind === 'fog-crow' ? FOG_CROW.swoopDistance : 260);
          area.move(c.x, c.y, this.aim.x * distance, this.aim.y * distance, this.scratch);
          c.placeAt(this.scratch.x, this.scratch.y);
          this.chargeProgress = progress;
          if (!this.strikeLanded) {
            this.lastStrikeAt = time;
            this.strikeLanded = onStrike(this, { fromX, fromY, toX: c.x, toY: c.y,
              radiusX: this.kind === 'fog-crow' ? 42 : 65, radiusY: this.kind === 'fog-crow' ? 28 : 38, dx: this.aim.x, dy: this.aim.y }) === true;
            if (this.state !== 'windup') return;
          }
        }
      } else if (this.kind !== 'waterdrop-mushroom') {
        const reach = elapsed < windupMs ? 0 : elapsed < strikeAt ? 46 * ((elapsed - windupMs) / strikeMs) ** 2
          : 46 * (1 - Math.min(1, (elapsed - strikeAt) / returnMs));
        sprite.setPosition(this.aim.x * reach, this.aim.y * reach);
      }
    } else if (elapsed < windupMs) {
      const p = 1 - (1 - elapsed / windupMs) ** 2;
      sprite.setScale(1 + 0.25 * p, 1 - 0.3 * p);
    } else if (elapsed < strikeAt) {
      const p = ((elapsed - windupMs) / strikeMs) ** 2;
      sprite.setX(this.character.facing * 46 * p).setScale(1.25 - 0.35 * p, 0.7 + 0.45 * p);
    } else {
      const p = 1 - (1 - Math.min(1, (elapsed - strikeAt) / returnMs)) ** 2;
      sprite.setX(this.character.facing * 46 * (1 - p)).setScale(0.9 + 0.1 * p, 1.15 - 0.15 * p);
    }
    if (elapsed >= strikeAt && !this.strikeLanded && !this.waterJet && !isCharger(this.kind)) {
      this.strikeLanded = true;
      this.lastStrikeAt = this.attackStartedAt + strikeAt;
      if (sprite instanceof MonsterSprite) sprite.showAttack(strikeAt - 1, windupMs, strikeMs, returnMs);
      if (this.kind === 'waterdrop-mushroom') this.fireProjectile(time);
      else onStrike(this);
      if (this.state !== 'windup') return;
    }
    if (elapsed >= endAt) {
      // 2페이즈: 돌진이 끝난 자리에 부식 웅덩이가 남는다.
      if (this.boss && this.phase === 2 && isCharger(this.kind)) this.hazards?.addPool(this.character.x, this.character.y, 1, time);
      this.state = 'recover';
      const chained = this.chainLeft > 0;
      if (chained) this.chainLeft--;
      this.chainPending = chained;
      this.timer = this.attackStartedAt + endAt + (chained ? BOSS.chainGapMs : recoverMs);
      this.attackStartedAt = undefined;
      this.waterJet?.clear();
      sprite.setPosition(0, 0).setScale(1);
      if (sprite instanceof MonsterSprite) sprite.endStrike();
    }
  }

  private fireProjectile(time: number): void {
    this.clearProjectile();
    const x = this.character.x + this.aim.x * 25, y = this.character.y + this.aim.y * 25;
    const texture = this.scene.textures.get('monster-water-shot');
    if (!texture.has('bead')) texture.add('bead', 0, shotFrame.x, shotFrame.y, shotFrame.w, shotFrame.h);
    const image = this.scene.add.image(x, y - 45, 'monster-water-shot', 'bead').setOrigin(0.8, 0.5).setDisplaySize(44, 24)
      .setRotation(Math.atan2(this.aim.y, this.aim.x)).setDepth(y + 1);
    this.projectile = { image, x, y, dx: this.aim.x, dy: this.aim.y, expires: time + WATER_SHOT.lifetimeMs };
  }

  private updateProjectile(time: number, dt: number, player: Character, area: WalkArea,
    onStrike: (enemy: Enemy, hit?: EnemyHit) => boolean | void): void {
    const shot = this.projectile;
    if (!shot) return;
    if (time >= shot.expires || !player.alive) { this.clearProjectile(); return; }
    const x = shot.x + shot.dx * WATER_SHOT.speed * dt, y = shot.y + shot.dy * WATER_SHOT.speed * dt;
    if (!area.hasClearPath(shot.x, shot.y, x, y)) { this.clearProjectile(); return; }
    const hit = { fromX: shot.x, fromY: shot.y, toX: x, toY: y,
      radiusX: WATER_SHOT.radiusX, radiusY: WATER_SHOT.radiusY, dx: shot.dx, dy: shot.dy };
    this.lastStrikeAt = time;
    const consumed = onStrike(this, hit) === true;
    if (consumed || enemyHitReaches(hit, player.x, player.y)) { this.clearProjectile(); return; }
    shot.x = x; shot.y = y;
    shot.image.setPosition(x, y - 45).setDepth(y + 1);
  }

  private clearProjectile(): void {
    this.projectile?.image.destroy();
    this.projectile = undefined;
  }

  /** 목표를 향해 한 걸음. 도착했거나 막혔으면 false. */
  private stepToward(x: number, y: number, step: number, area: WalkArea): boolean {
    const c = this.character;
    const dx = x - c.x;
    const dy = y - c.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 6) {
      c.setMotion(false);
      return false;
    }
    const next = area.move(c.x, c.y, (dx / distance) * step, (dy / distance) * step, this.scratch);
    if (next.x === c.x && next.y === c.y) {
      c.setMotion(false);
      return false;
    }
    c.placeAt(next.x, next.y);
    c.setMotion(true, dx);
    if (c.sprite instanceof MonsterSprite) c.sprite.setMovement(dx, dy);
    return true;
  }
}
