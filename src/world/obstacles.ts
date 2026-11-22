export interface Obstacle {
  x: number;
  y: number;
  rx: number;
  ry: number;
  shape?: 'ellipse' | 'rect';
}

/** Obstacles describe the ground footprint, leaving canopies and roofs free to overlap figures. */
export function insideObstacle(obstacle: Obstacle, x: number, y: number): boolean {
  if (obstacle.shape === 'rect') {
    return Math.abs(x - obstacle.x) < obstacle.rx && Math.abs(y - obstacle.y) < obstacle.ry;
  }
  const nx = (x - obstacle.x) / obstacle.rx, ny = (y - obstacle.y) / obstacle.ry;
  return nx * nx + ny * ny < 1;
}
