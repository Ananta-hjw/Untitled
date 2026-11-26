import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import { actionIcon } from './actionIcons';
import type { Interactable } from '../world/interactables';
import { isMapId, MAPS, type GameMap, type MapExit, type Point } from '../world/maps';
import { CARDINAL, exitDirection, exitPoint, nearbyExit } from '../world/mapNavigation';

type BannerKind = 'passage' | 'enter' | 'exit';

interface BannerTheme {
  base: number;
  topBand: number;
  glow: number;
  border: number;
  innerBorder: number;
  medallionBg: number;
  titleColor: string;
  detailColor: string;
  accentColor: string;
}

const THEMES: Record<BannerKind, BannerTheme> = {
  exit: {
    base: 0x1c140d,
    topBand: 0x352516,
    glow: 0xf4c76a,
    border: 0xf0c974,
    innerBorder: 0xfff0c6,
    medallionBg: 0x2b1e11,
    titleColor: '#fff1cc',
    detailColor: '#e4cfa2',
    accentColor: '#ffd983',
  },
  enter: {
    base: 0x12221a,
    topBand: 0x1e382b,
    glow: 0x8ad8a8,
    border: 0xdcc07a,
    innerBorder: 0xf5e5bc,
    medallionBg: 0x183024,
    titleColor: '#f8ebd0',
    detailColor: '#cde2cf',
    accentColor: '#e8d090',
  },
  passage: {
    base: 0x15221b,
    topBand: 0x203429,
    glow: 0xcab072,
    border: 0xcfb272,
    innerBorder: 0xefe0b8,
    medallionBg: 0x1b2d23,
    titleColor: '#f6dfaa',
    detailColor: '#d0d8c8',
    accentColor: '#e6ca86',
  },
};

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const PANEL_TOP = 142;
const PANEL_HEIGHT = 78;
const MEDALLION_R = 23;

