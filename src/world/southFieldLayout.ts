import { WORLD_WIDTH } from '../config.ts';
import type { Obstacle } from './obstacles.ts';

/** 남쪽 들판 원화(1536×1024)를 확장된 월드에 같은 비율로 표시한다. */
export const FIELD_SCALE = WORLD_WIDTH / 1536;

// 물가를 따라 걷기 경계를 잡고, 다리 위만 동쪽으로 돌출시킨다.
const SHORE = [
  40, 170, 620, 170, 695, 105, 800, 105, 835, 170, 1395, 170,
  1370, 225, 1330, 285, 1320, 340, 1280, 385, 1280, 415,
  1460, 415, 1460, 470, 1290, 470, 1280, 540, 1220, 620,
  1210, 690, 1140, 780, 1100, 840, 1060, 900, 1030, 995, 40, 995,
];
export const FIELD_POLYGON = SHORE.map(n => n * FIELD_SCALE);
export const FIELD_BOUNDS = { left: 40 * FIELD_SCALE, top: 105 * FIELD_SCALE, right: 1460 * FIELD_SCALE, bottom: 995 * FIELD_SCALE };

/** 나무는 줄기, 바위는 실제 바닥 접촉면을 막는다. 원화의 나무·돌을 중복 배치하지 않는다. */
const FOOTPRINTS = [
  [95, 180, 38, 30], [265, 140, 34, 24], [56, 340, 32, 28],
  [1150, 230, 58, 34], [1460, 380, 32, 28], [82, 760, 44, 38],
  [835, 938, 38, 27], [1440, 970, 38, 28],
  [220, 195, 65, 26], [350, 232, 45, 25], [175, 361, 54, 24],
  [812, 289, 54, 24], [1100, 295, 48, 24], [1294, 207, 46, 25],
  [1090, 410, 54, 25], [650, 518, 78, 32], [1205, 685, 50, 24],
  [1010, 715, 62, 26], [486, 811, 62, 24], [370, 882, 52, 24],
] as const;
export const FIELD_OBSTACLES: Obstacle[] = FOOTPRINTS.map(([x, y, rx, ry]) => ({
  x: x * FIELD_SCALE, y: y * FIELD_SCALE, rx: rx * FIELD_SCALE, ry: ry * FIELD_SCALE,
}));

/** 전경 나무의 잎·줄기만 원화에서 다시 그리는 마스크. 깊이는 줄기가 땅에 닿는 y. */
export const FIELD_FOREGROUND = [
  { depth: 938, polygon: [650, 800, 690, 750, 745, 711, 825, 704, 910, 735, 965, 790, 950, 836, 875, 865, 857, 914, 880, 942, 809, 952, 804, 867, 710, 860] },
  { depth: 760, polygon: [0, 536, 42, 540, 84, 578, 147, 640, 163, 694, 117, 727, 106, 761, 154, 793, 87, 804, 49, 769, 0, 762] },
  { depth: 230, polygon: [1010, 0, 1325, 0, 1370, 45, 1370, 95, 1295, 145, 1190, 170, 1170, 210, 1204, 237, 1110, 244, 1127, 182, 1035, 153, 1000, 93] },
] as const;

/** Phaser에 의존하지 않는 점-다각형 검사 (저장/이동 검사도 같은 경계를 사용). */
export function insidePolygon(points: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i], yi = points[i + 1], xj = points[j], yj = points[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
