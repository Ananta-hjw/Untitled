import type Phaser from 'phaser';
import { MIST_THREADS as THREADS, PLAYER } from '../config';
import { bladeHitsEllipse, type BladeSweep, type Point } from './blade';
import { insideEllipse } from './bossPattern';
import type { MonsterSprite } from './MonsterSprite';

interface Weave {
  at: Point;
  target: Point;
  startedAt: number;
  resolved: boolean;
}

/** Fixed ground warning, target-specific bind, and severable threads on the game clock. */
export class MistThreads {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly strands: Phaser.GameObjects.Graphics;
  private weave?: Weave;
  private held?: Point;
  private unravel?: { at: Point; cutAt: Point; time: number };
  private nextCastAt: number;

  constructor(scene: Phaser.Scene, private readonly caster: MonsterSprite, now: number) {
    this.ground = scene.add.graphics().setDepth(-40).setName('mist-thread-pattern');
    this.strands = scene.add.graphics().setName('mist-thread-bind');
    this.nextCastAt = now + THREADS.firstCastMs;
  }

  get target(): Point | undefined { return this.held; }
  get active(): boolean { return this.weave !== undefined || this.held !== undefined; }
  holds(target: Point): boolean { return target === this.held; }

  cast(now: number, from: Point, target: Point): boolean {
    if (this.active || now < this.nextCastAt) return false;
    this.weave = { at: { x: target.x, y: target.y }, target, startedAt: now, resolved: false };
    this.nextCastAt = now + THREADS.cooldownMs;
    this.caster.setMovement(target.x - from.x, target.y - from.y);
    return true;
  }

  /** Resolve once, after movement for this frame. Only the warned actor can be caught. */
  update(now: number): Point | undefined {
    let caught: Point | undefined;
    const w = this.weave;
    if (w) {
      const elapsed = now - w.startedAt;
      if (!w.resolved && elapsed >= THREADS.windupMs) {
        w.resolved = true;
        if (insideEllipse(w.target.x - w.at.x, w.target.y - w.at.y, THREADS.rx, THREADS.ry)) {
          caught = this.held = w.target;
        }
      }
      if (elapsed >= THREADS.windupMs + THREADS.strikeMs + THREADS.recoveryMs) {
        this.weave = undefined;
        this.caster.endStrike();
      } else {
        this.caster.showAttack(elapsed, THREADS.windupMs, THREADS.strikeMs, THREADS.recoveryMs);
      }
    }
    this.draw(now);
    return caught;
  }

  cutWithBlade(player: Point, sweep: BladeSweep, now: number): Point | undefined {
    const target = this.held;
    if (!target) return;
    const knot = { x: target.x, y: target.y - THREADS.knotLift };
    // Own tethers are in reach of every sword swing. Another actor's knot needs an actual blade hit.
    if (target !== player && !bladeHitsEllipse(sweep.previous, sweep.current, knot,
      THREADS.knotRx + PLAYER.bladeRadius, THREADS.knotRy + PLAYER.bladeRadius)) return;
    return this.sever(target, target === player ? sweep.current.base : knot, now);
  }

  clear(): void {
    if (this.weave) this.caster.endStrike();
    this.weave = undefined;
    this.held = undefined;
    this.unravel = undefined;
    this.ground.clear();
    this.strands.clear();
  }

  private sever(target: Point, cutAt: Point, now: number): Point {
    this.held = undefined;
    this.unravel = { at: { x: target.x, y: target.y }, cutAt, time: now };
    this.nextCastAt = Math.max(this.nextCastAt, now + THREADS.afterCutMs);
    this.draw(now);
    return target;
  }

  private draw(now: number): void {
    const ground = this.ground.clear(), strands = this.strands.clear();
    const w = this.weave;
    if (w && !w.resolved) {
      const p = Math.min(1, (now - w.startedAt) / THREADS.windupMs);
      const { x, y } = w.at, { rx, ry } = THREADS;
      ground.fillStyle(0x3c315a, 0.22 + p * 0.15).fillEllipse(x, y, rx * 2, ry * 2);
      ground.lineStyle(2.5, 0xf1cefd, 0.65 + p * 0.30).strokeEllipse(x, y, rx * 2, ry * 2);
      for (let band = 0; band < 7; band++) {
        const angle = band * Math.PI / 7;
        ground.lineStyle(1.6, band % 2 ? 0xb294eb : 0xf3dbff, 0.42 + p * 0.44).beginPath();
        for (let i = 0; i <= 18; i++) {
          const t = i / 18, d = 2 * t - 1;
          const wave = Math.sin(t * Math.PI * 2 + now / 250 + band) * (1 - d * d) * 0.23;
          const px = x + rx * (d * Math.cos(angle) - wave * Math.sin(angle)) * 0.96;
          const py = y + ry * (d * Math.sin(angle) + wave * Math.cos(angle)) * 0.96;
          if (i === 0) ground.moveTo(px, py);
          else ground.lineTo(px, py);
        }
        ground.strokePath();
      }
    }
    if (this.held) {
      const { x, y } = this.held;
      const pulse = 0.80 + 0.14 * Math.sin(now / 140);
      ground.lineStyle(3, 0xceb2ff, pulse).strokeEllipse(x, y, 84, 43);
      strands.setDepth(y + 2);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1, spread = (21 + (i % 3) * 9) * side;
        strands.lineStyle(i < 2 ? 3 : 1.8, i % 2 ? 0xeed4ff : 0xad85e6, pulse).beginPath()
          .moveTo(x + spread, y - 2 - (i % 3) * 5)
          .lineTo(x + spread * 0.6, y - THREADS.knotLift * 0.64)
          .lineTo(x + 11 * side, y - THREADS.knotLift - (i % 3) * 7).strokePath();
      }
      strands.lineStyle(3, 0xf3d9ff, pulse).strokeEllipse(x, y - THREADS.knotLift, 45, 22);
      strands.fillStyle(0xffe7ff, pulse).fillCircle(x, y - THREADS.knotLift, 5);
    }
    const u = this.unravel;
    if (!u) return;
    const t = (now - u.time) / THREADS.unravelMs;
    if (t >= 1) { this.unravel = undefined; return; }
    strands.setDepth(u.at.y + 2);
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      const x = u.cutAt.x + Math.cos(a) * t * 52;
      const y = u.cutAt.y + Math.sin(a) * t * 36;
      strands.lineStyle(2, 0xf4d8ff, 1 - t)
        .lineBetween(x, y, x + Math.cos(a + t) * 10, y + Math.sin(a + t) * 10);
    }
  }
}
