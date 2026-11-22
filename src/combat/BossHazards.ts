import Phaser from 'phaser';
import type { Character } from '../entities/Character';
import type { WalkArea } from '../world/walkArea';
import { BOSS, insideEllipse } from './bossPattern';
import { enemyHitReaches, type EnemyHit } from './monsterTypes';

interface Pool { x: number; y: number; scale: number; born: number }
interface Shot { x: number; y: number; dx: number; dy: number; travelled: number }

/** 바닥 효과는 땅(-100) 바로 위, 캐릭터·소품보다 아래에 그린다 */
const GROUND_DEPTH = -50;
const SHOT_HEIGHT = 55;

export interface HazardCallbacks {
  /** 산탄이 닿을 수 있는 순간. 씬이 맞았는지(패링·저스트 회피 포함) 판정하고, 소모되었으면 true */
  strike(hit: EnemyHit): boolean;
  /** 주인공이 웅덩이 안에 있는 틱 */
  pool(): void;
}

/**
 * 1장 보스 2페이즈의 부식 효과(combat/bossPattern.ts): 바닥의 부식 웅덩이, 날아가는 부식 산탄과 겨눔선,
 * 부식의 장막의 범위 표시와 터짐. 모두 장면의 게임 시계로 움직이고(멈추면 같이 멈춘다), 보스가 쓰러지면 지운다.
 */
export class BossHazards {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly air: Phaser.GameObjects.Graphics;
  private pools: Pool[] = [];
  private shots: Shot[] = [];
  private aim?: { x: number; y: number; dirs: Array<{ x: number; y: number }>; from: number; until: number };
  private veil?: { x: number; y: number; from: number; until: number };
  private burst?: { x: number; y: number; at: number };
  private nextPoolTick = 0;

  constructor(scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(GROUND_DEPTH);
    this.air = scene.add.graphics();
  }

  /** 지금 있는 웅덩이 수 (테스트용) */
  get poolCount(): number { return this.pools.length; }
  get shotCount(): number { return this.shots.length; }

  addPool(x: number, y: number, scale: number, now: number): void {
    this.pools.push({ x, y, scale, born: now });
  }

  /** 산탄을 쏘기 전 겨눔선 (준비 동작 동안) */
  showAim(x: number, y: number, dirs: Array<{ x: number; y: number }>, now: number, until: number): void {
    this.aim = { x, y, dirs, from: now, until };
  }

  clearAim(): void {
    this.aim = undefined;
  }

  fire(x: number, y: number, dirs: Array<{ x: number; y: number }>): void {
    this.aim = undefined;
    for (const d of dirs) this.shots.push({ x: x + d.x * 40, y: y + d.y * 40, dx: d.x, dy: d.y, travelled: 0 });
  }

  startVeil(x: number, y: number, now: number): void {
    this.veil = { x, y, from: now, until: now + BOSS.veil.telegraphMs };
  }

  /** 장막이 터진다: 범위 표시를 지우고 퍼지는 고리를 그린다. */
  burstVeil(now: number): void {
    if (this.veil) this.burst = { x: this.veil.x, y: this.veil.y, at: now };
    this.veil = undefined;
  }

  cancelVeil(): void {
    this.veil = undefined;
  }

  clear(): void {
    this.pools = [];
    this.shots = [];
    this.aim = undefined;
    this.veil = undefined;
    this.burst = undefined;
    this.ground.clear();
    this.air.clear();
  }

  destroy(): void {
    this.clear();
    this.ground.destroy();
    this.air.destroy();
  }

  update(now: number, dt: number, player: Character, area: WalkArea, callbacks: HazardCallbacks): void {
    this.pools = this.pools.filter((p) => now - p.born < BOSS.pool.durationMs);
    // 웅덩이: 안에 서 있으면 일정한 간격으로 피해
    if (player.alive && now >= this.nextPoolTick
      && this.pools.some((p) => insideEllipse(player.x - p.x, player.y - p.y, BOSS.pool.rx * p.scale, BOSS.pool.ry * p.scale))) {
      this.nextPoolTick = now + BOSS.pool.tickMs;
      callbacks.pool();
    }
    // 산탄: 벽에 막히거나 사거리 끝에 떨어지면 작은 웅덩이, 주인공에게 닿으면 사라진다
    const s = BOSS.shot;
    this.shots = this.shots.filter((shot) => {
      const step = s.speed * dt;
      const x = shot.x + shot.dx * step, y = shot.y + shot.dy * step;
      if (!area.hasClearPath(shot.x, shot.y, x, y) || shot.travelled + step >= s.range) {
        this.addPool(shot.x, shot.y, s.poolScale, now);
        return false;
      }
      const hit: EnemyHit = { fromX: shot.x, fromY: shot.y, toX: x, toY: y, radiusX: s.radiusX, radiusY: s.radiusY, dx: shot.dx, dy: shot.dy, damageScale: s.damageScale };
      if (player.alive && (callbacks.strike(hit) || enemyHitReaches(hit, player.x, player.y))) return false;
      shot.x = x; shot.y = y; shot.travelled += step;
      return true;
    });
    this.draw(now);
  }

