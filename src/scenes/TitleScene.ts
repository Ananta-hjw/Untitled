import Phaser from 'phaser';
import { VIEW_HEIGHT } from '../config';
import backgroundUrl from '../assets/title/background.webp';
import { browserStorage } from '../entities/saveData';
import { PauseMenu } from '../ui/PauseMenu';
import { loadSettings, saveSettings } from '../ui/settingsData';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export const TITLE_FADE_MS = 900;

/** 시온의 뒷모습과 에르다인의 풍경. 설정은 게임과 같은 값으로 저장한다. */
export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private decoration!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private chapter!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private settingsButton!: Phaser.GameObjects.Text;
  private version!: Phaser.GameObjects.Text;
  private menu!: PauseMenu;
  private starting = false;
  private hovered = '';

  constructor() { super('title'); }

  preload(): void {
    if (!this.textures.exists('title-background')) this.load.image('title-background', backgroundUrl);
  }

  create(): void {
    this.starting = false;
    this.hovered = '';
    this.background = this.add.image(0, 0, 'title-background').setOrigin(0.5);
    this.decoration = this.add.graphics();
    this.chapter = this.text('에르다인 · 첫 번째 이야기', 18, '#dfc48b');
    this.title = this.text('로웬의 하루', 64, '#fff5dc').setFontFamily('Georgia, "Noto Serif KR", serif');
    this.subtitle = this.text('빛과 허무가 깨어나는 곳', 23, '#eadbbf');
    this.tagline = this.text('저 너머, 시온의 이야기가 시작됩니다.', 18, '#c7d4cd');
    this.startButton = this.button('시작하기', () => this.start());
    this.settingsButton = this.button('설정', () => this.menu.openSettings());
    this.version = this.text(`프로토타입 v${__APP_VERSION__}`, 14, '#b9c8be');
    const storage = browserStorage();
    this.menu = new PauseMenu(this, {
      settings: loadSettings(storage), onResume: () => undefined,
      onSettingsChange: settings => { saveSettings(storage, settings); },
      canExit: false, onExit: () => undefined, stressLabel: () => '',
      onStress: () => undefined, onBag: () => undefined,
    });
    this.input.keyboard?.on('keydown-ENTER', () => { if (!this.menu.isOpen) this.start(); });
    this.input.keyboard?.on('keydown-SPACE', () => { if (!this.menu.isOpen) this.start(); });
    this.input.keyboard?.on('keydown-ESC', () => this.menu.back());
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private start(): void {
    if (this.starting || this.menu.isOpen) return;
    this.starting = true;
    this.startButton.disableInteractive();
    this.settingsButton.disableInteractive();
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { fromTitle: true }));
    camera.fadeOut(TITLE_FADE_MS, 0, 0, 0);
  }

  private layout(): void {
    const width = this.scale.gameSize.width;
    const scale = Math.max(width / this.background.width, VIEW_HEIGHT / this.background.height);
    this.background.setPosition(width / 2, VIEW_HEIGHT / 2).setScale(scale);
    const left = Math.max(64, width * 0.075);
    this.chapter.setPosition(left, 161);
    this.title.setPosition(left - 3, 204);
    this.subtitle.setPosition(left, 296);
    this.tagline.setPosition(left, 341);
    this.startButton.setPosition(left, 430);
    this.settingsButton.setPosition(left, 530);
    this.version.setPosition(left, VIEW_HEIGHT - 38);
    this.draw();
    this.menu.layout(width);
  }

  private draw(): void {
    const g = this.decoration, width = this.scale.gameSize.width;
    g.clear();
    // 한쪽에만 얇게 겹쳐 풍경을 살리고, 글자가 놓인 곳의 대비를 확보한다.
    const end = Math.min(width * 0.67, 820);
    g.fillGradientStyle(0x061a20, 0x061a20, 0x061a20, 0x061a20, 0.88, 0, 0.88, 0);
    g.fillRect(0, 0, end, VIEW_HEIGHT);
    g.fillGradientStyle(0x081a20, 0x081a20, 0x081a20, 0x081a20, 0, 0, 0.45, 0.45);
    g.fillRect(0, VIEW_HEIGHT - 130, width, 130);
    const x = this.chapter.x;
    g.lineStyle(1, 0xdcc18b, 0.7).lineBetween(x, 137, x + 72, 137);
    for (const [button, primary] of [[this.startButton, true], [this.settingsButton, false]] as const) {
      const hot = this.hovered === button.text;
      g.fillStyle(primary ? (hot ? 0xf4dfae : 0xe0c18a) : (hot ? 0x294442 : 0x132e31), primary ? 1 : 0.92);
      g.fillRoundedRect(button.x, button.y, 300, 84, 8);
      g.lineStyle(1, primary ? 0xffeac0 : 0x9f9b7b, hot ? 1 : 0.75);
      g.strokeRoundedRect(button.x, button.y, 300, 84, 8);
      // 오른쪽의 간결한 화살표. 버튼 전체가 하나의 터치 영역이다.
      g.lineStyle(2, primary ? 0x283630 : 0xd7c79f, 0.9);
      g.lineBetween(button.x + 256, button.y + 42, button.x + 274, button.y + 42);
      g.lineBetween(button.x + 268, button.y + 36, button.x + 274, button.y + 42);
      g.lineBetween(button.x + 268, button.y + 48, button.x + 274, button.y + 42);
    }
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, color }).setResolution(2);
  }

  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    const button = this.text(label, 25, label === '시작하기' ? '#20312e' : '#f1e2c3')
      .setFontStyle('bold').setFixedSize(300, 84).setPadding(26, 25, 0, 0)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => { this.hovered = label; this.draw(); });
    button.on('pointerout', () => { this.hovered = ''; this.draw(); });
    button.on('pointerdown', () => { if (!this.menu?.isOpen) { this.hovered = label; this.draw(); } });
    button.on('pointerup', () => { this.hovered = ''; this.draw(); if (!this.menu.isOpen && !this.starting) onTap(); });
    return button;
  }
}
