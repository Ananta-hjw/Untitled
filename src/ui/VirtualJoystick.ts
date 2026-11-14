import Phaser from 'phaser';
import { DEPTH_UI } from '../config';

export interface JoystickOptions {
  x: number;
  y: number;
  /** 패드(바깥 원) 반지름 */
  radius?: number;
  /** 이 비율보다 작은 입력은 무시한다 (0~1) */
  deadZone?: number;
}

/**
 * 화면에 고정된 원형 가상 조이스틱.
 *
 * - 패드 안(약간의 여유 포함)에서 시작한 터치만 잡는다.
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

  constructor(scene: Phaser.Scene, options: JoystickOptions) {
    this.scene = scene;
    this.baseRadius = options.radius ?? 95;
    this.radius = this.baseRadius;
    this.deadZone = options.deadZone ?? 0.12;
    this.centerX = options.x;
    this.centerY = options.y;

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

  setPosition(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.base.setPosition(x, y);
    if (!this.isActive) this.thumb.setPosition(x, y);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    // 패드 가장자리를 살짝 벗어난 터치도 받아준다.
    const grab = this.radius * 1.35;
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    if (dx * dx + dy * dy > grab * grab) return;

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
    this.scene.tweens.add({
      targets: this.thumb,
      x: this.centerX,
      y: this.centerY,
      duration: 90,
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
