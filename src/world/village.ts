import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import ground from '../assets/village/ground.png?url';
import buildings from '../assets/village/rowen/buildings.webp?url';
import buildingFrames from '../assets/village/rowen/buildings.json';
import props from '../assets/village/props.png?url';
import frames from '../assets/village/frames.json';
import { WalkArea } from './walkArea';
import { drawInterior } from './interiorArt';
import { mapObstacles, mapPolygon, type GameMap } from './maps';

const FONT = 'system-ui, "Noto Sans KR", sans-serif';

export function preloadVillage(scene: Phaser.Scene): void {
  for (const [key, url] of [['village-ground', ground], ['village-buildings', buildings], ['village-props', props]]) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/**
 * 맵 하나를 그린다. 지면, 건물, 소품을 따로 두어 바닥 접점과 충돌 영역이 일치하게 한다.
 * 건물 이름은 지붕 위에 띄운다. 마을 사람(NPC)은 씬이 따로 만든다.
 * 사냥터는 아직 전용 그림이 없어서 마을의 지면과 소품을 다른 배치·색조로 다시 쓴다.
 */
export function buildMap(scene: Phaser.Scene, map: GameMap): WalkArea {
  for (const f of frames.frames) {
    if (!scene.textures.exists(f.texture)) continue; // 예전 집 그림(home.png)은 로웬 마을 건물로 바뀌었다.
    const texture = scene.textures.get(f.texture);
    if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  const buildingTexture = scene.textures.get('village-buildings');
  for (const f of buildingFrames.frames) {
    if (!buildingTexture.has(f.name)) buildingTexture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  // 건물 실내는 바닥·벽·가구를 따로 그린다.
  if (map.interior) {
    drawInterior(scene, map.interior);
    drawExitLabels(scene, map);
    return new WalkArea(mapPolygon(map), mapObstacles(map));
  }
  const floor = scene.add.image(0, 0, 'village-ground').setOrigin(0).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(-100);
  if (map.groundTint !== undefined) floor.setTint(map.groundTint);
  if (map.water) drawWater(scene, map.water.top, map.water.bottom);

  for (const p of map.props) {
    const image = scene.add.image(p.x, p.y, 'village-props', p.frame).setOrigin(.5, 1).setDepth(p.y);
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

  drawExitLabels(scene, map);

  return new WalkArea(mapPolygon(map), mapObstacles(map));
}


function drawExitLabels(scene: Phaser.Scene, map: GameMap): void {
  // 출구 표시: 바닥에 깔리는 글자라 캐릭터보다 아래에 그린다. 건물(입구 아치) 앞에 있으면 건물 위에 그린다.
  for (const exit of map.exits) {
    const covered = map.buildings.some((b) => Math.abs(b.x - exit.labelAt.x) < b.width / 2 && b.y > exit.labelAt.y);
    scene.add.text(exit.labelAt.x, exit.labelAt.y, exit.label, {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: '#fff4d6', stroke: '#3a2614', strokeThickness: 5,
    }).setOrigin(.5).setDepth(covered ? WORLD_HEIGHT + 10 : -50).setResolution(2).setAlpha(.9);
  }

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
