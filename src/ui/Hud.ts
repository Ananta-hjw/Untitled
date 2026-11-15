import Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';

/** 화면에 고정된 정보 표시: 체력·경험치 막대, 버전 표시, 첫 조작 안내, 레벨 업 알림. */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const BAR = { x: 44, y: 26, width: 300, height: 26 };
const XP_BAR = { x: BAR.x, y: BAR.y + BAR.height + 9, width: BAR.width, height: 10 };

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly xpBar: Phaser.GameObjects.Graphics;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly levelUpText: Phaser.GameObjects.Text;
  private readonly callout: Phaser.GameObjects.Text;
  private readonly slowTint: Phaser.GameObjects.Rectangle;
  private hint?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, hintText: string) {
    this.scene = scene;

    this.badge = scene.add
      .text(0, VIEW_HEIGHT - 8, `프로토타입 v${__APP_VERSION__}`, { fontFamily: FONT, fontSize: '15px', color: '#e9d7b0' })
      // 오른쪽 위는 미니맵 자리라서 화면 아래 가운데에 작게 둔다.
      .setOrigin(0.5, 1)
      .setAlpha(0.55)
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

    this.xpBar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI);
    this.xpText = scene.add
      .text(XP_BAR.x + XP_BAR.width + 12, XP_BAR.y + XP_BAR.height / 2, '', {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f0d27a',
        stroke: '#1a1008',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setResolution(2);

    this.goldText = scene.add
      .text(XP_BAR.x, XP_BAR.y + XP_BAR.height + 16, '', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffd23f', stroke: '#1a1008', strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setResolution(2);

    // 레벨 업 알림은 한 개를 만들어 두고 다시 쓴다.
    this.levelUpText = scene.add
      .text(0, 150, '', {
        fontFamily: FONT,
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#ffd76a',
        stroke: '#3a1a04',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 4)
      .setResolution(2)
      .setVisible(false);

    // 저스트 회피 같은 짧은 알림. 한 개를 다시 쓴다.
    this.callout = scene.add
      .text(0, 215, '', {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#bfe9ff',
        stroke: '#0b2236',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 4)
      .setResolution(2)
      .setVisible(false);

    // 느린 화면일 때 화면 전체에 옅은 푸른 빛을 덮는다.
    this.slowTint = scene.add
      .rectangle(0, 0, 10, VIEW_HEIGHT, 0x3a7bd5, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI - 1)
      .setAlpha(0)
      .setVisible(false);
  }

  /** 화면 위쪽에 짧은 알림을 띄웠다가 지운다. */
  showCallout(text: string): void {
    const label = this.callout;
    this.scene.tweens.killTweensOf(label);
    label.setText(text).setVisible(true).setAlpha(1).setScale(1.3);
    this.scene.tweens.chain({
      targets: label,
      tweens: [
        { scale: 1, duration: 140, ease: 'Back.easeOut' },
        { alpha: 0, duration: 350, delay: 600, onComplete: () => label.setVisible(false) },
      ],
    });
  }

  /** amount: 0이면 꺼짐, 1이면 가장 진한 느린 화면 효과 */
  setSlowMotion(amount: number): void {
    const visible = amount > 0.01;
    this.slowTint.setVisible(visible);
    if (visible) this.slowTint.setAlpha(0.16 * amount);
  }

  /** 경험치가 바뀔 때만 부른다. need가 0이면 최고 레벨이다. */
  setXp(level: number, xp: number, need: number): void {
    const { x, y, width, height } = XP_BAR;
    const bar = this.xpBar;
    bar.clear();
    bar.fillStyle(0x1a1008, 0.85);
    bar.fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 6);
    bar.fillStyle(0x2b2410);
    bar.fillRoundedRect(x, y, width, height, 4);
    const ratio = need > 0 ? xp / need : 1;
    if (ratio > 0) {
      bar.fillStyle(0xe8b93c);
      bar.fillRoundedRect(x, y, Math.max(8, width * ratio), height, 4);
    }
    this.xpText.setText(need > 0 ? `Lv. ${level}  ${xp} / ${need}` : `Lv. ${level}  MAX`);
  }

  /** 화면 위쪽에 "레벨 업!"을 잠깐 띄운다. */
  showLevelUp(level: number): void {
    const text = this.levelUpText;
    this.scene.tweens.killTweensOf(text);
    text.setText(`레벨 업!  Lv. ${level}`).setVisible(true).setAlpha(0).setScale(0.6);
    this.scene.tweens.chain({
      targets: text,
      tweens: [
        { alpha: 1, scale: 1.08, duration: 180, ease: 'Back.easeOut' },
        { scale: 1, duration: 120 },
        { alpha: 0, duration: 400, delay: 1100, onComplete: () => text.setVisible(false) },
      ],
    });
  }

  /** 체력이 바뀔 때만 부른다. */
  setGold(gold: number): void {
    this.goldText.setText(`● ${gold.toLocaleString()} G`);
  }

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
    this.badge.setX(width / 2);
    this.hint?.setX(width / 2);
    this.levelUpText.setX(width / 2);
    this.callout.setX(width / 2);
    this.slowTint.setSize(width, VIEW_HEIGHT);
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
