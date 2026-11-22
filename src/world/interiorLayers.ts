import { INTERIOR_ART, type Interior, type PixelRect } from './interiors.ts';

/** Subtract object rectangles so their pixels belong to objects, not a duplicate backdrop. */
export function interiorBackgroundPieces(interior: Interior): PixelRect[] {
  const art = INTERIOR_ART[interior.id];
  let pieces: PixelRect[] = [[0, 0, art.width, art.height]];
  for (const { art: [l, t, r, b] } of interior.furniture) {
    pieces = pieces.flatMap(([x0, y0, x1, y1]): PixelRect[] => {
      const a = Math.max(l, x0), c = Math.min(r, x1), d = Math.max(t, y0), e = Math.min(b, y1);
      if (a >= c || d >= e) return [[x0, y0, x1, y1]];
      const out: PixelRect[] = [];
      if (y0 < d) out.push([x0, y0, x1, d]);
      if (e < y1) out.push([x0, e, x1, y1]);
      if (x0 < a) out.push([x0, d, a, e]);
      if (c < x1) out.push([c, d, x1, e]);
      return out;
    });
  }
  return pieces;
}
