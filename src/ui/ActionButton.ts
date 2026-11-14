import Phaser from 'phaser';
import { DEPTH_UI } from '../config';

export interface ActionButtonOptions {
  x: number;
  y: number;
  radius?: number;
  label: string;
  color?: number;
  fontSize?: number;
}

/**
 * 화면에 고정된 원형 버튼.
 * 조이스틱과 마찬가지로 자기 터치(포인터 ID)만 추적하므로 이동하면서 동시에 누를 수 있다.
 * 누르고 있는 동안 `isDown`이 true다.
 */
export class ActionButton {
  isDown = false;

  private pressed = false;
  private enabled = true;
  private shown = true;
  /** 설정의 버튼 크기 배율 */
  private sizeScale = 1;

  private readonly radius: number;
  private readonly image: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private pointerId: number | null = null;

  constructor(scene: Phaser.Scene, options: ActionButtonOptions) {
    this.radius = options.radius ?? 78;
    const color = options.color ?? 0x8a2c2c;
    const key = `button-${this.radius}-${color}`;

    if (!scene.textures.exists(key)) {
      const pad = 6;
      const size = (this.radius + pad) * 2;
      const g = scene.make.graphics({}, false);
      g.fillStyle(0x000000, 0.5);
      g.fillCircle(size / 2, size / 2, this.radius);
      g.fillStyle(color, 0.85);
      g.fillCircle(size / 2, size / 2, this.radius - 10);
      g.lineStyle(4, 0xe9d7b0, 0.9);
      g.strokeCircle(size / 2, size / 2, this.radius);
      g.generateTexture(key, size, size);
      g.destroy();
    }

    this.image = scene.add.image(options.x, options.y, key).setScrollFactor(0).setDepth(DEPTH_UI).setAlpha(0.7);
    this.text = scene.add
      .text(options.x, options.y, options.label, {
        fontFamily: 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        fontSize: `${options.fontSize ?? 30}px`,
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setResolution(2);

    const onDown = (pointer: Phaser.Input.Pointer) => {
      if (this.pointerId !== null || !this.shown) return;
      const reach = this.radius * this.sizeScale * 1.2;
      const dx = pointer.x - this.image.x;
      const dy = pointer.y - this.image.y;
      if (dx * dx + dy * dy > reach * reach) return;
      this.pointerId = pointer.id;
      this.pressed = true;
      this.setPressed(true);
    };
    const onUp = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.pointerId) return;
      release();
    };
    const release = () => {
      this.pointerId = null;
      this.setPressed(false);
    };

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
    scene.game.events.on(Phaser.Core.Events.BLUR, release);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
      scene.game.events.off(Phaser.Core.Events.BLUR, release);
    });
  }

  setPosition(x: number, y: number): void {
    this.image.setPosition(x, y);
    this.text.setPosition(x, y);
  }

  /** 눌린 순간을 한 번만 알려준다. (누르고 있어도 반복되지 않는다) */
  consumePress(): boolean {
    const pressed = this.pressed;
    this.pressed = false;
    return pressed;
  }

  /** 현재 크기(반지름, 배율 반영) */
  get size(): number {
    return this.radius * this.sizeScale;
  }

  /** 설정에서 고른 크기 배율. 누를 수 있는 범위도 함께 바뀐다. */
  setSizeScale(scale: number): void {
    this.sizeScale = scale;
    this.refresh();
  }

  /** 숨기면 눌리지 않는다. 누르고 있던 중이면 뗀 것으로 친다. */
  setVisible(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.image.setVisible(visible);
    this.text.setVisible(visible);
    if (!visible) {
      this.pointerId = null;
      this.pressed = false;
      this.setPressed(false);
    }
  }

  /** 재사용 대기 중에는 흐리게 표시한다. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.refresh();
  }

  private setPressed(pressed: boolean): void {
    this.isDown = pressed;
    this.refresh();
  }

  private refresh(): void {
    const scale = (this.isDown ? 0.93 : 1) * this.sizeScale;
    this.image.setAlpha(!this.enabled ? 0.3 : this.isDown ? 1 : 0.7).setScale(scale);
    this.text.setAlpha(this.enabled ? 1 : 0.4).setScale(scale);
  }
}
