import Phaser from 'phaser';
import { ENEMY } from '../config';
import { Character } from '../entities/Character';
import type { WalkArea } from '../world/walkArea';

type State = 'wander' | 'chase' | 'windup' | 'recover' | 'dead';

/**
 * 근접 몬스터 AI.
 *
 *   배회 → (플레이어가 가까우면) 추격 → 사거리 안이면 준비 동작 → 돌진 공격 → 숨 고르기 → 추격 …
 *
 * 준비 동작(몸을 움츠림) 동안 플레이어가 옆으로 빠지면 공격이 빗나간다.
 */
export class Enemy {
  readonly character: Character;
  state: State = 'wander';

  private readonly scene: Phaser.Scene;
  private readonly target = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();
  private readonly wanderSpeed: number;
  private timer = 0;
  /** 씬의 게임 시계. update()에서 받아 둔다. */
  private now = 0;
  private strike?: Phaser.Tweens.TweenChain;

  constructor(scene: Phaser.Scene, key: string, x: number, y: number) {
    this.scene = scene;
    this.character = new Character(scene, x, y, {
      key,
      shadowWidth: 100,
      maxHp: ENEMY.maxHp,
      showHpBar: true,
      labelOffset: 96,
    });
    this.target.set(x, y);
    this.wanderSpeed = Phaser.Math.Between(50, 80);
    this.timer = Phaser.Math.Between(300, 1800);
  }

  /** onStrike: 돌진이 닿는 순간 호출된다. 실제로 맞았는지는 씬이 판정한다. */
  update(time: number, dt: number, player: Character, area: WalkArea, onStrike: (enemy: Enemy) => void): void {
    const c = this.character;
    this.now = time;
    if (this.state === 'dead') return;

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
        if (Math.abs(dx) < ENEMY.attackRangeX && Math.abs(dy) < ENEMY.attackRangeY) {
          this.beginWindup(dx, onStrike);
          break;
        }
        // 플레이어의 옆자리(같은 높이)로 붙는다.
        const side = dx > 0 ? -1 : 1;
        this.stepToward(player.x + side * (ENEMY.attackRangeX - 25), player.y, ENEMY.chaseSpeed * dt, area);
        break;
      }

      case 'windup':
        c.setMotion(false);
        break;

      case 'recover':
        c.setMotion(false);
        if (time >= this.timer) this.state = 'chase';
        break;
    }
  }

  /** 맞으면 준비 동작이 끊기고 잠깐 멈칫한다. */
  interrupt(time: number): void {
    if (this.state === 'dead') return;
    this.cancelStrike();
    this.character.sprite.setScale(1).setPosition(0, 0);
    this.state = 'recover';
    this.timer = time + ENEMY.staggerMs;
  }

  kill(): void {
    this.state = 'dead';
    this.cancelStrike();
    this.character.playDeath();
  }

  respawn(x: number, y: number): void {
    this.character.revive(x, y);
    this.character.setAlpha(0);
    this.scene.tweens.add({ targets: this.character, alpha: 1, duration: 400 });
    this.target.set(x, y);
    this.state = 'wander';
    this.timer = 0;
  }

  private cancelStrike(): void {
    this.strike?.stop();
    this.strike = undefined;
    this.scene.tweens.killTweensOf(this.character.sprite);
  }

  private beginWindup(dx: number, onStrike: (enemy: Enemy) => void): void {
    const c = this.character;
    this.state = 'windup';
    c.setMotion(false, dx);
    const sprite = c.sprite;
    this.strike = this.scene.tweens.chain({
      targets: sprite,
      tweens: [
        // 움츠리기 (공격 예고)
        { scaleX: 1.25, scaleY: 0.7, duration: ENEMY.windupMs, ease: 'Quad.easeOut' },
        // 돌진
        {
          x: c.facing * 46,
          scaleX: 0.9,
          scaleY: 1.15,
          duration: 110,
          ease: 'Quad.easeIn',
          onComplete: () => {
            if (this.state === 'windup') onStrike(this);
          },
        },
        { x: 0, scaleX: 1, scaleY: 1, duration: 220, ease: 'Quad.easeOut' },
      ],
      onComplete: () => {
        if (this.state !== 'windup') return;
        this.state = 'recover';
        this.timer = this.now + ENEMY.recoverMs;
      },
    });
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
    return true;
  }
}
