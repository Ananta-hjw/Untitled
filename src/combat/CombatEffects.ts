import Phaser from 'phaser';
import { HeroSprite } from '../entities/HeroSprite';
import { interpolateBlade, type Blade, type BladeSweep } from './blade';

const TRAIL_SAMPLE_MS = 10;
const ATTACK_FADE_MS = 110;
const GHOST_FADE_MS = 220;

export interface AttackEffect {
  graphic: Phaser.GameObjects.Graphics;
  stage: number;
  activeUntil: number;
  nextSampleAt: number;
  samples: Blade[];
}

interface GhostEffect {
  object: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  kind: 'rig' | 'sprite';
  startedAt: number;
}

/** 효과 객체를 재사용하고, 생성·농도가 렌더 프레임 수에 비례하지 않게 한다. */
export class CombatEffects {
  private readonly attackPool: AttackEffect[] = [];
  private readonly ghostPool: GhostEffect[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  beginAttack(stage: number, activeUntil: number, sampleStart: number, depth: number): AttackEffect {
    let effect = this.attackPool.find((entry) => !entry.graphic.active);
    if (!effect) {
      effect = { graphic: this.scene.add.graphics(), stage, activeUntil, nextSampleAt: sampleStart, samples: [] };
      this.attackPool.push(effect);
    }
    effect.stage = stage;
    effect.activeUntil = activeUntil;
    effect.nextSampleAt = sampleStart + TRAIL_SAMPLE_MS;
    effect.samples.length = 0;
    effect.graphic.clear().setActive(true).setVisible(true).setAlpha(1).setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD).setData('attackStage', stage + 1);
    return effect;
  }

  drawAttack(effect: AttackEffect, sweep: BladeSweep, time: number): void {
    if (effect.samples.length === 0) effect.samples.push(sweep.previous);
    while (effect.nextSampleAt <= sweep.end + 1e-6) {
      const span = sweep.end - sweep.start;
      effect.samples.push(interpolateBlade(sweep.previous, sweep.current,
        span > 0 ? (effect.nextSampleAt - sweep.start) / span : 1));
      effect.nextSampleAt += TRAIL_SAMPLE_MS;
    }
    const g = effect.graphic.clear();
    const color = effect.stage === 2 ? 0xffb35a : 0xfff3d6;
    if (effect.stage === 2) {
      const { base, tip } = sweep.current;
      g.lineStyle(9, color, 0.2).lineBetween(base.x, base.y, tip.x, tip.y);
      g.lineStyle(3, 0xffffff, 0.9).lineBetween(base.x, base.y, tip.x, tip.y);
    } else {
      // 같은 Graphics를 다시 그린다. 이전 프레임의 반투명 도형이 겹쳐 쌓이지 않는다.
      let previous = effect.samples[0];
      for (let i = 1; i <= effect.samples.length; i++) {
        const current = effect.samples[i] ?? sweep.current;
        g.fillStyle(color, 0.22).beginPath().moveTo(previous.base.x, previous.base.y);
        g.lineTo(previous.tip.x, previous.tip.y).lineTo(current.tip.x, current.tip.y);
        g.lineTo(current.base.x, current.base.y).closePath().fillPath();
        previous = current;
      }
      g.lineStyle(3, color, 0.9).beginPath().moveTo(effect.samples[0].tip.x, effect.samples[0].tip.y);
      for (let i = 1; i < effect.samples.length; i++) g.lineTo(effect.samples[i].tip.x, effect.samples[i].tip.y);
      g.lineTo(sweep.current.tip.x, sweep.current.tip.y).strokePath();
    }
    g.setAlpha(Math.max(0, Math.min(1, (effect.activeUntil + ATTACK_FADE_MS - time) / ATTACK_FADE_MS)));
  }

  spawnGhost(sprite: HeroSprite | Phaser.GameObjects.Sprite, x: number, y: number, depth: number, time: number): void {
    const kind = sprite instanceof HeroSprite ? 'rig' : 'sprite';
    let effect = this.ghostPool.find((entry) => entry.kind === kind && !entry.object.active);
    if (!effect) {
      const object = sprite instanceof HeroSprite
        ? sprite.spawnGhost(x, y, depth, 0x9fc4ff, 0.35)
        : this.scene.add.image(x, y, sprite.texture.key, sprite.frame.name);
      effect = { object, kind, startedAt: time };
      this.ghostPool.push(effect);
      if (sprite instanceof HeroSprite) return; // 새 잔상에는 이미 현재 자세를 복사했다.
    }
    effect.startedAt = time;
    if (sprite instanceof HeroSprite) {
      sprite.spawnGhost(x, y, depth, 0x9fc4ff, 0.35, effect.object as Phaser.GameObjects.Container);
    } else {
      (effect.object as Phaser.GameObjects.Image).setTexture(sprite.texture.key, sprite.frame.name)
        .setOrigin(0.5, 1).setPosition(x, y).setFlipX(sprite.flipX).setScale(sprite.scaleX, sprite.scaleY)
        .setAngle(sprite.angle).setTint(0x9fc4ff).setAlpha(0.35).setDepth(depth).setActive(true).setVisible(true);
    }
  }

  update(time: number): void {
    for (const effect of this.attackPool) {
      if (!effect.graphic.active) continue;
      const alpha = Math.min(1, (effect.activeUntil + ATTACK_FADE_MS - time) / ATTACK_FADE_MS);
      if (alpha <= 0) effect.graphic.clear().setActive(false).setVisible(false);
      else effect.graphic.setAlpha(alpha);
    }
    for (const effect of this.ghostPool) {
      if (!effect.object.active) continue;
      const remaining = 1 - (time - effect.startedAt) / GHOST_FADE_MS;
      if (remaining <= 0) effect.object.setActive(false).setVisible(false);
      else effect.object.setAlpha(0.35 * remaining);
    }
  }

  private destroy(): void {
    for (const effect of this.attackPool) effect.graphic.destroy();
    for (const effect of this.ghostPool) effect.object.destroy();
    this.attackPool.length = 0;
    this.ghostPool.length = 0;
  }
}
