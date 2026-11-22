import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { STAT_IDS, STAT_INFO, statGain, type DerivedStats, type StatBlock, type StatId } from '../entities/attributes';
import {
  GEAR, GEAR_IDS, SLOT_IDS, SLOT_INFO, fits, gearCount, type Gear, type GearId, type SlotId,
} from '../items/equipment';
import { ITEMS, ITEM_IDS, countOf, type Inventory, type ItemId } from '../items/inventory';
import { IconView, type IconFallback } from './icons';

/**
 * 캐릭터 창: 상태(능력치 분배) · 장비(일곱 칸) · 아이템(가방) 탭.
 * 도란의 대장간에서는 같은 창을 장비 상점(구매·판매)으로 쓴다.
 * 창은 보여 주기만 하고, 실제 변경은 장면(GameScene)이 콜백을 받아 한 뒤 refresh()로 다시 그린다.
 * 열린 동안 게임은 멈춘다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const DEPTH = DEPTH_UI + 40;
const GRID_COLUMNS = 5;
const GRID_CELLS = 15;
const CELL = 84;

export type CharacterTab = 'status' | 'equip' | 'items';
export type ShopTab = 'buy' | 'sell';

export interface CharacterView {
  name: string;
  level: number;
  hp: number;
  mp: number;
  pointsLeft: number;
  /** 최종 능력치(기본 + 분배 + 장비)와 그중 장비 몫 */
  stats: StatBlock;
  bonus: Partial<StatBlock>;
  derived: DerivedStats;
  inventory: Inventory;
  gear: Gear;
}

export interface CharacterActions {
  allocate(stat: StatId): void;
  equip(id: GearId, slot: SlotId): void;
  unequip(slot: SlotId): void;
  use(id: ItemId): void;
  buy(id: GearId): void;
  sell(id: GearId): void;
  close(): void;
}

type Entry = { type: 'item'; id: ItemId; count: number } | { type: 'gear'; id: GearId; count: number };

const STAT_COLORS: Record<StatId, number> = {
  str: 0x8a3a2c, vit: 0x3f7a3a, def: 0x4a5a72, dex: 0x2f7a72, int: 0x4b4a8f, luk: 0x8a7a2c,
};

export function itemFallback(entry: Entry): IconFallback {
  if (entry.type === 'gear') return { glyph: GEAR[entry.id].name.slice(0, 2), color: 0x5a4a32 };
  const def = ITEMS[entry.id];
  return { glyph: def.name.slice(0, 2), color: def.kind === 'consumable' ? 0x7a3b2a : 0x3a5a3a };
}

