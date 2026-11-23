import type Phaser from 'phaser';
import atlasUrl from '../assets/items/icons.webp?url';
import atlas from '../assets/items/icons.json';
import { ITEMS, ITEM_IDS, type ItemId } from '../items/inventory';

export const ITEM_ICON_TEXTURE = 'item-icons';
/** 읽어 온 아틀라스 원본. 실제로 그리는 ITEM_ICON_TEXTURE는 이것에 임시 아이콘을 덧붙인 캔버스다. */
const SOURCE_TEXTURE = 'item-icons-source';
const TILE = 128;
const GAP = 4;

/** 아이템·장비 아이콘은 작은 아틀라스 한 장으로 읽고, 창을 다시 열어도 같은 텍스처를 쓴다. */
export function preloadItemIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ITEM_ICON_TEXTURE) && !scene.textures.exists(SOURCE_TEXTURE)) scene.load.image(SOURCE_TEXTURE, atlasUrl);
}

/**
 * 아틀라스의 칸을 등록한다. 아틀라스에 아직 그림이 없는 아이템(새로 생긴 물건)은 같은 텍스처 아래쪽 줄에
 * 색 상자와 이름 두 글자로 임시 아이콘을 그려 넣는다. 그래서 모든 화면이 (ITEM_ICON_TEXTURE, 아이템 id)로
 * 그대로 그리고, 그림이 아틀라스에 들어오면 저절로 그 그림으로 바뀐다.
 */
export function registerItemIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists(ITEM_ICON_TEXTURE) || !scene.textures.exists(SOURCE_TEXTURE)) return;
  const source = scene.textures.get(SOURCE_TEXTURE).getSourceImage() as HTMLImageElement;
  const missing = ITEM_IDS.filter((id) => !atlas.frames.some((f) => f.name === id));
  const extraTop = source.height + GAP;
  const width = Math.max(source.width, GAP + missing.length * (TILE + GAP));
  const canvas = scene.textures.createCanvas(ITEM_ICON_TEXTURE, width, extraTop + (missing.length ? TILE + GAP : 0));
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.drawImage(source, 0, 0);
  missing.forEach((id, i) => {
    const x = GAP + i * (TILE + GAP), y = extraTop;
    drawPlaceholder(ctx, x, y, id);
  });
  canvas.refresh();
  for (const f of atlas.frames) canvas.add(f.name, 0, f.x, f.y, f.w, f.h);
  missing.forEach((id, i) => canvas.add(id, 0, GAP + i * (TILE + GAP), extraTop, TILE, TILE));
}

/** 그림이 없는 물건의 임시 아이콘: 효과에 맞는 색 원과 이름 두 글자 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, id: ItemId): void {
  const def = ITEMS[id];
  const color = def.mana ? '#3c6fa8' : def.cures ? '#4f8a47' : def.heal ? '#a8643a' : '#6a6a5a';
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#f1dfae';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6dc';
  ctx.font = 'bold 40px system-ui, "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.name.replace(/\s/g, '').slice(0, 2), x + TILE / 2, y + TILE / 2 + 2);
  ctx.restore();
}

export function itemIcon(scene: Phaser.Scene, id: ItemId): Phaser.GameObjects.Image {
  registerItemIcons(scene);
  return scene.add.image(0, 0, ITEM_ICON_TEXTURE, id).setDisplaySize(88, 88).setScrollFactor(0);
}
