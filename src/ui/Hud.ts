import Phaser from 'phaser';
import { DEPTH_UI } from '../config';

/** 화면에 고정된 정보 표시: 체력 막대, 버전 표시, 첫 조작 안내. */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const BAR = { x: 44, y: 26, width: 300, height: 26 };

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, hintText: string) {
    this.scene = scene;

    this.badge = scene.add
      .text(0, 18, `프로토타입 v${__APP_VERSION__}`, { fontFamily: FONT, fontSize: '18px', color: '#e9d7b0' })
      .setOrigin(1, 0)
      .setAlpha(0.7)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2);

    this.hint = scene.add
      .text(0, 90, hintText, {
        fontFamily: FONT,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2);

    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI);
    this.hpText = scene.add
      .text(BAR.x + 10, BAR.y + BAR.height / 2, '', {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setResolution(2);
  }

  /** 체력이 바뀔 때만 부른다. */
  setHp(hp: number, maxHp: number): void {
    const { x, y, width, height } = BAR;
    const ratio = hp / maxHp;
    const bar = this.bar;
    bar.clear();
    bar.fillStyle(0x1a1008, 0.85);
    bar.fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 9);
    bar.fillStyle(0x3a1512);
    bar.fillRoundedRect(x, y, width, height, 7);
    if (ratio > 0) {
      bar.fillStyle(ratio > 0.3 ? 0xc8443a : 0xe07a2e);
      bar.fillRoundedRect(x, y, Math.max(14, width * ratio), height, 7);
    }
    this.hpText.setText(`HP ${hp} / ${maxHp}`);
  }

  layout(width: number): void {
    this.badge.setX(width - 22);
    this.hint?.setX(width / 2);
  }

  /** 플레이어가 처음 조작하면 안내 문구를 지운다. */
  dismissHint(): void {
    const hint = this.hint;
    if (!hint) return;
    this.hint = undefined;
    this.scene.tweens.add({ targets: hint, alpha: 0, duration: 500, onComplete: () => hint.destroy() });
  }

  /** 화면 가운데에 큰 글씨를 띄운다. 돌려받은 객체를 destroy()하면 사라진다. */
  showBanner(text: string, width: number, height: number): Phaser.GameObjects.Text {
    const banner = this.scene.add
      .text(width / 2, height / 2 - 40, text, {
        fontFamily: FONT,
        fontSize: '54px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 5)
      .setResolution(2)
      .setAlpha(0);
    this.scene.tweens.add({ targets: banner, alpha: 1, duration: 300 });
    return banner;
  }
}
