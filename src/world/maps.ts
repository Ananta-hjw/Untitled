import { EAST_PASS } from './eastPass.ts';
import { FERRY_VILLAGE } from './ferryVillage.ts';
import { mapLength, mapPoint, mapRect, mapProp } from './mapScale.ts';
import { VILLAGE_GATES, perimeterObstacles } from './villagePerimeter.ts';
import type { EnemyKey } from '../combat/monsterTypes.ts';
import { FIELD_BOUNDS, FIELD_PROPS, FIELD_POLYGON, insidePolygon } from './southFieldLayout.ts';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config.ts';
import type { DialogueId } from '../story/dialogues.ts';
import { INTERACTABLES, type Interactable } from './interactables.ts';
import { insideObstacle, type Obstacle } from './obstacles.ts';
import { NPCS, type NpcDef } from './npcs.ts';
import {
  INTERIORS, arrivalOf, doorOf, furnitureObstacles, interiorRestrictedObstacles, interiorFor, interiorWalkPolygon, roomRect, type Interior, type InteriorId,
} from './interiors.ts';
import {
  BUILDINGS, NORTH_PROPS, PLAYER_SPAWN, PROPS as VILLAGE_PROPS, SOUTH_GATE_PASSAGE, VILLAGE_LINK, WALK_BOUNDS as VILLAGE_BOUNDS,
  buildingObstacles, buildingsIn, propObstacles, type Building, type VillageArea, type VillageProp,
} from './villageLayout.ts';

/**
 * 맵 목록과 맵 사이의 출구.
 *
 * 로웬 마을을 가운데 두고 남쪽 들판, 서쪽 숲길, 동쪽 개울가가 이어진다(docs/story-chapter1.md).
 * 마을은 집들이 있는 북쪽(village-north, 시작 지점)과 광장(village) 두 맵이고, 가운데 길로 오간다.
 * 플레이어의 발이 출구 영역에 들어가면 연결된 맵의 도착 지점으로 옮겨 간다.
 * 마을은 평화로운 곳이라 몬스터가 없고, 몬스터는 사냥터에만 나온다.
 * 마을 건물은 문 앞에서 "들어가기"로 실내(in-…)에 들어가고, 실내 아래쪽 문으로 나와 그 건물 문 앞에 선다.
 * 이 파일은 Phaser를 쓰지 않아 tools/maps.test.mjs가 직접 불러 검사한다.
 */

export type MapId = 'village' | 'village-north' | 'south-field' | 'west-forest' | 'east-stream' | 'east-pass' | 'reed-swamp' | 'ferry-village' | `in-${InteriorId}`;

export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Point { x: number; y: number }

export interface MapExit {
  to: MapId;
  /** 이 영역에 발이 들어가면 이동한다. 걸을 수 있는 영역의 가장자리에 걸쳐 둔다. */
  zone: Rect;
  /** 도착하는 맵에서 서는 자리. 그 맵의 출구 영역 밖이어야 바로 되돌아가지 않는다. */
  arrive: Point;
  /** 출구 표시 글자와 위치 */
  label: string;
  labelAt: Point;
}

export interface MapEnemySpawn { key: Exclude<EnemyKey, 'retainer-ash'>; x: number; y: number }

export interface GameMap {
  id: MapId;
  name: string;
  /** 맵에 들어설 때 화면 아래에 잠깐 띄우는 안내 */
  hint: string;
  bounds: Rect;
  /** Full painted world extent, independent of walkable bounds. */
  artBounds?: Rect;
  walkPolygon?: number[];
  obstacles?: Obstacle[];
  props: VillageProp[];
  /** 건물 (마을만) */
  buildings: Building[];
  /** 마을 사람 (마을만) */
  npcs: NpcDef[];
  /** 지면 색조. 같은 땅 그림을 맵마다 다른 분위기로 쓴다. */
  groundTint?: number;
  /** 화면 위쪽에 그리는 개울. 걸을 수 있는 영역 밖에 있다. */
  water?: { top: number; bottom: number };
  /** 처음 이 맵에서 시작하거나 쓰러졌다 일어날 때 서는 자리 */
  spawn: Point;
  enemies: MapEnemySpawn[];
  exits: MapExit[];
  interactables: Interactable[];
  /** 건물 실내 (실내 맵만). 원화의 바닥·가구 좌표와 일치한다. */
  interior?: Interior;
}

const FULL_BOUNDS: Rect = { ...VILLAGE_BOUNDS };

