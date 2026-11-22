import Phaser from 'phaser';
import { HeroSprite } from '../entities/HeroSprite';
import { slashFxPlacement } from '../entities/attackMotion';
import type { AttackFacing } from '../entities/heroFrames';
import { interpolateBlade, type Blade, type BladeSweep } from './blade';

const TRAIL_SAMPLE_MS = 10;
const ATTACK_FADE_MS = 110;
const GHOST_FADE_MS = 220;
/** 칼 궤적(초승달)이 칼끝을 따라 다 그려지는 시간과, 다 그려진 뒤 남아 있는 시간 */
const SLASH_GROW_MS = 70;
const SLASH_HOLD_MS = 75;
const SLASH_SEGMENTS = 16;

/** 휘두름 궤적: 손잡이(pivot)를 축으로 칼끝이 a0에서 a0 + delta까지 돈다. */
interface Slash {
  at: number;
  pivot: { x: number; y: number };
  a0: number;
  delta: number;
  r0: number;
  r1: number;
  /** 찌르기(3타)는 초승달 대신 곧은 줄기 */
  thrust?: { from: { x: number; y: number }; to: { x: number; y: number } };
}

export interface AttackEffect {
  graphic: Phaser.GameObjects.Graphics;
  stage: number;
  activeUntil: number;
  nextSampleAt: number;
  samples: Blade[];
  slash?: Slash;
  /** 찌르기의 현재 검날 (명중 구간 동안) */
  line?: Blade;
}

interface GhostEffect {
  object: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  kind: 'hero' | 'sprite';
  startedAt: number;
}

interface SlashSpriteEffect {
  image: Phaser.GameObjects.Image;
  startedAt: number;
  baseScaleX: number;
  baseScaleY: number;
}

const SLASH_SPRITE_POP_MS = 55;
const SLASH_SPRITE_LIFE_MS = 185;

