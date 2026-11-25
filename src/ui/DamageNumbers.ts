import Phaser from 'phaser';
import { DEPTH_LIGHTING } from '../config';
import { damageNumberMotion } from '../combat/attackFeel';

/**
 * 떠오르며 사라지는 탄성 데미지 숫자.
 *
 * 숫자 0~9를 시작할 때 한 번만 텍스처로 그려 두고, 타격마다 그 그림을 조합해서 보여 준다.
 * 뜨는 순간 탄성 있게 팝인(1.48~1.75배 → 1배)되고 공격 방향으로 살짝 튕겨 손맛을 높인다.
 */

const TEXTURE = 'damage-digits';
/** 텍스처에 그리는 글자 크기. 화면에는 축소해서 쓰므로 크게 그려 선명하게 한다. */
const GLYPH_SIZE = 92;
const CELL_WIDTH = 84;
const CELL_HEIGHT = 124;
const DURATION_MS = 680;
const HEAVY_DURATION_MS = 780;
const RISE = 64;

interface Entry {
  images: Phaser.GameObjects.Image[];
  /** 각 자릿수의 가로 위치(가운데 기준) */
  offsets: number[];
  count: number;
  age: number;
  duration: number;
  baseScale: number;
  heavy: boolean;
  driftX: number;
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

  /** color는 0xRRGGBB, size는 화면에서의 글자 크기(px). dirX가 있으면 베는 방향으로 살짝 튕긴다. */
  show(x: number, y: number, amount: number, color: number, size = 34, dirX = 0): void {
    const text = String(Math.max(0, Math.round(amount)));
    const scale = size / GLYPH_SIZE;
    const heavy = size >= 46;
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
    entry.duration = heavy ? HEAVY_DURATION_MS : DURATION_MS;
    entry.baseScale = scale;
    entry.heavy = heavy;
    entry.driftX = dirX ? Math.sign(dirX) * (heavy ? 24 : 15) : Phaser.Math.Between(-10, 10);
    entry.x = x + Phaser.Math.Between(-12, 12);
    entry.y = y;
    entry.active = true;
    this.place(entry, 0);
  }

  update(deltaMs: number): void {
    for (const entry of this.entries) {
      if (!entry.active) continue;
      entry.age += deltaMs;
      const t = entry.age / entry.duration;
      if (t >= 1) {
        entry.active = false;
        for (let i = 0; i < entry.count; i++) entry.images[i].setVisible(false);
        continue;
      }
      this.place(entry, t);
    }
  }

  private place(entry: Entry, t: number): void {
    const { scaleMult, riseRatio, alpha } = damageNumberMotion(t, entry.heavy);
    const jitter = entry.heavy && t < 0.14 ? Math.sin(t * 140) * 3.5 : 0;
    const x = entry.x + entry.driftX * riseRatio + jitter;
    const y = entry.y - (entry.heavy ? RISE * 1.15 : RISE) * riseRatio;
    const sc = entry.baseScale * scaleMult;
    for (let i = 0; i < entry.count; i++) {
      entry.images[i]
        .setPosition(x + entry.offsets[i] * scaleMult, y)
        .setScale(sc)
        .setAlpha(alpha);
    }
  }

  /** 쉬고 있는 항목을 찾아 쓰고, 없을 때만 새로 만든다. */
  private acquire(digits: number): Entry {
    let entry = this.entries.find((e) => !e.active);
    if (!entry) {
      entry = { images: [], offsets: [], count: 0, age: 0, duration: DURATION_MS, baseScale: 1, heavy: false, driftX: 0, x: 0, y: 0, active: false };
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
    ctx.strokeStyle = '#1a1008';
    ctx.lineWidth = 14;
    ctx.fillStyle = '#ffffff';
    for (let digit = 0; digit < 10; digit++) {
      const cx = digit * CELL_WIDTH + CELL_WIDTH / 2;
      const cy = CELL_HEIGHT / 2;
      ctx.strokeText(String(digit), cx, cy);
      ctx.fillText(String(digit), cx, cy);
      texture.add(String(digit), 0, digit * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT);
    }
    texture.refresh();
  }
}
