import Phaser from 'phaser';
import shotFrame from '../assets/monsters/waterdrop-mushroom/projectile_frame.json';
import { ENEMY } from '../config';
import { hitSquash } from './hitFeel';
import { Character } from '../entities/Character';
import type { NavGrid } from '../world/navGrid';
import type { WalkArea } from '../world/walkArea';
import { MonsterSprite } from './MonsterSprite';
import { MONSTERS, WATER_SHOT, isCharger, monsterKind, enemyHitReaches, type EnemyHit, type EnemyKey, type MonsterKind, type MonsterStats } from './monsterTypes';
import { scaleMonster } from './monsterLevel';

type State = 'wander' | 'chase' | 'windup' | 'recover' | 'dead';

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
  /** 마지막으로 맞은 시각(게임 시계). 맞은 뒤 잠깐 몸이 출렁인다. */
  private hitAt?: number;

  /** 쓰러질 때 흩어지는 파편의 색 */
  readonly color: number;

  constructor(scene: Phaser.Scene, key: EnemyKey, x: number, y: number, level = 1) {
    this.scene = scene;
    this.kind = monsterKind(key);
    this.level = level;
    this.stats = scaleMonster<MonsterStats>(MONSTERS[this.kind ?? 'slime'], level);
    this.color = key === 'retainer-ash' ? 0x9c96b3 : this.stats.color;
    this.character = new Character(scene, x, y, {
      key,
      monster: this.kind,
      shadowWidth: 100,
      maxHp: this.stats.hp,
      showHpBar: true,
      levelTag: level,
      labelOffset: this.kind ? this.stats.height + 8 : 96,
    });
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
  ): void {
    const c = this.character;
    if (this.state === 'dead') return;
    this.updateHitSquash(time);
    this.updateProjectile(time, dt, player, area, onStrike);
    if (c.sprite instanceof MonsterSprite) c.sprite.advance(dt * 1000);

    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const playerNear = player.alive && Math.abs(dx) < ENEMY.aggroX && Math.abs(dy) < ENEMY.aggroY;

    switch (this.state) {
      case 'wander': {
        if (playerNear) {
          this.state = 'chase';
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
        if (!player.alive || Math.abs(dx) > ENEMY.aggroX * 1.5) {
          this.state = 'wander';
          this.target.set(c.x, c.y);
          break;
        }
        const ranged = this.kind === 'waterdrop-mushroom';
        const charge = isCharger(this.kind);
        const inRange = ranged ? Math.hypot(dx, dy) <= 350 && area.hasClearPath(c.x, c.y, player.x, player.y)
          : charge ? Math.hypot(dx, dy) <= 250 && area.hasClearPath(c.x, c.y, player.x, player.y)
          : Math.abs(dx) < ENEMY.attackRangeX && Math.abs(dy) < ENEMY.attackRangeY;
        if (inRange) {
          this.beginWindup(time, dx, ranged || charge ? dy : 0);
          break;
        }
        // 플레이어의 옆자리(같은 높이)로 붙는다.
        const side = dx > 0 ? -1 : 1;
        const goalX = player.x + side * (this.kind === 'waterdrop-mushroom' ? 180 : ENEMY.attackRangeX - 25);
        const step = this.stats.speed * dt;
        // 곧장 갈 수 있으면 곧장 가고, 테이블이나 카운터에 막혀 있으면 격자가 알려 주는 길로 돌아간다.
        if (!area.hasClearPath(c.x, c.y, goalX, player.y) && nav.next(c.x, c.y, this.waypoint)) {
          this.stepToward(this.waypoint.x, this.waypoint.y, step, area);
        } else {
          this.stepToward(goalX, player.y, step, area);
        }
        break;
      }

      case 'windup':
        c.setMotion(false);
        this.updateStrike(time, onStrike, area);
        break;

      case 'recover':
        c.setMotion(false);
        if (time >= this.timer) this.state = 'chase';
        break;
    }
  }

  /** 맞으면 준비 동작이 끊기고 잠깐 멈칫한다. 저스트 회피를 당하면 더 오래 멈춘다. */
  interrupt(time: number, durationMs: number = ENEMY.staggerMs): void {
    if (this.state === 'dead') return;
    this.cancelStrike();
    this.character.sprite.setScale(1).setPosition(0, 0);
    this.state = 'recover';
    this.timer = time + durationMs;
  }

  /** 칼에 맞았을 때: 그 자리에서 납작해졌다가 출렁이며 돌아온다 (게임 시계 기준). */
  onHit(time: number): void {
    this.hitAt = time;
    const { scaleX, scaleY } = hitSquash(0);
    this.character.sprite.setScale(scaleX, scaleY);
  }

  private updateHitSquash(time: number): void {
    if (this.hitAt === undefined || this.state === 'windup') return;
    const { scaleX, scaleY } = hitSquash(time - this.hitAt);
    this.character.sprite.setScale(scaleX, scaleY);
    if (scaleX === 1 && scaleY === 1) this.hitAt = undefined;
  }

  kill(): void {
    this.hitAt = undefined;
    this.state = 'dead';
    this.cancelStrike();
    this.clearProjectile();
    this.character.playDeath();
  }

  respawn(x: number, y: number): void {
    this.hitAt = undefined;
    this.clearProjectile();
    this.cancelStrike();
    this.character.revive(x, y);
    this.character.setAlpha(0);
    this.scene.tweens.add({ targets: this.character, alpha: 1, duration: 400 });
    this.target.set(x, y);
    this.state = 'wander';
    this.timer = 0;
  }

  private cancelStrike(): void {
    this.attackStartedAt = undefined;
    this.strikeLanded = false;
    if (this.character.sprite instanceof MonsterSprite) this.character.sprite.endStrike();
  }

  private beginWindup(time: number, dx: number, dy = 0): void {
    this.state = 'windup';
    this.hitAt = undefined;
    this.attackStartedAt = time;
    this.strikeLanded = false;
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
    area: WalkArea): void {
    if (this.attackStartedAt === undefined) return;
    const elapsed = time - this.attackStartedAt;
    const sprite = this.character.sprite;
    const { windupMs, strikeMs, returnMs, recoverMs } = this.stats;
    const strikeAt = windupMs + strikeMs;
    const endAt = strikeAt + returnMs;
    if (sprite instanceof MonsterSprite) {
      sprite.showAttack(elapsed, windupMs, strikeMs, returnMs);
      if (isCharger(this.kind) && elapsed >= windupMs) {
        const progress = Math.min(1, (elapsed - windupMs) / strikeMs);
        if (progress > this.chargeProgress) {
          const c = this.character, fromX = c.x, fromY = c.y;
          const distance = (progress - this.chargeProgress) * 260;
          area.move(c.x, c.y, this.aim.x * distance, this.aim.y * distance, this.scratch);
          c.placeAt(this.scratch.x, this.scratch.y);
          this.chargeProgress = progress;
          if (!this.strikeLanded) {
            this.lastStrikeAt = time;
            this.strikeLanded = onStrike(this, { fromX, fromY, toX: c.x, toY: c.y,
              radiusX: 65, radiusY: 38, dx: this.aim.x, dy: this.aim.y }) === true;
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
    if (elapsed >= strikeAt && !this.strikeLanded && !isCharger(this.kind)) {
      this.strikeLanded = true;
      this.lastStrikeAt = this.attackStartedAt + strikeAt;
      if (sprite instanceof MonsterSprite) sprite.showAttack(strikeAt - 1, windupMs, strikeMs, returnMs);
      if (this.kind === 'waterdrop-mushroom') this.fireProjectile(time);
      else onStrike(this);
      if (this.state !== 'windup') return;
    }
    if (elapsed >= endAt) {
      this.state = 'recover';
      this.timer = this.attackStartedAt + endAt + recoverMs;
      this.attackStartedAt = undefined;
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
