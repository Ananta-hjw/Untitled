import Phaser from 'phaser';
import heroNeutral from '../assets/hero/dialogue/neutral-768.png?url';
import serenaPortrait from '../assets/characters/serena/dialogue-768.webp?url';
import siaPortrait from '../assets/characters/sia/dialogue-768.webp?url';
import lineaPortrait from '../assets/characters/linea/dialogue-768.webp?url';
import ruanPortrait from '../assets/characters/ruan/dialogue-768.webp?url';
import hermanPortrait from '../assets/characters/herman/dialogue-768.webp?url';
import eilaPortrait from '../assets/characters/eila/dialogue-768.webp?url';
import merinaPortrait from '../assets/characters/merina/dialogue-768.webp?url';
import doranPortrait from '../assets/characters/doran/dialogue-768.webp?url';
import rosettaPortrait from '../assets/characters/rosetta/dialogue-768.webp?url';
import vernelPortrait from '../assets/characters/vernel/dialogue-768.webp?url';
import soldierPortrait from '../assets/characters/soldier/dialogue-768.webp?url';
import teonPortrait from '../assets/characters/teon/dialogue-768.webp?url';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import type { DialogueLine, Portrait } from '../story/dialogues';

/**
 * 화면 아래쪽 대화창.
 *
 * 왼쪽에 화자 그림, 이름표, 한 글자씩 나타나는 대사가 나온다.
 * advance()를 부르면 글자가 다 나오지 않았을 때는 한 번에 보여 주고, 다 나왔으면 다음 줄로 넘어간다.
 * 마지막 줄에서 넘기면 닫힌다. 모든 객체는 처음에 만들어 두고 다시 쓴다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const PORTRAITS: Record<Portrait, { key: string; url: string }> = {
  'hero-neutral': { key: 'portrait-hero-neutral', url: heroNeutral },
  serena: { key: 'portrait-serena', url: serenaPortrait },
  sia: { key: 'portrait-sia', url: siaPortrait },
  linea: { key: 'portrait-linea', url: lineaPortrait },
  ruan: { key: 'portrait-ruan', url: ruanPortrait },
  herman: { key: 'portrait-herman', url: hermanPortrait },
  eila: { key: 'portrait-eila', url: eilaPortrait },
  merina: { key: 'portrait-merina', url: merinaPortrait },
  doran: { key: 'portrait-doran', url: doranPortrait },
  rosetta: { key: 'portrait-rosetta', url: rosettaPortrait },
  vernel: { key: 'portrait-vernel', url: vernelPortrait },
  teon: { key: 'portrait-teon', url: teonPortrait },
  soldier: { key: 'portrait-soldier', url: soldierPortrait },
};
/** 초당 나오는 글자 수 */
const CHARS_PER_SECOND = 38;
const PANEL_HEIGHT = 168;
const MARGIN = 22;
const PORTRAIT_HEIGHT = 360;
const PORTRAIT_WIDTH = 220;

