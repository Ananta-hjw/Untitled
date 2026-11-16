import Phaser from 'phaser';
import { VIEW_HEIGHT } from '../config';
import backgroundUrl from '../assets/title/background.webp';
import { browserStorage } from '../entities/saveData';
import { PauseMenu } from '../ui/PauseMenu';
import { loadSettings, saveSettings } from '../ui/settingsData';

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
/** 시작하기를 누른 뒤 화면이 어두워지는 시간과, 게임 화면이 밝아지는 시간 (ms) */
export const TITLE_FADE_MS = 900;

/**
 * 처음 화면. 배경 위에 제목과 "시작하기", "설정" 버튼을 띄운다.
 * 시작하기를 누르면 화면이 스르르 어두워진 뒤 게임(GameScene)이 시작되고, 게임 화면은 스르르 밝아진다.
 * 설정은 일시정지 메뉴의 설정 화면을 그대로 쓰고, 같은 저장 키(untitled-rpg.settings)에 저장한다.
 * 배경은 임시로 로웬 마을 조감도(src/assets/village/rowen/overview.png)를 줄인 그림이다.
 */
export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private settingsButton!: Phaser.GameObjects.Text;
  private version!: Phaser.GameObjects.Text;
  private menu!: PauseMenu;
  private starting = false;

  constructor() {
    super('title');
  }

  preload(): void {
    if (!this.textures.exists('title-background')) this.load.image('title-background', backgroundUrl);
  }

  create(): void {
    this.starting = false;
    this.background = this.add.image(0, 0, 'title-background').setOrigin(0.5);
    // 글자가 잘 보이도록 배경을 살짝 어둡게 한다.
    this.shade = this.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x0d0907, 0.35).setOrigin(0);
    this.title = this.text('로웬의 하루', 76, '#fff4d6').setOrigin(0.5).setStroke('#1a1008', 10);
    this.subtitle = this.text('Untitled RPG', 24, '#e8c37a').setOrigin(0.5).setStroke('#1a1008', 6);
    this.startButton = this.button('시작하기', () => this.start());
    this.settingsButton = this.button('설정', () => this.menu.openSettings());
    this.version = this.text(`프로토타입 v${__APP_VERSION__}`, 16, '#e9dcc0').setOrigin(0.5, 1).setAlpha(0.8);

    const storage = browserStorage();
    this.menu = new PauseMenu(this, {
      settings: loadSettings(storage),
      onResume: () => undefined,
      onSettingsChange: (settings) => saveSettings(storage, settings),
      canExit: false,
      onExit: () => undefined,
      stressLabel: () => '',
      onStress: () => undefined,
      onBag: () => undefined,
    });

    this.input.keyboard?.on('keydown-ENTER', () => { if (!this.menu.isOpen) this.start(); });
    this.input.keyboard?.on('keydown-SPACE', () => { if (!this.menu.isOpen) this.start(); });
    this.input.keyboard?.on('keydown-ESC', () => this.menu.back());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /** 시작하기: 버튼을 잠그고 화면을 천천히 어둡게 한 뒤 게임을 시작한다. */
  private start(): void {
    if (this.starting) return;
    this.starting = true;
    this.startButton.disableInteractive();
    this.settingsButton.disableInteractive();
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { fromTitle: true }));
    camera.fadeOut(TITLE_FADE_MS, 0, 0, 0);
  }

  private layout(): void {
    const width = this.scale.gameSize.width, cx = width / 2;
    // 배경은 화면을 빈틈없이 덮도록 비율을 유지해 키운다.
    const scale = Math.max(width / this.background.width, VIEW_HEIGHT / this.background.height);
    this.background.setPosition(cx, VIEW_HEIGHT / 2).setScale(scale);
    this.shade.setSize(width, VIEW_HEIGHT);
    this.title.setPosition(cx, 200);
    this.subtitle.setPosition(cx, 262);
    this.startButton.setPosition(cx, 440);
    this.settingsButton.setPosition(cx, 530);
    this.version.setPosition(cx, VIEW_HEIGHT - 12);
    this.menu.layout(width);
  }

  private text(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(0, 0, content, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setResolution(2);
  }

  private button(label: string, onTap: () => void): Phaser.GameObjects.Text {
    const button = this.text(label, 30, '#1a1008')
      .setOrigin(0.5)
      .setBackgroundColor('#e8c37a')
      .setPadding(72, 14, 72, 14)
      .setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => { if (!this.menu.isOpen) onTap(); });
    return button;
  }
}
