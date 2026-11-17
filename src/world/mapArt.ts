import Phaser from 'phaser';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';
import home from '../assets/village/rowen/interiors/home.webp?url';
import linea from '../assets/village/rowen/interiors/linea.webp?url';
import chief from '../assets/village/rowen/interiors/chief.webp?url';
import clinic from '../assets/village/rowen/interiors/clinic.webp?url';
import hall from '../assets/village/rowen/interiors/hall.webp?url';
import store from '../assets/village/rowen/interiors/store.webp?url';
import smithy from '../assets/village/rowen/interiors/smithy.webp?url';
import inn from '../assets/village/rowen/interiors/inn.webp?url';
import field from '../assets/maps/south-field/overview.webp?url';
import type { GameMap } from './maps';
import { FIELD_FOREGROUND, FIELD_SCALE } from './southFieldLayout';

const URLS: Record<string, string> = { home, linea, chief, clinic, hall, store, smithy, inn, 'south-field': field };
export const mapArtKey = (id: string): string => `map-art-${id}`;

/** 입장하는 맵만 다운로드한다. 이미 방문한 텍스처는 씬 재시작에도 재사용한다. */
export function preloadMapArt(scene: Phaser.Scene, map: GameMap): void {
  const id = map.interior?.id ?? map.id, url = URLS[id];
  if (url && !scene.textures.exists(mapArtKey(id))) scene.load.image(mapArtKey(id), url);
}

export function drawFieldArt(scene: Phaser.Scene): void {
  const key = mapArtKey('south-field');
  scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(-100).setName('map-art-background');
  for (const [index, layer] of FIELD_FOREGROUND.entries()) {
    const xs = layer.polygon.filter((_, i) => i % 2 === 0), ys = layer.polygon.filter((_, i) => i % 2 === 1);
    const left = Math.min(...xs), top = Math.min(...ys);
    const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
    const foregroundKey = `${key}-foreground-${index}`;
    if (!scene.textures.exists(foregroundKey)) {
      // Phaser 4의 GeometryMask는 Canvas 전용이다. 한 번만 잘라 캐시하여
      // WebGL에서도 전경이 배경 전체를 덮지 않고, 매 프레임 필터 비용도 들지 않는다.
      const texture = scene.textures.createCanvas(foregroundKey, width, height)!;
      const ctx = texture.getContext();
      ctx.beginPath();
      for (let i = 0; i < layer.polygon.length; i += 2) {
        const x = layer.polygon[i] - left, y = layer.polygon[i + 1] - top;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.clip();
      const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
      ctx.drawImage(source, left, top, width, height, 0, 0, width, height);
      // 수관의 바깥 윤곽만으로는 가지 사이의 풀밭까지 복사된다.
      // 텍스처를 만들 때 한 번 제거하여 캐릭터를 가리는 사각 지대를 없앤다.
      if ('holes' in layer) {
        ctx.globalCompositeOperation = 'destination-out';
        for (const hole of layer.holes) {
          ctx.beginPath();
          for (let i = 0; i < hole.length; i += 2) {
            const x = hole[i] - left, y = hole[i + 1] - top;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      texture.refresh();
    }
    scene.add.image(left * FIELD_SCALE, top * FIELD_SCALE, foregroundKey).setOrigin(0)
      .setDisplaySize(width * FIELD_SCALE, height * FIELD_SCALE).setDepth(layer.depth * FIELD_SCALE)
      .setName('map-art-foreground');
  }
}
