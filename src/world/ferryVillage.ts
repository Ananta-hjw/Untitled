import type { GameMap } from './maps.ts';
import type { Obstacle } from './obstacles.ts';
import type { FerryObjectId, VillageProp } from './villageLayout.ts';

const WIDTH = 4800;
const HEIGHT = 3200;
export const FERRY_ENTRY = { x: 593.75, y: 1609.375 };
/** 갈대밭 늪에서 돌아오면 서는 자리: 남서쪽 늪지 길 위, 출구보다 조금 안쪽 */
export const FERRY_FROM_SWAMP = { x: 740, y: 2860 };
/** 나루에서 갈대밭 늪으로 들어서는 자리 (늪의 서쪽 끝) */
const SWAMP_ENTRY = { x: 240, y: 920 };

/** 그림의 세로/가로 비율 (src/assets/maps/ferry-village/objects.json, tools/build_ferry_village_assets.py) */
const ASPECT: Record<FerryObjectId, number> = {
  inn: 0.707, 'marta-smithy': 0.642, 'morgan-warehouse': 0.508, watchtower: 2.32, 'evan-cottage': 0.631,
  watermill: 0.717, 'fisherman-house': 0.75, 'herbalist-shop': 0.873, 'village-house-a': 0.827, 'village-house-b': 0.782,
  rowboat: 1.044, 'ferry-boat': 0.819, crates: 0.766, 'net-rack': 0.809, reeds: 1.255, 'mooring-post': 1.948,
  'lamp-post': 1.798, well: 1.103,
};

export const ferryTexture = (id: FerryObjectId): string => `ferry-${id}`;

interface FerryBuilding {
  id: FerryObjectId;
  label: string;
  /** 그림 아래 가운데(땅에 닿는 곳) */
  x: number; y: number;
  /** 화면 너비 */
  width: number;
  /** 벽 충돌: 그림 너비에 대한 비율, 그림 높이에 대한 깊이 비율 */
  wall?: { width: number; depth: number };
}

/**
 * 건물은 바닥 그림의 빈 집터 위에 앉힌다(집터는 바닥 원화에서 잰 자리).
 * 벽은 그림 아래 끝보다 조금 앞(FRONT)까지 막아, 앞과 옆에서 다가가는 사람은 늘 건물 앞에 그려진다.
 * 뒤쪽은 지붕에 가려지는 것을 그대로 둔다(로웬과 같은 규칙).
 */
export const FERRY_BUILDINGS: FerryBuilding[] = [
  { id: 'village-house-a', label: '', x: 800, y: 790, width: 460 },
  { id: 'village-house-b', label: '', x: 1735, y: 920, width: 470 },
  // 망루는 고갯길 쪽 위 잔교 북쪽 강둑에서 섬을 바라본다. 네 기둥만 막는다.
  { id: 'watchtower', label: '망루', x: 2925, y: 900, width: 200, wall: { width: 0.8, depth: 0.12 } },
  { id: 'inn', label: '여관', x: 2170, y: 1240, width: 560 },
  { id: 'marta-smithy', label: '마르타의 대장간', x: 1250, y: 1390, width: 540 },
  { id: 'morgan-warehouse', label: '모르간의 창고', x: 2840, y: 1460, width: 540 },
  // 물레방아는 동쪽(강) 쪽에 달려 있어 바퀴 쪽은 강둑을 넘어 물 위에 그려진다.
  { id: 'watermill', label: '방앗간', x: 2950, y: 1870, width: 580 },
  { id: 'herbalist-shop', label: '약초 가게', x: 1290, y: 2025, width: 420 },
  { id: 'fisherman-house', label: '어부의 집', x: 2000, y: 2325, width: 470 },
  // 아래 잔교 곁. 오른쪽의 뒤집힌 배와 받침대까지 그림에 들어 있다.
  { id: 'evan-cottage', label: '사공 에반의 집', x: 2765, y: 2530, width: 560 },
];

