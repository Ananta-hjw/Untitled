import type Phaser from 'phaser';
import atlasUrl from '../assets/items/icons.webp?url';
import atlas from '../assets/items/icons.json';
import type { ItemId } from '../items/inventory';

export const ITEM_ICON_TEXTURE = 'item-icons';

/** 아이템·장비 아이콘은 작은 아틀라스 한 장으로 읽고, 창을 다시 열어도 같은 텍스처를 쓴다. */
export function preloadItemIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ITEM_ICON_TEXTURE)) scene.load.image(ITEM_ICON_TEXTURE, atlasUrl);
}

export function registerItemIcons(scene: Phaser.Scene): void {
  const texture = scene.textures.get(ITEM_ICON_TEXTURE);
  for (const f of atlas.frames) if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
}

export function itemIcon(scene: Phaser.Scene, id: ItemId): Phaser.GameObjects.Image {
  registerItemIcons(scene);
  return scene.add.image(0, 0, ITEM_ICON_TEXTURE, id).setDisplaySize(88, 88).setScrollFactor(0);
}
