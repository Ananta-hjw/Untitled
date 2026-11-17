import { mapLength, mapPoint, mapObstacle } from './mapScale.ts';
import type { Obstacle } from './obstacles.ts';

// 담장 조각과 충돌은 직전 배치 좌표로 만든 뒤 아래에서 한 번만 확장한다.
const WORLD_WIDTH = 2640, WORLD_HEIGHT = 1760;

/** 두 마을 맵의 좌우 외곽은 같은 선을 따른다. 마을 내부의 남북 연결 길은 열어 둔다. */
const BASE_EDGE = { left: 112, right: 2290, north: 248, south: 1680 };
const BASE_GATES = {
  west: { x: 112, top: 940, bottom: 1160 },
  east: { x: 2290, top: 960, bottom: 1140 },
  south: { left: 1134, right: 1228, y: 1600 },
};
// 대각선 걷기 그림(발에서 최대65.25px)과 그림자(반폭55px)가 담 안쪽에 남을 여유를 둔다.
const WALL_HALF = 32;
const CHARACTER_CLEARANCE = 68;
export const VILLAGE_EDGE = Object.fromEntries(Object.entries(BASE_EDGE).map(([k, v]) => [k, mapLength(v)])) as typeof BASE_EDGE;
export const VILLAGE_GATES = {
  west: { x: mapLength(BASE_GATES.west.x), top: mapLength(BASE_GATES.west.top), bottom: mapLength(BASE_GATES.west.bottom) },
  east: { x: mapLength(BASE_GATES.east.x), top: mapLength(BASE_GATES.east.top), bottom: mapLength(BASE_GATES.east.bottom) },
  south: { left: mapLength(BASE_GATES.south.left), right: mapLength(BASE_GATES.south.right), y: mapLength(BASE_GATES.south.y) },
};
export const WALL_HALF_WIDTH = mapLength(WALL_HALF);
export const WALL_CHARACTER_CLEARANCE = mapLength(CHARACTER_CLEARANCE);
export const WALL_INNER_LEFT = VILLAGE_EDGE.left + WALL_HALF_WIDTH + WALL_CHARACTER_CLEARANCE;
export const WALL_INNER_RIGHT = VILLAGE_EDGE.right - WALL_HALF_WIDTH - WALL_CHARACTER_CLEARANCE;
export const PERIMETER_TEXTURE = 'village-perimeter';
export interface PerimeterPiece {
  frame: 'wall-horizontal' | 'wall-vertical' | 'gatepost';
  x: number; y: number; width: number; height: number;
  name: string;
}

const pieces: Record<string, PerimeterPiece[]> = { village: [], 'village-north': [] };
const obstacles: Record<string, Obstacle[]> = { village: [], 'village-north': [] };
const rect = (l: number, t: number, r: number, b: number): Obstacle =>
  ({ x: (l + r) / 2, y: (t + b) / 2, rx: (r - l) / 2, ry: (b - t) / 2, shape: 'rect' });

function horizontal(map: string, from: number, to: number, y: number): void {
  const count = Math.ceil((to - from) / 208), step = (to - from) / count;
  for (let i = 0; i < count; i++) pieces[map].push({
    frame: 'wall-horizontal', x: from + step * (i + .5), y, width: step + 2, height: 76, name: 'village-wall',
  });
}
function vertical(map: string, x: number, from: number, to: number): void {
  const count = Math.ceil((to - from) / 120), step = (to - from) / count;
  for (let i = 0; i < count; i++) pieces[map].push({
    frame: 'wall-vertical', x, y: from + step * (i + 1), width: 64, height: step + 2, name: 'village-wall',
  });
  const reach = WALL_HALF + CHARACTER_CLEARANCE;
  obstacles[map].push(x === BASE_EDGE.left
    ? rect(0, from, x + reach, to + 6)
    : rect(x - reach, from, WORLD_WIDTH, to + 6));
}
function post(map: string, x: number, y: number, name: string): void {
  pieces[map].push({ frame: 'gatepost', x: x + 8, y, width: 80, height: 142, name });
  // The lantern extends to the right of the masonry; collision follows only the stone base.
  obstacles[map].push(rect(x - 27 - CHARACTER_CLEARANCE, y - 25, x + 27 + CHARACTER_CLEARANCE, y + 6));
}

const e = BASE_EDGE;
// 북쪽의 담과 양옆 담. 광장으로 이어지는 아래쪽에는 가로 담을 세우지 않는다.
horizontal('village-north', e.left, e.right, e.north);
obstacles['village-north'].push(rect(e.left - 24, 224, e.right + 24, e.north + 6));
for (const x of [e.left, e.right]) {
  vertical('village-north', x, 224, WORLD_HEIGHT);
  post('village-north', x, e.north + 6, 'village-wall-corner');
}

for (const [direction, gate] of Object.entries({ west: BASE_GATES.west, east: BASE_GATES.east })) {
  vertical('village', gate.x, 0, gate.top - 12);
  vertical('village', gate.x, gate.bottom + 12, e.south);
  post('village', gate.x, gate.top, `village-gate-${direction}`);
  post('village', gate.x, gate.bottom + 24, `village-gate-${direction}`);
}
// Existing south-gate tower and wagon occupy x=867..1481 and leave the arch passage open.
for (const [from, to] of [[e.left, 867], [1481, e.right]]) {
  horizontal('village', from, to, e.south);
  obstacles.village.push(rect(from - 24, e.south - 24, to + 24, e.south + 6));
}
for (const x of [e.left, e.right]) post('village', x, e.south + 6, 'village-wall-corner');
// 바깥쪽 잔디는 걷기·순찰·성능 테스트의 생성 지점으로 사용하지 않는다.
obstacles.village.push(rect(0, e.south + 6, WORLD_WIDTH, WORLD_HEIGHT));

for (const map of Object.keys(pieces)) {
  pieces[map] = pieces[map].map(p => ({ ...mapPoint(p), width: mapLength(p.width), height: mapLength(p.height) }));
  obstacles[map] = obstacles[map].map(mapObstacle);
}

export function perimeterPieces(map: string): readonly PerimeterPiece[] { return pieces[map] ?? []; }
export function perimeterObstacles(map: string): readonly Obstacle[] { return obstacles[map] ?? []; }
