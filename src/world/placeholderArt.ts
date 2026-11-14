import Phaser from 'phaser';
import { FLOOR_TOP, VIEW_HEIGHT } from '../config';

/**
 * 임시 그래픽.
 *
 * 실제 아트가 준비되기 전까지 코드로 그린 그림을 텍스처로 구워서 쓴다.
 * 나중에는 이 파일 대신 preload()에서 PNG/아틀라스를 불러오고,
 * 같은 텍스처·애니메이션 이름으로 등록하면 나머지 코드는 손댈 필요가 없다.
 */

export interface HumanPalette {
  skin: number;
  hair: number;
  armor: number;
  trim: number;
  cape: number;
  pants: number;
}

interface HumanPose {
  bob: number;
  frontLeg: number;
  backLeg: number;
  frontLift: number;
  backLift: number;
  arm: number;
}

const HUMAN_W = 220;
const HUMAN_H = 180;
const SLIME_W = 110;
const SLIME_H = 90;

export const ROOM_TILE_WIDTH = 400;

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function drawHuman(g: Phaser.GameObjects.Graphics, p: HumanPalette, pose: HumanPose): void {
  const cx = HUMAN_W / 2;
  const foot = HUMAN_H - 4;
  const b = pose.bob;
  const outline = 0x1a1008;

  // 망토
  g.fillStyle(p.cape);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx - 12, 76 + b),
      new Phaser.Math.Vector2(cx - 38 - pose.arm * 0.4, 152),
      new Phaser.Math.Vector2(cx - 8, 156),
      new Phaser.Math.Vector2(cx + 6, 80 + b),
    ],
    true,
  );

  // 뒷다리
  g.fillStyle(shade(p.pants, 0.7));
  g.fillRoundedRect(cx - 10 + pose.backLeg, 124 + b, 16, foot - 132 - pose.backLift - b, 5);
  g.fillStyle(shade(p.trim, 0.6));
  g.fillRoundedRect(cx - 11 + pose.backLeg, foot - 12 - pose.backLift, 24, 12, 5);

  // 앞다리
  g.fillStyle(p.pants);
  g.fillRoundedRect(cx - 6 + pose.frontLeg, 124 + b, 16, foot - 132 - pose.frontLift - b, 5);
  g.fillStyle(p.trim);
  g.fillRoundedRect(cx - 7 + pose.frontLeg, foot - 12 - pose.frontLift, 24, 12, 5);

  // 몸통
  g.fillStyle(outline);
  g.fillRoundedRect(cx - 22, 73 + b, 44, 62, 12);
  g.fillStyle(p.armor);
  g.fillRoundedRect(cx - 19, 76 + b, 38, 56, 10);
  g.fillStyle(shade(p.armor, 1.25));
  g.fillRoundedRect(cx - 4, 80 + b, 18, 26, 7);
  g.fillStyle(p.trim);
  g.fillRect(cx - 19, 118 + b, 38, 7);

  // 팔 (어깨에서 손까지)
  const handX = cx - 1 + pose.arm * 1.3;
  const handY = 126 + b;
  g.lineStyle(15, shade(p.armor, 0.8));
  g.lineBetween(cx - 1, 92 + b, handX, handY);
  g.fillStyle(shade(p.armor, 0.8));
  g.fillCircle(cx - 1, 92 + b, 8);
  g.fillStyle(p.skin);
  g.fillCircle(handX, handY, 8);

  // 머리
  g.fillStyle(outline);
  g.fillCircle(cx, 52 + b, 27);
  g.fillStyle(p.hair);
  g.fillCircle(cx - 2, 51 + b, 24);
  g.fillStyle(p.skin);
  g.fillCircle(cx + 5, 58 + b, 18);
  g.fillStyle(p.hair);
  g.fillTriangle(cx - 12, 40 + b, cx + 24, 40 + b, cx + 10, 54 + b);
  g.fillStyle(outline);
  g.fillEllipse(cx + 14, 60 + b, 5, 8);
}

