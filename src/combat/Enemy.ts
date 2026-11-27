import Phaser from 'phaser';
import shotFrame from '../assets/monsters/waterdrop-mushroom/projectile_frame.json';
import { BLOCK, ENEMY, VERTICAL_SPEED_RATIO } from '../config';
import { hitSquash } from './hitFeel';
import { bossParryOutcome, type BossParryOutcome } from './parry';
import { Character } from '../entities/Character';
import type { NavGrid } from '../world/navGrid';
import type { WalkArea } from '../world/walkArea';
import { MonsterSprite, waterShotTexture } from './MonsterSprite';
import { MONSTERS, WATER_SHOT, isCharger, isEliteKind, isWaterdropMushroom, monsterKind, enemyHitReaches, type EnemyHit, type EnemyKey, type MonsterKind, type MonsterStats } from './monsterTypes';
import { ENEMY_COMBO, pickCombo, type ComboPattern } from './enemyCombo';
import { buildMeleeLungeHit, plannedMeleeLunge, stepAimTracking, trackLockMs, trackingTurnRate } from './enemyTracking';
import { FOG_CROW, fogEscape } from './fogCrow';
import { scaleMonster } from './monsterLevel';
import { BOSS, fanDirections, insideEllipse, retreatDone, shouldVeil, wantsVolley, type BossPhase } from './bossPattern';
import { BossHazards } from './BossHazards';
import { SWAMP_JET, SwampWaterJet } from './SwampWaterJet';

const FAIRY_BLINK = { cooldownMs: 2400, durationMs: 540, escapeDistance: 190, minPlayerDistance: 125 };
const SENTRY_PATROL_HALF = 92;
const BOSS_CAST_POSE_MS = 140;

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
  /** 돌진을 멈추지 않고 지나가게 했는지 (정예·보스의 돌진, 흘린 돌진) */
  passing?: boolean;
}

