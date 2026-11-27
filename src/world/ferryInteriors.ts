import { FERRY_BUILDINGS, ferryTexture } from './ferryVillage.ts';
import type { Interactable } from './interactables.ts';
import type { GameMap } from './maps.ts';
import type { FerryObjectId, VillageProp } from './villageLayout.ts';

type FerryRoomKey = Extract<FerryObjectId, 'inn' | 'marta-smithy' | 'morgan-warehouse' | 'watermill' |
  'herbalist-shop' | 'fisherman-house' | 'evan-cottage' | 'village-house-a' | 'village-house-b'>;
export type FerryRoomId = `in-ferry-${FerryRoomKey}`;
export type FerryInteriorPropId = 'bed' | 'table' | 'bench' | 'chair' | 'cupboard' | 'chest' | 'hearth' | 'rug' |
  'inn-counter' | 'bottle-shelf' | 'forge' | 'anvil' | 'bell-mould' | 'smith-workbench' | 'mill-wheel' | 'mill-workbench' | 'herb-shelf' | 'herb-counter' |
  'flour-sacks' | 'barrel' | 'net-basket' | 'oar-rack' | 'net-table' | 'herb-box' | 'cloth-rolls';

type RoomProp = FerryInteriorPropId | 'crates';
/** 바닥에 닿는 그림 가운데, 표시 너비, 단단한 접점의 가로·세로 반경. */
type Placement = [frame: RoomProp, x: number, y: number, width: number, rx?: number, ry?: number];

interface Room {
  name: string;
  /** 바깥 건물 그림의 왼쪽을 0, 오른쪽을 1로 잰 문 가운데. */
  doorFraction: number;
  /** 바닥 네 모서리와 문턱 중심을 실내 원화의 픽셀 좌표로 기록한다. */
  floor: [leftBack: number, rightBack: number, backY: number, leftFront: number, rightFront: number, frontY: number];
  doorX: number;
  furniture: Placement[];
}

const ROOMS: Record<FerryRoomKey, Room> = {
  inn: {
    name: '나루 여관', doorFraction: .48, floor: [120, 1410, 385, 90, 1440, 838], doorX: 773,
    furniture: [
      ['bottle-shelf', 285, 426, 210, 92, 24], ['inn-counter', 302, 541, 301, 138, 30],
      ['hearth', 1240, 463, 200, 89, 36], ['table', 998, 553, 177, 75, 31],
      ['chair', 1111, 565, 60, 24, 19], ['bench', 983, 620, 124, 55, 16],
      ['table', 391, 723, 154, 63, 28], ['chair', 282, 729, 62, 25, 18],
      ['chair', 501, 736, 62, 25, 18], ['rug', 747, 674, 238], ['barrel', 1330, 696, 93, 34, 22],
    ],
  },
  'marta-smithy': {
    name: '마르타의 대장간', doorFraction: .34, floor: [126, 1406, 425, 97, 1439, 838], doorX: 755,
    furniture: [
      ['forge', 331, 508, 308, 133, 42], ['anvil', 593, 576, 125, 48, 25],
      ['barrel', 199, 686, 93, 34, 22], ['smith-workbench', 1220, 488, 235, 104, 34],
      ['bell-mould', 859, 518, 155, 65, 35],
      ['chest', 1243, 729, 140, 59, 25], ['bench', 1040, 676, 129, 54, 17],
    ],
  },
  'morgan-warehouse': {
    name: '모르간의 창고', doorFraction: .50, floor: [129, 1410, 450, 95, 1442, 838], doorX: 749,
    furniture: [
      ['crates', 283, 538, 218, 95, 41], ['flour-sacks', 500, 514, 144, 60, 24],
      ['crates', 1101, 537, 229, 98, 43], ['barrel', 1336, 498, 105, 40, 22],
      ['barrel', 1315, 714, 110, 42, 24], ['cloth-rolls', 1120, 709, 130, 56, 24],
      ['crates', 317, 731, 220, 94, 42],
    ],
  },
  watermill: {
    name: '방앗간', doorFraction: .40, floor: [123, 1412, 431, 91, 1443, 838], doorX: 768,
    furniture: [
      ['mill-wheel', 1215, 519, 270, 109, 39], ['mill-workbench', 1027, 614, 200, 87, 28],
      ['flour-sacks', 1222, 724, 205, 86, 31], ['flour-sacks', 307, 539, 173, 70, 26],
      ['bench', 449, 670, 136, 58, 18], ['barrel', 224, 711, 98, 37, 22],
    ],
  },
  'herbalist-shop': {
    name: '약초 가게', doorFraction: .76, floor: [115, 1420, 388, 93, 1443, 846], doorX: 765,
    furniture: [
      ['herb-shelf', 291, 461, 223, 91, 29], ['herb-counter', 375, 572, 244, 107, 31],
      ['herb-box', 233, 711, 126, 50, 24], ['cupboard', 1245, 458, 172, 67, 25],
      ['table', 1100, 635, 174, 72, 30], ['bench', 1210, 664, 112, 48, 16],
      ['rug', 775, 702, 222],
    ],
  },
  'fisherman-house': {
    name: '어부의 집', doorFraction: .70, floor: [117, 1416, 412, 88, 1445, 838], doorX: 768,
    furniture: [
      ['oar-rack', 253, 487, 126, 49, 22], ['net-table', 399, 555, 201, 86, 29],
      ['net-basket', 249, 700, 116, 43, 21], ['bed', 1239, 560, 133, 56, 62],
      ['chest', 1227, 616, 128, 54, 24], ['table', 971, 711, 152, 62, 26],
      ['chair', 1062, 738, 61, 23, 17],
    ],
  },
  'evan-cottage': {
    name: '사공 에반의 집', doorFraction: .35, floor: [118, 1402, 417, 89, 1443, 837], doorX: 747,
    furniture: [
      ['oar-rack', 312, 478, 129, 53, 22], ['net-table', 418, 585, 223, 96, 31],
      ['net-basket', 268, 645, 119, 48, 23], ['bed', 1231, 550, 133, 56, 62],
      ['chest', 1288, 649, 133, 56, 24], ['bench', 1094, 691, 150, 63, 17], ['rug', 770, 683, 203],
    ],
  },
  'village-house-a': {
    name: '나루의 작은 집', doorFraction: .49, floor: [120, 1401, 385, 91, 1443, 838], doorX: 748,
    furniture: [
      ['hearth', 271, 460, 198, 88, 34], ['cupboard', 500, 447, 154, 63, 23],
      ['bed', 1218, 535, 130, 56, 62], ['chest', 1257, 593, 125, 53, 24],
      ['table', 430, 670, 185, 75, 31], ['chair', 321, 696, 63, 24, 18],
      ['chair', 543, 680, 63, 24, 18], ['rug', 761, 702, 205],
    ],
  },
  'village-house-b': {
    name: '나루의 목조 주택', doorFraction: .43, floor: [117, 1420, 398, 93, 1440, 840], doorX: 756,
    furniture: [
      ['bed', 299, 536, 130, 56, 62], ['chest', 303, 605, 127, 53, 24],
      ['cupboard', 533, 466, 160, 64, 24], ['hearth', 1213, 478, 204, 91, 35],
      ['table', 1070, 632, 185, 75, 28], ['bench', 1098, 706, 147, 60, 18],
      ['cloth-rolls', 266, 744, 128, 55, 23], ['rug', 762, 694, 220],
    ],
  },
};

