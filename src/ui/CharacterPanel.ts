import type Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { STAT_IDS, STAT_INFO, statGain, type DerivedStats, type StatBlock, type StatId } from '../entities/attributes';
import {
  ENHANCE_SLOT_IDS, GEAR, GEAR_IDS, MAX_RANK, SLOT_IDS, SLOT_INFO,
  armorAppearanceLabel, armorAppearanceRank, armorPromotionStatus, canAffordPromotion, canSmithyWork,
  enhanceCost, fits, gearCount, gearForSale, isEnhanceSlot, promotionRecipe, rankLabel,
  slotDisplayName, slotIconId, slotStats, weaponAppearanceLabel,
  type AccessorySlotId, type EnhanceSlotId, type Gear, type GearId, type GearShopId, type SlotId,
} from '../items/equipment';
import { ITEMS, ITEM_IDS, canUse, countOf, itemEffectText, type Inventory, type ItemId } from '../items/inventory';
import { IconView, type IconFallback } from './icons';
import { MENU_COLOR, drawMenuCard, drawMenuFrame, menuButton, menuText, placeMenuButton } from './menuSkin';

/**
 * 캐릭터 창: 상태(능력치 분배) · 장비(5개 기본 칸 + 장신구 2칸) · 아이템(가방) 탭.
 * 대장간(도란·마르타)에서는 같은 창에 [강화](골드 전용·상한 없음)와 [승급](골드+재료·외형 진화),
 * 장신구 거래 탭을 함께 띄운다. 페른의 수레는 장신구 구매·판매 전용.
 * 열린 동안 게임은 멈춘다.
 */

const DEPTH = DEPTH_UI + 40;
const GRID_COLUMNS = 5;
const CELL = 70;
const CELL_STEP = CELL + 10;
const GRID_CELLS = GRID_COLUMNS * 3;

export type CharacterTab = 'status' | 'equip' | 'items';
export type ShopTab = 'enhance' | 'promote' | 'buy' | 'sell';

export interface CharacterView {
  name: string;
  level: number;
  hp: number;
  mp: number;
  /** 잿빛 가루·부식 웅덩이로 느려져 있는지 (해독 약초를 쓸 수 있는지) */
  slowed: boolean;
  pointsLeft: number;
  /** 최종 능력치(기본 + 분배 + 장비)와 그중 장비 몫 */
  stats: StatBlock;
  bonus: Partial<StatBlock>;
  derived: DerivedStats;
  inventory: Inventory;
  gear: Gear;
  /** 대장간 승급 기능 해금 여부(1장 '도란의 검' 완료 후 해금). 생략 시 true */
  promotionUnlocked?: boolean;
  /** 현재 장에서 허용되는 최대 승급 단계 (생략 시 MAX_RANK) */
  maxPromotionRank?: number;
}

export interface CharacterActions {
  allocate(stat: StatId): void;
  enhance(slot: EnhanceSlotId): void;
  promote(slot: EnhanceSlotId): void;
  equip(id: GearId, slot: SlotId): void;
  unequip(slot: SlotId): void;
  use(id: ItemId): void;
  buy(id: GearId): void;
  sell(id: GearId): void;
  close(): void;
}

type Entry = { type: 'item'; id: ItemId; count: number } | { type: 'gear'; id: GearId; count: number };

const STAT_COLORS: Record<StatId, number> = {
  str: 0x8a3a2c, vit: 0x3f7a3a, def: 0x4a5a72, dex: 0x2f7a72,
};

export function itemFallback(entry: Entry): IconFallback {
  if (entry.type === 'gear') return { glyph: GEAR[entry.id].name.slice(0, 2), color: 0x5a4a32 };
  const def = ITEMS[entry.id];
  return { glyph: def.name.slice(0, 2), color: def.kind === 'consumable' ? 0x7a3b2a : def.kind === 'keepsake' ? 0x6b562e : 0x3a5a3a };
}

function statsText(stats: Partial<StatBlock>): string {
  return (Object.entries(stats) as [StatId, number][]).filter(([, v]) => v > 0).map(([id, v]) => `${STAT_INFO[id].short} +${v}`).join('  ');
}

/** 대장간·상점 창의 제목 */
const GEAR_SHOP_TITLE: Record<GearShopId, string> = { doran: '도란의 대장간', fern: '페른의 수레 · 여행 장신구', marta: '마르타의 대장간' };