/** 패링당한 돌진이 끝난 뒤에 줄 경직 (지나가는 동안은 미뤄 둔다) */
interface DeferredParry { outcome: BossParryOutcome; stun: number; perfect: boolean }

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
  /** 근접 전진 스텝(Lunge)의 목표 거리·진행도·시작 위치 */
  private lungeDist = 0;
  private lungeProgress = 0;
  private lungeStartX = 0;
  private lungeStartY = 0;
  private projectile?: { image: Phaser.GameObjects.Image; x: number; y: number; dx: number; dy: number; expires: number };
  private readonly patrolHome?: { x: number; y: number };
  private blink?: { x: number; y: number; start: number; moved: boolean };
  private readonly waterJet?: SwampWaterJet;
  private readonly waterline?: { x: number; y: number };
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
  private volleyStartedAt?: number;
  private volleyDirs: Array<{ x: number; y: number }> = [];
  /** 이번 연타 묶음(타마다의 예비 동작, combat/enemyCombo.ts)과 지금 몇 번째 타인지 */
  private comboWindups?: ComboPattern;
  private comboIndex = 0;
  /** 지금 공격의 예비 동작 길이 */
  private windupMs = 0;
  /** 흡수한 서리로 언 동안 (combat/absorb.ts): 이동 속도 배율과 예비 동작 배율 */
  private chillUntil = 0;
  private chillSpeed = 1;
  private chillWindup = 1;
  private deferredParry?: DeferredParry;

  constructor(scene: Phaser.Scene, key: EnemyKey, x: number, y: number, level = 1, boss = false) {
    this.scene = scene;
    this.boss = boss;
    if (boss) this.hazards = new BossHazards(scene);
    this.kind = monsterKind(key);
    if (this.kind === 'stone-sentry') this.patrolHome = { x, y };
    if (this.kind === 'river-fish-hunter') this.waterline = { x, y };
    if (this.kind === 'swamp-lurker') this.waterJet = new SwampWaterJet(scene);
    this.level = level;
    this.stats = scaleMonster<MonsterStats>(MONSTERS[this.kind ?? 'slime'], level);
    this.color = key === 'retainer-ash' ? 0x9c96b3 : this.stats.color;
    this.character = new Character(scene, x, y, {
      key,
      monster: this.kind,
      shadowWidth: this.kind === 'mist-phantom' || this.kind === 'river-fish-hunter' ? 0 : this.kind === 'fog-crow' ? 54 : 100,
      maxHp: this.stats.hp,
      showHpBar: true,
      levelTag: level,
      labelOffset: this.kind ? this.stats.height + (this.kind === 'fog-crow' ? 36 : 8) : 96,
    });
    this.staggerMark = scene.add.graphics().setVisible(false);
    // 안개 환영은 안개 한 줄기에서 몸이 생기며 나타난다.
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.playFade('materialize');
    this.target.set(x + (this.patrolHome ? SENTRY_PATROL_HALF : 0), y);
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

    if (this.blink && this.updateBlink(time, area)) return;

    const opponent = chaseTarget ?? player;
    const dx = opponent.x - c.x;
    const dy = opponent.y - c.y;
    // 보스는 나타나면 주인공이 어디 있든 쫓는다. 순찰형(stone-sentry)은 자기 영역 안에서 접근 시 추격·교전한다.
    const sentryLeash = this.patrolHome
      ? Math.hypot(c.x - this.patrolHome.x, c.y - this.patrolHome.y) <= 260
      : true;
    const playerNear = opponent.alive && (this.patrolHome
      ? Math.abs(dx) < 220 && Math.abs(dy) < 110 && sentryLeash
        && area.hasClearPath(c.x, c.y, opponent.x, opponent.y)
      : this.boss || (Math.abs(dx) < ENEMY.aggroX && Math.abs(dy) < ENEMY.aggroY));
    if (this.waterJet && c.sprite instanceof MonsterSprite) {
      if (playerNear && c.sprite.swampConcealed) c.sprite.setMovement(dx, dy);
      const transitioning = c.sprite.setSwampBurrowed(this.state === 'wander' && !playerNear);
      c.setConcealed(c.sprite.swampConcealed);
      if (transitioning) {
        c.setMotion(false);
        return;
      }
    }

    switch (this.state) {
      case 'wander': {
        if (playerNear) {
          this.state = 'chase';
          break;
        }
        if (this.waterJet || this.kind === 'river-fish-hunter') {
          c.setMotion(false);
          break;
        }
        if (time < this.timer) {
          c.setMotion(false);
          break;
        }
        const pace = this.patrolHome ? this.stats.speed : this.wanderSpeed;
        if (!this.stepToward(this.target.x, this.target.y, pace * dt, area)) {
          if (this.patrolHome) {
            const side = this.target.x > this.patrolHome.x ? -1 : 1;
            this.target.set(this.patrolHome.x + side * SENTRY_PATROL_HALF, this.patrolHome.y);
          } else area.randomPoint(this.target);
          this.timer = time + Phaser.Math.Between(600, 2400);
        }
        break;
      }

      case 'chase': {
        const lostSentry = this.patrolHome && (Math.abs(dx) > 300 || Math.abs(dy) > 150
          || Math.hypot(c.x - this.patrolHome.x, c.y - this.patrolHome.y) > 260);
        if (!opponent.alive || (this.patrolHome ? lostSentry : !this.boss && Math.abs(dx) > ENEMY.aggroX * 1.5)) {
          this.state = 'wander';
          if (!this.patrolHome) this.target.set(c.x, c.y);
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
        const ranged = isWaterdropMushroom(this.kind) || this.waterJet !== undefined;
        const charge = isCharger(this.kind);
        const inRange = ranged ? Math.hypot(dx, dy) <= (this.waterJet ? SWAMP_JET.attackRange : 350) && area.hasClearPath(c.x, c.y, opponent.x, opponent.y)
          : charge ? Math.hypot(dx, dy) <= (this.kind === 'fog-crow' ? 165 : 250) && area.hasClearPath(c.x, c.y, opponent.x, opponent.y)
          : this.kind === 'river-fish-hunter' ? Math.hypot(dx, dy) <= 145
          : Math.abs(dx) < ENEMY.attackRangeX && Math.abs(dy) < ENEMY.attackRangeY;
        if (inRange) {
          // 보스는 1페이즈 2연타(BOSS.chain), 2페이즈 3연타(BOSS.phaseTwoChain) 돌진을 잇달아 한다.
          // 중급 이상의 적은 연타 묶음(enemyCombo.ts) 하나를 골라 몰아친다.
          const pattern = this.boss ? undefined : pickCombo(this.kind, Math.random());
          const total = this.boss ? (this.phase === 2 ? BOSS.phaseTwoChain : BOSS.chain) : pattern?.length ?? 1;
          this.comboWindups = pattern;
          this.comboIndex = 0;
          this.chainTotal = total;
          this.chainLeft = total - 1;
          this.comboParries = 0;
          this.beginWindup(time, dx, dy);
          if (this.waterJet && c.sprite instanceof MonsterSprite) {
            const mouth = c.sprite.swampMouthOffset();
            this.waterJet.prepare(area, c, { x: c.x + mouth.x, y: c.y + mouth.y }, this.aim.x, this.aim.y, Math.hypot(dx, dy));
            this.waterJet.warn(0);
          }
          break;
        }
        if (this.waterline) {
          c.setMotion(false);
          break;
        }
        // 플레이어의 옆자리(같은 높이)로 붙는다.
        const side = dx > 0 ? -1 : 1;
        const goalX = opponent.x + side * (this.waterJet ? SWAMP_JET.standOff : ranged ? 180 : ENEMY.attackRangeX - 25);
        const step = this.stats.speed * this.speedScale(time) * dt;
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
        this.trackDuringWindup(time, dt, opponent, area);
        this.updateStrike(time, dt, opponent, onStrike, area, onGlint);
        break;

      case 'recover':
        c.setMotion(false);
        if (time < this.timer) break;
        if (c.sprite instanceof MonsterSprite) c.sprite.endSpecial();
        if (this.chainPending && opponent.alive) {
          // 연속 공격의 다음 타: 쉬는 동안 움직인 주인공 쪽을 다시 겨눈다.
          this.chainPending = false;
          this.beginWindup(time, dx, dy);
        } else {
          this.chainPending = false;
          this.state = 'chase';
        }
        break;

      case 'volley': {
        // 웅크렸다가 겨눈 방향으로 부채꼴 산탄 (예고 앞 70% 구간까지 지연 추적 후 잠금)
        const elapsed = this.volleyStartedAt !== undefined ? time - this.volleyStartedAt : BOSS.shot.windupMs;
        if (elapsed <= BOSS.shot.windupMs * 0.7 && dt > 0 && opponent.alive) {
          const next = stepAimTracking(this.aim, dx, dy, dt, trackingTurnRate(this.kind));
          this.aim.x = next.x;
          this.aim.y = next.y;
          this.volleyDirs = fanDirections(this.aim.x, this.aim.y, BOSS.shot.count, BOSS.shot.spreadDeg);
          this.hazards?.showAim(c.x, c.y, this.volleyDirs, time, this.timer);
          if (c.sprite instanceof MonsterSprite) c.sprite.setMovement(this.aim.x, this.aim.y);
        }
        if (!this.glintShown && this.timer - time <= BLOCK.glintLeadMs) {
          this.glintShown = true;
          onGlint?.(this, c.x + this.aim.x * 36, c.y - Math.round((this.stats.height || 120) * 0.56), false);
        }
        c.setMotion(false, this.aim.x);
        if (time >= this.timer) {
          if (c.sprite instanceof MonsterSprite) c.sprite.showSpecial('volley-cast', 'volley-recover', BOSS_CAST_POSE_MS);
          this.hazards?.fire(c.x, c.y, this.volleyDirs);
          this.shotReadyAt = time + BOSS.shot.cooldownMs;
          this.volleyStartedAt = undefined;
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
          if (c.sprite instanceof MonsterSprite) c.sprite.showSpecial('veil-cast', 'veil-recover', BOSS_CAST_POSE_MS);
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
        c.setMotion(false, dx);
        const remaining = this.timer - time;
        if (c.sprite instanceof MonsterSprite) {
          c.sprite.setMovement(dx, dy);
          if (remaining <= 0) c.sprite.endSpecial();
          else c.sprite.showSpecial(remaining > BOSS.roarMs * 0.72 ? 'roar-windup'
            : remaining > BOSS.roarMs * 0.26 ? 'roar-cast' : 'roar-recover');
        }
        if (remaining <= 0) {
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
    pass?: 'straight',
  ): ParryBreakResult {
    const c = this.character;
    if (this.state === 'dead' || this.state === 'roar' || this.state === 'retreat' || this.state === 'veil') {
      return { outcome: 'normalBreak', step: 1, total: 1 };
    }
    if (perfect) this.comboParries += 1;
    const hitIndex = Math.max(1, Math.min(this.chainTotal, this.chainTotal - this.chainLeft));
    const step = perfect ? this.comboParries : hitIndex;
    const total = Math.max(step, this.chainTotal);
    const outcome = bossParryOutcome(this.boss || this.comboWindups !== undefined, this.chainLeft, this.comboParries, perfect);
    const breakStun = this.boss ? BOSS.parryChainStunMs : ENEMY_COMBO.breakStunMs;

    // 정예·보스의 돌진은 패링·막기를 당해도 방향을 꺾지 않고 원래 가려던 자리까지 직진 통과한 뒤 경직한다.
    if (pass && this.chargingNow(time)) {
      this.strikeLanded = true;
      this.hazards?.clearAim();
      this.deferredParry = { outcome, stun: outcome === 'chainBreak' ? breakStun : durationMs, perfect };
      c.flash(outcome === 'chainBreak' ? 0xffe880 : perfect ? 0xbef0ff : 0xffb35a);
      return { outcome, step, total, passing: true };
    }

    if (outcome === 'continueChain') {
      // 보스 연타 유지: 튕겨 나갔다가 짧은 리듬 간격 뒤에 바로 다음 돌진으로 이어진다.
      this.hazards?.clearAim();
      this.cancelStrike();
      this.chainLeft = Math.max(0, this.chainLeft - 1);
      this.comboIndex++;
      this.chainPending = true;
      this.parryStunUntil = 0;
      this.staggerMark.setVisible(false);
      this.state = 'recover';
      this.timer = time + (this.boss ? BOSS.parryChainGapMs : ENEMY_COMBO.parryGapMs);
      this.hitAt = time;
      const { scaleX, scaleY } = hitSquash(0);
      c.sprite.setScale(scaleX, scaleY).setPosition(0, 0);
      c.flash(perfect ? 0xbef0ff : 0xffb35a);
      c.knockback.set(dirX * push * 0.45, dirY * push * 0.45 * VERTICAL_SPEED_RATIO);
      return { outcome, step, total };
    }

    const stun = outcome === 'chainBreak' ? breakStun : durationMs;
    const pushScale = outcome === 'chainBreak' ? 1.45 : this.boss ? 0.7 : 1;
    if (stun <= 0) {
      // 일반 정밀 패링: 기절(스턴) 없이 현재 공격만 끊고 평소 회복으로 넘어간다.
      this.hazards?.clearAim();
      this.cancelStrike();
      this.chainLeft = 0;
      this.chainPending = false;
      this.comboParries = 0;
      this.parryStunUntil = 0;
      this.staggerMark.setVisible(false);
      this.state = 'recover';
      this.timer = time + this.stats.recoverMs;
      this.hitAt = time;
      const { scaleX, scaleY } = hitSquash(0);
      c.sprite.setScale(scaleX, scaleY);
      c.flash(0xbef0ff);
      c.knockback.set(dirX * push * pushScale, dirY * push * pushScale * VERTICAL_SPEED_RATIO);
      return { outcome, step, total };
    }
    this.interrupt(time, stun);
    if (this.state === 'recover') {
      this.hitAt = time;
      if (outcome === 'chainBreak') {
        this.parryStunUntil = time + stun;
        this.parryStunPerfect = true;
      } else {
        this.parryStunUntil = 0;
        this.staggerMark.setVisible(false);
      }
      const { scaleX, scaleY } = hitSquash(0);
      c.sprite.setScale(scaleX, scaleY);
      c.flash(outcome === 'chainBreak' ? 0xffe880 : perfect ? 0xbef0ff : 0xffb35a);
      c.knockback.set(dirX * push * pushScale, dirY * push * pushScale * VERTICAL_SPEED_RATIO);
    }
    return { outcome, step, total };
  }

  /** 차지 패링 파훼: 부식의 장막이나 보스 연타까지 모두 끊고 초대형 경직에 빠뜨린다. */
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

  /** 현재 패링 경직 상태인지 */
  isParryStunned(time: number): boolean {
    return this.state === 'recover' && time < this.parryStunUntil;
  }

  /** 맞으면 준비 동작이 끊기고 잠깐 멈칫한다. 이미 더 긴 패링 경직 중이거나 돌진 통과 경직 예약 중이면 덮어쓰지 않는다. */
  interrupt(time: number, durationMs: number = ENEMY.staggerMs): void {
    if (this.state === 'dead' || this.state === 'roar' || this.state === 'retreat' || this.state === 'veil') return;
    if (this.deferredParry !== undefined) return;
    if (this.state === 'recover' && this.timer > time + durationMs) return;
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
    const active = this.state === 'recover' && time < this.parryStunUntil && !this.untouchable;
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

  /** 칼에 맞았을 때: 그 자리에서 납작해졌다가 출렁이며 돌아온다 (게임 시계 기준). 패링 경직 중에는 점멸·도주하지 않는다. */
  onHit(time: number, area?: WalkArea, threat?: { x: number; y: number }): void {
    const stunned = this.isParryStunned(time) || this.deferredParry !== undefined;
    if (!stunned && this.kind === 'blink-fairy' && this.character.alive && area && threat
      && !this.blink && time - this.escapedAt >= FAIRY_BLINK.cooldownMs) {
      const c = this.character;
      const point = fogEscape(c, threat, (x, y) => area.hasClearPath(c.x, c.y, x, y)
        && [[0, 0], [-18, 0], [18, 0], [0, -12], [0, 12]].every(([dx, dy]) => area.contains(x + dx, y + dy)), FAIRY_BLINK);
      if (point && c.sprite instanceof MonsterSprite) {
        this.interrupt(time, FAIRY_BLINK.durationMs);
        this.escapedAt = time;
        this.blink = { ...point, start: time, moved: false };
        this.hitAt = undefined;
        c.knockback.set(0, 0);
        c.setMotion(false);
        c.sprite.showSpecial('blink-ready');
        return;
      }
    }
    if (!stunned && this.kind === 'fog-crow' && this.character.alive && area && threat && time - this.escapedAt >= FOG_CROW.cooldownMs) {
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

  private updateBlink(time: number, area: WalkArea): boolean {
    const blink = this.blink!;
    const c = this.character;
    if (!(c.sprite instanceof MonsterSprite)) return false;
    const elapsed = time - blink.start;
    if (elapsed >= 280 && !blink.moved) {
      blink.moved = true;
      if (area.contains(blink.x, blink.y)) c.placeAt(blink.x, blink.y);
    }
    c.setConcealed(elapsed >= 200 && elapsed < 340);
    if (elapsed >= FAIRY_BLINK.durationMs) {
      this.blink = undefined;
      c.sprite.endSpecial();
      return false;
    }
    c.sprite.showSpecial(elapsed < 80 ? 'blink-ready' : elapsed < 200 ? 'blink-break'
      : elapsed < 340 ? 'blink-trace' : 'blink-return');
    return true;
  }

  private updateHitSquash(time: number): void {
    if (this.hitAt === undefined || this.state === 'windup' || this.state === 'volley') return;
    const { scaleX, scaleY } = hitSquash(time - this.hitAt);
    this.character.sprite.setScale(scaleX, scaleY);
    if (scaleX === 1 && scaleY === 1) this.hitAt = undefined;
  }

  /** 페이즈 전환·안개 본체·잠복에는 직접 공격이 통하지 않는다. */
  get untouchable(): boolean {
    return this.state === 'roar' || this.kind === 'mist-weaver' || this.blink !== undefined
      || (this.kind === 'river-fish-hunter' && this.character.sprite instanceof MonsterSprite && !this.character.sprite.riverExposed)
      || (this.character.sprite instanceof MonsterSprite && this.character.sprite.swampConcealed);
  }

  private startVolley(time: number, dx: number, dy: number): void {
    const c = this.character;
    const distance = Math.hypot(dx, dy) || 1;
    this.aim.x = dx / distance;
    this.aim.y = dy / distance;
    this.volleyDirs = fanDirections(this.aim.x, this.aim.y, BOSS.shot.count, BOSS.shot.spreadDeg);
    this.state = 'volley';
    this.glintShown = false;
    this.volleyStartedAt = time;
    this.timer = time + BOSS.shot.windupMs;
    this.hazards?.showAim(c.x, c.y, this.volleyDirs, time, this.timer);
    c.setMotion(false, dx);
    if (c.sprite instanceof MonsterSprite) {
      c.sprite.setMovement(dx, dy);
      c.sprite.showSpecial('volley-windup');
    }
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
    if (c.sprite instanceof MonsterSprite) c.sprite.showSpecial('veil-windup');
  }

  /** 보스 2페이즈 전환: 하던 공격을 멈추고 포효한 뒤 물러난다. 포효 시작과 동시에 2페이즈로 전환해 후퇴 중 재발동을 막는다. */
  startRoar(time: number): void {
    if (!this.boss || this.state === 'dead' || this.phase >= 2) return;
    this.phase = 2;
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
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.showSpecial('roar-windup');
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
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.showRiverDefeat();
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
    const spawn = this.patrolHome ?? this.waterline ?? { x, y };
    this.character.revive(spawn.x, spawn.y);
    const sprite = this.character.sprite;
    if (sprite instanceof MonsterSprite && sprite.hasFade) sprite.playFade('materialize');
    else {
      this.character.setAlpha(0);
      this.scene.tweens.add({ targets: this.character, alpha: 1, duration: 400 });
    }
    this.target.set(spawn.x + (this.patrolHome ? SENTRY_PATROL_HALF : 0), spawn.y);
    this.state = 'wander';
    this.timer = 0;
  }

  private cancelStrike(): void {
    if (this.blink) this.character.setConcealed(false);
    this.blink = undefined;
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.endSpecial();
    this.deferredParry = undefined;
    this.attackStartedAt = undefined;
    this.volleyStartedAt = undefined;
    this.strikeLanded = false;
    this.glintShown = false;
    this.lungeProgress = 0;
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
    // 서리 딱정벌레는 느리게 도는 개성을 유지하기 위해 현재 몸이 향한 방향에서부터 서서히 추적한다.
    if (this.kind === 'frost-beetle' && this.character.sprite instanceof MonsterSprite) {
      const f = this.character.sprite.facingVector();
      this.aim.x = f.x;
      this.aim.y = f.y;
    } else {
      this.aim.x = dx / distance;
      this.aim.y = dy / distance;
    }
    this.chargeProgress = 0;
    const base = this.comboWindups?.[this.comboIndex] ?? this.stats.windupMs;
    this.windupMs = base * (time < this.chillUntil ? this.chillWindup : 1);
    this.lungeDist = plannedMeleeLunge(this.kind, distance);
    this.lungeProgress = 0;
    this.lungeStartX = this.character.x;
    this.lungeStartY = this.character.y;
    this.character.setMotion(false, dx);
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.setMovement(dx, dy);
    this.character.sprite.setScale(1).setPosition(0, 0);
  }

  /** 명중과 자세 모두 씬의 게임 시계를 사용한다. Tween 완료로 피해를 주지 않는다. */
  private updateStrike(
    time: number,
    dt: number,
    opponent: { x: number; y: number; alive: boolean },
    onStrike: (enemy: Enemy, hit?: EnemyHit) => boolean | void,
    area: WalkArea,
    onGlint?: GlintHandler,
  ): void {
    if (this.attackStartedAt === undefined) return;
    const elapsed = time - this.attackStartedAt;
    const c = this.character;
    const sprite = c.sprite;
    const { strikeMs, returnMs, recoverMs } = this.stats;
    const windupMs = this.windupMs;
    const strikeAt = windupMs + strikeMs;
    const endAt = strikeAt + returnMs;
    const immediate = this.waterJet !== undefined || isCharger(this.kind);
    const lockAt = trackLockMs(windupMs, strikeMs, immediate);

    // 1) 지연 추적(Late Tracking): 예고 앞쪽(안광 전) 구간에는 적이 플레이어 쪽으로 계속 방향을 틀며 조준한다.
    if (elapsed <= lockAt && dt > 0 && opponent.alive) {
      const tdx = opponent.x - c.x;
      const tdy = opponent.y - c.y;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist > 1e-3) {
        const next = stepAimTracking(this.aim, tdx, tdy, dt, trackingTurnRate(this.kind));
        this.aim.x = next.x;
        this.aim.y = next.y;
        this.lungeDist = plannedMeleeLunge(this.kind, tdist);
        c.face(this.aim.x);
        if (sprite instanceof MonsterSprite) sprite.setMovement(this.aim.x, this.aim.y);
        if (this.waterJet && sprite instanceof MonsterSprite) {
          const mouth = sprite.swampMouthOffset();
          this.waterJet.prepare(area, c, { x: c.x + mouth.x, y: c.y + mouth.y }, this.aim.x, this.aim.y, tdist);
        }
      }
    }

    // 2) 공격이 닿기 BLOCK.glintLeadMs 전: 조준 잠금과 맞물려 십자 안광이 번쩍인다.
    const impactLeadAt = immediate ? windupMs : strikeAt;
    if (!this.glintShown && elapsed >= Math.max(0, impactLeadAt - BLOCK.glintLeadMs)) {
      this.glintShown = true;
      const gx = c.x + this.aim.x * 36;
      const gy = c.y - Math.round((this.stats.height || 96) * 0.56) + this.aim.y * 12;
      onGlint?.(this, gx, gy, false);
    }

    // 3) 근접 적 전진 스텝(Forward Lunge): 잠근 2D 방향으로 실제 몸을 훅 미끄러뜨려 걷기 날먹 회피를 차단한다.
    const meleeLunge = !this.waterJet && !isCharger(this.kind) && !isWaterdropMushroom(this.kind);
    if (meleeLunge && elapsed >= windupMs) {
      if (this.lungeProgress === 0) {
        this.lungeStartX = c.x;
        this.lungeStartY = c.y;
      }
      const raw = Math.min(1, (elapsed - windupMs) / Math.max(1, strikeMs));
      const eased = raw * raw;
      if (eased > this.lungeProgress) {
        const stepDist = (eased - this.lungeProgress) * this.lungeDist;
        area.move(c.x, c.y, this.aim.x * stepDist, this.aim.y * stepDist, this.scratch);
        c.placeAt(this.scratch.x, this.scratch.y);
        this.lungeProgress = eased;
      }
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
          const fromX = c.x, fromY = c.y;
          const distance = (progress - this.chargeProgress) * (this.kind === 'fog-crow' ? FOG_CROW.swoopDistance : 260);
          area.move(c.x, c.y, this.aim.x * distance, this.aim.y * distance, this.scratch);
          c.placeAt(this.scratch.x, this.scratch.y);
          this.chargeProgress = progress;
          if (!this.strikeLanded) {
            this.lastStrikeAt = time;
            this.strikeLanded = onStrike(this, { fromX, fromY, toX: c.x, toY: c.y,
              radiusX: this.kind === 'fog-crow' ? 42 : 65, radiusY: this.kind === 'fog-crow' ? 28 : 38, dx: this.aim.x, dy: this.aim.y, melee: true }) === true;
            if (this.state !== 'windup') return;
          }
        }
      } else if (meleeLunge) {
        const reach = elapsed < windupMs ? 0 : elapsed < strikeAt ? 18 * ((elapsed - windupMs) / strikeMs) ** 2
          : 18 * (1 - Math.min(1, (elapsed - strikeAt) / returnMs));
        sprite.setPosition(this.aim.x * reach, this.aim.y * reach);
      }
    } else if (elapsed < windupMs) {
      const p = 1 - (1 - elapsed / windupMs) ** 2;
      sprite.setScale(1 + 0.25 * p, 1 - 0.3 * p);
    } else if (elapsed < strikeAt) {
      const p = ((elapsed - windupMs) / strikeMs) ** 2;
      sprite.setPosition(this.aim.x * 18 * p, this.aim.y * 18 * p).setScale(1.25 - 0.35 * p, 0.7 + 0.45 * p);
    } else {
      const p = 1 - (1 - Math.min(1, (elapsed - strikeAt) / returnMs)) ** 2;
      sprite.setPosition(this.aim.x * 18 * (1 - p), this.aim.y * 18 * (1 - p)).setScale(0.9 + 0.1 * p, 1.15 - 0.15 * p);
    }
    if (elapsed >= strikeAt && !this.strikeLanded && !this.waterJet && !isCharger(this.kind)) {
      this.strikeLanded = true;
      this.lastStrikeAt = this.attackStartedAt + strikeAt;
      if (sprite instanceof MonsterSprite) sprite.showAttack(strikeAt - 1, windupMs, strikeMs, returnMs);
      if (isWaterdropMushroom(this.kind)) this.fireProjectile(time);
      else onStrike(this, buildMeleeLungeHit(this.kind, this.lungeStartX, this.lungeStartY, c.x, c.y, this.aim));
      if (this.state !== 'windup') return;
    }
    if (elapsed >= endAt) {
      // 2페이즈: 돌진이 끝난 자리에 부식 웅덩이가 남는다.
      if (this.boss && this.phase === 2 && isCharger(this.kind)) this.hazards?.addPool(this.character.x, this.character.y, 1, time);
      this.state = 'recover';
      const chained = this.chainLeft > 0;
      if (chained) {
        this.chainLeft--;
        this.comboIndex++;
      }
      this.chainPending = chained;
      this.timer = this.attackStartedAt + endAt + (chained ? (this.boss ? BOSS.chainGapMs : ENEMY_COMBO.gapMs) : recoverMs);
      this.attackStartedAt = undefined;
      this.waterJet?.clear();
      sprite.setPosition(0, 0).setScale(1);
      if (sprite instanceof MonsterSprite) sprite.endStrike();
      this.applyDeferredParry(time);
    }
  }

  /** 패링당한 채 지나간 돌진이 끝났다: 미뤄 둔 경직을 준다 (연타가 남았으면 짧은 박자로 다음 타). */
  private applyDeferredParry(time: number): void {
    const d = this.deferredParry;
    if (!d) return;
    this.deferredParry = undefined;
    if (d.outcome === 'continueChain') {
      this.timer = time + (this.boss ? BOSS.parryChainGapMs : ENEMY_COMBO.parryGapMs);
      return;
    }
    const { scaleX, scaleY } = hitSquash(0);
    this.character.sprite.setScale(scaleX, scaleY);
    if (d.stun <= 0) {
      this.parryStunUntil = 0;
      this.staggerMark.setVisible(false);
      return;
    }
    this.interrupt(time, d.stun);
    this.hitAt = time;
    if (d.outcome === 'chainBreak') {
      this.parryStunUntil = time + d.stun;
      this.parryStunPerfect = true;
    } else {
      this.parryStunUntil = 0;
      this.staggerMark.setVisible(false);
    }
  }

  /** 돌진하는 몸이 실제로 움직이는 중인지 (예비 동작이 끝나고 돌진 끝 프레임까지 포함) */
  chargingNow(time: number): boolean {
    if (this.state !== 'windup' || !isCharger(this.kind) || this.attackStartedAt === undefined) return false;
    const elapsed = time - this.attackStartedAt;
    return elapsed >= this.windupMs && elapsed <= this.windupMs + this.stats.strikeMs;
  }

  /** 정예(상급 이상) 또는 보스 */
  get elite(): boolean {
    return this.boss || isEliteKind(this.kind);
  }

  /** 지금 치는 타의 공격력 배율: 연타의 둘째 타부터는 조금 약하다 */
  get strikeDamageScale(): number {
    return !this.boss && this.comboIndex > 0 ? ENEMY_COMBO.followDamageScale : 1;
  }

  /** 흡수한 서리에 맞아 언다: until까지 느려지고 예비 동작도 길어진다 */
  chill(until: number, speedScale: number, windupScale: number): void {
    this.chillUntil = Math.max(this.chillUntil, until);
    this.chillSpeed = speedScale;
    this.chillWindup = windupScale;
  }

  chilled(time: number): boolean {
    return time < this.chillUntil;
  }

  private speedScale(time: number): number {
    return time < this.chillUntil ? this.chillSpeed : 1;
  }

  /**
   * 연타 묶음을 쓰는 근접 적은 예비 동작 동안 주인공의 옆자리로 다가선다.
   * 조준이 굳는 순간(enemyTracking.ts의 trackLockMs)부터는 서서 친다.
   */
  private trackDuringWindup(time: number, dt: number, opponent: { x: number; y: number }, area: WalkArea): void {
    // 방향 고치기는 updateStrike의 지연 추적(enemyTracking.ts)이 맡는다. 여기서는 근접 연타 적이 옆자리로 다가서기만 한다.
    if (!this.comboWindups || this.boss || this.attackStartedAt === undefined || this.waterJet || isCharger(this.kind)) return;
    if (time - this.attackStartedAt > trackLockMs(this.windupMs, this.stats.strikeMs, false)) return;
    const c = this.character;
    const dx = opponent.x - c.x;
    const side = dx > 0 ? -1 : 1;
    const goalX = opponent.x + side * (ENEMY.attackRangeX - 25), goalY = opponent.y;
    const gx = goalX - c.x, gy = goalY - c.y;
    const distance = Math.hypot(gx, gy);
    if (distance < 12) return;
    const step = Math.min(distance, this.stats.speed * ENEMY_COMBO.trackSpeedScale * this.speedScale(time) * dt);
    const next = area.move(c.x, c.y, (gx / distance) * step, (gy / distance) * step, this.scratch);
    c.placeAt(next.x, next.y);
  }

  private fireProjectile(time: number): void {
    this.clearProjectile();
    const x = this.character.x + this.aim.x * 25, y = this.character.y + this.aim.y * 25;
    const key = waterShotTexture(this.kind);
    const texture = this.scene.textures.get(key);
    if (!texture.has('bead')) texture.add('bead', 0, shotFrame.x, shotFrame.y, shotFrame.w, shotFrame.h);
    const image = this.scene.add.image(x, y - 45, key, 'bead').setOrigin(0.8, 0.5).setDisplaySize(44, 24)
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
