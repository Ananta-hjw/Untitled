import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import type { DeathReport } from '../combat/damageLog';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
/** 표에 보이는 줄 수 (deathReport의 maxRows와 같다) */
export const DEATH_ROWS = 5;
const ROW_HEIGHT = 44;

/**
 * 시온이 쓰러졌을 때 보여 주는 창: 마지막 일격, 누구에게 몇 번 얼마나 맞았는지, 다시 시작할 곳.
 * 확인(또는 Enter·Space·Esc·뒤로 가기)을 누르면 닫히고 장면이 마지막으로 쉰 곳으로 옮긴다.
 * 열려 있는 동안 게임 시간은 멈춘다(GameScene.menuOpen).
 */
export class DeathPanel {
  private readonly scene: Phaser.Scene;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly killer: Phaser.GameObjects.Text;
  private readonly header: Phaser.GameObjects.Text[];
  private readonly rows: Phaser.GameObjects.Text[][];
  private readonly total: Phaser.GameObjects.Text[];
  private readonly destination: Phaser.GameObjects.Text;
  private readonly confirmButton: Phaser.GameObjects.Text;
  private readonly blocker: Phaser.GameObjects.Zone;
  private onConfirm?: () => void;
  private width = 0;
  private shownRows = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // 뒤의 버튼이 눌리지 않게 화면 전체를 막는다.
    this.blocker = scene.add.zone(0, 0, 10, VIEW_HEIGHT).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 60).setInteractive();
    this.shade = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 60);
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 61);
    this.title = this.label('쓰러졌습니다', 36, '#ffb3a6');
    this.killer = this.label('', 24, '#f3e4be');
    this.header = [this.label('상대', 20, '#9fb6a6'), this.label('맞은 횟수', 20, '#9fb6a6').setOrigin(1, 0), this.label('받은 피해', 20, '#9fb6a6').setOrigin(1, 0)];
    this.rows = Array.from({ length: DEATH_ROWS }, () => [
      this.label('', 24, '#e8eee9'), this.label('', 24, '#c9d6cc').setOrigin(1, 0), this.label('', 24, '#ff9d8a').setOrigin(1, 0),
    ]);
    this.total = [this.label('합계', 24, '#f7ebd0'), this.label('', 24, '#f7ebd0').setOrigin(1, 0), this.label('', 24, '#ff8a7a').setOrigin(1, 0)];
    this.destination = this.label('', 21, '#b8cbbd').setLineSpacing(8);
    this.confirmButton = this.label('확인', 28, '#1a302a').setFixedSize(300, 76).setAlign('center')
      .setPadding(0, 21, 0, 0).setBackgroundColor('#dfc18a')
      .setInteractive({ useHandCursor: true }).on('pointerup', () => this.confirm());
    this.hide();
  }

  get isOpen(): boolean { return this.onConfirm !== undefined; }

  /** destination: 다시 시작할 곳 (예: "마지막으로 쉰 곳(여관)") */
  open(report: DeathReport, destination: string, onConfirm: () => void): void {
    this.onConfirm = onConfirm;
    const k = report.killer;
    this.killer.setText(k ? `마지막 일격 · ${k.name} Lv. ${k.level} · 피해 ${k.damage}` : '마지막 일격 · 알 수 없음');
    this.shownRows = Math.min(DEATH_ROWS, report.rows.length);
    report.rows.slice(0, DEATH_ROWS).forEach((row, i) => {
      const [name, hits, damage] = this.rows[i];
      name.setText(row.level > 0 ? `${row.name}  Lv. ${row.level}` : row.name);
      hits.setText(`${row.hits}회`);
      damage.setText(`${row.damage}`);
    });
    this.total[1].setText(`${report.rows.reduce((n, r) => n + r.hits, 0)}회`);
    this.total[2].setText(`${report.total}`);
    this.destination.setText(`확인을 누르면 ${destination}에서 다시 시작합니다.\n체력과 마나는 모두 회복됩니다.`);
    for (const object of this.objects()) object.setVisible(true);
    this.rows.forEach((row, i) => row.forEach((t) => t.setVisible(i < this.shownRows)));
    this.layout(this.width || this.scene.scale.gameSize.width);
  }

  /** 확인: 창을 닫고 다시 시작한다. */
  confirm(): void {
    const callback = this.onConfirm;
    if (!callback) return;
    this.hide();
    callback();
  }

  layout(width: number): void {
    this.width = width;
    this.blocker.setSize(width, VIEW_HEIGHT);
    this.blocker.input?.hitArea.setSize(width, VIEW_HEIGHT);
    this.shade.clear().fillStyle(0x0a0404, 0.7).fillRect(0, 0, width, VIEW_HEIGHT);
    const w = Math.min(820, width - 80), left = (width - w) / 2, top = 40, height = 640;
    const g = this.panel.clear();
    g.fillStyle(0x1d1414, 0.98).fillRoundedRect(left, top, w, height, 18);
    g.lineStyle(1, 0xc98a7c, 0.9).strokeRoundedRect(left, top, w, height, 18);
    this.title.setPosition(left + 36, top + 28);
    this.killer.setPosition(left + 36, top + 84);
    g.lineStyle(1, 0x6b4a44, 0.7).lineBetween(left + 36, top + 128, left + w - 36, top + 128);
    const colHits = left + w - 220, colDamage = left + w - 40;
    const place = (cells: Phaser.GameObjects.Text[], y: number) => {
      cells[0].setPosition(left + 40, y);
      cells[1].setPosition(colHits, y);
      cells[2].setPosition(colDamage, y);
    };
    place(this.header, top + 142);
    this.rows.forEach((row, i) => {
      const y = top + 180 + i * ROW_HEIGHT;
      if (i < this.shownRows && i % 2 === 0) g.fillStyle(0x2a1d1c, 1).fillRect(left + 28, y - 8, w - 56, ROW_HEIGHT);
      place(row, y);
    });
    const totalY = top + 180 + Math.max(1, this.shownRows) * ROW_HEIGHT + 10;
    g.lineStyle(1, 0x6b4a44, 0.7).lineBetween(left + 36, totalY - 6, left + w - 36, totalY - 6);
    place(this.total, totalY + 4);
    this.destination.setPosition(left + 36, top + 470).setWordWrapWidth(w - 72);
    this.confirmButton.setPosition(left + (w - 300) / 2, top + height - 100);
  }

  private objects(): Phaser.GameObjects.Components.Visible[] {
    return [this.blocker, this.shade, this.panel, this.title, this.killer, ...this.header, ...this.rows.flat(), ...this.total, this.destination, this.confirmButton];
  }

  private hide(): void {
    this.onConfirm = undefined;
    for (const object of this.objects()) object.setVisible(false);
  }

  private label(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(DEPTH_UI + 62).setResolution(2);
  }
}
