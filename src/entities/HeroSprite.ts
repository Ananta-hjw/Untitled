import Phaser from 'phaser';
import { HERO_BLADE_WIDTH_SCALE } from '../config';
import { guardMotion } from './guardMotion';
import type { Blade } from '../combat/blade';
import data from '../assets/hero/academy/frames.json';
import guardData from '../assets/hero/academy/guard/frames.json';
import guardSheet from '../assets/hero/academy/guard/bodies.webp?url';
import dodgeData from '../assets/hero/academy/dodge/frames.json';
import dodgeSheet from '../assets/hero/academy/dodge/cardinal.webp?url';
import attackFrontData from '../assets/hero/academy/combo-proto/attack-front_frames.json';
import attackFrontSheet from '../assets/hero/academy/combo-proto/attack-front.png?url';
import attackDownDiagData from '../assets/hero/academy/combo-proto/attack-down-diag_frames.json';
import attackDownDiagSheet from '../assets/hero/academy/combo-proto/attack-down-diag.png?url';
import attackCorrectionsData from '../assets/hero/academy/combo-proto/attack-corrections_frames.json';
import attackCorrectionsSheet from '../assets/hero/academy/combo-proto/attack-corrections.webp?url';
import attackSideData from '../assets/hero/academy/attack-six/attack-side_frames.json';
import attackSideSheet from '../assets/hero/academy/attack-six/attack-side.webp?url';
import { isAttackFollowPause } from './attackTiming';
import walkSheet from '../assets/hero/academy/unarmed/player_walk.webp?url';
import combatSheet from '../assets/hero/academy/unarmed/player_combat.webp?url';
import diagonalSheet from '../assets/hero/academy/unarmed/player_walk_diagonal.webp?url';
import attackDownSheet from '../assets/hero/academy/unarmed/player_attack_down.webp?url';
import attackUpSheet from '../assets/hero/academy/unarmed/player_attack_up.webp?url';
import weaponAtlas from '../assets/hero/weapons/atlas.json';
import weaponSheet from '../assets/hero/weapons/weapons.webp?url';
import perspectiveAtlas from '../assets/hero/weapons/perspective_atlas.json';
import perspectiveSheet from '../assets/hero/weapons/perspective.png?url';
import slashFxAtlas from '../assets/effects/slash_fx_atlas.json';
import slashFxSheet from '../assets/effects/slash_fx.png?url';
import { weaponId, weaponPose, type WeaponId } from './weaponPose';
import type { GearId } from '../items/equipment';
import { ACTION_DURATION, attackFacingFor, guardFrame, heroFrame, movementFacing, type AttackFacing, type Facing, type HeroAction } from './heroFrames';

export const HERO_SPRITE_HEIGHT = data.height;
interface SpriteFrame {
  name: string; texture: string; x: number; y: number; w: number; h: number;
  originX: number; originY: number; scale: number; blade: Blade | null;
  sheathedBlade?: Blade;
  grip?: { x: number; y: number };
  supportGrip?: { x: number; y: number };
  supportCover?: { name: string; x: number; y: number; w: number; h: number };
  supportBackCover?: { name: string; x: number; y: number; w: number; h: number };
  weaponBehind?: boolean;
  weaponPerspective?: string;
}
const FRAMES = new Map<string, SpriteFrame>([
  ...data.frames,
  ...guardData.frames,
  ...dodgeData.frames,
  ...attackFrontData.frames,
  ...attackDownDiagData.frames,
  ...attackCorrectionsData.frames,
  ...attackSideData.frames,
].map((f) => [f.name, f]));

export function preloadHeroSprite(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero-academy-dodge-cardinal')) scene.load.image('hero-academy-dodge-cardinal', dodgeSheet);
  if (!scene.textures.exists('hero-academy-attack-side6')) scene.load.image('hero-academy-attack-side6', attackSideSheet);
  if (!scene.textures.exists('hero-academy-attack-corrections')) scene.load.image('hero-academy-attack-corrections', attackCorrectionsSheet);
  if (!scene.textures.exists('hero-weapons')) scene.load.image('hero-weapons', weaponSheet);
  if (!scene.textures.exists('hero-weapons-perspective')) scene.load.image('hero-weapons-perspective', perspectiveSheet);
  if (!scene.textures.exists('combat-slash-fx')) scene.load.image('combat-slash-fx', slashFxSheet);
  if (!scene.textures.exists('hero-academy-walk')) scene.load.image('hero-academy-walk', walkSheet);
  if (!scene.textures.exists('hero-academy-combat')) scene.load.image('hero-academy-combat', combatSheet);
  if (!scene.textures.exists('hero-academy-diagonal')) scene.load.image('hero-academy-diagonal', diagonalSheet);
  if (!scene.textures.exists('hero-academy-attack-down')) scene.load.image('hero-academy-attack-down', attackDownSheet);
  if (!scene.textures.exists('hero-academy-attack-up')) scene.load.image('hero-academy-attack-up', attackUpSheet);
  if (!scene.textures.exists('hero-academy-attack-front')) scene.load.image('hero-academy-attack-front', attackFrontSheet);
  if (!scene.textures.exists('hero-academy-attack-down-diag')) scene.load.image('hero-academy-attack-down-diag', attackDownDiagSheet);
  if (!scene.textures.exists('hero-academy-guard')) scene.load.image('hero-academy-guard', guardSheet);
}

