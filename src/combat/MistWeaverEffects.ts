import type Phaser from 'phaser';
import type { StoryFrame } from '../entities/npcStoryActions';
import type { Point } from './blade';
import formUrl from '../assets/chapter2/mist-weaver/mist-form.webp?url';
import form from '../assets/chapter2/mist-weaver/mist-form-frames.json';
import dormantUrl from '../assets/chapter2/mist-weaver/mist-dormant.webp?url';
import dormant from '../assets/chapter2/mist-weaver/mist-dormant-frames.json';
import gustUrl from '../assets/chapter2/mist-weaver/gust.webp?url';
import gust from '../assets/chapter2/mist-weaver/gust-frames.json';
import ringUrl from '../assets/chapter2/mist-weaver/cocoon-ring.webp?url';
import ring from '../assets/chapter2/mist-weaver/cocoon-ring-frames.json';
import wrapUrl from '../assets/chapter2/mist-weaver/cocoon-wrap.webp?url';
import wrap from '../assets/chapter2/mist-weaver/cocoon-wrap-frames.json';

const SHEETS = {
  form: { ...form, url: formUrl, scale: 0.85 },
  dormant: { ...dormant, url: dormantUrl, scale: 0.86 },
  gust: { ...gust, url: gustUrl, scale: 1.13 },
  ring: { ...ring, url: ringUrl, scale: 1.08 },
  wrap: { ...wrap, url: wrapUrl, scale: 0.81 },
};
type Motion = keyof typeof SHEETS;
const keyFor = (motion: Motion) => `mist-weaver-${motion}`;
export function preloadMistWeaverEffects(scene: Phaser.Scene): void {
  for (const motion of Object.keys(SHEETS) as Motion[]) {
    const key = keyFor(motion);
    if (!scene.textures.exists(key)) scene.load.image(key, SHEETS[motion].url);
  }
}

const RANGE = 380;
const GUST_RELEASE_MS = 520;
const RING_FRAME_MS = 450;
const RING_RADII = [143, 118, 89, 62];
const RING_ASPECT = 0.67;
const COCOON_HOLD_MS = 2600;
const WRAP_BREAK_MS = 230;

type MotionState =
  | { kind: 'arrive' | 'dormant'; start: number }
  | { kind: 'relocate'; start: number; destination: Point }
  | { kind: 'gust'; start: number; direction: Point; released: boolean }
  | { kind: 'ring'; start: number; center: Point }
  | { kind: 'wrap'; start: number; expires: number; nextDamage: number }
  | { kind: 'break'; start: number };

interface EffectsEvents {
  placeCaster(at: Point): void;
  showCaster(visible: boolean): void;
  showCallout(text: string): void;
  push(direction: Point): void;
  bind(): void;
  damage(): void;
}

export class MistWeaverEffects {
  private readonly effect: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Container;
  private readonly ringImage: Phaser.GameObjects.Image;
  private motion?: MotionState;
  private dormant = false;

  constructor(scene: Phaser.Scene, private readonly caster: Point, private readonly player: Point, private readonly events: EffectsEvents, now: number) {
    for (const [motion, sheet] of Object.entries(SHEETS)) {
      const texture = scene.textures.get(keyFor(motion as Motion));
      for (const frame of sheet.frames) {
        if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
      }
    }
    this.effect = scene.add.image(0, 0, keyFor('form')).setName('mist-weaver-effect');
    this.ringImage = scene.add.image(0, 0, keyFor('ring')).setName('mist-weaver-ring-image');
    this.ring = scene.add.container(0, 0, [this.ringImage]).setName('mist-weaver-cocoon-ring')
      .setScale(1, RING_ASPECT).setDepth(-39).setVisible(false);
    this.playBody('arrive', now);
  }

  get active(): boolean { return this.motion !== undefined; }
  get sleeping(): boolean { return this.dormant; }
  get bound(): boolean { return this.motion?.kind === 'wrap'; }

  private playBody(kind: 'arrive' | 'dormant', now: number): void {
    this.motion = { kind, start: now };
    this.events.showCaster(false);
    this.draw(kind === 'dormant' ? 'dormant' : 'form', 0, this.caster);
  }

  ringBell(now: number): void {
    if (this.dormant) return;
    this.dormant = true;
    this.clear();
    this.playBody('dormant', now);
  }

