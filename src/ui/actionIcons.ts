import type Phaser from 'phaser';

export type ActionIcon = 'attack' | 'dodge' | 'block' | 'talk' | 'enter' | 'exit' | 'inspect' | 'rest' | 'heal' | 'resonance';
const PATHS: Record<ActionIcon, string[]> = {
  resonance: ['M32 21 L36 28 L43 32 L36 36 L32 43 L28 36 L21 32 L28 28 Z',
    'M24 13 A21 21 0 0 0 13 24 M40 13 A21 21 0 0 1 51 24 M13 40 A21 21 0 0 0 24 51 M51 40 A21 21 0 0 1 40 51',
    'M32 5 L32 10 M5 32 L10 32 M54 32 L59 32 M32 54 L32 59'],
  attack: ['M22 40 L44 12 L54 8 L52 19 L30 46 Z', 'M17 34 L35 49 M22 44 L12 55 M9 51 L16 58'],
  dodge: ['M27 12 L39 12 L36 31 L48 43 Q51 51 44 52 L24 52 Q19 52 20 46 L25 32 Z', 'M8 22 L20 22 M5 31 L17 31 M9 40 L18 40', 'M43 16 L57 16 L52 11 M57 16 L52 21'],
  block: ['M32 7 L53 15 L50 36 Q46 49 32 57 Q18 49 14 36 L11 15 Z', 'M32 16 L32 46 M22 29 L42 29'],
  talk: ['M10 13 Q7 13 7 20 L7 39 Q7 46 15 46 L21 46 L18 56 L34 46 L49 46 Q57 46 57 39 L57 20 Q57 13 49 13 Z', 'M19 29 L20 29 M31 29 L32 29 M43 29 L44 29'],
  enter: ['M27 8 L52 8 L52 56 L27 56 M47 33 L48 33', 'M5 32 L37 32 M28 23 L37 32 L28 41'],
  exit: ['M27 8 L52 8 L52 56 L27 56 M47 33 L48 33', 'M37 32 L5 32 M14 23 L5 32 L14 41'],
  inspect: ['M40 26 A16 16 0 1 1 8 26 A16 16 0 1 1 40 26 Z', 'M36 39 L53 56'],
  rest: ['M9 24 L9 55 M9 43 L55 43 L55 55 M10 35 L55 35 L55 43 M17 26 L28 26 L28 35 L17 35 Z'],
  heal: ['M24 9 L40 9 L40 24 L55 24 L55 40 L40 40 L40 55 L24 55 L24 40 L9 40 L9 24 L24 24 Z'],
};

/** Engraved gold-and-ivory symbols, rasterized once at 2× for sharp touch controls. */
export function createActionIcons(scene: Phaser.Scene): void {
  for (const [name, paths] of Object.entries(PATHS)) {
    const key = `action-icon-${name}`;
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, 128, 128);
    if (!texture) continue;
    const ctx = texture.context;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const metal = ctx.createLinearGradient(12, 8, 48, 57);
    metal.addColorStop(0, '#fff3ce'); metal.addColorStop(.35, '#e2c88d');
    metal.addColorStop(.6, '#b48c4b'); metal.addColorStop(1, '#f0dbab');
    const enamel = ctx.createLinearGradient(0, 10, 0, 55);
    enamel.addColorStop(0, '#b69a62'); enamel.addColorStop(.45, '#685337'); enamel.addColorStop(1, '#352b20');
    for (const path of paths) {
      const shape = new Path2D(path);
      ctx.shadowColor = '#080604'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
      ctx.strokeStyle = '#130f0a'; ctx.lineWidth = 4.5; ctx.stroke(shape);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (/Z\s*$/.test(path)) { ctx.fillStyle = enamel; ctx.fill(shape); }
      ctx.strokeStyle = metal; ctx.lineWidth = 2; ctx.stroke(shape);
    }
    // Inlaid details distinguish forged steel, shield facets and a speaking panel.
    const details: Partial<Record<ActionIcon, string>> = {
      attack: 'M28 38 L48 14 M20 40 L29 47',
      block: 'M19 20 L27 17 M19 23 L21 35 Q24 41 28 44',
      talk: 'M14 20 L47 20 M14 23 L14 34',
      resonance: 'M32 27 L37 32 L32 37 L27 32 Z',
    };
    const detail = details[name as ActionIcon];
    if (detail) {
      ctx.strokeStyle = '#fff1cd'; ctx.globalAlpha = .65; ctx.lineWidth = .8;
      ctx.stroke(new Path2D(detail)); ctx.globalAlpha = 1;
    }
    texture.refresh();
  }
}

export function actionIcon(name: ActionIcon): { texture: string; frame: string } {
  return { texture: `action-icon-${name}`, frame: '__BASE' };
}
