import Phaser from 'phaser';
import { itemIcon } from './itemIcons';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { ITEMS, ITEM_IDS, MAX_STACK, MAX_GOLD, SHOP_STOCK, countOf, itemEffectText, type Inventory, type ItemId, type ShopId } from '../items/inventory';

/** 한 쪽에 보여 주는 줄 수. 물건이 더 많으면 ◀ ▶로 넘긴다. */
const ROWS_PER_PAGE = 3;
const SHOP_TITLE: Record<ShopId, string> = { merina: '메리나의 잡화점', fern: '페른의 수레' };

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
interface ItemRow {
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  note: Phaser.GameObjects.Text;
  stock: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Text;
  action?: PanelAction;
}
export interface PanelAction { type: 'use' | 'buy' | 'sell'; id: ItemId }

/** 구매·판매를 구분하고 거래 결과를 화면 안에서 확인한다. 열린 동안 게임은 멈춘다. */
export class ItemPanel {
  private readonly scene: Phaser.Scene;
  private readonly onAction: (action: PanelAction) => void;
  private readonly onClose: () => void;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly gold: Phaser.GameObjects.Text;
  private readonly empty: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;
  private readonly buyTab: Phaser.GameObjects.Text;
  private readonly sellTab: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly prevButton: Phaser.GameObjects.Text;
  private readonly nextButton: Phaser.GameObjects.Text;
  private readonly rows: ItemRow[] = [];
  private shop: ShopId = 'merina';
  private page = 0;
  private pages = 1;
  private open = false;
  private mode: 'bag' | 'shop' = 'bag';
  private tab: 'buy' | 'sell' = 'buy';
  private inventory!: Inventory;
  private visibleRows = 0;
  private width = 0;