/** Clean body frames and detachable weapons share measured foot, hand and blade anchors. */
export class HeroSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  flipX = false;
  private readonly image: Phaser.GameObjects.Image;
  private readonly weaponBack: Phaser.GameObjects.Image;
  private readonly weaponFront: Phaser.GameObjects.Image;
  private readonly supportHand: Phaser.GameObjects.Image;
  private weapon: WeaponId | null = 'wooden-sword';
  private animation: HeroAction = 'idle';
  private facing: Facing = 'down';
  private attackFacing: AttackFacing = 'right';
  private time = 0;
  private finished = false;
  private moving = false;
  private frame!: SpriteFrame;
  private guarding = false;
  private guardTime = 0;
  private attackWeaponBehind = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    for (const f of [...FRAMES.values(), ...guardData.covers]) {
      const texture = scene.textures.get(f.texture);
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    const weapons = scene.textures.get('hero-weapons');
    for (const f of weaponAtlas.frames) if (!weapons.has(f.name)) weapons.add(f.name, 0, f.x, f.y, f.w, f.h);
    if (scene.textures.exists('hero-weapons-perspective')) {
      const persp = scene.textures.get('hero-weapons-perspective');
      for (const f of perspectiveAtlas.frames) if (!persp.has(f.name)) persp.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    if (scene.textures.exists('combat-slash-fx')) {
      const fx = scene.textures.get('combat-slash-fx');
      for (const f of slashFxAtlas.frames) if (!fx.has(f.name)) fx.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    this.weaponBack = scene.add.image(0, 0, 'hero-weapons', 'wooden-sword-grip');
    this.weaponFront = scene.add.image(0, 0, 'hero-weapons', 'wooden-sword-blade');
    this.image = scene.add.image(0, 0, 'hero-academy-walk', 'walk-0');
    this.supportHand = scene.add.image(0, 0, 'hero-academy-guard', guardData.covers[0].name).setVisible(false);
    this.add(this.parts);
    this.applyFrame();
  }

  play(key: string): this {
    const name = key.slice(key.lastIndexOf('-') + 1) as HeroAction;
    if (!['idle', 'walk', 'attack1', 'attack2', 'attack3', 'dodge'].includes(name)) return this;
    if (name.startsWith('attack') || name === 'dodge') this.guarding = false;
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

  get isGuarding(): boolean { return this.guarding; }

  getGuardSupportPoint(): { x: number; y: number } | undefined {
    const f = this.frame, palm = f.supportGrip;
    if (!this.guarding || !palm) return undefined;
    return this.image.getWorldTransformMatrix().transformPoint(palm.x - f.originX * f.w, palm.y - f.originY * f.h);
  }

  setGuarding(active: boolean): void {
    if (this.guarding === active) return;
    this.guarding = active;
    this.guardTime = 0;
    this.applyFrame();
  }

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
  private get supportHandInFront(): boolean {
    return this.guarding && (this.facing === 'up-left' || this.facing === 'up-right');
  }
  private get parts(): Phaser.GameObjects.Image[] {
    if (this.guardWeaponBehind || this.attackWeaponBehind) return [this.weaponBack, this.weaponFront, this.image, this.supportHand];
    return this.supportHandInFront ? [this.weaponBack, this.image, this.weaponFront, this.supportHand]
      : [this.weaponBack, this.image, this.supportHand, this.weaponFront];
  }

  get guardWeaponBehind(): boolean { return this.guarding && !!this.frame?.weaponBehind; }

  get isInFollowPause(): boolean {
    return this.animation.startsWith('attack') && isAttackFollowPause(Number(this.animation.at(-1)) - 1, this.time);
  }

  get activeAttackFacing(): AttackFacing { return this.attackFacing; }

  getBlade(): Blade {
    if (!this.weapon || !this.frame.blade) {
      const f = this.frame, p = f.blade?.base ?? { x: f.originX * f.w, y: f.h };
      const point = this.image.getWorldTransformMatrix().transformPoint(p.x - f.originX * f.w, p.y - f.originY * f.h);
      return { base: { x: point.x, y: point.y }, tip: { x: point.x, y: point.y } };
    }
    const matrix = this.weaponFront.getWorldTransformMatrix();
    const persp = this.frame.weaponPerspective;
    if (persp === 'down' || persp === 'up') {
      const meta = perspectiveAtlas.frames.find(f => f.name === `${this.weapon}-${persp}`);
      if (meta) {
        return {
          base: matrix.transformPoint(0, 0),
          tip: matrix.transformPoint(0, persp === 'down' ? meta.bladeLength : -meta.bladeLength),
        };
      }
    }
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
    if (this.guarding) this.guardTime += Math.max(0, Math.min(delta, 50));
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
    const frame = FRAMES.get(this.guarding ? guardFrame(this.facing)
      : heroFrame(this.animation, attacking ? this.attackFacing : this.facing, this.time))!;
    const mirrored = this.guarding ? this.facing.includes('left')
      : attacking ? this.attackFacing.includes('left') : this.animation === 'dodge' && this.facing.includes('left');
    this.frame = frame;
    this.setRotation(this.guarding ? guardMotion(this.guardTime, this.facing).bodyAngle : 0);
    this.image.setTexture(frame.texture, frame.name).setOrigin(frame.originX, frame.originY)
      .setScale(frame.scale * (mirrored ? -1 : 1), frame.scale);
    this.applyWeapon();
  }

  private applyWeapon(): void {
    const attacking = this.animation.startsWith('attack') && !this.guarding;
    this.attackWeaponBehind = attacking && this.attackFacing === 'up';
    for (const part of this.parts) this.bringToTop(part);
    this.supportHand.setVisible(false);
    this.weaponFront.setVisible(!!this.weapon);
    const pose = weaponPose(this.frame);
    const f = this.frame;
    const persp = !this.guarding && (f.weaponPerspective === 'down' || f.weaponPerspective === 'up') ? f.weaponPerspective : undefined;
    this.weaponBack.setVisible(!!this.weapon && !pose.sheathed && !persp);
    if (!this.weapon) return;
    let { base, tip } = pose.blade;
    if (this.guarding && f.grip) {
      // A small settling motion keeps the blade and hilt rigid around the actual fist.
      const angle = guardMotion(this.guardTime, this.facing).swordAngle;
      const grip = f.grip;
      const rotate = (p: { x: number; y: number }) => ({
        x: grip.x + (p.x - grip.x) * Math.cos(angle) - (p.y - grip.y) * Math.sin(angle),
        y: grip.y + (p.x - grip.x) * Math.sin(angle) + (p.y - grip.y) * Math.cos(angle),
      });
      base = rotate(base); tip = rotate(tip);
    }
    const x = (base.x - f.originX * f.w) * this.image.scaleX;
    const y = (base.y - f.originY * f.h) * this.image.scaleY;
    const dx = (tip.x - base.x) * this.image.scaleX;
    const dy = (tip.y - base.y) * this.image.scaleY;
    if (persp) {
      const name = `${this.weapon}-${persp}`;
      const meta = perspectiveAtlas.frames.find(entry => entry.name === name)!;
      const scale = Math.hypot(dx, dy) / meta.bladeLength;
      const baseAngle = persp === 'down' ? Math.PI / 2 : -Math.PI / 2;
      this.weaponFront.setTexture('hero-weapons-perspective', name)
        .setOrigin(meta.originX, meta.originY)
        .setPosition(x, y)
        .setRotation(Math.atan2(dy, dx) - baseAngle)
        .setScale(scale);
      return;
    }
    const scale = Math.hypot(dx, dy) / weaponAtlas.bladeLength;
    const apply = (image: Phaser.GameObjects.Image, part: string) => {
      const name = `${this.weapon}-${part}`, meta = weaponAtlas.frames.find(entry => entry.name === name)!;
      image.setTexture('hero-weapons', name).setOrigin(meta.originX, meta.originY)
        .setPosition(x, y).setRotation(Math.atan2(dy, dx)).setScale(scale);
    };
    apply(this.weaponFront, pose.sheathed ? 'hilt' : 'blade');
    if (!pose.sheathed) this.weaponFront.setScale(scale, scale * HERO_BLADE_WIDTH_SCALE);
    apply(this.weaponBack, 'grip');
    if (this.guarding) this.weaponBack.setScale(30 / weaponAtlas.guardX, scale);
    if (this.guarding && f.supportCover) {
      const c = this.supportHandInFront ? f.supportBackCover ?? f.supportCover : f.supportCover;
      this.supportHand.setTexture(f.texture, c.name).setOrigin(0, 0)
        .setScale(this.image.scaleX, this.image.scaleY)
        .setPosition((c.x - f.originX * f.w) * this.image.scaleX, (c.y - f.originY * f.h) * this.image.scaleY)
        .setVisible(true);
    }
  }
}
