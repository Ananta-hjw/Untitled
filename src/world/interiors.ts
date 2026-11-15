import type { Obstacle } from './obstacles.ts';
import type { BuildingFrame } from './villageLayout.ts';

/**
 * 로웬 마을 건물의 실내.
 *
 * 건물 문 앞에서 "들어가기"를 누르면 그 건물의 실내 맵으로 옮겨 가고, 아래쪽 문으로 나오면 그 건물 문 앞으로 돌아온다.
 * 실내 그림이 아직 없어서 바닥·벽·가구를 코드로 그린다(world/interiorArt.ts). 그림이 생기면 그리는 부분만 바꾼다.
 * 가구 좌표는 방의 왼쪽 위(바닥이 시작하는 곳) 기준이고, (x, y)는 가구가 바닥에 닿는 앞쪽 가운데다.
 * 가구는 [x - w/2, x + w/2] × [y - d, y]의 바닥을 차지한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/interiors.test.mjs가 직접 불러 검사한다.
 */

export type InteriorId = 'home' | 'chief' | 'clinic' | 'hall' | 'store' | 'smithy' | 'inn';

export type FurnitureKind =
  | 'bed' | 'table' | 'chair' | 'shelf' | 'books' | 'herbs' | 'weapons' | 'counter' | 'barrel' | 'crate'
  | 'hearth' | 'forge' | 'anvil' | 'dummy' | 'rug' | 'plant' | 'bench';

export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  /** 바닥에서 차지하는 너비와 깊이 */
  w: number;
  d: number;
  /** 색 (침대 이불, 깔개 등) */
  color?: number;
}

export interface Interior {
  id: InteriorId;
  /** 이 실내가 속한 건물 */
  building: BuildingFrame;
  name: string;
  /** 방의 크기 (걸을 수 있는 바닥) */
  width: number;
  depth: number;
  floor: number;
  wall: number;
  furniture: Furniture[];
}

/** 깔개처럼 밟고 지나갈 수 있는 가구 */
export const WALKABLE_FURNITURE: readonly FurnitureKind[] = ['rug'];

