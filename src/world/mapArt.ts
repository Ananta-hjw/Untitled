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
import field from '../assets/maps/south-field/ground.webp?url';
import swamp from '../assets/maps/reed-swamp/ground.webp?url';
import passAssets from '../assets/maps/east-pass/assets.json';
import ferryGround from '../assets/maps/ferry-village/ground.json';
import type { GameMap } from './maps';

const URLS: Record<string, string> = { home, linea, chief, clinic, hall, store, smithy, inn, 'south-field': field, 'reed-swamp': swamp };
export const mapArtKey = (id: string): string => `map-art-${id}`;
const tileUrls = import.meta.glob<string>('../assets/maps/{east-pass,ferry-village}/ground-*.webp', { eager: true, query: '?url', import: 'default' });
interface GroundPiece { key: string; x: number; y: number; width: number; height: number }

const tiledGround = new Map(Object.entries({ 'east-pass': passAssets.ground, 'ferry-village': ferryGround })
  .map(([id, { sourceWidth, sourceHeight, tiles }]) => [id, {
    sourceWidth, sourceHeight,
    tiles: tiles.map(({ file, ...bounds }, index) => ({
      ...bounds, key: index === 0 ? mapArtKey(id) : `${mapArtKey(id)}-${index}`,
      url: tileUrls[`../assets/maps/${id}/${file}`],
    })),
  }] as const));

/** 입장하는 맵만 다운로드한다. 이미 방문한 텍스처는 씬 재시작에도 재사용한다. */
export function preloadMapArt(scene: Phaser.Scene, map: GameMap): void {
  const ground = tiledGround.get(map.id);
  if (ground) {
    for (const { key, url } of ground.tiles) if (!scene.textures.exists(key)) scene.load.image(key, url);
    return;
  }
  const id = map.interior?.id ?? map.id, url = URLS[id];
  if (url && !scene.textures.exists(mapArtKey(id))) scene.load.image(mapArtKey(id), url);
}

export function fieldArtPieces(map: GameMap): readonly GroundPiece[] {
  const { left, top, right, bottom } = outdoorArtBounds(map);
  const width = right - left, height = bottom - top;
  const ground = tiledGround.get(map.id);
  if (!ground) return [{ key: mapArtKey(map.id), x: left, y: top, width, height }];
  if (ground.sourceWidth !== width || ground.sourceHeight !== height) {
    throw new Error(`Map ground ${map.id} must match its ${width}×${height} world bounds`);
  }
  return ground.tiles.map(tile => ({ ...tile, x: tile.x + left, y: tile.y + top }));
}

/** A terrain image covers one world pixel per texture pixel. */
export function addGroundImage(scene: Phaser.Scene, { key, x, y, width, height }: GroundPiece) {
  const frame = scene.textures.getFrame(key);
  if (!frame || frame.cutWidth !== width || frame.cutHeight !== height) {
    throw new Error(`Map ground ${key} must be ${width}×${height} pixels`);
  }
  return scene.add.image(x, y, key).setOrigin(0).setDepth(-100).setName('map-art-background');
}

export function drawFieldArt(scene: Phaser.Scene, map: GameMap): void {
  for (const piece of fieldArtPieces(map)) addGroundImage(scene, piece);
}
