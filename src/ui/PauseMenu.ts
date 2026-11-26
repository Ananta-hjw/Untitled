import type Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import { MENU_COLOR, drawMenuCard, drawMenuFrame, menuButton, menuText, placeMenuButton } from './menuSkin';
import {
  DEFAULT_SETTINGS, SIZES, SIZE_LABEL, TIMINGS, TIMING_LABEL, sizeScale, justDodgeWindowMs, type Settings,
} from './settingsData';

const DEPTH = DEPTH_UI + 40;

export interface PauseMenuOptions {
  settings: Settings;
  onResume: () => void;
  onSettingsChange: (settings: Settings) => void;
  canExit: boolean;
  onExit: () => void;
  stressLabel: () => string;
  onStress: () => void;
  onCharacter: (tab: 'status' | 'items') => boolean;
}

interface OptionRow {
  key: keyof Settings;
  label: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  choices: Array<{ value: string; button: Phaser.GameObjects.Text }>;
}

type PauseView = 'closed' | 'main' | 'settings' | 'exit';

export class PauseMenu {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;
  private readonly resumeButton: Phaser.GameObjects.Text;
  private readonly characterButton: Phaser.GameObjects.Text;
  private readonly bagButton: Phaser.GameObjects.Text;
  private readonly settingsButton: Phaser.GameObjects.Text;
  private readonly exitButton: Phaser.GameObjects.Text;
  private readonly confirmExitButton: Phaser.GameObjects.Text;
  private readonly stressButton: Phaser.GameObjects.Text;
  private readonly backButton: Phaser.GameObjects.Text;
  private readonly resetButton: Phaser.GameObjects.Text;
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly previewLabel: Phaser.GameObjects.Text;
  private readonly rows: OptionRow[] = [];
  private settings: Settings;
  private view: PauseView = 'closed';
  private settingsOnly = false;
  private width = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly options: PauseMenuOptions) {
    this.settings = { ...options.settings };
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x080604, .67)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = menuText(scene, DEPTH + 2, '', 38, MENU_COLOR.ink, true).setOrigin(0, .5);
    this.help = menuText(scene, DEPTH + 2, '', 18, MENU_COLOR.muted).setOrigin(0, .5);

    const button = (label: string, tap: () => void, size?: number) => menuButton(scene, DEPTH + 2, label, tap, size);
    this.resumeButton = button('계속하기', () => this.close(), 25);
    this.characterButton = button('캐릭터 정보', () => this.openCharacter('status'));
    this.bagButton = button('가방', () => this.openCharacter('items'));
    this.settingsButton = button('조작 설정', () => this.show('settings'));
    this.exitButton = button('게임 종료', () => this.show('exit'), 17);
    this.confirmExitButton = button('게임 종료', options.onExit);
    this.stressButton = button(options.stressLabel(), options.onStress, 17);
    this.backButton = button('완료', () => this.back());
    this.resetButton = button('기본값 복원', () => this.apply({ ...DEFAULT_SETTINGS }), 18);
    this.preview = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
    this.previewLabel = menuText(scene, DEPTH + 2, '', 17, MENU_COLOR.muted).setOrigin(0, .5).setLineSpacing(7);

    const rowDefs = [
      { key: 'buttonSize', label: '동작 버튼', description: '공격 · 회피 · 대화 버튼의 크기', values: SIZES, labels: SIZE_LABEL },
      { key: 'joystickSize', label: '이동 조이스틱', description: '왼손 이동 조작 영역의 크기', values: SIZES, labels: SIZE_LABEL },
      { key: 'justDodgeTiming', label: '저스트 회피', description: '저스트 회피가 인정되는 시간', values: TIMINGS, labels: TIMING_LABEL },
    ] as const;
    for (const { key, label, description, values, labels } of rowDefs) {
      this.rows.push({
        key,
        label: menuText(scene, DEPTH + 2, label, 22, MENU_COLOR.ink, true).setOrigin(0, .5),
        description: menuText(scene, DEPTH + 2, description, 17, MENU_COLOR.muted).setOrigin(0, .5),
        choices: values.map(value => ({ value, button: button((labels as Record<string, string>)[value], () => {
          if (this.view === 'settings' && this.settings[key] !== value) this.apply({ ...this.settings, [key]: value });
        }, 18) })),
      });
    }
    this.show('closed');
  }

  get isOpen(): boolean { return this.view !== 'closed'; }

  open(): void {
    if (this.isOpen) return;
    this.settingsOnly = false;
    this.show('main');
  }

  openSettings(): void {
    if (this.isOpen) return;
    this.settingsOnly = true;
    this.show('settings');
  }

  close(): void {
    if (!this.isOpen) return;
    this.show('closed');
    this.options.onResume();
  }

  back(): void {
    if (this.view === 'exit' || (this.view === 'settings' && !this.settingsOnly)) this.show('main');
    else this.close();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.isOpen) this.place();
  }

  private openCharacter(tab: 'status' | 'items'): void {
    this.show('closed');
    if (!this.options.onCharacter(tab)) this.show('main');
  }

  private apply(settings: Settings): void {
    this.settings = settings;
    this.options.onSettingsChange({ ...settings });
    this.place();
  }

  private show(view: PauseView): void {
    this.view = view;
    const open = this.isOpen, main = view === 'main', settings = view === 'settings', exit = view === 'exit';
    this.shade.setVisible(open);
    this.panel.setVisible(open);
    this.title.setVisible(open);
    this.help.setVisible(settings);
    for (const object of [this.resumeButton, this.characterButton, this.bagButton, this.settingsButton, this.stressButton]) object.setVisible(main);
    this.exitButton.setVisible(main && this.options.canExit);
    this.backButton.setVisible(settings || exit);
    this.confirmExitButton.setVisible(exit);
    for (const object of [this.resetButton, this.preview, this.previewLabel]) object.setVisible(settings);
    for (const row of this.rows) {
      for (const object of [row.label, row.description, ...row.choices.map(c => c.button)]) object.setVisible(settings);
    }
    if (open) this.place();
  }

  private place(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const cx = width / 2, settings = this.view === 'settings', exit = this.view === 'exit';
    const w = Math.min(width - 48, settings ? 868 : exit ? 530 : 702);
    const h = settings ? 610 : exit ? 203 : 344;
    const x = cx - w / 2, y = (VIEW_HEIGHT - h) / 2, right = x + w;
    const g = this.panel;
    drawMenuFrame(g, x, y, w, h);
    this.title.setPosition(x + 30, y + 51).setText(settings ? '조작 설정' : exit ? '게임을 종료할까요?' : '일시정지');
    g.lineStyle(1, 0x574737).lineBetween(x + 30, y + 86, right - 30, y + 86);

    if (exit) {
      this.backButton.setText('취소');
      placeMenuButton(g, this.backButton, x + 122, y + 145, 160, 56);
      placeMenuButton(g, this.confirmExitButton, right - 122, y + 145, 160, 56, 'danger');
      return;
    }
    if (!settings) {
      placeMenuButton(g, this.resumeButton, cx, y + 136, w - 60, 62, 'primary');
      const buttonWidth = (w - 84) / 3;
      [this.characterButton, this.bagButton, this.settingsButton].forEach((button, index) => {
        placeMenuButton(g, button, x + 30 + buttonWidth / 2 + index * (buttonWidth + 12), y + 215, buttonWidth, 62);
      });
      g.lineStyle(1, 0x493b2f).lineBetween(x + 30, y + 264, right - 30, y + 264);
      this.stressButton.setText(this.options.stressLabel());
      placeMenuButton(g, this.stressButton, x + 137, y + 302, 214, 44);
      if (this.options.canExit) placeMenuButton(g, this.exitButton, right - 95, y + 302, 130, 44, 'danger');
      return;
    }

    this.help.setText('변경 즉시 저장').setOrigin(1, .5).setPosition(right - 30, y + 51);
    this.rows.forEach((row, index) => {
      const cy = y + 141 + index * 91;
      drawMenuCard(g, x + 24, cy - 38, w - 48, 76);
      row.label.setPosition(x + 43, cy - 12);
      row.description.setPosition(x + 43, cy + 16);
      row.choices.forEach((choice, order) => {
        const selected = this.settings[row.key] === choice.value;
        const label = ((row.key === 'justDodgeTiming' ? TIMING_LABEL : SIZE_LABEL) as Record<string, string>)[choice.value];
        choice.button.setText(selected ? `✓ ${label}` : label);
        placeMenuButton(g, choice.button, right - 91 - (2 - order) * 115, cy, 106, 48, selected ? 'selected' : 'quiet');
      });
    });
    const previewY = y + 448;
    drawMenuCard(g, x + 24, previewY - 42, w - 48, 84);
    const a = sizeScale(this.settings.buttonSize), j = sizeScale(this.settings.joystickSize);
    this.preview.clear().lineStyle(2, 0xdab87a).strokeCircle(x + 73, previewY, 19 * a)
      .lineStyle(2, 0xaeb2a0).strokeCircle(x + 144, previewY, 25 * j)
      .fillStyle(0xaeb2a0, .75).fillCircle(x + 144, previewY, 8 * j);
    const timing = this.settings.justDodgeTiming;
    this.previewLabel.setPosition(x + 193, previewY).setText(
      `동작 버튼 ${Math.round(a * 100)}%  ·  이동 ${Math.round(j * 100)}%\n회피 판정 ${justDodgeWindowMs(timing)}ms  ·  ${TIMING_LABEL[timing]}`);
    this.backButton.setOrigin(.5).setText('완료');
    placeMenuButton(g, this.resetButton, x + 114, y + 552, 176, 54);
    placeMenuButton(g, this.backButton, right - 123, y + 552, 196, 54, 'primary');
  }
}