export const INTERIORS: Interior[] = [
  {
    id: 'home', building: 'family-house', name: '시온의 집', width: 1000, depth: 520, floor: 0xa0714a, wall: 0xe8d6b4,
    furniture: [
      { kind: 'hearth', x: 170, y: 70, w: 210, d: 70 },
      { kind: 'shelf', x: 420, y: 45, w: 170, d: 45 },
      { kind: 'bed', x: 660, y: 250, w: 140, d: 210, color: 0xc0504d },
      { kind: 'bed', x: 860, y: 250, w: 140, d: 210, color: 0x4f6fa8 },
      { kind: 'table', x: 330, y: 330, w: 200, d: 110 },
      { kind: 'chair', x: 250, y: 375, w: 46, d: 40 },
      { kind: 'chair', x: 410, y: 375, w: 46, d: 40 },
      { kind: 'rug', x: 500, y: 470, w: 300, d: 130, color: 0x8a3b3b },
      { kind: 'plant', x: 60, y: 480, w: 50, d: 40 },
    ],
  },
  {
    id: 'chief', building: 'chief-house', name: '촌장의 집', width: 1100, depth: 540, floor: 0x8c6a4c, wall: 0xd9cfb8,
    furniture: [
      { kind: 'books', x: 200, y: 45, w: 200, d: 45 },
      { kind: 'books', x: 420, y: 45, w: 200, d: 45 },
      { kind: 'hearth', x: 900, y: 70, w: 200, d: 70 },
      { kind: 'table', x: 760, y: 280, w: 250, d: 110 },
      { kind: 'chair', x: 760, y: 160, w: 50, d: 40 },
      { kind: 'rug', x: 450, y: 380, w: 380, d: 170, color: 0x3d5a80 },
      { kind: 'plant', x: 60, y: 500, w: 50, d: 40 },
      { kind: 'plant', x: 1040, y: 500, w: 50, d: 40 },
    ],
  },
  {
    id: 'clinic', building: 'clinic', name: '치유소', width: 1100, depth: 540, floor: 0xb89870, wall: 0xf1ead8,
    furniture: [
      { kind: 'bed', x: 150, y: 260, w: 140, d: 210, color: 0xe9efe6 },
      { kind: 'bed', x: 330, y: 260, w: 140, d: 210, color: 0xe9efe6 },
      { kind: 'herbs', x: 800, y: 45, w: 280, d: 45 },
      { kind: 'table', x: 800, y: 320, w: 190, d: 100 },
      { kind: 'barrel', x: 1030, y: 220, w: 70, d: 50 },
      { kind: 'plant', x: 560, y: 90, w: 60, d: 45 },
      { kind: 'plant', x: 1040, y: 500, w: 50, d: 40 },
    ],
  },
  {
    id: 'hall', building: 'training-hall', name: '수련소', width: 1200, depth: 580, floor: 0x9c7b55, wall: 0xcdb48c,
    furniture: [
      { kind: 'rug', x: 520, y: 420, w: 560, d: 230, color: 0x6f7b4a },
      { kind: 'dummy', x: 300, y: 230, w: 60, d: 40 },
      { kind: 'dummy', x: 520, y: 230, w: 60, d: 40 },
      { kind: 'dummy', x: 740, y: 230, w: 60, d: 40 },
      { kind: 'weapons', x: 1010, y: 45, w: 240, d: 45 },
      { kind: 'bench', x: 1010, y: 420, w: 220, d: 50 },
      { kind: 'barrel', x: 120, y: 90, w: 70, d: 50 },
    ],
  },
  {
    id: 'store', building: 'general-store', name: '잡화점', width: 1000, depth: 520, floor: 0xa98256, wall: 0xe6d3a8,
    furniture: [
      { kind: 'shelf', x: 240, y: 45, w: 230, d: 45 },
      { kind: 'shelf', x: 760, y: 45, w: 230, d: 45 },
      { kind: 'counter', x: 500, y: 250, w: 420, d: 70 },
      { kind: 'barrel', x: 90, y: 300, w: 70, d: 50 },
      { kind: 'barrel', x: 910, y: 300, w: 70, d: 50 },
      { kind: 'crate', x: 110, y: 470, w: 90, d: 60 },
      { kind: 'crate', x: 890, y: 470, w: 90, d: 60 },
    ],
  },
  {
    id: 'smithy', building: 'smithy', name: '대장간', width: 1100, depth: 540, floor: 0x6f6458, wall: 0x9b8c7a,
    furniture: [
      { kind: 'forge', x: 220, y: 100, w: 260, d: 100 },
      { kind: 'anvil', x: 470, y: 290, w: 120, d: 60 },
      { kind: 'barrel', x: 640, y: 270, w: 70, d: 50 },
      { kind: 'weapons', x: 850, y: 45, w: 260, d: 45 },
      { kind: 'crate', x: 960, y: 400, w: 100, d: 70 },
      { kind: 'crate', x: 120, y: 470, w: 90, d: 60 },
    ],
  },
  {
    id: 'inn', building: 'inn', name: '여관', width: 1400, depth: 600, floor: 0x9a6b45, wall: 0xe2c99e,
    furniture: [
      { kind: 'hearth', x: 200, y: 75, w: 230, d: 75 },
      { kind: 'counter', x: 1070, y: 230, w: 460, d: 70 },
      { kind: 'barrel', x: 960, y: 70, w: 70, d: 50 },
      { kind: 'barrel', x: 1180, y: 70, w: 70, d: 50 },
      { kind: 'shelf', x: 640, y: 45, w: 220, d: 45 },
      { kind: 'table', x: 300, y: 330, w: 150, d: 90 },
      { kind: 'table', x: 560, y: 470, w: 150, d: 90 },
      { kind: 'table', x: 960, y: 470, w: 150, d: 90 },
      { kind: 'chair', x: 200, y: 378, w: 44, d: 38 },
      { kind: 'chair', x: 400, y: 378, w: 44, d: 38 },
      { kind: 'rug', x: 700, y: 330, w: 260, d: 120, color: 0x7a3550 },
    ],
  },
];

/** 실내를 월드 좌표에 놓는 곳: 방 가운데 */
export const ROOM_CENTER = { x: 1200, y: 820 };

export function interiorFor(building: BuildingFrame): Interior | undefined {
  return INTERIORS.find((i) => i.building === building);
}

/** 방의 바닥 (월드 좌표) */
export function roomRect(interior: Interior): { left: number; top: number; right: number; bottom: number } {
  const left = ROOM_CENTER.x - interior.width / 2, top = ROOM_CENTER.y - interior.depth / 2;
  return { left, top, right: left + interior.width, bottom: top + interior.depth };
}

/** 가구의 앞쪽 가운데 (월드 좌표) */
export function furnitureAt(interior: Interior, f: Furniture): { x: number; y: number } {
  const room = roomRect(interior);
  return { x: room.left + f.x, y: room.top + f.y };
}

/** 문(방 아래쪽 가운데)의 월드 좌표 */
export function doorOf(interior: Interior): { x: number; y: number } {
  const room = roomRect(interior);
  return { x: (room.left + room.right) / 2, y: room.bottom };
}

/** 들어왔을 때 서는 자리: 문 바로 안쪽 */
export function arrivalOf(interior: Interior): { x: number; y: number } {
  const door = doorOf(interior);
  return { x: door.x, y: door.y - 80 };
}

/** 밟을 수 없는 가구의 바닥 영역 */
export function furnitureObstacles(interior: Interior): Obstacle[] {
  return interior.furniture.filter((f) => !WALKABLE_FURNITURE.includes(f.kind)).map((f) => {
    const p = furnitureAt(interior, f);
    return { x: p.x, y: p.y - f.d / 2, rx: f.w / 2, ry: f.d / 2, shape: 'rect' as const };
  });
}
