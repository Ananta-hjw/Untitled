import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { REGIONS, ROUTES, type RegionId } from '../world/worldMap';

/**
 * 전체 지도 화면. 미니맵을 누르거나 M 키로 연다.
 * 지역을 칸으로 놓고 길을 잇는다. 가 본 곳은 땅 그림과 이름, 안 가 본 곳은 "?"로 보여 준다.
 * 지금 있는 지역은 테두리와 점으로 알려 준다. 퀘스트 표시는 띄우지 않는다.
 * 열려 있는 동안 씬은 게임 시계를 멈춘다. 객체는 처음에 만들어 두고 다시 쓴다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const DEPTH = DEPTH_UI + 50;
const CARD_W = 200;
const CARD_H = 120;
const GAP_X = 60;
const GAP_Y = 46;

interface Card {
  region: RegionId;
  ground: Phaser.GameObjects.Image;
  details: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  unknown: Phaser.GameObjects.Text;
}

export class WorldMap {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly here: Phaser.GameObjects.Arc;
  private readonly cards: Card[] = [];
  private open = false;
  private width = 0;
  private current: RegionId = 'village';
  private visited = new Set<RegionId>();

  constructor(private readonly scene: Phaser.Scene, private readonly onClose: () => void) {
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x000000, 0.65).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    // 화면 어디를 눌러도 닫힌다.
    this.shade.setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.close());
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('지도', 30, '#f5ead2').setOrigin(0.5);
    this.hint = this.text('화면을 누르면 닫힌다', 16, '#b9b2a4').setOrigin(0.5);
    this.here = scene.add.circle(0, 0, 9, 0x5ec8ff).setStrokeStyle(3, 0xffffff).setScrollFactor(0).setDepth(DEPTH + 5);
    for (const region of REGIONS) {
      const ground = scene.add.image(0, 0, 'village-ground').setScrollFactor(0).setDepth(DEPTH + 2);
      const details = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 3);
      const name = this.text(region.name, 19, '#fff4d6').setOrigin(0.5).setStroke('#1a1008', 5).setDepth(DEPTH + 4);
      const unknown = this.text('?', 64, '#8a7f6e').setOrigin(0.5).setDepth(DEPTH + 4);
      this.cards.push({ region: region.id, ground, details, name, unknown });
    }
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(current: RegionId, visited: Set<RegionId>): void {
    this.current = current;
    this.visited = visited;
    this.open = true;
    this.setVisible(true);
    this.draw();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.setVisible(false);
    this.onClose();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    if (this.shade.input) this.shade.input.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.draw();
  }

  /** 지금 있는 곳 표시가 깜빡인다. 씬이 실제 시간으로 부른다. */
  update(realTime: number): void {
    if (this.open) this.here.setScale(1 + 0.25 * Math.abs(Math.sin(realTime / 300)));
  }

  private draw(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const cx = width / 2, cy = VIEW_HEIGHT / 2 + 14;
    const panelW = CARD_W * 3 + GAP_X * 2 + 90, panelH = CARD_H * 3 + GAP_Y * 2 + 130;
    const center = (gx: number, gy: number) => ({ x: cx + gx * (CARD_W + GAP_X), y: cy + gy * (CARD_H + GAP_Y) });

    const g = this.panel.clear();
    g.fillStyle(0x140c06, 0.95).fillRoundedRect(cx - panelW / 2, cy - panelH / 2 - 14, panelW, panelH, 18);
    g.lineStyle(3, 0xe8c37a, 0.85).strokeRoundedRect(cx - panelW / 2, cy - panelH / 2 - 14, panelW, panelH, 18);
    this.title.setPosition(cx, cy - panelH / 2 + 18);
    this.hint.setPosition(cx, cy + panelH / 2 - 34);

    // 길: 둘 다 가 본 곳이면 실선, 아니면 점선
    for (const [a, b] of ROUTES) {
      const ra = REGIONS.find((r) => r.id === a)!, rb = REGIONS.find((r) => r.id === b)!;
      const pa = center(ra.gx, ra.gy), pb = center(rb.gx, rb.gy);
      const known = this.visited.has(a) && this.visited.has(b);
      const steps = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 14);
      g.lineStyle(6, known ? 0xc9a36a : 0x5a4e3e, 1);
      for (let i = 0; i < steps; i++) {
        if (!known && i % 2) continue;
        const t0 = i / steps, t1 = (i + 1) / steps;
        g.lineBetween(pa.x + (pb.x - pa.x) * t0, pa.y + (pb.y - pa.y) * t0, pa.x + (pb.x - pa.x) * t1, pa.y + (pb.y - pa.y) * t1);
      }
    }

    for (const card of this.cards) {
      const region = REGIONS.find((r) => r.id === card.region)!;
      const p = center(region.gx, region.gy);
      const left = p.x - CARD_W / 2, top = p.y - CARD_H / 2;
      const known = this.visited.has(region.id);
      const isHere = region.id === this.current;
      g.fillStyle(known ? 0x000000 : 0x2a2218, known ? 0.4 : 1).fillRoundedRect(left - 4, top - 4, CARD_W + 8, CARD_H + 8, 12);
      g.lineStyle(isHere ? 5 : 3, isHere ? 0x5ec8ff : known ? 0xe8c37a : 0x6b5d48, 1).strokeRoundedRect(left - 4, top - 4, CARD_W + 8, CARD_H + 8, 12);

      card.ground.setVisible(known).setPosition(p.x, p.y).setDisplaySize(CARD_W, CARD_H);
      if (region.tint !== undefined) card.ground.setTint(region.tint); else card.ground.clearTint();
      card.details.clear().setVisible(known);
      if (known) this.drawDetails(card.details, region.id, left, top);
      card.name.setVisible(known).setPosition(p.x, top + CARD_H - 16);
      card.unknown.setVisible(!known).setPosition(p.x, p.y - 8);
      if (isHere) this.here.setPosition(p.x, p.y - 12);
    }
    this.here.setVisible(true);
  }

  /** 가 본 지역의 작은 그림: 마을은 건물, 개울가는 물줄기, 숲길은 나무 */
  private drawDetails(g: Phaser.GameObjects.Graphics, region: RegionId, left: number, top: number): void {
    if (region === 'village') {
      // 건물 아틀라스를 칸에 맞춰 작게 그리기 어렵기 때문에 지붕 색 블록으로 간단히 나타낸다.
      const roofs = [[0.22, 0.32, 0xc0603a], [0.5, 0.26, 0x4a5a78], [0.78, 0.32, 0x7aa05a], [0.22, 0.62, 0x3b3b3b], [0.78, 0.6, 0xe0a83a]];
      for (const [fx, fy, color] of roofs) {
        g.fillStyle(color, 1).fillTriangle(left + fx * CARD_W - 16, top + fy * CARD_H + 8, left + fx * CARD_W, top + fy * CARD_H - 8, left + fx * CARD_W + 16, top + fy * CARD_H + 8);
        g.fillStyle(0xe9dcc0, 1).fillRect(left + fx * CARD_W - 12, top + fy * CARD_H + 8, 24, 12);
      }
      g.fillStyle(0x4f8a4a, 1).fillCircle(left + CARD_W * 0.5, top + CARD_H * 0.55, 13);
    } else if (region === 'east-stream') {
      g.fillStyle(0x4f9fc4, 0.95).fillRect(left, top, CARD_W, CARD_H * 0.28);
    } else if (region === 'west-forest') {
      for (const [fx, fy] of [[0.15, 0.3], [0.35, 0.22], [0.6, 0.35], [0.82, 0.25], [0.25, 0.6], [0.7, 0.62]]) {
        g.fillStyle(0x2f5e34, 1).fillTriangle(left + fx * CARD_W - 12, top + fy * CARD_H + 14, left + fx * CARD_W, top + fy * CARD_H - 14, left + fx * CARD_W + 12, top + fy * CARD_H + 14);
      }
    }
  }

  private setVisible(visible: boolean): void {
    for (const o of [this.shade, this.panel, this.title, this.hint, this.here]) o.setVisible(visible);
    for (const c of this.cards) for (const o of [c.ground, c.details, c.name, c.unknown]) o.setVisible(visible && o.visible);
    if (!visible) for (const c of this.cards) for (const o of [c.ground, c.details, c.name, c.unknown]) o.setVisible(false);
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH + 2).setResolution(2);
  }
}