/** 한국어 방향 조사("로"/"으로")를 받침에 맞춰 붙인다 (ㄹ 받침과 받침 없음은 "로"). */
function withDirectionParticle(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return `${name}으로`;
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${name}로` : `${name}으로`;
}

/**
 * 지역 경계 통로 안내와 건물 문 들어가기·실내 나가기 배너를 통일된 금테 판타지 명판으로 표시한다.
 * 문 앞 배너는 직접 눌러서 바로 들어가거나 나갈 수도 있다.
 */
export class ExitHint {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly glyph: Phaser.GameObjects.Text;
  private readonly chevron: Phaser.GameObjects.Text;
  private readonly hitArea: Phaser.GameObjects.Zone;
  private readonly onDoorActivate?: (door: Interactable) => void;
  private activeDoor?: Interactable;
  private fadeTween?: Phaser.Tweens.Tween;
  private pressed = false;
  private last = '';
  private width = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    onDoorActivate?: (door: Interactable) => void,
  ) {
    this.onDoorActivate = onDoorActivate;
    const style = { fontFamily: FONT, fontStyle: 'bold' };
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 7).setVisible(false);
    this.icon = scene.add
      .image(0, 0, actionIcon('exit').texture, actionIcon('exit').frame)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 8)
      .setDisplaySize(34, 34)
      .setVisible(false);
    this.glyph = scene.add
      .text(0, 0, '', { ...style, fontSize: '24px', color: '#f6dfaa', stroke: '#120d08', strokeThickness: 3 })
      .setOrigin(0.5)
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 8)
      .setVisible(false);
    this.title = scene.add
      .text(0, 0, '', { ...style, fontSize: '22px', color: '#f6dfaa', stroke: '#120c06', strokeThickness: 3 })
      .setOrigin(0, 0.5)
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 8)
      .setVisible(false);
    this.detail = scene.add
      .text(0, 0, '', { ...style, fontSize: '14px', color: '#d0d5c7', stroke: '#100c08', strokeThickness: 2 })
      .setOrigin(0, 0.5)
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 8)
      .setVisible(false);
    this.chevron = scene.add
      .text(0, 0, '›', { ...style, fontSize: '28px', color: '#ffd983', stroke: '#120c06', strokeThickness: 3 })
      .setOrigin(0.5)
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 8)
      .setVisible(false);
    this.hitArea = scene.add
      .zone(0, 0, 10, 10)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 9)
      .setVisible(false);

    this.hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.activeDoor) return;
      this.fadeTween?.stop();
      this.fadeTween = undefined;
      this.pressed = true;
      this.setPartsAlpha(0.84);
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setPartsAlpha(1);
    });
    this.hitArea.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setPartsAlpha(1);
      if (this.activeDoor) this.onDoorActivate?.(this.activeDoor);
    });
  }

  layout(width: number): void {
    this.width = width;
    this.last = '!';
  }

  update(
    player: Point,
    hidden: boolean,
    blocked: boolean | ((exit: MapExit) => string | boolean | undefined),
    door?: Interactable,
  ): void {
    const activeDoor = !hidden && door?.enter ? door : undefined;
    const exit = hidden || activeDoor ? undefined : nearbyExit(this.map, player);
    const blockInfo = exit ? (typeof blocked === 'function' ? blocked(exit) : blocked) : false;
    const isBlocked = !!blockInfo;
    const blockMessage = typeof blockInfo === 'string' ? blockInfo : '습격을 막은 뒤 이동할 수 있습니다';
    const id = activeDoor
      ? `door:${activeDoor.id}:${this.width}`
      : exit
        ? `exit:${exit.to}:${isBlocked ? blockMessage : ''}:${this.width}`
        : '';
    this.activeDoor = activeDoor;
    if (id === this.last) return;
    const wasHidden = !this.last || this.last === '!';
    this.last = id;
    this.pressed = false;
    this.fadeTween?.stop();
    this.fadeTween = undefined;

    if (!activeDoor && !exit) {
      this.hideAll();
      return;
    }

    const cx = (this.width || this.scene.scale.gameSize.width) / 2;
    const cy = PANEL_TOP + PANEL_HEIGHT / 2;

    if (activeDoor?.enter) {
      const leaving = !activeDoor.enter.to.startsWith('in-');
      const kind: BannerKind = leaving ? 'exit' : 'enter';
      const theme = THEMES[kind];
      const destination = isMapId(activeDoor.enter.to) ? MAPS[activeDoor.enter.to].name : activeDoor.enter.label;
      const titleText = leaving ? `${withDirectionParticle(destination)} 나가기` : `${activeDoor.enter.label} 들어가기`;
      const detailText = leaving ? '나가기 버튼 · E 키 또는 여기를 터치' : '들어가기 버튼 · E 키 또는 여기를 터치';
      const iconInfo = actionIcon(leaving ? 'exit' : 'enter');

      this.title.setColor(theme.titleColor).setText(titleText);
      this.detail.setColor(theme.detailColor).setText(detailText);
      this.icon.setTexture(iconInfo.texture, iconInfo.frame).setVisible(true);
      this.glyph.setVisible(false);
      this.chevron.setColor(theme.accentColor).setVisible(true);

      const textW = Math.max(this.title.width, this.detail.width);
      const leftSlot = 78;
      const rightSlot = 40;
      const w = Math.max(364, leftSlot + textW + rightSlot);
      const left = cx - w / 2;

      this.drawPlaque(left, PANEL_TOP, w, PANEL_HEIGHT, theme, true);
      this.icon.setPosition(left + 38, cy);
      this.title.setPosition(left + leftSlot, PANEL_TOP + 27);
      this.detail.setPosition(left + leftSlot, PANEL_TOP + 54);
      this.chevron.setPosition(left + w - 21, cy - 1);
      // Zone 크기가 바뀔 때마다 히트 영역도 함께 갱신되도록 비활성화 후 다시 등록한다.
      this.hitArea.disableInteractive();
      this.hitArea.setPosition(cx, cy).setSize(w, PANEL_HEIGHT).setVisible(true).setInteractive({ useHandCursor: true });
      this.panel.setVisible(true);
      this.title.setVisible(true);
      this.detail.setVisible(true);
    } else if (exit) {
      const theme = THEMES.passage;
      const direction = CARDINAL[exitDirection(this.map, exitPoint(this.map, exit))];
      this.title.setColor(theme.titleColor).setText(`${direction.arrow} ${direction.name} · ${MAPS[exit.to].name}`);
      this.detail
        .setColor(isBlocked ? '#f0b89c' : theme.detailColor)
        .setText(isBlocked ? blockMessage : '길 끝으로 이동하면 지역이 바뀝니다');
      this.icon.setVisible(false);
      this.glyph.setColor(isBlocked ? '#f0b89c' : theme.accentColor).setText(direction.arrow).setVisible(true);
      this.chevron.setVisible(false);
      this.hitArea.setVisible(false).disableInteractive();

      const textW = Math.max(this.title.width, this.detail.width);
      const leftSlot = 76;
      const rightSlot = 26;
      const w = Math.max(356, leftSlot + textW + rightSlot);
      const left = cx - w / 2;

      this.drawPlaque(left, PANEL_TOP, w, PANEL_HEIGHT, theme, false);
      this.glyph.setPosition(left + 38, cy);
      this.title.setPosition(left + leftSlot, PANEL_TOP + 27);
      this.detail.setPosition(left + leftSlot, PANEL_TOP + 54);
      this.panel.setVisible(true);
      this.title.setVisible(true);
      this.detail.setVisible(true);
    }

    if (wasHidden) {
      this.setPartsAlpha(0.35);
      this.fadeTween = this.scene.tweens.add({
        targets: [this.panel, this.title, this.detail, this.icon, this.glyph, this.chevron],
        alpha: 1,
        duration: 130,
        ease: 'Quad.easeOut',
      });
    } else {
      this.setPartsAlpha(1);
    }
  }

  private hideAll(): void {
    this.activeDoor = undefined;
    for (const object of [this.panel, this.title, this.detail, this.icon, this.glyph, this.chevron]) {
      object.setVisible(false);
    }
    this.hitArea.setVisible(false).disableInteractive();
  }

  private setPartsAlpha(alpha: number): void {
    for (const object of [this.panel, this.title, this.detail, this.icon, this.glyph, this.chevron]) {
      object.setAlpha(alpha);
    }
  }

  private drawPlaque(left: number, top: number, w: number, h: number, theme: BannerTheme, clickable: boolean): void {
    const g = this.panel.clear();
    const r = 14;
    const cy = top + h / 2;
    const medX = left + 38;

    // 바깥 부드러운 그림자와 따뜻한 후광
    g.fillStyle(0x070503, 0.52).fillRoundedRect(left - 2, top + 4, w + 4, h + 2, r + 2);
    g.fillStyle(theme.glow, clickable ? 0.16 : 0.09).fillRoundedRect(left - 4, top - 3, w + 8, h + 6, r + 3);

    // 본체 (어두운 흑요석 바탕 + 상단 은은한 채광 띠)
    g.fillStyle(theme.base, 0.95).fillRoundedRect(left, top, w, h, r);
    g.fillStyle(theme.topBand, 0.62).fillRoundedRect(left + 2, top + 2, w - 4, h * 0.46, { tl: r - 2, tr: r - 2, bl: 4, br: 4 });
    g.fillStyle(theme.innerBorder, 0.08).fillRoundedRect(left + 10, top + 3, w - 20, 6, 3);

    // 이중 금테 (바깥 굵은 금테 + 안쪽 얇은 상아빛 선)
    g.lineStyle(2, theme.border, 0.92).strokeRoundedRect(left, top, w, h, r);
    g.lineStyle(0.9, theme.innerBorder, 0.32).strokeRoundedRect(left + 3.5, top + 3.5, w - 7, h - 7, r - 3);

    // 네 모서리 세공 장식 (금빛 꺾쇠)
    g.lineStyle(1.6, theme.innerBorder, 0.65);
    const inset = 8;
    const arm = 8;
    const corners: Array<[number, number, number, number]> = [
      [left + inset, top + inset, 1, 1],
      [left + w - inset, top + inset, -1, 1],
      [left + inset, top + h - inset, 1, -1],
      [left + w - inset, top + h - inset, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      g.beginPath();
      g.moveTo(x + sx * arm, y);
      g.lineTo(x, y);
      g.lineTo(x, y + sy * arm);
      g.strokePath();
    }

    // 왼쪽 원형 금장 메달리온
    g.fillStyle(theme.glow, clickable ? 0.2 : 0.12).fillCircle(medX, cy, MEDALLION_R + 4);
    g.fillStyle(theme.medallionBg, 0.96).fillCircle(medX, cy, MEDALLION_R);
    g.lineStyle(1.8, theme.border, 0.92).strokeCircle(medX, cy, MEDALLION_R);
    g.lineStyle(0.8, theme.innerBorder, 0.4).strokeCircle(medX, cy, MEDALLION_R - 3);

    // 메달리온과 글자 사이의 얇은 금빛 구분선 + 중앙 마름모
    const divX = left + 66;
    g.lineStyle(1, theme.border, 0.38);
    g.beginPath();
    g.moveTo(divX, top + 14);
    g.lineTo(divX, top + h - 14);
    g.strokePath();
    g.fillStyle(theme.border, 0.85);
    g.beginPath();
    g.moveTo(divX, cy - 3);
    g.lineTo(divX + 3, cy);
    g.lineTo(divX, cy + 3);
    g.lineTo(divX - 3, cy);
    g.closePath();
    g.fillPath();
  }
}
