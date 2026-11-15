import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { INTERIOR_ART, interiorArtPoint, interiorArtRect, type Interior } from './interiors';
import { mapArtKey } from './mapArt';

/** 원화 한 장과 같은 텍스처의 전경 조각을 사용한다. 가구를 코드로 중복해서 그리지 않는다. */
export function drawInterior(scene: Phaser.Scene, interior: Interior): void {
  const art = INTERIOR_ART[interior.id], rect = interiorArtRect(interior);
  const key = mapArtKey(interior.id);
  const width = rect.right - rect.left, height = rect.bottom - rect.top;
  scene.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x17120e).setOrigin(0).setDepth(-120);
  scene.add.image(rect.left, rect.top, key).setOrigin(0).setDisplaySize(width, height).setDepth(-110)
    .setName('map-art-background');
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const foreground = [
    ...(art.foreground ?? []),
    [0, art.floor[3], art.doorX - 110, art.height],
    [art.doorX + 110, art.floor[3], art.width, art.height],
  ];
  for (const [left, top, right, bottom] of foreground) {
    const depth = interiorArtPoint(interior, left, bottom).y;
    scene.add.image(rect.left, rect.top, key).setOrigin(0).setDisplaySize(width, height)
      .setCrop(left / art.width * source.width, top / art.height * source.height,
        (right - left) / art.width * source.width, (bottom - top) / art.height * source.height)
      .setDepth(depth).setName('map-art-foreground');
  }
}
