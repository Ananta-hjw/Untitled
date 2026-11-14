import Phaser from 'phaser';
import type { Blade } from './blade';

/**
 * 검이 지나간 자리에 남는 빛.
 *
 * Graphics 하나에 최근 궤적 조각들을 매 프레임 다시 그린다.
 * 조각마다 Graphics와 트윈을 새로 만들지 않으므로 공격을 이어가도 객체가 늘지 않는다.
 */

const FADE_MS = 110;
/** 동시에 남아 있을 수 있는 조각 수. 110ms 동안 생기는 프레임 수보다 넉넉하게 잡는다. */
const CAPACITY = 12;

interface Segment {
  active: boolean;
  age: number;
  finisher: boolean;
  prevBaseX: number;
  prevBaseY: number;
  prevTipX: number;
  prevTipY: number;
  baseX: number;
  baseY: number;
  tipX: number;
  tipY: number;
}

export class BladeTrail {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly segments: Segment[] = [];
  private next = 0;
  private drawn = false;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < CAPACITY; i++) {
      this.segments.push({
        active: false,
        age: 0,
        finisher: false,
        prevBaseX: 0,
        prevBaseY: 0,
        prevTipX: 0,
        prevTipY: 0,
        baseX: 0,
        baseY: 0,
        tipX: 0,
        tipY: 0,
      });
    }
  }

  /** 이전 프레임과 지금 프레임의 검날 사이를 한 조각으로 추가한다. */
  add(previous: Blade, current: Blade, finisher: boolean, depth: number): void {
    const segment = this.segments[this.next];
    this.next = (this.next + 1) % CAPACITY;
    segment.active = true;
    segment.age = 0;
    segment.finisher = finisher;
    segment.prevBaseX = previous.base.x;
    segment.prevBaseY = previous.base.y;
    segment.prevTipX = previous.tip.x;
    segment.prevTipY = previous.tip.y;
    segment.baseX = current.base.x;
    segment.baseY = current.base.y;
    segment.tipX = current.tip.x;
    segment.tipY = current.tip.y;
    this.graphics.setDepth(depth);
  }

  update(deltaMs: number): void {
    const g = this.graphics;
    let any = false;
    for (const segment of this.segments) {
      if (!segment.active) continue;
      segment.age += deltaMs;
      if (segment.age >= FADE_MS) segment.active = false;
      else any = true;
    }

    if (!any) {
      // 남은 조각이 없으면 한 번만 지우고 그 뒤로는 아무것도 하지 않는다.
      if (this.drawn) {
        g.clear();
        this.drawn = false;
      }
      return;
    }

    g.clear();
    this.drawn = true;
    for (const s of this.segments) {
      if (!s.active) continue;
      const fade = 1 - s.age / FADE_MS;
      if (s.finisher) {
        // 찌르기는 검날 방향으로 곧게 뻗는 빛으로 표현한다.
        g.lineStyle(9, 0xffb35a, 0.2 * fade).lineBetween(s.baseX, s.baseY, s.tipX, s.tipY);
        g.lineStyle(3, 0xffffff, 0.9 * fade).lineBetween(s.baseX, s.baseY, s.tipX, s.tipY);
      } else {
        g.fillStyle(0xfff3d6, 0.22 * fade).beginPath();
        g.moveTo(s.prevBaseX, s.prevBaseY);
        g.lineTo(s.prevTipX, s.prevTipY);
        g.lineTo(s.tipX, s.tipY);
        g.lineTo(s.baseX, s.baseY);
        g.closePath().fillPath();
        g.lineStyle(3, 0xfff3d6, 0.9 * fade).lineBetween(s.prevTipX, s.prevTipY, s.tipX, s.tipY);
      }
    }
  }
}