  private draw(now: number): void {
    const g = this.ground.clear();
    for (const p of this.pools) {
      const age = now - p.born, left = BOSS.pool.durationMs - age;
      const grow = Math.min(1, age / 250), fade = Math.min(1, left / 600);
      const rx = BOSS.pool.rx * p.scale * grow, ry = BOSS.pool.ry * p.scale * grow;
      g.fillStyle(0x2a1a33, 0.55 * fade).fillEllipse(p.x, p.y, rx * 2, ry * 2);
      g.fillStyle(0x5d3f73, 0.45 * fade).fillEllipse(p.x, p.y, rx * 1.5, ry * 1.4);
      // 부글거리는 거품
      for (let i = 0; i < 5; i++) {
        const t = ((now / 700) + i / 5) % 1;
        const a = i * 2.4 + p.born;
        g.fillStyle(0x9a7bb3, (1 - t) * 0.7 * fade).fillCircle(p.x + Math.cos(a) * rx * 0.5, p.y + Math.sin(a) * ry * 0.5, 3 + t * 5);
      }
    }
    // 장막의 범위: 바깥 테두리가 깜박이고, 안쪽이 가운데에서 차오른다
    if (this.veil) {
      const v = this.veil, t = Math.min(1, (now - v.from) / (v.until - v.from));
      const { rx, ry } = BOSS.veil;
      const blink = 0.5 + 0.5 * Math.sin(now / (90 - 50 * t));
      g.fillStyle(0x3a0d2a, 0.25).fillEllipse(v.x, v.y, rx * 2, ry * 2);
      g.fillStyle(0x8a1d5c, 0.35 + 0.2 * t).fillEllipse(v.x, v.y, rx * 2 * t, ry * 2 * t);
      g.lineStyle(4, 0xff4a8a, 0.5 + 0.5 * blink).strokeEllipse(v.x, v.y, rx * 2, ry * 2);
    }
    if (this.burst) {
      const t = (now - this.burst.at) / 450;
      if (t >= 1) this.burst = undefined;
      else {
        const { rx, ry } = BOSS.veil;
        g.lineStyle(10 * (1 - t), 0xd76bff, 1 - t).strokeEllipse(this.burst.x, this.burst.y, rx * 2 * (0.8 + 0.4 * t), ry * 2 * (0.8 + 0.4 * t));
        g.fillStyle(0x6a2a8a, 0.4 * (1 - t)).fillEllipse(this.burst.x, this.burst.y, rx * 2, ry * 2);
      }
    }
    const a = this.air.clear();
    // 겨눔선: 준비 동작 동안 점점 진해진다
    if (this.aim) {
      const t = Math.min(1, (now - this.aim.from) / Math.max(1, this.aim.until - this.aim.from));
      for (const d of this.aim.dirs) {
        a.lineStyle(5, 0xc77dff, 0.25 + 0.55 * t)
          .lineBetween(this.aim.x, this.aim.y - SHOT_HEIGHT, this.aim.x + d.x * BOSS.shot.range * 0.6, this.aim.y + d.y * BOSS.shot.range * 0.6 - SHOT_HEIGHT);
      }
    }
    for (const shot of this.shots) {
      a.setDepth(shot.y + 1);
      a.fillStyle(0x000000, 0.25).fillEllipse(shot.x, shot.y, 34, 12);
      a.fillStyle(0x6a3d8a, 0.35).fillCircle(shot.x - shot.dx * 22, shot.y - SHOT_HEIGHT - shot.dy * 22, 9);
      a.fillStyle(0x4b2a63, 1).fillCircle(shot.x, shot.y - SHOT_HEIGHT, 14);
      a.fillStyle(0xb98ad8, 0.9).fillCircle(shot.x - 4, shot.y - SHOT_HEIGHT - 4, 5);
    }
    if (!this.shots.length) a.setDepth(this.aim ? this.aim.y + 1 : 0);
  }
}
