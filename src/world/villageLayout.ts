import type { Obstacle } from './obstacles';

/**
 * 로웬 마을 배치 (docs/rowen-village.md).
 *
 * 가운데 큰 나무를 두고 북서쪽 가족 집, 북쪽 촌장 집, 북동쪽 치유소, 서쪽 수련소, 동쪽 잡화점,
 * 남서쪽 대장간, 남동쪽 여관, 남쪽 입구(초소·아치·수레)가 둘러싼다.
 * 건물 그림은 src/assets/village/rowen/buildings.webp(tools/build_rowen_assets.py)이고,
 * 좌표는 그림 아래 가운데(바닥에 닿는 곳) 기준이다.
 */

export const PLAYER_SPAWN = { x: 430, y: 640 };
// Reserve room for the full walking sprite and its name plate at camera boundaries.
export const WALK_BOUNDS = { left: 64, top: 224, right: 2336, bottom: 1560 };

export type BuildingFrame =
  | 'family-house' | 'training-hall' | 'chief-house' | 'clinic'
  | 'smithy' | 'general-store' | 'inn' | 'south-gate';

export interface Building {
  frame: BuildingFrame;
  /** 그림 아래 가운데 (바닥 기준) */
  x: number;
  y: number;
  /** 화면에 그리는 너비. 높이는 그림 비율을 따른다. */
  width: number;
  /** 벽과 기단의 바닥 영역. 지붕은 막지 않아 캐릭터가 건물 뒤로 지나갈 수 있다. */
  footprint: Obstacle[];
  /** 문 앞. 걸을 수 있는 곳이어야 한다. */
  door: { x: number; y: number };
  /** 건물 위에 띄우는 이름 */
  label: string;
}

const wall = (left: number, top: number, right: number, bottom: number): Obstacle =>
  ({ x: (left + right) / 2, y: (top + bottom) / 2, rx: (right - left) / 2, ry: (bottom - top) / 2, shape: 'rect' });

export const BUILDINGS: Building[] = [
  { frame: 'family-house', x: 430, y: 540, width: 500, label: '시온의 집',
    footprint: [wall(220, 443, 640, 522)], door: { x: 415, y: 580 } },
  { frame: 'chief-house', x: 1180, y: 470, width: 380, label: '촌장의 집',
    footprint: [wall(1020, 370, 1340, 455)], door: { x: 1180, y: 510 } },
  { frame: 'clinic', x: 1950, y: 500, width: 540, label: '치유소',
    footprint: [wall(1720, 410, 2180, 485)], door: { x: 1912, y: 540 } },
  { frame: 'training-hall', x: 450, y: 990, width: 520, label: '수련소',
    footprint: [wall(225, 905, 675, 975)], door: { x: 450, y: 1030 } },
  { frame: 'general-store', x: 1960, y: 900, width: 420, label: '잡화점',
    footprint: [wall(1780, 810, 2140, 885)], door: { x: 1960, y: 940 } },
  { frame: 'smithy', x: 470, y: 1460, width: 520, label: '대장간',
    footprint: [wall(245, 1370, 695, 1445)], door: { x: 402, y: 1500 } },
  { frame: 'inn', x: 1930, y: 1460, width: 600, label: '여관',
    footprint: [wall(1670, 1370, 2190, 1445)], door: { x: 1858, y: 1500 } },
  // 남쪽 입구: 왼쪽 초소와 오른쪽 행상 수레 사이, 아치 기둥 안쪽만 지나갈 수 있다.
  { frame: 'south-gate', x: 1174, y: 1560, width: 640, label: '',
    footprint: [wall(867, 1490, 1134, 1600), wall(1228, 1490, 1481, 1600)], door: { x: 1181, y: 1440 } },
];

/** 남쪽 입구 아치의 통로 (두 기둥 사이) */
export const SOUTH_GATE_PASSAGE = { left: 1134, right: 1228 };

export const HOME = BUILDINGS[0];

export interface VillageProp {
  frame: 'oak' | 'pine' | 'boulders' | 'shrub' | 'rock' | 'flowers' | 'sign' | 'stump';
  x: number;
  y: number;
  width: number;
  footprint?: { rx: number; ry: number };
}

export const PROPS: VillageProp[] = [
  // 마을 한가운데 큰 나무
  { frame: 'oak', x: 1180, y: 900, width: 420, footprint: { rx: 46, ry: 28 } },
  { frame: 'pine', x: 100, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'pine', x: 790, y: 330, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'oak', x: 1540, y: 330, width: 290, footprint: { rx: 34, ry: 22 } },
  { frame: 'pine', x: 2320, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'oak', x: 110, y: 1320, width: 230, footprint: { rx: 30, ry: 20 } },
  { frame: 'pine', x: 2320, y: 1300, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'shrub', x: 770, y: 640, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1620, y: 640, width: 110, footprint: { rx: 45, ry: 19 } },
  { frame: 'shrub', x: 790, y: 1180, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1560, y: 1150, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'rock', x: 1430, y: 1300, width: 80, footprint: { rx: 35, ry: 18 } },
  { frame: 'stump', x: 700, y: 1060, width: 80, footprint: { rx: 32, ry: 18 } },
  { frame: 'flowers', x: 690, y: 560, width: 70 },
  { frame: 'flowers', x: 200, y: 590, width: 65 },
  { frame: 'flowers', x: 2220, y: 560, width: 70 },
  { frame: 'flowers', x: 1020, y: 990, width: 65 },
  { frame: 'flowers', x: 1340, y: 840, width: 65 },
  { frame: 'flowers', x: 1250, y: 560, width: 60 },
  { frame: 'flowers', x: 2240, y: 1010, width: 60 },
  { frame: 'sign', x: 1330, y: 1010, width: 90, footprint: { rx: 15, ry: 13 } },
];

/** 소품의 바닥 접점(줄기·바위 밑동)만 장애물로 만든다. 다른 맵도 같은 규칙을 쓴다. */
export function propObstacles(props: readonly VillageProp[]): Obstacle[] {
  return props.flatMap((p) => p.footprint ? [{ x: p.x, y: p.y - p.footprint.ry * .45, ...p.footprint }] : []);
}

export function buildingObstacles(buildings: readonly Building[]): Obstacle[] {
  return buildings.flatMap((b) => b.footprint);
}

// 마을은 평화로운 곳이라 몬스터가 나오지 않는다. 몬스터는 마을 밖 사냥터(maps.ts)에 있다.
export const OBSTACLES: Obstacle[] = [...buildingObstacles(BUILDINGS), ...propObstacles(PROPS)];
