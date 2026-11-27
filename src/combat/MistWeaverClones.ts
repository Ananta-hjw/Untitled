import type Phaser from 'phaser';
import type { StoryFrame } from '../entities/npcStoryActions';
import { bladeHitsEllipse, type BladeSweep, type Point } from './blade';
import untieUrl from '../assets/chapter2/mist-weaver/clone-untie.webp?url';
import untie from '../assets/chapter2/mist-weaver/clone-untie-frames.json';
import reachUrl from '../assets/chapter2/mist-weaver/clone-reach.webp?url';
import reach from '../assets/chapter2/mist-weaver/clone-reach-frames.json';
import form from '../assets/chapter2/mist-weaver/mist-form-frames.json';
import wrap from '../assets/chapter2/mist-weaver/cocoon-wrap-frames.json';

const MOTIONS = {
  untie: { key: 'mist-clone-untie', data: untie, url: untieUrl },
  reach: { key: 'mist-clone-reach', data: reach, url: reachUrl },
};
type Role = keyof typeof MOTIONS;
const SITES: ReadonlyArray<{ role: Role; actor: Point; prop: Point }> = [
  { role: 'untie', actor: { x: 814, y: 925 }, prop: { x: 865, y: 880 } },
  { role: 'reach', actor: { x: 450, y: 1065 }, prop: { x: 506, y: 1038 } },
  { role: 'reach', actor: { x: 658, y: 1085 }, prop: { x: 718, y: 1058 } },
];
const TRAVEL_MS = 850;
const WORK_MS = 4000;
const FADE_MS = 460;

interface Clone {
  actor: Phaser.GameObjects.Image;
  role: Role;
  target: Point;
  prop: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  cutAt?: number;
}
interface Cast {
  start: number;
  from: Point;
  clones: Clone[];
  finished: boolean;
}

export function preloadMistWeaverClones(scene: Phaser.Scene): void {
  for (const { key, url } of Object.values(MOTIONS)) if (!scene.textures.exists(key)) scene.load.image(key, url);
}

export class MistWeaverClones {
  private cast?: Cast;

  constructor(private readonly scene: Phaser.Scene) {
    for (const { key, data } of Object.values(MOTIONS)) {
      const texture = scene.textures.get(key);
      for (const f of data.frames) {
        if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
      }
    }
  }

  get active(): boolean { return this.cast !== undefined; }

  start(now: number, from: Point): void {
    if (this.cast) return;
    this.cast = { start: now, from: { x: from.x, y: from.y }, finished: false, clones: SITES.map(site => {
      const actor = this.scene.add.image(from.x, from.y, 'mist-weaver-form', form.frames[0].name)
        .setName(`mist-clone-${site.role}`).setAlpha(0.74);
      const prop = site.role === 'untie' ? this.drawKnot(site.prop)
        : this.scene.add.image(site.prop.x, site.prop.y, 'mist-weaver-wrap', wrap.frames[2].name)
          .setOrigin(wrap.frames[2].originX, wrap.frames[2].originY).setScale(0.47).setDepth(site.prop.y)
          .setName('mist-clone-target-cocoon');
      return { actor, role: site.role, target: site.actor, prop };
    }) };
  }

  update(now: number): 'repelled' | 'reached' | undefined {
    const cast = this.cast;
    if (!cast) return;
    const elapsed = now - cast.start;
    const over = elapsed >= TRAVEL_MS + WORK_MS;
    for (const clone of cast.clones) {
      if (clone.cutAt !== undefined || over) {
        const vanish = now - (clone.cutAt ?? cast.start + TRAVEL_MS + WORK_MS);
        const index = Math.min(3, Math.floor(vanish / (FADE_MS / 4)));
        this.paint(clone, 'mist-weaver-form', form.frames[form.dissipateOrder[index]], 0.74);
        clone.actor.setAlpha(0.74 * Math.max(0, 1 - vanish / FADE_MS));
        continue;
      }
      if (elapsed < TRAVEL_MS) {
        const p = elapsed / TRAVEL_MS;
        clone.actor.setPosition(cast.from.x + (clone.target.x - cast.from.x) * p, cast.from.y + (clone.target.y - cast.from.y) * p);
        this.paint(clone, 'mist-weaver-form', form.frames[Math.floor(p * 4)], 0.74);
      } else {
        const sheet = MOTIONS[clone.role];
        const f = sheet.data.frames[Math.floor((elapsed - TRAVEL_MS) * sheet.data.fps / 1000) % sheet.data.frames.length];
        clone.actor.setPosition(clone.target.x, clone.target.y);
        this.paint(clone, sheet.key, f, 175 / sheet.data.bodyHeight);
        if (clone.role === 'reach') clone.prop.setAlpha(1 - 0.58 * Math.min(1, (elapsed - TRAVEL_MS) / WORK_MS));
      }
    }
    const allCut = cast.clones.every(clone => clone.cutAt !== undefined);
    if (over && !cast.finished) {
      cast.finished = true;
      for (const clone of cast.clones) if (clone.cutAt === undefined) clone.prop.setAlpha(0.35);
      if (!allCut) return 'reached';
    }
    if (cast.clones.every(clone => now >= (clone.cutAt ?? cast.start + TRAVEL_MS + WORK_MS) + FADE_MS)) {
      this.clear();
      if (allCut) return 'repelled';
    }
  }

  cut(sweep: BladeSweep, now: number): void {
    const cast = this.cast;
    if (!cast || cast.finished || now < cast.start + TRAVEL_MS * 0.25) return;
    for (const clone of cast.clones) {
      if (clone.cutAt !== undefined) continue;
      if (bladeHitsEllipse(sweep.previous, sweep.current, { x: clone.actor.x, y: clone.actor.y - 85 }, 70, 78)) {
        clone.cutAt = now;
        clone.prop.setAlpha(1);
      }
    }
  }

  clear(): void {
    for (const clone of this.cast?.clones ?? []) {
      clone.actor.destroy();
      clone.prop.destroy();
    }
    this.cast = undefined;
  }

  private paint(clone: Clone, key: string, frame: StoryFrame, scale: number): void {
    clone.actor.setTexture(key, frame.name).setOrigin(frame.originX, frame.originY).setScale(scale).setDepth(clone.actor.y);
  }

  private drawKnot(at: Point): Phaser.GameObjects.Graphics {
    const art = this.scene.add.graphics().setDepth(at.y).setName('mist-clone-target-knot');
    art.fillStyle(0x62432a).fillRoundedRect(at.x - 8, at.y - 100, 16, 100, 4);
    art.lineStyle(5, 0xb99867).lineBetween(at.x - 19, at.y - 62, at.x + 18, at.y - 51);
    art.strokeEllipse(at.x, at.y - 56, 29, 18);
    return art;
  }
}