const rooms = Object.entries(ROOMS) as [FerryRoomKey, Room][];
const roomId = (key: FerryRoomKey): FerryRoomId => `in-ferry-${key}`;

function exteriorDoor(key: FerryRoomKey, room: Room) {
  const building = FERRY_BUILDINGS.find(b => b.id === key)!;
  return { x: Math.round(building.x + building.width * (room.doorFraction - .5)), y: building.y + 43 };
}

function arrival(room: Room) {
  return { x: room.doorX, y: room.floor[5] - 118 };
}

export const FERRY_DOORS: Interactable[] = rooms.map(([key, room]) => ({
  id: `door-ferry-${key}`, ...exteriorDoor(key, room), radius: 72, markerHeight: 163,
  reach: { rx: 85, up: 41, down: 58 },
  enter: { to: roomId(key), at: arrival(room), label: room.name },
}));

function prop(id: string, [frame, x, y, width, rx, ry]: Placement): VillageProp {
  return {
    id, frame, x, y, width, texture: frame === 'crates' ? ferryTexture(frame) : `ferry-interior-${frame}`,
    ...(rx && ry ? { footprint: { rx, ry, shape: 'rect', offsetY: -ry + 5 } } : { depth: -96 }),
  };
}

function interiorMap(key: FerryRoomKey, room: Room): GameMap {
  const [leftBack, rightBack, backY, leftFront, rightFront, frontY] = room.floor;
  const x = room.doorX, y = frontY + 42;
  const door = exteriorDoor(key, room);
  return {
    id: roomId(key),
    name: room.name,
    hint: `${room.name} · 문 앞에서 나가기를 누르면 밖으로 나가요`,
    artBounds: { left: 0, top: 0, right: 1536, bottom: 1024 },
    bounds: { left: leftFront, top: backY, right: rightFront, bottom: y },
    walkPolygon: [leftBack, backY, rightBack, backY, rightFront, frontY,
      x + 115, frontY, x + 115, y, x - 115, y, x - 115, frontY, leftFront, frontY],
    indoorThreshold: { x, y },
    props: room.furniture.map((placement, i) => prop(`${key}-${placement[0]}-${i + 1}`, placement)),
    buildings: [], npcs: [], enemies: [], exits: [],
    spawn: arrival(room),
    interactables: [{
      id: `exit-ferry-${key}`, x, y: y - 20, radius: 75, markerHeight: 108,
      reach: { rx: 120, up: 55, down: 35 },
      enter: { to: 'ferry-village', at: { x: door.x, y: door.y + 85 }, label: '나가기' },
    }],
  };
}

export const FERRY_INTERIOR_MAPS = Object.fromEntries(rooms.map(([key, room]) => [roomId(key), interiorMap(key, room)]));