function sign(id: string, x: number, y: number, dialogue: DialogueId): { prop: VillageProp; spot: Interactable } {
  return {
    prop: { frame: 'sign', x, y, width: 90, footprint: { rx: 15, ry: 13 } },
    spot: { id, x, y, radius: 105, markerHeight: 150, dialogue },
  };
}

const southSign = sign('south-field-sign', 2030.6, 471.9, 'south-field-sign');
const forestSign = sign('west-forest-sign', mapLength(2180), mapLength(900), 'west-forest-sign');
const streamSign = sign('east-stream-sign', mapLength(260), mapLength(760), 'east-stream-sign');

const outdoorNpcs = (area: VillageArea) => NPCS.filter((n) => !n.inside && (n.area ?? 'village') === area);
const LINK_X = (VILLAGE_LINK.left + VILLAGE_LINK.right) / 2;

const VILLAGE_NORTH: GameMap = {
  id: 'village-north',
  name: '로웬 마을 북쪽',
  hint: '로웬 마을 북쪽 · 조이스틱 또는 WASD로 둘러보세요',
  bounds: FULL_BOUNDS,
  props: NORTH_PROPS,
  buildings: buildingsIn('village-north'),
  npcs: outdoorNpcs('village-north'),
  spawn: PLAYER_SPAWN,
  enemies: [],
  exits: [
    { to: 'village', zone: { left: VILLAGE_LINK.left, top: mapLength(1500), right: VILLAGE_LINK.right, bottom: WORLD_HEIGHT },
      arrive: { x: LINK_X, y: mapLength(330) }, label: '▼ 로웬 마을 광장', labelAt: { x: LINK_X, y: mapLength(1478) } },
  ],
  interactables: doorSpots('village-north'),
};

const VILLAGE: GameMap = {
  id: 'village',
  name: '로웬 마을',
  hint: '로웬 마을 광장 · 북쪽 길로 집들이 있는 곳에 갈 수 있어요',
  bounds: FULL_BOUNDS,
  props: VILLAGE_PROPS,
  buildings: buildingsIn('village'),
  npcs: outdoorNpcs('village'),
  spawn: { x: LINK_X, y: mapLength(380) },
  enemies: [],
  exits: [
    { to: 'village-north', zone: { left: VILLAGE_LINK.left, top: 0, right: VILLAGE_LINK.right, bottom: mapLength(270) },
      arrive: { x: LINK_X, y: mapLength(1440) }, label: '▲ 마을 북쪽 (집)', labelAt: { x: LINK_X, y: mapLength(300) } },
    // 남쪽 입구 아치의 두 기둥 사이로 나간다.
    { to: 'south-field', zone: { left: SOUTH_GATE_PASSAGE.left, top: VILLAGE_GATES.south.y, right: SOUTH_GATE_PASSAGE.right, bottom: WORLD_HEIGHT },
      arrive: { x: 1687.4, y: 600.6 }, label: '▼ 남쪽 들판', labelAt: { x: mapLength(1181), y: VILLAGE_GATES.south.y - mapLength(22) } },
    { to: 'west-forest', zone: mapRect({ left: 0, top: 940, right: 112, bottom: 1160 }),
      arrive: mapPoint({ x: 2150, y: 1050 }), label: '◀ 서쪽 숲길', labelAt: mapPoint({ x: 150, y: 1000 }) },
    { to: 'east-stream', zone: { left: VILLAGE_GATES.east.x, top: VILLAGE_GATES.east.top, right: WORLD_WIDTH, bottom: VILLAGE_GATES.east.bottom },
      arrive: mapPoint({ x: 240, y: 910 }), label: '동쪽 개울가 ▶', labelAt: { x: VILLAGE_GATES.east.x - mapLength(45), y: mapLength(1010) } },
  ],
  // 표지판과, 실내가 있는 건물마다 문 앞의 "들어가기"
  interactables: [...INTERACTABLES, ...doorSpots('village')],
};

