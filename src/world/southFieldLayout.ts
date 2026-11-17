import { WORLD_WIDTH } from '../config.ts';
import type { VillageProp } from './villageLayout.ts';

/** 남쪽 들판 원화(1536×1024)를 확장된 월드에 같은 비율로 표시한다. */
export const FIELD_SCALE = WORLD_WIDTH / 1536;

// 물가를 따라 걷기 경계를 잡고, 다리 위만 동쪽으로 돌출시킨다.
const SHORE = [
  40, 170, 620, 170, 695, 105, 800, 105, 835, 170, 1395, 170,
  1370, 225, 1330, 285, 1320, 340, 1280, 385, 1280, 415,
  1460, 415, 1460, 470, 1290, 470, 1280, 540, 1220, 620,
  1210, 690, 1140, 780, 1100, 840, 1060, 900, 1030, 995, 40, 995,
];
export const FIELD_POLYGON = SHORE.map(n => n * FIELD_SCALE);
export const FIELD_BOUNDS = { left: 40 * FIELD_SCALE, top: 105 * FIELD_SCALE, right: 1460 * FIELD_SCALE, bottom: 995 * FIELD_SCALE };

/** 지면과 분리한 정적 객체. 좌표·너비·바닥 접점을 원화 픽셀 단위로 함께 정의한다.
 * 같은 객체가 화면 표시, y 깊이, 충돌, 미니맵에 쓰이므로 확대해도 서로 어긋나지 않는다. */
const OBJECTS: ReadonlyArray<readonly [VillageProp['frame'], number, number, number]> = [
  ['oak', 95, 210, 210], ['oak', 320, 160, 180], ['pine', 56, 340, 180],
  ['oak', 1150, 250, 320], ['pine', 1460, 380, 160], ['oak', 82, 800, 280],
  ['oak', 835, 950, 240], ['oak', 1440, 990, 260], ['pine', 45, 995, 190],
  ['oak', 380, 1040, 220],
  ['rock', 220, 195, 120], ['rock', 350, 250, 100], ['rock', 175, 361, 110],
  ['boulders', 812, 305, 140], ['rock', 1100, 295, 100], ['rock', 1294, 220, 110],
  ['boulders', 1090, 420, 140], ['boulders', 650, 518, 160], ['rock', 1205, 685, 100],
  ['boulders', 1010, 715, 160], ['rock', 486, 830, 120], ['boulders', 370, 870, 140],
  ['rock', 1340, 325, 100], ['rock', 1280, 550, 90], ['rock', 1220, 620, 90],
  ['rock', 1140, 780, 90], ['rock', 1100, 860, 100], ['rock', 1030, 950, 100],
];
export const FIELD_PROPS: VillageProp[] = OBJECTS.map(([frame, x, y, width]) => {
  const tree = frame === 'oak' || frame === 'pine';
  return { frame, x: x * FIELD_SCALE, y: y * FIELD_SCALE, width: width * FIELD_SCALE,
    footprint: { rx: width * (tree ? .24 : .45) * FIELD_SCALE, ry: width * (tree ? .10 : .18) * FIELD_SCALE } };
});

/** Phaser에 의존하지 않는 점-다각형 검사 (저장/이동 검사도 같은 경계를 사용). */
export function insidePolygon(points: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i], yi = points[i + 1], xj = points[j], yj = points[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
