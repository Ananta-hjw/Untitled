import Phaser from 'phaser';
import propsUrl from '../assets/festival/props.webp';
import propsAtlas from '../assets/festival/props.json';
import { DEPTH_LIGHTING, VIEW_HEIGHT } from '../config';
import { BONFIRE, FEAST_TABLES, LANTERN_STRINGS } from '../story/festival';

const FESTIVAL_TEXTURE = 'festival-props';
export function preloadFestival(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FESTIVAL_TEXTURE)) scene.load.atlas(FESTIVAL_TEXTURE, propsUrl, propsAtlas);
}

/** 등불 줄이 걸린 높이(발에서 위로)와 처짐 */
const STRING_HEIGHT = 190;
const STRING_SAG = 46;
const BULBS_PER_STRING = 13;
const SKY_LANTERNS = 28;
const LANTERN_RISE = 62;
const BULB_COLORS = [0xffc65a, 0xff8a4c, 0xffe28a, 0xff6f6f];

interface SkyLantern { x: number; y: number; phase: number; speed: number; born: number; size: number; image: Phaser.GameObjects.Image }

/**
 * 1장 수확제 연출(story/festival.ts)의 그림: 모닥불, 잔칫상, 등불 줄, 하늘로 띄우는 등불,
 * 차가운 바람(불과 등불이 흔들리고 어두워짐)과 습격 경보(붉은 맥박).
 * 모두 장면의 게임 시계로 움직여 대화 중에는 멈춘다. 장면이 다시 시작하면 함께 사라진다.
 * 밤 그늘은 습격 때의 그늘(chapterShade)을 그대로 쓰고, 바람이 불면 그 위에 한 겹 더 어둡게 덮는다.
 */