export class CharacterPanel {
  private readonly scene: Phaser.Scene;
  private readonly actions: CharacterActions;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly gold: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Text;
  private readonly tabs: Record<CharacterTab, Phaser.GameObjects.Text>;
  private readonly shopTabs: Record<ShopTab, Phaser.GameObjects.Text>;
  // 상태 탭
  private readonly header: Phaser.GameObjects.Text;
  private readonly statRows: { icon: IconView; name: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; gain: Phaser.GameObjects.Text; plus: Phaser.GameObjects.Text }[] = [];
  private readonly summaryTitle: Phaser.GameObjects.Text;
  private readonly metrics: { label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = [];
  // 장비·강화·승급 칸 (일곱 칸: 0~4는 기본 칸, 5~6은 장신구 칸)
  private readonly slots: { icon: IconView; label: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Zone }[] = [];
  // 가방·상점 격자와 설명
  private readonly cells: IconView[] = [];
  private readonly cellNames: Phaser.GameObjects.Text[] = [];
  private readonly gridLabel: Phaser.GameObjects.Text;
  private readonly pageLabel: Phaser.GameObjects.Text;
  private readonly previous: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Text;
  private readonly detailIcon: IconView;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Text;
  private readonly secondButton: Phaser.GameObjects.Text;

  private open = false;
  private mode: 'character' | 'smithy' = 'character';
  /** 대장간·상점 모드에서 지금 연 상점 (도란·페른·마르타) */
  private gearShop: GearShopId = 'doran';
  private tab: CharacterTab = 'status';
  private shopTab: ShopTab = 'enhance';
  private view?: CharacterView;
  private entries: Entry[] = [];
  private selectedEntry?: Entry;
  private page = 0;
  private selectedSlot: SlotId = 'weapon';
  private width = 0;

  constructor(scene: Phaser.Scene, actions: CharacterActions) {
    this.scene = scene;
    this.actions = actions;
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x080604, .70)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('', 32, MENU_COLOR.ink, true).setOrigin(0, .5);
    this.gold = this.text('', 19, MENU_COLOR.gold, true).setOrigin(1, 0.5);
    this.status = this.text('', 17, MENU_COLOR.muted).setOrigin(0, 0.5);
    this.closeButton = this.button('닫기', () => this.close());
    this.tabs = {
      status: this.button('상태', () => this.switchTab('status')),
      equip: this.button('장비', () => this.switchTab('equip')),
      items: this.button('아이템', () => this.switchTab('items')),
    };
    this.shopTabs = {
      enhance: this.button('강화', () => this.switchShopTab('enhance')),
      promote: this.button('승급', () => this.switchShopTab('promote')),
      buy: this.button('장신구', () => this.switchShopTab('buy')),
      sell: this.button('판매', () => this.switchShopTab('sell')),
    };

    this.header = this.text('', 20, MENU_COLOR.gold, true).setOrigin(0, .5);
    for (const id of STAT_IDS) {
      this.statRows.push({
        icon: new IconView(scene, 40, DEPTH + 2),
        name: this.text('', 18, MENU_COLOR.ink, true).setOrigin(0, .5),
        value: this.text('', 19, MENU_COLOR.gold, true).setOrigin(1, .5),
        gain: this.text('', 15, MENU_COLOR.muted).setLineSpacing(3),
        plus: this.button('+', () => this.actions.allocate(id)),
      });
    }
    this.summaryTitle = this.text('전투 능력', 21, MENU_COLOR.ink, true).setOrigin(0, .5);
    for (const label of ['공격력', '체력', '마나', '받는 피해', '회피 확률', '회피 재사용 대기', '치명타 확률', '치명타 피해']) {
      this.metrics.push({
        label: this.text(label, 18, MENU_COLOR.muted).setOrigin(0, .5),
        value: this.text('', 18, MENU_COLOR.ink, true).setOrigin(1, .5),
      });
    }

    for (const slot of SLOT_IDS) {
      this.slots.push({
        icon: new IconView(scene, 48, DEPTH + 2),
        label: this.text('', 17, MENU_COLOR.ink).setOrigin(0, .5).setLineSpacing(4),
        hit: scene.add.zone(0, 0, 1, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH + 5)
          .setInteractive({ useHandCursor: true }).on('pointerup', () => this.selectSlot(slot)),
      });
    }

    this.gridLabel = this.text('', 20, MENU_COLOR.ink, true).setOrigin(0, .5);
    this.pageLabel = this.text('', 17, MENU_COLOR.muted).setOrigin(.5);
    this.previous = this.button('‹', () => this.changePage(-1));
    this.next = this.button('›', () => this.changePage(1));
    for (let i = 0; i < GRID_CELLS; i++) {
      this.cells.push(new IconView(scene, CELL, DEPTH + 2, () => this.selectCell(i)));
      this.cellNames.push(this.text('', 14, MENU_COLOR.muted).setOrigin(.5, 0).setAlign('center').setWordWrapWidth(CELL_STEP - 4, true)
        .setInteractive({ useHandCursor: true }).on('pointerup', () => this.selectCell(i)));
    }
    this.detailIcon = new IconView(scene, 62, DEPTH + 2);
    this.detailName = this.text('', 22, MENU_COLOR.ink, true);
    this.detailText = this.text('', 17, MENU_COLOR.muted).setLineSpacing(5);
    this.actionButton = this.button('', () => this.primary());
    this.secondButton = this.button('', () => this.secondary());
    this.hideAll();
  }

  get isOpen(): boolean { return this.open; }
  get currentTab(): CharacterTab { return this.tab; }
  get currentShopTab(): ShopTab { return this.shopTab; }

  shortcut(tab: CharacterTab): void {
    if (this.mode === 'smithy' || tab === this.tab) this.close();
    else this.switchTab(tab);
  }

