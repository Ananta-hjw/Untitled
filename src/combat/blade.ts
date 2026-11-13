export interface Point { x: number; y: number }
export interface Blade { base: Point; tip: Point }

function segmentDistanceSq(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length)) : 0;
  return (a.x + dx * t) ** 2 + (a.y + dy * t) ** 2;
}

function triangleTouchesOrigin(a: Point, b: Point, c: Point): boolean {
  const cross = (p: Point, q: Point) => p.x * q.y - p.y * q.x;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const sides = [cross(a, b), cross(b, c), cross(c, a)];
  const inside = Math.abs(area) > 1e-9 &&
    (sides.every((v) => v >= 0) || sides.every((v) => v <= 0));
  return inside || Math.min(segmentDistanceSq(a, b), segmentDistanceSq(b, c), segmentDistanceSq(c, a)) <= 1;
}

/** 이전/현재 검날 사이를 채워 저프레임에서도 빠른 베기가 적을 건너뛰지 않게 한다. */
export function bladeHitsEllipse(previous: Blade, current: Blade, center: Point, rx: number, ry: number): boolean {
  const normalize = (p: Point): Point => ({ x: (p.x - center.x) / rx, y: (p.y - center.y) / ry });
  const a = normalize(previous.base);
  const b = normalize(previous.tip);
  const c = normalize(current.tip);
  const d = normalize(current.base);
  return triangleTouchesOrigin(a, b, c) || triangleTouchesOrigin(a, c, d);
}
