import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import { parryImpactShadeAlpha } from './parry';

/**
 * 묵직한 타격·패링 연출: 칼이 닿은 자리의 섬광과 불꽃, 패링 임팩트 프레임·십자 별빛·공명 오브 흡입,
 * 적 공격 예고 안광, 바닥 충격파, 먼지, 쓰러진 슬라임의 파편, 화면 번쩍임.
 *
 * - 입자는 처음에 만든 이미지들을 돌려 쓴다(풀). 한 번에 MAX_PARTICLES개를 넘으면 가장 오래된 것을 다시 쓴다.
 * - 입자는 씬의 게임 시계(now)로 움직인다. 그래서 히트스톱 동안 섬광과 불꽃이 그 자리에 멈춰
 *   "맞는 순간의 한 장면"이 화면에 남고, 저스트 회피·패링 슬로우아웃에서는 함께 느려진다.
 * - 화면 번쩍임·패링 임팩트 프레임·HUD 오브 흡입만 실제 시간으로 움직인다.
 * 그림 파일 없이 코드로 그린 텍스처를 쓴다.
 */

export type ImpactStrength = 'normal' | 'crit' | 'finisher' | 'counter';

const MAX_PARTICLES = 140;
const MAX_SCREEN_ORBS = 18;
const TEX = {
  flash: 'fx-flash',
  streak: 'fx-streak',
  ring: 'fx-ring',
  parryCrescent: 'fx-parry-crescent',
  dust: 'fx-dust',
  drop: 'fx-drop',
  star: 'fx-star',
  slash: 'fx-slash',
  orb: 'fx-orb',
} as const;

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
  /** 고정 회전각(라디안) 및 초당 회전 속도 */
  rotation: number;
  spin: number;
  depthOffset: number;
  /** 지정하면 Y 정렬 대신 이 깊이를 그대로 쓴다(임팩트 프레임 위로 솟는 별빛 등) */
  depthOverride?: number;
}

interface ScreenOrb {
  image: Phaser.GameObjects.Image;
  elapsed: number;
  duration: number;
  x0: number; y0: number;
  cx: number; cy: number;
  x1: number; y1: number;
  onArrive?: () => void;
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
  /** 패링 1~2프레임 임팩트 프레임용 어두운 화면 덮개(별빛·불꽃이 이 위에서 눈부시게 튄다) */
  private readonly impactShade: Phaser.GameObjects.Rectangle;
  private impactShadeElapsed = -1;
  private impactShadeHold = 34;
  private impactShadeFade = 24;
  private impactShadeMax = 0.46;
  private readonly screenOrbs: ScreenOrb[] = [];
  private nextOrb = 0;