function drawSlime(g: Phaser.GameObjects.Graphics, color: number, squash: number): void {
  const cx = SLIME_W / 2;
  const foot = SLIME_H - 4;
  const w = 92 + squash * 10;
  const h = 64 - squash * 10;
  g.fillStyle(0x1a1008);
  g.fillEllipse(cx, foot - h / 2, w + 6, h + 6);
  g.fillStyle(color);
  g.fillEllipse(cx, foot - h / 2, w, h);
  g.fillStyle(shade(color, 1.35), 0.9);
  g.fillEllipse(cx - 16, foot - h * 0.72, w * 0.3, h * 0.2);
  g.fillStyle(0x1a1008);
  g.fillEllipse(cx + 10, foot - h * 0.5, 7, 12);
  g.fillEllipse(cx + 30, foot - h * 0.5, 7, 12);
}

function drawRoomTile(g: Phaser.GameObjects.Graphics): void {
  const w = ROOM_TILE_WIDTH;

  // 벽
  g.fillStyle(0x3b2617);
  g.fillRect(0, 0, w, FLOOR_TOP);
  for (let i = 0; i < 5; i++) {
    g.fillStyle(i % 2 === 0 ? 0x412a19 : 0x372314);
    g.fillRect(i * 80 + 2, 0, 76, FLOOR_TOP);
  }
  g.fillStyle(0x24160c);
  g.fillRect(0, 0, w, 46);
  g.fillStyle(0x5a3b20);
  g.fillRect(0, 46, w, 8);
  g.fillStyle(0x2c1b0f);
  g.fillRect(0, 286, w, 14);
  g.fillStyle(0x24160c);
  g.fillRect(0, FLOOR_TOP - 22, w, 22);
  // 기둥
  g.fillStyle(0x24160c);
  g.fillRect(0, 0, 26, FLOOR_TOP);
  g.fillStyle(0x4a2f1a);
  g.fillRect(5, 0, 8, FLOOR_TOP);

  // 바닥: 아래로 갈수록 널빤지 간격을 넓혀 원근감을 준다.
  g.fillStyle(0x6b4426);
  g.fillRect(0, FLOOR_TOP, w, VIEW_HEIGHT - FLOOR_TOP);
  let y = FLOOR_TOP;
  let row = 0;
  while (y < VIEW_HEIGHT) {
    const h = 26 + row * 9;
    g.fillStyle(row % 2 === 0 ? 0x74492a : 0x643f23);
    g.fillRect(0, y, w, h);
    g.fillStyle(0x3a2313);
    g.fillRect(0, y, w, 3);
    const seam = (row * 137) % w;
    g.fillRect(seam, y, 3, h);
    g.fillRect((seam + 210) % w, y, 3, h);
    y += h;
    row++;
  }
}

