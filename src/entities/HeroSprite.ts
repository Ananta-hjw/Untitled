import Phaser from 'phaser';
import { HERO_BLADE_WIDTH_SCALE } from '../config';
import { attackBodyMotion } from './attackBodyMotion';
import { guardMotion, type GuardMode } from './guardMotion';
import type { Blade } from '../combat/blade';
import data from '../assets/hero/academy/frames.json';
import deathData from '../assets/hero/academy/death/frames.json';
import deathSheet from '../assets/hero/academy/death/collapse.webp?url';
import guardData from '../assets/hero/academy/guard/frames.json';
import guardSheet from '../assets/hero/academy/guard/bodies.webp?url';
import dodgeData from '../assets/hero/academy/dodge/frames.json';
import dodgeSheet from '../assets/hero/academy/dodge/cardinal.webp?url';
import attackSideData from '../assets/hero/academy/attack-six/attack-side_frames.json';
import attackSideSheet from '../assets/hero/academy/attack-six/attack-side.webp?url';
import attack2SideData from '../assets/hero/academy/attack-six/attack2-side_frames.json';
import attack2SideSheet from '../assets/hero/academy/attack-six/attack2-side.webp?url';
import attack3SideData from '../assets/hero/academy/attack-six/attack3-side_frames.json';
import attack3SideSheet from '../assets/hero/academy/attack-six/attack3-side.webp?url';
import attack1FrontData from '../assets/hero/academy/attack-six/attack1-front_frames.json';
import attack1FrontSheet from '../assets/hero/academy/attack-six/attack1-front.webp?url';
import attack2FrontData from '../assets/hero/academy/attack-six/attack2-front_frames.json';
import attack2FrontSheet from '../assets/hero/academy/attack-six/attack2-front.webp?url';
import attack3FrontData from '../assets/hero/academy/attack-six/attack3-front_frames.json';
import attack3FrontSheet from '../assets/hero/academy/attack-six/attack3-front.webp?url';
import attack1BackData from '../assets/hero/academy/attack-six/attack1-back_frames.json';
import attack1BackSheet from '../assets/hero/academy/attack-six/attack1-back.webp?url';
import attack2BackData from '../assets/hero/academy/attack-six/attack2-back_frames.json';
import attack2BackSheet from '../assets/hero/academy/attack-six/attack2-back.webp?url';
import attack3BackData from '../assets/hero/academy/attack-six/attack3-back_frames.json';
import attack3BackSheet from '../assets/hero/academy/attack-six/attack3-back.webp?url';
import { isAttackFollowPause } from './attackTiming';
import walkSheet from '../assets/hero/academy/unarmed/player_walk.webp?url';
import combatSheet from '../assets/hero/academy/unarmed/player_combat.webp?url';
import diagonalSheet from '../assets/hero/academy/unarmed/player_walk_diagonal.webp?url';
import weaponAtlas from '../assets/hero/weapons/atlas.json';
import weaponSheet from '../assets/hero/weapons/weapons.webp?url';
import perspectiveAtlas from '../assets/hero/weapons/perspective_atlas.json';
import perspectiveSheet from '../assets/hero/weapons/perspective.png?url';
import { weaponId, weaponLengthScale, weaponPose, type WeaponId } from './weaponPose';
import { ACTION_DURATION, attackFacingFor, guardFrame, heroFrame, movementFacing, type AttackFacing, type Facing, type HeroAction } from './heroFrames';

export const HERO_SPRITE_HEIGHT = data.height;
interface CoverFrame { name: string; x: number; y: number; w: number; h: number }
interface SpriteFrame {
  name: string; texture: string; x: number; y: number; w: number; h: number;
  originX: number; originY: number; scale: number; blade: Blade | null;
  sheathedBlade?: Blade;
  grip?: { x: number; y: number };
  gripCover?: CoverFrame & { atlasX: number; atlasY: number };
  supportGrip?: { x: number; y: number };
  supportCover?: CoverFrame;
  supportBackCover?: CoverFrame;
  weaponBehind?: boolean;
  weaponPerspective?: string;
}
const FRAMES = new Map<string, SpriteFrame>([
  ...data.frames.filter(f => f.texture !== 'hero-academy-attack-down' && f.texture !== 'hero-academy-attack-up'),
  ...deathData.frames,
  ...guardData.frames,
  ...dodgeData.frames,
  ...attackSideData.frames,
  ...attack2SideData.frames,
  ...attack3SideData.frames,
  ...attack1FrontData.frames,
  ...attack2FrontData.frames,
  ...attack3FrontData.frames,
  ...attack1BackData.frames,
  ...attack2BackData.frames,
  ...attack3BackData.frames,
].map((f) => [f.name, f]));

