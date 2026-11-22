import Phaser from 'phaser';
import { DEPTH_UI } from '../config';

/**
 * 묵직한 타격 연출: 칼이 닿은 자리의 섬광과 불꽃, 바닥의 충격파, 먼지, 쓰러진 슬라임의 파편, 화면 번쩍임.
 *
 * - 입자는 처음에 만든 이미지들을 돌려 쓴다(풀). 한 번에 MAX_PARTICLES개를 넘으면 가장 오래된 것을 다시 쓴다.
 * - 입자는 씬의 게임 시계(now)로 움직인다. 그래서 히트스톱 동안 섬광과 불꽃이 그 자리에 멈춰
 *   "맞는 순간의 한 장면"이 화면에 남고, 저스트 회피의 느린 화면에서는 함께 느려진다.
 * - 화면 번쩍임만 실제 시간으로 사라진다(멈춘 화면 위에서도 바로 사라져야 하므로).
 * 그림 파일 없이 코드로 그린 텍스처를 쓴다.
 */

export type ImpactStrength = 'normal' | 'crit' | 'finisher' | 'counter';

const MAX_PARTICLES = 120;
const TEX = { flash: 'fx-flash', streak: 'fx-streak', ring: 'fx-ring', dust: 'fx-dust', drop: 'fx-drop' } as const;

interface Particle {
  image: Phaser.GameObjects.Image;
  born: number;
  life: number;
  x: number; y: number;
  vx: number; vy: number;
  /** 바닥에서의 높이와 그 속도 (파편이 포물선을 그리며 떨어진다) */
  h: number; vh: number;
  gravity: number;
  drag: number;
  scale0: number; scale1: number;
  /** 세로 배율 (바닥에 깔린 충격파는 납작하다) */
  flat: number;
  alpha0: number;
  /** 날아가는 방향으로 그림을 돌린다 */
  align: boolean;
  depthOffset: number;
}

const STYLE: Record<ImpactStrength, { streaks: number; speed: number; flash: number; color: number; ring: boolean }> = {
  normal: { streaks: 7, speed: 680, flash: 1.0, color: 0xfff1cf, ring: false },
  crit: { streaks: 9, speed: 820, flash: 1.45, color: 0xffd25a, ring: true },
  finisher: { streaks: 10, speed: 900, flash: 1.7, color: 0xffb35a, ring: true },
  counter: { streaks: 12, speed: 980, flash: 1.9, color: 0x9fdcff, ring: true },
};

export class ImpactEffects {
  private readonly particles: Particle[] = [];
  private next = 0;
  private lastNow = 0;
  private readonly screen: Phaser.GameObjects.Rectangle;
  private screenLeft = 0;
  private screenAlpha = 0;
  private screenMs = 1;

