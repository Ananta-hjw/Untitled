import type Phaser from 'phaser';
import type { WalkArea } from '../world/walkArea';
import type { EnemyHit } from './monsterTypes';

export const SWAMP_JET = { attackRange: 355, range: 340, reachMs: 245, radius: 24, standOff: 215 };

interface Point { x: number; y: number }
interface Aim { start: Point; mouth: Point; dx: number; dy: number; length: number }

/** Find the last clear point on the aim line without sliding around an obstacle. */
function waterJetReach(area: WalkArea, start: Point, dx: number, dy: number, range: number): number {
  let distance = 0;
  while (distance < range) {
    const next = Math.min(range, distance + 8);
    if (!area.hasClearPath(start.x + dx * distance, start.y + dy * distance, start.x + dx * next, start.y + dy * next, 4)) break;
    distance = next;
  }
  return distance;
}

/** The ground warning, visible water, and hit capsule share the same fixed aim. */
export class SwampWaterJet {
  private readonly warning: Phaser.GameObjects.Graphics;
  private readonly water: Phaser.GameObjects.Graphics;
  private aim?: Aim;

  constructor(scene: Phaser.Scene) {
    this.warning = scene.add.graphics().setDepth(-50).setName('swamp-jet-warning');
    this.water = scene.add.graphics().setName('swamp-water-jet');
  }

  prepare(area: WalkArea, body: Point, mouth: Point, dx: number, dy: number, targetDistance: number): void {
    this.clear();
    const front = Math.min(64, targetDistance * 0.55);
    const reach = waterJetReach(area, body, dx, dy, SWAMP_JET.range + front);
    const offset = Math.min(front, reach);
    this.aim = { start: { x: body.x + dx * offset, y: body.y + dy * offset }, mouth, dx, dy, length: reach - offset };
    this.water.setDepth(body.y + 1);
  }

  warn(progress: number): void {
    const g = this.warning.clear(), aim = this.aim;
    if (!aim || !aim.length) return;
    const { start, dx, dy, length } = aim;
    const x = start.x + dx * length, y = start.y + dy * length;
    g.lineStyle(SWAMP_JET.radius * 2, 0x6cb5ae, 0.1 + progress * 0.13).lineBetween(start.x, start.y, x, y);
    g.lineStyle(2, 0xb7e1c5, 0.28 + progress * 0.35).lineBetween(start.x, start.y, x, y);
  }

  strike(elapsed: number, duration: number): EnemyHit | undefined {
    this.warning.clear();
    this.water.clear();
    const aim = this.aim;
    if (!aim || !aim.length) return;
    const { start, dx, dy, length } = aim;
    const travelled = length * Math.min(1, elapsed / SWAMP_JET.reachMs);
    this.draw(aim, travelled, elapsed, duration);
    return { fromX: start.x, fromY: start.y, toX: start.x + dx * travelled, toY: start.y + dy * travelled,
      radiusX: SWAMP_JET.radius, radiusY: SWAMP_JET.radius * 0.82, dx, dy };
  }

  fade(elapsed: number, duration: number): void {
    this.water.clear();
    if (!this.aim || elapsed >= duration) return;
    this.draw(this.aim, this.aim.length, elapsed, duration, 1 - elapsed / duration);
  }

  clear(): void {
    this.aim = undefined;
    this.warning.clear();
    this.water.clear();
  }

  private draw(aim: Aim, travelled: number, elapsed: number, duration: number, release?: number): void {
    const { start, mouth, dx, dy, length } = aim;
    const g = this.water;
    const fade = Math.min(1, 0.35 + elapsed / 65, (duration - elapsed) / 70 + 0.35) * (release ?? 1);
    const lift = 18;
    const offsetX = mouth.x - start.x, offsetY = mouth.y - start.y + lift;
    const forwardOffset = offsetX * dx + offsetY * dy;
    const center = (distance: number) => {
      const blend = Math.min(1, distance / 135);
      const near = 1 - blend * blend * (3 - 2 * blend);
      const forward = distance + forwardOffset * (1 - distance / length);
      return { x: start.x + dx * forward + (offsetX - dx * forwardOffset) * near,
        y: start.y + dy * forward - lift + (offsetY - dy * forwardOffset) * near };
    };
    const points = Array.from({ length: 29 }, (_, i) => {
      const t = i / 28;
      const distance = travelled * t;
      const point = center(distance);
      const curl = (1.5 + 2.5 * t) * Math.sin(distance * 0.052 - elapsed * 0.065) * Math.min(1, distance / 38);
      const width = 3 + 13 * t * (1 - 0.45 * Math.max(0, t - 0.84) / 0.16);
      return { x: point.x - dy * curl, y: point.y + dx * curl, width };
    });
    const ribbon = (width: number, tint: number, alpha: number) => {
      const edge = (sign: number) => points.map(p => ({ x: p.x - dy * sign * p.width * width,
        y: p.y + dx * sign * p.width * width }));
      const [first, ...rest] = [...edge(1), ...edge(-1).reverse()];
      g.fillStyle(tint, fade * alpha).beginPath().moveTo(first.x, first.y);
      for (const point of rest) g.lineTo(point.x, point.y);
      g.closePath().fillPath();
    };
    if (release === undefined) {
      ribbon(1.25, 0x4e938f, 0.45);
      ribbon(0.88, 0x72bfba, 0.75);
      for (let i = 0; i < 7; i++) {
        const f = (elapsed / 340 + i / 7) % 1;
        const index = Math.floor(f * (points.length - 1));
        const from = points[index];
        const to = points[Math.min(points.length - 1, index + 3)];
        const shift = (i % 3 - 1) * from.width * 0.42;
        g.lineStyle(1.6 + i % 2, 0xe5fbeb, fade * (0.62 - f * 0.16))
          .lineBetween(from.x - dy * shift, from.y + dx * shift, to.x - dy * shift, to.y + dx * shift);
      }
    }
    for (let i = 0; i < 17; i++) {
      const t = ((elapsed / 320 + i * 0.618) % 1);
      const distance = travelled * (0.13 + t * 0.87);
      const p = center(distance);
      const spread = (i % 2 ? -1 : 1) * t * (9 + 3 * (i % 5));
      g.fillStyle(i % 3 ? 0xbbe9dd : 0xf3fce9, fade * (1 - t * 0.66))
        .fillCircle(p.x - dy * spread, p.y + dx * spread, 1.3 + i % 4 * 0.63);
    }
    if (length > 0 && travelled >= length) {
      const impact = center(length);
      const phase = elapsed / 140 % 1;
      g.lineStyle(2, 0xbdeeed, fade * (1 - phase) * 0.74)
        .strokeEllipse(impact.x, impact.y + lift - 4, 18 + 37 * phase, 11 + 16 * phase);
    }
  }
}
