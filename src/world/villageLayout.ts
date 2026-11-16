import type { Obstacle } from './obstacles';

/**
 * 로웬 마을 배치 (docs/rowen-village.md).
 *
 * 마을은 두 맵으로 나뉜다. 위아래 가운데 길로 오간다.
 * - 로웬 마을 북쪽(village-north, 집들이 있는 곳): 시온의 집, 촌장의 집, 치유소, 그리고 아래쪽의 리네아의 집.
 *   새 게임은 여기 시온의 집 앞에서 시작한다.
 * - 로웬 마을(village, 광장): 가운데 큰 나무를 두고 서쪽 수련소, 동쪽 잡화점, 남서쪽 대장간, 남동쪽 여관,
 *   남쪽 입구(초소·아치·수레). 들판·숲길·개울가로 나가는 출구가 여기 있다.
 * 건물 그림은 src/assets/village/rowen/buildings.webp(tools/build_rowen_assets.py)이고,
 * 좌표는 그림 아래 가운데(바닥에 닿는 곳) 기준이다.
 */

export const PLAYER_SPAWN = { x: 430, y: 640 };
// Reserve room for the full walking sprite and its name plate at camera boundaries.
export const WALK_BOUNDS = { left: 64, top: 224, right: 2336, bottom: 1560 };

/** 마을의 두 맵 (maps.ts의 MapId와 같은 이름) */
export type VillageArea = 'village' | 'village-north';

/** 두 맵을 잇는 가운데 길 (북쪽 맵의 아래 끝, 광장의 위 끝) */
export const VILLAGE_LINK = { left: 1100, right: 1260 };

export type BuildingFrame =
  | 'family-house' | 'training-hall' | 'chief-house' | 'clinic'
  | 'smithy' | 'general-store' | 'inn' | 'south-gate' | 'linea-house';

export interface Building {
  frame: BuildingFrame;
  /** 이 건물이 있는 맵 */
  area: VillageArea;
  /** 그림 아래 가운데 (바닥 기준) */
  x: number;
  y: number;
  /** 화면에 그리는 너비. 높이는 그림 비율을 따른다. */
  width: number;
  /**
   * 건물이 땅을 차지하는 영역(앞쪽 기단부터 건물 몸체 뒤쪽까지). 이 안으로는 걸어 들어갈 수 없다.
   * 지붕 꼭대기 쪽은 막지 않아, 건물 뒤로 돌아갈 때 캐릭터가 지붕에 가려진다.
   */
  footprint: Obstacle[];
  /** 문 앞. 걸을 수 있는 곳이어야 한다. 나중에 건물 안으로 들어가는 입구가 된다. */
  door: { x: number; y: number };
  /** 건물 위에 띄우는 이름 */
  label: string;
}

const wall = (left: number, top: number, right: number, bottom: number): Obstacle =>
  ({ x: (left + right) / 2, y: (top + bottom) / 2, rx: (right - left) / 2, ry: (bottom - top) / 2, shape: 'rect' });

/**
 * 건물 그림이 땅을 차지하는 영역 전체를 막는 벽. 그림 아래 끝(y)보다 FRONT만큼 앞까지, 그림 양옆보다 SIDE만큼 바깥까지 막는다.
 * 캐릭터는 발(y)로 깊이를 정하므로, 발이 그림 아래 끝보다 위에 있으면 건물 그림에 몸이 가려져
 * 문 앞에서 위로 걷거나 옆에서 다가갈 때 건물 안으로 걸어 들어가는 것처럼 보였다.
 * 이렇게 막으면 앞과 옆에서는 늘 건물 앞에 그려진다(뒤쪽 지붕에 가려지는 것은 그대로 둔다).
 */
const FRONT = 6;
const SIDE = 24;
const body = (x: number, y: number, width: number, top: number): Obstacle =>
  wall(x - width / 2 - SIDE, top, x + width / 2 + SIDE, y + FRONT);

// 북쪽 맵 위쪽 줄 건물(시온의 집, 촌장의 집, 치유소)은 뒤쪽 벽이 걸을 수 있는 영역의 위쪽 끝에 닿아,
// 지붕 뒤의 좁은 틈으로 들어가 캐릭터가 통째로 가려지는 일이 없다.
export const BUILDINGS: Building[] = [
  { frame: 'family-house', area: 'village-north', x: 430, y: 540, width: 500, label: '시온의 집',
    footprint: [body(430, 540, 500, WALK_BOUNDS.top)], door: { x: 415, y: 580 } },
  { frame: 'chief-house', area: 'village-north', x: 1180, y: 470, width: 380, label: '촌장의 집',
    footprint: [body(1180, 470, 380, WALK_BOUNDS.top)], door: { x: 1180, y: 510 } },
  { frame: 'clinic', area: 'village-north', x: 1950, y: 500, width: 540, label: '치유소',
    footprint: [body(1950, 500, 540, WALK_BOUNDS.top)], door: { x: 1912, y: 540 } },
  // 리네아의 집: 시온의 집 아래쪽 꽃밭 옆 낮은 오두막 (1장의 창문 매듭 장면)
  { frame: 'linea-house', area: 'village-north', x: 720, y: 1100, width: 380, label: '리네아의 집',
    footprint: [body(720, 1100, 380, 985)], door: { x: 700, y: 1140 } },
  { frame: 'training-hall', area: 'village', x: 450, y: 990, width: 520, label: '수련소',
    footprint: [body(450, 990, 520, 840)], door: { x: 450, y: 1030 } },
  { frame: 'general-store', area: 'village', x: 1960, y: 900, width: 420, label: '잡화점',
    footprint: [body(1960, 900, 420, 700)], door: { x: 1960, y: 940 } },
  { frame: 'smithy', area: 'village', x: 470, y: 1460, width: 520, label: '대장간',
    footprint: [body(470, 1460, 520, 1270)], door: { x: 402, y: 1500 } },
  { frame: 'inn', area: 'village', x: 1930, y: 1460, width: 600, label: '여관',
    footprint: [body(1930, 1460, 600, 1260)], door: { x: 1858, y: 1500 } },
  // 남쪽 입구: 왼쪽 초소와 오른쪽 행상 수레 사이, 아치 기둥 안쪽만 지나갈 수 있다.
  { frame: 'south-gate', area: 'village', x: 1174, y: 1560, width: 640, label: '',
    footprint: [wall(867, 1370, 1134, 1600), wall(1228, 1440, 1481, 1600)], door: { x: 1181, y: 1440 } },
];

