import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import {
  DEFAULT_SETTINGS, SIZES, SIZE_LABEL, TIMINGS, TIMING_LABEL, sizeScale, justDodgeWindowMs, type Settings,
} from './settingsData';

/**
 * 일시정지 메뉴와 조작 설정 화면.
 *
 * 열려 있는 동안 씬은 게임 시계를 멈춘다(GameScene.update). 메뉴는 "계속하기 / 설정 / 게임 종료"이고,
 * 설정은 세 가지 선택지를 직접 누르고, 크기 미리보기와 판정 설명을 확인한다.
 * 모든 객체는 처음에 만들어 두고 보이기만 바꾼다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const PANEL_WIDTH = 520;
const DEPTH = DEPTH_UI + 40;

export interface PauseMenuOptions {
  settings: Settings;
  onResume: () => void;
  onSettingsChange: (settings: Settings) => void;
  /** 앱에서만 true. 웹에서는 게임 종료 버튼을 보이지 않는다. */
  canExit: boolean;
  onExit: () => void;
  /** 성능 테스트 버튼 글자 (예: "성능 테스트: 100명") */
  stressLabel: () => string;
  /** 성능 테스트 인원을 다음 단계로 바꾼다. 씬이 다시 시작된다. */
  onStress: () => void;
  /** 가방을 연다 (메뉴는 닫힌다) */
  onBag: () => void;
}

interface OptionRow {
  key: keyof Settings;
  label: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  choices: Array<{ value: string; button: Phaser.GameObjects.Text }>;
}

export class PauseMenu {
  private readonly scene: Phaser.Scene;
  private readonly options: PauseMenuOptions;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly resumeButton: Phaser.GameObjects.Text;
  private readonly settingsButton: Phaser.GameObjects.Text;
  private readonly exitButton: Phaser.GameObjects.Text;
  private readonly stressButton: Phaser.GameObjects.Text;
  private readonly bagButton: Phaser.GameObjects.Text;
  private readonly backButton: Phaser.GameObjects.Text;
  private readonly resetButton: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly previewLabel: Phaser.GameObjects.Text;
  private readonly rows: OptionRow[] = [];
  private settings: Settings;
  private view: 'closed' | 'main' | 'settings' = 'closed';
  /** 처음 화면처럼 설정만 열었을 때: 돌아가기를 누르면 메뉴 대신 바로 닫힌다. */
  private settingsOnly = false;
  private width = 0;

  constructor(scene: Phaser.Scene, options: PauseMenuOptions) {
    this.scene = scene;
    this.options = options;
    this.settings = { ...options.settings };

    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x000000, 0.55).setOrigin(0).setScrollFactor(0).setDepth(DEPTH);
    // 메뉴 뒤의 게임 화면을 누르지 못하게 막는다.
    this.shade.setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.title = this.text('', 34, '#f5ead2').setOrigin(0.5);

    this.resumeButton = this.button('계속하기', () => this.close());
    this.settingsButton = this.button('설정', () => this.show('settings'));
    this.exitButton = this.button('게임 종료', () => options.onExit());
    this.stressButton = this.button('', () => options.onStress());
    this.bagButton = this.button('가방', () => {
      this.show('closed');
      options.onBag();
    });
    this.backButton = this.button('완료', () => this.back());
    this.resetButton = this.button('기본값 복원', () => {
      this.settings = { ...DEFAULT_SETTINGS };
      this.options.onSettingsChange({ ...this.settings });
      this.refreshValues();
    });
    this.help = this.text('변경 즉시 적용 · 기기에 저장', 18, '#afc2ba').setOrigin(0.5);
    this.preview = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
    this.previewLabel = this.text('', 17, '#d8e2d9').setOrigin(0, 0.5);

