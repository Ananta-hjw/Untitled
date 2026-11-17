import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { BOSS, type BossPhase } from '../combat/bossPattern';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
/** 화면 위쪽, 왼쪽 HUD(체력·구슬)와 오른쪽 미니맵 사이의 빈 띠에 막대를 둔다 */
const BAR_Y = 40;
const BAR_HEIGHT = 16;
const BAR_LEFT = 505;
const BAR_RIGHT_MARGIN = 265;

/**
 * 보스 화면 표시: 나타나기 전의 "보스 등장" 경고(붉은 띠와 깜박이는 글)와, 싸우는 동안 화면 위 가운데의 체력 막대.
 * 경고의 깜박임은 장면의 게임 시계로 움직여 일시정지·대화 중에는 멈춘다.
 */
export class BossHud {
  private readonly scene: Phaser.Scene;
  private readonly warnBands: Phaser.GameObjects.Graphics;
  private readonly warnTitle: Phaser.GameObjects.Text;
  private readonly warnName: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly barName: Phaser.GameObjects.Text;
  private width = 0;
  private warnStart?: number;
  private shown?: { name: string; hp: number; maxHp: number; phase: BossPhase };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.warnBands = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 40);
    this.warnTitle = scene.add.text(0, VIEW_HEIGHT / 2 - 40, '⚠  보스 등장  ⚠', {
      fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ff4a3a', stroke: '#1a0505', strokeThickness: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 41).setResolution(2);
    this.warnName = scene.add.text(0, VIEW_HEIGHT / 2 + 40, '', {
      fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffe0d6', stroke: '#1a0505', strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 41).setResolution(2);
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 20);
    this.barName = scene.add.text(0, BAR_Y - 6, '', {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd9cf', stroke: '#1a0505', strokeThickness: 5,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH_UI + 21).setResolution(2);
    this.hideWarning();
    this.hideBar();
    this.layout(scene.scale.gameSize.width);
  }

  get warning(): boolean { return this.warnStart !== undefined; }
  get barVisible(): boolean { return this.shown !== undefined; }

  layout(width: number): void {
    this.width = width;
    this.warnTitle.setX(width / 2);
    this.warnName.setX(width / 2);
    this.drawBar();
  }

  showWarning(name: string, now: number): void {
    this.warnStart = now;
    this.warnName.setText(`${name} — 습격 무리의 우두머리`);
    this.warnBands.setVisible(true);
    this.warnTitle.setVisible(true);
    this.warnName.setVisible(true);
    this.updateWarning(now);
  }

  hideWarning(): void {
    this.warnStart = undefined;
    this.warnBands.clear().setVisible(false);
    this.warnTitle.setVisible(false);
    this.warnName.setVisible(false);
  }

  /** 경고: 붉은 띠가 맥박치고 글이 깜박인다. 끝나기 직전에 흐려진다. */
  updateWarning(now: number): void {
    if (this.warnStart === undefined) return;
    const t = now - this.warnStart;
    const fade = Math.min(1, t / 200, (BOSS.warningMs - t) / 300);
    const pulse = 0.5 + 0.5 * Math.sin(t / 110);
    const w = this.width, band = 92;
    const g = this.warnBands.clear();
    g.fillStyle(0x6a0000, 0.28 * fade).fillRect(0, 0, w, VIEW_HEIGHT);
    g.fillStyle(0x2a0000, 0.85 * fade).fillRect(0, VIEW_HEIGHT / 2 - band, w, band * 2);
    g.lineStyle(4, 0xff3a2a, (0.5 + 0.5 * pulse) * fade);
    g.lineBetween(0, VIEW_HEIGHT / 2 - band, w, VIEW_HEIGHT / 2 - band).lineBetween(0, VIEW_HEIGHT / 2 + band, w, VIEW_HEIGHT / 2 + band);
    // 띠 위아래로 흐르는 경고 무늬
    g.fillStyle(0xff3a2a, 0.55 * fade);
    const shift = (t / 6) % 60;
    for (let x = -60 + shift; x < w + 60; x += 60) {
      g.fillTriangle(x, VIEW_HEIGHT / 2 - band - 14, x + 24, VIEW_HEIGHT / 2 - band - 14, x + 12, VIEW_HEIGHT / 2 - band - 2);
      g.fillTriangle(x, VIEW_HEIGHT / 2 + band + 14, x + 24, VIEW_HEIGHT / 2 + band + 14, x + 12, VIEW_HEIGHT / 2 + band + 2);
    }
    this.warnTitle.setAlpha((0.55 + 0.45 * pulse) * fade).setScale(1 + 0.04 * pulse);
    this.warnName.setAlpha(fade);
  }

  showBar(name: string, level: number, hp: number, maxHp: number): void {
    this.shown = { name: `${name}  Lv. ${level}`, hp, maxHp, phase: 1 };
    this.barName.setVisible(true).setText(this.shown.name);
    this.bar.setVisible(true);
    this.drawBar();
  }

  /** 바뀌었을 때만 다시 그린다. */
  setHp(hp: number, maxHp: number, phase: BossPhase): void {
    const s = this.shown;
    if (!s || (s.hp === hp && s.maxHp === maxHp && s.phase === phase)) return;
    s.hp = hp; s.maxHp = maxHp; s.phase = phase;
    this.drawBar();
  }

  hideBar(): void {
    this.shown = undefined;
    this.bar.clear().setVisible(false);
    this.barName.setVisible(false);
  }

  private drawBar(): void {
    const s = this.shown;
    if (!s) return;
    const left = BAR_LEFT, w = Math.max(160, this.width - BAR_RIGHT_MARGIN - left);
    this.barName.setX(left + w / 2);
    const g = this.bar.clear();
    g.fillStyle(0x0d0606, 0.85).fillRoundedRect(left - 4, BAR_Y - 4, w + 8, BAR_HEIGHT + 8, 6);
    g.fillStyle(0x3a1414, 1).fillRect(left, BAR_Y, w, BAR_HEIGHT);
    const ratio = Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1);
    g.fillStyle(s.phase === 1 ? 0xd2382a : 0x8e2bb0, 1).fillRect(left, BAR_Y, w * ratio, BAR_HEIGHT);
    g.fillStyle(0xffffff, 0.18).fillRect(left, BAR_Y, w * ratio, BAR_HEIGHT * 0.4);
    // 2페이즈로 넘어가는 자리
    if (s.phase === 1) g.fillStyle(0xffe0a0, 0.9).fillRect(left + w * BOSS.phaseTwoAt - 1, BAR_Y - 3, 3, BAR_HEIGHT + 6);
    g.lineStyle(1, 0xffb4a4, 0.8).strokeRect(left, BAR_Y, w, BAR_HEIGHT);
  }
}
