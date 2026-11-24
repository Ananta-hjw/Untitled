import { interpolateBlade, type Blade } from '../combat/blade.ts';

const SWING_SEGMENTS = 12;

/** Bridge the stepped strike poses with a curved tip path and a moving hand. */
export function swingTrailArc(from: Blade, to: Blade): Blade[] {
  const dx0 = from.tip.x - from.base.x, dy0 = from.tip.y - from.base.y;
  const dx1 = to.tip.x - to.base.x, dy1 = to.tip.y - to.base.y;
  const length0 = Math.hypot(dx0, dy0), length1 = Math.hypot(dx1, dy1);
  const start = Math.atan2(dy0, dx0), end = Math.atan2(dy1, dx1);
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  const arc = [from];
  for (let i = 1; i < SWING_SEGMENTS; i++) {
    const t = i / SWING_SEGMENTS;
    const { base } = interpolateBlade(from, to, t);
    const angle = start + delta * t;
    const length = length0 + (length1 - length0) * t;
    arc.push({ base, tip: { x: base.x + Math.cos(angle) * length, y: base.y + Math.sin(angle) * length } });
  }
  arc.push(to);
  return arc;
}
