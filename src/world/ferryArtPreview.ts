import type Phaser from 'phaser';
import type { StoryFrame } from '../entities/npcStoryActions';
import boatUrl from '../assets/maps/ferry-village/objects/ferry-boat.webp?url';
import bedUrl from '../assets/maps/ferry-village/interiors/props/bed.webp?url';

const ART_URLS = import.meta.glob<string>([
  '../assets/chapter2/bell-carry.webp',
  '../assets/chapter2/rescue/*/{cocoon-rescue,boat-rest,sit-up,supported-stand}.webp',
], { eager: true, query: '?url', import: 'default' });
const ART_FRAMES = import.meta.glob<{ frames: StoryFrame[]; bodyHeight?: number; fps?: number }>([
  '../assets/chapter2/bell-carry-frames.json',
  '../assets/chapter2/rescue/*/{cocoon-rescue,sit-up,supported-stand}-frames.json',
], { eager: true, import: 'default' });

export type FerryArtPreview = 'rescue' | 'bell-carry' | 'rescue-aftermath';

const RESCUE_CAST = ['missing-fisher', 'herbalist-husband', 'millers-brother', 'martas-son-in-law', 'joan', 'toby'];
const FISHER_SIT = '../assets/chapter2/rescue/missing-fisher/sit-up';
const JOAN_STAND = '../assets/chapter2/rescue/joan/supported-stand';
const BOAT_KEY = 'rescue-aftermath-boat';
const BED_KEY = 'rescue-aftermath-bed';
const boatRest = (id: string) => `../assets/chapter2/rescue/${id}/boat-rest`;

function previewSheets(group: FerryArtPreview): string[] {
  if (group === 'bell-carry') return ['../assets/chapter2/bell-carry'];
  if (group === 'rescue-aftermath') return [...RESCUE_CAST.map(boatRest), FISHER_SIT, JOAN_STAND];
  return RESCUE_CAST.slice(0, 4).map(id => `../assets/chapter2/rescue/${id}/cocoon-rescue`);
}

export function preloadFerryArtPreview(scene: Phaser.Scene, group: FerryArtPreview): void {
  if (group === 'rescue-aftermath') {
    if (!scene.textures.exists(BOAT_KEY)) scene.load.image(BOAT_KEY, boatUrl);
    if (!scene.textures.exists(BED_KEY)) scene.load.image(BED_KEY, bedUrl);
  }
  for (const sheet of previewSheets(group)) {
    if (!scene.textures.exists(sheet)) scene.load.image(sheet, ART_URLS[`${sheet}.webp`]);
  }
}

export function drawFerryArtPreview(scene: Phaser.Scene, group: FerryArtPreview, at: { x: number; y: number }): void {
  if (group === 'rescue-aftermath') {
    const x = at.x, y = at.y - 290;
    scene.add.image(x, y, BOAT_KEY).setScale(585 / scene.textures.get(BOAT_KEY).getSourceImage().width)
      .setDepth(y).setName(BOAT_KEY);
    RESCUE_CAST.forEach((id, i) => {
      const actorX = x - 150 + i * 60, actorY = y + 73 - i * 33;
      scene.add.image(actorX, actorY, boatRest(id)).setScale(id === 'toby' ? 0.34 : 0.42)
        .setDepth(y + 1).setName(`rescue-aboard-${id}`);
    });

    const fisher = { x: x - 410, y: y + 32 };
    scene.add.image(fisher.x, fisher.y - 71, BED_KEY).setDisplaySize(126, 216)
      .setAngle(-45).setDepth(fisher.y - 1).setName(BED_KEY);
    drawFerryAnimation(scene, FISHER_SIT, fisher, 'rescue-fisher-sit-up', true);
    drawFerryAnimation(scene, JOAN_STAND, { x: x + 394, y: y + 15 }, 'rescue-joan-supported-stand', true);
    return;
  }
  const sheets = previewSheets(group);
  sheets.forEach((sheet, i) => drawFerryAnimation(scene, sheet,
    { x: at.x + (i - (sheets.length - 1) / 2) * 190, y: at.y - 180 }, sheet, group === 'rescue'));
}

function drawFerryAnimation(scene: Phaser.Scene, sheet: string, at: { x: number; y: number }, name: string, holdEnds: boolean): void {
  const data = ART_FRAMES[`${sheet}-frames.json`];
  const texture = scene.textures.get(sheet);
  for (const f of data.frames) {
    if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  const image = scene.add.image(at.x, at.y, sheet).setName(name)
    .setDepth(at.y).setScale(data.bodyHeight ? 142 / data.bodyHeight : 0.38);
  let pose = 0;
  const show = () => {
    const f = data.frames[pose];
    image.setFrame(f.name).setOrigin(f.originX, f.originY);
  };
  const next = () => {
    pose = (pose + 1) % data.frames.length;
    show();
    schedule();
  };
  const schedule = () => {
    const delay = holdEnds && (pose === 0 || pose === data.frames.length - 1) ? 1400 : 1000 / (data.fps ?? 3);
    scene.time.delayedCall(delay, next);
  };
  show();
  schedule();
}
