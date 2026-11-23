export interface Point { x: number; y: number }
export interface Blade { base: Point; tip: Point }
export interface BladeSweep { previous: Blade; current: Blade; start: number; end: number }

export function interpolateBlade(a: Blade, b: Blade, t: number): Blade {
  t = Math.max(0, Math.min(1, t));
  const point = (from: Point, to: Point): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  return { base: point(a.base, b.base), tip: point(a.tip, b.tip) };
}

/** 프레임이 유효 시간의 시작·끝을 넘더라도 그 안의 검날 이동만 반환한다. */
export function clipBladeSweep(previous: Blade, current: Blade, from: number, to: number,
  windowStart: number, windowEnd: number): BladeSweep | undefined {
  if (to <= from || from >= windowEnd || to < windowStart) return;
  const start = Math.max(from, windowStart);
  const end = Math.min(to, windowEnd);
  if (end < start) return;
  return {
    previous: interpolateBlade(previous, current, (start - from) / (to - from)),
    current: interpolateBlade(previous, current, (end - from) / (to - from)),
    start, end,
  };
}

/** A stepped attack pose moves the whole blade at strikeAt, rather than over the preceding frame. */
export function attackBladeSweep(previous: Blade, current: Blade, from: number, to: number,
  strikeAt: number, windowEnd: number): BladeSweep | undefined {
  if (to <= from || from >= windowEnd) return;
  // Match the pose clock's tolerance so floating point deltas cannot lose or repeat the transition.
  const entersStrike = from + 1e-6 < strikeAt && to + 1e-6 >= strikeAt;
  if (!entersStrike) return clipBladeSweep(previous, current, from, to, strikeAt, windowEnd);
  const end = Math.min(to, windowEnd);
  return {
    previous,
    current: end < to ? interpolateBlade(previous, current, (end - from) / (to - from)) : current,
    start: Math.min(strikeAt, to),
    end,
  };
}

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
