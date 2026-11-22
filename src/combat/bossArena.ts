import { insideEllipse } from './bossPattern.ts';

/**
 * 보스전 결계 (Phaser를 쓰지 않아 tools/boss-arena.test.mjs가 직접 불러 검사한다).
 *
 * "보스 등장" 경고가 뜨면 바닥에 부식 안개 고리가 번지고, 보스가 나타나는 순간 닫혀 그 밖으로는 나갈 수 없다.
 * 고리 중심은 주인공 가까이의 트인 곳에서 고른다: 고리 안 바닥이 거의 다 걸을 수 있고(집 벽·나무 밑동이 적고)
 * 건물 그림이나 나무 뒤에 가려지는 곳이 거의 없는 자리 가운데, 주인공이 고리 안쪽에 드는 자리를 먼저,
 * 그런 곳이 없으면(집 뒤 구석 등) 주인공에게 가장 가까운 트인 곳을 고르고, 경고 동안 안개가 주인공을 안쪽으로 밀어 넣는다.
 * 보스는 고리 안에서 주인공의 반대편에 내려앉는다. 보스를 쓰러뜨리면 안개가 걷히고 물러났던 병사들이 돌아온다.
 */
export const ARENA = {
  /** 고리의 가로·세로 반지름 (바닥 원근이라 세로가 짧다) */
  rx: 520,
  ry: 290,
  /** 고리 안 바닥 가운데 걸을 수 있고 가려지지 않아야 하는 몫 */
  minOpen: 0.9,
  /** 주인공이 이만큼(반지름 비율) 안쪽에 있어야 "고리 안"으로 친다 (테두리에 붙어 시작하지 않게) */
  heroInner: 0.8,
  /** 밖에서 밀려 들어오는 주인공은 이만큼 안쪽까지 들어온다 */
  pushInner: 0.6,
  /** 경고 동안 안개가 주인공을 안쪽으로 미는 빠르기 (px/s) */
  pushSpeed: 300,
  /** 후보 중심을 찍는 간격 */
  gridStep: 80,
  /** 보스가 내려앉는 자리: 중심에서 주인공 반대쪽으로 반지름의 이만큼 */
  bossOffset: 0.55,
  /** 안개가 번지고(경고 동안) 걷히는 시간 */
  fadeOutMs: 900,
} as const;

export interface Arena { x: number; y: number; rx: number; ry: number }
interface Point { x: number; y: number }
interface Box { left: number; top: number; right: number; bottom: number }

/** 고리 안(scale: 반지름 비율)인지 */
export function insideArena(arena: Arena, x: number, y: number, scale = 1): boolean {
  return insideEllipse(x - arena.x, y - arena.y, arena.rx * scale, arena.ry * scale);
}

/** 고리 안 바닥을 고르게 짚는 점들 (가운데·고리 세 겹, 테두리 포함) */
export function arenaSamples(rx: number, ry: number): Point[] {
  const points: Point[] = [{ x: 0, y: 0 }];
  for (const [ring, count] of [[0.35, 8], [0.7, 14], [1, 20]] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      points.push({ x: Math.cos(a) * rx * ring, y: Math.sin(a) * ry * ring });
    }
  }
  return points;
}

/** 중심이 (x, y)인 고리 안 바닥에서 열린(걸을 수 있고 가려지지 않는) 곳의 몫 */
export function arenaOpenness(x: number, y: number, open: (x: number, y: number) => boolean,
  rx: number = ARENA.rx, ry: number = ARENA.ry): number {
  const samples = arenaSamples(rx, ry);
  return samples.filter((s) => open(x + s.x, y + s.y)).length / samples.length;
}

/**
 * 결계 중심을 고른다. bounds 안을 gridStep 간격으로 짚어 열린 몫이 minOpen 이상인 자리만 후보로 삼고,
 * 주인공이 heroInner 안쪽에 드는 후보 중 주인공과 가장 가까운 것, 없으면 그냥 주인공과 가장 가까운 후보.
 * 후보가 하나도 없으면 주인공 자리 그대로.
 */
export function chooseArena(hero: Point, bounds: Box, open: (x: number, y: number) => boolean): Arena {
  const { rx, ry, gridStep } = ARENA;
  let inner: { p: Point; d: number } | undefined;
  let nearest: { p: Point; d: number } | undefined;
  for (let y = bounds.top + ry; y <= bounds.bottom - ry * 0.5; y += gridStep) {
    for (let x = bounds.left + rx * 0.5; x <= bounds.right - rx * 0.5; x += gridStep) {
      if (!open(x, y) || arenaOpenness(x, y, open) < ARENA.minOpen) continue;
      // 가로·세로 반지름이 달라 바닥 원근 거리로 잰다.
      const d = Math.hypot((hero.x - x) / rx, (hero.y - y) / ry);
      if (!nearest || d < nearest.d) nearest = { p: { x, y }, d };
      if (d <= ARENA.heroInner && (!inner || d < inner.d)) inner = { p: { x, y }, d };
    }
  }
  const p = (inner ?? nearest)?.p ?? hero;
  return { x: p.x, y: p.y, rx, ry };
}

/** 고리 밖(또는 테두리 가까이)의 주인공을 중심 쪽으로 distance만큼 민다. pushInner 안쪽이면 그대로. */
export function pushTowardArena(arena: Arena, x: number, y: number, distance: number): Point {
  if (insideArena(arena, x, y, ARENA.pushInner)) return { x, y };
  const dx = arena.x - x, dy = arena.y - y, length = Math.hypot(dx, dy) || 1;
  const step = Math.min(distance, length);
  return { x: x + (dx / length) * step, y: y + (dy / length) * step };
}

/** 닫힐 때 밖에 있던 주인공을 세우는 깊이 (테두리에 붙지 않게) */
const ENTRY_DEPTH = 0.75;

/**
 * 결계가 닫힐 때 아직 밖에 있으면 세울 자리: 주인공에서 중심으로 가는 선 위에서 고리 안쪽의 첫 열린 곳.
 * 그런 곳이 없으면 중심.
 */
export function entryPoint(arena: Arena, x: number, y: number, open: (x: number, y: number) => boolean): Point {
  if (insideArena(arena, x, y) && open(x, y)) return { x, y };
  for (let t = 0; t <= 1; t += 0.05) {
    const px = x + (arena.x - x) * t, py = y + (arena.y - y) * t;
    if (insideArena(arena, px, py, ENTRY_DEPTH) && open(px, py)) return { x: px, y: py };
  }
  return { x: arena.x, y: arena.y };
}

/** 보스가 내려앉는 자리: 고리 안에서 주인공 반대편. 막혀 있으면 조금씩 중심 쪽으로 당긴다. */
export function bossLanding(arena: Arena, hero: Point, open: (x: number, y: number) => boolean): Point {
  let dx = arena.x - hero.x, dy = (arena.y - hero.y) * (arena.rx / arena.ry);
  const length = Math.hypot(dx, dy);
  if (length < 1) { dx = 1; dy = 0; } else { dx /= length; dy /= length; }
  for (let k = ARENA.bossOffset; k >= 0; k -= 0.05) {
    const x = arena.x + dx * arena.rx * k, y = arena.y + dy * arena.ry * k;
    if (open(x, y)) return { x, y };
  }
  return { x: arena.x, y: arena.y };
}