export function buildingsIn(area: VillageArea): Building[] {
  return BUILDINGS.filter((b) => b.area === area);
}

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

/** 광장(village)의 소품 */
export const PROPS: VillageProp[] = [
  // 마을 한가운데 큰 나무
  { frame: 'oak', x: 1180, y: 900, width: 420, footprint: { rx: 46, ry: 28 } },
  // 위쪽: 북쪽 맵으로 가는 길(가운데) 양옆의 숲
  { frame: 'pine', x: 100, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'oak', x: 420, y: 470, width: 320, footprint: { rx: 37, ry: 24 } },
  { frame: 'pine', x: 790, y: 360, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'oak', x: 1540, y: 330, width: 290, footprint: { rx: 34, ry: 22 } },
  { frame: 'pine', x: 1900, y: 420, width: 230, footprint: { rx: 27, ry: 19 } },
  { frame: 'pine', x: 2320, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'boulders', x: 2150, y: 560, width: 160, footprint: { rx: 72, ry: 27 } },
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
  { frame: 'flowers', x: 2220, y: 700, width: 70 },
  { frame: 'flowers', x: 1020, y: 990, width: 65 },
  { frame: 'flowers', x: 1340, y: 840, width: 65 },
  { frame: 'flowers', x: 1300, y: 520, width: 60 },
  { frame: 'flowers', x: 2240, y: 1010, width: 60 },
  { frame: 'sign', x: 1330, y: 1010, width: 90, footprint: { rx: 15, ry: 13 } },
];

/** 북쪽 맵(village-north)의 소품: 집 사이의 나무와 텃밭 꽃 */
export const NORTH_PROPS: VillageProp[] = [
  { frame: 'pine', x: 100, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'pine', x: 790, y: 330, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'oak', x: 1540, y: 330, width: 290, footprint: { rx: 34, ry: 22 } },
  { frame: 'pine', x: 2320, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'oak', x: 1650, y: 1060, width: 360, footprint: { rx: 40, ry: 26 } },
  { frame: 'oak', x: 130, y: 1300, width: 260, footprint: { rx: 32, ry: 21 } },
  { frame: 'pine', x: 2300, y: 1280, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'pine', x: 2150, y: 900, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'shrub', x: 770, y: 640, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1620, y: 640, width: 110, footprint: { rx: 45, ry: 19 } },
  { frame: 'shrub', x: 1000, y: 1300, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1420, y: 1420, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'stump', x: 1950, y: 1350, width: 80, footprint: { rx: 32, ry: 18 } },
  { frame: 'rock', x: 380, y: 1450, width: 80, footprint: { rx: 35, ry: 18 } },
  { frame: 'flowers', x: 690, y: 560, width: 70 },
  { frame: 'flowers', x: 200, y: 590, width: 65 },
  { frame: 'flowers', x: 2220, y: 560, width: 70 },
  { frame: 'flowers', x: 1250, y: 560, width: 60 },
  // 리네아의 집 앞 꽃밭
  { frame: 'flowers', x: 470, y: 1170, width: 70 },
  { frame: 'flowers', x: 930, y: 1150, width: 65 },
  { frame: 'flowers', x: 560, y: 1230, width: 60 },
  { frame: 'flowers', x: 860, y: 1240, width: 65 },
  { frame: 'flowers', x: 1700, y: 1250, width: 60 },
];

/** 소품의 바닥 접점(줄기·바위 밑동)만 장애물로 만든다. 다른 맵도 같은 규칙을 쓴다. */
export function propObstacles(props: readonly VillageProp[]): Obstacle[] {
  return props.flatMap((p) => p.footprint ? [{ x: p.x, y: p.y - p.footprint.ry * .45, ...p.footprint }] : []);
}

export function buildingObstacles(buildings: readonly Building[]): Obstacle[] {
  return buildings.flatMap((b) => b.footprint);
}

// 마을은 평화로운 곳이라 몬스터가 나오지 않는다. 몬스터는 마을 밖 사냥터(maps.ts)에 있다.
export function areaObstacles(area: VillageArea): Obstacle[] {
  return [...buildingObstacles(buildingsIn(area)), ...propObstacles(area === 'village' ? PROPS : NORTH_PROPS)];
}
