import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import perimeter from '../assets/village/rowen/perimeter.webp?url';
import perimeterFrames from '../assets/village/rowen/perimeter.json';
import { PERIMETER_TEXTURE, perimeterPieces } from './villagePerimeter';
import { preloadEastPass } from './eastPassArt';
import ground from '../assets/village/ground.webp?url';
import buildings from '../assets/village/rowen/buildings.webp?url';
import buildingFrames from '../assets/village/rowen/buildings.json';
import props from '../assets/village/props.png?url';
import frames from '../assets/village/frames.json';
import { WalkArea } from './walkArea';
import { addGroundImage, drawFieldArt, mapArtKey, preloadMapArt } from './mapArt';
import { drawInterior } from './interiorArt';
import { mapObstacles, mapPolygon, type GameMap } from './maps';

const FONT = 'system-ui, "Noto Sans KR", sans-serif';

export function preloadVillage(scene: Phaser.Scene, map: GameMap): void {
  preloadMapArt(scene, map);
  if (map.id === 'east-pass') preloadEastPass(scene);
  if (perimeterPieces(map.id).length && !scene.textures.exists(PERIMETER_TEXTURE)) scene.load.image(PERIMETER_TEXTURE, perimeter);
  for (const [key, url] of [['village-ground', ground], ['village-buildings', buildings], ['village-props', props]]) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/**
 * 맵 하나를 그린다. 지면, 건물, 소품을 따로 두어 바닥 접점과 충돌 영역이 일치하게 한다.
 * 건물 이름은 지붕 위에 띄운다. 마을 사람(NPC)은 씬이 따로 만든다.
 * 남쪽 들판은 전용 원화, 숲길·개울가는 공용 지면과 소품을 쓴다.
 */
export function buildMap(scene: Phaser.Scene, map: GameMap): WalkArea {
  if (map.interior) {
    drawInterior(scene, map.interior);
    return new WalkArea(mapPolygon(map), mapObstacles(map));
  }
  for (const f of frames.frames) {
    if (!scene.textures.exists(f.texture)) continue; // 예전 집 그림(home.png)은 로웬 마을 건물로 바뀌었다.
    const texture = scene.textures.get(f.texture);
    if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  if (map.buildings.length > 0) {
    const buildingTexture = scene.textures.get('village-buildings');
    for (const f of buildingFrames.frames) {
      if (!buildingTexture.has(f.name)) buildingTexture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
  }
  if (scene.textures.exists(mapArtKey(map.id))) drawFieldArt(scene, map);
  else {
    const floor = addGroundImage(scene, { key: 'village-ground', x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT });
    if (map.groundTint !== undefined) floor.setTint(map.groundTint);
    if (map.water) drawWater(scene, map.water.top, map.water.bottom);
  }

  if (perimeterPieces(map.id).length) {
    const texture = scene.textures.get(PERIMETER_TEXTURE);
    for (const f of perimeterFrames.frames) if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    for (const p of perimeterPieces(map.id)) scene.add.image(p.x, p.y, PERIMETER_TEXTURE, p.frame)
      .setOrigin(.5, 1).setDisplaySize(p.width, p.height).setDepth(p.y).setName(p.name);
  }
  for (const p of map.props) {
    const texture = scene.textures.get(p.texture ?? 'village-props');
    const image = scene.add.image(p.x, p.y, texture.key, texture.has(p.frame) ? p.frame : '__BASE').setOrigin(.5, 1).setDepth(p.y).setName(`village-prop-${p.frame}`);
    image.setScale(p.width / image.width);
  }
  for (const b of map.buildings) {
    const image = scene.add.image(b.x, b.y, 'village-buildings', b.frame).setOrigin(.5, 1).setDepth(b.y);
    image.setScale(b.width / image.width);
    if (b.label) {
      scene.add.text(b.x, b.y - image.displayHeight - 4, b.label, {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold',
        color: '#ffe6b5', stroke: '#392416', strokeThickness: 4,
      }).setOrigin(.5, 0).setDepth(b.y + 1).setResolution(2);
    }
  }


  return new WalkArea(mapPolygon(map), mapObstacles(map));
}


/** 개울: 걸을 수 있는 영역 위쪽에 물결 띠를 그린다. 그림이 생기면 바꾼다. */
function drawWater(scene: Phaser.Scene, top: number, bottom: number): void {
  const g = scene.add.graphics().setDepth(-90);
  const wave = (x: number, phase: number) => Math.sin(x / 140 + phase) * 14;
  const band = (y0: number, y1: number, color: number, alpha: number, phase: number) => {
    const points: Phaser.Math.Vector2[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 40) points.push(new Phaser.Math.Vector2(x, y0 + wave(x, phase)));
    for (let x = WORLD_WIDTH; x >= 0; x -= 40) points.push(new Phaser.Math.Vector2(x, y1 + wave(x, phase + 1.7)));
    g.fillStyle(color, alpha);
    g.fillPoints(points, true);
  };
  band(top - 18, bottom + 12, 0x7a6a4a, 0.55, 0);
  band(top, bottom, 0x4f9fc4, 1, 0.4);
  band(top + 30, bottom - 40, 0x6fbedc, 0.8, 1.1);
  g.lineStyle(3, 0xd9f2ff, 0.55);
  for (let row = top + 45; row < bottom - 30; row += 38) {
    for (let x = 60; x < WORLD_WIDTH; x += 260) {
      g.beginPath();
      g.arc(x + (row % 3) * 70, row, 26, Math.PI * 1.1, Math.PI * 1.9);
      g.strokePath();
    }
  }
}