  /** 캐릭터 창(상태·장비·아이템)을 연다. */
  show(tab: CharacterTab, view: CharacterView, fromPause = false): void {
    this.mode = 'character';
    this.closeButton.setText(fromPause ? '뒤로' : '닫기');
    this.tab = tab;
    this.openWith(view);
  }

  /** 지금 연 대장간·장신구 상점 */
  get shop(): GearShopId { return this.gearShop; }

  /** 대장간·장신구 상점: 도란·마르타는 강화가 기본 탭(승급 탭 별도), 페른은 장신구 구매가 기본 탭이다. */
  showSmithy(view: CharacterView, shop: GearShopId = 'doran'): void {
    this.mode = 'smithy';
    this.gearShop = shop;
    this.closeButton.setText('닫기');
    this.shopTab = canSmithyWork(shop) ? 'enhance' : 'buy';
    this.openWith(view);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.hideAll();
    this.actions.close();
  }

  setStatus(message: string, error = false): void {
    this.status.setText(message).setColor(error ? MENU_COLOR.danger : MENU_COLOR.gold).setVisible(this.open && !!message);
  }

  /** 장면이 바뀐 상태를 넘겨 다시 그린다. */
  refresh(view: CharacterView): void {
    this.view = view;
    if (!this.open) return;
    this.entries = this.collectEntries(view);
    const kept = this.selectedEntry && this.entries.find((e) => e.type === this.selectedEntry!.type && e.id === this.selectedEntry!.id);
    this.selectedEntry = kept;
    this.page = kept ? Math.floor(this.entries.indexOf(kept) / this.pageSize) : Math.min(this.page, this.pageCount - 1);
    this.render();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.render();
  }

  // ---------------------------------------------------------------- 선택

  private openWith(view: CharacterView): void {
    this.open = true;
    this.selectedEntry = undefined;
    this.selectedSlot = 'weapon';
    this.page = 0;
    this.setStatus('');
    this.refresh(view);
  }

  private switchTab(tab: CharacterTab): void {
    if (!this.open || this.mode !== 'character' || tab === this.tab) return;
    this.tab = tab;
    this.selectedEntry = undefined;
    this.page = 0;
    this.setStatus('');
    if (this.view) this.refresh(this.view);
  }

  private switchShopTab(tab: ShopTab): void {
    if (!this.open || this.mode !== 'smithy' || tab === this.shopTab) return;
    if ((tab === 'enhance' || tab === 'promote') && !canSmithyWork(this.gearShop)) return;
    this.shopTab = tab;
    this.selectedEntry = undefined;
    if ((tab === 'enhance' || tab === 'promote') && !isEnhanceSlot(this.selectedSlot)) this.selectedSlot = 'weapon';
    this.page = 0;
    this.setStatus('');
    if (this.view) this.refresh(this.view);
  }

  private selectSlot(slot: SlotId): void {
    this.selectedSlot = slot;
    this.selectedEntry = undefined;
    this.page = 0;
    this.setStatus('');
    if (this.view) this.refresh(this.view);
  }

  private selectCell(index: number): void {
    const selected = this.entries[this.page * this.pageSize + index];
    if (!selected) return;
    this.selectedEntry = selected;
    this.setStatus('');
    this.render();
  }

  private get equipmentView(): boolean { return this.mode === 'character' && this.tab === 'equip'; }

  private get pageSize(): number { return this.equipmentView ? 8 : GRID_CELLS; }

  private get pageCount(): number { return Math.max(1, Math.ceil(this.entries.length / this.pageSize)); }

  private changePage(delta: number): void {
    const next = this.page + delta;
    if (next < 0 || next >= this.pageCount) return;
    this.page = next;
    this.selectedEntry = undefined;
    this.setStatus('');
    this.render();
  }

  private collectEntries(view: CharacterView): Entry[] {
    const gearEntries = (ids: GearId[], counts: (id: GearId) => number) =>
      ids.map((id): Entry => ({ type: 'gear', id, count: counts(id) }));
    if (this.mode === 'smithy') {
      if (this.shopTab === 'enhance' || this.shopTab === 'promote') return [];
      return this.shopTab === 'buy'
        ? gearEntries(gearForSale(this.gearShop), (id) => gearCount(view.gear, id))
        : gearEntries(GEAR_IDS.filter((id) => gearCount(view.gear, id) > 0 && GEAR[id].sellPrice > 0), (id) => gearCount(view.gear, id));
    }
    if (this.tab === 'equip') {
      if (isEnhanceSlot(this.selectedSlot)) return [];
      return gearEntries(GEAR_IDS.filter((id) => gearCount(view.gear, id) > 0 && fits(id, this.selectedSlot)), (id) => gearCount(view.gear, id));
    }
    const items = ITEM_IDS.filter((id) => countOf(view.inventory, id) > 0)
      .map((id): Entry => ({ type: 'item', id, count: countOf(view.inventory, id) }));
    return [...items, ...gearEntries(GEAR_IDS.filter((id) => gearCount(view.gear, id) > 0), (id) => gearCount(view.gear, id))];
  }

  // ---------------------------------------------------------------- 버튼

