import { mapPoint } from './mapScale.ts';
import { INTERIOR_SIZE_SCALE } from '../config.ts';
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
  id: string;
  kind: FurnitureKind;
  /** 원화에서 분리해 그리는 객체 영역. */
  art: PixelRect;
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

export type PixelRect = readonly [number, number, number, number];

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
  furniture: readonly (readonly [FurnitureKind, PixelRect, PixelRect?])[];
  /** 문·창가·계단 등 영구 출입 금지 영역 (원화 픽셀). */
  blocked?: readonly PixelRect[];
  foreground?: readonly PixelRect[];
  shop?: { x: number; y: number; talkY: number };
}

export const INTERIOR_ART: Record<InteriorId, InteriorArtwork> = {
  home: {
    width: 1536, height: 1024, floor: [90, 410, 1445, 840], doorX: 750,
    walk: [110, 415, 1425, 415, 1450, 840, 85, 840],
    furniture: [
      ['hearth', [90, 410, 355, 450]], ['shelf', [355, 410, 850, 440]],
      ['bed', [890, 410, 1115, 490], [885, 225, 1120, 490]], ['bed', [1160, 410, 1285, 470], [1150, 245, 1295, 470]], ['bed', [1300, 410, 1425, 470], [1290, 245, 1435, 470]],
      ['table', [210, 530, 405, 715], [200, 490, 415, 720]],
      ['chair', [135, 535, 205, 715], [130, 520, 210, 720]], ['chair', [410, 545, 485, 710], [405, 520, 490, 720]],
      ['chair', [245, 720, 355, 790], [240, 685, 360, 795]],
      ['crate', [1200, 625, 1405, 765], [1190, 590, 1410, 770]], ['barrel', [1105, 700, 1200, 815]],
      ['plant', [1350, 480, 1440, 610]],
    ],
  },
  linea: {
    width: 1536, height: 1024, floor: [100, 445, 1445, 850], doorX: 765,
    walk: [105, 470, 1100, 470, 1100, 445, 1430, 445, 1450, 850, 85, 850],
    blocked: [[730, 0, 1100, 470]],
    furniture: [
      ['hearth', [100, 445, 355, 500]], ['shelf', [355, 445, 730, 465]],
      ['bed', [1250, 445, 1430, 700], [1245, 285, 1440, 705]], ['table', [1100, 445, 1240, 510], [1090, 390, 1245, 515]],
      ['chair', [1155, 510, 1240, 575], [1150, 465, 1245, 580]],
      ['table', [225, 550, 405, 725], [200, 500, 420, 730]],
      ['chair', [130, 550, 225, 745], [125, 520, 230, 750]], ['chair', [410, 545, 500, 740], [405, 510, 505, 745]],
      ['crate', [1260, 670, 1410, 740]], ['plant', [1300, 745, 1440, 840]],
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
    walk: [200, 465, 1105, 465, 1105, 745, 170, 745],
    blocked: [[1105, 0, 1536, 1024]],
    furniture: [
      ['bed', [180, 445, 490, 510], [175, 350, 495, 515]], ['bed', [180, 545, 470, 695], [175, 530, 475, 700]],
      ['table', [185, 510, 260, 545]],
      ['herbs', [535, 445, 740, 465]], ['table', [910, 445, 1090, 520]],
      ['chair', [1020, 520, 1100, 595], [1015, 475, 1105, 600]],
      ['plant', [1110, 445, 1350, 700]], ['plant', [170, 700, 370, 750]],
    ],
    // 에일라는 약초 선반 앞 빈 바닥에서 지낸다(조금씩 오간다).
    shop: { x: 850, y: 540, talkY: 540 },
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
      ['forge', [160, 510, 520, 535]], ['anvil', [210, 590, 400, 760], [205, 530, 405, 765]], ['barrel', [95, 630, 200, 840]],
      ['crate', [520, 510, 620, 565]], ['barrel', [625, 510, 720, 565]],
      ['table', [810, 510, 1230, 530], [800, 340, 1235, 535]],
      ['bench', [1240, 510, 1430, 550], [1230, 395, 1440, 555]],
    ],
    // 도란은 모루 오른쪽 옆에 선다.
    shop: { x: 455, y: 720, talkY: 720 },
  },
  inn: {
    width: 1536, height: 1024, floor: [95, 370, 1440, 840], doorX: 720,
    // 카운터 뒤와 계단 밑은 손님이 들어가는 곳이 아니다.
    walk: [110, 445, 1140, 445, 1140, 470, 1320, 470, 1320, 550, 1440, 550, 1455, 840, 85, 840],
    blocked: [[1320, 370, 1445, 550]],
    furniture: [
      ['hearth', [100, 370, 380, 430]], ['shelf', [380, 370, 700, 415]],
      ['counter', [720, 400, 1100, 445]], ['bench', [1200, 370, 1430, 445]],
      ['table', [140, 470, 300, 585], [125, 430, 315, 590]],
      ['chair', [100, 460, 140, 595]], ['chair', [300, 460, 375, 595]],
      ['table', [145, 685, 315, 795], [130, 625, 330, 800]],
      ['chair', [100, 660, 145, 815]], ['chair', [315, 660, 390, 815]],
      ['table', [1190, 490, 1345, 595], [1170, 445, 1365, 605]],
      ['chair', [1150, 480, 1190, 620]], ['chair', [1345, 480, 1430, 620]],
      ['table', [1190, 700, 1350, 805], [1170, 645, 1370, 815]],
      ['chair', [1130, 680, 1190, 825]], ['chair', [1350, 680, 1440, 825]],
    ],
    foreground: [[725, 320, 1095, 445]], shop: { x: 930, y: 385, talkY: 500 },
  },
};

