import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { INTERIOR_ART, furnitureAt, interiorArtPoint, interiorArtRect, type Interior, type PixelRect } from './interiors';
import { mapArtKey } from './mapArt';
import { interiorBackgroundPieces } from './interiorLayers';

/** 원화의 벽·바닥 조각과 독립된 가구 객체를 조립한다. 그림과 충돌은 같은 가구 데이터를 공유한다. */
export function drawInterior(scene: Phaser.Scene, interior: Interior): void {
  const art = INTERIOR_ART[interior.id], rect = interiorArtRect(interior);
  const key = mapArtKey(interior.id);
  const width = rect.right - rect.left, height = rect.bottom - rect.top;
  scene.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x17120e).setOrigin(0).setDepth(-120);
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as HTMLImageElement;
  const piece = (bounds: PixelRect, name: string, depth: number) => {
    const [l, t, r, b] = bounds;
    const frame = `interior-piece-${l}-${t}-${r}-${b}`;
    const sx = source.width / art.width, sy = source.height / art.height;
    if (!texture.has(frame)) texture.add(frame, 0, l * sx, t * sy, (r - l) * sx, (b - t) * sy);
    const at = interiorArtPoint(interior, l, t), end = interiorArtPoint(interior, r, b);
    return scene.add.image(at.x, at.y, key, frame).setOrigin(0)
      .setDisplaySize(end.x - at.x, end.y - at.y).setDepth(depth).setName(name);
  };
  for (const bounds of interiorBackgroundPieces(interior)) piece(bounds, 'map-art-background', -110);
  for (const f of interior.furniture) {
    const at = furnitureAt(interior, f);
    piece(f.art, `interior-furniture-${f.id}`, at.y)
      .setData({ furnitureId: f.id, kind: f.kind, footprint: { x: at.x, y: at.y - f.d / 2, w: f.w, d: f.d } });
  }
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