  private primary(): void {
    const entry = this.selectedEntry, view = this.view;
    if (!view) return;
    if (this.mode === 'smithy') {
      if (this.shopTab === 'enhance') {
        const slot: EnhanceSlotId = isEnhanceSlot(this.selectedSlot) ? this.selectedSlot : 'weapon';
        this.actions.enhance(slot);
        return;
      }
      if (this.shopTab === 'promote') {
        const slot: EnhanceSlotId = isEnhanceSlot(this.selectedSlot) ? this.selectedSlot : 'weapon';
        this.actions.promote(slot);
        return;
      }
      if (entry?.type === 'gear') (this.shopTab === 'buy' ? this.actions.buy : this.actions.sell)(entry.id);
      return;
    }
    if (entry?.type === 'item') this.actions.use(entry.id);
    else if (entry?.type === 'gear') this.actions.equip(entry.id, this.tab === 'equip' && !isEnhanceSlot(this.selectedSlot) ? this.selectedSlot : this.slotForEntry(view.gear));
    else if (this.tab === 'equip' && !isEnhanceSlot(this.selectedSlot) && view.gear.equipped[this.selectedSlot]) this.actions.unequip(this.selectedSlot);
  }

  private secondary(): void {
    const view = this.view;
    if (view && this.mode === 'character' && this.tab === 'equip' && !isEnhanceSlot(this.selectedSlot) && view.gear.equipped[this.selectedSlot]) {
      this.actions.unequip(this.selectedSlot);
    }
  }

  private slotForEntry(gear: Gear): AccessorySlotId {
    return !gear.equipped.accessory1 ? 'accessory1' : !gear.equipped.accessory2 ? 'accessory2' : 'accessory1';
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    this.hideAll();
    const width = this.width || this.scene.scale.gameSize.width;
    const panelWidth = Math.min(1180, width - 48);
    const left = (width - panelWidth) / 2, top = 32, height = 656;
    const x = left + 26, right = left + panelWidth - 26;
    const g = this.panel.setVisible(true);
    this.shade.setVisible(true);
    drawMenuFrame(g, left, top, panelWidth, height);
    g.lineStyle(1, 0x534537).lineBetween(x, top + 75, right, top + 75);
    this.title.setPosition(x, top + 40).setText(this.mode === 'smithy'
      ? GEAR_SHOP_TITLE[this.gearShop] : `${view.name}  ·  Lv. ${view.level}`).setVisible(true);
    this.gold.setText(`${view.inventory.gold.toLocaleString()} G`).setPosition(right - 112, top + 40).setVisible(true);
    placeMenuButton(g, this.closeButton, right - 44, top + 40, 88, 46);
    this.status.setPosition(x, top + 621).setWordWrapWidth(right - x)
      .setVisible(!!this.status.text);

    const navY = top + 107;
    const contentY = top + 149;
    if (this.mode === 'smithy') {
      const smithy = canSmithyWork(this.gearShop);
      this.shopTabs.buy.setText(smithy ? '장신구' : '구매');
      const visibleTabs: readonly ShopTab[] = smithy ? ['enhance', 'promote', 'buy', 'sell'] : ['buy', 'sell'];
      const tabW = smithy ? 114 : 124;
      const tabStep = tabW + 10;
      visibleTabs.forEach((tab, i) => placeMenuButton(g, this.shopTabs[tab], x + tabW / 2 + i * tabStep,
        navY, tabW, 46, this.shopTab === tab ? 'selected' : 'quiet'));
      if (this.shopTab === 'enhance') this.renderSmithySlots(view, x, right, contentY, 'enhance');
      else if (this.shopTab === 'promote') this.renderSmithySlots(view, x, right, contentY, 'promote');
      else this.renderInventory(view, x, right, contentY);
    } else {
      (['status', 'equip', 'items'] as const).forEach((tab, i) => placeMenuButton(g, this.tabs[tab], x + 62 + i * 134,
        navY, 124, 46, this.tab === tab ? 'selected' : 'quiet'));
      if (this.tab === 'status') this.renderStatus(view, x, right, contentY);
      else if (this.equipmentView) this.renderEquip(view, x, right, contentY);
      else this.renderInventory(view, x, right, contentY);
    }
  }

