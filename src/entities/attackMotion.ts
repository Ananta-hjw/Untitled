import { interpolateBlade, type Blade, type Point } from '../combat/blade.ts';

const SWING_SEGMENTS = 12;
const TRAIL_SPACING = 7;
const CORNER_RADIUS = 4;

/** Interpolate the angle and length as the grip moves, even when the drawn poses step. */
export function interpolateSwingBlade(from: Blade, to: Blade, t: number): Blade {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const dx0 = from.tip.x - from.base.x, dy0 = from.tip.y - from.base.y;
  const dx1 = to.tip.x - to.base.x, dy1 = to.tip.y - to.base.y;
  const length0 = Math.hypot(dx0, dy0), length1 = Math.hypot(dx1, dy1);
  const start = Math.atan2(dy0, dx0), end = Math.atan2(dy1, dx1);
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  const { base } = interpolateBlade(from, to, t);
  const angle = start + delta * t;
  const length = length0 + (length1 - length0) * t;
  return { base, tip: { x: base.x + Math.cos(angle) * length, y: base.y + Math.sin(angle) * length } };
}

export function swingTrailArc(from: Blade, to: Blade): Blade[] {
  return Array.from({ length: SWING_SEGMENTS + 1 }, (_, i) => interpolateSwingBlade(from, to, i / SWING_SEGMENTS));
}

/** Round pose joins at a consistent spatial scale, keeping both ends on the sampled blade. */
export function smoothSwingTrail(knots: Blade[]): Blade[] {
  const distances = trailDistances(knots);
  const length = distances[distances.length - 1];
  const count = Math.max(1, Math.ceil(length / TRAIL_SPACING));
  const evenlySpaced = [knots[0]];
  let segment = 1;
  for (let i = 1; i < count; i++) {
    const distance = length * i / count;
    while (distances[segment] <= distance) segment++;
    const start = distances[segment - 1], end = distances[segment];
    evenlySpaced.push(interpolateSwingBlade(knots[segment - 1], knots[segment], (distance - start) / (end - start)));
  }
  evenlySpaced.push(knots[knots.length - 1]);
  return evenlySpaced.map((blade, i) => {
    const radius = Math.min(CORNER_RADIUS, i, evenlySpaced.length - 1 - i);
    if (radius === 0) return blade;
    // A symmetric triangular filter removes the elbow without shifting straight portions.
    const tip = { x: 0, y: 0 };
    const total = (radius + 1) ** 2;
    for (let offset = -radius; offset <= radius; offset++) {
      const point = evenlySpaced[i + offset].tip;
      const weight = (radius + 1 - Math.abs(offset)) / total;
      tip.x += point.x * weight;
      tip.y += point.y * weight;
    }
    return { base: blade.base, tip };
  });
}

function trailDistances(blades: Blade[]): number[] {
  const distances = [0];
  for (let i = 1; i < blades.length; i++) {
    const a = blades[i - 1].tip, b = blades[i].tip;
    distances.push(distances[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return distances;
}

interface TrailEdge { tip: Point; offset: Point }

/** Keep each cross-section perpendicular to the path, even when the blade points along it. */
export function swingTrailEdge(blades: Blade[]): TrailEdge[] {
  const distances = trailDistances(blades);
  const length = distances[distances.length - 1];
  if (length < 1) return [];

  const normals = blades.map(({ tip }, i) => {
    const prev = blades[i - 1]?.tip ?? tip, next = blades[i + 1]?.tip ?? tip;
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const span = Math.hypot(dx, dy) || 1;
    return { x: -dy / span, y: dx / span };
  });
  // Keep the same inside edge for the whole ribbon, choosing the side that generally faces the hand.
  const side = blades.reduce((sum, { base, tip }, i) =>
    sum + normals[i].x * (base.x - tip.x) + normals[i].y * (base.y - tip.y), 0) < 0 ? -1 : 1;

  return blades.map(({ base, tip }, i) => {
    const progress = distances[i] / length;
    const width = Math.hypot(base.x - tip.x, base.y - tip.y)
      * (0.82 * Math.sin(Math.PI * progress) ** 0.65 + 0.18 * progress);
    return { tip, offset: { x: normals[i].x * width * side, y: normals[i].y * width * side } };
  });
}