  constructor(scene: Phaser.Scene) {
    makeTextures(scene);
    // 입자 이미지를 처음에 모두 만들어 둔다. 싸우는 동안에는 새 객체를 만들지 않는다.
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const image = scene.add.image(0, 0, TEX.flash).setVisible(false);
      this.particles.push({ image } as Particle);
    }
    this.screen = scene.add.rectangle(0, 0, 4000, 4000, 0xffffff, 0)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI - 1).setVisible(false);
  }

  /** 칼이 적에게 닿은 자리. (dirX, dirY)는 베는 방향이다. */
  impact(x: number, y: number, dirX: number, dirY: number, strength: ImpactStrength, now: number, groundY: number): void {
    const style = STYLE[strength];
    const base = Math.atan2(dirY, dirX);
    // 섬광: 크게 번졌다가 빠르게 사라진다.
    this.spawn(TEX.flash, now, { x, y, life: 90, scale0: 0.22 * style.flash, scale1: 0.7 * style.flash, alpha0: 0.95, tint: 0xffffff, depthOffset: 400 });
    this.spawn(TEX.flash, now, { x, y, life: 170, scale0: 0.4 * style.flash, scale1: 1.1 * style.flash, alpha0: 0.4, tint: style.color, depthOffset: 399 });
    // 불꽃: 베는 방향을 중심으로 부채꼴로 튄다.
    for (let i = 0; i < style.streaks; i++) {
      const angle = base + (Math.random() - 0.5) * 2.2;
      const speed = style.speed * (0.55 + Math.random() * 0.6);
      this.spawn(TEX.streak, now, {
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.8,
        life: 150 + Math.random() * 90, scale0: 0.9 + Math.random() * 0.5, scale1: 0.15,
        alpha0: 1, tint: i % 3 === 0 ? 0xffffff : style.color, drag: 5, align: true, depthOffset: 401,
      });
    }
    if (style.ring) {
      // 바닥을 따라 퍼지는 충격파
      this.spawn(TEX.ring, now, { x, y: groundY, life: 260, scale0: 0.3, scale1: strength === 'crit' ? 1.6 : 2.3, alpha0: 0.85, tint: style.color, flat: 0.42, depthOffset: -1 });
      this.dust(x, groundY, strength === 'crit' ? 4 : 7, now, 70);
    }
  }

  /** 바닥의 흙먼지. 회피, 넉백으로 미끄러질 때, 무거운 타격 때. */
  dust(x: number, y: number, count: number, now: number, spread = 40): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      this.spawn(TEX.dust, now, {
        x: x + Math.cos(angle) * spread * 0.3, y: y + Math.sin(angle) * spread * 0.15,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.35 - 25,
        life: 380 + Math.random() * 220, scale0: 0.45 + Math.random() * 0.3, scale1: 1.2 + Math.random() * 0.5,
        alpha0: 0.5, tint: 0xd9c49c, drag: 3, depthOffset: -2,
      });
    }
  }

  /** 쓰러진 슬라임이 터지며 흩어지는 파편과 바닥에 남는 얼룩 */
  splatter(x: number, y: number, color: number, now: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      this.spawn(TEX.drop, now, {
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.45,
        h: 30 + Math.random() * 20, vh: 260 + Math.random() * 300, gravity: 1500,
        life: 520 + Math.random() * 200, scale0: 0.5 + Math.random() * 0.6, scale1: 0.3,
        alpha0: 1, tint: color, drag: 1.5, depthOffset: 2,
      });
    }
    this.spawn(TEX.drop, now, { x, y, life: 900, scale0: 2.4, scale1: 3.4, alpha0: 0.55, tint: color, flat: 0.35, depthOffset: -3 });
    this.spawn(TEX.flash, now, { x, y: y - 30, life: 160, scale0: 0.6, scale1: 1.6, alpha0: 0.8, tint: 0xffffff, depthOffset: 400 });
  }

  /** 화면 전체를 아주 잠깐 물들인다 (실제 시간으로 사라진다). */
  screenFlash(color: number, alpha: number, ms = 130): void {
    this.screen.setFillStyle(color, alpha).setVisible(true);
    this.screenAlpha = alpha;
    this.screenLeft = ms;
    this.screenMs = ms;
  }

  /** now: 게임 시계, realDelta: 실제 프레임 간격 */
  update(now: number, realDelta: number): void {
    const dt = Math.max(0, Math.min(50, now - this.lastNow)) / 1000;
    this.lastNow = now;
    for (const p of this.particles) {
      if (!p.image.visible) continue;
      const t = (now - p.born) / p.life;
      if (t >= 1) {
        p.image.setVisible(false);
        continue;
      }
      if (dt > 0) {
        const keep = Math.max(0, 1 - p.drag * dt);
        p.vx *= keep; p.vy *= keep;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.gravity) {
          p.vh -= p.gravity * dt;
          p.h = Math.max(0, p.h + p.vh * dt);
          if (p.h === 0) { p.vh = 0; p.vx *= 0.6; p.vy *= 0.6; }
        }
      }
      const scale = p.scale0 + (p.scale1 - p.scale0) * t;
      p.image.setPosition(p.x, p.y - p.h).setScale(scale, scale * p.flat)
        .setAlpha(p.alpha0 * (1 - t) * (1 - t * 0.3)).setDepth(p.y + p.depthOffset);
      if (p.align && (p.vx || p.vy)) p.image.setRotation(Math.atan2(p.vy, p.vx));
    }
    if (this.screenLeft > 0) {
      this.screenLeft -= realDelta;
      const k = Math.max(0, this.screenLeft / this.screenMs);
      this.screen.setAlpha(1).setFillStyle(this.screen.fillColor, this.screenAlpha * k);
      if (k === 0) this.screen.setVisible(false);
    }
  }

  private spawn(texture: string, now: number, o: {
    x: number; y: number; vx?: number; vy?: number; h?: number; vh?: number; gravity?: number; drag?: number;
    life: number; scale0: number; scale1: number; alpha0: number; tint: number; flat?: number; align?: boolean; depthOffset?: number;
  }): void {
    const p = this.particles[this.next];
    this.next = (this.next + 1) % MAX_PARTICLES;
    Object.assign(p, {
      born: now, life: o.life, x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0, h: o.h ?? 0, vh: o.vh ?? 0,
      gravity: o.gravity ?? 0, drag: o.drag ?? 0, scale0: o.scale0, scale1: o.scale1, flat: o.flat ?? 1,
      alpha0: o.alpha0, align: o.align ?? false, depthOffset: o.depthOffset ?? 0,
    });
    // 흙먼지와 슬라임 파편은 빛이 아니라서 더하기 합성을 쓰지 않는다.
    const additive = texture !== TEX.dust && texture !== TEX.drop;
    p.image.setTexture(texture).setTint(o.tint).setRotation(0)
      .setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setPosition(o.x, o.y - p.h).setScale(o.scale0, o.scale0 * p.flat).setAlpha(o.alpha0)
      .setDepth(o.y + p.depthOffset).setVisible(true);
  }
}

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.flash)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 가운데가 밝고 가장자리로 갈수록 옅어지는 원
  const radial = (key: string, r: number, steps: number, power: number) => {
    g.clear();
    for (let i = steps; i >= 1; i--) {
      const k = i / steps;
      g.fillStyle(0xffffff, Math.pow(1 - k, power) * 0.9 + 0.02).fillCircle(r, r, r * k);
    }
    g.generateTexture(key, r * 2, r * 2);
  };
  radial(TEX.flash, 64, 16, 1.6);
  radial(TEX.dust, 24, 8, 1.2);
  // 불꽃 한 줄기: 가운데가 굵고 양끝이 가는 마름모
  g.clear().fillStyle(0xffffff, 1).fillPoints([
    new Phaser.Math.Vector2(0, 4), new Phaser.Math.Vector2(30, 0), new Phaser.Math.Vector2(56, 4), new Phaser.Math.Vector2(30, 8),
  ], true);
  g.generateTexture(TEX.streak, 56, 8);
  // 충격파 고리
  g.clear().lineStyle(6, 0xffffff, 0.9).strokeCircle(64, 64, 58).lineStyle(14, 0xffffff, 0.25).strokeCircle(64, 64, 52);
  g.generateTexture(TEX.ring, 128, 128);
  // 파편 방울
  g.clear().fillStyle(0xffffff, 1).fillCircle(9, 9, 8).fillStyle(0xffffff, 0.5).fillCircle(9, 9, 9);
  g.generateTexture(TEX.drop, 18, 18);
  g.destroy();
}