  private renderStatus(view: CharacterView, x: number, right: number, y: number): void {
    const g = this.panel;
    const summaryWidth = Math.min(344, Math.max(280, (right - x) * .33));
    const summaryX = right - summaryWidth;
    const columnGap = 10, cardWidth = (summaryX - x - 18 - columnGap) / 2;
    this.header.setText(`남은 포인트  ${view.pointsLeft}`).setPosition(x, y + 17).setVisible(true);
    STAT_IDS.forEach((id, i) => {
      const row = this.statRows[i];
      const left = x + (i % 2) * (cardWidth + columnGap), top = y + 41 + Math.floor(i / 2) * 182;
      const info = STAT_INFO[id], bonus = view.bonus[id] ?? 0;
      drawMenuCard(g, left, top, cardWidth, 166);
      row.icon.set('stats', id, { glyph: info.short, color: STAT_COLORS[id] }).setPosition(left + 30, top + 32).setVisible(true);
      row.name.setText(info.name).setPosition(left + 58, top + 22).setVisible(true);
      row.value.setOrigin(0, .5).setText(bonus ? `${view.stats[id]}  (+${bonus})` : `${view.stats[id]}`)
        .setPosition(left + 58, top + 45).setVisible(true);
      row.gain.setText(statGain(view.level, view.stats, id))
        .setPosition(left + 12, top + 72).setWordWrapWidth(cardWidth - 24, true).setVisible(true);
      placeMenuButton(g, row.plus, left + cardWidth - 32, top + 34, 46, 46, view.pointsLeft ? 'primary' : 'disabled');
    });

    const d = view.derived;
    const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
    const values = [
      `${d.damageMin}–${d.damageMax}`,
      `${view.hp} / ${d.maxHp}`,
      `${Math.floor(view.mp)} / ${d.maxMp}`,
      pct(d.damageTaken), pct(d.evadeChance), pct(d.dodgeCooldown),
      pct(d.critChance), pct(d.critDamage),
    ];
    drawMenuCard(g, summaryX, y, summaryWidth, 393);
    this.summaryTitle.setPosition(summaryX + 18, y + 24).setVisible(true);
    g.lineStyle(1, 0x4e4338).lineBetween(summaryX + 18, y + 51, right - 18, y + 51);
    this.metrics.forEach(({ label, value }, i) => {
      const rowY = y + 78 + i * 39;
      label.setPosition(summaryX + 18, rowY).setVisible(true);
      value.setText(values[i]).setPosition(right - 18, rowY).setVisible(true);
    });
  }

  private renderSlotCard(slot: SlotId, index: number, view: CharacterView, left: number, top: number, tileWidth: number): void {
    const g = this.panel;
    const info = SLOT_INFO[slot], cell = this.slots[index];
    drawMenuCard(g, left, top, tileWidth, 76, slot === this.selectedSlot);
    if (isEnhanceSlot(slot)) {
      const lv = view.gear.enhance[slot];
      const rk = view.gear.rank[slot];
      const armorStage = armorAppearanceRank(view.gear);
      const dim = lv === 0 && rk === 0 && slot !== 'weapon' && slot !== 'body';
      cell.icon.set('items', slotIconId(slot, rk, armorStage), { glyph: info.name.slice(0, 2), color: 0x5a4a32 }, undefined, dim);
      cell.label.setText(`${info.name}  +${lv}\n${rankLabel(rk)}`)
        .setColor(rk > 0 ? MENU_COLOR.gold : dim ? MENU_COLOR.muted : MENU_COLOR.ink);
    } else {
      const id = view.gear.equipped[slot];
      if (id) cell.icon.set('items', id, itemFallback({ type: 'gear', id, count: 1 }));
      else cell.icon.set('slots', info.kind, { glyph: info.name.slice(0, 2), color: 0x352e24 }, undefined, true);
      cell.label.setText(`${info.name}\n${id ? GEAR[id].name : '비어 있음'}`).setColor(id ? MENU_COLOR.ink : MENU_COLOR.muted);
    }
    cell.icon.setSelected(false).setPosition(left + 34, top + 38).setVisible(true);
    cell.label.setWordWrapWidth(tileWidth - 75, true).setPosition(left + 64, top + 38).setVisible(true);
    cell.hit.setSize(tileWidth, 76).setPosition(left, top).setVisible(true);
    if (cell.hit.input) {
      cell.hit.input.hitArea.setSize(tileWidth, 76);
      cell.hit.input.enabled = true;
    }
  }

  private renderEquip(view: CharacterView, x: number, right: number, y: number): void {
    const listX = x + Math.floor((right - x) * .505);
    const tileWidth = (listX - x - 30) / 2;
    this.header.setText('칸 강화 · 승급 · 장신구').setPosition(x, y + 17).setVisible(true);
    SLOT_IDS.forEach((slot, i) => {
      const left = x + (i % 2) * (tileWidth + 10), top = y + 42 + Math.floor(i / 2) * 86;
      this.renderSlotCard(slot, i, view, left, top, tileWidth);
    });

    if (isEnhanceSlot(this.selectedSlot)) {
      this.renderSlotDetail(view, this.selectedSlot, listX, right, y, y + 426, 'inspect');
      return;
    }
    const equipped = view.gear.equipped[this.selectedSlot];
    this.renderGrid(listX, right, y, `${SLOT_INFO[this.selectedSlot].name}에 낄 수 있는 장신구`, 4);
    this.renderDetail(view, listX, right, y + 207, y + 426, equipped);
  }

  private renderSmithySlots(view: CharacterView, x: number, right: number, y: number, kind: 'enhance' | 'promote'): void {
    const listX = x + Math.floor((right - x) * .505);
    const tileWidth = (listX - x - 30) / 2;
    const heading = kind === 'enhance'
      ? '강화할 칸 선택 (골드만 필요 · 상한 없음)'
      : '승급할 칸 선택 (골드 + 재료 필요 · 외형 진화)';
    this.header.setText(heading).setPosition(x, y + 17).setVisible(true);
    ENHANCE_SLOT_IDS.forEach((slot, i) => {
      const left = x + (i % 2) * (tileWidth + 10), top = y + 42 + Math.floor(i / 2) * 86;
      this.renderSlotCard(slot, i, view, left, top, tileWidth);
    });
    const slot: EnhanceSlotId = isEnhanceSlot(this.selectedSlot) ? this.selectedSlot : 'weapon';
    this.renderSlotDetail(view, slot, listX, right, y, y + 426, kind);
  }

