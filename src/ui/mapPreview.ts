import type Phaser from 'phaser';
import { outdoorArtBounds } from '../world/maps';
import type { GameMap, Rect } from '../world/maps';
import { interiorArtRect } from '../world/interiors';
import { PERIMETER_TEXTURE, perimeterPieces } from '../world/villagePerimeter';
import { fieldArtPieces, mapArtKey } from '../world/mapArt';

export interface MapPreview { key: string; frame: string; bounds: Rect; width: number; height: number }
const KEY = 'current-area-preview';
const SIZE = 1024;
const cache = new WeakMap<Phaser.Scene, { map: GameMap; preview: MapPreview }>();

/** One reusable 4 MiB canvas, shared by the minimap and area map. Rebuilt only on map changes. */
export function mapPreview(scene: Phaser.Scene, map: GameMap): MapPreview {
  const old = cache.get(scene);
  if (old?.map === map && scene.textures.exists(KEY)) return old.preview;
  const bounds = map.interior ? interiorArtRect(map.interior) : outdoorArtBounds(map);
  const scale = SIZE / Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top);
  const width = Math.round((bounds.right - bounds.left) * scale), height = Math.round((bounds.bottom - bounds.top) * scale);
  const texture = (scene.textures.exists(KEY) ? scene.textures.get(KEY) : scene.textures.createCanvas(KEY, SIZE, SIZE)) as Phaser.Textures.CanvasTexture;
  const ctx = texture.context;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#192019'; ctx.fillRect(0, 0, width, height);
  const art = mapArtKey(map.interior?.id ?? map.id);
  if (map.interior && scene.textures.exists(art)) {
    ctx.drawImage(scene.textures.get(art).getSourceImage() as CanvasImageSource, 0, 0, width, height);
  } else if (scene.textures.exists(art)) {
    for (const piece of fieldArtPieces(map)) {
      const x = Math.round((piece.x - bounds.left) * scale), y = Math.round((piece.y - bounds.top) * scale);
      const right = Math.round((piece.x + piece.width - bounds.left) * scale);
      const bottom = Math.round((piece.y + piece.height - bounds.top) * scale);
      ctx.drawImage(scene.textures.get(piece.key).getSourceImage() as CanvasImageSource, x, y, right - x, bottom - y);
    }
  } else {
    ctx.drawImage(scene.textures.get('village-ground').getSourceImage() as CanvasImageSource, 0, 0, width, height);
    if (map.groundTint !== undefined) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `#${map.groundTint.toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over';
    }
    if (map.water) {
      ctx.fillStyle = '#4f9fc4';
      ctx.fillRect(0, map.water.top * scale, width, (map.water.bottom - map.water.top) * scale);
    }
  }
  if (!map.interior) {
    const objects = [
      ...perimeterPieces(map.id).map(p => ({ ...p, texture: PERIMETER_TEXTURE, frame: p.frame as string })),
      ...map.props.map(p => ({ ...p, texture: p.texture ?? 'village-props', frame: p.frame as string })),
      ...map.buildings.map(b => ({ ...b, texture: 'village-buildings', frame: b.frame as string })),
    ].sort((a, b) => a.y - b.y);
    for (const object of objects) {
      const source = scene.textures.get(object.texture);
      const frame = source.get(source.has(object.frame) ? object.frame : '__BASE'), w = object.width * scale, h = 'height' in object ? object.height * scale : w * frame.cutHeight / frame.cutWidth;
      ctx.drawImage(source.getSourceImage() as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
        (object.x - bounds.left) * scale - w / 2, (object.y - bounds.top) * scale - h, w, h);
    }
  }
  if (texture.has('area')) texture.remove('area');
  texture.add('area', 0, 0, 0, width, height); texture.refresh();
  const preview = { key: KEY, frame: 'area', bounds, width, height };
  cache.set(scene, { map, preview });
  return preview;
}
