import Phaser from 'phaser';
import { DEPTH_LIGHTING } from '../config';

/**
 * 떠오르며 사라지는 데미지 숫자.
 *
 * 숫자 0~9를 시작할 때 한 번만 텍스처로 그려 두고, 타격마다 그 그림을 조합해서 보여 준다.
 * Text 객체를 매번 새로 만들면 그때마다 글자를 그려 GPU로 올려야 해서 전투 중에 끊길 수 있다.
 * 숫자 그림과 표시 항목은 모두 재사용하므로 타격이 이어져도 새로 만드는 것이 없다.
 */

const TEXTURE = 'damage-digits';
/** 텍스처에 그리는 글자 크기. 화면에는 축소해서 쓰므로 크게 그려 선명하게 한다. */
const GLYPH_SIZE = 92;
const CELL_WIDTH = 84;
const CELL_HEIGHT = 124;
const DURATION_MS = 650;
const RISE = 60;

interface Entry {
  images: Phaser.GameObjects.Image[];
  /** 각 자릿수의 가로 위치(가운데 기준) */
  offsets: number[];
  count: number;
  age: number;
  x: number;
  y: number;
  active: boolean;
}

export class DamageNumbers {
  private readonly scene: Phaser.Scene;
  private readonly advance: number[] = [];
  private readonly entries: Entry[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildTexture();
  }

  /** color는 0xRRGGBB, size는 화면에서의 글자 크기(px). */
  show(x: number, y: number, amount: number, color: number, size = 34): void {
    const text = String(Math.max(0, Math.round(amount)));
    const scale = size / GLYPH_SIZE;
    const entry = this.acquire(text.length);

    let width = 0;
    for (let i = 0; i < text.length; i++) width += this.advance[text.charCodeAt(i) - 48] * scale;

    let cursor = -width / 2;
    for (let i = 0; i < text.length; i++) {
      const digit = text.charCodeAt(i) - 48;
      const step = this.advance[digit] * scale;
      entry.offsets[i] = cursor + step / 2;
      entry.images[i].setFrame(String(digit)).setScale(scale).setTint(color).setAlpha(1).setVisible(true);
      cursor += step;
    }

    entry.count = text.length;
    entry.age = 0;
    entry.x = x + Phaser.Math.Between(-14, 14);
    entry.y = y;
    entry.active = true;
    this.place(entry, 0);
  }

  update(deltaMs: number): void {
    for (const entry of this.entries) {
      if (!entry.active) continue;
      entry.age += deltaMs;
      const t = entry.age / DURATION_MS;
      if (t >= 1) {
        entry.active = false;
        for (let i = 0; i < entry.count; i++) entry.images[i].setVisible(false);
        continue;
      }
      this.place(entry, t);
    }
  }

  private place(entry: Entry, t: number): void {
    // 처음에 빠르게 올라가고 점점 느려진다.
    const y = entry.y - RISE * (1 - (1 - t) * (1 - t));
    const alpha = 1 - t;
    for (let i = 0; i < entry.count; i++) {
      entry.images[i].setPosition(entry.x + entry.offsets[i], y).setAlpha(alpha);
    }
  }

  /** 쉬고 있는 항목을 찾아 쓰고, 없을 때만 새로 만든다. */
  private acquire(digits: number): Entry {
    let entry = this.entries.find((e) => !e.active);
    if (!entry) {
      entry = { images: [], offsets: [], count: 0, age: 0, x: 0, y: 0, active: false };
      this.entries.push(entry);
    }
    while (entry.images.length < digits) {
      entry.images.push(
        this.scene.add.image(0, 0, TEXTURE, '0').setDepth(DEPTH_LIGHTING + 5).setVisible(false),
      );
    }
    return entry;
  }

  private buildTexture(): void {
    const font = `bold ${GLYPH_SIZE}px system-ui, sans-serif`;
    const existing = this.scene.textures.exists(TEXTURE);
    const texture = existing
      ? (this.scene.textures.get(TEXTURE) as Phaser.Textures.CanvasTexture)
      : this.scene.textures.createCanvas(TEXTURE, CELL_WIDTH * 10, CELL_HEIGHT);
    if (!texture) return;

    const ctx = texture.getContext();
    ctx.font = font;
    for (let digit = 0; digit < 10; digit++) this.advance[digit] = ctx.measureText(String(digit)).width;
    if (existing) return;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#1a1008';
    // 흰색으로 그려 두고 표시할 때 색을 곱한다. 어두운 테두리는 곱해도 어둡게 남는다.
    ctx.fillStyle = '#ffffff';
    for (let digit = 0; digit < 10; digit++) {
      const cx = digit * CELL_WIDTH + CELL_WIDTH / 2;
      ctx.strokeText(String(digit), cx, CELL_HEIGHT / 2);
      ctx.fillText(String(digit), cx, CELL_HEIGHT / 2);
      texture.add(String(digit), 0, digit * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT);
    }
    texture.refresh();
  }
}
