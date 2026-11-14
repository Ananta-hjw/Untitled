import Phaser from 'phaser';
import { insideObstacle, type Obstacle } from './obstacles';
export type { Obstacle } from './obstacles';

/**
 * 걸어다닐 수 있는 바닥 영역.
 * 한 장짜리 배경 그림 위에 다각형으로 "밟을 수 있는 곳"을 지정하고,
 * 건물의 벽은 사각형, 나무줄기·바위 등은 타원 장애물로 막는다.
 */
export class WalkArea {
  readonly polygon: Phaser.Geom.Polygon;
  readonly obstacles: Obstacle[];

  constructor(points: number[], obstacles: Obstacle[] = []) {
    this.polygon = new Phaser.Geom.Polygon(points);
    this.obstacles = obstacles;
  }

  contains(x: number, y: number): boolean {
    if (!this.polygon.contains(x, y)) return false;
    for (const o of this.obstacles) {
      if (insideObstacle(o, x, y)) return false;
    }
    return true;
  }

  /**
   * (x, y)에서 (dx, dy)만큼 이동을 시도한다.
   * 막히면 가로/세로 한 축만이라도 움직여서 벽을 따라 미끄러지게 하고,
   * 그것도 안 되면 이동량을 줄여서 벽에 닿는 곳까지만 간다.
   */
  move(x: number, y: number, dx: number, dy: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 12));
    for (let i = 0; i < steps; i++) {
      this.moveStep(x, y, dx / steps, dy / steps, out);
      x = out.x;
      y = out.y;
    }
    return out;
  }

  private moveStep(x: number, y: number, dx: number, dy: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    if (this.contains(x + dx, y + dy)) return out.set(x + dx, y + dy);
    if (dx !== 0 && this.contains(x + dx, y)) return out.set(x + dx, y);
    if (dy !== 0 && this.contains(x, y + dy)) return out.set(x, y + dy);

    // 한 걸음이 클 때(회피, 낮은 프레임) 벽 앞에서 멀찍이 멈추지 않도록 갈 수 있는 만큼은 간다.
    let reach = 0;
    let blocked = 1;
    for (let i = 0; i < 4; i++) {
      const middle = (reach + blocked) / 2;
      if (this.contains(x + dx * middle, y + dy * middle)) reach = middle;
      else blocked = middle;
    }
    return out.set(x + dx * reach, y + dy * reach);
  }

  /** 두 지점 사이를 일정 간격으로 짚어 보아 막힌 곳이 없는지 확인한다. */
  hasClearPath(fromX: number, fromY: number, toX: number, toY: number, spacing = 20): boolean {
    const distance = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.contains(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)) return false;
    }
    return true;
  }

  /** 걸을 수 있는 영역을 감싸는 사각형 */
  get bounds(): Phaser.Geom.Rectangle {
    return Phaser.Geom.Polygon.GetAABB(this.polygon);
  }

  randomPoint(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounds = Phaser.Geom.Polygon.GetAABB(this.polygon);
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(bounds.left, bounds.right);
      const y = Phaser.Math.Between(bounds.top, bounds.bottom);
      if (this.contains(x, y)) return out.set(x, y);
    }
    return out.set(bounds.centerX, bounds.bottom - 20);
  }
}