  constructor(scene: Phaser.Scene, onAction: (action: PanelAction) => void, onClose: () => void, private readonly onConfigureSlot?: (slot: 0 | 1) => void) {
    this.scene = scene;
    this.onAction = onAction;
    this.onClose = onClose;
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x06130f, 0.74)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 40).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 41);
    this.title = this.text('', 32, '#fff0cf').setOrigin(0, 0.5);
    this.gold = this.text('', 24, '#efd18e').setOrigin(1, 0.5);
    this.empty = this.text('', 25, '#c3d2c8').setOrigin(0.5).setAlign('center').setLineSpacing(16);
    this.status = this.text('', 20, '#bcd4c5').setOrigin(0, 0.5);
    this.closeButton = this.button('닫기', 170, () => this.close());
    this.buyTab = this.button('구매', 190, () => this.mode === 'bag' ? this.onConfigureSlot?.(0) : this.switchTab('buy'));
    this.sellTab = this.button('판매', 190, () => this.mode === 'bag' ? this.onConfigureSlot?.(1) : this.switchTab('sell'));
    this.prevButton = this.button('◀', 96, () => this.turnPage(-1));
    this.nextButton = this.button('▶', 96, () => this.turnPage(1));
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
      const row: ItemRow = {
        icon: itemIcon(scene, 'potion').setDepth(DEPTH_UI + 42),
        name: this.text('', 26, '#f7ecd2').setOrigin(0, 0.5),
        note: this.text('', 20, '#c4d3c9').setOrigin(0, 0.5),
        stock: this.text('', 17, '#acbfb2').setOrigin(0, 0.5),
        button: this.button('', 210, () => { if (row.action) this.onAction(row.action); }),
      };
      this.rows.push(row);
    }
    this.setVisible(false);
  }

  get isOpen(): boolean { return this.open; }

  /** 가방 또는 상점을 연다. 상점마다 파는 물건이 다르다(SHOP_STOCK). */
  show(mode: 'bag' | 'shop', inventory: Inventory, shop: ShopId = 'merina'): void {
    this.mode = mode;
    this.shop = shop;
    this.tab = 'buy';
    this.page = 0;
    this.open = true;
    this.setVisible(true);
    this.setStatus(mode === 'shop' ? '한 번 누를 때마다 1개씩 거래합니다.' : '사용할 물품을 선택하세요.');
    this.refresh(inventory);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.setVisible(false);
    this.onClose();
  }

  setStatus(message: string, error = false): void {
    this.status.setText(message).setColor(error ? '#f0b5a0' : '#d9e8c6');
  }

  private turnPage(by: number): void {
    const page = Math.max(0, Math.min(this.pages - 1, this.page + by));
    if (!this.open || page === this.page) return;
    this.page = page;
    this.refresh(this.inventory);
  }

  private switchTab(tab: 'buy' | 'sell'): void {
    if (!this.open || tab === this.tab) return;
    this.tab = tab;
    this.page = 0;
    this.setStatus(tab === 'buy' ? '한 번 누를 때마다 1개씩 구매합니다.' : '한 번 누를 때마다 1개씩 판매합니다.');
    this.refresh(this.inventory);
  }

  refresh(inventory: Inventory): void {
    if (!this.open) return;
    this.inventory = inventory;
    const all = this.mode === 'shop' && this.tab === 'buy'
      ? SHOP_STOCK[this.shop]
      : ITEM_IDS.filter(id => countOf(inventory, id) > 0 && (this.mode !== 'shop' || (ITEMS[id].sellPrice > 0 && ITEMS[id].kind !== 'keepsake')));
    this.pages = Math.max(1, Math.ceil(all.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, this.pages - 1);
    const ids = all.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE);
    this.visibleRows = ids.length;
    this.rows.forEach((row, i) => {
      const id = ids[i];
      for (const object of [row.icon, row.name, row.note, row.stock, row.button]) object.setVisible(!!id);
      row.action = undefined;
      if (!id) { row.button.disableInteractive(); return; }
      const def = ITEMS[id], count = countOf(inventory, id);
      const type = this.mode === 'bag' ? 'use' : this.tab;
      const full = type === 'buy' && count >= MAX_STACK;
      const short = type === 'buy' && inventory.gold < def.price!;
      const capped = type === 'sell' && inventory.gold + def.sellPrice > MAX_GOLD;
      const usable = type !== 'use' || def.kind === 'consumable';
      const enabled = usable && !full && !short && !capped;
      row.icon.setFrame(id).setDisplaySize(88, 88);
      row.name.setText(def.name);
      row.note.setText(itemEffectText(id));
      row.stock.setText(full ? `보유 ${count} / ${MAX_STACK}개 · 가방이 가득 찼어요`
        : short ? `보유 ${count}개 · 골드 ${(def.price! - inventory.gold).toLocaleString()} G 부족`
        : capped ? `보유 ${count}개 · 골드 보관 한도에 도달해요`
        : `보유 ${count}개${type === 'sell' ? ` · 1개당 ${def.sellPrice} G` : ''}`)
        .setColor(full || short || capped ? '#f0b5a0' : '#aebfb2');
      row.button.setText(type === 'buy' ? `구매 ${def.price} G` : type === 'sell' ? `판매 ${def.sellPrice} G` : usable ? '1개 사용' : def.kind === 'keepsake' ? '기념품' : '재료')
        .setBackgroundColor(enabled ? '#dfc18a' : '#344a40').setColor(enabled ? '#1a302a' : '#bac8bd');
      if (enabled) {
        row.action = { type, id };
        row.button.setInteractive({ useHandCursor: true });
      } else row.button.disableInteractive();
    });
    this.title.setText(this.mode === 'bag' ? '가방' : SHOP_TITLE[this.shop]);
    this.gold.setText(`보유 골드  ${inventory.gold.toLocaleString()} G`);
    this.empty.setText(this.mode === 'shop' ? '판매할 물품이 없어요.\n모험에서 얻은 재료를 가져와 주세요.' : '가방이 비어 있어요.\n잡화점에서 필요한 물품을 준비해 보세요.').setVisible(ids.length === 0);
    const paged = this.pages > 1;
    this.prevButton.setVisible(paged).setAlpha(this.page > 0 ? 1 : 0.4);
    this.nextButton.setVisible(paged).setAlpha(this.page < this.pages - 1 ? 1 : 0.4);
    this.buyTab.setVisible(true).setText(this.mode === 'shop' ? '구매' : '슬롯 1 설정');
    this.sellTab.setVisible(true).setText(this.mode === 'shop' ? '판매' : '슬롯 2 설정');
    for (const [button, selected] of [[this.buyTab, this.tab === 'buy'], [this.sellTab, this.tab === 'sell']] as const) {
      const active = this.mode === 'shop' && selected;
      button.setBackgroundColor(active ? '#dfc18a' : '#294337').setColor(active ? '#1a302a' : '#e4dfc8');
    }
    this.place();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.place();
  }

  private place(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const panelWidth = Math.min(1000, width - 64), left = (width - panelWidth) / 2, top = 40, height = 640;
    const g = this.panel.clear();
    g.fillStyle(0x10271f, 0.99).fillRoundedRect(left, top, panelWidth, height, 18);
    g.lineStyle(1, 0xcbb17c, 0.95).strokeRoundedRect(left, top, panelWidth, height, 18);
    this.title.setPosition(left + 32, top + 46);
    this.gold.setPosition(left + panelWidth - 32, top + 46);
    this.buyTab.setPosition(left + 127, top + 122);
    this.sellTab.setPosition(left + 329, top + 122);
    this.empty.setPosition(width / 2, top + 330);
    this.prevButton.setPosition(left + panelWidth - 172, top + 122);
    this.nextButton.setPosition(left + panelWidth - 64, top + 122);
    this.rows.forEach((row, i) => {
      const y = top + 232 + i * 116;
      if (i < this.visibleRows) {
        g.fillStyle(0x1c362b, 1).fillRoundedRect(left + 20, y - 52, panelWidth - 40, 108, 10);
        g.fillStyle(0x0b2019, 1).fillRoundedRect(left + 36, y - 42, 88, 88, 8);
        g.lineStyle(1, 0x887c50, 0.7).strokeRoundedRect(left + 36, y - 42, 88, 88, 8);
      }
      row.icon.setPosition(left + 80, y + 2);
      row.name.setPosition(left + 144, y - 26);
      row.note.setPosition(left + 144, y + 5);
      row.stock.setPosition(left + 144, y + 33);
      row.button.setPosition(left + panelWidth - 137, y + 2);
    });
    g.lineStyle(1, 0x6b8064, 0.5).lineBetween(left + 32, top + 543, left + panelWidth - 32, top + 543);
    this.status.setPosition(left + 32, top + 588).setWordWrapWidth(panelWidth - 270);
    this.closeButton.setPosition(left + panelWidth - 117, top + 588);
  }

  private setVisible(visible: boolean): void {
    for (const o of [this.shade, this.panel, this.title, this.gold, this.closeButton, this.status]) o.setVisible(visible);
    if (!visible) {
      this.buyTab.setVisible(false);
      this.sellTab.setVisible(false);
      this.prevButton.setVisible(false);
      this.nextButton.setVisible(false);
      this.empty.setVisible(false);
      for (const row of this.rows) for (const o of [row.icon, row.name, row.note, row.stock, row.button]) o.setVisible(false);
    }
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH_UI + 42).setResolution(2);
  }

  private button(label: string, width: number, onTap: () => void): Phaser.GameObjects.Text {
    return this.text(label, 23, '#1a302a').setOrigin(0.5).setFixedSize(width, 84).setAlign('center')
      .setPadding(0, 27, 0, 0).setBackgroundColor('#dfc18a').setInteractive({ useHandCursor: true })
      .on('pointerup', onTap);
  }
}