    const rowDefs: Array<{ key: keyof Settings; label: string; description: string }> = [
      { key: 'buttonSize', label: '동작 버튼', description: '공격 · 회피 · 대화 버튼의 크기' },
      { key: 'joystickSize', label: '이동 조이스틱', description: '왼손으로 움직이는 조작 영역의 크기' },
      { key: 'justDodgeTiming', label: '저스트 회피', description: '공격 직전 회피가 인정되는 시간의 여유' },
    ];
    for (const def of rowDefs) {
      const values = def.key === 'justDodgeTiming' ? TIMINGS : SIZES;
      const labels = def.key === 'justDodgeTiming' ? TIMING_LABEL : SIZE_LABEL;
      this.rows.push({
        key: def.key,
        label: this.text(def.label, 25, '#f2e5c7').setOrigin(0, 0.5),
        description: this.text(def.description, 17, '#b6c6bc').setOrigin(0, 0.5),
        choices: values.map(value => ({ value, button: this.text((labels as Record<string, string>)[value], 22, '#e9dfc8')
          .setOrigin(0.5).setFixedSize(116, 84).setAlign('center').setPadding(0, 28, 0, 0)
          .setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(def.key, value)) })),
      });
    }
    this.show('closed');
  }

  get isOpen(): boolean {
    return this.view !== 'closed';
  }

  open(): void {
    if (this.isOpen) return;
    this.settingsOnly = false;
    this.show('main');
  }

  /** 설정 화면만 연다 (처음 화면). 돌아가기를 누르면 닫힌다. */
  openSettings(): void {
    if (this.isOpen) return;
    this.settingsOnly = true;
    this.show('settings');
  }

  /** 메뉴를 닫고 게임을 이어 간다. */
  close(): void {
    if (!this.isOpen) return;
    this.show('closed');
    this.options.onResume();
  }

  /** 뒤로가기: 설정 화면이면 메뉴로, 메뉴면 게임으로 돌아간다. */
  back(): void {
    if (this.view === 'settings' && !this.settingsOnly) this.show('main');
    else this.close();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    if (this.shade.input) this.shade.input.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.isOpen) this.place();
  }

  private select(key: keyof Settings, value: string): void {
    const values: readonly string[] = key === 'justDodgeTiming' ? TIMINGS : SIZES;
    if (!values.includes(value) || this.settings[key] === value) return;
    this.settings = { ...this.settings, [key]: value };
    this.options.onSettingsChange({ ...this.settings });
    this.refreshValues();
  }

  private refreshValues(): void {
    for (const row of this.rows) {
      for (const choice of row.choices) {
        const selected = choice.value === this.settings[row.key];
        const labels = row.key === 'justDodgeTiming' ? TIMING_LABEL : SIZE_LABEL;
        const label = (labels as Record<string, string>)[choice.value];
        choice.button.setText((selected ? '✓ ' : '') + label)
          .setColor(selected ? '#182d2c' : '#e1dfce').setBackgroundColor(selected ? '#ddc18a' : '#293e3c');
      }
    }
    if (this.view === 'settings') this.place();
  }

  private show(view: 'closed' | 'main' | 'settings'): void {
    this.view = view;
    const open = view !== 'closed';
    this.shade.setVisible(open);
    this.panel.setVisible(open);
    this.title.setVisible(open).setText(view === 'settings' ? '조작 설정' : '일시정지');
    this.resumeButton.setVisible(view === 'main');
    this.settingsButton.setVisible(view === 'main');
    this.bagButton.setVisible(view === 'main');
    this.stressButton.setVisible(view === 'main').setText(this.options.stressLabel());
    this.exitButton.setVisible(view === 'main' && this.options.canExit);
    this.backButton.setVisible(view === 'settings');
    this.resetButton.setVisible(view === 'settings');
    this.help.setVisible(view === 'settings');
    this.preview.setVisible(view === 'settings');
    this.previewLabel.setVisible(view === 'settings');
    for (const row of this.rows) {
      for (const object of [row.label, row.description, ...row.choices.map(c => c.button)]) object.setVisible(view === 'settings');
    }
    if (view === 'settings') this.refreshValues();
    if (open) this.place();
  }

  private place(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const cx = width / 2;
    const mainButtons = [this.resumeButton, this.bagButton, this.settingsButton, this.stressButton, ...(this.options.canExit ? [this.exitButton] : [])];
    const settingsView = this.view === 'settings';
    const panelWidth = settingsView ? Math.min(width - 64, 1000) : PANEL_WIDTH;
    const height = settingsView ? 624 : 150 + mainButtons.length * 78;
    const top = (VIEW_HEIGHT - height) / 2;
    const left = cx - panelWidth / 2;

    const g = this.panel;
    g.clear();
    g.fillStyle(0x102622, 0.98);
    g.fillRoundedRect(left, top, panelWidth, height, 16);
    g.lineStyle(1, 0xd2b77c, 0.85);
    g.strokeRoundedRect(left, top, panelWidth, height, 16);
    this.title.setPosition(cx, top + 48);

    if (this.view === 'main') {
      this.title.setOrigin(0.5);
      mainButtons.forEach((button, i) => button.setPosition(cx, top + 122 + i * 78));
    } else {
      this.title.setPosition(left + 32, top + 45).setOrigin(0, 0.5);
      this.help.setPosition(left + panelWidth - 32, top + 45).setOrigin(1, 0.5);
      this.rows.forEach((row, i) => {
        const y = top + 138 + i * 114;
        g.fillStyle(0x1c3530, 1).fillRoundedRect(left + 20, y - 44, panelWidth - 40, 100, 10);
        row.label.setPosition(left + 40, y - 13);
        row.description.setPosition(left + 40, y + 22);
        row.choices.forEach((choice, j) => choice.button.setPosition(left + panelWidth - 336 + j * 124, y + 4));
      });
      const previewY = top + 471;
      const a = sizeScale(this.settings.buttonSize), j = sizeScale(this.settings.joystickSize);
      const pg = this.preview;
      pg.clear().lineStyle(2, 0xdcc18b, 0.9).strokeCircle(left + 64, previewY, 22 * a);
      pg.lineStyle(2, 0x9cb8ab, 0.9).strokeCircle(left + 144, previewY, 27 * j);
      pg.fillStyle(0x9cb8ab, 0.7).fillCircle(left + 144, previewY, 10 * j);
      this.previewLabel.setPosition(left + 204, previewY).setText(
        `크기 미리보기  ·  버튼 ${Math.round(a * 100)}% / 이동 ${Math.round(j * 100)}%\n회피 판정 ${justDodgeWindowMs(this.settings.justDodgeTiming)}ms  ·  ${this.settings.justDodgeTiming === 'lenient' ? '여유: 저스트 회피에 성공하기 쉬워집니다.' : this.settings.justDodgeTiming === 'strict' ? '엄격: 공격 직전에 정확히 회피해야 합니다.' : '보통: 기본 판정으로 플레이합니다.'}`);
      this.resetButton.setPosition(left + 140, top + height - 56);
      this.backButton.setPosition(left + panelWidth - 110, top + height - 56);
    }
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setResolution(2);
  }

  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    const button = this.text(label, 24, '#f2e3c2')
      .setOrigin(0.5)
      .setBackgroundColor('#304c41')
      .setPadding(32, 16, 32, 16)
      .setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
    return button;
  }

}
