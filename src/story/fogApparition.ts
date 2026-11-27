import type Phaser from 'phaser';
import sheetUrl from '../assets/chapter2/sia-apparition/wave-and-dissolve.webp?url';
import sheet from '../assets/chapter2/sia-apparition/wave-and-dissolve-frames.json';
import bellUrl from '../assets/chapter2/shrine-bell.webp?url';
import type { Interactable } from '../world/interactables';

const KEY = 'chapter2-sia-apparition';
const BELL = 'chapter2-shrine-bell';
export const SIA_APPARITION_SPOT: Interactable = {
  id: 'fog-sia-apparition', x: 285, y: 753, radius: 118, markerHeight: 173, dialogue: 'fog-sia-illusion',
};
export const SHRINE_BELL_SPOT: Interactable = {
  id: 'fog-shrine-bell', x: 872, y: 760, radius: 116, markerHeight: 177,
};

export function preloadFogEncounter(scene: Phaser.Scene): void {
  if (!scene.textures.exists(KEY)) scene.load.image(KEY, sheetUrl);
  if (!scene.textures.exists(BELL)) scene.load.image(BELL, bellUrl);
}

export function placePreviewBell(scene: Phaser.Scene): void {
  const { x, y } = SHRINE_BELL_SPOT;
  scene.add.image(x, y, BELL).setOrigin(0.5, 0.95).setScale(0.30).setDepth(y).setName(BELL);
}

export class FogApparition {
  private startedAt?: number;
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, readonly spot: Interactable) {
    const texture = scene.textures.get(KEY);
    for (const f of sheet.frames) {
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    const first = sheet.frames[0];
    this.image = scene.add.image(spot.x, spot.y, KEY, first.name).setOrigin(first.originX, first.originY)
      .setScale(0.55).setDepth(spot.y).setName(KEY);
  }

  dissolve(now: number): void { this.startedAt ??= now; }

  update(now: number): void {
    if (this.startedAt === undefined || !this.image.visible) return;
    const index = Math.floor((now - this.startedAt) * sheet.fps / 1000);
    if (index < sheet.frames.length) this.image.setFrame(sheet.frames[index].name);
    else this.image.setVisible(false);
  }
}
