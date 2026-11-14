import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import {
  SIZES, SIZE_LABEL, TIMINGS, TIMING_LABEL, stepOption, type Settings,
} from './settingsData';

/**
 * 일시정지 메뉴와 조작 설정 화면.
 *
 * 열려 있는 동안 씬은 게임 시계를 멈춘다(GameScene.update). 메뉴는 "계속하기 / 설정 / 게임 종료"이고,
 * 설정 화면에서는 버튼 크기, 조이스틱 크기, 저스트 회피 판정을 ◀ ▶로 바꾼다.
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
}

interface OptionRow {
  key: keyof Settings;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  left: Phaser.GameObjects.Text;
  right: Phaser.GameObjects.Text;
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
  private readonly backButton: Phaser.GameObjects.Text;
  private readonly rows: OptionRow[] = [];
  private settings: Settings;
  private view: 'closed' | 'main' | 'settings' = 'closed';
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
    this.backButton = this.button('돌아가기', () => this.show('main'));

    const rowDefs: Array<{ key: keyof Settings; label: string }> = [
      { key: 'buttonSize', label: '버튼 크기' },
      { key: 'joystickSize', label: '조이스틱 크기' },
      { key: 'justDodgeTiming', label: '저스트 회피 판정' },
    ];
    for (const def of rowDefs) {
      const row: OptionRow = {
        key: def.key,
        label: this.text(def.label, 24, '#e9d7b0').setOrigin(0, 0.5),
        value: this.text('', 24, '#ffffff').setOrigin(0.5),
        left: this.arrow('◀', () => this.change(def.key, -1)),
        right: this.arrow('▶', () => this.change(def.key, 1)),
      };
      this.rows.push(row);
    }
    this.show('closed');
  }

  get isOpen(): boolean {
    return this.view !== 'closed';
  }

  open(): void {
    if (this.isOpen) return;
    this.show('main');
  }

  /** 메뉴를 닫고 게임을 이어 간다. */
  close(): void {
    if (!this.isOpen) return;
    this.show('closed');
    this.options.onResume();
  }

  /** 뒤로가기: 설정 화면이면 메뉴로, 메뉴면 게임으로 돌아간다. */
  back(): void {
    if (this.view === 'settings') this.show('main');
    else this.close();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    if (this.shade.input) this.shade.input.hitArea.setSize(width, VIEW_HEIGHT);
    if (this.isOpen) this.place();
  }

  private change(key: keyof Settings, direction: 1 | -1): void {
    const next = { ...this.settings };
    if (key === 'justDodgeTiming') next.justDodgeTiming = stepOption(TIMINGS, next.justDodgeTiming, direction);
    else next[key] = stepOption(SIZES, next[key], direction);
    if (next[key] === this.settings[key]) return;
    this.settings = next;
    this.refreshValues();
    this.options.onSettingsChange({ ...next });
  }

  private refreshValues(): void {
    for (const row of this.rows) {
      const value = this.settings[row.key];
      row.value.setText(row.key === 'justDodgeTiming' ? TIMING_LABEL[value as keyof typeof TIMING_LABEL] : SIZE_LABEL[value as keyof typeof SIZE_LABEL]);
      const options: readonly string[] = row.key === 'justDodgeTiming' ? TIMINGS : SIZES;
      row.left.setAlpha(options.indexOf(value) > 0 ? 1 : 0.3);
      row.right.setAlpha(options.indexOf(value) < options.length - 1 ? 1 : 0.3);
    }
  }

  private show(view: 'closed' | 'main' | 'settings'): void {
    this.view = view;
    const open = view !== 'closed';
    this.shade.setVisible(open);
    this.panel.setVisible(open);
    this.title.setVisible(open).setText(view === 'settings' ? '설정' : '일시정지');
    this.resumeButton.setVisible(view === 'main');
    this.settingsButton.setVisible(view === 'main');
    this.stressButton.setVisible(view === 'main').setText(this.options.stressLabel());
    this.exitButton.setVisible(view === 'main' && this.options.canExit);
    this.backButton.setVisible(view === 'settings');
    for (const row of this.rows) {
      for (const object of [row.label, row.value, row.left, row.right]) object.setVisible(view === 'settings');
    }
    if (view === 'settings') this.refreshValues();
    if (open) this.place();
  }

  private place(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const cx = width / 2;
    const mainButtons = [this.resumeButton, this.settingsButton, this.stressButton, ...(this.options.canExit ? [this.exitButton] : [])];
    const height = this.view === 'settings' ? 400 : 150 + mainButtons.length * 78;
    const top = (VIEW_HEIGHT - height) / 2;
    const left = cx - PANEL_WIDTH / 2;

    const g = this.panel;
    g.clear();
    g.fillStyle(0x140c06, 0.95);
    g.fillRoundedRect(left, top, PANEL_WIDTH, height, 16);
    g.lineStyle(3, 0xe8c37a, 0.85);
    g.strokeRoundedRect(left, top, PANEL_WIDTH, height, 16);
    this.title.setPosition(cx, top + 48);

    if (this.view === 'main') {
      mainButtons.forEach((button, i) => button.setPosition(cx, top + 122 + i * 78));
    } else {
      this.rows.forEach((row, i) => {
        const y = top + 120 + i * 72;
        row.label.setPosition(left + 36, y);
        row.left.setPosition(cx + 70, y);
        row.value.setPosition(cx + 145, y);
        row.right.setPosition(cx + 220, y);
      });
      this.backButton.setPosition(cx, top + height - 52);
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
    const button = this.text(label, 26, '#1a1008')
      .setOrigin(0.5)
      .setBackgroundColor('#e8c37a')
      .setPadding(56, 12, 56, 12)
      .setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
    return button;
  }

  private arrow(label: string, onTap: () => void): Phaser.GameObjects.Text {
    // 손가락으로 누르기 쉽게 글자보다 넓은 범위를 누를 수 있게 한다.
    const arrow = this.text(label, 26, '#e8c37a').setOrigin(0.5).setPadding(18, 10, 18, 10).setInteractive({ useHandCursor: true });
    arrow.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onTap);
    return arrow;
  }
}
