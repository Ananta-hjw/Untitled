import Phaser from 'phaser';
import { VIEW_HEIGHT } from '../config';
import { browserStorage } from '../entities/saveData';
import { PROLOGUE_SAVE_KEY, PROLOGUE_SLIDES, type PrologueSlide } from '../story/prologue';
import cut1Url from '../assets/prologue/cut1.jpg?url';
import cut2Url from '../assets/prologue/cut2.jpg?url';
import cut3Url from '../assets/prologue/cut3.jpg?url';
import cut4Url from '../assets/prologue/cut4.jpg?url';
import cut5Url from '../assets/prologue/cut5.jpg?url';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const SERIF = 'Georgia, "Noto Serif KR", "Batang", serif';
const CROSSFADE_MS = 850;
const SUBTITLE_IN_MS = 450;

const CUT_URLS: Record<PrologueSlide['id'], string> = {
  cut1: cut1Url,
  cut2: cut2Url,
  cut3: cut3Url,
  cut4: cut4Url,
  cut5: cut5Url,
};

export interface PrologueSceneData {
  /** 'game'이면 끝나고 게임(오프닝)으로, 'title'이면 타이틀로 복귀한다. */
  next?: 'game' | 'title';
}

interface StarMote {
  dot: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  phase: number;
  baseAlpha: number;
}

/**
 * 세계관 프롤로그 5컷 스틸컷 연출 씬.
 * 정지 일러스트 5장을 부드러운 줌·패닝(Ken Burns), 별빛 파티클, 크로스페이드, 하단 자막으로 재생한다.
 */
export class PrologueScene extends Phaser.Scene {
  private nextTarget: 'game' | 'title' = 'game';
  private index = 0;
  private elapsed = 0;
  private finished = false;
  private currentImage?: Phaser.GameObjects.Image;
  private outgoingImage?: Phaser.GameObjects.Image;
  private outgoingAlpha = 0;
  private vignette!: Phaser.GameObjects.Graphics;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private captionText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private skipBg!: Phaser.GameObjects.Graphics;
  private skipText!: Phaser.GameObjects.Text;
  private skipHovered = false;
  private motes: StarMote[] = [];

  constructor() { super('prologue'); }

  init(data?: PrologueSceneData): void {
    this.nextTarget = data?.next ?? 'game';
  }

  preload(): void {
    for (const slide of PROLOGUE_SLIDES) {
      const key = `prologue-${slide.id}`;
      if (!this.textures.exists(key)) this.load.image(key, CUT_URLS[slide.id]);
    }
  }

