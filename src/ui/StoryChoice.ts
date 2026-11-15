import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';

/** 축제를 시작하기 전에 탐색을 계속할지 선택한다. 열려 있는 동안 게임은 멈춘다. */
export class StoryChoice {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly yes: Phaser.GameObjects.Text;
  private readonly no: Phaser.GameObjects.Text;
  private callback?: () => void;

  constructor(scene: Phaser.Scene, private readonly onClose: () => void) {
    const style = { fontFamily: 'system-ui, sans-serif', fontSize: '25px', color: '#fff2d4', align: 'center' as const };
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x080c12, 0.92).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI + 60).setInteractive();
    this.text = scene.add.text(0, 220, '축제 전야를 시작할까요?\n잔치가 끝나면 밤으로 넘어갑니다.\n남은 마을 의뢰와 탐색은 먼저 마쳐도 좋습니다.', { ...style, lineSpacing: 14 }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 61);
    this.yes = scene.add.text(0, 365, '잔치 시작 [Enter]', { ...style, backgroundColor: '#765321', padding: { x: 22, y: 16 } }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 61).setInteractive({ useHandCursor: true }).on('pointerup', () => this.accept());
    this.no = scene.add.text(0, 455, '조금 더 둘러보기 [Esc]', { ...style, backgroundColor: '#30443b', padding: { x: 22, y: 16 } }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI + 61).setInteractive({ useHandCursor: true }).on('pointerup', () => this.cancel());
    this.hide();
  }

  get isOpen(): boolean { return this.callback !== undefined; }
  open(callback: () => void): void {
    this.callback = callback;
    for (const object of [this.shade, this.text, this.yes, this.no]) object.setVisible(true);
  }
  accept(): void {
    const callback = this.callback;
    if (!callback) return;
    this.hide(); this.onClose(); callback();
  }
  cancel(): void { this.hide(); this.onClose(); }
  layout(width: number): void {
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    for (const object of [this.text, this.yes, this.no]) object.setX(width / 2);
    this.text.setWordWrapWidth(width - 60);
  }
  private hide(): void {
    this.callback = undefined;
    for (const object of [this.shade, this.text, this.yes, this.no]) object.setVisible(false);
  }
}
