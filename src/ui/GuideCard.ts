import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { LESSONS, type Lesson } from '../story/tutorial';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/**
 * 초반 전투 가이드의 시스템 안내 창(story/tutorial.ts). 수련 연습이 시작될 때 한 번 떠서 조작법을 알려 주고,
 * 확인을 누르면 닫힌다(열려 있는 동안 게임은 멈춘다). 연습하는 동안에는 해당 버튼 둘레에 고리가 반짝인다.
 */
export class GuideCard {
  private readonly scene: Phaser.Scene;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly okButton: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private onClose?: () => void;
  private width = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.blocker = scene.add.zone(0, 0, 10, VIEW_HEIGHT).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 60).setInteractive();
    this.shade = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 60);
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 61);
    this.badge = this.label(20, '#1a302a');
    this.title = this.label(34, '#f7ebd0');
    this.body = this.label(23, '#e3ece5').setLineSpacing(12).setStyle({ fontStyle: 'normal' });
    this.okButton = this.label(28, '#1a302a').setFixedSize(280, 72).setAlign('center').setPadding(0, 19, 0, 0)
      .setBackgroundColor('#dfc18a').setText('확인').setInteractive({ useHandCursor: true }).on('pointerup', () => this.close());
    // 버튼 강조 고리는 메뉴보다 아래, 버튼보다 위에 그린다.
    this.ring = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 30);
    this.hide();
  }

  get isOpen(): boolean { return this.onClose !== undefined; }

  open(lesson: Lesson, onClose: () => void): void {
    this.onClose = onClose;
    const index = LESSONS.findIndex((l) => l.id === lesson.id) + 1;
    this.badge.setText(`  전투 가이드 ${index}/${LESSONS.length} · ${lesson.teacher}에게 배우기  `);
    this.title.setText(lesson.title);
    this.body.setText(lesson.lines.map((l) => `• ${l}`).join('\n'));
    for (const o of this.objects()) o.setVisible(true);
    this.layout(this.width || this.scene.scale.gameSize.width);
  }

  close(): void {
    const callback = this.onClose;
    if (!callback) return;
    this.hide();
    callback();
  }

  layout(width: number): void {
    this.width = width;
    this.blocker.setSize(width, VIEW_HEIGHT);
    this.blocker.input?.hitArea.setSize(width, VIEW_HEIGHT);
    this.shade.clear().fillStyle(0x050e0b, 0.55).fillRect(0, 0, width, VIEW_HEIGHT);
    const w = Math.min(860, width - 80), left = (width - w) / 2, top = 70;
    this.body.setWordWrapWidth(w - 80);
    const height = Math.max(420, 200 + this.body.height + 110);
    const g = this.panel.clear();
    g.fillStyle(0x10271f, 0.98).fillRoundedRect(left, top, w, height, 18);
    g.lineStyle(2, 0xdfc18a, 0.95).strokeRoundedRect(left, top, w, height, 18);
    this.badge.setBackgroundColor('#dfc18a').setPosition(left + 36, top + 28);
    this.title.setPosition(left + 36, top + 70);
    g.lineStyle(1, 0x6b8064, 0.6).lineBetween(left + 36, top + 128, left + w - 36, top + 128);
    this.body.setPosition(left + 40, top + 148);
    this.okButton.setPosition(left + (w - 280) / 2, top + height - 96);
  }

  /** 연습 중인 버튼 둘레에 반짝이는 고리. 없으면 지운다. realMs: 실제 시간(깜박임용) */
  highlight(target: { x: number; y: number; radius: number } | undefined, realMs: number): void {
    const g = this.ring.clear();
    if (!target) return;
    const pulse = 0.5 + 0.5 * Math.sin(realMs / 160);
    g.lineStyle(6, 0xffe08a, 0.45 + 0.5 * pulse).strokeCircle(target.x, target.y, target.radius + 8 + pulse * 6);
    g.lineStyle(2, 0xffffff, 0.6 * pulse).strokeCircle(target.x, target.y, target.radius + 18 + pulse * 10);
  }

  private objects(): Phaser.GameObjects.Components.Visible[] {
    return [this.blocker, this.shade, this.panel, this.badge, this.title, this.body, this.okButton];
  }

  private hide(): void {
    this.onClose = undefined;
    for (const o of this.objects()) o.setVisible(false);
  }

  private label(size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(DEPTH_UI + 62).setResolution(2);
  }
}
