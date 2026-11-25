import Phaser from 'phaser';
import { HeroSprite } from '../entities/HeroSprite';
import { interpolateSwingBlade, smoothSwingTrail, swingTrailArc, swingTrailEdge } from '../entities/attackMotion';
import { interpolateBlade, type Blade, type BladeSweep } from './blade';
import type { TrailStyle } from './attackFeel';

const TRAIL_SAMPLE_MS = 10;
const ATTACK_FADE_MS = 90;
const SWING_REVEAL_MS = 60;
const THRUST_FADE_IN_MS = 45;
const GHOST_FADE_MS = 220;

const TRAIL_PALETTE: Record<TrailStyle, { outer: number; outerAlpha: number; inner: number; innerAlpha: number; widthScale: number }> = {
  stage1: { outer: 0xd8be94, outerAlpha: 0.34, inner: 0xfff5e2, innerAlpha: 0.68, widthScale: 1 },
  stage2: { outer: 0xf0ba5e, outerAlpha: 0.4, inner: 0xfff3c8, innerAlpha: 0.74, widthScale: 1.06 },
  finisher: { outer: 0xff9a40, outerAlpha: 0.46, inner: 0xfff6d4, innerAlpha: 0.88, widthScale: 1.18 },
  counter: { outer: 0x5ec8ff, outerAlpha: 0.54, inner: 0xecfbff, innerAlpha: 0.94, widthScale: 1.3 },
  resonance: { outer: 0xffcc38, outerAlpha: 0.48, inner: 0xfff9c8, innerAlpha: 0.88, widthScale: 1.16 },
};

export interface AttackEffect {
  graphic: Phaser.GameObjects.Graphics;
  stage: number;
  style: TrailStyle;
  startedAt: number;
  activeUntil: number;
  nextSampleAt: number;
  samples: Blade[];
  arc: Blade[];
  /** 찌르기 빛줄기를 칼끝 너머로 늘이는 배율 (1 = 칼 길이). 원근으로 짧게 그린 칼에 쓴다. */
  thrustReach: number;
}

interface GhostEffect {
  object: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  kind: 'hero' | 'sprite';
  startedAt: number;
  alpha0: number;
}

/** 효과 객체를 재사용하고, 생성·농도가 렌더 프레임 수에 비례하지 않게 한다. */
export class CombatEffects {
  private readonly attackPool: AttackEffect[] = [];
  private readonly ghostPool: GhostEffect[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  beginAttack(stage: number, startedAt: number, activeUntil: number, sampleStart: number, depth: number, thrustReach = 1, style?: TrailStyle): AttackEffect {
    const resolvedStyle: TrailStyle = style ?? (stage >= 2 ? 'finisher' : stage === 1 ? 'stage2' : 'stage1');
    let effect = this.attackPool.find((entry) => !entry.graphic.active);
    if (!effect) {
      effect = { graphic: this.scene.add.graphics(), stage, style: resolvedStyle, startedAt, activeUntil, nextSampleAt: sampleStart, samples: [], arc: [], thrustReach };
      this.attackPool.push(effect);
    }
    effect.thrustReach = thrustReach;
    effect.stage = stage;
    effect.style = resolvedStyle;
    effect.startedAt = startedAt;
    effect.activeUntil = activeUntil;
    effect.nextSampleAt = sampleStart + TRAIL_SAMPLE_MS;
    effect.samples.length = 0;
    effect.arc.length = 0;
    effect.graphic.clear().setActive(true).setVisible(true).setAlpha(1).setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD).setData('attackStage', stage + 1);
    return effect;
  }

  drawAttack(effect: AttackEffect, sweep: BladeSweep, time: number, displayed: Blade): void {
    const first = effect.samples.length === 0;
    if (first) {
      effect.samples.push(sweep.current);
      if (effect.stage !== 2) effect.arc = swingTrailArc(sweep.previous, sweep.current);
    }
    const span = sweep.end - sweep.start;
    const interpolate = effect.stage === 2 ? interpolateBlade : interpolateSwingBlade;
    while (effect.nextSampleAt <= sweep.end + 1e-6) {
      effect.samples.push(first || span <= 0 ? sweep.current
        : interpolate(sweep.previous, sweep.current, (effect.nextSampleAt - sweep.start) / span));
      effect.nextSampleAt += TRAIL_SAMPLE_MS;
    }

    effect.graphic.clear().setAlpha(this.alphaOf(effect, time));
    if (effect.stage === 2) {
      this.renderThrust(effect.graphic, displayed, effect.thrustReach, effect.style);
    } else {
      // Keep the bright end on the blade while gradually revealing the path behind it.
      const grow = Math.max(0, Math.min(1, (time - effect.startedAt) / SWING_REVEAL_MS));
      const firstVisible = (1 - (0.2 + 0.8 * grow)) * (effect.arc.length - 1);
      const index = Math.floor(firstVisible);
      const tail = interpolateBlade(effect.arc[index], effect.arc[index + 1], firstVisible - index);
      this.renderSwing(effect.graphic, [tail, ...effect.arc.slice(index + 1), ...effect.samples, displayed], effect.style);
    }
  }