  private renderSlotDetail(
    view: CharacterView,
    slot: EnhanceSlotId,
    x: number,
    right: number,
    y: number,
    bottom: number,
    mode: 'inspect' | 'enhance' | 'promote',
  ): void {
    const g = this.panel;
    drawMenuCard(g, x, y, right - x, bottom - y);
    const lv = view.gear.enhance[slot];
    const rk = view.gear.rank[slot];
    const armor = armorPromotionStatus(view.gear);
    const dim = lv === 0 && rk === 0 && slot !== 'weapon' && slot !== 'body';
    this.detailIcon.set('items', slotIconId(slot, rk, armor.stage), { glyph: SLOT_INFO[slot].name.slice(0, 2), color: 0x5a4a32 }, undefined, dim)
      .setPosition(x + 49, y + 48).setVisible(true);
    this.detailName.setText(slotDisplayName(slot, lv, rk)).setPosition(x + 90, y + 28)
      .setWordWrapWidth(right - x - 102, true).setVisible(true);

    const curText = statsText(slotStats(slot, lv, rk)) || '없음';
    const lines: string[] = [`현재 효과  ${curText}`];

    if (mode === 'inspect') {
      lines.push(`다음 강화 (+${lv + 1})  ${statsText(slotStats(slot, lv + 1, rk))}`);
      if (slot === 'weapon') {
        lines.push(`무기 외형  ${weaponAppearanceLabel(rk)}`);
      } else {
        lines.push(`방어구 외형  ${armorAppearanceLabel(armor.stage)}`);
        if (armor.nextStage !== null) {
          const miss = armor.missing.map((s) => SLOT_INFO[s].name).join('·');
          lines.push(`4부위 일치 (${rankLabel(armor.nextStage)}): ${armor.readyCount}/${armor.total} · 미달: ${miss}`);
        }
      }
      lines.push(SLOT_INFO[slot].description);
      lines.push('대장간 [강화]는 골드로 능력치 상승(상한 없음), [승급]은 골드+재료로 외형 진화.');
      this.detailText.setText(lines.join('\n')).setPosition(x + 18, y + 98)
        .setWordWrapWidth(right - x - 36, true).setVisible(true);
      return;
    }

    if (mode === 'enhance') {
      const cost = enhanceCost(slot, lv);
      const enabled = view.inventory.gold >= cost;
      lines.push(`강화 시 (+${lv + 1})  ${statsText(slotStats(slot, lv + 1, rk))}`);
      lines.push(`필요 골드  ${cost.toLocaleString()} G (재료 불필요 · 상한 없음)`);
      lines.push('강화는 능력치만 올리며 외형은 바뀌지 않습니다.');
      lines.push(SLOT_INFO[slot].description);
      if (!enabled) lines.push('골드가 부족합니다.');
      this.detailText.setText(lines.join('\n')).setPosition(x + 18, y + 98)
        .setWordWrapWidth(right - x - 36, true).setVisible(true);
      const buttonY = bottom - 36, buttonWidth = right - x - 36;
      this.actionButton.setText(`강화 (+${lv + 1})  ${cost.toLocaleString()} G`);
      placeMenuButton(g, this.actionButton, x + 18 + buttonWidth / 2, buttonY, buttonWidth, 48, enabled ? 'primary' : 'disabled');
      return;
    }

    // 승급 모드 (1장 '도란의 검' 완료 후 해금 — 골드 + 재료 필요)
    if (view.promotionUnlocked === false) {
      lines.push("1장 '도란의 검' 퀘스트를 완료하면 대장간 승급이 해금됩니다.");
      lines.push('지금은 [강화] 탭에서 골드로 장비 능력치를 올릴 수 있습니다.');
      if (slot === 'weapon') lines.push(`현재 무기 외형  ${weaponAppearanceLabel(rk)}`);
      else lines.push(`현재 방어구 외형  ${armorAppearanceLabel(armor.stage)}`);
      this.detailText.setText(lines.join('\n')).setPosition(x + 18, y + 98)
        .setWordWrapWidth(right - x - 36, true).setVisible(true);
      const buttonY = bottom - 36, buttonWidth = right - x - 36;
      this.actionButton.setText('도란의 검 완료 후 해금');
      placeMenuButton(g, this.actionButton, x + 18 + buttonWidth / 2, buttonY, buttonWidth, 48, 'disabled');
      return;
    }

    const maxRank = Math.min(MAX_RANK, view.maxPromotionRank ?? MAX_RANK);
    const recipe = rk < maxRank ? promotionRecipe(slot, rk) : null;
    if (!recipe) {
      if (rk >= MAX_RANK) {
        lines.push(`최대 승급(${rankLabel(MAX_RANK)})에 도달했습니다.`);
      } else {
        lines.push(`현재 장에서는 ${rankLabel(maxRank)}(+${maxRank})까지 승급할 수 있습니다.`);
        lines.push(`${rankLabel(maxRank + 1)} 이상 승급은 이후 장에서 해금될 예정입니다.`);
      }
      if (slot === 'weapon') lines.push(`현재 무기 외형  ${weaponAppearanceLabel(rk)}`);
      else lines.push(`현재 방어구 외형  ${armorAppearanceLabel(armor.stage)}`);
      this.detailText.setText(lines.join('\n')).setPosition(x + 18, y + 98)
        .setWordWrapWidth(right - x - 36, true).setVisible(true);
      const buttonY = bottom - 36, buttonWidth = right - x - 36;
      this.actionButton.setText(rk >= MAX_RANK ? `최대 승급 (${rankLabel(MAX_RANK)})` : `현재 장 최대 승급 (${rankLabel(maxRank)})`);
      placeMenuButton(g, this.actionButton, x + 18 + buttonWidth / 2, buttonY, buttonWidth, 48, 'disabled');
      return;
    }

    lines.push(`승급 시 (${rankLabel(recipe.targetRank)})  ${statsText(slotStats(slot, lv, recipe.targetRank))}`);
    if (slot === 'weapon') {
      lines.push(`외형 변화  ${weaponAppearanceLabel(rk)} → ${weaponAppearanceLabel(recipe.targetRank)}`);
    } else {
      lines.push(`방어구 단계  ${armorAppearanceLabel(armor.stage)}`);
      if (armor.nextStage !== null) {
        const miss = armor.missing.map((s) => SLOT_INFO[s].name).join('·');
        lines.push(`4부위 모두 ${rankLabel(armor.nextStage)} 달성 시 진화 (${armor.readyCount}/${armor.total} · 미달: ${miss})`);
      }
    }
    const matText = recipe.materials
      .map((m) => `${ITEMS[m.id].name} ${countOf(view.inventory, m.id)}/${m.count}`)
      .join(' · ');
    lines.push(`필요 골드  ${recipe.gold.toLocaleString()} G`);
    lines.push(`필요 재료  ${matText}`);
    const enabled = canAffordPromotion(view.inventory, slot, rk);
    if (!enabled) {
      lines.push(view.inventory.gold < recipe.gold ? '골드가 부족합니다.' : '승급 재료가 부족합니다.');
    }
    this.detailText.setText(lines.join('\n')).setPosition(x + 18, y + 98)
      .setWordWrapWidth(right - x - 36, true).setVisible(true);
    const buttonY = bottom - 36, buttonWidth = right - x - 36;
    this.actionButton.setText(`승급 (${rankLabel(recipe.targetRank)})  ${recipe.gold.toLocaleString()} G`);
    placeMenuButton(g, this.actionButton, x + 18 + buttonWidth / 2, buttonY, buttonWidth, 48, enabled ? 'primary' : 'disabled');
  }