function drawProps(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  // 창문
  g.clear();
  g.fillStyle(0x24160c);
  g.fillRoundedRect(0, 0, 170, 190, 10);
  g.fillStyle(0x1c2b4a);
  g.fillRect(14, 14, 142, 162);
  g.fillStyle(0x2c426e);
  g.fillRect(14, 14, 142, 70);
  g.fillStyle(0xf4e9c1, 0.9);
  g.fillCircle(118, 52, 16);
  g.fillStyle(0x24160c);
  g.fillRect(80, 14, 10, 162);
  g.fillRect(14, 90, 142, 10);
  g.generateTexture('prop-window', 170, 190);

  // 선반
  g.clear();
  const bottles = [0x7fa86b, 0xb8623a, 0x5e86b0, 0xc9a13f, 0x8d5aa3, 0xb8623a];
  bottles.forEach((color, i) => {
    g.fillStyle(color);
    g.fillRoundedRect(16 + i * 34, 30 - (i % 3) * 6, 18, 44 + (i % 3) * 6, 5);
    g.fillRect(22 + i * 34, 18 - (i % 3) * 6, 6, 14);
  });
  g.fillStyle(0x24160c);
  g.fillRect(0, 74, 230, 14);
  g.fillStyle(0x5a3b20);
  g.fillRect(0, 74, 230, 4);
  g.generateTexture('prop-shelf', 230, 90);

  // 술통
  g.clear();
  g.fillStyle(0x1a1008);
  g.fillRoundedRect(0, 0, 96, 126, 22);
  g.fillStyle(0x7a4c26);
  g.fillRoundedRect(4, 4, 88, 118, 20);
  g.fillStyle(0x8f5b2e);
  g.fillRoundedRect(22, 4, 30, 118, 8);
  g.fillStyle(0x3d3d44);
  g.fillRect(4, 26, 88, 9);
  g.fillRect(4, 92, 88, 9);
  g.generateTexture('prop-barrel', 96, 126);

  // 원형 테이블 (바닥 접점이 텍스처 맨 아래)
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(120, 150, 150, 26);
  g.fillStyle(0x2c1b0f);
  g.fillRect(106, 60, 28, 84);
  g.fillEllipse(120, 146, 110, 22);
  g.fillStyle(0x1a1008);
  g.fillEllipse(120, 58, 240, 84);
  g.fillStyle(0x5a3719);
  g.fillEllipse(120, 56, 232, 76);
  g.fillStyle(0x8a5a2e);
  g.fillEllipse(120, 48, 232, 76);
  g.fillStyle(0x9a6836);
  g.fillEllipse(110, 44, 170, 48);
  g.generateTexture('prop-table', 240, 164);

  // 의자
  g.clear();
  g.fillStyle(0x2c1b0f);
  g.fillRect(12, 20, 8, 50);
  g.fillRect(44, 20, 8, 50);
  g.fillStyle(0x1a1008);
  g.fillEllipse(32, 18, 64, 26);
  g.fillStyle(0x80522a);
  g.fillEllipse(32, 15, 58, 22);
  g.generateTexture('prop-stool', 64, 72);

  // 바 카운터
  g.clear();
  g.fillStyle(0x1a1008);
  g.fillRect(0, 0, 560, 150);
  g.fillStyle(0x4d3019);
  g.fillRect(4, 26, 552, 120);
  for (let i = 0; i < 7; i++) {
    g.fillStyle(i % 2 === 0 ? 0x573820 : 0x462b16);
    g.fillRect(8 + i * 78, 30, 74, 112);
  }
  g.fillStyle(0x8a5a2e);
  g.fillRect(0, 0, 560, 26);
  g.fillStyle(0xa87340);
  g.fillRect(0, 0, 560, 8);
  g.generateTexture('prop-counter', 560, 150);

  // 양초
  g.clear();
  g.fillStyle(0xe9dcc0);
  g.fillRoundedRect(8, 22, 12, 30, 3);
  g.fillStyle(0xffc24a);
  g.fillEllipse(14, 14, 10, 18);
  g.fillStyle(0xfff3c4);
  g.fillEllipse(14, 16, 5, 10);
  g.generateTexture('prop-candle', 28, 54);
}

function radialTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  stops: Array<[number, string]>,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.getContext();
  // 타원형 그라데이션을 위해 세로 비율만큼 캔버스를 눌러서 그린다.
  ctx.save();
  ctx.scale(1, height / width);
  const r = width / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, width);
  ctx.restore();
  texture.refresh();
}

function registerHuman(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, key: string, palette: HumanPalette): void {
  const idle: HumanPose[] = [
    { bob: 0, frontLeg: 2, backLeg: -4, frontLift: 0, backLift: 0, arm: 0 },
    { bob: 2, frontLeg: 2, backLeg: -4, frontLift: 0, backLift: 0, arm: 1 },
  ];
  const walk: HumanPose[] = [
    { bob: 0, frontLeg: 14, backLeg: -16, frontLift: 0, backLift: 4, arm: -9 },
    { bob: -3, frontLeg: 4, backLeg: -4, frontLift: 0, backLift: 12, arm: -3 },
    { bob: 0, frontLeg: -14, backLeg: 12, frontLift: 4, backLift: 0, arm: 9 },
    { bob: -3, frontLeg: -4, backLeg: 2, frontLift: 12, backLift: 0, arm: 3 },
  ];
  idle.forEach((pose, i) => {
    g.clear();
    drawHuman(g, palette, pose);
    g.generateTexture(`${key}-idle${i}`, HUMAN_W, HUMAN_H);
  });
  walk.forEach((pose, i) => {
    g.clear();
    drawHuman(g, palette, pose);
    g.generateTexture(`${key}-walk${i}`, HUMAN_W, HUMAN_H);
  });
  scene.anims.create({
    key: `${key}-idle`,
    frames: idle.map((_, i) => ({ key: `${key}-idle${i}` })),
    frameRate: 2,
    repeat: -1,
  });
  scene.anims.create({
    key: `${key}-walk`,
    frames: walk.map((_, i) => ({ key: `${key}-walk${i}` })),
    frameRate: 9,
    repeat: -1,
  });

}

