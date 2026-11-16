import type Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { ITEMS, ITEM_IDS, countOf, type Inventory, type ItemId } from '../items/inventory';
import type { QuickSlots } from '../items/quickSlots';
import { itemIcon } from './itemIcons';

const DEPTH = DEPTH_UI + 50;
export class QuickSlotPanel {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly clear: Phaser.GameObjects.Text;
  private readonly cancel: Phaser.GameObjects.Text;
  private readonly rows: Array<{ id: ItemId; icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; button: Phaser.GameObjects.Text }> = [];
  private width = 0;
  private active = false;
  private slot: 0 | 1 = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly onAssign: (slot: 0 | 1, id: ItemId | null) => void,
    private readonly onClose: () => void) {
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x06130f, .78).setOrigin(0).setScrollFactor(0).setDepth(DEPTH).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('', 32, '#fff0cf');
    this.hint = this.text('', 19, '#c6d5c9');
    this.clear = this.button('등록 해제', () => { this.onAssign(this.slot, null); this.close(); });
    this.cancel = this.button('취소', () => this.close());
    for (const id of ITEM_IDS.filter(id => ITEMS[id].kind === 'consumable')) {
      this.rows.push({ id, icon: itemIcon(scene, id).setDepth(DEPTH + 2), text: this.text('', 24, '#f4e7ca'),
        button: this.button('등록', () => { this.onAssign(this.slot, id); this.close(); }) });
    }
    this.visible(false);
  }
  get isOpen(): boolean { return this.active; }
  show(slot: 0 | 1, inventory: Inventory, slots: QuickSlots): void {
    this.slot = slot;
    this.active = true;
    this.title.setText(`슬롯 ${slot + 1} · ${slot === 0 ? 'Q' : 'R'} 아이템 등록`);
    this.hint.setText('버튼을 길게 누르거나 가방에서 언제든 변경할 수 있어요.');
    for (const row of this.rows) {
      const count = countOf(inventory, row.id), def = ITEMS[row.id];
      row.text.setText(`${def.name}\n체력 ${def.heal} 회복 · 보유 ${count}개`).setLineSpacing(10);
      row.button.setText(slots[slot] === row.id ? '선택됨' : '등록').setAlpha(count > 0 ? 1 : .45);
      if (count > 0) row.button.setInteractive({ useHandCursor: true });
      else row.button.disableInteractive();
    }
    if (!this.rows.some(r => countOf(inventory, r.id))) this.hint.setText('소모품이 없어요. 잡화점에서 물품을 준비해 주세요.');
    this.visible(true);
    this.layout(this.width || this.scene.scale.gameSize.width);
  }
  close(): void { if (!this.active) return; this.active = false; this.visible(false); this.onClose(); }
  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT); this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    const w = Math.min(900, width - 80), x = (width - w) / 2, y = 76;
    const g = this.panel.clear();
    g.fillStyle(0x10271f, .99).fillRoundedRect(x, y, w, 568, 18);
    g.lineStyle(1, 0xcbb17c, .95).strokeRoundedRect(x, y, w, 568, 18);
    this.title.setPosition(x + 36, y + 34);
    this.rows.forEach((r, i) => {
      const cy = y + 190 + i * 116;
      g.fillStyle(0x20392d, 1).fillRoundedRect(x + 24, cy - 50, w - 48, 104, 10);
      r.icon.setPosition(x + 80, cy);
      r.text.setPosition(x + 142, cy - 34);
      r.button.setPosition(x + w - 132, cy);
    });
    this.hint.setPosition(x + 36, y + 410).setWordWrapWidth(w - 72);
    this.clear.setPosition(x + 132, y + 494);
    this.cancel.setPosition(x + w - 132, y + 494);
  }
  private visible(v: boolean): void {
    for (const o of [this.shade, this.panel, this.title, this.hint, this.clear, this.cancel]) o.setVisible(v);
    for (const r of this.rows) for (const o of [r.icon, r.text, r.button]) o.setVisible(v);
  }
  private text(label: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, label, { fontFamily: 'system-ui, "Noto Sans KR", sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH + 2).setResolution(2);
  }
  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    return this.text(label, 24, '#1a302a').setOrigin(.5).setFixedSize(192, 84).setAlign('center').setPadding(0, 26, 0, 0)
      .setBackgroundColor('#dfc18a').setInteractive({ useHandCursor: true }).on('pointerup', onTap);
  }
}
