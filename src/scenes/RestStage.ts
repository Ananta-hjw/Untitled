import type Phaser from 'phaser';
import { DEPTH_UI, VIEW_HEIGHT } from '../config';
import type { MapId } from '../world/maps';
import type { Point } from '../story/opening';
import seatUrl from '../assets/hero/academy/rest/seat.webp?url';
import seat from '../assets/hero/academy/rest/seat-frames.json';
import campUrl from '../assets/hero/academy/rest/camp.webp?url';
import camp from '../assets/hero/academy/rest/camp-frames.json';
import sleepUrl from '../assets/hero/academy/rest/sleep.webp?url';
import sleep from '../assets/hero/academy/rest/sleep-frames.json';
import roomUrl from '../assets/hero/academy/rest/guest-room.webp?url';

const SHEETS = {
  seat: { key: 'hero-rest-seat', url: seatUrl, data: seat },
  camp: { key: 'hero-rest-camp', url: campUrl, data: camp },
  sleep: { key: 'hero-rest-sleep', url: sleepUrl, data: sleep },
};
const ROOM_KEY = 'rest-guest-room';
type Motion = keyof typeof SHEETS;
type Sound = 'room' | 'fire' | 'morning' | 'bell';

export function preloadRestArt(scene: Phaser.Scene, map: MapId): void {
  const name = map === 'in-home' ? 'seat' : map === 'east-pass' ? 'camp'
    : map === 'in-inn' || map === 'in-ferry-inn' ? 'sleep' : undefined;
  if (!name) return;
  const { key, url } = SHEETS[name];
  if (!scene.textures.exists(key)) scene.load.image(key, url);
  if (name === 'sleep' && !scene.textures.exists(ROOM_KEY)) scene.load.image(ROOM_KEY, roomUrl);
}

type RestShot =
  | { kind: 'seat' | 'camp'; at: Point; overnight?: boolean }
  | { kind: 'sleep'; interrupted?: boolean };

interface RestPresentation {
  sound(cue: Sound): void;
  recover(progress: number): void;
  finish(): void;
}

/** One short presentation on the render clock. The game scene owns input and saves. */
export class RestStage {
  private readonly actor: Phaser.GameObjects.Image;
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly room?: Phaser.GameObjects.Image;
  private readonly screen?: Phaser.GameObjects.Container;
  private readonly light?: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  private cuePlayed = false;
  private done = false;

  constructor(private readonly scene: Phaser.Scene, private readonly shot: RestShot, private readonly host: RestPresentation) {
    const { key, data } = SHEETS[shot.kind];
    const texture = scene.textures.get(key);
    for (const f of data.frames) {
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
    }
    this.actor = scene.add.image(0, 0, key, data.frames[0].name).setName('rest-hero-pose');
    this.veil = scene.add.rectangle(0, 0, 1, VIEW_HEIGHT, 0x091426).setOrigin(0).setScrollFactor(0)
      .setDepth(DEPTH_UI - 1).setAlpha(0).setName('rest-veil');
    if (shot.kind === 'sleep') {
      const black = scene.add.rectangle(0, 0, 1, VIEW_HEIGHT, 0x090707).setOrigin(0).setName('rest-backdrop');
      this.room = scene.add.image(0, 0, ROOM_KEY).setName('rest-bedroom');
      this.light = scene.add.graphics().setName('rest-morning-light');
      this.screen = scene.add.container(0, 0, [black, this.room, this.light, this.veil, this.actor])
        .setScrollFactor(0).setDepth(DEPTH_UI + 40).setName('rest-bedroom-shot');
      // Darken the whole shot together, including the hero on the quilt.
      this.screen.bringToTop(this.veil);
      this.screen.setAlpha(0);
    } else {
      this.actor.setPosition(shot.at.x, shot.at.y).setDepth(shot.at.y + 1);
    }
    this.paintActor(0);
    this.layout();
    host.sound(shot.kind === 'camp' ? 'fire' : 'room');
  }

  layout(): void {
    const width = this.scene.scale.gameSize.width;
    this.veil.setSize(width, VIEW_HEIGHT);
    if (!this.room || !this.screen) return;
    const black = this.screen.getByName('rest-backdrop') as Phaser.GameObjects.Rectangle;
    black.setSize(width, VIEW_HEIGHT);
    const scale = Math.min((width - 24) / this.room.width, (VIEW_HEIGHT - 36) / this.room.height);
    this.room.setPosition(width / 2, VIEW_HEIGHT / 2).setScale(scale);
    this.paintBed();
  }

