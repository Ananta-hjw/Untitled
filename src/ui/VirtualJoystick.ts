import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import { joystickCenter, type Rect } from './buttonLayout';

export interface JoystickOptions {
  x: number;
  y: number;
  /** 패드(바깥 원) 반지름 */
  radius?: number;
  /** 이 비율보다 작은 입력은 무시한다 (0~1) */
  deadZone?: number;
  /** false면 누르기를 받지 않는다 (메뉴·창이 열려 있을 때) */
  canGrab?: () => boolean;
}

/**
 * 누른 자리에서 시작하는 원형 가상 조이스틱.
 *
 * - 왼쪽 아래 영역(setZone) 안 어디를 눌러도 그 자리가 패드의 중심이 된다.
 *   영역을 정하지 않았으면 쉬는 자리의 패드 안(약간의 여유 포함)에서 시작한 터치만 잡는다.
 * - 손을 떼면 패드는 쉬는 자리(setPosition)로 돌아간다.
 * - 터치마다 포인터 ID를 기억하므로 다른 손가락으로 버튼을 눌러도 간섭하지 않는다.
 * - `vector`는 방향(360도)과 세기(0~1)를 함께 담는다.
 */
export class VirtualJoystick {
  /** 방향 * 세기. 길이는 0~1 */
  readonly vector = new Phaser.Math.Vector2();
  /** 0~1 */
  force = 0;
  /** 라디안. 입력이 없으면 마지막 값 유지 */
  angle = 0;

  private readonly scene: Phaser.Scene;
  private readonly baseRadius: number;
  private radius: number;
  private readonly deadZone: number;
  private readonly base: Phaser.GameObjects.Image;
  private readonly thumb: Phaser.GameObjects.Image;
  private pointerId: number | null = null;
  private centerX: number;
  private centerY: number;
  /** 손을 뗐을 때 돌아가는 자리 */
  private restX: number;
  private restY: number;
  private zone?: Rect;
  private readonly canGrab: () => boolean;

  constructor(scene: Phaser.Scene, options: JoystickOptions) {
    this.scene = scene;
    this.baseRadius = options.radius ?? 95;
    this.radius = this.baseRadius;
    this.deadZone = options.deadZone ?? 0.12;
    this.centerX = options.x;
    this.centerY = options.y;
    this.restX = options.x;
    this.restY = options.y;
    this.canGrab = options.canGrab ?? (() => true);

    VirtualJoystick.ensureTextures(scene, this.baseRadius);

    this.base = scene.add
      .image(this.centerX, this.centerY, 'joy-base')
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setAlpha(0.55);
    this.thumb = scene.add
      .image(this.centerX, this.centerY, 'joy-thumb')
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setAlpha(0.8);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.release, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
      scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
    });
  }

  /** 현재 패드 반지름 (배율 반영) */
  get size(): number {
    return this.radius;
  }

  /** 설정에서 고른 크기 배율. 잡을 수 있는 범위와 스틱이 움직이는 거리도 함께 바뀐다. */
  setSizeScale(scale: number): void {
    this.radius = this.baseRadius * scale;
    this.base.setScale(scale);
    this.thumb.setScale(scale);
  }

  get isActive(): boolean {
    return this.pointerId !== null;
  }

  /** 쉬는 자리. 잡고 있지 않으면 패드도 바로 옮긴다. */
  setPosition(x: number, y: number): void {
    this.restX = x;
    this.restY = y;
    if (this.isActive) return;
    this.centerX = x;
    this.centerY = y;
    this.base.setPosition(x, y);
    this.thumb.setPosition(x, y);
  }

  /** 누르면 그 자리에서 조이스틱이 시작되는 영역 (화면 좌표) */
  setZone(zone: Rect): void {
    this.zone = zone;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null || !this.canGrab()) return;
    const zone = this.zone;
    if (zone) {
      if (pointer.x < zone.left || pointer.x > zone.right || pointer.y < zone.top || pointer.y > zone.bottom) return;
      // 누른 자리가 패드의 중심이 된다(화면 밖으로 나가지 않게만 당긴다).
      const { width, height } = this.scene.scale.gameSize;
      const center = joystickCenter(pointer.x, pointer.y, this.radius, width, height);
      this.scene.tweens.killTweensOf([this.base, this.thumb]);
      this.centerX = center.x;
      this.centerY = center.y;
      this.base.setPosition(center.x, center.y);
    } else {
      // 패드 가장자리를 살짝 벗어난 터치도 받아준다.
      const grab = this.radius * 1.35;
      const dx = pointer.x - this.centerX;
      const dy = pointer.y - this.centerY;
      if (dx * dx + dy * dy > grab * grab) return;
    }

    this.pointerId = pointer.id;
    this.base.setAlpha(0.8);
    this.thumb.setAlpha(1);
    this.apply(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.apply(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.release();
  }

  private release(): void {
    this.pointerId = null;
    this.force = 0;
    this.vector.set(0, 0);
    this.base.setAlpha(0.55);
    this.thumb.setAlpha(0.8);
    // 패드와 스틱이 함께 쉬는 자리로 돌아간다.
    this.centerX = this.restX;
    this.centerY = this.restY;
    this.scene.tweens.killTweensOf([this.base, this.thumb]);
    this.scene.tweens.add({
      targets: [this.base, this.thumb],
      x: this.restX,
      y: this.restY,
      duration: 120,
      ease: 'Quad.easeOut',
    });
  }

  private apply(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, this.radius);

    if (distance > 0.0001) this.angle = Math.atan2(dy, dx);

    // 스틱은 패드 밖으로 나가지 않는다.
    this.scene.tweens.killTweensOf(this.thumb);
    this.thumb.setPosition(
      this.centerX + Math.cos(this.angle) * clamped,
      this.centerY + Math.sin(this.angle) * clamped,
    );

    // 데드존 밖에서부터 0→1로 부드럽게 올라가도록 다시 매핑한다.
    const raw = clamped / this.radius;
    this.force =
      raw <= this.deadZone ? 0 : (raw - this.deadZone) / (1 - this.deadZone);
    this.vector.set(
      Math.cos(this.angle) * this.force,
      Math.sin(this.angle) * this.force,
    );
  }

  private static ensureTextures(scene: Phaser.Scene, radius: number): void {
    if (scene.textures.exists('joy-base')) return;

    const pad = 6;
    const size = (radius + pad) * 2;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(size / 2, size / 2, radius);
    g.lineStyle(4, 0xe9d7b0, 0.9);
    g.strokeCircle(size / 2, size / 2, radius);
    g.lineStyle(2, 0xe9d7b0, 0.25);
    g.strokeCircle(size / 2, size / 2, radius * 0.55);
    g.generateTexture('joy-base', size, size);

    const thumbRadius = Math.round(radius * 0.42);
    const thumbSize = (thumbRadius + pad) * 2;
    g.clear();
    g.fillStyle(0xe9d7b0, 0.95);
    g.fillCircle(thumbSize / 2, thumbSize / 2, thumbRadius);
    g.lineStyle(3, 0x5b4326, 1);
    g.strokeCircle(thumbSize / 2, thumbSize / 2, thumbRadius);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(thumbSize / 2 - thumbRadius * 0.25, thumbSize / 2 - thumbRadius * 0.3, thumbRadius * 0.35);
    g.generateTexture('joy-thumb', thumbSize, thumbSize);
    g.destroy();
  }
}
