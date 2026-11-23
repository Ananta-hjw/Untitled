import Phaser from 'phaser';
import { preloadFestival } from '../scenes/FestivalStage';
import { PASS_FIRE, PASS_SHELTER } from './eastPass';
import tree from '../assets/maps/east-pass/dead-tree.webp?url';
import cliff from '../assets/maps/east-pass/cliff-straight.webp?url';
import corner from '../assets/maps/east-pass/cliff-corner.webp?url';
import shelter from '../assets/maps/east-pass/stone-shelter.webp?url';

export function preloadEastPass(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries({ 'dead-tree': tree, 'cliff-straight': cliff, 'cliff-corner': corner, 'stone-shelter': shelter })) {
    if (!scene.textures.exists(`east-pass-${key}`)) scene.load.image(`east-pass-${key}`, url);
  }
  preloadFestival(scene);
}

/** Independent campfire and roof transparency use the same paused game clock as NPCs. */
export class EastPassScenery {
  private readonly flame: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly shelter: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene) {
    const { x, y } = PASS_FIRE;
    scene.add.image(x, y, 'festival-props', 'bonfire-base').setOrigin(0.5, 0.7).setDisplaySize(80, 36).setDepth(y - 1).setName('pass-fire-base');
    this.flame = scene.add.image(x, y - 6, 'festival-props', 'flame-0').setOrigin(0.5, 1).setDisplaySize(48, 68).setDepth(y + 1).setName('pass-fire');
    this.glow = scene.add.graphics().setDepth(y + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.shelter = scene.children.getByName('village-prop-stone-shelter') as Phaser.GameObjects.Image;
  }
  update(time: number, player: { x: number; y: number }): void {
    this.flame.setFrame(`flame-${Math.floor(time / 110) % 4}`).setDisplaySize(48, 66 + Math.sin(time / 90) * 3);
    this.glow.clear().fillStyle(0xffb958, 0.045 + Math.sin(time / 180) * 0.008).fillEllipse(PASS_FIRE.x, PASS_FIRE.y - 10, 130, 65);
    const underRoof = Math.abs(player.x - PASS_SHELTER.x) < 195 && player.y > 1260 && player.y < 1420;
    this.shelter.setAlpha(underRoof ? 0.35 : 1);
  }
}
