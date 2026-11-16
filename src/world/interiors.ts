import { MAP_SIZE_SCALE } from '../config.ts';
import type { Obstacle } from './obstacles.ts';
import type { BuildingFrame } from './villageLayout.ts';

/**
 * 로웬 마을 건물의 실내.
 *
 * 건물 문 앞에서 "들어가기"를 누르면 그 건물의 실내 맵으로 옮겨 가고, 실내 문 앞에서 "나가기"를 누르면 그 건물 문 앞으로 돌아온다.
 * 원화와 같은 좌표에서 바닥 경계·가구·문을 측정한다. 그리기는 world/interiorArt.ts에서 처리한다.
 * 가구 좌표는 방의 왼쪽 위(바닥이 시작하는 곳) 기준이고, (x, y)는 가구가 바닥에 닿는 앞쪽 가운데다.
 * 가구는 [x - w/2, x + w/2] × [y - d, y]의 바닥을 차지한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/interiors.test.mjs가 직접 불러 검사한다.
 */

export type InteriorId = 'home' | 'linea' | 'chief' | 'clinic' | 'hall' | 'store' | 'smithy' | 'inn';

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

type PixelRect = readonly [number, number, number, number];

/** 원화 픽셀 좌표. 가구는 바닥 접촉 영역이며, foreground는 인물을 가리는 전경 조각이다. */
export interface InteriorArtwork {
  width: number;
  height: number;
  floor: PixelRect;
  /**
   * 실제로 밟을 수 있는 바닥 (원화 픽셀 x, y 쌍). 원화는 뒤로 갈수록 양옆 벽이 안쪽으로 들어오므로
   * 사각형(floor)만 쓰면 뒤쪽 모서리에서 창문·벽 위로 올라섰다. 없으면 floor 사각형을 쓴다.
   */
  walk?: readonly number[];
  doorX: number;
  /** 닫힌 문 원화는 아치 앞에서 출입한다. 방 아래쪽까지 밟고 올라가지 않는다. */
  doorY?: number;
  furniture: readonly (readonly [FurnitureKind, PixelRect])[];
  foreground?: readonly PixelRect[];
  shop?: { x: number; y: number; talkY: number };
}

export const INTERIOR_ART: Record<InteriorId, InteriorArtwork> = {
  home: {
    width: 1536, height: 1024, floor: [90, 410, 1445, 840], doorX: 750,
    walk: [110, 415, 1425, 415, 1450, 840, 85, 840],
    furniture: [
      ['hearth', [90, 410, 355, 450]], ['shelf', [355, 410, 850, 440]],
      ['bed', [890, 410, 1115, 455]], ['bed', [1160, 410, 1285, 448]], ['bed', [1300, 410, 1425, 448]],
      ['table', [130, 500, 480, 790]], ['crate', [1120, 625, 1405, 810]], ['plant', [1350, 480, 1440, 610]],
    ],
  },
  linea: {
    width: 1536, height: 1024, floor: [100, 445, 1445, 850], doorX: 765,
    walk: [105, 445, 1430, 445, 1450, 850, 85, 850],
    furniture: [
      ['hearth', [100, 445, 355, 500]], ['shelf', [355, 445, 730, 465]],
      ['bed', [1250, 445, 1430, 700]], ['table', [1100, 445, 1240, 510]],
      ['table', [130, 510, 475, 770]], ['plant', [1300, 710, 1440, 840]],
    ],
  },
  chief: {
    width: 1774, height: 887, floor: [125, 370, 1650, 735], doorX: 960, doorY: 620,
    // 계단 아래와 벽난로 쪽은 뒤쪽 바닥이 조금 더 앞으로 나와 있다.
    walk: [140, 370, 1213, 370, 1213, 433, 1663, 433, 1680, 707, 92, 707],
    furniture: [
      // 앞쪽 벽의 문 아치: 아치 위로 올라서지 않는다.
      ['crate', [814, 624, 1045, 707]],
      ['books', [540, 370, 1120, 390]], ['table', [205, 370, 450, 410]],
      ['table', [220, 420, 700, 650]], ['bench', [1200, 370, 1470, 440]], ['hearth', [1470, 370, 1650, 560]],
    ],
  },
  clinic: {
    width: 1536, height: 1024, floor: [170, 445, 1350, 750], doorX: 725, doorY: 720,
    // 오른쪽 온실은 창유리와 화분이 가득해 들어가지 않는다.
    walk: [200, 445, 1105, 445, 1105, 745, 170, 745],
    furniture: [
      ['bed', [180, 445, 490, 510]], ['bed', [180, 545, 470, 695]],
      ['herbs', [535, 445, 740, 465]], ['table', [910, 445, 1090, 520]],
      ['plant', [1110, 445, 1350, 700]], ['plant', [170, 700, 370, 750]],
    ],
    // 에일라는 약초 선반 앞 빈 바닥에서 지낸다(조금씩 오간다).
    shop: { x: 800, y: 560, talkY: 560 },
  },
  hall: {
    width: 1536, height: 1024, floor: [100, 420, 1440, 840], doorX: 750,
    walk: [205, 410, 1330, 410, 1450, 835, 85, 835],
    furniture: [
      ['dummy', [330, 420, 410, 440]], ['dummy', [450, 420, 550, 440]], ['dummy', [580, 420, 670, 440]],
      ['weapons', [830, 420, 1150, 440]], ['barrel', [150, 420, 245, 480]],
      ['bench', [1290, 460, 1430, 640]], ['barrel', [1310, 655, 1440, 750]],
    ],
  },
  store: {
    width: 1536, height: 1024, floor: [95, 380, 1440, 840], doorX: 750,
    // 왼쪽 창가 자리(창턱 의자)는 바닥이 아니다.
    walk: [300, 455, 1420, 455, 1445, 840, 90, 840, 100, 600, 295, 600],
    furniture: [
      ['shelf', [310, 380, 590, 475]], ['counter', [670, 430, 1240, 560]], ['shelf', [1240, 380, 1410, 450]],
      ['plant', [1270, 600, 1435, 650]], ['crate', [95, 635, 290, 840]], ['crate', [1210, 655, 1435, 840]],
    ],
    // 발은 상판(y=390)이 아닌 계산대에 가려진 바닥 높이에 둔다.
    // 원화의 상판·전면을 전경으로 겹쳐 상반신만 자연스럽게 보이게 한다.
    foreground: [[670, 390, 1240, 560]], shop: { x: 960, y: 480, talkY: 590 },
  },
  smithy: {
    width: 1536, height: 1024, floor: [90, 510, 1440, 850], doorX: 750,
    walk: [95, 515, 1435, 515, 1455, 840, 80, 840],
    furniture: [
      ['forge', [160, 510, 520, 535]], ['anvil', [210, 560, 400, 760]], ['barrel', [95, 630, 200, 840]],
      ['table', [810, 510, 1230, 530]], ['bench', [1240, 510, 1430, 550]],
    ],
    // 도란은 모루 오른쪽 옆에 선다.
    shop: { x: 455, y: 720, talkY: 720 },
  },
  inn: {
    width: 1536, height: 1024, floor: [95, 370, 1440, 840], doorX: 720,
    // 카운터 뒤와 계단 밑은 손님이 들어가는 곳이 아니다.
    walk: [110, 430, 1320, 430, 1320, 455, 1440, 455, 1455, 840, 85, 840],
    furniture: [
      ['hearth', [100, 370, 380, 430]], ['shelf', [380, 370, 700, 415]],
      ['counter', [720, 400, 1100, 445]], ['bench', [1200, 370, 1430, 445]],
      ['table', [115, 445, 365, 605]], ['table', [100, 630, 390, 820]],
      ['table', [1160, 445, 1425, 620]], ['table', [1130, 645, 1440, 820]],
    ],
    foreground: [[725, 320, 1095, 445]], shop: { x: 930, y: 385, talkY: 500 },
  },
};