const FRONT = 6;
function buildingWall(b: FerryBuilding): Obstacle {
  const height = b.width * ASPECT[b.id];
  const wall = b.wall ?? { width: 0.9, depth: 0.5 };
  const half = b.width * wall.width / 2, top = b.y - height * wall.depth;
  return { x: b.x, y: (top + b.y + FRONT) / 2, rx: half, ry: (b.y + FRONT - top) / 2, shape: 'rect' };
}

const prop = (id: FerryObjectId, x: number, y: number, width: number, footprint?: { rx: number; ry: number }, label?: string): VillageProp =>
  ({ frame: id, texture: ferryTexture(id), x, y, width, ...(footprint ? { footprint } : {}), ...(label ? { label } : {}) });

const FERRY_PROPS: VillageProp[] = [
  ...FERRY_BUILDINGS.map(b => prop(b.id, b.x, b.y, b.width, undefined, b.label)),
  // 광장 가운데 돌 우물터(바닥 그림의 둥근 돌 테) 위에 지붕 있는 우물
  prop('well', 1925, 1640, 170, { rx: 62, ry: 30 }),
  prop('lamp-post', 1660, 1470, 70, { rx: 12, ry: 8 }),
  prop('lamp-post', 2200, 1760, 70, { rx: 12, ry: 8 }),
  // 창고 앞 짐, 아래 잔교 어귀의 짐
  prop('crates', 3120, 1530, 130, { rx: 52, ry: 22 }),
  prop('crates', 3010, 2290, 120, { rx: 48, ry: 20 }),
  prop('net-rack', 2300, 2330, 150, { rx: 62, ry: 14 }),
  prop('mooring-post', 3060, 2640, 46, { rx: 14, ry: 9 }),
  prop('mooring-post', 3090, 2780, 46, { rx: 14, ry: 9 }),
  // 묶여 있는 배들: 강 위라 걸을 수 없으니 충돌은 없다.
  prop('rowboat', 3480, 1250, 150),
  prop('rowboat', 3620, 870, 140),
  prop('ferry-boat', 3430, 2340, 220),
  // 남서쪽 늪지의 갈대
  ...[[260, 2480], [560, 2700], [330, 2900], [880, 2950], [700, 2560], [3070, 2950]].map(([x, y]) =>
    prop('reeds', x, y, 110, { rx: 28, ry: 12 })),
];

export const FERRY_VILLAGE: GameMap = {
  id: 'ferry-village',
  name: '물안개 나루',
  hint: '물안개 나루',
  artBounds: { left: 0, top: 0, right: WIDTH, bottom: HEIGHT },
  bounds: { left: 75, top: 112.5, right: 3706.25, bottom: 3100 },
  // 마른 흙과 선착장 갑판 안쪽을 따라 걸을 수 있다.
  walkPolygon: [
    75, 112.5, 3093.75, 112.5, 3018.75, 418.75, 3043.75, 753.125, 3087.5, 984.375,
    3706.25, 984.375, 3706.25, 1106.25, 3096.875, 1106.25,
    3096.875, 1350, 3171.875, 1618.75, 3118.75, 1859.375, 3081.25, 2062.5,
    3706.25, 2062.5, 3706.25, 2178.125, 3084.375, 2178.125,
    3109.375, 2409.375, 3168.75, 2703.125, 3096.875, 3006.25, 3075, 3100, 75, 3100,
  ],
  props: FERRY_PROPS,
  buildings: [],
  obstacles: FERRY_BUILDINGS.map(buildingWall),
  npcs: [],
  spawn: FERRY_ENTRY,
  enemies: [],
  exits: [
    { to: 'east-pass', zone: { left: 75, top: 1528.125, right: 231.25, bottom: 1706.25 }, arrive: { x: 4660, y: 1650 },
      label: '◀ 동쪽 고갯길', labelAt: { x: 343.75, y: 1487.5 } },
    // 남서쪽 늪지 길 끝: 갈대밭 늪 (퀘스트 "멈춘 나루"의 핀의 연, 훗날 종의 추를 찾는 늪)
    { to: 'reed-swamp', zone: { left: 560, top: 2990, right: 900, bottom: 3100 }, arrive: SWAMP_ENTRY,
      label: '갈대밭 늪 ▼', labelAt: { x: 730, y: 2930 } },
  ],
  interactables: [],
};
