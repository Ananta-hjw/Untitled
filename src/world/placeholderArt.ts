import Phaser from 'phaser';

/** 습격 권속의 임시 그림과 공통 발밑 그림자. 일반 몬스터는 MonsterSprite의 원화를 쓴다. */

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

/** 습격용 임시 권속: 일반 슬라임과 구분되는 잿빛 두건과 희미한 눈. */
function registerRetainer(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const key = 'retainer-ash';
  if (scene.anims.exists(`${key}-idle`)) return;
  for (let frame = 0; frame < 2; frame++) {
    g.clear();
    const lift = frame * 4;
    g.fillStyle(0x252a38);
    g.fillTriangle(55, 8 + lift, 14, 125, 96, 125);
    g.fillStyle(0x535568);
    g.fillTriangle(55, 18 + lift, 28, 115, 83, 115);
    g.fillStyle(0x141622);
    g.fillEllipse(55, 50 + lift, 40, 48);
    g.fillStyle(0xc4b2ee);
    g.fillEllipse(46, 48 + lift, 5, 4);
    g.fillEllipse(64, 48 + lift, 5, 4);
    g.lineStyle(7, 0x858395);
    g.lineBetween(31, 79 + lift, 12, 98 + lift);
    g.lineBetween(79, 79 + lift, 97, 99 + lift);
    g.generateTexture(`${key}-idle${frame}`, 110, 130);
  }
  for (const motion of ['idle', 'walk']) scene.anims.create({
    key: `${key}-${motion}`, frames: [{ key: `${key}-idle0` }, { key: `${key}-idle1` }],
    frameRate: motion === 'idle' ? 2 : 6, repeat: -1,
  });
}

/** 텍스처와 애니메이션은 게임 전체에 남으므로, 씬을 재시작해도 이미 있는 것은 다시 만들지 않는다. */
export function createPlaceholderArt(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  registerRetainer(scene, g);
  g.destroy();

  radialTexture(scene, 'shadow', 128, 40, [
    [0, 'rgba(0,0,0,0.9)'],
    [0.6, 'rgba(0,0,0,0.55)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
}