function registerSlime(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, key: string, color: number): void {
  if (scene.anims.exists(`${key}-idle`)) return;
  [0, 1].forEach((squash, i) => {
    g.clear();
    drawSlime(g, color, squash);
    g.generateTexture(`${key}-idle${i}`, SLIME_W, SLIME_H);
  });
  scene.anims.create({
    key: `${key}-idle`,
    frames: [{ key: `${key}-idle0` }, { key: `${key}-idle1` }],
    frameRate: 2,
    repeat: -1,
  });
  scene.anims.create({
    key: `${key}-walk`,
    frames: [{ key: `${key}-idle0` }, { key: `${key}-idle1` }],
    frameRate: 6,
    repeat: -1,
  });
}

export const HUMANS: Record<string, HumanPalette> = {
  mage: { skin: 0xf1c9a0, hair: 0xd9d4cf, armor: 0x3b3340, trim: 0x8a2c2c, cape: 0x23202a, pants: 0x2b2730 },
  bard: { skin: 0xf4d2b0, hair: 0xb98fa6, armor: 0xa33c3c, trim: 0x6b3f1e, cape: 0x7a2a2a, pants: 0x5a3a2a },
  archer: { skin: 0xe9bf98, hair: 0xcfc7b2, armor: 0x56683e, trim: 0x4a3420, cape: 0x3c4a2a, pants: 0x4a3f2e },
  keeper: { skin: 0xd9a37a, hair: 0x7a2f22, armor: 0xb9a37a, trim: 0x3a2313, cape: 0x6b2d22, pants: 0x3a2f28 },
};

export function createPlaceholderArt(scene: Phaser.Scene): void {
  // 텍스처와 애니메이션은 게임 전체에 남으므로 씬을 재시작해도 한 번만 만든다.
  if (scene.textures.exists('room')) return;

  const g = scene.make.graphics({}, false);

  if (!scene.textures.exists('room')) {
    drawRoomTile(g);
    g.generateTexture('room', ROOM_TILE_WIDTH, VIEW_HEIGHT);
  }
  if (!scene.textures.exists('prop-window')) drawProps(scene, g);

  for (const [key, palette] of Object.entries(HUMANS)) {
    // 실제 그림이 이미 등록된 캐릭터는 건너뛴다.
    if (scene.anims.exists(`${key}-idle`)) continue;
    registerHuman(scene, g, key, palette);
  }
  registerSlime(scene, g, 'slime-green', 0x6fbf5a);
  registerSlime(scene, g, 'slime-blue', 0x5a9fd6);

  g.destroy();

  radialTexture(scene, 'shadow', 128, 40, [
    [0, 'rgba(0,0,0,0.9)'],
    [0.6, 'rgba(0,0,0,0.55)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  radialTexture(scene, 'glow', 256, 256, [
    [0, 'rgba(255,214,140,0.85)'],
    [0.25, 'rgba(255,170,80,0.38)'],
    [1, 'rgba(255,140,40,0)'],
  ]);
  // 화면 전체를 살짝 어둡게 하고(가운데) 가장자리로 갈수록 더 어둡게 한다.
  radialTexture(scene, 'vignette', 512, 512, [
    [0, 'rgba(20,10,4,0.22)'],
    [0.62, 'rgba(20,10,4,0.22)'],
    [1, 'rgba(8,4,2,0.84)'],
  ]);
}
