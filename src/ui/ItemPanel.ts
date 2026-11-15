import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { ITEMS, ITEM_IDS, countOf, type Inventory, type ItemId } from '../items/inventory';

/**
 * 가방과 잡화점 화면.
 *
 * - 가방: 가진 아이템과 골드를 보여 주고, 회복 아이템은 그 자리에서 쓴다.
 * - 잡화점(메리나): 파는 물건을 사고, 가진 물건을 판다.
 * 열려 있는 동안 씬은 게임 시계를 멈춘다(GameScene.update). 객체는 처음에 만들어 두고 다시 쓴다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const DEPTH = DEPTH_UI + 45;
const WIDTH = 640;
const ROW_HEIGHT = 62;
const MAX_ROWS = ITEM_IDS.length * 2;

export type PanelMode = 'bag' | 'shop';
export type PanelAction = { type: 'use' | 'buy' | 'sell'; id: ItemId };

interface Row {
  name: Phaser.GameObjects.Text;
  note: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Text;
  action?: PanelAction;
}

export class ItemPanel {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly gold: Phaser.GameObjects.Text;
  private readonly empty: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;
  private readonly rows: Row[] = [];
  private mode: PanelMode = 'bag';
  private open = false;
  private width = 0;
  private visibleRows = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onAction: (action: PanelAction) => void,
    private readonly onClose: () => void,
  ) {
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x000000, 0.55).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    this.shade.setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('', 32, '#f5ead2').setOrigin(0.5);
    this.gold = this.text('', 22, '#ffd23f').setOrigin(1, 0.5);
    this.empty = this.text('가방이 비어 있다.', 22, '#b9b2a4').setOrigin(0.5);
    this.closeButton = this.button('닫기', () => this.close());
    for (let i = 0; i < MAX_ROWS; i++) {
      const row: Row = {
        name: this.text('', 23, '#f5ead2').setOrigin(0, 0.5),
        note: this.text('', 16, '#c9bba0').setOrigin(0, 0.5),
        button: this.button('', () => row.action && this.onAction(row.action)),
      };
      row.button.setFontSize(20).setPadding(16, 8, 16, 8);
      this.rows.push(row);
    }
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(mode: PanelMode, inventory: Inventory): void {
    this.mode = mode;
    this.open = true;
    this.setVisible(true);
    this.refresh(inventory);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.setVisible(false);
    this.onClose();
  }

  /** 가방 내용이 바뀌면 다시 그린다. */
  refresh(inventory: Inventory): void {
    if (!this.open) return;
    const entries: Array<{ name: string; note: string; button: string; action?: PanelAction; enabled: boolean }> = [];
    if (this.mode === 'bag') {
      for (const id of ITEM_IDS) {
        const count = countOf(inventory, id);
        if (count === 0) continue;
        const def = ITEMS[id];
        const usable = def.kind === 'consumable';
        entries.push({ name: `${def.name}  ×${count}`, note: def.description, button: usable ? '사용' : '', action: usable ? { type: 'use', id } : undefined, enabled: usable });
      }
    } else {
      for (const id of ITEM_IDS) {
        const def = ITEMS[id];
        if (def.price === undefined) continue;
        entries.push({ name: `${def.name}  (가진 것 ${countOf(inventory, id)})`, note: def.description, button: `사기 ${def.price}G`, action: { type: 'buy', id }, enabled: inventory.gold >= def.price });
      }
      for (const id of ITEM_IDS) {
        const count = countOf(inventory, id);
        if (count === 0) continue;
        const def = ITEMS[id];
        entries.push({ name: `${def.name}  ×${count}`, note: '잡화점에 판다', button: `팔기 ${def.sellPrice}G`, action: { type: 'sell', id }, enabled: true });
      }
    }
    this.visibleRows = entries.length;
    this.rows.forEach((row, i) => {
      const entry = entries[i];
      const shown = !!entry;
      row.name.setVisible(shown);
      row.note.setVisible(shown);
      row.button.setVisible(shown && !!entry?.button);
      if (!entry) return;
      row.name.setText(entry.name);
      row.note.setText(entry.note);
      row.button.setText(entry.button).setAlpha(entry.enabled ? 1 : 0.4);
      row.action = entry.enabled ? entry.action : undefined;
    });
    this.title.setText(this.mode === 'bag' ? '가방' : '메리나의 잡화점');
    this.gold.setText(`${inventory.gold.toLocaleString()} G`);
    this.empty.setVisible(this.mode === 'bag' && entries.length === 0);
    this.place();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    if (this.shade.input) this.shade.input.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.place();
  }

  private place(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const cx = width / 2;
    const rows = Math.max(1, this.visibleRows);
    const height = 170 + rows * ROW_HEIGHT;
    const top = Math.max(10, (VIEW_HEIGHT - height) / 2);
    const left = cx - WIDTH / 2;
    const g = this.panel.clear();
    g.fillStyle(0x140c06, 0.95).fillRoundedRect(left, top, WIDTH, height, 16);
    g.lineStyle(3, 0xe8c37a, 0.85).strokeRoundedRect(left, top, WIDTH, height, 16);
    this.title.setPosition(cx, top + 42);
    this.gold.setPosition(left + WIDTH - 30, top + 42);
    this.empty.setPosition(cx, top + 100 + ROW_HEIGHT / 2);
    this.rows.forEach((row, i) => {
      const y = top + 100 + i * ROW_HEIGHT + ROW_HEIGHT / 2;
      row.name.setPosition(left + 30, y - 12);
      row.note.setPosition(left + 30, y + 14);
      row.button.setPosition(left + WIDTH - 90, y);
      if (i < this.visibleRows) g.lineStyle(1, 0xe8c37a, 0.18).lineBetween(left + 20, y + ROW_HEIGHT / 2, left + WIDTH - 20, y + ROW_HEIGHT / 2);
    });
    this.closeButton.setPosition(cx, top + height - 40);
  }

  private setVisible(visible: boolean): void {
    for (const o of [this.shade, this.panel, this.title, this.gold, this.closeButton]) o.setVisible(visible);
    if (!visible) {
      this.empty.setVisible(false);
      for (const row of this.rows) for (const o of [row.name, row.note, row.button]) o.setVisible(false);
    }
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH + 2).setResolution(2);
  }

  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    const button = this.text(label, 24, '#1a1008').setOrigin(0.5).setBackgroundColor('#e8c37a')
      .setPadding(40, 10, 40, 10).setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
    return button;
  }
}
