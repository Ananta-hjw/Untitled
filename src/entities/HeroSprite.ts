import Phaser from 'phaser';
import type { Blade } from '../combat/blade';
import data from '../assets/hero/academy/frames.json';
import walkSheet from '../assets/hero/academy/player_walk.png?inline';
import combatSheet from '../assets/hero/academy/player_combat.png?inline';
import { ACTION_DURATION, heroFrame, movementFacing, type Facing, type HeroAction } from './heroFrames';

export const HERO_SPRITE_HEIGHT = data.height;
interface SpriteFrame {
  name: string; texture: string; x: number; y: number; w: number; h: number;
  originX: number; originY: number; scale: number; blade: Blade | null;
}
const FRAMES = new Map<string, SpriteFrame>(data.frames.map((f) => [f.name, f]));

export function preloadHeroSprite(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero-academy-walk')) scene.load.image('hero-academy-walk', walkSheet);
  if (!scene.textures.exists('hero-academy-combat')) scene.load.image('hero-academy-combat', combatSheet);
}

/** Whole-character frames keep the academy artwork intact, with measured foot and sword anchors. */
export class HeroSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  flipX = false;
  private readonly image: Phaser.GameObjects.Image;
  private animation: HeroAction = 'idle';
  private facing: Facing = 'down';
  private time = 0;
  private finished = false;
  private moving = false;
  private frame!: SpriteFrame;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    for (const f of FRAMES.values()) {
      const texture = scene.textures.get(f.texture);
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    this.image = scene.add.image(0, 0, 'hero-academy-walk', 'walk-0');
    this.add(this.image);
    this.applyFrame();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
    });
  }

  play(key: string): this {
    const name = key.slice(key.lastIndexOf('-') + 1) as HeroAction;
    if (!['idle', 'walk', 'attack1', 'attack2', 'attack3', 'dodge'].includes(name)) return this;
    this.animation = name;
    this.time = 0;
    this.finished = false;
    this.applyFrame();
    return this;
  }

  setMovement(dx: number, dy: number): void {
    if (this.animation !== 'idle' && this.animation !== 'walk') return;
    const next = movementFacing(dx, dy, this.facing, this.moving);
    this.moving = Math.abs(dx) + Math.abs(dy) >= 0.001;
    if (next !== this.facing) { this.facing = next; this.time = 0; }
    this.applyFrame();
  }

  setFlipX(flip: boolean): this {
    this.flipX = flip;
    this.applyFrame();
    return this;
  }

  setTint(color: number): this { this.image.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { this.image.setTintMode(mode); return this; }
  clearTint(): this { this.image.clearTint(); return this; }

  getBlade(): Blade {
    const f = this.frame;
    const matrix = this.image.getWorldTransformMatrix();
    const point = (p: { x: number; y: number }) => matrix.transformPoint(
      p.x - f.originX * f.w, p.y - f.originY * f.h,
    );
    const blade = f.blade ?? { base: { x: f.originX * f.w, y: f.h }, tip: { x: f.originX * f.w, y: f.h } };
    return { base: point(blade.base), tip: point(blade.tip) };
  }

  spawnGhost(x: number, y: number, depth: number, tint: number, alpha: number,
    reuse?: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const ghost = reuse ?? this.scene.add.container();
    ghost.setPosition(x, y).setDepth(depth).setAlpha(alpha).setActive(true).setVisible(true)
      .setScale(this.scaleX, this.scaleY).setAngle(this.angle);
    const copy = reuse ? ghost.getAt(0) as Phaser.GameObjects.Image : this.scene.add.image(0, 0, this.frame.texture, this.frame.name);
    copy.setTexture(this.frame.texture, this.frame.name).setPosition(this.image.x, this.image.y)
      .setOrigin(this.image.originX, this.image.originY).setScale(this.image.scaleX, this.image.scaleY)
      .setAngle(this.image.angle).setTint(tint);
    if (!reuse) ghost.add(copy);
    return ghost;
  }

  private onSceneUpdate(_time: number, delta: number): void {
    if (!this.active) return;
    const loop = this.animation === 'idle' || this.animation === 'walk';
    this.time += Math.max(0, Math.min(delta, 50)) * (loop ? this.anims.timeScale : 1);
    let complete = false;
    if (!loop && this.time + 1e-6 >= ACTION_DURATION[this.animation as keyof typeof ACTION_DURATION] && !this.finished) {
      this.finished = true;
      complete = this.animation !== 'dodge';
    }
    this.applyFrame();
    if (complete) this.emit(Phaser.Animations.Events.ANIMATION_COMPLETE);
  }

  private applyFrame(): void {
    const frame = FRAMES.get(heroFrame(this.animation, this.facing, this.time))!;
    const action = this.animation !== 'idle' && this.animation !== 'walk';
    this.frame = frame;
    this.image.setTexture(frame.texture, frame.name).setOrigin(frame.originX, frame.originY)
      .setScale(frame.scale * (action && this.flipX ? -1 : 1), frame.scale);
  }
}