const SOUTH_FIELD: GameMap = {
  id: 'south-field',
  name: '남쪽 들판',
  hint: '남쪽 들판 · 슬라임과 물방울 버섯이 나타납니다',
  bounds: FIELD_BOUNDS,
  walkPolygon: FIELD_POLYGON,
  props: [...FIELD_PROPS, southSign.prop],
  buildings: [],
  npcs: [],
  spawn: { x: 1687.4, y: 600.6 },
  enemies: [
    ...[[2574, 1430], [858, 1644.5], [572, 1001], [1287, 1430], [2431, 1287]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'slime-green', x, y })),
    ...[[2288, 1716], [1430, 2044.9], [715, 2002], [2002, 1544.4], [2574, 1001]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'waterdrop-mushroom', x, y })),
  ],
  exits: [
    { to: 'village', zone: { left: 1487.2, top: 0, right: 1887.6, bottom: 414.7 },
      // 남문 아치(종·들보) 그림 뒤에 가려지지 않도록 아치 안쪽 광장에 선다.
      arrive: { x: mapLength(1180), y: VILLAGE_GATES.south.y - mapLength(280) }, label: '▲ 로웬 마을', labelAt: { x: 1687.4, y: 374.66 } },
  ],
  interactables: [southSign.spot],
};

const WEST_FOREST: GameMap = {
  id: 'west-forest',
  name: '서쪽 숲길',
  hint: '서쪽 숲길 · 버섯의 물방울과 도마뱀의 돌진을 조심하세요',
  bounds: FULL_BOUNDS,
  props: [
    ...([
      ['oak', 200, 320], ['pine', 500, 280], ['oak', 820, 330], ['pine', 1150, 300], ['oak', 1480, 320],
      ['pine', 1800, 290], ['oak', 2120, 330], ['pine', 350, 620], ['oak', 1000, 560], ['pine', 1650, 600],
      ['oak', 2250, 620], ['oak', 150, 950], ['pine', 700, 880], ['oak', 1300, 850], ['pine', 1900, 820],
      ['oak', 450, 1250], ['pine', 1100, 1150], ['oak', 1700, 1250], ['pine', 250, 1540], ['oak', 900, 1520],
      ['pine', 1500, 1560], ['oak', 2000, 1500], ['pine', 2300, 1350],
    ] as const).map(([frame, x, y]): VillageProp => frame === 'oak'
      ? { frame, x, y, width: 320, footprint: { rx: 37, ry: 24 } }
      : { frame, x, y, width: 250, footprint: { rx: 29, ry: 20 } }),
    { frame: 'boulders', x: 1250, y: 1020, width: 175, footprint: { rx: 78, ry: 29 } },
    { frame: 'shrub', x: 600, y: 420, width: 110, footprint: { rx: 45, ry: 20 } },
    { frame: 'shrub', x: 1950, y: 1100, width: 115, footprint: { rx: 47, ry: 20 } },
    { frame: 'stump', x: 820, y: 1000, width: 95, footprint: { rx: 38, ry: 21 } },
    { frame: 'flowers', x: 1560, y: 980, width: 65 },
    { frame: 'flowers', x: 380, y: 860, width: 60 },
  ].map(p => mapProp(p as VillageProp)).concat(forestSign.prop),
  buildings: [],
  npcs: [],
  groundTint: 0xb9cfa4,
  spawn: mapPoint({ x: 2150, y: 1050 }),
  enemies: [
    ...[[900, 700], [1300, 1350], [400, 900], [1500, 1050], [1800, 450]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'waterdrop-mushroom', ...mapPoint({ x, y }) })),
    ...[[600, 1150], [1500, 700], [600, 450], [1200, 600], [1600, 1400]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'iron-scale-lizard', ...mapPoint({ x, y }) })),
  ],
  exits: [
    { to: 'village', zone: { left: mapLength(2290), top: mapLength(940), right: WORLD_WIDTH, bottom: mapLength(1160) },
      // 서문 기둥과 문지기 둘 사이가 아니라, 문 안쪽으로 조금 들어온 곳에 선다.
      arrive: mapPoint({ x: 400, y: 1050 }), label: '로웬 마을 ▶', labelAt: mapPoint({ x: 2240, y: 1000 }) },
  ],
  interactables: [forestSign.spot],
};

