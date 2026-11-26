import type { FerryInteriorPropId } from './ferryInteriors.ts';
import { mapLength, mapPoint, mapObstacle, mapProp } from './mapScale.ts';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config.ts';
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

export const PLAYER_SPAWN = mapPoint({ x: 430, y: 640 });
// Reserve room for the full walking sprite and its name plate at camera boundaries.
export const WALK_BOUNDS = { left: mapLength(64), top: mapLength(224), right: WORLD_WIDTH - mapLength(64), bottom: WORLD_HEIGHT - mapLength(40) };

/** 마을의 두 맵 (maps.ts의 MapId와 같은 이름) */
export type VillageArea = 'village' | 'village-north';

/** 두 맵을 잇는 가운데 길 (북쪽 맵의 아래 끝, 광장의 위 끝) */
export const VILLAGE_LINK = { left: mapLength(1100), right: mapLength(1260) };

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
const BASE_BUILDINGS: Building[] = [
  { frame: 'family-house', area: 'village-north', x: 430, y: 540, width: 500, label: '시온의 집',
    footprint: [body(430, 540, 500, 224)], door: { x: 415, y: 580 } },
  { frame: 'chief-house', area: 'village-north', x: 1180, y: 470, width: 380, label: '촌장의 집',
    footprint: [body(1180, 470, 380, 224)], door: { x: 1180, y: 510 } },
  { frame: 'clinic', area: 'village-north', x: 1950, y: 500, width: 540, label: '치유소',
    footprint: [body(1950, 500, 540, 224)], door: { x: 1930, y: 540 } },
  // 시온의 집과 같은 폭. 큰 가로길 위쪽 풀밭에 두어 집과 충돌 영역 모두 길에서 벗어난다.
  { frame: 'linea-house', area: 'village-north', x: 430, y: 890, width: 500, label: '리네아의 집',
    footprint: [body(430, 890, 500, 740)], door: { x: 404, y: 930 } },
  // 서문·동문 앞은 넓게 비우고 건물은 광장 안쪽의 앞마당으로 물린다.
  { frame: 'training-hall', area: 'village', x: 650, y: 780, width: 520, label: '수련소',
    footprint: [body(650, 780, 520, 610)], door: { x: 650, y: 820 } },
  { frame: 'general-store', area: 'village', x: 1840, y: 760, width: 420, label: '잡화점',
    footprint: [body(1840, 760, 420, 560)], door: { x: 1840, y: 800 } },
  // 남쪽 건물은 지붕까지 동서 통행 길 아래에 두고, 담 앞에 출입 공간을 남긴다.
  { frame: 'smithy', area: 'village', x: 530, y: 1530, width: 520, label: '대장간',
    footprint: [body(530, 1530, 520, 1340)], door: { x: 462, y: 1570 } },
  { frame: 'inn', area: 'village', x: 1900, y: 1550, width: 600, label: '여관',
    footprint: [body(1900, 1550, 600, 1350)], door: { x: 1828, y: 1590 } },
  // 남쪽 입구: 왼쪽 초소와 오른쪽 행상 수레 사이, 아치 기둥 안쪽만 지나갈 수 있다.
  { frame: 'south-gate', area: 'village', x: 1174, y: 1660, width: 640, label: '',
    footprint: [wall(867, 1470, 1134, 1700), wall(1228, 1540, 1481, 1700)], door: { x: 1181, y: 1540 } },
];

export const BUILDINGS: Building[] = BASE_BUILDINGS.map(b => ({
  ...mapPoint(b), width: mapLength(b.width), footprint: b.footprint.map(mapObstacle), door: mapPoint(b.door),
}));

export function buildingsIn(area: VillageArea): Building[] {
  return BUILDINGS.filter((b) => b.area === area);
}

/** 남쪽 입구 아치의 통로 (두 기둥 사이) */
export const SOUTH_GATE_PASSAGE = { left: mapLength(1134), right: mapLength(1228) };

export const HOME = BUILDINGS[0];
export const LINEA_HOME = BUILDINGS.find((b) => b.frame === 'linea-house')!;
/** 문 옆의 앞마당. 평상시 대화와 습격 뒤 간호 인물들이 같은 집 앞을 기준으로 선다. */
export const LINEA_YARD = { x: LINEA_HOME.door.x + mapLength(220), y: LINEA_HOME.door.y };

/** 물안개 나루의 건물·소품 그림 (src/assets/maps/ferry-village/objects/, tools/build_ferry_village_assets.py) */
export type FerryObjectId = 'inn' | 'marta-smithy' | 'morgan-warehouse' | 'watchtower' | 'evan-cottage' | 'watermill'
  | 'fisherman-house' | 'herbalist-shop' | 'village-house-a' | 'village-house-b'
  | 'rowboat' | 'ferry-boat' | 'crates' | 'net-rack' | 'reeds' | 'mooring-post' | 'lamp-post' | 'well';