/** 효과 객체를 재사용하고, 생성·농도가 렌더 프레임 수에 비례하지 않게 한다. */
export class CombatEffects {
  private readonly attackPool: AttackEffect[] = [];
  private readonly ghostPool: GhostEffect[] = [];
  private readonly slashSpritePool: SlashSpriteEffect[] = [];

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
    effect.slash = undefined;
    effect.line = undefined;
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
    if (effect.stage === 2) effect.line = sweep.current;
    this.render(effect, time);
  }

  /** 손그림 검기(1·2타) 또는 찌르기 충격파(3타) 이펙트를 8방향에 맞춰 재생한다. */
  spawnSlashSprite(stage: number, facing: AttackFacing, x: number, y: number, heroScale: number, depth: number, time: number): boolean {
    if (!this.scene.textures.exists('combat-slash-fx')) return false;
    const p = slashFxPlacement(stage, facing);
    let entry = this.slashSpritePool.find((item) => !item.image.active);
    if (!entry) {
      const image = this.scene.add.image(0, 0, 'combat-slash-fx', p.frame)
        .setBlendMode(Phaser.BlendModes.ADD);
      entry = { image, startedAt: time, baseScaleX: 1, baseScaleY: 1 };
      this.slashSpritePool.push(entry);
    }
    entry.startedAt = time;
    entry.baseScaleX = p.scaleX * heroScale;
    entry.baseScaleY = p.scaleY * heroScale;
    entry.image.setTexture('combat-slash-fx', p.frame)
      .setPosition(x + p.offsetX * heroScale, y + p.offsetY * heroScale)
      .setRotation(p.rotation)
      .setScale(entry.baseScaleX * 0.72, entry.baseScaleY * 0.72)
      .setAlpha(0.95)
      .setDepth(p.behind ? depth - 4 : depth + 4)
      .setActive(true)
      .setVisible(true);
    return true;
  }

  /**
   * 휘두름의 시작 검날과 끝 검날 사이를 초승달(1·2타) 또는 찌르기 줄기(3타) 궤적으로 채운다.
   * forwardX, forwardY: 8방향 공격 벡터. 궤적은 항상 몸 앞쪽(공격 방향)을 지나는 호를 선택한다.
   */
  slash(effect: AttackEffect, from: Blade, to: Blade, time: number, forwardX: number, forwardY = 0): void {
    const pivot = { x: (from.base.x + to.base.x) / 2, y: (from.base.y + to.base.y) / 2 };
    const a0 = Math.atan2(from.tip.y - pivot.y, from.tip.x - pivot.x);
    const a1 = Math.atan2(to.tip.y - pivot.y, to.tip.x - pivot.x);
    let best = 0, bestScore = -Infinity;
    for (const turn of [-2 * Math.PI, 0, 2 * Math.PI]) {
      const delta = Phaser.Math.Angle.Wrap(a1 - a0) + turn;
      if (Math.abs(delta) > 1.9 * Math.PI) continue;
      // 가운데 지점이 몸 앞쪽(공격 방향)에 있을수록, 덜 돌수록 자연스럽다.
      const mid = a0 + delta / 2;
      const score = Math.cos(mid) * forwardX + Math.sin(mid) * forwardY - Math.abs(delta) * 0.15;
      if (score > bestScore) { bestScore = score; best = delta; }
    }
    effect.slash = {
      at: time, pivot, a0, delta: best,
      r0: Math.hypot(from.tip.x - pivot.x, from.tip.y - pivot.y),
      r1: Math.hypot(to.tip.x - pivot.x, to.tip.y - pivot.y),
      thrust: effect.stage === 2 ? { from: { ...from.base }, to: { ...to.tip } } : undefined,
    };
    effect.activeUntil = Math.max(effect.activeUntil, time + SLASH_GROW_MS + SLASH_HOLD_MS);
    this.render(effect, time);
  }

  /** 같은 Graphics를 매번 다시 그린다. 이전 프레임의 반투명 도형이 겹쳐 쌓이지 않는다. */
  private render(effect: AttackEffect, time: number): void {
    const g = effect.graphic.clear();
    const slash = effect.slash;
    if (slash?.thrust) {
      // 찌르기: 칼끝 쪽이 굵고 손잡이 쪽으로 가늘어지는 빛줄기
      const { from, to } = slash.thrust;
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length;
      const grow = Math.min(1, (time - slash.at) / SLASH_GROW_MS);
      const back = { x: from.x - ux * 70, y: from.y - uy * 70 };
      const tip = { x: to.x + ux * 40 * grow, y: to.y + uy * 40 * grow };
      for (const [width, color, alpha] of [[16, 0xffc27a, 0.35], [7, 0xffffff, 0.9]] as const) {
        g.fillStyle(color, alpha).beginPath().moveTo(back.x, back.y);
        g.lineTo(tip.x - uy * width, tip.y + ux * width).lineTo(tip.x + ux * width * 1.4, tip.y + uy * width * 1.4);
        g.lineTo(tip.x + uy * width, tip.y - ux * width).closePath().fillPath();
      }
    } else if (slash) {
      // 초승달: 앞쪽(최근) 끝이 가장 굵고, 지나온 쪽으로 갈수록 가늘어진다.
      const grow = Math.min(1, (time - slash.at) / SLASH_GROW_MS);
      const outer: { x: number; y: number }[] = [];
      const inner: { x: number; y: number }[] = [];
      for (let i = 0; i <= SLASH_SEGMENTS; i++) {
        const t = (i / SLASH_SEGMENTS) * grow;
        const angle = slash.a0 + slash.delta * t;
        const radius = (slash.r0 + (slash.r1 - slash.r0) * t) * 1.06;
        const thickness = radius * (0.04 + 0.34 * Math.pow(i / SLASH_SEGMENTS, 1.6));
        const cos = Math.cos(angle), sin = Math.sin(angle);
        outer.push({ x: slash.pivot.x + cos * radius, y: slash.pivot.y + sin * radius });
        inner.push({ x: slash.pivot.x + cos * (radius - thickness), y: slash.pivot.y + sin * (radius - thickness) });
      }
      const fill = (color: number, alpha: number, widen: number) => {
        g.fillStyle(color, alpha).beginPath();
        outer.forEach((p, i) => {
          const x = p.x + (p.x - slash.pivot.x) * widen, y = p.y + (p.y - slash.pivot.y) * widen;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i].x, inner[i].y);
        g.closePath().fillPath();
      };
      fill(0x9fd2ff, 0.32, 0.05);
      fill(0xffffff, 0.85, 0);
    }
    const line = effect.line;
    if (line) g.lineStyle(3, 0xffffff, 0.9).lineBetween(line.base.x, line.base.y, line.tip.x, line.tip.y);
    g.setAlpha(this.alphaOf(effect, time));
  }

  /** 궤적은 다 그려진 뒤 잠깐 머물렀다가 사라진다. 찌르기 줄기는 명중 구간이 끝날 때까지 남는다. */
  private alphaOf(effect: AttackEffect, time: number): number {
    const window = (effect.activeUntil + ATTACK_FADE_MS - time) / ATTACK_FADE_MS;
    const slash = effect.slash && !effect.line
      ? (effect.slash.at + SLASH_GROW_MS + SLASH_HOLD_MS + ATTACK_FADE_MS - time) / ATTACK_FADE_MS : 1;
    return Math.max(0, Math.min(1, window, slash));
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
      else if (effect.slash && time - effect.slash.at < SLASH_GROW_MS) this.render(effect, time);
      else effect.graphic.setAlpha(alpha);
    }
    for (const effect of this.ghostPool) {
      if (!effect.object.active) continue;
      const remaining = 1 - (time - effect.startedAt) / GHOST_FADE_MS;
      if (remaining <= 0) effect.object.setActive(false).setVisible(false);
      else effect.object.setAlpha(0.35 * remaining);
    }
    for (const entry of this.slashSpritePool) {
      if (!entry.image.active) continue;
      const age = time - entry.startedAt;
      if (age >= SLASH_SPRITE_LIFE_MS) {
        entry.image.setActive(false).setVisible(false);
        continue;
      }
      const pop = Math.min(1, age / SLASH_SPRITE_POP_MS);
      const easePop = 1 - (1 - pop) ** 3;
      const growth = 0.72 + 0.36 * easePop;
      const fade = age < SLASH_SPRITE_POP_MS ? 1 : 1 - (age - SLASH_SPRITE_POP_MS) / (SLASH_SPRITE_LIFE_MS - SLASH_SPRITE_POP_MS);
      entry.image.setScale(entry.baseScaleX * growth, entry.baseScaleY * growth).setAlpha(Math.max(0, fade * 0.96));
    }
  }

  private destroy(): void {
    for (const effect of this.attackPool) effect.graphic.destroy();
    for (const effect of this.ghostPool) effect.object.destroy();
    for (const entry of this.slashSpritePool) entry.image.destroy();
    this.attackPool.length = 0;
    this.ghostPool.length = 0;
    this.slashSpritePool.length = 0;
  }
}
