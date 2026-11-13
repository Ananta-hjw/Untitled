import Phaser from 'phaser';

export interface Obstacle {
  x: number;
  y: number;
  /** 바닥에 닿는 부분을 타원으로 근사한다 */
  rx: number;
  ry: number;
}

/**
 * 걸어다닐 수 있는 바닥 영역.
 * 한 장짜리 배경 그림 위에 다각형으로 "밟을 수 있는 곳"을 지정하고,
 * 그 안의 가구 등은 타원 장애물로 막는다.
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
      const nx = (x - o.x) / o.rx;
      const ny = (y - o.y) / o.ry;
      if (nx * nx + ny * ny < 1) return false;
    }
    return true;
  }

  /**
   * (x, y)에서 (dx, dy)만큼 이동을 시도한다.
   * 막히면 가로/세로 한 축만이라도 움직여서 벽을 따라 미끄러지게 한다.
   */
  move(x: number, y: number, dx: number, dy: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    if (this.contains(x + dx, y + dy)) return out.set(x + dx, y + dy);
    if (dx !== 0 && this.contains(x + dx, y)) return out.set(x + dx, y);
    if (dy !== 0 && this.contains(x, y + dy)) return out.set(x, y + dy);
    return out.set(x, y);
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
