import type Phaser from 'phaser';
import type { StoryFrame } from '../entities/npcStoryActions';

const ART_URLS = import.meta.glob<string>('../assets/chapter2/{bell-carry.webp,rescue/*/cocoon-rescue.webp}',
  { eager: true, query: '?url', import: 'default' });
const ART_FRAMES = import.meta.glob<{ frames: StoryFrame[]; bodyHeight?: number; fps?: number }>(
  '../assets/chapter2/{bell-carry-frames.json,rescue/*/cocoon-rescue-frames.json}', { eager: true, import: 'default' });

export type FerryArtPreview = 'rescue' | 'bell-carry';

function previewSheets(group: FerryArtPreview): string[] {
  if (group === 'bell-carry') return ['../assets/chapter2/bell-carry'];
  return ['missing-fisher', 'herbalist-husband', 'millers-brother', 'martas-son-in-law']
    .map(id => `../assets/chapter2/rescue/${id}/cocoon-rescue`);
}

export function preloadFerryArtPreview(scene: Phaser.Scene, group: FerryArtPreview): void {
  for (const sheet of previewSheets(group)) {
    if (!scene.textures.exists(sheet)) scene.load.image(sheet, ART_URLS[`${sheet}.webp`]);
  }
}

export function drawFerryArtPreview(scene: Phaser.Scene, group: FerryArtPreview, at: { x: number; y: number }): void {
  const sheets = previewSheets(group);
  sheets.forEach((sheet, i) => {
    const data = ART_FRAMES[`${sheet}-frames.json`];
    const texture = scene.textures.get(sheet);
    for (const f of data.frames) {
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    const y = at.y - 180;
    const image = scene.add.image(at.x + (i - (sheets.length - 1) / 2) * 190, y, sheet)
      .setDepth(y).setScale(data.bodyHeight ? 142 / data.bodyHeight : 0.38);
    let pose = 0;
    const show = () => {
      const f = data.frames[pose];
      image.setFrame(f.name).setOrigin(f.originX, f.originY);
    };
    show();
    const advance = () => {
      pose = (pose + 1) % data.frames.length;
      show();
      const delay = group === 'rescue' && (pose === 0 || pose === data.frames.length - 1)
        ? 1400 : 1000 / (data.fps ?? 3);
      scene.time.delayedCall(delay, advance);
    };
    scene.time.delayedCall(group === 'rescue' ? 1400 : 1000 / (data.fps ?? 3), advance);
  });
}
