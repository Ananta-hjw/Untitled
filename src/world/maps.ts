import type { EnemyKey } from '../combat/monsterTypes.ts';
import { FIELD_BOUNDS, FIELD_OBSTACLES, FIELD_POLYGON, insidePolygon } from './southFieldLayout.ts';
import { MAP_SIZE_SCALE, WORLD_HEIGHT, WORLD_WIDTH } from '../config.ts';
import type { DialogueId } from '../story/dialogues.ts';
import { INTERACTABLES, type Interactable } from './interactables.ts';
import { insideObstacle, type Obstacle } from './obstacles.ts';
import { NPCS, type NpcDef } from './npcs.ts';
import {
  INTERIORS, arrivalOf, doorOf, furnitureObstacles, interiorFor, interiorWalkPolygon, roomRect, type Interior, type InteriorId,
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

export type MapId = 'village' | 'village-north' | 'south-field' | 'west-forest' | 'east-stream' | `in-${InteriorId}`;

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

const fieldPoint = (x: number, y: number): Point => ({ x: Math.round(x * MAP_SIZE_SCALE * 1000) / 1000, y: Math.round(y * MAP_SIZE_SCALE * 1000) / 1000 });
const southSign = sign('south-field-sign', 1420 * MAP_SIZE_SCALE, 330 * MAP_SIZE_SCALE, 'south-field-sign');
const forestSign = sign('west-forest-sign', 2180, 900, 'west-forest-sign');
const streamSign = sign('east-stream-sign', 260, 760, 'east-stream-sign');

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
    { to: 'village', zone: { left: VILLAGE_LINK.left, top: 1500, right: VILLAGE_LINK.right, bottom: WORLD_HEIGHT },
      arrive: { x: LINK_X, y: 330 }, label: '▼ 로웬 마을 광장', labelAt: { x: LINK_X, y: 1478 } },
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
  spawn: { x: LINK_X, y: 380 },
  enemies: [],
  exits: [
    { to: 'village-north', zone: { left: VILLAGE_LINK.left, top: 0, right: VILLAGE_LINK.right, bottom: 270 },
      arrive: { x: LINK_X, y: 1440 }, label: '▲ 마을 북쪽 (집)', labelAt: { x: LINK_X, y: 300 } },
    // 남쪽 입구 아치의 두 기둥 사이로 나간다.
    { to: 'south-field', zone: { left: SOUTH_GATE_PASSAGE.left, top: 1500, right: SOUTH_GATE_PASSAGE.right, bottom: WORLD_HEIGHT },
      arrive: fieldPoint(1180, 420), label: '▼ 남쪽 들판', labelAt: { x: 1181, y: 1478 } },
    { to: 'west-forest', zone: { left: 0, top: 940, right: 112, bottom: 1160 },
      arrive: { x: 2150, y: 1050 }, label: '◀ 서쪽 숲길', labelAt: { x: 150, y: 1000 } },
    { to: 'east-stream', zone: { left: 2290, top: 960, right: WORLD_WIDTH, bottom: 1140 },
      arrive: { x: 240, y: 910 }, label: '동쪽 개울가 ▶', labelAt: { x: 2245, y: 1010 } },
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
  obstacles: FIELD_OBSTACLES,
  props: [southSign.prop],
  buildings: [],
  npcs: [],
  spawn: fieldPoint(1180, 420),
  enemies: [
    ...[[1800, 1000], [600, 1150], [400, 700], [900, 1000], [1700, 900]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'slime-green', ...fieldPoint(x, y) })),
    ...[[1600, 1200], [1000, 1430], [500, 1400], [1400, 1080], [1800, 700]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'waterdrop-mushroom', ...fieldPoint(x, y) })),
  ],
  exits: [
    { to: 'village', zone: { left: 1040 * MAP_SIZE_SCALE, top: 0, right: 1320 * MAP_SIZE_SCALE, bottom: 290 * MAP_SIZE_SCALE },
      arrive: { x: 1180, y: 1420 }, label: '▲ 로웬 마을', labelAt: fieldPoint(1180, 262) },
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
    forestSign.prop,
  ],
  buildings: [],
  npcs: [],
  groundTint: 0xb9cfa4,
  spawn: { x: 2150, y: 1050 },
  enemies: [
    ...[[900, 700], [1300, 1350], [400, 900], [1500, 1050], [1800, 450]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'waterdrop-mushroom', x, y })),
    ...[[600, 1150], [1500, 700], [600, 450], [1200, 600], [1600, 1400]].map(([x, y]): MapEnemySpawn =>
      ({ key: 'iron-scale-lizard', x, y })),
  ],
  exits: [
    { to: 'village', zone: { left: 2290, top: 940, right: WORLD_WIDTH, bottom: 1160 },
      arrive: { x: 230, y: 1050 }, label: '로웬 마을 ▶', labelAt: { x: 2240, y: 1000 } },
  ],
  interactables: [forestSign.spot],
};

const EAST_STREAM: GameMap = {
  id: 'east-stream',
  name: '동쪽 개울가',
  hint: '동쪽 개울가 · 물가에 가까이 가지 마세요',
  bounds: { ...FULL_BOUNDS, top: 430 },
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
    streamSign.prop,
  ],
  buildings: [],
  npcs: [],
  groundTint: 0xd6e8da,
  water: { top: 230, bottom: 415 },
  spawn: { x: 240, y: 910 },
  enemies: [
    { key: 'slime-blue', x: 1200, y: 750 },
    { key: 'slime-green', x: 1700, y: 1150 },
    { key: 'slime-blue', x: 2000, y: 650 },
    { key: 'slime-green', x: 900, y: 1100 },
    { key: 'slime-green', x: 1450, y: 1350 },
  ],
  exits: [
    { to: 'village', zone: { left: 0, top: 820, right: 110, bottom: 1000 },
      arrive: { x: 2180, y: 1050 }, label: '◀ 로웬 마을', labelAt: { x: 160, y: 1010 } },
  ],
  interactables: [streamSign.spot],
};

/** 건물 문 앞의 "들어가기". 실내에서 나오면 이 자리 조금 앞에 선다. */
function doorSpots(area: VillageArea): Interactable[] {
  return buildingsIn(area).flatMap((b) => {
    const interior = interiorFor(b.frame);
    if (!interior) return [];
    return [{
      id: `door-${interior.id}`, x: b.door.x, y: b.door.y, radius: 70, markerHeight: 150,
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
      id: `exit-${interior.id}`, x: door.x, y: door.y - 15, radius: 90, markerHeight: 150,
      enter: { to: building.area, at: { x: building.door.x, y: building.door.y + 18 }, label: '나가기' },
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
    ...buildingObstacles(map.buildings), ...propObstacles(map.props), ...(map.obstacles ?? []),
    ...(map.interior ? furnitureObstacles(map.interior) : []),
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
