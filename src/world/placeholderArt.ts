import Phaser from 'phaser';

/**
 * 임시 그래픽.
 *
 * 실제 아트가 준비되기 전까지 코드로 그린 그림을 텍스처로 구워서 쓴다.
 * 지금은 슬라임 두 종류와 캐릭터 발밑 그림자만 남아 있다.
 * 나중에는 이 파일 대신 preload()에서 PNG/아틀라스를 불러오고,
 * 같은 텍스처·애니메이션 이름(`${key}-idle`, `${key}-walk`, `shadow`)으로 등록하면
 * 나머지 코드는 손댈 필요가 없다.
 */

const SLIME_W = 110;
const SLIME_H = 90;

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
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

/** 텍스처와 애니메이션은 게임 전체에 남으므로, 씬을 재시작해도 이미 있는 것은 다시 만들지 않는다. */
export function createPlaceholderArt(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  registerSlime(scene, g, 'slime-green', 0x6fbf5a);
  registerSlime(scene, g, 'slime-blue', 0x5a9fd6);
  g.destroy();

  radialTexture(scene, 'shadow', 128, 40, [
    [0, 'rgba(0,0,0,0.9)'],
    [0.6, 'rgba(0,0,0,0.55)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
}
