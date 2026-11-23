import { NavGrid, type NavPoint } from './navGrid.ts';

interface Bounds { left: number; top: number; right: number; bottom: number }

/** Find a short, collision-checked evacuation route without changing the enemies' shared navigation target. */
export function npcExitPath(start: NavPoint, destination: NavPoint, bounds: Bounds,
  contains: (x: number, y: number) => boolean): NavPoint[] {
  const clear = (a: NavPoint, b: NavPoint): boolean => {
    const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    for (let i = 0; i <= samples; i++) {
      if (!contains(a.x + (b.x - a.x) * i / samples, a.y + (b.y - a.y) * i / samples)) return false;
    }
    return true;
  };
  if (!contains(start.x, start.y) || !contains(destination.x, destination.y)) return [];
  if (clear(start, destination)) return [{ ...destination }];
  for (const cell of [32, 16]) {
    const grid = new NavGrid(bounds.left, bounds.top, bounds.right, bounds.bottom, cell, contains);
    grid.setTarget(destination.x, destination.y);
    const raw: NavPoint[] = [{ ...start }];
    let point = { ...start };
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const next = { x: 0, y: 0 };
      if (!grid.next(point.x, point.y, next)) break;
      raw.push(next); point = next;
    }
    raw.push({ ...destination });
    if (raw.some((p, i) => i > 0 && !clear(raw[i - 1], p))) continue;
    const route: NavPoint[] = [];
    let from = 0;
    while (from < raw.length - 1) {
      let to = raw.length - 1;
      while (to > from + 1 && !clear(raw[from], raw[to])) to--;
      route.push(raw[to]); from = to;
    }
    return route;
  }
  return [];
}