export class FestivalStage {
  private readonly scene: Phaser.Scene;
  private readonly flame: Phaser.GameObjects.Image;
  private readonly embers: Phaser.GameObjects.Graphics;
  private readonly skyImages: Phaser.GameObjects.Image[] = [];
  private readonly glow: Phaser.GameObjects.Image;
  private readonly bulbs: Phaser.GameObjects.Graphics;
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly alarm: Phaser.GameObjects.Graphics;
  private width = 0;
  private readonly bulbPoints: Array<{ x: number; y: number; color: number; image: Phaser.GameObjects.Image }> = [];
  private lanterns: SkyLantern[] = [];
  private cheerUntil = 0;
  private windAt = Infinity;
  private alarmAt = Infinity;
  private now = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.prop('bonfire-base', BONFIRE.x, BONFIRE.y + 12, 168, BONFIRE.y - 1);
    for (const table of FEAST_TABLES) this.prop('feast-table', table.x, table.y, table.w, table.y);
    this.drawStrings();
    this.flame = this.prop('flame-0', BONFIRE.x, BONFIRE.y - 12, 100, BONFIRE.y + 1);
    this.embers = scene.add.graphics().setDepth(BONFIRE.y + 2);
    // Soft light falloff avoids visible rings over the painted ground.
    const lightKey = 'festival-fire-light';
    if (!scene.textures.exists(lightKey)) {
      const texture = scene.textures.createCanvas(lightKey, 128, 128)!;
      const context = texture.context;
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [stop, alpha] of [[0, 0.32], [0.15, 0.25], [0.4, 0.1], [0.7, 0.025], [1, 0]]) {
        gradient.addColorStop(stop, `rgba(255, 255, 255, ${alpha})`);
      }
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      texture.refresh();
    }
    this.glow = scene.add.image(BONFIRE.x, BONFIRE.y - 50, lightKey).setTint(0xff9a3c)
      .setDepth(DEPTH_LIGHTING + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.bulbs = scene.add.graphics().setDepth(DEPTH_LIGHTING + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.sky = scene.add.graphics().setDepth(DEPTH_LIGHTING + 3);
    this.alarm = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_LIGHTING + 4);
    for (let i = 0; i < SKY_LANTERNS; i++) {
      this.skyImages.push(this.prop('sky-lantern', 0, 0, 26, DEPTH_LIGHTING + 3).setOrigin(0.5).setVisible(false));
    }
    this.layout(scene.scale.gameSize.width);
  }

  layout(width: number): void {
    this.width = width;
  }

  /** 대본의 효과 신호 */
  cue(name: string): void {
    switch (name) {
      case 'cheer':
        this.cheerUntil = this.now + 1600;
        break;
      case 'lanterns':
        this.releaseLanterns();
        break;
      case 'wind':
        this.windAt = this.now;
        break;
      case 'alarm':
        this.alarmAt = this.now;
        break;
      default:
        break;
    }
  }

  /** 화면에 떠 있는 하늘 등불 수 (테스트용) */
  get lanternCount(): number { return this.lanterns.length; }

  /** 게임 시계로 한 걸음 */
  update(now: number): void {
    this.now = now;
    const wind = Math.min(1, Math.max(0, (now - this.windAt) / 1500));
    const alarm = now >= this.alarmAt;
    this.drawFire(now, wind);
    this.drawBulbs(now, wind);
    this.drawSky(now, wind);
    // 경보: 붉은 맥박
    // 바람이 불면 습격의 밤보다 더 어두워지고, 경보가 울리면 붉게 맥박친다.
    this.alarm.clear().fillStyle(0x05070d, 0.22 * wind).fillRect(0, 0, this.width, VIEW_HEIGHT);
    if (alarm) this.alarm.fillStyle(0x8c1010, 0.06 + 0.1 * (0.5 + 0.5 * Math.sin((now - this.alarmAt) / 180))).fillRect(0, 0, this.width, VIEW_HEIGHT);
  }

  private prop(frame: string, x: number, y: number, width: number, depth: number): Phaser.GameObjects.Image {
    const image = this.scene.add.image(x, y, FESTIVAL_TEXTURE, frame).setOrigin(0.5, 1).setDepth(depth);
    return image.setScale(width / image.width);
  }

  /** 장대와 밧줄은 고정하고, 매 프레임 등불의 빛과 흔들림을 갱신한다. */
  private drawStrings(): void {
    for (const [a, b] of LANTERN_STRINGS) {
      for (const pole of [a, b]) {
        const image = this.prop('festival-pole', pole.x, pole.y, 24, pole.y);
        image.setScale((STRING_HEIGHT + 25) / image.height);
      }
      const line = this.scene.add.graphics().setDepth(DEPTH_LIGHTING + 1);
      line.lineStyle(3, 0x2a1a10, 0.9).beginPath();
      for (let i = 0; i <= 24; i++) {
        const p = this.stringPoint(a, b, i / 24);
        if (i === 0) line.moveTo(p.x, p.y); else line.lineTo(p.x, p.y);
      }
      line.strokePath();
      for (let i = 1; i < BULBS_PER_STRING; i++) {
        const p = this.stringPoint(a, b, i / BULBS_PER_STRING);
        const image = this.prop('hanging-lantern', p.x, p.y, 22, DEPTH_LIGHTING + 2).setOrigin(0.5, 0);
        this.bulbPoints.push({ x: p.x, y: p.y, color: BULB_COLORS[i % BULB_COLORS.length], image });
      }
    }
  }

  private stringPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number): { x: number; y: number } {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - STRING_HEIGHT + Math.sin(t * Math.PI) * STRING_SAG };
  }

  private drawFire(now: number, wind: number): void {
    const { x, y } = BONFIRE;
    const cheer = now < this.cheerUntil ? 1.35 : 1;
    const size = (1 - wind * 0.55) * cheer;
    const lean = wind * 26 * Math.sin(now / 140);
    const frame = `flame-${Math.floor(now / 110) % 4}`;
    this.flame.setFrame(frame).setPosition(x + lean * 0.3, y - 12)
      .setScale(100 / this.flame.width * (1 + wind * 0.12), 140 / this.flame.height * size * (0.96 + 0.04 * Math.sin(now / 90)))
      .setRotation(wind * 0.18 * Math.sin(now / 140));
    const f = this.embers.clear();
    // 불티
    for (let i = 0; i < 6; i++) {
      const t = ((now / 900 + i / 6) % 1);
      f.fillStyle(0xffd27a, 1 - t).fillCircle(x + Math.sin(now / 300 + i * 2) * 26 + lean * t, y - 40 - t * 160 * size, 3);
    }
    const pulse = (0.9 + 0.1 * Math.sin(now / 90)) * size;
    this.glow.setDisplaySize(840 * pulse, 630 * pulse).setAlpha(pulse);
  }

  private drawBulbs(now: number, wind: number): void {
    const g = this.bulbs.clear();
    this.bulbPoints.forEach((p, i) => {
      // 바람이 불면 하나씩 꺼질 듯 깜박인다.
      const flicker = wind > 0 ? Math.max(0.15, 1 - wind * (0.5 + 0.5 * Math.sin(now / 45 + i * 3.1))) : 0.9 + 0.1 * Math.sin(now / 400 + i);
      const sway = wind * 6 * Math.sin(now / 160 + i);
      g.fillStyle(p.color, 0.12 * flicker).fillCircle(p.x + sway, p.y + 14, 22);
      p.image.setRotation(sway / 35).setAlpha(0.45 + 0.55 * flicker);
    });
  }

  private releaseLanterns(): void {
    if (this.lanterns.length) return;
    const rand = new Phaser.Math.RandomDataGenerator(['rowen-festival']);
    for (let i = 0; i < SKY_LANTERNS; i++) {
      this.lanterns.push({
        x: BONFIRE.x + rand.between(-560, 560), y: BONFIRE.y + rand.between(-60, 200) - 120,
        phase: rand.frac() * Math.PI * 2, speed: LANTERN_RISE * rand.realInRange(0.75, 1.3),
        born: this.now + i * 120, size: rand.realInRange(0.8, 1.2), image: this.skyImages[i],
      });
    }
  }

  private drawSky(now: number, wind: number): void {
    const g = this.sky.clear();
    this.skyImages.forEach(image => image.setVisible(false));
    for (const l of this.lanterns) {
      const age = (now - l.born) / 1000;
      if (age < 0) continue;
      const x = l.x + Math.sin(age * 0.9 + l.phase) * 18 + wind * age * 20;
      const y = l.y - age * l.speed;
      const alpha = Math.max(0, Math.min(1, age * 2, 1 - (age - 14) / 4));
      const s = l.size;
      g.fillStyle(0xffb04a, 0.12 * alpha).fillCircle(x, y, 30 * s);
      l.image.setVisible(true).setPosition(x, y).setScale(26 * s / l.image.width)
        .setAlpha(alpha).setRotation(Math.sin(age * 0.9 + l.phase) * (0.03 + wind * 0.12));
    }
    this.lanterns = this.lanterns.filter((l) => (now - l.born) / 1000 < 18);
  }
}