export function preloadHeroSprite(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero-academy-death')) scene.load.image('hero-academy-death', deathSheet);
  if (!scene.textures.exists('hero-academy-dodge-cardinal')) scene.load.image('hero-academy-dodge-cardinal', dodgeSheet);
  if (!scene.textures.exists('hero-academy-attack-side6')) scene.load.image('hero-academy-attack-side6', attackSideSheet);
  if (!scene.textures.exists('hero-academy-attack2-side6')) scene.load.image('hero-academy-attack2-side6', attack2SideSheet);
  if (!scene.textures.exists('hero-academy-attack3-side6')) scene.load.image('hero-academy-attack3-side6', attack3SideSheet);
  if (!scene.textures.exists('hero-academy-attack-front6')) scene.load.image('hero-academy-attack-front6', attack1FrontSheet);
  if (!scene.textures.exists('hero-academy-attack2-front6')) scene.load.image('hero-academy-attack2-front6', attack2FrontSheet);
  if (!scene.textures.exists('hero-academy-attack3-front6')) scene.load.image('hero-academy-attack3-front6', attack3FrontSheet);
  if (!scene.textures.exists('hero-academy-attack-back6')) scene.load.image('hero-academy-attack-back6', attack1BackSheet);
  if (!scene.textures.exists('hero-academy-attack2-back6')) scene.load.image('hero-academy-attack2-back6', attack2BackSheet);
  if (!scene.textures.exists('hero-academy-attack3-back6')) scene.load.image('hero-academy-attack3-back6', attack3BackSheet);
  if (!scene.textures.exists('hero-weapons')) scene.load.image('hero-weapons', weaponSheet);
  if (!scene.textures.exists('hero-weapons-perspective')) scene.load.image('hero-weapons-perspective', perspectiveSheet);
  if (!scene.textures.exists('hero-academy-walk')) scene.load.image('hero-academy-walk', walkSheet);
  if (!scene.textures.exists('hero-academy-combat')) scene.load.image('hero-academy-combat', combatSheet);
  if (!scene.textures.exists('hero-academy-diagonal')) scene.load.image('hero-academy-diagonal', diagonalSheet);
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
  /** 방어구 4부위(머리·몸·장갑·신발) 승급 일치로 결정되는 외형 단계 (0: 기본, 1~5: N단계 진화, 세부 색·외형 추후 확정). */
  private armorRank = 0;
  private animation: HeroAction = 'idle';
  private facing: Facing = 'down';
  private attackFacing: AttackFacing = 'right';
  private time = 0;
  private finished = false;
  private moving = false;
  private frame!: SpriteFrame;
  private guarding = false;
  private guardMode: GuardMode = 'guard';
  private guardTime = 0;
  private guardRecoilAt = -Infinity;
  private attackWeaponBehind = false;
  private weaponAlpha = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    for (const f of [...FRAMES.values(), ...guardData.covers]) {
      const texture = scene.textures.get(f.texture);
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
      const cover = FRAMES.get(f.name)?.gripCover;
      if (cover && !texture.has(cover.name)) texture.add(cover.name, 0, cover.atlasX, cover.atlasY, cover.w, cover.h);
    }
    const weapons = scene.textures.get('hero-weapons');
    for (const f of weaponAtlas.frames) if (!weapons.has(f.name)) weapons.add(f.name, 0, f.x, f.y, f.w, f.h);
    if (scene.textures.exists('hero-weapons-perspective')) {
      const persp = scene.textures.get('hero-weapons-perspective');
      for (const f of perspectiveAtlas.frames) if (!persp.has(f.name)) persp.add(f.name, 0, f.x, f.y, f.w, f.h);
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
    if (!['idle', 'walk', 'attack1', 'attack2', 'attack3', 'dodge', 'death'].includes(name)) return this;
    if (name.startsWith('attack') || name === 'dodge' || name === 'death') this.guarding = false;
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

  get equippedWeapon(): WeaponId | null { return this.weapon; }

  get currentArmorRank(): number { return this.armorRank; }

  get lookDirection(): Facing { return this.facing; }

  get isGuarding(): boolean { return this.guarding; }

  getGuardSupportPoint(): { x: number; y: number } | undefined {
    const f = this.frame, palm = f.supportGrip;
    if (!this.guarding || !palm) return undefined;
    return this.image.getWorldTransformMatrix().transformPoint(palm.x - f.originX * f.w, palm.y - f.originY * f.h);
  }

  setGuarding(active: boolean): void {
    if (this.animation === 'death' || this.guarding === active) return;
    this.guarding = active;
    this.guardTime = 0;
    if (!active) {
      this.guardRecoilAt = -Infinity;
      this.guardMode = 'guard';
    }
    this.applyFrame();
  }

  /** 일반 막기·차지 패링 충전·차지 패링 방출 상태를 반영한다. */
  setGuardMode(mode: GuardMode): void {
    if (this.guardMode === mode) return;
    this.guardMode = mode;
    if (mode === 'charging') this.guardTime = 0;
    if (this.guarding) this.applyFrame();
  }

  /** 패링·막기로 충격을 받아낸 순간 검과 상체에 짧은 반동을 준다. */
  triggerGuardRecoil(): void {
    this.guardRecoilAt = this.guardTime;
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

  setWeapon(id: string | undefined): void {
    this.weapon = weaponId(id);
    this.applyWeapon();
  }

  /** 방어구 4부위가 모두 같은 승급 단계 이상에 도달했을 때 외형 단계(0~5)를 반영한다. */
  setArmorRank(rank: number): void {
    this.armorRank = Math.max(0, Math.floor(rank));
  }

  setTint(color: number): this { for (const part of this.parts) part.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { for (const part of this.parts) part.setTintMode(mode); return this; }
  clearTint(): this { for (const part of this.parts) part.clearTint(); return this; }
  private get supportHandInFront(): boolean {
    return false;
  }
  private get parts(): Phaser.GameObjects.Image[] {
    if (!this.guarding && this.frame?.gripCover) return [this.image, this.weaponBack, this.supportHand, this.weaponFront];
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
        .setRotation(part.rotation).setAlpha(part.alpha).setTint(tint).setVisible(part.visible);
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
    if (this.animation === 'death' && this.finished) return;
    const loop = this.animation === 'idle' || this.animation === 'walk';
    if (this.guarding) this.guardTime += Math.max(0, Math.min(delta, 50));
    this.time += Math.max(0, Math.min(delta, 50)) * (loop ? this.anims.timeScale : 1);
    let complete = false;
    if (!loop && this.time + 1e-6 >= ACTION_DURATION[this.animation as keyof typeof ACTION_DURATION] && !this.finished) {
      this.finished = true;
      complete = this.animation !== 'dodge' && this.animation !== 'death';
    }
    this.applyFrame();
    if (complete) this.emit(Phaser.Animations.Events.ANIMATION_COMPLETE);
  }

  private applyFrame(): void {
    const attacking = this.animation.startsWith('attack');
    const frame = FRAMES.get(this.guarding ? guardFrame(this.facing)
      : heroFrame(this.animation, attacking ? this.attackFacing : this.facing, this.time))!;
    const mirrored = this.guarding ? this.facing.includes('left')
      : attacking ? this.attackFacing.includes('left')
        : (this.animation === 'dodge' || this.animation === 'death') && this.facing.includes('left');
    this.frame = frame;
    let bodyAngle = 0, scaleX = 1, scaleY = 1, offsetY = 0;
    if (this.guarding) {
      const guardRecoil = this.guardRecoilAt >= 0 ? this.guardTime - this.guardRecoilAt : undefined;
      const gm = guardMotion(this.guardTime, this.facing, guardRecoil, this.guardMode);
      bodyAngle = gm.bodyAngle;
      scaleX = gm.scaleX;
      scaleY = gm.scaleY;
      offsetY = gm.offsetY;
      this.weaponAlpha = 1;
    } else if (attacking) {
      const stage = Number(this.animation.at(-1)) - 1;
      const am = attackBodyMotion(stage, this.time, this.attackFacing);
      bodyAngle = am.bodyAngle;
      scaleX = am.scaleX;
      scaleY = am.scaleY;
      offsetY = am.offsetY;
      this.weaponAlpha = am.weaponAlpha;
    } else {
      this.weaponAlpha = 1;
    }
    this.setRotation(bodyAngle);
    this.image.setTexture(frame.texture, frame.name).setOrigin(frame.originX, frame.originY)
      .setPosition(0, offsetY)
      .setScale(frame.scale * (mirrored ? -1 : 1) * scaleX, frame.scale * scaleY);
    this.applyWeapon();
  }

  private applyWeapon(): void {
    if (this.animation === 'death') {
      for (const layer of [this.weaponBack, this.weaponFront, this.supportHand]) layer.setVisible(false);
      return;
    }
    const attacking = this.animation.startsWith('attack') && !this.guarding;
    this.attackWeaponBehind = attacking && this.attackFacing === 'up';
    for (const part of this.parts) this.bringToTop(part);
    this.supportHand.setVisible(false);
    this.weaponFront.setVisible(!!this.weapon).setAlpha(this.weaponAlpha);
    const pose = weaponPose(this.frame);
    const f = this.frame;
    const persp = !this.guarding && (f.weaponPerspective === 'down' || f.weaponPerspective === 'up') ? f.weaponPerspective : undefined;
    this.weaponBack.setVisible(!!this.weapon && !pose.sheathed).setAlpha(this.weaponAlpha);
    if (!this.weapon) return;
    const lengthScale = weaponLengthScale(this.weapon);
    let { base, tip } = pose.blade;
    if (this.guarding && f.grip) {
      // A small settling motion keeps the blade and hilt rigid around the actual fist.
      // guard-back은 원본 검이 왼쪽 위(-140°)를 향하므로 회전 각도 부호를 반전해 다른 7방향과 움직임을 맞춘다.
      const guardRecoil = this.guardRecoilAt >= 0 ? this.guardTime - this.guardRecoilAt : undefined;
      const rawAngle = guardMotion(this.guardTime, this.facing, guardRecoil, this.guardMode).swordAngle;
      const angle = f.name === 'guard-back' ? -rawAngle : rawAngle;
      const grip = f.grip;
      const rotate = (p: { x: number; y: number }) => ({
        x: grip.x + (p.x - grip.x) * Math.cos(angle) - (p.y - grip.y) * Math.sin(angle),
        y: grip.y + (p.x - grip.x) * Math.sin(angle) + (p.y - grip.y) * Math.cos(angle),
      });
      base = rotate(base); tip = rotate(tip);
    }
    // 몸통 탄성(Squash & Stretch) 중에도 칼날 자체는 휘거나 늘어나지 않도록 주먹(grip)만 몸통에 밀착하고 칼은 고정 스케일로 유지한다.
    const uniformX = f.scale * (this.image.scaleX < 0 ? -1 : 1);
    const uniformY = f.scale;
    const grip = f.grip ?? base;
    const x = (grip.x - f.originX * f.w) * this.image.scaleX + (base.x - grip.x) * uniformX;
    const y = this.image.y + (grip.y - f.originY * f.h) * this.image.scaleY + (base.y - grip.y) * uniformY;
    const dx = (tip.x - base.x) * uniformX;
    const dy = (tip.y - base.y) * uniformY;
    if (persp) {
      const name = `${this.weapon}-${persp}`;
      const meta = perspectiveAtlas.frames.find(entry => entry.name === name)!;
      const scale = Math.hypot(dx, dy) / meta.bladeLength;
      const baseAngle = persp === 'down' ? Math.PI / 2 : -Math.PI / 2;
      const rotation = Math.atan2(dy, dx) - baseAngle;
      for (const [image, part] of [[this.weaponBack, `${name}-grip`], [this.weaponFront, name]] as const) {
        image.setTexture('hero-weapons-perspective', part)
          .setOrigin(meta.originX, meta.originY).setPosition(x, y).setRotation(rotation);
      }
      this.weaponBack.setScale(scale);
      this.weaponFront.setScale(scale, scale * lengthScale);
      if (attacking && f.gripCover) this.showHandCover(f, f.gripCover);
      return;
    }
    const scale = Math.hypot(dx, dy) / weaponAtlas.bladeLength;
    const apply = (image: Phaser.GameObjects.Image, part: string) => {
      const name = `${this.weapon}-${part}`, meta = weaponAtlas.frames.find(entry => entry.name === name)!;
      image.setTexture('hero-weapons', name).setOrigin(meta.originX, meta.originY)
        .setPosition(x, y).setRotation(Math.atan2(dy, dx)).setScale(scale);
    };
    apply(this.weaponFront, pose.sheathed ? 'hilt' : 'blade');
    if (!pose.sheathed) this.weaponFront.setScale(scale * lengthScale, scale * HERO_BLADE_WIDTH_SCALE);
    apply(this.weaponBack, 'grip');
    if (attacking && f.gripCover) {
      // The painted fist covers the middle of the grip while the neck and pommel remain above the hair.
      this.weaponBack.setScale(scale * 1.2, scale);
      this.showHandCover(f, f.gripCover);
    }
    if (this.guarding) this.weaponBack.setScale(30 / weaponAtlas.guardX, scale);
    if (this.guarding && f.supportCover) {
      const c = this.supportHandInFront ? f.supportBackCover ?? f.supportCover : f.supportCover;
      this.showHandCover(f, c);
    }
  }

  private showHandCover(f: SpriteFrame, cover: CoverFrame): void {
    this.supportHand.setTexture(f.texture, cover.name).setOrigin(0, 0)
      .setScale(this.image.scaleX, this.image.scaleY)
      .setPosition((cover.x - f.originX * f.w) * this.image.scaleX, this.image.y + (cover.y - f.originY * f.h) * this.image.scaleY)
      .setVisible(true);
  }
}