const EAST_STREAM: GameMap = {
  id: 'east-stream',
  name: '동쪽 개울가',
  hint: '동쪽 개울가 · 물가에 가까이 가지 마세요',
  bounds: { ...FULL_BOUNDS, top: mapLength(430) },
  props: [
    { frame: 'boulders', x: 520, y: 470, width: 170, footprint: { rx: 76, ry: 28 } },
    { frame: 'boulders', x: 1420, y: 480, width: 160, footprint: { rx: 72, ry: 27 } },
    { frame: 'boulders', x: 2100, y: 465, width: 175, footprint: { rx: 78, ry: 29 } },
    { frame: 'oak', x: 200, y: 1450, width: 330, footprint: { rx: 38, ry: 24 } },
    { frame: 'pine', x: 700, y: 1550, width: 250, footprint: { rx: 28, ry: 20 } },
    { frame: 'oak', x: 1300, y: 1560, width: 320, footprint: { rx: 37, ry: 24 } },
    { frame: 'pine', x: 1900, y: 1500, width: 260, footprint: { rx: 30, ry: 20 } },
    { frame: 'oak', x: 2280, y: 1250, width: 330, footprint: { rx: 38, ry: 24 } },
    { frame: 'rock', x: 900, y: 800, width: 110, footprint: { rx: 49, ry: 24 } },
    { frame: 'rock', x: 1600, y: 1000, width: 100, footprint: { rx: 44, ry: 22 } },
    { frame: 'shrub', x: 2250, y: 760, width: 110, footprint: { rx: 45, ry: 20 } },
    { frame: 'flowers', x: 1100, y: 1200, width: 70 },
    { frame: 'flowers', x: 1800, y: 700, width: 65 },
    { frame: 'flowers', x: 600, y: 1100, width: 70 },
  ].map(p => mapProp(p as VillageProp)).concat(streamSign.prop),
  buildings: [],
  npcs: [],
  groundTint: 0xd6e8da,
  water: { top: mapLength(230), bottom: mapLength(415) },
  spawn: mapPoint({ x: 240, y: 910 }),
  enemies: [
    { key: 'slime-blue', ...mapPoint({ x: 1200, y: 750 }) },
    { key: 'slime-green', ...mapPoint({ x: 1700, y: 1150 }) },
    { key: 'slime-blue', ...mapPoint({ x: 2000, y: 650 }) },
    { key: 'slime-green', ...mapPoint({ x: 900, y: 1100 }) },
    { key: 'slime-green', ...mapPoint({ x: 1450, y: 1350 }) },
  ],
  exits: [
    { to: 'village', zone: mapRect({ left: 0, top: 820, right: 110, bottom: 1000 }),
      // 동문 기둥과 문지기 둘 사이가 아니라, 문 안쪽으로 조금 들어온 곳에 선다.
      arrive: { x: VILLAGE_GATES.east.x - mapLength(290), y: mapLength(1050) }, label: '◀ 로웬 마을', labelAt: mapPoint({ x: 160, y: 1010 }) },
    { to: 'east-pass', zone: { left: 3220, top: 1280, right: WORLD_WIDTH, bottom: 1550 },
      arrive: { x: 350, y: 2150 }, label: '동쪽 고갯길 ▶', labelAt: { x: 3100, y: 1570 } },
  ],
  interactables: [streamSign.spot],
};

const REED_SWAMP: GameMap = {
  id: 'reed-swamp',
  name: '갈대밭 늪',
  hint: '갈대밭 늪 · 잠복 마물이 몸을 낮추면 물줄기를 피하세요',
  artBounds: { left: 0, top: 0, right: 2100, bottom: 1400 },
  bounds: { left: 65, top: 460, right: 2035, bottom: 1340 },
  props: [
    { frame: 'boulders', x: 725, y: 795, width: 166, footprint: { rx: 69, ry: 31 } },
    { frame: 'rock', x: 1580, y: 968, width: 130, footprint: { rx: 53, ry: 24 } },
    { frame: 'stump', x: 1670, y: 607, width: 105, footprint: { rx: 38, ry: 20 } },
    { frame: 'shrub', x: 485, y: 532, width: 100, footprint: { rx: 39, ry: 19 } },
    { frame: 'shrub', x: 1900, y: 1210, width: 130, footprint: { rx: 44, ry: 23 } },
  ],
  buildings: [],
  npcs: [],
  spawn: { x: 240, y: 920 },
  enemies: [
    { key: 'swamp-lurker', x: 1240, y: 825 },
    { key: 'reed-stalker', x: 935, y: 554 },
    { key: 'reed-stalker', x: 1750, y: 1100 },
  ],
  exits: [
    { to: 'east-pass', zone: { left: 0, top: 805, right: 155, bottom: 1040 }, arrive: { x: 4510, y: 1440 },
      label: '◀ 동쪽 고갯길', labelAt: { x: 185, y: 1040 } },
  ],
  interactables: [],
};