function statsText(stats: Partial<StatBlock>): string {
  return (Object.entries(stats) as [StatId, number][]).map(([id, v]) => `${STAT_INFO[id].short} +${v}`).join('  ');
}

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
  private readonly statRows: { icon: IconView; name: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; plus: Phaser.GameObjects.Text }[] = [];
  private readonly derivedText: Phaser.GameObjects.Text;
  // 장비 탭
  private readonly slots: { icon: IconView; label: Phaser.GameObjects.Text }[] = [];
  // 가방·상점 격자와 설명
  private readonly cells: IconView[] = [];
  private readonly gridLabel: Phaser.GameObjects.Text;
  private readonly detailIcon: IconView;
  private readonly detailName: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Text;
  private readonly secondButton: Phaser.GameObjects.Text;

  private open = false;
  private mode: 'character' | 'smithy' = 'character';
  private tab: CharacterTab = 'status';
  private shopTab: ShopTab = 'buy';
  private view?: CharacterView;
  private entries: Entry[] = [];
  private selectedEntry?: Entry;
  private selectedSlot: SlotId = 'weapon';
  private width = 0;

  constructor(scene: Phaser.Scene, actions: CharacterActions) {
    this.scene = scene;
    this.actions = actions;
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x06130f, 0.74)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('', 30, '#fff0cf').setOrigin(0, 0.5);
    this.gold = this.text('', 22, '#efd18e').setOrigin(1, 0.5);
    this.status = this.text('', 19, '#d9e8c6').setOrigin(0, 0.5);
    this.closeButton = this.button('닫기', 130, 56, () => this.close());
    this.tabs = {
      status: this.button('상태', 130, 56, () => this.switchTab('status')),
      equip: this.button('장비', 130, 56, () => this.switchTab('equip')),
      items: this.button('아이템', 130, 56, () => this.switchTab('items')),
    };
    this.shopTabs = {
      buy: this.button('구매', 130, 56, () => this.switchShopTab('buy')),
      sell: this.button('판매', 130, 56, () => this.switchShopTab('sell')),
    };

    this.header = this.text('', 24, '#f7ecd2').setOrigin(0, 0.5);
    for (const id of STAT_IDS) {
      this.statRows.push({
        icon: new IconView(scene, 56, DEPTH + 2),
        name: this.text('', 22, '#f7ecd2').setOrigin(0, 0.5).setLineSpacing(4),
        value: this.text('', 26, '#fff3c4').setOrigin(1, 0.5),
        plus: this.button('+', 56, 52, () => this.actions.allocate(id)),
      });
    }
    this.derivedText = this.text('', 19, '#d6e2d0').setOrigin(0, 0).setLineSpacing(10);

    for (const slot of SLOT_IDS) {
      this.slots.push({
        icon: new IconView(scene, 76, DEPTH + 2, () => this.selectSlot(slot)),
        label: this.text('', 18, '#e7dcc0').setOrigin(0, 0.5).setLineSpacing(4),
      });
    }

    this.gridLabel = this.text('', 19, '#bcd0c2').setOrigin(0, 0.5);
    for (let i = 0; i < GRID_CELLS; i++) this.cells.push(new IconView(scene, CELL, DEPTH + 2, () => this.selectCell(i)));
    this.detailIcon = new IconView(scene, 96, DEPTH + 2);
    this.detailName = this.text('', 26, '#fff0cf').setOrigin(0, 0.5);
    this.detailText = this.text('', 19, '#d6e2d0').setOrigin(0, 0).setLineSpacing(8);
    this.actionButton = this.button('', 190, 60, () => this.primary());
    this.secondButton = this.button('', 190, 60, () => this.secondary());
    this.hideAll();
  }

  get isOpen(): boolean { return this.open; }
  get currentTab(): CharacterTab { return this.tab; }

  /** 캐릭터 창(상태·장비·아이템)을 연다. */
  show(tab: CharacterTab, view: CharacterView): void {
    this.mode = 'character';
    this.tab = tab;
    this.openWith(view, tab === 'status' ? '레벨이 오르면 포인트로 능력치를 올릴 수 있어요.'
      : tab === 'equip' ? '칸을 누르고, 아래에서 낄 장비를 고르세요.' : '아이템을 누르면 설명과 사용 버튼이 나와요.');
  }

  /** 도란의 대장간: 장비를 사고판다. */
  showSmithy(view: CharacterView): void {
    this.mode = 'smithy';
    this.shopTab = 'buy';
    this.openWith(view, '한 번 누를 때마다 하나씩 거래합니다.');
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.hideAll();
    this.actions.close();
  }

  setStatus(message: string, error = false): void {
    this.status.setText(message).setColor(error ? '#f0b5a0' : '#d9e8c6');
  }

  /** 장면이 바뀐 상태를 넘겨 다시 그린다. */
  refresh(view: CharacterView): void {
    this.view = view;
    if (!this.open) return;
    this.entries = this.collectEntries(view);
    // 선택한 것이 사라졌으면(다 쓰거나 끼었으면) 선택을 푼다.
    const kept = this.selectedEntry && this.entries.find((e) => e.type === this.selectedEntry!.type && e.id === this.selectedEntry!.id);
    this.selectedEntry = kept;
    this.render();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.open) this.render();
  }

  // ---------------------------------------------------------------- 선택

  private openWith(view: CharacterView, message: string): void {
    this.open = true;
    this.selectedEntry = undefined;
    this.selectedSlot = 'weapon';
    this.setStatus(message);
    this.refresh(view);
  }

  private switchTab(tab: CharacterTab): void {
    if (!this.open || this.mode !== 'character') return;
    this.tab = tab;
    this.selectedEntry = undefined;
    this.setStatus(tab === 'status' ? '레벨이 오르면 포인트로 능력치를 올릴 수 있어요.'
      : tab === 'equip' ? '칸을 누르고, 아래에서 낄 장비를 고르세요.' : '아이템을 누르면 설명과 사용 버튼이 나와요.');
    if (this.view) this.refresh(this.view);
  }

  private switchShopTab(tab: ShopTab): void {
    if (!this.open || this.mode !== 'smithy') return;
    this.shopTab = tab;
    this.selectedEntry = undefined;
    this.setStatus(tab === 'buy' ? '한 번 누를 때마다 하나씩 삽니다.' : '끼지 않은 장비만 팔 수 있어요.');
    if (this.view) this.refresh(this.view);
  }

  private selectSlot(slot: SlotId): void {
    this.selectedSlot = slot;
    this.selectedEntry = undefined;
    if (this.view) this.refresh(this.view);
  }

  private selectCell(index: number): void {
    this.selectedEntry = this.entries[index];
    if (this.view) this.refresh(this.view);
  }

  private collectEntries(view: CharacterView): Entry[] {
    const gearEntries = (ids: GearId[], counts: (id: GearId) => number) =>
      ids.map((id): Entry => ({ type: 'gear', id, count: counts(id) }));
    if (this.mode === 'smithy') {
      return this.shopTab === 'buy'
        ? gearEntries(GEAR_IDS.filter((id) => GEAR[id].price !== undefined), (id) => gearCount(view.gear, id))
        : gearEntries(GEAR_IDS.filter((id) => gearCount(view.gear, id) > 0), (id) => gearCount(view.gear, id));
    }
    if (this.tab === 'equip') {
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
      if (entry?.type === 'gear') (this.shopTab === 'buy' ? this.actions.buy : this.actions.sell)(entry.id);
      return;
    }
    if (entry?.type === 'item') this.actions.use(entry.id);
    else if (entry?.type === 'gear') this.actions.equip(entry.id, this.tab === 'equip' ? this.selectedSlot : this.slotForEntry(entry.id, view.gear));
    else if (this.tab === 'equip' && view.gear.equipped[this.selectedSlot]) this.actions.unequip(this.selectedSlot);
  }

  private secondary(): void {
    const view = this.view;
    if (view && this.mode === 'character' && this.tab === 'equip' && view.gear.equipped[this.selectedSlot]) this.actions.unequip(this.selectedSlot);
  }

  private slotForEntry(id: GearId, gear: Gear): SlotId {
    const kind = GEAR[id].kind;
    if (kind !== 'accessory') return kind;
    return !gear.equipped.accessory1 ? 'accessory1' : !gear.equipped.accessory2 ? 'accessory2' : 'accessory1';
  }

  // ---------------------------------------------------------------- 그리기

  private render(): void {
    const view = this.view;
    if (!view) return;
    this.hideAll();
    const width = this.width || this.scene.scale.gameSize.width;
    const panelWidth = Math.min(1120, width - 48), left = (width - panelWidth) / 2, top = 24, height = 672;
    const right = left + panelWidth;
    const g = this.panel.clear().setVisible(true);
    this.shade.setVisible(true);
    g.fillStyle(0x10271f, 0.99).fillRoundedRect(left, top, panelWidth, height, 18);
    g.lineStyle(1, 0xcbb17c, 0.95).strokeRoundedRect(left, top, panelWidth, height, 18);
    g.lineStyle(1, 0x6b8064, 0.5).lineBetween(left + 24, top + 88, right - 24, top + 88);
    g.lineBetween(left + 24, top + 612, right - 24, top + 612);

    this.gold.setText(`보유 골드  ${view.inventory.gold.toLocaleString()} G`).setPosition(right - 170, top + 46).setVisible(true);
    this.closeButton.setPosition(right - 85, top + 46).setVisible(true);
    this.status.setPosition(left + 30, top + 642).setVisible(true);

    if (this.mode === 'smithy') {
      this.title.setText('도란의 대장간').setPosition(left + 30, top + 46).setVisible(true);
      (['buy', 'sell'] as ShopTab[]).forEach((tab, i) => this.placeTab(this.shopTabs[tab], left + 330 + i * 140, top + 46, this.shopTab === tab));
      this.renderGrid(view, left + 30, top + 110, '');
      this.renderDetail(view, left + 30 + GRID_COLUMNS * (CELL + 10) + 20, right - 30, top + 110);
      return;
    }
    (['status', 'equip', 'items'] as CharacterTab[]).forEach((tab, i) => this.placeTab(this.tabs[tab], left + 95 + i * 140, top + 46, this.tab === tab));
    if (this.tab === 'status') this.renderStatus(view, left, right, top);
    else if (this.tab === 'equip') this.renderEquip(view, left, right, top);
    else {
      this.renderGrid(view, left + 30, top + 110, '가방');
      this.renderDetail(view, left + 30 + GRID_COLUMNS * (CELL + 10) + 20, right - 30, top + 110);
    }
  }

  private renderStatus(view: CharacterView, left: number, right: number, top: number): void {
    this.header.setText(`${view.name}   Lv. ${view.level}      남은 포인트  ${view.pointsLeft}`)
      .setColor(view.pointsLeft > 0 ? '#ffd77a' : '#f7ecd2').setPosition(left + 30, top + 118).setVisible(true);
    // 오른쪽에 전투 능력, 그 왼쪽에 능력치 값과 + 버튼. 화면이 좁아도 전투 능력 칸은 290px를 지킨다.
    const derivedX = right - 290, valueX = derivedX - 110, plusX = derivedX - 58;
    STAT_IDS.forEach((id, i) => {
      const row = this.statRows[i], y = top + 186 + i * 70, info = STAT_INFO[id];
      const bonus = view.bonus[id] ?? 0;
      row.icon.set('stats', id, { glyph: info.short, color: STAT_COLORS[id] }).setPosition(left + 60, y).setVisible(true);
      // 첫 줄: 이름과 설명, 둘째 줄: 포인트 하나를 넣으면 실제로 바뀌는 값
      row.name.setText(`${info.name} ${info.short}   ${info.description}\n+1  ${statGain(view.level, view.stats, id)}`)
        .setPosition(left + 100, y).setVisible(true);
      row.name.setStyle({ fontSize: '18px' });
      row.value.setText(bonus ? `${view.stats[id]}  (+${bonus})` : `${view.stats[id]}`).setPosition(valueX, y).setVisible(true);
      this.placeButton(row.plus, plusX, y, view.pointsLeft > 0);
    });
    const d = view.derived;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    this.derivedText.setText([
      '전투 능력',
      `공격력   ${d.damageMin} ~ ${d.damageMax}`,
      `체력   ${view.hp} / ${d.maxHp}`,
      `마나   ${Math.floor(view.mp)} / ${d.maxMp}`,
      `받는 피해   ${pct(d.damageTaken)}`,
      `회피 확률   ${Math.round(d.evadeChance * 1000) / 10}%`,
      `회피 재사용 대기   ${Math.round(d.dodgeCooldown * 1000) / 10}%`,
      `치명타 확률   ${pct(d.critChance)}`,
      `스킬·마법 피해   ${pct(d.skillDamage)}`,
      `골드 획득   ${pct(d.goldGain)}`,
    ].join('\n')).setPosition(derivedX + 10, top + 120).setVisible(true);
  }

  private renderEquip(view: CharacterView, left: number, right: number, top: number): void {
    // 왼쪽: 일곱 칸 (두 줄)
    SLOT_IDS.forEach((slot, i) => {
      const column = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4;
      const x = left + 70 + column * 300, y = top + 150 + row * 108;
      const id = view.gear.equipped[slot];
      const kind = SLOT_INFO[slot].kind;
      const cell = this.slots[i];
      if (id) cell.icon.set('items', id, { glyph: GEAR[id].name.slice(0, 2), color: 0x5a4a32 });
      else cell.icon.set('slots', kind, { glyph: SLOT_INFO[slot].name.slice(0, 2), color: 0x1d3329 }, undefined, true);
      cell.icon.setSelected(slot === this.selectedSlot).setPosition(x, y).setVisible(true);
      cell.label.setText(`${SLOT_INFO[slot].name}\n${id ? GEAR[id].name : '비어 있음'}`).setColor(id ? '#f7ecd2' : '#93a597')
        .setPosition(x + 50, y).setVisible(true);
    });
    const equipped = view.gear.equipped[this.selectedSlot];
    const gridLeft = left + 640;
    this.renderGrid(view, gridLeft, top + 110, `${SLOT_INFO[this.selectedSlot].name}에 낄 수 있는 장비`, 4);
    this.renderDetail(view, gridLeft, right - 30, top + 110 + 2 * (CELL + 10) + 30, equipped);
  }

  private renderGrid(view: CharacterView, x: number, y: number, label: string, columns = GRID_COLUMNS): void {
    const rows = this.mode === 'character' && this.tab === 'equip' ? 2 : 3;
    if (label) this.gridLabel.setText(label).setPosition(x, y + 6).setVisible(true);
    const startY = y + (label ? 34 : 0) + CELL / 2;
    this.cells.forEach((cell, i) => {
      const entry = this.entries[i];
      if (i >= columns * rows) return;
      const cx = x + CELL / 2 + (i % columns) * (CELL + 10), cy = startY + Math.floor(i / columns) * (CELL + 10);
      if (!entry) {
        cell.set('items', '', { glyph: '', color: 0x16241d }, undefined, true).setSelected(false).setPosition(cx, cy).setVisible(true);
        return;
      }
      const smithyBuy = this.mode === 'smithy' && this.shopTab === 'buy';
      cell.set('items', entry.id, itemFallback(entry), smithyBuy ? undefined : entry.count)
        .setSelected(this.selectedEntry?.type === entry.type && this.selectedEntry.id === entry.id)
        .setPosition(cx, cy).setVisible(true);
    });
    if (this.entries.length === 0 && !(this.mode === 'character' && this.tab === 'equip')) {
      this.setStatus(this.mode === 'smithy' ? '팔 수 있는 장비가 없어요.' : '가방이 비어 있어요.');
    }
    void view;
  }

  /** 오른쪽 설명: 선택한 아이템·장비(또는 장비 탭에서 그 칸에 낀 장비) */
  private renderDetail(view: CharacterView, x: number, right: number, y: number, equipped?: GearId): void {
    const entry = this.selectedEntry;
    const shown: Entry | undefined = entry ?? (equipped ? { type: 'gear', id: equipped, count: 1 } : undefined);
    if (!shown) {
      this.detailName.setText(this.mode === 'character' && this.tab === 'equip' ? '빈 칸' : '선택한 것이 없어요').setPosition(x, y + 20).setVisible(true);
      return;
    }
    this.detailIcon.set('items', shown.id, itemFallback(shown)).setPosition(x + 48, y + 50).setVisible(true);
    const lines: string[] = [];
    if (shown.type === 'item') {
      const def = ITEMS[shown.id];
      this.detailName.setText(def.name);
      lines.push(def.description, def.kind === 'consumable' ? `체력 ${def.heal} 회복` : '재료 · 잡화점에 팔 수 있다', `보유 ${shown.count}개`);
    } else {
      const def = GEAR[shown.id];
      this.detailName.setText(def.name);
      lines.push(`${SLOT_INFO[def.kind === 'accessory' ? 'accessory1' : def.kind].name.replace(' 1', '')} 장비`, statsText(def.stats), def.description);
      if (this.mode === 'smithy') lines.push(this.shopTab === 'buy' ? `값 ${def.price} G · 보유 ${gearCount(view.gear, shown.id)}개` : `판매가 ${def.sellPrice} G · 보유 ${shown.count}개`);
      else if (!entry && equipped) lines.push('지금 끼고 있다');
    }
    // 이름과 설명은 아이콘 오른쪽에 둔다(장비 탭처럼 자리가 좁아도 버튼이 아래 줄과 겹치지 않게).
    this.detailName.setPosition(x + 112, y + 16).setVisible(true);
    this.detailText.setText(lines.join('\n')).setWordWrapWidth(right - x - 122).setPosition(x + 112, y + 40).setVisible(true);

    const buttonY = y + 206;
    if (this.mode === 'smithy') {
      const def = GEAR[shown.id as GearId];
      const ok = this.shopTab === 'buy' ? view.inventory.gold >= (def.price ?? Infinity) : gearCount(view.gear, shown.id as GearId) > 0;
      this.actionButton.setText(this.shopTab === 'buy' ? `구매 ${def.price} G` : `판매 ${def.sellPrice} G`);
      this.placeButton(this.actionButton, x + 95, buttonY, ok);
      return;
    }
    if (entry?.type === 'item') {
      const usable = ITEMS[entry.id].kind === 'consumable' && view.hp < view.derived.maxHp;
      this.actionButton.setText(ITEMS[entry.id].kind === 'consumable' ? '사용' : '재료');
      this.placeButton(this.actionButton, x + 95, buttonY, usable);
    } else if (entry?.type === 'gear') {
      this.actionButton.setText('장착');
      this.placeButton(this.actionButton, x + 95, buttonY, true);
      if (this.tab === 'equip' && equipped) {
        this.secondButton.setText('해제');
        this.placeButton(this.secondButton, x + 305, buttonY, true);
      }
    } else if (equipped) {
      this.actionButton.setText('해제');
      this.placeButton(this.actionButton, x + 95, buttonY, true);
    }
  }

  // ---------------------------------------------------------------- 도우미

  private placeTab(button: Phaser.GameObjects.Text, x: number, y: number, selected: boolean): void {
    button.setPosition(x, y).setVisible(true).setBackgroundColor(selected ? '#dfc18a' : '#294337').setColor(selected ? '#1a302a' : '#e4dfc8');
    button.setInteractive({ useHandCursor: true });
  }

  private placeButton(button: Phaser.GameObjects.Text, x: number, y: number, enabled: boolean): void {
    button.setPosition(x, y).setVisible(true).setBackgroundColor(enabled ? '#dfc18a' : '#344a40').setColor(enabled ? '#1a302a' : '#93a597');
    if (enabled) button.setInteractive({ useHandCursor: true });
    else button.disableInteractive();
  }

  private hideAll(): void {
    for (const o of [this.shade, this.panel, this.title, this.gold, this.status, this.closeButton, this.header, this.derivedText,
      this.gridLabel, this.detailName, this.detailText, this.actionButton, this.secondButton,
      ...Object.values(this.tabs), ...Object.values(this.shopTabs)]) o.setVisible(false);
    for (const row of this.statRows) { row.icon.setVisible(false); row.name.setVisible(false); row.value.setVisible(false); row.plus.setVisible(false); }
    for (const slot of this.slots) { slot.icon.setVisible(false); slot.label.setVisible(false); }
    for (const cell of this.cells) cell.setVisible(false);
    this.detailIcon.setVisible(false);
    for (const b of [this.actionButton, this.secondButton, ...this.statRows.map((r) => r.plus)]) b.disableInteractive();
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0).setDepth(DEPTH + 3).setResolution(2);
  }

  private button(label: string, width: number, height: number, onTap: () => void): Phaser.GameObjects.Text {
    return this.text(label, 22, '#1a302a').setOrigin(0.5).setFixedSize(width, height).setAlign('center')
      .setPadding(0, Math.round((height - 26) / 2), 0, 0).setBackgroundColor('#dfc18a').setInteractive({ useHandCursor: true })
      .on('pointerup', onTap);
  }
}
