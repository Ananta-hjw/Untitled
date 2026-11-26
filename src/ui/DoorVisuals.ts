import Phaser from 'phaser';
import { DEPTH_LIGHTING } from '../config';
import { doorOf } from '../world/interiors';
import type { GameMap } from '../world/maps';

export type WorldBadgeKind = 'exit' | 'enter' | 'talk';

interface BadgeStyle {
  bg: number;
  glow: number;
  border: number;
  innerBorder: number;
  sheen: number;
  textColor: string;
}

const BADGE_STYLES: Record<WorldBadgeKind, BadgeStyle> = {
  exit: {
    bg: 0x1d150d,
    glow: 0xf4c76b,
    border: 0xefc770,
    innerBorder: 0xfff0c4,
    sheen: 0xffe4a0,
    textColor: '#fff1cc',
  },
  enter: {
    bg: 0x12221a,
    glow: 0x8bd8a8,
    border: 0xdcc07a,
    innerBorder: 0xf7e7bc,
    sheen: 0xd4f4dc,
    textColor: '#f8ebd0',
  },
  talk: {
    bg: 0x1d1812,
    glow: 0xd9c290,
    border: 0xcab07b,
    innerBorder: 0xf0e0ba,
    sheen: 0xf5e8c8,
    textColor: '#f5ead2',
  },
};

/**
 * 문턱 바닥 가이드(실내 출구 빛·방향 화살표, 야외 건물 문턱 빛)와
 * 대상 위 말풍선·출입 명판(talkMarker 뒤 배경)을 하나의 따뜻한 중세 판타지 톤으로 그린다.
 *
 * 실내 배경 조각('map-art-*', 'interior-furniture-*')과 겹치지 않는 이름과 깊이를 쓴다.
 */
export class DoorVisuals {
  private readonly floorGlow: Phaser.GameObjects.Graphics;
  private readonly badgeBg: Phaser.GameObjects.Graphics;
  private readonly indoorDoor?: { x: number; y: number };
  private outdoorSpot?: { x: number; y: number };
  private indoorActive = false;
  private badgeVisible = false;
  private lastBadgeKey = '';

  constructor(scene: Phaser.Scene, map: GameMap) {
    this.indoorDoor = map.interior ? doorOf(map.interior) : map.indoorThreshold;
    // 실내 바닥(-110) 위, 캐릭터·가구 가림막(y좌표)·전경 벽보다 아래에 그려 자연스럽게 밟고 지나간다.
    this.floorGlow = scene.add
      .graphics()
      .setDepth(map.interior ? -102 : -95)
      .setName('door-threshold-guide');
    this.badgeBg = scene.add
      .graphics()
      .setDepth(DEPTH_LIGHTING + 3)
      .setVisible(false)
      .setName('interact-badge-bg');
  }

  /** 실내 문턱의 은은한 출구 빛과 야외 건물 문 앞 강조를 매 프레임 부드럽게 갱신한다. */
  updateFloor(time: number, activeDoor?: { x: number; y: number; leaving: boolean }): void {
    const g = this.floorGlow;
    if (this.indoorDoor) {
      const active = !!activeDoor?.leaving;
      this.indoorActive = active;
      this.drawIndoorThreshold(g, this.indoorDoor.x, this.indoorDoor.y, time, active);
      return;
    }
    if (activeDoor && !activeDoor.leaving) {
      this.outdoorSpot = { x: activeDoor.x, y: activeDoor.y };
      this.drawOutdoorThreshold(g, activeDoor.x, activeDoor.y, time);
    } else if (this.outdoorSpot) {
      this.outdoorSpot = undefined;
      g.clear();
    }
  }

  /** talkMarker 텍스트 뒤에 금테 판타지 명판과 아래쪽 꼬리를 맞춘다. */
  updateBadge(marker: Phaser.GameObjects.Text, kind: WorldBadgeKind): void {
    const style = BADGE_STYLES[kind];
    if (marker.style.color !== style.textColor) marker.setColor(style.textColor);
    const padX = kind === 'talk' ? 12 : 20;
    const padY = kind === 'talk' ? 5 : 7;
    const textH = Math.ceil(marker.height);
    const w = Math.max(kind === 'talk' ? 56 : 120, Math.ceil(marker.width) + padX * 2);
    const h = textH + padY * 2;
    const r = Math.min(14, h / 2);
    const cx = marker.x;
    const bottom = marker.y + padY;
    const top = bottom - h;
    const left = cx - w / 2;

    const key = `${kind}:${w}:${h}`;
    if (!this.badgeVisible || key !== this.lastBadgeKey) {
      this.lastBadgeKey = key;
      this.redrawBadgeShape(w, h, r, style, kind !== 'talk');
    }
    this.badgeVisible = true;
    this.badgeBg.setPosition(left, top).setVisible(true);
  }

  hideBadge(): void {
    if (!this.badgeVisible) return;
    this.badgeVisible = false;
    this.badgeBg.setVisible(false);
  }

  get isIndoorActive(): boolean {
    return this.indoorActive;
  }

