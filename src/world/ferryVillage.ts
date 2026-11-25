import type { GameMap } from './maps.ts';

const WIDTH = 4800;
const HEIGHT = 3200;
export const FERRY_ENTRY = { x: 593.75, y: 1609.375 };

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
  props: [],
  buildings: [],
  npcs: [],
  spawn: FERRY_ENTRY,
  enemies: [],
  exits: [
    { to: 'east-pass', zone: { left: 75, top: 1528.125, right: 231.25, bottom: 1706.25 }, arrive: { x: 4660, y: 1650 },
      label: '◀ 동쪽 고갯길', labelAt: { x: 343.75, y: 1487.5 } },
  ],
  interactables: [],
};