const OBJECT_HEIGHT: Partial<Record<FurnitureKind, number>> = { bed: 150, table: 70, chair: 70, shelf: 240, books: 260, herbs: 240, weapons: 180, counter: 140, hearth: 280, forge: 280, anvil: 80, barrel: 65, crate: 65, plant: 95, bench: 55, dummy: 180 };

const ROOMS: readonly [InteriorId, BuildingFrame, string, number][] = [
  ['home', 'family-house', '시온의 집', 1000], ['linea', 'linea-house', '리네아의 집', 900],
  ['chief', 'chief-house', '촌장의 집', 1100], ['clinic', 'clinic', '치유소', 1100],
  ['hall', 'training-hall', '수련소', 1200], ['store', 'general-store', '잡화점', 1000],
  ['smithy', 'smithy', '대장간', 1100], ['inn', 'inn', '여관', 1400],
];

export const INTERIORS: Interior[] = ROOMS.map(([id, building, name, baseWidth]) => {
  const width = baseWidth * INTERIOR_SIZE_SCALE;
  const art = INTERIOR_ART[id], [left, top, right, bottom] = art.floor;
  const scale = width / (right - left);
  return {
    id, building, name, width, depth: (bottom - top) * scale, floor: 0xa0714a, wall: 0xe8d6b4,
    furniture: art.furniture.map(([kind, [x0, y0, x1, y1], visual], index) => ({
      id: `${id}-${kind}-${index}`, art: visual ?? [x0, Math.max(0, y0 - (OBJECT_HEIGHT[kind] ?? 0)), x1, y1] as PixelRect, kind, x: ((x0 + x1) / 2 - left) * scale, y: (y1 - top) * scale,
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
export const ROOM_CENTER = mapPoint({ x: 1200, y: 820 });

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
    return { x: p.x, y: p.y - f.d / 2, rx: f.w / 2 + 12, ry: f.d / 2 + 10, shape: 'rect' as const };
  });
}

/** Walls and unreachable fixtures are separate from furniture and cannot be bypassed by a dodge. */
export function interiorRestrictedObstacles(interior: Interior): Obstacle[] {
  return (INTERIOR_ART[interior.id].blocked ?? []).map(([l, t, r, b]) => {
    const a = interiorArtPoint(interior, l, t), z = interiorArtPoint(interior, r, b);
    return { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2, rx: (z.x - a.x) / 2, ry: (z.y - a.y) / 2, shape: 'rect' };
  });
}
