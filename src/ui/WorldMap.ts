import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { MAPS, isIndoorMap, type GameMap, type MapId, type Point } from '../world/maps';
import { CARDINAL, exitDirection, exitPoint, type Cardinal } from '../world/mapNavigation';
import { mapPreview, type MapPreview } from './mapPreview';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const DEPTH = DEPTH_UI + 50;
interface Label { text: Phaser.GameObjects.Text; point: Point; direction?: Cardinal; target?: MapId }
interface Dots { npcs: Point[]; enemies: Point[] }

/** Actual current-map art, with current positions. Opening pauses gameplay; it never travels on click. */
export class WorldMap {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;
  private readonly compass: Phaser.GameObjects.Text;
  private readonly here: Phaser.GameObjects.Arc;
  private readonly legend: Phaser.GameObjects.Text[];
  private readonly labels: Label[] = [];
  private readonly preview: MapPreview;
  private open = false;
  private width = 0;
  private player: Point = { x: 0, y: 0 };
  private dots: Dots = { npcs: [], enemies: [] };
  private blocked: boolean | ReadonlySet<MapId> = false;
  private blockNote = '';
  private mapRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly map: GameMap, private readonly onClose: () => void) {
    this.preview = mapPreview(scene, map);
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x030907, .84).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    this.shade.setInteractive().on('pointerup', () => this.close());
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.image = scene.add.image(0, 0, this.preview.key, this.preview.frame).setOrigin(0).setScrollFactor(0).setDepth(DEPTH + 2);
    // Inspecting the map should not accidentally dismiss it.
    this.image.setInteractive();
    this.marks = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 3);
    this.title = this.text(map.name, 30, '#f6edd9');
    this.subtitle = this.text('현재 지역 전체 · 파란 점이 내 위치입니다', 16, '#b8c6b3');
    this.closeButton = this.text('닫기 ×', 20, '#f5deb0').setOrigin(.5).setPadding(16, 10).setBackgroundColor('#344337');
    this.closeButton.setInteractive({ useHandCursor: true }).on('pointerup', () => this.close());
    this.compass = this.text('북 ↑', 16, '#f5deb0').setPadding(8, 5).setBackgroundColor('#17241d');
    this.here = scene.add.circle(0, 0, 7, 0x67d6ff).setStrokeStyle(2.5, 0xffffff).setScrollFactor(0).setDepth(DEPTH + 6);
    this.legend = [this.text('● 내 위치', 16, '#67d6ff'), this.text('● 마을 사람', 16, '#f8edce'),
      this.text('● 몬스터', 16, '#ff8a78'), this.text('◆ 연결 통로', 16, '#f3c568')];
    for (const building of map.buildings) {
      if (building.label) this.labels.push({ point: building,
        text: this.text(building.label, 16, '#fff4dd').setOrigin(.5, 0).setStroke('#142019', 4) });
    }
    for (const prop of map.props) {
      if (prop.label) this.labels.push({ point: prop,
        text: this.text(prop.label, 15, '#fff4dd').setOrigin(.5, 0).setStroke('#142019', 4) });
    }
    const passages = map.exits.map(exit => ({ point: exitPoint(map, exit), target: exit.to,
      direction: exitDirection(map, exitPoint(map, exit)) }));
    if (isIndoorMap(map)) {
      for (const spot of map.interactables) if (spot.enter && spot.enter.to in MAPS) passages.push({
        point: spot, target: spot.enter.to as keyof typeof MAPS, direction: 'south',
      });
    }
    for (const passage of passages) {
      const direction = CARDINAL[passage.direction];
      this.labels.push({ point: passage.point, direction: passage.direction, target: passage.target,
        text: this.text(`${direction.arrow} ${MAPS[passage.target].name}`, 17, '#ffe2a0')
          .setPadding(8, 5).setBackgroundColor('#17241d') });
    }
    this.setVisible(false);
  }

  get isOpen(): boolean { return this.open; }
  show(player: Point, dots: Dots, blocked: boolean | ReadonlySet<MapId> = false, blockNote = ''): void {
    this.player = { x: player.x, y: player.y };
    this.dots = dots; this.blocked = blocked; this.blockNote = blockNote;
    this.open = true; this.setVisible(true); this.draw();
  }
  close(): void {
    if (!this.open) return;
    this.open = false; this.setVisible(false); this.onClose();
  }
  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    if (this.shade.input) this.shade.input.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.draw();
  }
  update(realTime: number): void { if (this.open) this.here.setScale(1 + .18 * Math.abs(Math.sin(realTime / 350))); }

  private project(point: Point): Point {
    const b = this.preview.bounds, r = this.mapRect;
    return { x: r.x + (point.x - b.left) / (b.right - b.left) * r.w,
      y: r.y + (point.y - b.top) / (b.bottom - b.top) * r.h };
  }
  private draw(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const panelW = Math.min(width - 48, 1180), left = (width - panelW) / 2;
    this.panel.clear().fillStyle(0x142019, .99).fillRoundedRect(left, 26, panelW, 668, 18)
      .lineStyle(1.5, 0xc4aa72, .9).strokeRoundedRect(left, 26, panelW, 668, 18);
    this.title.setPosition(left + 28, 48); this.subtitle.setPosition(left + 29, 91);
    this.closeButton.setPosition(left + panelW - 75, 72);
    const fit = Math.min((panelW - 60) / this.preview.width, 494 / this.preview.height);
    const w = this.preview.width * fit, h = this.preview.height * fit;
    this.mapRect = { x: (width - w) / 2, y: 134 + (494 - h) / 2, w, h };
    const r = this.mapRect;
    this.image.setPosition(r.x, r.y).setDisplaySize(w, h);
    this.compass.setPosition(r.x + 10, r.y + 10);
    const g = this.marks.clear().lineStyle(2, 0x8a986b, .8).strokeRect(r.x - 1, r.y - 1, w + 2, h + 2);
    const dot = (point: Point, color: number, size: number) => {
      const p = this.project(point);
      g.fillStyle(0x10190f, .8).fillCircle(p.x, p.y, size + 2).fillStyle(color).fillCircle(p.x, p.y, size);
    };
    for (const point of this.dots.enemies) dot(point, 0xff8a78, 3.5);
    for (const point of this.dots.npcs) dot(point, 0xf8edce, 3.5);
    for (const label of this.labels) {
      const p = this.project(label.point), t = label.text;
      if (!label.direction) { t.setPosition(p.x, p.y + 5); continue; }
      const locked = typeof this.blocked === 'boolean' ? this.blocked : !!label.target && this.blocked.has(label.target);
      dot(label.point, locked ? 0x9c9b8a : 0xf3c568, 5);
      t.setColor(locked ? '#b6b4a6' : '#ffe2a0');
      const dir = label.direction;
      t.setOrigin(dir === 'east' ? 1 : dir === 'west' ? 0 : .5, dir === 'north' ? 0 : dir === 'south' ? 1 : .5)
        .setPosition(p.x + (dir === 'east' ? -14 : dir === 'west' ? 14 : 0), p.y + (dir === 'north' ? 14 : dir === 'south' ? -14 : 0));
      // Keep destination text readable even for exits at the edge of an irregular room.
      const box = t.getBounds();
      t.x += Math.max(0, r.x + 5 - box.left) - Math.max(0, box.right - r.x - r.w + 5);
      t.y += Math.max(0, r.y + 5 - box.top) - Math.max(0, box.bottom - r.y - r.h + 5);
    }
    const p = this.project(this.player); this.here.setPosition(p.x, p.y);
    const positions = [-220, -80, 65, 210];
    this.legend.forEach((text, i) => text.setPosition(width / 2 + positions[i], 652).setOrigin(.5));
    const hasBlocked = typeof this.blocked === 'boolean' ? this.blocked : this.blocked.size > 0;
    this.subtitle.setText(hasBlocked
      ? `현재 지역 전체 · ${this.blockNote || '습격 중에는 마을 밖 사냥터로 나갈 수 없습니다'}`
      : '현재 지역 전체 · 파란 점이 내 위치입니다');
  }

  private setVisible(visible: boolean): void {
    for (const object of [this.shade, this.panel, this.image, this.marks, this.title, this.subtitle,
      this.closeButton, this.compass, this.here, ...this.legend, ...this.labels.map(l => l.text)]) object.setVisible(visible);
  }
  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH + 5).setResolution(2);
  }
}