/** 건물 문 앞의 "들어가기". 실내에서 나오면 이 자리 조금 앞에 선다. */
function doorSpots(area: VillageArea): Interactable[] {
  return buildingsIn(area).flatMap((b) => {
    const interior = interiorFor(b.frame);
    if (!interior) return [];
    return [{
      id: `door-${interior.id}`, x: b.door.x, y: b.door.y, radius: 70, markerHeight: 150,
      // 벽 앞(door.y - 44.2)에 바짝 붙거나 문 좌우로 조금 비켜 서도 편하게 들어가고, 나올 자리(door.y + 80)·시작점(door.y + 78)은 피한다.
      reach: { rx: 105, up: 72, down: 54 },
      enter: { to: `in-${interior.id}` as MapId, at: arrivalOf(interior), label: interior.name },
    }];
  });
}

function interiorMap(interior: Interior): GameMap {
  const building = BUILDINGS.find((b) => b.frame === interior.building)!;
  const door = doorOf(interior);
  return {
    id: `in-${interior.id}`,
    name: interior.name,
    hint: `${interior.name} · 문 앞에서 나가기를 누르면 밖으로 나가요`,
    bounds: roomRect(interior),
    walkPolygon: interiorWalkPolygon(interior),
    props: [],
    buildings: [],
    npcs: NPCS.filter((n) => n.inside === interior.id),
    spawn: arrivalOf(interior),
    enemies: [],
    // 문 근처를 지나가기만 해도 나가지 않도록, 들어올 때처럼 문 앞에서 "나가기" 버튼으로 나간다.
    exits: [],
    interactables: [{
      id: `exit-${interior.id}`, x: door.x, y: door.y - 15, radius: 90, markerHeight: 108,
      // 문 깔개·아치 좌우 끝과 아래쪽 벽 끝까지 끊기지 않게 감싸고, 입장 자리(door.y - 120)와는 충분한 여유를 둔다.
      reach: { rx: 135, up: 72, down: 60 },
      // 건물 문 앞(들어가기 지점, 반지름 70)보다 조금 앞에 선다. 나오자마자 "들어가기"가 떠 다시 들어가지 않게.
      enter: { to: building.area, at: { x: building.door.x, y: building.door.y + 80 }, label: '나가기' },
    }],
    interior,
  };
}

export const MAPS = {
  village: VILLAGE,
  'village-north': VILLAGE_NORTH,
  'south-field': SOUTH_FIELD,
  'west-forest': WEST_FOREST,
  'east-stream': EAST_STREAM,
  'east-pass': EAST_PASS,
  'reed-swamp': REED_SWAMP,
  'ferry-village': FERRY_VILLAGE,
  ...Object.fromEntries(INTERIORS.map((i) => [`in-${i.id}`, interiorMap(i)])),
} as Record<MapId, GameMap>;

/** 새 게임은 시온의 집 앞(마을 북쪽)에서 시작한다. */
export const START_MAP: MapId = 'village-north';

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && Object.hasOwn(MAPS, value);
}

/** 맵의 장애물: 건물의 벽(마을만), 소품의 바닥 접점, 실내 가구 */
export function mapObstacles(map: GameMap): Obstacle[] {
  return [
    ...buildingObstacles(map.buildings), ...propObstacles(map.props), ...perimeterObstacles(map.id), ...(map.obstacles ?? []),
    ...(map.interior ? [...furnitureObstacles(map.interior), ...interiorRestrictedObstacles(map.interior)] : []),
  ];
}

/** 걸을 수 있는 영역의 꼭짓점 (WalkArea용) */
export function mapPolygon(map: GameMap): number[] {
  if (map.walkPolygon) return map.walkPolygon;
  const b = map.bounds;
  return [b.left, b.top, b.right, b.top, b.right, b.bottom, b.left, b.bottom];
}

export function insideRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** (x, y)가 출구 영역 안이면 그 출구. 없으면 undefined. */
export function findExit(map: GameMap, x: number, y: number): MapExit | undefined {
  return map.exits.find((exit) => insideRect(exit.zone, x, y));
}

/** Phaser 없이 걸을 수 있는지 판단한다 (테스트용, WalkArea와 같은 규칙). */
export function walkable(map: GameMap, x: number, y: number, obstacles: readonly Obstacle[] = mapObstacles(map)): boolean {
  return insideRect(map.bounds, x, y) && (!map.walkPolygon || insidePolygon(map.walkPolygon, x, y)) && !obstacles.some((o) => insideObstacle(o, x, y));
}

/** The camera, painted ground and maps share this extent. */
export function outdoorArtBounds(map: GameMap): Rect {
  return map.artBounds ?? { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT };
}