export interface VillageProp {
  frame: 'oak' | 'pine' | 'boulders' | 'shrub' | 'rock' | 'flowers' | 'sign' | 'stump' | 'dead-tree' | 'cliff-straight' | 'cliff-corner' | 'stone-shelter'
    | FerryObjectId | FerryInteriorPropId;
  texture?: string;
  x: number;
  y: number;
  width: number;
  footprint?: { rx: number; ry: number; shape?: 'rect'; offsetY?: number };
  depth?: number;
  id?: string;
  /** 그림 위에 띄우는 이름(건물 그림을 소품으로 놓을 때, 예: 물안개 나루) */
  label?: string;
}

/** 광장(village)의 소품. 수관 전체가 좌우 돌담 안에 들어오도록 둔다. */
const BASE_PROPS: VillageProp[] = [
  // 마을 한가운데 큰 나무
  { frame: 'oak', x: 1180, y: 900, width: 420, footprint: { rx: 46, ry: 28 } },
  // 위쪽: 북쪽 맵으로 가는 길(가운데) 양옆의 숲
  { frame: 'pine', x: 270, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'oak', x: 420, y: 470, width: 320, footprint: { rx: 37, ry: 24 } },
  { frame: 'pine', x: 790, y: 360, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'oak', x: 1540, y: 330, width: 290, footprint: { rx: 34, ry: 22 } },
  { frame: 'pine', x: 1900, y: 420, width: 230, footprint: { rx: 27, ry: 19 } },
  { frame: 'pine', x: 2130, y: 420, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'boulders', x: 2170, y: 470, width: 160, footprint: { rx: 72, ry: 27 } },
  { frame: 'oak', x: 280, y: 800, width: 230, footprint: { rx: 30, ry: 20 } },
  { frame: 'pine', x: 2130, y: 650, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'shrub', x: 980, y: 690, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1530, y: 580, width: 110, footprint: { rx: 45, ry: 19 } },
  { frame: 'shrub', x: 840, y: 1270, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'shrub', x: 1560, y: 1150, width: 100, footprint: { rx: 41, ry: 18 } },
  { frame: 'rock', x: 1430, y: 1300, width: 80, footprint: { rx: 35, ry: 18 } },
  { frame: 'stump', x: 900, y: 870, width: 80, footprint: { rx: 32, ry: 18 } },
  { frame: 'flowers', x: 400, y: 840, width: 70 },
  { frame: 'flowers', x: 200, y: 590, width: 65 },
  { frame: 'flowers', x: 2220, y: 700, width: 70 },
  { frame: 'flowers', x: 1020, y: 990, width: 65 },
  { frame: 'flowers', x: 1340, y: 840, width: 65 },
  { frame: 'flowers', x: 1300, y: 520, width: 60 },
  { frame: 'flowers', x: 2240, y: 1010, width: 60 },
  { frame: 'sign', x: 1330, y: 1010, width: 90, footprint: { rx: 15, ry: 13 } },
];

/** 북쪽 맵(village-north)의 소품: 집 사이의 나무와 텃밭 꽃 */
const BASE_NORTH_PROPS: VillageProp[] = [
  { frame: 'pine', x: 820, y: 720, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'pine', x: 790, y: 330, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'oak', x: 1540, y: 330, width: 290, footprint: { rx: 34, ry: 22 } },
  { frame: 'pine', x: 1550, y: 760, width: 210, footprint: { rx: 25, ry: 18 } },
  { frame: 'oak', x: 1650, y: 1060, width: 360, footprint: { rx: 40, ry: 26 } },
  { frame: 'oak', x: 310, y: 1470, width: 260, footprint: { rx: 32, ry: 21 } },
  { frame: 'pine', x: 2110, y: 1280, width: 220, footprint: { rx: 26, ry: 18 } },
  { frame: 'pine', x: 2130, y: 900, width: 210, footprint: { rx: 25, ry: 18 } },
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
  { frame: 'flowers', x: 210, y: 920, width: 70 },
  { frame: 'flowers', x: 650, y: 920, width: 65 },
  { frame: 'flowers', x: 250, y: 950, width: 60 },
  { frame: 'flowers', x: 690, y: 950, width: 65 },
  { frame: 'flowers', x: 1700, y: 1250, width: 60 },
];

export const PROPS = BASE_PROPS.map(mapProp);
export const NORTH_PROPS = BASE_NORTH_PROPS.map(mapProp);

/** 소품의 바닥 접점(줄기·바위 밑동)만 장애물로 만든다. 다른 맵도 같은 규칙을 쓴다. */
export function propObstacles(props: readonly VillageProp[]): Obstacle[] {
  return props.flatMap(({ x, y, footprint }) => {
    if (!footprint) return [];
    const { rx, ry, offsetY = -ry * .45, shape } = footprint;
    return [{ x, y: y + offsetY, rx, ry, ...(shape ? { shape } : {}) }];
  });
}

export function buildingObstacles(buildings: readonly Building[]): Obstacle[] {
  return buildings.flatMap((b) => b.footprint);
}

// 마을은 평화로운 곳이라 몬스터가 나오지 않는다. 몬스터는 마을 밖 사냥터(maps.ts)에 있다.
export function areaObstacles(area: VillageArea): Obstacle[] {
  return [...buildingObstacles(buildingsIn(area)), ...propObstacles(area === 'village' ? PROPS : NORTH_PROPS)];
}
