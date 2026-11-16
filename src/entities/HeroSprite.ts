import Phaser from 'phaser';
import type { Blade } from '../combat/blade';
import data from '../assets/hero/academy/frames.json';
import walkSheet from '../assets/hero/academy/unarmed/player_walk.webp?url';
import combatSheet from '../assets/hero/academy/unarmed/player_combat.webp?url';
import diagonalSheet from '../assets/hero/academy/unarmed/player_walk_diagonal.webp?url';
import attackDownSheet from '../assets/hero/academy/unarmed/player_attack_down.webp?url';
import attackUpSheet from '../assets/hero/academy/unarmed/player_attack_up.webp?url';
import weaponAtlas from '../assets/hero/weapons/atlas.json';
import weaponSheet from '../assets/hero/weapons/weapons.webp?url';
import { weaponId, weaponPose, type WeaponId } from './weaponPose';
import type { GearId } from '../items/equipment';
import { ACTION_DURATION, attackFacingFor, heroFrame, movementFacing, type AttackFacing, type Facing, type HeroAction } from './heroFrames';

export const HERO_SPRITE_HEIGHT = data.height;
interface SpriteFrame {
  name: string; texture: string; x: number; y: number; w: number; h: number;
  originX: number; originY: number; scale: number; blade: Blade | null;
}
const FRAMES = new Map<string, SpriteFrame>(data.frames.map((f) => [f.name, f]));

export function preloadHeroSprite(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero-weapons')) scene.load.image('hero-weapons', weaponSheet);
  if (!scene.textures.exists('hero-academy-walk')) scene.load.image('hero-academy-walk', walkSheet);
  if (!scene.textures.exists('hero-academy-combat')) scene.load.image('hero-academy-combat', combatSheet);
  if (!scene.textures.exists('hero-academy-diagonal')) scene.load.image('hero-academy-diagonal', diagonalSheet);
  if (!scene.textures.exists('hero-academy-attack-down')) scene.load.image('hero-academy-attack-down', attackDownSheet);
  if (!scene.textures.exists('hero-academy-attack-up')) scene.load.image('hero-academy-attack-up', attackUpSheet);
}

