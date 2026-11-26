import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { INTERIOR_ART, furnitureAt, interiorArtPoint, interiorArtRect, type Interior, type PixelRect } from './interiors';
import { mapArtKey } from './mapArt';
import { INTERIOR_OCCLUDERS, interiorBackgroundPieces } from './interiorLayers';

/** 원화의 벽·바닥 조각과 독립된 가구 객체를 조립한다. 그림과 충돌은 같은 가구 데이터를 공유한다. */
export function drawInterior(scene: Phaser.Scene, interior: Interior): void {
  const art = INTERIOR_ART[interior.id], rect = interiorArtRect(interior);
  const key = mapArtKey(interior.id);
  const [width, height] = art.textureSize;
  scene.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x17120e).setOrigin(0).setDepth(-120);
  const texture = scene.textures.get(key);
  const base = texture.get('__BASE');
  if (base.cutWidth !== width || base.cutHeight !== height) {
    throw new Error(`Interior ground ${key} must be ${width}×${height} pixels`);
  }
  // Convert measured coordinates to native pixel edges so neighbouring crops share the same boundary.
  const pixelX = (x: number) => Math.round(x * width / art.width);
  const pixelY = (y: number) => Math.round(y * height / art.height);
  const piece = ([l, t, r, b]: PixelRect, name: string, depth: number) => {
    const left = pixelX(l), top = pixelY(t), right = pixelX(r), bottom = pixelY(b);
    const frame = `interior-piece-${left}-${top}-${right}-${bottom}`;
    if (!texture.has(frame)) texture.add(frame, 0, left, top, right - left, bottom - top);
    return scene.add.image(rect.left + left, rect.top + top, key, frame).setOrigin(0).setDepth(depth).setName(name);
  };
  for (const bounds of interiorBackgroundPieces(interior)) piece(bounds, 'map-art-background', -110);
  for (const f of interior.furniture) {
    const at = furnitureAt(interior, f);
    // Restore the original painting under the actors. Only the masked overlay occludes them.
    piece(f.art, `interior-furniture-${f.id}`, -110)
      .setData({ furnitureId: f.id, kind: f.kind, footprint: { x: at.x, y: at.y - f.d / 2, w: f.w, d: f.d } });
  }
  const source = texture.getSourceImage() as HTMLImageElement;
  for (const [index, occluder] of INTERIOR_OCCLUDERS[interior.id].entries()) {
    const outlines = occluder.outlines.map(outline => outline.map((value, i) =>
      i % 2 === 0 ? value * width / 768 : value * height / 512));
    const xs = outlines.flatMap(outline => outline.filter((_, i) => i % 2 === 0));
    const ys = outlines.flatMap(outline => outline.filter((_, i) => i % 2 === 1));
    const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
    const w = Math.ceil(Math.max(...xs)) - x, h = Math.ceil(Math.max(...ys)) - y;
    const maskKey = `${key}-foreground-${index}`;
    if (!scene.textures.exists(maskKey)) {
      const mask = scene.textures.createCanvas(maskKey, w, h);
      if (!mask) throw new Error(`Unable to allocate interior texture ${maskKey}`);
      const ctx = mask.context;
      ctx.save();
      ctx.beginPath();
      for (const outline of outlines) {
        ctx.moveTo(outline[0] - x, outline[1] - y);
        for (let i = 2; i < outline.length; i += 2) ctx.lineTo(outline[i] - x, outline[i + 1] - y);
        ctx.closePath();
      }
      ctx.clip();
      ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
      ctx.restore();
      mask.refresh();
    }
    if ('furniture' in occluder) {
      const f = interior.furniture[occluder.furniture];
      scene.add.image(rect.left + x, rect.top + y, maskKey).setOrigin(0)
        .setDepth(furnitureAt(interior, f).y - f.d).setName('interior-occluder').setData('furnitureId', f.id);
    } else {
      scene.add.image(rect.left + x, rect.top + y, maskKey).setOrigin(0)
        .setDepth(interiorArtPoint(interior, 0, occluder.frontY * art.height / 512).y).setName('map-art-foreground');
    }
  }

  const foreground = [
    [0, art.floor[3], art.doorX - 110, art.height],
    [art.doorX + 110, art.floor[3], art.width, art.height],
  ];
  for (const [left, top, right, bottom] of foreground) {
    const depth = interiorArtPoint(interior, left, bottom).y;
    // Keep the front wall below the walkable floor as a separate occluding strip.
    const x = pixelX(left), y = pixelY(top);
    scene.add.image(rect.left, rect.top, key, '__BASE').setOrigin(0)
      .setCrop(x, y, pixelX(right) - x, pixelY(bottom) - y)
      .setDepth(depth).setName('map-art-foreground');
  }
}
