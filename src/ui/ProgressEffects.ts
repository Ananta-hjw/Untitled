import Phaser from 'phaser';
import { DEPTH_LIGHTING } from '../config';

/**
 * 성장 연출: 적을 쓰러뜨렸을 때 떠오르는 "+10 EXP"와 레벨이 오를 때 발밑에서 퍼지는 빛.
 * 모두 처음에 만들어 둔 객체를 다시 쓴다.
 */

const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const POPUP_COUNT = 4;

export class ProgressEffects {
  private readonly scene: Phaser.Scene;
  private readonly popups: Phaser.GameObjects.Text[] = [];
  private readonly ring: Phaser.GameObjects.Graphics;
  private nextPopup = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < POPUP_COUNT; i++) {
      this.popups.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: FONT,
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffd76a',
            stroke: '#1a1008',
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(DEPTH_LIGHTING + 6)
          .setResolution(2)
          .setVisible(false),
      );
    }

    // 원점을 중심으로 한 고리를 한 번만 그리고, 위치와 크기만 바꿔 가며 쓴다.
    this.ring = scene.add.graphics().setDepth(DEPTH_LIGHTING + 6).setVisible(false);
    this.ring.lineStyle(6, 0xffd76a, 1).strokeEllipse(0, 0, 120, 40);
    this.ring.lineStyle(14, 0xffd76a, 0.25).strokeEllipse(0, 0, 120, 40);
  }

  /** 쓰러진 적 위로 얻은 경험치를 띄운다. */
  showXp(x: number, y: number, amount: number): void {
    this.showPopup(x, y, `+${amount} EXP`);
  }

  /** 떠올랐다 사라지는 짧은 글 (경험치, 골드, 주운 아이템) */
  showPopup(x: number, y: number, label: string, color = '#ffd76a'): void {
    const text = this.popups[this.nextPopup];
    this.nextPopup = (this.nextPopup + 1) % POPUP_COUNT;
    this.scene.tweens.killTweensOf(text);
    text.setText(label).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      delay: 250,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => text.setVisible(false),
    });
  }

  /** 발밑에서 금색 고리가 퍼진다. */
  levelUpBurst(x: number, y: number): void {
    const ring = this.ring;
    this.scene.tweens.killTweensOf(ring);
    ring.setPosition(x, y).setScale(0.4).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => ring.setVisible(false),
    });
  }
}
