import type { GameMap } from './maps.ts';
import type { VillageProp } from './villageLayout.ts';

export const PASS_SHELTER = { x: 1800, y: 1420, width: 520 };
export const PASS_FIRE = { x: 1840, y: 1585 };
const props: VillageProp[] = [
  { frame: 'stone-shelter', texture: 'east-pass-stone-shelter', ...PASS_SHELTER },
  { frame: 'dead-tree', texture: 'east-pass-dead-tree', x: 2780, y: 2050, width: 240, footprint: { rx: 55, ry: 30 } },
  { frame: 'dead-tree', texture: 'east-pass-dead-tree', x: 4050, y: 1270, width: 220, footprint: { rx: 48, ry: 26 } },
  ...[450, 1160, 1870, 2580, 3290, 4000].map(x => ({ frame: 'cliff-straight' as const, texture: 'east-pass-cliff-straight', x, y: 750, width: 740 })),
  { frame: 'cliff-corner', texture: 'east-pass-cliff-corner', x: 4430, y: 810, width: 520 },
  ...[[350, 1300], [650, 1750], [390, 2830], [1150, 2850], [2500, 2900], [3520, 2800], [4470, 2460]].map(([x, y]) =>
    ({ frame: 'pine' as const, x, y, width: 250, footprint: { rx: 35, ry: 23 } })),
  ...[[920, 1180], [2460, 1330], [3150, 1900], [3870, 2430]].map(([x, y]) =>
    ({ frame: 'boulders' as const, x, y, width: 200, footprint: { rx: 80, ry: 34 } })),
  { frame: 'stump', x: 2300, y: 1700, width: 90, footprint: { rx: 34, ry: 18 } },
  { frame: 'sign', x: 330, y: 2240, width: 90, footprint: { rx: 16, ry: 12 } },
];

export const EAST_PASS: GameMap = {
  id: 'east-pass', name: '동쪽 고갯길', hint: '동쪽 고갯길 · 쉼터에서 쉬어 가며 고개를 넘으세요',
  artBounds: { left: 0, top: 0, right: 4800, bottom: 3200 },
  bounds: { left: 80, top: 780, right: 4720, bottom: 3060 },
  props, buildings: [],
  npcs: [{ id: 'dor', name: '도르', role: '고개 쉼터의 약초꾼', x: 1690, y: 1560, height: 144, dialogue: 'npc-dor', facing: 'down-right' }],
  obstacles: [
    // The open front is passable; side and rear stone walls remain solid.
    { x: 1795, y: 1250, rx: 190, ry: 35, shape: 'rect' },
    { x: 1585, y: 1340, rx: 32, ry: 90, shape: 'rect' },
    { x: 2015, y: 1325, rx: 30, ry: 90, shape: 'rect' },
    { x: PASS_FIRE.x, y: PASS_FIRE.y, rx: 36, ry: 22 },
    // Whole inaccessible upper ledge, including the corner, not just rock contact points.
    { x: 2400, y: 400, rx: 2400, ry: 380, shape: 'rect' },
    { x: 4430, y: 790, rx: 260, ry: 75, shape: 'rect' },
  ],
  spawn: { x: 350, y: 2150 },
  enemies: [
    { key: 'fog-crow', x: 2900, y: 1620 }, { key: 'fog-crow', x: 3040, y: 1680 }, { key: 'fog-crow', x: 3160, y: 1560 },
    { key: 'fog-crow', x: 3920, y: 2120 }, { key: 'fog-crow', x: 4050, y: 2210 }, { key: 'fog-crow', x: 4170, y: 2080 },
    { key: 'frost-beetle', x: 1150, y: 2280 }, { key: 'frost-beetle', x: 2470, y: 2450 },
  ],
  exits: [{ to: 'east-stream', zone: { left: 0, top: 2010, right: 170, bottom: 2320 }, arrive: { x: 3040, y: 1420 },
    label: '◀ 동쪽 개울가', labelAt: { x: 250, y: 2340 } }],
  interactables: [{ id: 'east-pass-sign', x: 330, y: 2260, radius: 100, markerHeight: 120, dialogue: 'east-pass-sign' }],
};
