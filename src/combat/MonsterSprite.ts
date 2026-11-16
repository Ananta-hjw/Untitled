import Phaser from 'phaser';
import { MONSTERS, monsterKind, type EnemyKey, type MonsterKind } from './monsterTypes';
import { direction8, type Direction8 } from '../world/npcs';

interface Frame {
  name: string; animation: string; direction: string; pose: number; sheet: string;
  x: number; y: number; w: number; h: number; originX: number; originY: number; scale: number;
}
interface FrameData { frames: Frame[]; bounds: { top: number; bottom: number }; sheets: Record<string, { width: number; height: number }> }
const DATA = import.meta.glob<FrameData>('../assets/monsters/*/animation_frames.json', { eager: true, import: 'default' });
const URLS = import.meta.glob<string>('../assets/monsters/*/*.webp', { eager: true, query: '?url', import: 'default' });
const keyFor = (kind: MonsterKind, sheet: string) => `monster-${kind}-${sheet.replace('.png', '')}`;
const frameData = (kind: MonsterKind) => DATA[`../assets/monsters/${kind}/animation_frames.json`];

/** Load only species that inhabit the current map; textures are reused on revisits. */
export function preloadMonsters(scene: Phaser.Scene, spawns: readonly { key: EnemyKey }[]): void {
  const kinds = new Set(spawns.map(s => monsterKind(s.key)).filter((k): k is MonsterKind => !!k));
  for (const kind of kinds) {
    for (const sheet of Object.keys(frameData(kind).sheets)) {
      const key = keyFor(kind, sheet);
      if (!scene.textures.exists(key)) scene.load.image(key, URLS[`../assets/monsters/${kind}/${sheet.replace('.png', '.webp')}`]);
    }
    if (kind === 'waterdrop-mushroom' && !scene.textures.exists('monster-water-shot')) {
      scene.load.image('monster-water-shot', URLS['../assets/monsters/waterdrop-mushroom/projectile.webp']);
    }
  }
}

/** Whole-character artwork with a fixed measured pivot; effects scale the outer container. */
export class MonsterSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  private readonly image: Phaser.GameObjects.Image;
  private readonly frames: Map<string, Frame>;
  private readonly scale0: number;
  private direction: Direction8 = 'down';
  private motion: 'idle' | 'walk' = 'idle';
  private elapsed = 0;
  private attackPose?: number;

  constructor(scene: Phaser.Scene, readonly kind: MonsterKind) {
    super(scene, 0, 0);
    const data = frameData(kind);
    this.frames = new Map(data.frames.map(f => [f.name, f]));
    for (const f of data.frames) {
      const texture = scene.textures.get(keyFor(kind, f.sheet));
      const source = data.sheets[f.sheet];
      const sx = texture.getSourceImage().width / source.width;
      const sy = texture.getSourceImage().height / source.height;
      if (!texture.has(f.name)) texture.add(f.name, 0, Math.round(f.x * sx), Math.round(f.y * sy),
        Math.round((f.x + f.w) * sx) - Math.round(f.x * sx), Math.round((f.y + f.h) * sy) - Math.round(f.y * sy));
    }
    const idleHeight = Math.max(...data.frames.filter(f => f.animation === 'walk' && f.pose === 0).map(f => f.h * f.scale));
    this.scale0 = MONSTERS[kind].height / idleHeight;
    this.image = scene.add.image(0, 0, keyFor(kind, 'walk_cardinal.png'));
    this.add(this.image);
    this.showFrame();
  }

  play(key: string): this {
    this.motion = key.endsWith('-walk') ? 'walk' : 'idle';
    this.elapsed = 0;
    this.attackPose = undefined;
    this.showFrame();
    return this;
  }
  setMovement(dx: number, dy: number): void {
    this.direction = direction8(dx, dy, this.direction);
    this.showFrame();
  }
  // Character.face is horizontal compatibility; real direction comes from setMovement.
  setFlipX(_flip: boolean): this { return this; }
  setTint(color: number): this { this.image.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { this.image.setTintMode(mode); return this; }
  clearTint(): this { this.image.clearTint(); return this; }
  advance(deltaMs: number): void { this.elapsed += deltaMs * this.anims.timeScale; this.showFrame(); }
  showAttack(elapsed: number, windup: number, strike: number, recovery: number): void {
    this.attackPose = elapsed < windup ? 1 : elapsed < windup + strike ? 2 : elapsed < windup + strike + recovery ? 3 : undefined;
    this.showFrame();
  }
  endStrike(): void { this.attackPose = undefined; this.showFrame(); }

  private showFrame(): void {
    const pose = this.attackPose ?? (this.motion === 'walk' ? [1, 2, 3, 2][Math.floor(this.elapsed / 125) % 4] : 0);
    const f = this.frames.get(`${this.attackPose === undefined ? 'walk' : 'attack'}-${this.direction}-${pose}`)!;
    const texture = this.scene.textures.get(keyFor(this.kind, f.sheet));
    const source = frameData(this.kind).sheets[f.sheet];
    const sx = texture.getSourceImage().width / source.width, sy = texture.getSourceImage().height / source.height;
    this.image.setTexture(texture.key, f.name).setOrigin(f.originX, f.originY)
      .setScale(this.scale0 * f.scale / sx, this.scale0 * f.scale / sy);
  }
}