  update(delta: number): void {
    if (this.done) return;
    this.elapsed += delta;
    if (this.shot.kind === 'sleep') this.updateBed();
    else this.updateSeat(!!this.shot.overnight);
  }

  private updateSeat(overnight: boolean): void {
    const t = this.elapsed;
    const rise = overnight ? 1660 : 850;
    const pose = t < 140 ? 0 : t < 380 ? 1 : t < rise ? 2 : 3;
    this.paintActor(pose);
    if (overnight) {
      this.veil.setFillStyle(0x071024).setAlpha(0.90 * Math.min(this.progress(390, 480), 1 - this.progress(1110, 490)));
      if (t >= 1220) this.playCue('morning');
      this.host.recover(this.progress(650, 880));
    } else {
      this.host.recover(this.progress(180, 700));
    }
    if (t >= rise + 200) this.finish();
  }

  private updateBed(): void {
    const interrupted = this.shot.kind === 'sleep' && this.shot.interrupted;
    this.paintBed();
    const cueAt = interrupted ? 1320 : 1390;
    if (this.elapsed >= cueAt) this.playCue(interrupted ? 'bell' : 'morning');
    this.host.recover(this.progress(640, 650));
    if (this.elapsed >= (interrupted ? 1960 : 2720)) this.finish();
  }

  private paintBed(): void {
    if (!this.room || !this.screen || !this.light || this.shot.kind !== 'sleep') return;
    const t = this.elapsed;
    const interrupted = this.shot.interrupted;
    const outAt = interrupted ? 1660 : 2410;
    this.screen.setAlpha(Math.min(this.progress(0, 250), 1 - this.progress(outAt, 300)));
    const morning = this.progress(1340, 500);
    const dim = 0.95 * this.progress(470, 550);
    this.veil.setFillStyle(0x101a32).setAlpha(interrupted
      ? dim * (1 - 0.55 * this.progress(1320, 280)) : dim * (1 - morning));

    const w = this.room.displayWidth, h = this.room.displayHeight;
    const left = this.room.x - w / 2, top = this.room.y - h / 2;
    const pose = interrupted ? (t < 1400 ? 0 : 1) : t < 1790 ? 0 : t < 1990 ? 1 : t < 2180 ? 2 : 3;
    this.paintActor(pose);
    const x = [0.523, 0.597, 0.618, 0.633][pose];
    const y = [0.625, 0.727, 0.757, 0.761][pose];
    this.actor.setPosition(left + w * x, top + h * y).setScale(this.actor.scaleX * h / 570);

    this.light.clear();
    const lamp = 1 - this.progress(340, 470);
    if (lamp > 0) {
      for (const [radius, opacity] of [[38, 0.04], [24, 0.07], [10, 0.14]]) {
        this.light.fillStyle(0xffcf87, lamp * opacity).fillCircle(left + 0.673 * w, top + 0.315 * h, radius * h / 570);
      }
    }
    if (interrupted || morning === 0) return;
    // Window light follows the painted opening and fades at the far end.
    this.light.fillStyle(0xffdaa1, morning * 0.14)
      .fillTriangle(left + 0.257 * w, top + 0.24 * h, left + 0.330 * w, top + 0.27 * h, left + 0.581 * w, top + 0.76 * h);
    this.light.fillStyle(0xffe0aa, morning * 0.10)
      .fillTriangle(left + 0.283 * w, top + 0.23 * h, left + 0.326 * w, top + 0.25 * h, left + 0.584 * w, top + 0.72 * h);
  }

  private paintActor(pose: number): void {
    const data = SHEETS[this.shot.kind].data;
    const frame = data.frames[pose];
    this.actor.setFrame(frame.name).setOrigin(frame.originX, frame.originY).setScale(150 / data.bodyHeight);
  }

  private progress(start: number, duration: number): number {
    const t = Math.max(0, Math.min(1, (this.elapsed - start) / duration));
    return t * t * (3 - 2 * t);
  }

  private playCue(cue: 'morning' | 'bell'): void {
    if (this.cuePlayed) return;
    this.cuePlayed = true;
    this.host.sound(cue);
  }

  private finish(): void {
    this.done = true;
    if (this.screen) this.screen.destroy();
    else {
      this.actor.destroy();
      this.veil.destroy();
    }
    this.host.finish();
  }
}