  private renderInventory(view: CharacterView, x: number, right: number, y: number): void {
    const detailX = x + Math.max(410, Math.floor((right - x) * .49));
    const title = this.mode === 'smithy' ? this.shopTab === 'buy' ? '판매 장신구' : '판매 가능한 장신구' : '가방';
    this.renderGrid(x, detailX - 16, y, title, GRID_COLUMNS);
    this.renderDetail(view, detailX, right, y, y + 426);
  }

  private renderGrid(x: number, right: number, y: number, title: string, columns: number): void {
    const g = this.panel;
    const rowStep = this.equipmentView ? CELL_STEP : 108;
    this.gridLabel.setText(title).setPosition(x, y + 17).setVisible(true);
    this.cells.forEach((cell, i) => {
      if (i >= this.pageSize) return;
      const entry = this.entries[this.page * this.pageSize + i];
      if (!entry) return;
      const cx = x + CELL / 2 + (i % columns) * CELL_STEP;
      const cy = y + 41 + CELL / 2 + Math.floor(i / columns) * rowStep;
      const smithyBuy = this.mode === 'smithy' && this.shopTab === 'buy';
      cell.set('items', entry.id, itemFallback(entry), smithyBuy ? undefined : entry.count)
        .setSelected(this.selectedEntry?.type === entry.type && this.selectedEntry.id === entry.id)
        .setPosition(cx, cy).setVisible(true);
      if (!this.equipmentView) {
        const name = entry.type === 'gear' ? GEAR[entry.id].name : ITEMS[entry.id].name;
        this.cellNames[i].setText(name).setPosition(cx, cy + CELL / 2 + 4).setVisible(true);
      }
    });
    if (this.pageCount > 1) {
      const cx = this.equipmentView ? right - 75 : (x + right) / 2;
      const cy = this.equipmentView ? y + 17 : y + 41 + 3 * rowStep + 20;
      const arrow = this.equipmentView ? 50 : 77;
      this.pageLabel.setText(`${this.page + 1} / ${this.pageCount}`).setPosition(cx, cy).setVisible(true);
      placeMenuButton(g, this.previous, cx - arrow, cy, 50, 46, this.page > 0 ? 'quiet' : 'disabled');
      placeMenuButton(g, this.next, cx + arrow, cy, 50, 46, this.page + 1 < this.pageCount ? 'quiet' : 'disabled');
    }
  }