/** Clean body frames and detachable weapons share measured foot, hand and blade anchors. */
export class HeroSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  flipX = false;
  private readonly image: Phaser.GameObjects.Image;
  private readonly weaponBack: Phaser.GameObjects.Image;
  private readonly weaponFront: Phaser.GameObjects.Image;
  private weapon: WeaponId | null = 'wooden-sword';
  private animation: HeroAction = 'idle';
  private facing: Facing = 'down';
  private attackFacing: AttackFacing = 'right';
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
    const weapons = scene.textures.get('hero-weapons');
    for (const f of weaponAtlas.frames) if (!weapons.has(f.name)) weapons.add(f.name, 0, f.x, f.y, f.w, f.h);
    this.weaponBack = scene.add.image(0, 0, 'hero-weapons', 'wooden-sword-grip');
    this.weaponFront = scene.add.image(0, 0, 'hero-weapons', 'wooden-sword-blade');
    this.image = scene.add.image(0, 0, 'hero-academy-walk', 'walk-0');
    this.add([this.weaponBack, this.image, this.weaponFront]);
    this.applyFrame();
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
    this.attackFacing = attackFacingFor(this.facing, this.flipX ? -1 : 1);
    this.applyFrame();
  }

  get lookDirection(): Facing { return this.facing; }

  setAttackFacing(facing: AttackFacing): void {
    this.attackFacing = facing;
    this.facing = facing;
    this.applyFrame();
  }

  setFlipX(flip: boolean): this {
    this.flipX = flip;
    this.applyFrame();
    return this;
  }

  setWeapon(id: GearId | undefined): void {
    this.weapon = weaponId(id);
    this.applyWeapon();
  }

  setTint(color: number): this { for (const part of this.parts) part.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { for (const part of this.parts) part.setTintMode(mode); return this; }
  clearTint(): this { for (const part of this.parts) part.clearTint(); return this; }
  private get parts(): Phaser.GameObjects.Image[] { return [this.weaponBack, this.image, this.weaponFront]; }

  getBlade(): Blade {
    if (!this.weapon || !this.frame.blade) {
      const f = this.frame, p = f.blade?.base ?? { x: f.originX * f.w, y: f.h };
      const point = this.image.getWorldTransformMatrix().transformPoint(p.x - f.originX * f.w, p.y - f.originY * f.h);
      return { base: { x: point.x, y: point.y }, tip: { x: point.x, y: point.y } };
    }
    const matrix = this.weaponFront.getWorldTransformMatrix();
    return { base: matrix.transformPoint(0, 0), tip: matrix.transformPoint(weaponAtlas.bladeLength, 0) };
  }

  spawnGhost(x: number, y: number, depth: number, tint: number, alpha: number,
    reuse?: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const ghost = reuse ?? this.scene.add.container();
    ghost.setPosition(x, y).setDepth(depth).setAlpha(alpha).setActive(true).setVisible(true)
      .setScale(this.scaleX, this.scaleY).setAngle(this.angle);
    this.parts.forEach((part, i) => {
      const copy = reuse ? ghost.getAt(i) as Phaser.GameObjects.Image : this.scene.add.image(0, 0, part.texture.key, part.frame.name);
      copy.setTexture(part.texture.key, part.frame.name).setPosition(part.x, part.y)
        .setOrigin(part.originX, part.originY).setScale(part.scaleX, part.scaleY)
        .setRotation(part.rotation).setTint(tint).setVisible(part.visible);
      if (!reuse) ghost.add(copy);
    });
    return ghost;
  }

  /**
   * 그림을 deltaMs만큼 진행한다. 씬이 게임 시계의 흐름(느린 화면·히트스톱·일시정지 반영)으로 부른다.
   * 실제 시간으로 진행하면 느린 화면에서 공격 그림이 타격 시점보다 먼저 끝나 공격이 빗나간다.
   */
  advance(delta: number): void {
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
    const attacking = this.animation.startsWith('attack');
    const frame = FRAMES.get(heroFrame(this.animation, attacking ? this.attackFacing : this.facing, this.time))!;
    const mirrored = attacking ? this.attackFacing.includes('left') : this.animation === 'dodge' && this.flipX;
    this.frame = frame;
    this.image.setTexture(frame.texture, frame.name).setOrigin(frame.originX, frame.originY)
      .setScale(frame.scale * (mirrored ? -1 : 1), frame.scale);
    this.applyWeapon();
  }

  private applyWeapon(): void {
    this.weaponFront.setVisible(!!this.weapon);
    const pose = weaponPose(this.frame);
    this.weaponBack.setVisible(!!this.weapon && !pose.sheathed);
    if (!this.weapon) return;
    const f = this.frame, { base, tip } = pose.blade;
    const x = (base.x - f.originX * f.w) * this.image.scaleX;
    const y = (base.y - f.originY * f.h) * this.image.scaleY;
    const dx = (tip.x - base.x) * this.image.scaleX, dy = (tip.y - base.y) * this.image.scaleY;
    const scale = Math.hypot(dx, dy) / weaponAtlas.bladeLength;
    const apply = (image: Phaser.GameObjects.Image, part: string) => {
      const name = `${this.weapon}-${part}`, meta = weaponAtlas.frames.find(f => f.name === name)!;
      image.setTexture('hero-weapons', name).setOrigin(meta.originX, meta.originY)
        .setPosition(x, y).setRotation(Math.atan2(dy, dx)).setScale(scale);
    };
    apply(this.weaponFront, pose.sheathed ? 'hilt' : 'blade');
    apply(this.weaponBack, 'grip');
  }
}