  private renderSwing(g: Phaser.GameObjects.Graphics, trail: Blade[], style: TrailStyle): void {
    if (trail.every(({ base, tip }) => base.x === tip.x && base.y === tip.y)) return;
    // Collapse the tiny lunge samples, then round corners between the stepped poses.
    // Keep both ends exact so the moving end still meets the visible blade.
    const first = trail[0], last = trail[trail.length - 1];
    const knots = [first];
    for (let i = 1; i < trail.length - 1; i++) {
      const blade = trail[i], prev = knots[knots.length - 1];
      if (Math.hypot(blade.tip.x - prev.tip.x, blade.tip.y - prev.tip.y) >= 8) knots.push(blade);
    }
    knots.push(last);
    const edge = swingTrailEdge(smoothSwingTrail(knots));
    if (edge.length === 0) return;
    const p = TRAIL_PALETTE[style];
    for (const [thickness, color, alpha] of [[0.32 * p.widthScale, p.outer, p.outerAlpha], [0.14 * p.widthScale, p.inner, p.innerAlpha]] as const) {
      g.fillStyle(color, alpha).beginPath();
      g.moveTo(first.tip.x, first.tip.y);
      for (let i = 1; i < edge.length; i++) g.lineTo(edge[i].tip.x, edge[i].tip.y);
      for (let i = edge.length - 1; i >= 0; i--) {
        const { tip, offset } = edge[i];
        g.lineTo(tip.x + offset.x * thickness, tip.y + offset.y * thickness);
      }
      g.closePath().fillPath();
    }
  }

  private renderThrust(g: Phaser.GameObjects.Graphics, { base, tip }: Blade, reach = 1, style: TrailStyle = 'finisher'): void {
    if (tip.x === base.x && tip.y === base.y) return;
    const dx = (tip.x - base.x) * reach, dy = (tip.y - base.y) * reach;
    tip = { x: base.x + dx, y: base.y + dy };
    // 늘인 빛줄기는 길이에 비례해 굵어지지 않게 폭을 되돌린다.
    const p = TRAIL_PALETTE[style];
    const thin = (1 / Math.sqrt(reach)) * p.widthScale;
    for (const [w, color, alpha] of [[0.12, p.outer, p.outerAlpha], [0.048, p.inner, p.innerAlpha]] as const) {
      const width = w * thin;
      g.fillStyle(color, alpha).beginPath().moveTo(base.x, base.y);
      g.lineTo(base.x + dx * 0.72 - dy * width, base.y + dy * 0.72 + dx * width);
      g.lineTo(tip.x + dx * 0.08, tip.y + dy * 0.08);
      g.lineTo(base.x + dx * 0.72 + dy * width, base.y + dy * 0.72 - dx * width).closePath().fillPath();
    }
  }

  private alphaOf(effect: AttackEffect, time: number): number {
    const age = time - effect.startedAt;
    const rise = Math.max(0, Math.min(1, age / THRUST_FADE_IN_MS));
    const remaining = Math.max(0, Math.min(1, (effect.activeUntil + ATTACK_FADE_MS - time) / ATTACK_FADE_MS));
    return (effect.stage === 2 ? 0.25 + 0.75 * rise : 1) * remaining * remaining * (3 - 2 * remaining);
  }

  spawnGhost(sprite: HeroSprite | Phaser.GameObjects.Sprite, x: number, y: number, depth: number, time: number, tint = 0x9fc4ff, alpha = 0.35): void {
    const kind = sprite instanceof HeroSprite ? 'hero' : 'sprite';
    let effect = this.ghostPool.find((entry) => entry.kind === kind && !entry.object.active);
    if (!effect) {
      const object = sprite instanceof HeroSprite
        ? sprite.spawnGhost(x, y, depth, tint, alpha)
        : this.scene.add.image(x, y, sprite.texture.key, sprite.frame.name);
      effect = { object, kind, startedAt: time, alpha0: alpha };
      this.ghostPool.push(effect);
      if (sprite instanceof HeroSprite) return; // 새 잔상에는 이미 현재 자세를 복사했다.
    }
    effect.startedAt = time;
    effect.alpha0 = alpha;
    if (sprite instanceof HeroSprite) {
      sprite.spawnGhost(x, y, depth, tint, alpha, effect.object as Phaser.GameObjects.Container);
    } else {
      (effect.object as Phaser.GameObjects.Image).setTexture(sprite.texture.key, sprite.frame.name)
        .setOrigin(0.5, 1).setPosition(x, y).setFlipX(sprite.flipX).setScale(sprite.scaleX, sprite.scaleY)
        .setAngle(sprite.angle).setTint(tint).setAlpha(alpha).setDepth(depth).setActive(true).setVisible(true);
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
      else effect.object.setAlpha(effect.alpha0 * remaining);
    }
  }

  private destroy(): void {
    for (const effect of this.attackPool) effect.graphic.destroy();
    for (const effect of this.ghostPool) effect.object.destroy();
    this.attackPool.length = 0;
    this.ghostPool.length = 0;
  }
}