  constructor(scene: Phaser.Scene) {
    makeTextures(scene);
    // 입자 이미지를 처음에 모두 만들어 둔다. 싸우는 동안에는 새 객체를 만들지 않는다.
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const image = scene.add.image(0, 0, TEX.flash).setVisible(false);
      this.particles.push({ image } as Particle);
    }
    this.impactShade = scene.add.rectangle(0, 0, 4000, 4000, 0x050a16, 0)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI - 2).setVisible(false);
    this.screen = scene.add.rectangle(0, 0, 4000, 4000, 0xffffff, 0)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_UI - 1).setVisible(false);
    for (let i = 0; i < MAX_SCREEN_ORBS; i++) {
      const image = scene.add.image(0, 0, TEX.orb)
        .setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_UI + 3).setVisible(false);
      this.screenOrbs.push({ image, elapsed: -1, duration: 1, x0: 0, y0: 0, cx: 0, cy: 0, x1: 0, y1: 0 });
    }
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

  /** 베인 각도 그대로 적 몸을 가르는 날카로운 참격선(Cut Line) + 치명타·반격 시 십자 섬광 */
  slashCut(x: number, y: number, angle: number, strength: ImpactStrength, now: number): void {
    const color = STYLE[strength].color;
    const scale = strength === 'counter' ? 1.45 : strength === 'finisher' ? 1.25 : strength === 'crit' ? 1.2 : 0.88;
    const life = strength === 'normal' ? 105 : 145;
    this.spawn(TEX.slash, now, { x, y, life, scale0: scale, scale1: scale * 0.28, alpha0: 0.96, tint: 0xffffff, rotation: angle, depthOffset: 406 });
    this.spawn(TEX.slash, now, { x, y, life: life + 35, scale0: scale * 1.18, scale1: scale * 0.35, alpha0: 0.52, tint: color, rotation: angle, depthOffset: 405 });
    if (strength === 'crit' || strength === 'counter') {
      this.spawn(TEX.star, now, { x, y, life: 145, scale0: scale * 0.85, scale1: 0.2, alpha0: 0.92, tint: strength === 'counter' ? 0xc2f0ff : 0xffe478, rotation: angle, spin: 0.5, depthOffset: 407 });
    }
  }

  /** 3타 마무리 찌르기·반격 돌진 일섬 시 칼끝에서 터지는 관통 돌풍 고리(소닉 콘) */
  thrustCone(x: number, y: number, dirX: number, dirY: number, color: number, now: number): void {
    const ang = Math.atan2(dirY, dirX);
    this.spawn(TEX.ring, now, {
      x, y, vx: dirX * 90, vy: dirY * 60, life: 175, scale0: 0.25, scale1: 1.35,
      alpha0: 0.82, tint: color, flat: 0.52, rotation: ang + Math.PI / 2, drag: 5, depthOffset: 404,
    });
    for (let i = -1; i <= 1; i += 2) {
      const a = ang + i * 0.32;
      this.spawn(TEX.streak, now, {
        x, y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 520, life: 145, scale0: 0.9, scale1: 0.12,
        alpha0: 0.85, tint: color, drag: 5, align: true, depthOffset: 403,
      });
    }
  }

  /** 적 처치(Kill) 피니시 폭발 연출 — 마지막 적·보스 막타에는 웅장한 십자 별빛과 충격파를 더한다. */
  killBurst(x: number, y: number, color: number, dirX: number, dirY: number, lastKill: boolean, now: number): void {
    const ang = Math.atan2(dirY, dirX);
    this.spawn(TEX.ring, now, { x, y, life: lastKill ? 340 : 240, scale0: 0.35, scale1: lastKill ? 2.6 : 1.75, alpha0: 0.85, tint: lastKill ? 0xffe885 : color, flat: 0.45, depthOffset: -1 });
    if (lastKill) {
      this.spawn(TEX.star, now, { x, y: y - 55, life: 240, scale0: 1.85, scale1: 0.5, alpha0: 0.98, tint: 0xffffff, rotation: ang, spin: 0.5, depthOffset: 415 });
      this.spawn(TEX.star, now, { x, y: y - 55, life: 300, scale0: 2.35, scale1: 0.75, alpha0: 0.65, tint: 0xffdd66, rotation: ang + Math.PI / 4, spin: -0.4, depthOffset: 414 });
    }
    for (let i = 0; i < (lastKill ? 14 : 8); i++) {
      const a = ang + (Math.random() - 0.5) * 1.9;
      const speed = (480 + Math.random() * 440) * (lastKill ? 1.2 : 1);
      this.spawn(TEX.streak, now, {
        x, y: y - 50, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.75,
        life: 180 + Math.random() * 110, scale0: 0.9 + Math.random() * 0.45, scale1: 0.14,
        alpha0: 0.95, tint: i % 2 === 0 ? 0xffffff : (lastKill ? 0xffe074 : color), drag: 4.5, align: true, depthOffset: 410,
      });
    }
  }

  /** 연속 정밀 패링의 접점: 은백색 불꽃 → 검날을 따라가는 초승달 → 한 번 퍼지는 금빛 고리. */
  parryClash(x: number, y: number, bladeAngle: number, sourceAngle: number, chain: number, now: number): void {
    const depthOverride = DEPTH_UI - 1;
    if (chain === 1) {
      this.spawn(TEX.flash, now, { x, y, life: 85, scale0: 0.18, scale1: 0.37, alpha0: 0.86, tint: 0xf2f8ff, depthOverride });
      for (const offset of [-0.9, -0.38, 0.22, 0.74]) {
        const angle = sourceAngle + offset;
        this.spawn(TEX.streak, now, {
          x, y, life: 115, vx: Math.cos(angle) * 265, vy: Math.sin(angle) * 265,
          scale0: 0.28, scale1: 0.08, alpha0: 0.95, tint: 0xe2edff, drag: 5, rotation: angle, depthOverride,
        });
      }
      return;
    }
    if (chain === 2) {
      this.spawn(TEX.flash, now, { x, y, life: 85, scale0: 0.19, scale1: 0.38, alpha0: 0.8, tint: 0xfff5d8, depthOverride });
      // 초승달의 볼록한 면을 공격이 들어온 쪽으로 돌리고 긴 축을 검날에 맞춘다.
      const rotation = Math.sin(sourceAngle - bladeAngle) > 0 ? bladeAngle + Math.PI : bladeAngle;
      this.spawn(TEX.parryCrescent, now, {
        x, y, life: 155, scale0: 0.46, scale1: 0.75, alpha0: 0.94, tint: 0xffdf9e, rotation, depthOverride,
      });
      return;
    }
    this.spawn(TEX.ring, now, { x, y, life: 190, scale0: 0.29, scale1: 0.92, alpha0: 0.94, tint: 0xffcd65, depthOverride });
    this.spawn(TEX.star, now, { x, y, life: 110, scale0: 0.31, scale1: 0.11, alpha0: 1, tint: 0xffffff, rotation: bladeAngle, depthOverride });
  }

  /** 불완전 막기, 차지 패링, 흡수한 힘을 방출할 때의 섬광과 충격파. */
  parryBurst(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    grade: 'perfect' | 'imperfect' | 'chainBreak' | 'unbound',
    chain: number,
    now: number,
    groundY: number,
  ): void {
    const base = Math.atan2(dirY, dirX);
    if (grade === 'imperfect') {
      const color = 0xff9a44;
      this.spawn(TEX.flash, now, { x, y, life: 95, scale0: 0.25, scale1: 0.85, alpha0: 0.8, tint: 0xffd7a8, depthOffset: 400 });
      this.spawn(TEX.flash, now, { x, y, life: 160, scale0: 0.4, scale1: 1.05, alpha0: 0.38, tint: color, depthOffset: 399 });
      for (let i = 0; i < 9; i++) {
        const angle = base + (Math.random() - 0.5) * 2.4;
        const speed = 420 + Math.random() * 340;
        this.spawn(TEX.streak, now, {
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.75,
          life: 140 + Math.random() * 80, scale0: 0.75 + Math.random() * 0.35, scale1: 0.12,
          alpha0: 0.9, tint: i % 3 === 0 ? 0xffe4b8 : color, drag: 6, align: true, depthOffset: 401,
        });
      }
      this.spawn(TEX.ring, now, { x, y: groundY, life: 210, scale0: 0.25, scale1: 1.45, alpha0: 0.55, tint: color, flat: 0.42, depthOffset: -1 });
      this.dust(x, groundY, 6, now, 65);
      this.screenFlash(0xff8838, 0.09, 90);
      return;
    }

    const unbound = grade === 'unbound';
    const chainBreak = grade === 'chainBreak';
    const color = unbound ? 0xffd86b : chainBreak ? 0xffe878 : chain >= 3 ? 0xfff2a8 : chain === 2 ? 0xffdd66 : 0x9ce8ff;
    const secondary = unbound ? 0xff5a5a : color;
    const popDepth = DEPTH_UI - 1;
    // 1~2프레임 어두운 임팩트 프레임으로 충돌 지점의 대비를 극대화한다.
    this.impactShadeElapsed = 0;
    this.impactShadeHold = unbound ? 58 : chainBreak ? 46 : chain >= 2 ? 42 : 34;
    this.impactShadeFade = unbound ? 36 : 26;
    this.impactShadeMax = unbound ? 0.62 : chainBreak ? 0.54 : chain >= 2 ? 0.52 : 0.46;
    this.impactShade.setFillStyle(unbound ? 0x120512 : 0x050a16, this.impactShadeMax).setVisible(true);

    // 눈부신 십자 별빛(코어 + 오라) — 어두운 임팩트 프레임 위에서 강렬하게 빛난다.
    const boost = unbound ? 1.65 : chainBreak ? 1.35 : chain >= 2 ? 1.18 : 1;
    this.spawn(TEX.star, now, {
      x, y, life: unbound ? 240 : 170, scale0: 1.55 * boost, scale1: 0.45 * boost, alpha0: 1,
      tint: 0xffffff, rotation: (Math.random() - 0.5) * 0.28, spin: 0.6, depthOverride: popDepth,
    });
    this.spawn(TEX.star, now, {
      x, y, life: unbound ? 310 : 230, scale0: 2.1 * boost, scale1: 0.75 * boost, alpha0: 0.82,
      tint: color, rotation: Math.PI / 4 + (Math.random() - 0.5) * 0.2, spin: -0.45, depthOverride: popDepth,
    });
    this.spawn(TEX.flash, now, {
      x, y, life: unbound ? 180 : 130, scale0: 0.55 * boost, scale1: 1.85 * boost, alpha0: 0.95, tint: 0xffffff, depthOverride: popDepth,
    });
    this.spawn(TEX.flash, now, {
      x, y, life: unbound ? 300 : 220, scale0: 0.85 * boost, scale1: 2.5 * boost, alpha0: 0.52, tint: secondary, depthOverride: popDepth,
    });
    // X자(차지 패링은 4방향) 충돌 빛줄기
    const tilts = unbound ? [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4]
      : chainBreak ? [-0.65, 0, 0.65] : [-0.58, 0.58];
    for (const tilt of tilts) {
      this.spawn(TEX.slash, now, {
        x, y, life: unbound ? 190 : 135, scale0: 1.45 * boost, scale1: 0.25, alpha0: 0.95,
        tint: unbound && tilt % (Math.PI / 2) !== 0 ? color : 0xffffff, rotation: base + tilt, depthOverride: popDepth,
      });
    }
    // 충돌 지점 수직 충격파 + 바닥 충격파
    this.spawn(TEX.ring, now, { x, y, life: unbound ? 280 : 210, scale0: 0.22, scale1: 2.25 * boost, alpha0: 0.95, tint: 0xffffff, depthOverride: popDepth });
    this.spawn(TEX.ring, now, { x, y, life: unbound ? 360 : 280, scale0: 0.35, scale1: 2.8 * boost, alpha0: 0.72, tint: secondary, depthOffset: 400 });
    this.spawn(TEX.ring, now, { x, y: groundY, life: unbound ? 380 : 290, scale0: 0.3, scale1: 2.8 * boost, alpha0: 0.88, tint: color, flat: 0.4, depthOffset: -1 });

    // 고속 스파크(흡수 방출 18~24줄기 / 차지 패링 30줄기)
    const sparkCount = unbound ? 30 : chainBreak ? 24 : 18;
    for (let i = 0; i < sparkCount; i++) {
      const spread = (!unbound && i < 12) ? base + (Math.random() - 0.5) * 2.1 : Math.random() * Math.PI * 2;
      const speed = (740 + Math.random() * 620) * boost;
      this.spawn(TEX.streak, now, {
        x, y, vx: Math.cos(spread) * speed, vy: Math.sin(spread) * speed * 0.82,
        life: 165 + Math.random() * (unbound ? 170 : 115), scale0: 1.05 + Math.random() * 0.65, scale1: 0.14,
        alpha0: 1, tint: i % 3 === 0 ? 0xffffff : i % 3 === 1 ? color : secondary, drag: 4.3, align: true, depthOverride: popDepth,
      });
    }
    this.dust(x, groundY, unbound ? 15 : chainBreak ? 12 : 9, now, unbound ? 115 : 80);
  }

  /** 차지 패링 버튼을 뗄 때 주인공 주변으로 퍼지는 짧은 황금 기류 고리 */
  unboundReleasePulse(x: number, y: number, now: number): void {
    this.spawn(TEX.ring, now, { x, y, life: 220, scale0: 0.35, scale1: 1.85, alpha0: 0.9, tint: 0xffe074, depthOffset: 410 });
    this.spawn(TEX.flash, now, { x, y, life: 140, scale0: 0.35, scale1: 1.15, alpha0: 0.55, tint: 0xfff3b0, depthOffset: 409 });
  }

  /** 적 공격 직전 예고 안광(흰/청백 = 패링 가능, 붉은빛 = 회피 전용 강공격) */
  glint(x: number, y: number, now: number, unblockable = false): void {
    const color = unblockable ? 0xff3b52 : 0xbef2ff;
    this.spawn(TEX.star, now, {
      x, y, life: 210, scale0: 0.25, scale1: unblockable ? 1.45 : 1.15, alpha0: 0.98,
      tint: unblockable ? 0xff7080 : 0xffffff, rotation: 0, spin: 0.8, depthOffset: 420,
    });
    this.spawn(TEX.flash, now, {
      x, y, life: 190, scale0: 0.15, scale1: unblockable ? 1.1 : 0.8, alpha0: 0.65, tint: color, depthOffset: 419,
    });
    this.spawn(TEX.ring, now, {
      x, y, life: 220, scale0: 0.15, scale1: unblockable ? 1.35 : 0.95, alpha0: 0.75, tint: color, depthOffset: 418,
    });
  }

  /** 패링 충돌 지점(화면 좌표)에서 공명 조각이 곡선을 그리며 HUD 공명 구슬로 빨려 들어간다. */
  absorbOrb(screenFromX: number, screenFromY: number, screenToX: number, screenToY: number, color = 0xffe074, onArrive?: () => void): void {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const orb = this.screenOrbs[this.nextOrb];
      this.nextOrb = (this.nextOrb + 1) % MAX_SCREEN_ORBS;
      const spreadAngle = -Math.PI / 2 + (i - 1) * 1.05 + (Math.random() - 0.5) * 0.4;
      const lift = 95 + Math.random() * 55;
      orb.elapsed = -i * 38;
      orb.duration = 320 + i * 45;
      orb.x0 = screenFromX;
      orb.y0 = screenFromY;
      orb.cx = (screenFromX + screenToX) * 0.5 + Math.cos(spreadAngle) * lift;
      orb.cy = Math.min(screenFromY, screenToY) - 60 + Math.sin(spreadAngle) * lift * 0.6;
      orb.x1 = screenToX;
      orb.y1 = screenToY;
      orb.onArrive = i === 0 ? onArrive : undefined;
      orb.image.setPosition(screenFromX, screenFromY).setTint(i === 0 ? 0xffffff : color).setScale(0.75).setAlpha(0).setVisible(true);
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
        if (p.spin) p.rotation += p.spin * dt;
        if (p.gravity) {
          p.vh -= p.gravity * dt;
          p.h = Math.max(0, p.h + p.vh * dt);
          if (p.h === 0) { p.vh = 0; p.vx *= 0.6; p.vy *= 0.6; }
        }
      }
      const scale = p.scale0 + (p.scale1 - p.scale0) * t;
      p.image.setPosition(p.x, p.y - p.h).setScale(scale, scale * p.flat)
        .setAlpha(p.alpha0 * (1 - t) * (1 - t * 0.3))
        .setDepth(p.depthOverride ?? p.y + p.depthOffset);
      if (p.align && (p.vx || p.vy)) p.image.setRotation(Math.atan2(p.vy, p.vx));
      else p.image.setRotation(p.rotation);
    }
    if (this.impactShadeElapsed >= 0) {
      this.impactShadeElapsed += realDelta;
      const a = parryImpactShadeAlpha(this.impactShadeElapsed, this.impactShadeHold, this.impactShadeFade, this.impactShadeMax);
      if (a <= 0) {
        this.impactShadeElapsed = -1;
        this.impactShade.setVisible(false);
      } else {
        this.impactShade.setFillStyle(this.impactShade.fillColor, a).setVisible(true);
      }
    }
    if (this.screenLeft > 0) {
      this.screenLeft -= realDelta;
      const k = Math.max(0, this.screenLeft / this.screenMs);
      this.screen.setAlpha(1).setFillStyle(this.screen.fillColor, this.screenAlpha * k);
      if (k === 0) this.screen.setVisible(false);
    }
    for (const orb of this.screenOrbs) {
      if (!orb.image.visible) continue;
      orb.elapsed += realDelta;
      if (orb.elapsed < 0) continue;
      const t = orb.elapsed / orb.duration;
      if (t >= 1) {
        orb.image.setVisible(false);
        const cb = orb.onArrive;
        orb.onArrive = undefined;
        cb?.();
        continue;
      }
      // 가속하며 HUD 구슬로 빨려 들어가는 2차 베지어 궤적
      const u = t * t * (3 - 2 * t);
      const inv = 1 - u;
      const px = inv * inv * orb.x0 + 2 * inv * u * orb.cx + u * u * orb.x1;
      const py = inv * inv * orb.y0 + 2 * inv * u * orb.cy + u * u * orb.y1;
      const sc = 0.55 + 0.55 * Math.sin(t * Math.PI);
      orb.image.setPosition(px, py).setScale(sc).setAlpha(Math.min(1, t * 4) * (1 - t * 0.25));
    }
  }

  private spawn(texture: string, now: number, o: {
    x: number; y: number; vx?: number; vy?: number; h?: number; vh?: number; gravity?: number; drag?: number;
    life: number; scale0: number; scale1: number; alpha0: number; tint: number; flat?: number; align?: boolean;
    rotation?: number; spin?: number; depthOffset?: number; depthOverride?: number;
  }): void {
    const p = this.particles[this.next];
    this.next = (this.next + 1) % MAX_PARTICLES;
    Object.assign(p, {
      born: now, life: o.life, x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0, h: o.h ?? 0, vh: o.vh ?? 0,
      gravity: o.gravity ?? 0, drag: o.drag ?? 0, scale0: o.scale0, scale1: o.scale1, flat: o.flat ?? 1,
      alpha0: o.alpha0, align: o.align ?? false, rotation: o.rotation ?? 0, spin: o.spin ?? 0,
      depthOffset: o.depthOffset ?? 0, depthOverride: o.depthOverride,
    });
    // 흙먼지와 슬라임 파편은 빛이 아니라서 더하기 합성을 쓰지 않는다.
    const additive = texture !== TEX.dust && texture !== TEX.drop;
    p.image.setTexture(texture).setTint(o.tint).setRotation(o.rotation ?? 0)
      .setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setPosition(o.x, o.y - p.h).setScale(o.scale0, o.scale0 * p.flat).setAlpha(o.alpha0)
      .setDepth(o.depthOverride ?? o.y + p.depthOffset).setVisible(true);
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
  // 양 끝이 가늘어지는 초승달. 긴 축을 실제 검날에 맞춰 회전시킨다.
  const arc = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return new Phaser.Math.Vector2(4 + 120 * t, 28 - 18 * Math.sin(Math.PI * t));
  });
  const inner = arc.map(({ x, y }, i) => new Phaser.Math.Vector2(x, y + 8 * Math.sin(Math.PI * i / 24))).reverse();
  g.clear().lineStyle(5, 0xffffff, 0.19).strokePoints(arc).fillStyle(0xffffff, 1).fillPoints([...arc, ...inner], true);
  g.generateTexture(TEX.parryCrescent, 128, 56);
  // 파편 방울
  g.clear().fillStyle(0xffffff, 1).fillCircle(9, 9, 8).fillStyle(0xffffff, 0.5).fillCircle(9, 9, 9);
  g.generateTexture(TEX.drop, 18, 18);
  // 4방향 십자 별빛(패링 섬광 · 공격 예고 안광)
  const s = 64;
  g.clear();
  g.fillStyle(0xffffff, 0.35).fillCircle(s, s, 22);
  g.fillStyle(0xffffff, 0.95).fillPoints([
    new Phaser.Math.Vector2(s, 0), new Phaser.Math.Vector2(s + 9, s - 9),
    new Phaser.Math.Vector2(s * 2, s), new Phaser.Math.Vector2(s + 9, s + 9),
    new Phaser.Math.Vector2(s, s * 2), new Phaser.Math.Vector2(s - 9, s + 9),
    new Phaser.Math.Vector2(0, s), new Phaser.Math.Vector2(s - 9, s - 9),
  ], true);
  g.fillStyle(0xffffff, 1).fillCircle(s, s, 10);
  g.generateTexture(TEX.star, s * 2, s * 2);
  // X자 패링 충돌 빛줄기
  g.clear();
  g.fillStyle(0xffffff, 0.35).fillPoints([
    new Phaser.Math.Vector2(0, 12), new Phaser.Math.Vector2(90, 2), new Phaser.Math.Vector2(180, 12), new Phaser.Math.Vector2(90, 22),
  ], true);
  g.fillStyle(0xffffff, 1).fillPoints([
    new Phaser.Math.Vector2(8, 12), new Phaser.Math.Vector2(90, 7), new Phaser.Math.Vector2(172, 12), new Phaser.Math.Vector2(90, 17),
  ], true);
  g.generateTexture(TEX.slash, 180, 24);
  // 공명 흡입 조각 오브
  radial(TEX.orb, 16, 10, 1.8);
  g.destroy();
}