  create(): void {
    this.index = 0;
    this.elapsed = 0;
    this.finished = false;
    this.outgoingImage = undefined;
    this.outgoingAlpha = 0;
    this.motes = [];

    this.cameras.main.setBackgroundColor('#05070e');

    // 화면 위·아래 영화풍 암막 그라데이션 (자막 가독성 확보)
    this.vignette = this.add.graphics().setDepth(20);
    this.progressGfx = this.add.graphics().setDepth(30);

    // 은은하게 떠다니는 우주 별빛 입자
    const w = this.scale.gameSize.width;
    for (let i = 0; i < 38; i++) {
      const radius = i % 6 === 0 ? 2.1 : 1.2;
      const baseAlpha = 0.25 + (i % 5) * 0.11;
      const dot = this.add.circle(
        Math.random() * w,
        Math.random() * VIEW_HEIGHT,
        radius,
        0xffffff,
        baseAlpha,
      ).setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
      this.motes.push({
        dot,
        vx: (Math.random() - 0.5) * 14,
        vy: -6 - Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        baseAlpha,
      });
    }

    this.captionText = this.add.text(0, 44, '', {
      fontFamily: SERIF,
      fontSize: '19px',
      color: '#e5cc96',
      letterSpacing: 3,
      stroke: '#060811',
      strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(35).setResolution(2).setAlpha(0);

    this.subtitleText = this.add.text(0, VIEW_HEIGHT - 98, '', {
      fontFamily: FONT,
      fontSize: '21px',
      color: '#f8f0df',
      align: 'center',
      lineSpacing: 11,
      stroke: '#05070e',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(35).setResolution(2).setAlpha(0);

    this.hintText = this.add.text(0, VIEW_HEIGHT - 24, '클릭 · Space 다음  |  Esc 건너뛰기', {
      fontFamily: FONT,
      fontSize: '13px',
      color: '#9ba9bb',
    }).setOrigin(0.5, 0.5).setDepth(35).setResolution(2).setAlpha(0.75);

    this.skipBg = this.add.graphics().setDepth(34);
    this.skipText = this.add.text(0, 44, '건너뛰기 ▸', {
      fontFamily: FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#e8dcc4',
      padding: { x: 16, y: 8 },
    }).setOrigin(1, 0.5).setDepth(35).setResolution(2).setInteractive({ useHandCursor: true });

    this.skipText.on('pointerover', () => { this.skipHovered = true; this.drawChrome(); });
    this.skipText.on('pointerout', () => { this.skipHovered = false; this.drawChrome(); });
    this.skipText.on('pointerup', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.finish();
    });

    this.input.on('pointerup', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-RIGHT', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());

    this.showSlide(0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.cameras.main.fadeIn(700, 5, 7, 14);
  }

  private showSlide(nextIndex: number): void {
    const slide = PROLOGUE_SLIDES[nextIndex];
    this.index = nextIndex;
    this.elapsed = 0;

    if (this.outgoingImage) {
      this.outgoingImage.destroy();
      this.outgoingImage = undefined;
    }
    if (this.currentImage) {
      this.outgoingImage = this.currentImage;
      this.outgoingImage.setDepth(4);
      this.outgoingAlpha = 1;
    }

    this.currentImage = this.add.image(0, 0, `prologue-${slide.id}`)
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(this.outgoingImage ? 0 : 1);

    this.captionText.setText(slide.caption).setAlpha(0);
    this.subtitleText.setText(slide.lines.join('\n')).setAlpha(0);
    for (const mote of this.motes) mote.dot.setFillStyle(slide.accentColor, mote.baseAlpha);

    this.applySlideTransform(0);
    this.drawProgress();
  }

  private advance(): void {
    if (this.finished) return;
    // 너무 빠르게 실수로 두 번 넘어가지 않도록 최소 280ms 보호
    if (this.elapsed < 280) return;
    if (this.index + 1 < PROLOGUE_SLIDES.length) {
      this.showSlide(this.index + 1);
    } else {
      this.finish();
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    try { browserStorage()?.setItem(PROLOGUE_SAVE_KEY, 'seen'); } catch { /* ignore */ }
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.nextTarget === 'title') this.scene.start('title');
      else this.scene.start('game', { fromTitle: true });
    });
    camera.fadeOut(750, 5, 7, 14);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.max(0, Math.min(delta, 50));
    const width = this.scale.gameSize.width;
    const sec = dt / 1000;

    // 별빛 입자 부유
    for (const m of this.motes) {
      m.phase += sec * 1.8;
      let nx = m.dot.x + m.vx * sec;
      let ny = m.dot.y + m.vy * sec;
      if (ny < -8) { ny = VIEW_HEIGHT + 8; nx = Math.random() * width; }
      if (nx < -8) nx = width + 8;
      else if (nx > width + 8) nx = -8;
      m.dot.setPosition(nx, ny).setAlpha(m.baseAlpha * (0.65 + 0.35 * Math.sin(m.phase)));
    }

    if (this.finished) return;
    const slide = PROLOGUE_SLIDES[this.index];
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / slide.durationMs);

    // 크로스페이드 전환
    if (this.outgoingImage) {
      const fade = Math.min(1, this.elapsed / CROSSFADE_MS);
      this.currentImage?.setAlpha(fade);
      this.outgoingAlpha = 1 - fade;
      this.outgoingImage.setAlpha(this.outgoingAlpha);
      if (fade >= 1) {
        this.outgoingImage.destroy();
        this.outgoingImage = undefined;
      }
    }

    // 캡션·자막 페이드 인/아웃
    const fadeOutTail = Math.max(0, Math.min(1, (slide.durationMs - this.elapsed) / 550));
    const captionIn = Math.min(1, Math.max(0, (this.elapsed - 180) / 500));
    const subIn = Math.min(1, Math.max(0, (this.elapsed - SUBTITLE_IN_MS) / 550));
    this.captionText.setAlpha(captionIn * fadeOutTail * 0.92);
    this.subtitleText.setAlpha(subIn * fadeOutTail);

    this.applySlideTransform(t);
    this.drawProgress();

    if (this.elapsed >= slide.durationMs) {
      if (this.index + 1 < PROLOGUE_SLIDES.length) this.showSlide(this.index + 1);
      else this.finish();
    }
  }

  private applySlideTransform(progress: number): void {
    const img = this.currentImage;
    if (!img) return;
    const slide = PROLOGUE_SLIDES[this.index];
    const width = this.scale.gameSize.width;
    const coverScale = Math.max(width / img.width, VIEW_HEIGHT / img.height);
    const cam = slide.camera;
    // 부드러운 등속+완화 줌/패닝
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
    const mix = progress * 0.65 + ease * 0.35;
    const zoom = cam.startScale + (cam.endScale - cam.startScale) * mix;
    const ox = (cam.startX + (cam.endX - cam.startX) * mix) * width;
    const oy = (cam.startY + (cam.endY - cam.startY) * mix) * VIEW_HEIGHT;
    img.setPosition(width / 2 + ox, VIEW_HEIGHT / 2 + oy).setScale(coverScale * zoom);
  }

  private layout(): void {
    const width = this.scale.gameSize.width;
    const margin = Math.max(36, width * 0.045);
    this.captionText.setPosition(margin, 44);
    this.subtitleText.setPosition(width / 2, VIEW_HEIGHT - 100).setWordWrapWidth(Math.min(width - 64, 1080));
    this.hintText.setPosition(width / 2, VIEW_HEIGHT - 22);
    this.skipText.setPosition(width - margin, 44);
    this.drawChrome();
    this.drawProgress();
    const slide = PROLOGUE_SLIDES[this.index];
    if (slide) this.applySlideTransform(Math.min(1, this.elapsed / slide.durationMs));
  }

  private drawChrome(): void {
    const width = this.scale.gameSize.width;
    const g = this.vignette.clear();
    // 상단 시네마 그라데이션
    g.fillGradientStyle(0x05070e, 0x05070e, 0x05070e, 0x05070e, 0.84, 0.84, 0, 0);
    g.fillRect(0, 0, width, 110);
    // 하단 자막 배경 그라데이션
    g.fillGradientStyle(0x05070e, 0x05070e, 0x05070e, 0x05070e, 0, 0, 0.92, 0.92);
    g.fillRect(0, VIEW_HEIGHT - 205, width, 205);

    const b = this.skipText.getBounds();
    const sg = this.skipBg.clear();
    sg.fillStyle(this.skipHovered ? 0x263248 : 0x101726, this.skipHovered ? 0.92 : 0.72);
    sg.fillRoundedRect(b.x, b.y, b.width, b.height, 8);
    sg.lineStyle(1, this.skipHovered ? 0xf2d99b : 0x8e99ad, 0.85);
    sg.strokeRoundedRect(b.x, b.y, b.width, b.height, 8);
  }

  private drawProgress(): void {
    const width = this.scale.gameSize.width;
    const g = this.progressGfx.clear();
    const total = PROLOGUE_SLIDES.length;
    const spacing = 22;
    const startX = width / 2 - ((total - 1) * spacing) / 2;
    const y = VIEW_HEIGHT - 44;
    for (let i = 0; i < total; i++) {
      const active = i === this.index;
      const done = i < this.index;
      g.fillStyle(active ? 0xf3d799 : done ? 0x9aaec7 : 0x455064, active ? 1 : 0.75);
      g.fillCircle(startX + i * spacing, y, active ? 4.5 : 3);
    }
    // 현재 컷의 진행 얇은 바
    const slide = PROLOGUE_SLIDES[this.index];
    const ratio = slide ? Math.min(1, this.elapsed / slide.durationMs) : 0;
    const barW = 140;
    g.fillStyle(0x2d3748, 0.55).fillRect(width / 2 - barW / 2, y + 10, barW, 2);
    g.fillStyle(0xe8cd92, 0.9).fillRect(width / 2 - barW / 2, y + 10, barW * ratio, 2);
  }
}
