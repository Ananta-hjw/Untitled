import type { Obstacle } from './obstacles';

export const PLAYER_SPAWN = { x: 1180, y: 620 };
// Reserve room for the full walking sprite and its name plate at camera boundaries.
export const WALK_BOUNDS = { left: 64, top: 224, right: 2336, bottom: 1560 };
export const HOME = {
  x: 1180, y: 460, width: 600, height: 365,
  footprint: { x: 1180, y: 398, rx: 255, ry: 62, shape: 'rect' } as Obstacle,
  entrance: { x: 1180, y: 500 },
};

export interface VillageProp {
  frame: 'oak' | 'pine' | 'boulders' | 'shrub' | 'rock' | 'flowers' | 'sign' | 'stump';
  x: number;
  y: number;
  width: number;
  footprint?: { rx: number; ry: number };
}

export const PROPS: VillageProp[] = [
  { frame: 'oak', x: 160, y: 350, width: 330, footprint: { rx: 38, ry: 24 } },
  { frame: 'pine', x: 430, y: 300, width: 240, footprint: { rx: 27, ry: 20 } },
  { frame: 'oak', x: 740, y: 260, width: 270, footprint: { rx: 32, ry: 22 } },
  { frame: 'pine', x: 1670, y: 280, width: 250, footprint: { rx: 30, ry: 20 } },
  { frame: 'oak', x: 2040, y: 340, width: 350, footprint: { rx: 40, ry: 26 } },
  { frame: 'pine', x: 2320, y: 430, width: 230, footprint: { rx: 26, ry: 20 } },
  { frame: 'oak', x: 230, y: 800, width: 330, footprint: { rx: 38, ry: 24 } },
  { frame: 'oak', x: 2170, y: 760, width: 320, footprint: { rx: 37, ry: 24 } },
  { frame: 'pine', x: 2340, y: 1090, width: 260, footprint: { rx: 30, ry: 20 } },
  { frame: 'oak', x: 220, y: 1400, width: 330, footprint: { rx: 38, ry: 24 } },
  { frame: 'pine', x: 540, y: 1550, width: 260, footprint: { rx: 28, ry: 20 } },
  { frame: 'oak', x: 1910, y: 1550, width: 330, footprint: { rx: 38, ry: 24 } },
  { frame: 'oak', x: 2240, y: 1440, width: 340, footprint: { rx: 39, ry: 24 } },
  { frame: 'boulders', x: 580, y: 530, width: 170, footprint: { rx: 76, ry: 28 } },
  { frame: 'boulders', x: 1850, y: 470, width: 165, footprint: { rx: 73, ry: 28 } },
  { frame: 'boulders', x: 1940, y: 1100, width: 180, footprint: { rx: 80, ry: 30 } },
  { frame: 'rock', x: 610, y: 1190, width: 110, footprint: { rx: 49, ry: 24 } },
  { frame: 'rock', x: 1570, y: 1350, width: 100, footprint: { rx: 44, ry: 22 } },
  { frame: 'shrub', x: 860, y: 355, width: 105, footprint: { rx: 43, ry: 19 } },
  { frame: 'shrub', x: 1510, y: 340, width: 120, footprint: { rx: 50, ry: 22 } },
  { frame: 'shrub', x: 400, y: 1060, width: 110, footprint: { rx: 45, ry: 20 } },
  { frame: 'shrub', x: 2030, y: 1330, width: 110, footprint: { rx: 45, ry: 20 } },
  { frame: 'flowers', x: 900, y: 480, width: 75 },
  { frame: 'flowers', x: 1480, y: 485, width: 80 },
  { frame: 'flowers', x: 480, y: 760, width: 65 },
  { frame: 'flowers', x: 1800, y: 880, width: 70 },
  { frame: 'flowers', x: 760, y: 1130, width: 65 },
  { frame: 'flowers', x: 1370, y: 1440, width: 70 },
  { frame: 'sign', x: 1600, y: 930, width: 90, footprint: { rx: 15, ry: 13 } },
  { frame: 'stump', x: 350, y: 1260, width: 100, footprint: { rx: 40, ry: 22 } },
  { frame: 'stump', x: 2200, y: 500, width: 90, footprint: { rx: 35, ry: 20 } },
  // Flat stones along the doorstep are decoration, not collision barriers.
  { frame: 'rock', x: 1180, y: 506, width: 31 },
  { frame: 'rock', x: 1172, y: 540, width: 25 },
  { frame: 'rock', x: 1188, y: 573, width: 28 },
];

/** 소품의 바닥 접점(줄기·바위 밑동)만 장애물로 만든다. 다른 맵도 같은 규칙을 쓴다. */
export function propObstacles(props: readonly VillageProp[]): Obstacle[] {
  return props.flatMap((p) => p.footprint ? [{ x: p.x, y: p.y - p.footprint.ry * .45, ...p.footprint }] : []);
}

// 마을은 평화로운 곳이라 몬스터가 나오지 않는다. 몬스터는 마을 밖 사냥터(maps.ts)에 있다.
export const OBSTACLES: Obstacle[] = [HOME.footprint, ...propObstacles(PROPS)];
