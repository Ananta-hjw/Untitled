import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import ground from '../assets/village/ground.png?url';
import home from '../assets/village/home.png?url';
import props from '../assets/village/props.png?url';
import frames from '../assets/village/frames.json';
import { WalkArea } from './walkArea';
import { HOME, OBSTACLES, PROPS, WALK_BOUNDS } from './villageLayout';

export { ENEMY_SPAWNS, PLAYER_SPAWN } from './villageLayout';

export interface Village { walkArea: WalkArea }

export function preloadVillage(scene: Phaser.Scene): void {
  for (const [key, url] of [['village-ground', ground], ['village-home', home], ['village-props', props]]) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/** Ground, buildings, and scenery are separate so their ground footprints match collision. */
export function buildVillage(scene: Phaser.Scene): Village {
  for (const f of frames.frames) {
    const texture = scene.textures.get(f.texture);
    if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  scene.add.image(0, 0, 'village-ground').setOrigin(0).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(-100);
  for (const p of PROPS) {
    const image = scene.add.image(p.x, p.y, 'village-props', p.frame).setOrigin(.5, 1).setDepth(p.y);
    image.setScale(p.width / image.width);
  }
  const house = scene.add.image(HOME.x, HOME.y, 'village-home', 'home').setOrigin(.5, 1).setDepth(HOME.y);
  house.setScale(Math.min(HOME.width / house.width, HOME.height / house.height));
  scene.add.text(HOME.x - 8, HOME.y - house.displayHeight * .48, '주인공의 집', {
    fontFamily: 'system-ui, "Noto Sans KR", sans-serif', fontSize: '18px', fontStyle: 'bold',
    color: '#ffe6b5', stroke: '#392416', strokeThickness: 4,
  }).setOrigin(.5).setDepth(HOME.y + 1).setResolution(2);
  const b = WALK_BOUNDS;
  return { walkArea: new WalkArea([b.left, b.top, b.right, b.top, b.right, b.bottom, b.left, b.bottom], OBSTACLES) };
}