  private renderDetail(view: CharacterView, x: number, right: number, y: number, bottom: number, equipped?: GearId): void {
    const g = this.panel;
    drawMenuCard(g, x, y, right - x, bottom - y);
    const entry = this.selectedEntry;
    const shown: Entry | undefined = entry ?? (equipped ? { type: 'gear', id: equipped, count: 1 } : undefined);
    if (!shown) {
      const empty = this.entries.length === 0;
      this.detailName.setText(empty ? (this.equipmentView ? '착용할 장신구 없음' : this.mode === 'smithy' ? '판매할 장신구 없음' : '빈 가방')
        : this.equipmentView ? '장신구 선택' : '아이템 선택').setPosition(x + 18, y + 21).setVisible(true);
      if (!empty) this.detailText.setText('아이콘을 누르면 상세 정보가 표시됩니다.').setPosition(x + 18, y + 58)
        .setWordWrapWidth(right - x - 36).setVisible(true);
      return;
    }

    this.detailIcon.set('items', shown.id, itemFallback(shown)).setPosition(x + 49, y + 48).setVisible(true);
    const lines: string[] = [];
    let label = '', enabled = true, canRemove = false;
    if (shown.type === 'item') {
      const def = ITEMS[shown.id];
      this.detailName.setText(def.name);
      lines.push(itemEffectText(shown.id), def.description, `보유 ${shown.count}개`);
      if (def.kind === 'consumable') {
        label = '사용';
        enabled = canUse(shown.id, { hp: view.hp, maxHp: view.derived.maxHp, mp: view.mp, maxMp: view.derived.maxMp, slowed: view.slowed });
        if (!enabled) label = def.heal ? '체력 가득 참' : def.mana ? '마나 가득 참' : '해제할 상태 없음';
      }
    } else {
      const def = GEAR[shown.id];
      this.detailName.setText(def.name);
      lines.push(statsText(def.stats), def.description);
      if (this.mode === 'smithy') {
        const buying = this.shopTab === 'buy';
        const price = buying ? def.price ?? Infinity : def.sellPrice;
        enabled = buying ? view.inventory.gold >= price : gearCount(view.gear, shown.id) > 0 && def.sellPrice > 0;
        label = `${buying ? '구매' : '판매'}  ${price} G`;
        lines.push(`보유 ${gearCount(view.gear, shown.id)}개`);
        if (buying && !enabled) lines.push('골드가 부족합니다.');
      } else if (!entry && equipped) {
        lines.unshift('착용 중');
        label = '장신구 해제';
      } else {
        label = '장착';
        canRemove = this.equipmentView && !!equipped;
        if (equipped) {
          const current = GEAR[equipped];
          const changes = STAT_IDS.flatMap(id => {
            const diff = (def.stats[id] ?? 0) - (current.stats[id] ?? 0);
            return diff ? [`${STAT_INFO[id].short} ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`] : [];
          });
          lines.push(`현재  ${current.name}`, changes.length ? `교체  ${changes.join(' · ')}` : '교체 시 능력치 변화 없음');
        }
      }
    }
    this.detailName.setPosition(x + 90, y + 19).setWordWrapWidth(right - x - 102, true).setVisible(true);
    const textX = this.equipmentView ? x + 90 : x + 18;
    this.detailText.setText(lines.filter(Boolean).join('\n')).setPosition(textX, y + (this.equipmentView ? 53 : 98))
      .setWordWrapWidth(right - textX - 18, true).setVisible(true);
    if (!label) return;
    const buttonY = bottom - 36, buttonWidth = canRemove ? (right - x - 46) / 2 : right - x - 36;
    this.actionButton.setText(label);
    placeMenuButton(g, this.actionButton, x + 18 + buttonWidth / 2, buttonY, buttonWidth, 48, enabled ? 'primary' : 'disabled');
    if (canRemove) {
      this.secondButton.setText('현재 장신구 해제');
      placeMenuButton(g, this.secondButton, right - 18 - buttonWidth / 2, buttonY, buttonWidth, 48);
    }
  }

  private hideAll(): void {
    for (const o of [this.shade, this.panel, this.title, this.gold, this.status, this.closeButton, this.header, this.summaryTitle,
      this.gridLabel, this.pageLabel, this.previous, this.next, this.detailName, this.detailText, this.actionButton, this.secondButton,
      ...Object.values(this.tabs), ...Object.values(this.shopTabs)]) o.setVisible(false);
    for (const row of this.statRows) {
      row.icon.setVisible(false);
      for (const text of [row.name, row.value, row.gain, row.plus]) text.setVisible(false);
    }
    for (const slot of this.slots) {
      slot.icon.setVisible(false);
      slot.label.setVisible(false);
      slot.hit.setVisible(false);
      if (slot.hit.input) slot.hit.input.enabled = false;
    }
    for (const cell of this.cells) cell.setVisible(false);
    for (const name of this.cellNames) name.setVisible(false);
    for (const { label, value } of this.metrics) { label.setVisible(false); value.setVisible(false); }
    this.detailIcon.setVisible(false);
  }

  private text(content: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return menuText(this.scene, DEPTH + 3, content, size, color, bold);
  }

  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    return menuButton(this.scene, DEPTH + 3, label, onTap);
  }
}
