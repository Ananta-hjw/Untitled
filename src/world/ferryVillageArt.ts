import Phaser from 'phaser';
import { ferryTexture } from './ferryVillage';
import type { FerryObjectId } from './villageLayout';

const urls = import.meta.glob<string>('../assets/maps/ferry-village/objects/*.webp', { eager: true, query: '?url', import: 'default' });

/** 물안개 나루의 건물·소품을 하나씩 따로 불러온다(각 그림이 하나의 텍스처, 프레임은 '__BASE'). */
export function preloadFerryVillage(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(urls)) {
    const id = path.slice(path.lastIndexOf('/') + 1, -'.webp'.length) as FerryObjectId;
    const key = ferryTexture(id);
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}
