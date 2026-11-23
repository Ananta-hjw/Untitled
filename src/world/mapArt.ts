import Phaser from 'phaser';
import { outdoorArtBounds } from './maps';
import home from '../assets/village/rowen/interiors/home.webp?url';
import linea from '../assets/village/rowen/interiors/linea.webp?url';
import chief from '../assets/village/rowen/interiors/chief.webp?url';
import clinic from '../assets/village/rowen/interiors/clinic.webp?url';
import hall from '../assets/village/rowen/interiors/hall.webp?url';
import store from '../assets/village/rowen/interiors/store.webp?url';
import smithy from '../assets/village/rowen/interiors/smithy.webp?url';
import inn from '../assets/village/rowen/interiors/inn.webp?url';
import pass from '../assets/maps/east-pass/ground.webp?url';
import field from '../assets/maps/south-field/ground.webp?url';
import type { GameMap } from './maps';

const URLS: Record<string, string> = { home, linea, chief, clinic, hall, store, smithy, inn, 'south-field': field, 'east-pass': pass };
export const mapArtKey = (id: string): string => `map-art-${id}`;

/** 입장하는 맵만 다운로드한다. 이미 방문한 텍스처는 씬 재시작에도 재사용한다. */
export function preloadMapArt(scene: Phaser.Scene, map: GameMap): void {
  const id = map.interior?.id ?? map.id, url = URLS[id];
  if (url && !scene.textures.exists(mapArtKey(id))) scene.load.image(mapArtKey(id), url);
}

export function drawFieldArt(scene: Phaser.Scene, map: GameMap): void {
  const key = mapArtKey(map.id), b = outdoorArtBounds(map);
  scene.add.image(b.left, b.top, key).setOrigin(0).setDisplaySize(b.right - b.left, b.bottom - b.top).setDepth(-100).setName('map-art-background');
}