  castGust(now: number): void {
    const dx = this.player.x - this.caster.x, dy = this.player.y - this.caster.y;
    const length = Math.hypot(dx, dy);
    this.motion = { kind: 'gust', start: now, direction: length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }, released: false };
    this.events.showCallout('돌풍 · 바람줄기 옆으로 피하세요');
  }

  castCocoon(now: number): void {
    this.motion = { kind: 'ring', start: now, center: { x: this.player.x, y: this.player.y } };
    this.events.showCallout('고치 감기 · 고리의 틈으로 회피하세요');
  }

  relocate(now: number, destination: Point): void {
    this.motion = { kind: 'relocate', start: now, destination };
    this.events.showCaster(false);
  }

  strikeCocoon(now: number): void {
    if (this.motion?.kind === 'wrap') this.motion.expires = Math.max(now, this.motion.expires - 480);
  }

  clear(): void {
    this.motion = undefined;
    this.ring.setVisible(false);
    this.effect.setVisible(false);
    this.events.showCaster(!this.dormant);
  }

  update(now: number, dodging: boolean): void {
    const motion = this.motion;
    if (!motion) return;
    const elapsed = now - motion.start;
    const frameAt = (key: Motion) => Math.min(3, Math.floor(elapsed * SHEETS[key].fps / 1000));
    switch (motion.kind) {
      case 'arrive':
      case 'dormant': {
        const key = motion.kind === 'arrive' ? 'form' : 'dormant';
        if (elapsed * SHEETS[key].fps >= 4000) this.clear();
        else this.draw(key, frameAt(key), this.caster);
        break;
      }
      case 'relocate': {
        const frames = form.dissipateOrder;
        const frame = Math.floor(elapsed * form.fps / 1000);
        if (frame < frames.length) this.draw('form', frames[frame], this.caster);
        else {
          this.events.placeCaster(motion.destination);
          this.playBody('arrive', now);
        }
        break;
      }
      case 'gust': {
        const d = motion.direction;
        const traveled = Math.min(elapsed / 880, 1) * 300;
        this.draw('gust', elapsed < 240 ? 0 : elapsed < GUST_RELEASE_MS ? 1 : elapsed < 730 ? 2 : 3, {
          x: this.caster.x + d.x * (36 + traveled), y: this.caster.y + d.y * (36 + traveled) - 52,
        }, Math.atan2(d.y, d.x));
        if (!motion.released && elapsed >= GUST_RELEASE_MS) {
          motion.released = true;
          const dx = this.player.x - this.caster.x, dy = this.player.y - this.caster.y;
          const forward = dx * d.x + dy * d.y;
          if (!dodging && forward >= 0 && forward <= RANGE && Math.abs(dx * d.y - dy * d.x) <= 57) this.events.push(d);
        }
        if (elapsed >= 950) this.clear();
        break;
      }
      case 'ring': {
        const frame = Math.min(3, Math.floor(elapsed / RING_FRAME_MS));
        const angle = elapsed * 0.0018;
        this.ring.setPosition(motion.center.x, motion.center.y).setVisible(true);
        this.paint(this.ringImage, 'ring', frame).setRotation(angle)
          .setScale(SHEETS.ring.scale, SHEETS.ring.scale / RING_ASPECT);
        const dx = this.player.x - motion.center.x, dy = (this.player.y - motion.center.y) / RING_ASPECT;
        const distance = Math.hypot(dx, dy);
        if (distance < RING_RADII[frame] && elapsed < RING_FRAME_MS * 4) break;
        const gap = angle + ring.gapDirectionDegrees * Math.PI / 180;
        const inGap = Math.cos(Math.atan2(dy, dx) - gap) >= Math.cos(Math.PI / 9);
        if (distance >= RING_RADII[frame] && dodging && inGap) {
          this.clear();
          this.events.showCallout('안개 고리에서 빠져나왔다');
          break;
        }
        this.ring.setVisible(false);
        this.motion = { kind: 'wrap', start: now, expires: now + COCOON_HOLD_MS, nextDamage: now + 820 };
        this.events.bind();
        this.events.showCallout('안개 고치에 갇혔다 · 공격으로 벗어나세요');
        this.draw('wrap', 0, this.player);
        break;
      }
      case 'wrap':
        if (now >= motion.expires) {
          this.motion = { kind: 'break', start: now };
          this.draw('wrap', 3, this.player);
        } else {
          this.draw('wrap', Math.min(2, frameAt('wrap')), this.player);
          if (now >= motion.nextDamage) {
            motion.nextDamage = now + 740;
            this.events.damage();
          }
        }
        break;
      case 'break':
        if (elapsed >= WRAP_BREAK_MS) this.clear();
        else this.draw('wrap', 3, this.player);
        break;
    }
  }

  private paint(image: Phaser.GameObjects.Image, motion: Motion, index: number): Phaser.GameObjects.Image {
    const art = SHEETS[motion];
    const frame: StoryFrame = art.frames[index];
    return image.setTexture(keyFor(motion), frame.name).setOrigin(frame.originX, frame.originY).setScale(art.scale);
  }

  private draw(motion: Motion, frame: number, at: Point, rotation = 0): void {
    this.paint(this.effect, motion, frame).setPosition(at.x, at.y)
      .setDepth(at.y + 4).setRotation(rotation).setVisible(true);
  }
}