export function preloadDialogue(scene: Phaser.Scene): void {
  for (const { key, url } of Object.values(PORTRAITS)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

export class DialogueBox {
  private readonly scene: Phaser.Scene;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly nextMark: Phaser.GameObjects.Text;
  private lines: readonly DialogueLine[] = [];
  private index = 0;
  private shown = 0;
  private elapsed = 0;
  private onClose?: () => void;
  private width = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const depth = DEPTH_UI + 20;
    this.shade = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.35).setOrigin(0).setScrollFactor(0).setDepth(depth);
    this.portrait = scene.add.image(0, 0, PORTRAITS['hero-neutral'].key).setOrigin(0.5, 1).setScrollFactor(0).setDepth(depth + 1);
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(depth + 2);
    this.nameText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#1a1008',
        backgroundColor: '#e8c37a',
        padding: { x: 14, y: 5 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(depth + 3)
      .setResolution(2);
    this.bodyText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '25px',
        color: '#f5ead2',
        lineSpacing: 8,
      })
      .setScrollFactor(0)
      .setDepth(depth + 3)
      .setResolution(2);
    this.nextMark = scene.add
      .text(0, 0, '▼', { fontFamily: FONT, fontSize: '20px', color: '#e8c37a' })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(depth + 3)
      .setResolution(2);
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.lines.length > 0;
  }

  open(lines: readonly DialogueLine[], onClose?: () => void): void {
    if (lines.length === 0) return;
    this.lines = lines;
    this.onClose = onClose;
    this.index = 0;
    this.setVisible(true);
    this.showLine();
  }

  /** 탭하거나 키를 눌렀을 때. */
  advance(): void {
    if (!this.isOpen) return;
    const text = this.lines[this.index].text;
    if (this.shown < text.length) {
      this.shown = text.length;
      this.bodyText.setText(text);
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
      return;
    }
    this.showLine();
  }

  close(): void {
    if (!this.isOpen) return;
    this.lines = [];
    this.setVisible(false);
    const onClose = this.onClose;
    this.onClose = undefined;
    onClose?.();
  }

  /** 글자를 하나씩 보여 준다. deltaMs는 화면 갱신 간격. */
  update(deltaMs: number): void {
    if (!this.isOpen) return;
    const text = this.lines[this.index].text;
    this.elapsed += deltaMs;
    if (this.shown < text.length) {
      const next = Math.min(text.length, Math.floor((this.elapsed / 1000) * CHARS_PER_SECOND));
      if (next !== this.shown) {
        this.shown = next;
        this.bodyText.setText(text.slice(0, next));
      }
    }
    const done = this.shown >= text.length;
    this.nextMark.setVisible(done).setAlpha(done ? 0.55 + 0.45 * Math.abs(Math.sin(this.elapsed / 260)) : 0);
  }

  layout(width: number, height = VIEW_HEIGHT): void {
    this.width = width;
    this.shade.setSize(width, height);
    if (this.isOpen) this.drawPanel();
  }

  private showLine(): void {
    const line = this.lines[this.index];
    this.shown = 0;
    this.elapsed = 0;
    this.bodyText.setText('');
    this.nameText.setText(line.speaker);
    if (line.portrait) {
      const { key } = PORTRAITS[line.portrait];
      this.portrait.setTexture(key).setVisible(true);
      this.portrait.setScale(PORTRAIT_HEIGHT / this.portrait.height);
    } else {
      this.portrait.setVisible(false);
    }
    this.drawPanel();
  }

  private drawPanel(): void {
    const width = this.width || this.scene.scale.gameSize.width;
    const hasPortrait = this.portrait.visible;
    const left = MARGIN + (hasPortrait ? PORTRAIT_WIDTH : 0);
    const right = width - MARGIN;
    const top = VIEW_HEIGHT - MARGIN - PANEL_HEIGHT;

    const g = this.panel;
    g.clear();
    g.fillStyle(0x140c06, 0.9);
    g.fillRoundedRect(left, top, right - left, PANEL_HEIGHT, 14);
    g.lineStyle(3, 0xe8c37a, 0.85);
    g.strokeRoundedRect(left, top, right - left, PANEL_HEIGHT, 14);

    this.portrait.setPosition(MARGIN + PORTRAIT_WIDTH / 2 + 10, VIEW_HEIGHT - MARGIN + 6);
    this.nameText.setPosition(left + 22, top + 6);
    this.bodyText.setPosition(left + 28, top + 30).setWordWrapWidth(right - left - 70, true);
    this.nextMark.setPosition(right - 18, top + PANEL_HEIGHT - 12);
  }

  private setVisible(visible: boolean): void {
    for (const object of [this.shade, this.panel, this.nameText, this.bodyText, this.nextMark]) object.setVisible(visible);
    if (!visible) this.portrait.setVisible(false);
  }
}
