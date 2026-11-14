import Phaser from 'phaser';
import { DEPTH_LIGHTING, FLOOR_TOP, VIEW_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { WalkArea } from './walkArea';

/**
 * 선술집 맵: 배경과 소품 배치, 걸을 수 있는 영역, 조명.
 * 다른 맵을 만들 때는 이 파일과 같은 모양(buildXxx → { walkArea, layout })으로 하나 더 만들면 된다.
 */

export const PLAYER_SPAWN = { x: 1180, y: 620 };

export const ENEMY_SPAWNS: ReadonlyArray<{ key: string; x: number; y: number }> = [
  { key: 'slime-green', x: 760, y: 665 },
  { key: 'slime-blue', x: 1680, y: 560 },
  { key: 'slime-green', x: 1720, y: 670 },
  { key: 'slime-blue', x: 2180, y: 560 },
];

const COUNTER = { left: 900, right: 1460, front: 505 };
const TABLES = [
  { x: 520, y: 600 },
  { x: 1900, y: 610 },
];

export const NPCS: ReadonlyArray<{ key: string; name: string; level?: number; x: number; y: number; faceLeft?: boolean }> = [
  { key: 'keeper', name: '주인장', x: 1180, y: COUNTER.front - 70 },
  { key: 'mage', name: '마법사', level: 21, x: 360, y: 590 },
  { key: 'bard', name: '음유시인', level: 24, x: 690, y: 615, faceLeft: true },
  { key: 'archer', name: '궁수', level: 25, x: 2060, y: 640, faceLeft: true },
];

export interface Tavern {
  walkArea: WalkArea;
  /** 화면 크기가 바뀌면 화면에 고정된 조명을 다시 맞춘다. */
  layout(width: number, height: number): void;
}

export function buildTavern(scene: Phaser.Scene): Tavern {
  scene.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'room').setOrigin(0).setDepth(-100);

  // 벽 장식 (걸어다니는 것들보다 항상 뒤)
  for (const x of [300, 1180, 2080]) scene.add.image(x, 170, 'prop-window').setDepth(-50);
  for (const x of [700, 1640]) scene.add.image(x, 200, 'prop-shelf').setDepth(-50);
  scene.add.image(1180, 330, 'prop-shelf').setDepth(-49);

  // 바닥에 놓인 것들: 원점을 "바닥 접점"에 두고 깊이를 y로 준다.
  const grounded = (x: number, y: number, key: string) =>
    scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);

  for (const [x, y] of [
    [90, 440],
    [180, 432],
    [2250, 436],
    [2330, 446],
  ]) {
    grounded(x, y, 'prop-barrel');
  }

  grounded((COUNTER.left + COUNTER.right) / 2, COUNTER.front, 'prop-counter');
  addCandle(scene, COUNTER.left + 70, COUNTER.front - 148, COUNTER.front + 1);
  addCandle(scene, COUNTER.right - 70, COUNTER.front - 148, COUNTER.front + 1);

  for (const table of TABLES) {
    grounded(table.x, table.y, 'prop-table');
    addCandle(scene, table.x + 10, table.y - 116, table.y + 1);
    grounded(table.x - 165, table.y - 6, 'prop-stool');
    grounded(table.x + 165, table.y + 14, 'prop-stool');
  }

  const top = FLOOR_TOP + 40;
  const walkArea = new WalkArea(
    [
      // 왼쪽 위에서 시계 방향. 가운데가 움푹한 부분은 바 카운터 자리.
      250, top,
      COUNTER.left - 20, top,
      COUNTER.left - 20, COUNTER.front + 12,
      COUNTER.right + 20, COUNTER.front + 12,
      COUNTER.right + 20, top,
      2190, top,
      2370, 470,
      2385, VIEW_HEIGHT - 14,
      15, VIEW_HEIGHT - 14,
      30, 470,
    ],
    TABLES.map((t) => ({ x: t.x, y: t.y - 8, rx: 130, ry: 42 })),
  );

  // 화면 전체를 살짝 어둡게 하고 가장자리를 더 어둡게 하는 조명. 한 장으로 처리한다.
  const lighting = scene.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH_LIGHTING + 2);

  return {
    walkArea,
    layout: (width, height) => lighting.setDisplaySize(width, height),
  };
}

function addCandle(scene: Phaser.Scene, x: number, y: number, depth: number): void {
  scene.add.image(x, y, 'prop-candle').setOrigin(0.5, 1).setDepth(depth);
  const glow = scene.add
    .image(x, y - 40, 'glow')
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH_LIGHTING + 1)
    .setScale(1.6);
  scene.tweens.add({
    targets: glow,
    scale: { from: 1.5, to: 1.75 },
    alpha: { from: 0.8, to: 1 },
    duration: Phaser.Math.Between(260, 420),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
