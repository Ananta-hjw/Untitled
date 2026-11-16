import { WORLD_HEIGHT } from '../config.ts';
import type { Obstacle } from './obstacles.ts';

/** 두 마을 맵의 좌우 외곽은 같은 선을 따른다. 마을 내부의 남북 연결 길은 열어 둔다. */
export const VILLAGE_EDGE = { left: 112, right: 2290, north: 248, south: 1680 };
export const VILLAGE_GATES = {
  west: { x: 112, top: 940, bottom: 1160 },
  east: { x: 2290, top: 960, bottom: 1140 },
  south: { left: 1134, right: 1228, y: 1600 },
};
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
  obstacles[map].push(rect(x - 24, from, x + 24, to + 6));
}
function post(map: string, x: number, y: number, name: string): void {
  pieces[map].push({ frame: 'gatepost', x: x + 8, y, width: 80, height: 142, name });
  // The lantern extends to the right of the masonry; collision follows only the stone base.
  obstacles[map].push(rect(x - 27, y - 25, x + 27, y + 6));
}

const e = VILLAGE_EDGE;
// 북쪽의 담과 양옆 담. 광장으로 이어지는 아래쪽에는 가로 담을 세우지 않는다.
horizontal('village-north', e.left, e.right, e.north);
obstacles['village-north'].push(rect(e.left - 24, 224, e.right + 24, e.north + 6));
for (const x of [e.left, e.right]) {
  vertical('village-north', x, 224, WORLD_HEIGHT);
  post('village-north', x, e.north + 6, 'village-wall-corner');
}

for (const [direction, gate] of Object.entries({ west: VILLAGE_GATES.west, east: VILLAGE_GATES.east })) {
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

export function perimeterPieces(map: string): readonly PerimeterPiece[] { return pieces[map] ?? []; }
export function perimeterObstacles(map: string): readonly Obstacle[] { return obstacles[map] ?? []; }
