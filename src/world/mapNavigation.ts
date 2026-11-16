import type { GameMap, MapExit, Point } from './maps.ts';

export type Cardinal = 'north' | 'east' | 'south' | 'west';
export const CARDINAL: Record<Cardinal, { name: string; arrow: string }> = {
  north: { name: '북쪽', arrow: '↑' }, east: { name: '동쪽', arrow: '→' },
  south: { name: '남쪽', arrow: '↓' }, west: { name: '서쪽', arrow: '←' },
};
export const EXIT_NOTICE_DISTANCE = 240;

/** Match the actual traversable portion of an exit, rather than the full off-map rectangle. */
export function exitPoint(map: GameMap, exit: MapExit): Point {
  const b = map.bounds, z = exit.zone;
  return { x: (Math.max(b.left, z.left) + Math.min(b.right, z.right)) / 2,
    y: (Math.max(b.top, z.top) + Math.min(b.bottom, z.bottom)) / 2 };
}
export function exitDirection(map: GameMap, point: Point): Cardinal {
  const b = map.bounds;
  const dx = (point.x - (b.left + b.right) / 2) / (b.right - b.left);
  const dy = (point.y - (b.top + b.bottom) / 2) / (b.bottom - b.top);
  return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'west' : 'east' : dy < 0 ? 'north' : 'south';
}

/** Only announce a real nearby passage; approaching a sealed stretch of the edge shows nothing. */
export function nearbyExit(map: GameMap, player: Point): MapExit | undefined {
  let nearest: MapExit | undefined, distance = EXIT_NOTICE_DISTANCE;
  for (const exit of map.exits) {
    const z = exit.zone;
    const dx = player.x - Math.max(z.left, Math.min(z.right, player.x));
    const dy = player.y - Math.max(z.top, Math.min(z.bottom, player.y));
    const d = Math.hypot(dx, dy);
    if (d <= distance) { nearest = exit; distance = d; }
  }
  return nearest;
}