const ROOMS: readonly [InteriorId, BuildingFrame, string, number][] = [
  ['home', 'family-house', '시온의 집', 1000], ['linea', 'linea-house', '리네아의 집', 900],
  ['chief', 'chief-house', '촌장의 집', 1100], ['clinic', 'clinic', '치유소', 1100],
  ['hall', 'training-hall', '수련소', 1200], ['store', 'general-store', '잡화점', 1000],
  ['smithy', 'smithy', '대장간', 1100], ['inn', 'inn', '여관', 1400],
];

export const INTERIORS: Interior[] = ROOMS.map(([id, building, name, baseWidth]) => {
  const width = baseWidth * MAP_SIZE_SCALE;
  const art = INTERIOR_ART[id], [left, top, right, bottom] = art.floor;
  const scale = width / (right - left);
  return {
    id, building, name, width, depth: (bottom - top) * scale, floor: 0xa0714a, wall: 0xe8d6b4,
    furniture: art.furniture.map(([kind, [x0, y0, x1, y1]]) => ({
      kind, x: ((x0 + x1) / 2 - left) * scale, y: (y1 - top) * scale,
      w: (x1 - x0) * scale, d: (y1 - y0) * scale,
    })),
  };
});

/** 원화의 픽셀 위치를 가로세로 비율을 유지한 월드 좌표로 바꾼다. */
export function interiorArtPoint(interior: Interior, x: number, y: number): { x: number; y: number } {
  const art = INTERIOR_ART[interior.id], room = roomRect(interior);
  const scale = interior.width / (art.floor[2] - art.floor[0]);
  return { x: room.left + (x - art.floor[0]) * scale, y: room.top + (y - art.floor[1]) * scale };
}

/** 밟을 수 있는 바닥 다각형 (월드 좌표, x, y 쌍). */
export function interiorWalkPolygon(interior: Interior): number[] {
  const art = INTERIOR_ART[interior.id], [l, t, r, b] = art.floor;
  const points = art.walk ?? [l, t, r, t, r, b, l, b];
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const p = interiorArtPoint(interior, points[i], points[i + 1]);
    out.push(p.x, p.y);
  }
  return out;
}

/** 원화 전체의 표시 영역: 카메라가 지붕·벽·문턱을 잘라내지 않게 한다. */
export function interiorArtRect(interior: Interior) {
  const art = INTERIOR_ART[interior.id];
  const a = interiorArtPoint(interior, 0, 0), b = interiorArtPoint(interior, art.width, art.height);
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}

export function interiorShop(id: InteriorId): { x: number; y: number; inside: InteriorId; talkOffset: number } {
  const interior = INTERIORS.find(i => i.id === id)!, shop = INTERIOR_ART[id].shop!;
  const at = interiorArtPoint(interior, shop.x, shop.y);
  const talk = interiorArtPoint(interior, shop.x, shop.talkY);
  return { ...at, inside: id, talkOffset: talk.y - at.y };
}

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
  const art = INTERIOR_ART[interior.id];
  return interiorArtPoint(interior, art.doorX, art.doorY ?? art.floor[3]);
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