  private redrawBadgeShape(w: number, h: number, r: number, style: BadgeStyle, ornate: boolean): void {
    const g = this.badgeBg.clear();
    const cx = w / 2;
    const tailW = 7;
    const tailH = 7;

    // 바깥 부드러운 후광과 그림자
    g.fillStyle(0x090604, 0.45).fillRoundedRect(-2, 2, w + 4, h + 3, r + 2);
    if (ornate) {
      g.fillStyle(style.glow, 0.16).fillRoundedRect(-4, -3, w + 8, h + 6, r + 3);
    }

    // 본체
    g.fillStyle(style.bg, 0.93).fillRoundedRect(0, 0, w, h, r);

    // 상단 은은한 유리 광택 띠
    g.fillStyle(style.sheen, ornate ? 0.12 : 0.08).fillRoundedRect(4, 2, w - 8, Math.max(6, h * 0.36), Math.max(4, r - 3));

    // 아래쪽 말풍선 꼬리
    g.fillStyle(style.bg, 0.94);
    g.fillTriangle(cx - tailW, h - 1, cx + tailW, h - 1, cx, h + tailH);

    // 이중 금테 (바깥 굵은 테 + 안쪽 얇은 하이라이트)
    g.lineStyle(1.8, style.border, 0.95).strokeRoundedRect(0, 0, w, h, r);
    g.lineStyle(0.8, style.innerBorder, 0.35).strokeRoundedRect(2.5, 2.5, w - 5, h - 5, Math.max(3, r - 2));

    // 꼬리 테두리 양변
    g.lineStyle(1.6, style.border, 0.92);
    g.beginPath();
    g.moveTo(cx - tailW, h);
    g.lineTo(cx, h + tailH);
    g.lineTo(cx + tailW, h);
    g.strokePath();

    // 문 출입 명판 좌우의 작은 다이아몬드 장식 못
    if (ornate) {
      g.fillStyle(style.border, 0.9);
      for (const rx of [9, w - 9]) {
        const ry = h / 2;
        g.beginPath();
        g.moveTo(rx, ry - 3);
        g.lineTo(rx + 3, ry);
        g.lineTo(rx, ry + 3);
        g.lineTo(rx - 3, ry);
        g.closePath();
        g.fillPath();
      }
    }
  }

  private drawIndoorThreshold(g: Phaser.GameObjects.Graphics, x: number, y: number, time: number, active: boolean): void {
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 480);
    // 방 바닥 문턱 위로 따뜻한 바깥 햇살이 스며드는 느낌의 부드러운 빛무리
    const cy = y - 22;
    const baseW = active ? 228 : 196;
    const baseH = active ? 76 : 62;
    const outerAlpha = active ? 0.24 + pulse * 0.1 : 0.12 + pulse * 0.05;
    const innerAlpha = active ? 0.26 + pulse * 0.1 : 0.14 + pulse * 0.06;

    g.fillStyle(0xffcf70, outerAlpha).fillEllipse(x, cy, baseW, baseH);
    g.fillStyle(0xffe9a8, innerAlpha).fillEllipse(x, cy + 4, baseW * 0.64, baseH * 0.56);

    // 밟고 서면 문턱 경계가 은은한 금빛 이중 고리로 또렷해진다.
    if (active) {
      g.lineStyle(2.2, 0xf6d37e, 0.72 + pulse * 0.2).strokeEllipse(x, cy, baseW * 0.92, baseH * 0.86);
      g.lineStyle(1, 0xfff5d6, 0.45).strokeEllipse(x, cy, baseW * 0.78, baseH * 0.72);
    } else {
      g.lineStyle(1.4, 0xe8c474, 0.34 + pulse * 0.16).strokeEllipse(x, cy, baseW * 0.86, baseH * 0.78);
    }

    // 아래(출구) 방향을 가리키는 부드럽게 흐르는 이중 셰브론 화살표
    const drift = ((time / 950) % 1);
    for (let i = 0; i < 2; i++) {
      const phase = (drift + i * 0.5) % 1;
      const alpha = Math.sin(phase * Math.PI) * (active ? 0.95 : 0.65);
      if (alpha <= 0.03) continue;
      const ay = cy - 16 + phase * 30;
      const halfW = active ? 17 : 14;
      const tip = active ? 9 : 7.5;
      g.lineStyle(active ? 3.2 : 2.5, 0xfff0c2, alpha);
      g.beginPath();
      g.moveTo(x - halfW, ay);
      g.lineTo(x, ay + tip);
      g.lineTo(x + halfW, ay);
      g.strokePath();
    }
  }

  private drawOutdoorThreshold(g: Phaser.GameObjects.Graphics, x: number, y: number, time: number): void {
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 420);
    const cy = y - 10;
    g.fillStyle(0x8be2ad, 0.14 + pulse * 0.06).fillEllipse(x, cy, 174, 60);
    g.fillStyle(0xffe7a6, 0.16 + pulse * 0.07).fillEllipse(x, cy - 2, 114, 38);
    g.lineStyle(2, 0xe6c77c, 0.62 + pulse * 0.22).strokeEllipse(x, cy, 162, 54);

    // 건물 안쪽(위)을 향하는 은은한 입장 화살표
    const drift = ((time / 900) % 1);
    const alpha = Math.sin(drift * Math.PI) * 0.85;
    if (alpha > 0.04) {
      const ay = cy + 8 - drift * 22;
      g.lineStyle(2.8, 0xfff0c4, alpha);
      g.beginPath();
      g.moveTo(x - 13, ay + 7);
      g.lineTo(x, ay);
      g.lineTo(x + 13, ay + 7);
      g.strokePath();
    }
  }
}
