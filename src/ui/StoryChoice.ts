import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';

/** 확인 대화창. 휴식 효과와 다음 시작 위치를 본 뒤 선택한다. 게임 시간은 멈춘다. */
export interface ChoicePrompt { title?: string; text: string; yes: string; no: string; summary?: string; hint?: string }
const FESTIVAL: ChoicePrompt = {
  title: '축제 전야',
  text: '축제 전야를 시작할까요?\n잔치가 끝나면 밤으로 넘어갑니다.\n남은 마을 의뢰와 탐색은 먼저 마쳐도 좋습니다.',
  yes: '잔치 시작', no: '더 둘러보기',
  hint: '준비가 끝났다면 잔치에 참여하세요.',
};

/** 고르기 창의 한 항목 */
export interface ChoiceOption { label: string; onPick: () => void }
const MAX_OPTIONS = 4;

export class StoryChoice {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly yes: Phaser.GameObjects.Text;
  private readonly no: Phaser.GameObjects.Text;
  /** 여러 사람 가운데 대화할 사람을 고르는 버튼들(pick) */
  private readonly options: Phaser.GameObjects.Text[] = [];
  private picks: ChoiceOption[] = [];
  private readonly scene: Phaser.Scene;
  private callback?: () => void;
  private width = 0;
  private hasSummary = false;

  constructor(scene: Phaser.Scene, private readonly onClose: () => void) {
    this.scene = scene;
    this.shade = scene.add.rectangle(0, 0, 10, VIEW_HEIGHT, 0x050e0b, 0.72).setOrigin(0).setScrollFactor(0)
      .setDepth(DEPTH_UI + 60).setInteractive();
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI + 61);
    this.title = this.label('', 34, '#f7ebd0');
    this.text = this.label('', 24, '#d3dfd5').setLineSpacing(14);
    this.summary = this.label('', 25, '#f3e4be').setLineSpacing(24);
    this.hint = this.label('', 19, '#b8cbbd');
    this.yes = this.button(() => this.accept(), true);
    this.no = this.button(() => this.cancel(), false);
    for (let i = 0; i < MAX_OPTIONS; i++) this.options.push(this.button(() => this.choose(i), true));
    this.hide();
  }

  get isOpen(): boolean { return this.callback !== undefined; }

  open(callback: () => void, prompt: ChoicePrompt = FESTIVAL): void {
    this.callback = callback;
    this.hasSummary = !!prompt.summary;
    this.title.setText(prompt.title ?? '확인');
    this.text.setText(prompt.text);
    this.summary.setText(prompt.summary ?? '');
    this.hint.setText(prompt.hint ?? '선택 후 계속 진행합니다.');
    this.yes.setText(prompt.yes);
    this.no.setText(prompt.no);
    this.picks = [];
    for (const object of this.objects()) object.setVisible(true);
    this.summary.setVisible(this.hasSummary);
    this.layout(this.width || this.scene.scale.gameSize.width);
  }

  /**
   * 여러 사람이 한자리에 모여 있을 때 대화할 사람을 고른다(가까운 순서, 최대 4명).
   * Enter는 첫 번째(가장 가까운) 사람, 취소·Esc·뒤로 가기는 닫기.
   */
  pick(options: readonly ChoiceOption[], title = '누구와 이야기할까요?'): void {
    this.picks = options.slice(0, MAX_OPTIONS);
    if (this.picks.length === 0) return;
    this.callback = this.picks[0].onPick;
    this.hasSummary = false;
    this.title.setText(title);
    this.text.setText('');
    this.hint.setText('가까이 있는 사람이 여럿이에요. 이야기할 사람을 고르세요.');
    this.no.setText('취소');
    for (const object of this.objects()) object.setVisible(true);
    this.summary.setVisible(false);
    this.yes.setVisible(false);
    this.options.forEach((button, i) => button.setText(this.picks[i]?.label ?? '').setVisible(i < this.picks.length));
    this.layout(this.width || this.scene.scale.gameSize.width);
  }

  /** 고르기 창에서 몇 번째 사람을 골랐는지 */
  choose(index: number): void {
    const option = this.picks[index];
    if (!option || !this.isOpen) return;
    this.hide();
    this.onClose();
    option.onPick();
  }

  accept(): void {
    const callback = this.callback;
    if (!callback) return;
    this.hide();
    this.onClose();
    callback();
  }

  cancel(): void {
    if (!this.isOpen) return;
    this.hide();
    this.onClose();
  }

  layout(width: number): void {
    this.width = width;
    this.shade.setSize(width, VIEW_HEIGHT);
    this.shade.input?.hitArea.setSize(width, VIEW_HEIGHT);
    const w = Math.min(860, width - 80), left = (width - w) / 2, top = 88, height = 544;
    const g = this.panel.clear();
    g.fillStyle(0x10271f, 0.99).fillRoundedRect(left, top, w, height, 18);
    g.lineStyle(1, 0xcbb17c, 0.95).strokeRoundedRect(left, top, w, height, 18);
    g.lineStyle(1, 0x6b8064, 0.5).lineBetween(left + 36, top + 100, left + w - 36, top + 100);
    this.title.setPosition(left + 36, top + 35);
    this.text.setPosition(left + 36, top + 128).setWordWrapWidth(w - 72);
    if (this.hasSummary) {
      g.fillStyle(0x203b2e, 1).fillRoundedRect(left + 28, top + 210, w - 56, 144, 10);
      this.summary.setPosition(left + 48, top + 234).setWordWrapWidth(w - 96);
    }
    this.hint.setPosition(left + 36, top + 385).setWordWrapWidth(w - 72);
    const buttonWidth = (w - 88) / 2;
    for (const button of [this.no, this.yes]) {
      button.setFixedSize(buttonWidth, 84);
      // 화면 너비에 맞춰 버튼을 늘릴 때 터치 영역도 함께 바꾼다.
      button.input?.hitArea.setSize(buttonWidth, 84);
    }
    this.no.setPosition(left + 36, top + 432);
    this.yes.setPosition(left + 52 + buttonWidth, top + 432);
    // 고르기: 두 줄 두 칸으로 이름 버튼을 놓는다.
    this.options.forEach((button, i) => {
      button.setFixedSize(buttonWidth, 84);
      button.input?.hitArea.setSize(buttonWidth, 84);
      button.setPosition(left + 36 + (i % 2) * (16 + buttonWidth), top + 140 + Math.floor(i / 2) * 104);
    });
  }

  private objects(): Phaser.GameObjects.Components.Visible[] {
    return [this.shade, this.panel, this.title, this.text, this.summary, this.hint, this.yes, this.no];
  }

  private hide(): void {
    this.callback = undefined;
    this.picks = [];
    for (const object of [...this.objects(), ...this.options]) object.setVisible(false);
  }

  private label(content: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, content, {
      fontFamily: 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif', fontSize: `${size}px`, color,
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(DEPTH_UI + 62).setResolution(2);
  }

  private button(onTap: () => void, primary: boolean): Phaser.GameObjects.Text {
    return this.label('', 26, primary ? '#1a302a' : '#f1e2c5').setFixedSize(340, 84).setAlign('center')
      .setPadding(0, 25, 0, 0).setBackgroundColor(primary ? '#dfc18a' : '#304c3d')
      .setInteractive({ useHandCursor: true }).on('pointerup', onTap);
  }
}
