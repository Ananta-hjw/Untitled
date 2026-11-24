import Phaser from 'phaser';
import { HeroSprite } from '../entities/HeroSprite';
import { swingTrailArc } from '../entities/attackMotion';
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
  arc: Blade[];
}

interface GhostEffect {
  object: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  kind: 'hero' | 'sprite';
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
      effect = { graphic: this.scene.add.graphics(), stage, activeUntil, nextSampleAt: sampleStart, samples: [], arc: [] };
      this.attackPool.push(effect);
    }
    effect.stage = stage;
    effect.activeUntil = activeUntil;
    effect.nextSampleAt = sampleStart + TRAIL_SAMPLE_MS;
    effect.samples.length = 0;
    effect.arc.length = 0;
    effect.graphic.clear().setActive(true).setVisible(true).setAlpha(1).setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD).setData('attackStage', stage + 1);
    return effect;
  }

  drawAttack(effect: AttackEffect, sweep: BladeSweep, time: number): void {
    const first = effect.samples.length === 0;
    if (first) {
      effect.samples.push(sweep.current);
      if (effect.stage !== 2) effect.arc = swingTrailArc(sweep.previous, sweep.current);
    }
    const span = sweep.end - sweep.start;
    while (effect.nextSampleAt <= sweep.end + 1e-6) {
      effect.samples.push(first || span <= 0 ? sweep.current
        : interpolateBlade(sweep.previous, sweep.current, (effect.nextSampleAt - sweep.start) / span));
      effect.nextSampleAt += TRAIL_SAMPLE_MS;
    }

    effect.graphic.clear().setAlpha(this.alphaOf(effect, time));
    if (effect.stage === 2) this.renderThrust(effect.graphic, sweep.current);
    else this.renderSwing(effect.graphic, [...effect.arc, ...effect.samples, sweep.current]);
  }

  private renderSwing(g: Phaser.GameObjects.Graphics, blades: Blade[]): void {
    if (blades.every(({ base, tip }) => base.x === tip.x && base.y === tip.y)) return;
    const distances = [0];
    for (let i = 1; i < blades.length; i++) {
      const a = blades[i - 1].tip, b = blades[i].tip;
      distances.push(distances[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const length = distances[distances.length - 1];
    if (length < 1) return;
    // The outer edge passes through the tips. Taper by distance so repeated poses do not widen the trail.
    for (const [thickness, color, alpha] of [[0.32, 0xe3ab66, 0.36], [0.14, 0xffefd2, 0.64]] as const) {
      g.fillStyle(color, alpha).beginPath();
      g.moveTo(blades[0].tip.x, blades[0].tip.y);
      for (let i = 1; i < blades.length; i++) g.lineTo(blades[i].tip.x, blades[i].tip.y);
      for (let i = blades.length - 1; i >= 0; i--) {
        const { base, tip } = blades[i];
        const progress = distances[i] / length;
        const taper = thickness * (0.82 * Math.sin(Math.PI * progress) ** 0.65 + 0.18 * progress);
        g.lineTo(tip.x + (base.x - tip.x) * taper, tip.y + (base.y - tip.y) * taper);
      }
      g.closePath().fillPath();
    }
  }

  private renderThrust(g: Phaser.GameObjects.Graphics, { base, tip }: Blade): void {
    const dx = tip.x - base.x, dy = tip.y - base.y;
    if (dx === 0 && dy === 0) return;
    for (const [width, color, alpha] of [[0.12, 0xffb966, 0.38], [0.045, 0xffefd2, 0.8]] as const) {
      g.fillStyle(color, alpha).beginPath().moveTo(base.x, base.y);
      g.lineTo(base.x + dx * 0.72 - dy * width, base.y + dy * 0.72 + dx * width);
      g.lineTo(tip.x + dx * 0.06, tip.y + dy * 0.06);
      g.lineTo(base.x + dx * 0.72 + dy * width, base.y + dy * 0.72 - dx * width).closePath().fillPath();
    }
  }

  private alphaOf(effect: AttackEffect, time: number): number {
    return Math.max(0, Math.min(1, (effect.activeUntil + ATTACK_FADE_MS - time) / ATTACK_FADE_MS));
  }

  spawnGhost(sprite: HeroSprite | Phaser.GameObjects.Sprite, x: number, y: number, depth: number, time: number): void {
    const kind = sprite instanceof HeroSprite ? 'hero' : 'sprite';
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
      const alpha = this.alphaOf(effect, time);
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
