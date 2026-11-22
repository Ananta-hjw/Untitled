import Phaser from 'phaser';
import { DEPTH_LIGHTING, VIEW_HEIGHT } from '../config';
import { BONFIRE, FEAST_TABLES, LANTERN_STRINGS } from '../story/festival';

/** 등불 줄이 걸린 높이(발에서 위로)와 처짐 */
const STRING_HEIGHT = 190;
const STRING_SAG = 46;
const BULBS_PER_STRING = 13;
const SKY_LANTERNS = 28;
const LANTERN_RISE = 62;
const BULB_COLORS = [0xffc65a, 0xff8a4c, 0xffe28a, 0xff6f6f];

interface SkyLantern { x: number; y: number; phase: number; speed: number; born: number; size: number }

/**
 * 1장 수확제 연출(story/festival.ts)의 그림: 모닥불, 잔칫상, 등불 줄, 하늘로 띄우는 등불,
 * 차가운 바람(불과 등불이 흔들리고 어두워짐)과 습격 경보(붉은 맥박).
 * 모두 장면의 게임 시계로 움직여 대화 중에는 멈춘다. 장면이 다시 시작하면 함께 사라진다.
 * 밤 그늘은 습격 때의 그늘(chapterShade)을 그대로 쓰고, 바람이 불면 그 위에 한 겹 더 어둡게 덮는다.
 */
export class FestivalStage {
  private readonly scene: Phaser.Scene;
  private readonly flame: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly bulbs: Phaser.GameObjects.Graphics;
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly alarm: Phaser.GameObjects.Graphics;
  private width = 0;
  private readonly bulbPoints: Array<{ x: number; y: number; color: number }> = [];
  private lanterns: SkyLantern[] = [];
  private cheerUntil = 0;
  private windAt = Infinity;
  private alarmAt = Infinity;
  private now = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const ground = scene.add.graphics();
    this.drawLogs(ground);
    ground.setDepth(BONFIRE.y - 1);
    for (const table of FEAST_TABLES) this.drawTable(scene.add.graphics().setDepth(table.y), table);
    this.drawStrings();
    this.flame = scene.add.graphics().setDepth(BONFIRE.y + 1);
    this.glow = scene.add.graphics().setDepth(DEPTH_LIGHTING + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.bulbs = scene.add.graphics().setDepth(DEPTH_LIGHTING + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.sky = scene.add.graphics().setDepth(DEPTH_LIGHTING + 3);
    this.alarm = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_LIGHTING + 4);
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

  private drawLogs(g: Phaser.GameObjects.Graphics): void {
    const { x, y } = BONFIRE;
    // 돌 둘레와 장작
    g.fillStyle(0x000000, 0.25).fillEllipse(x, y + 4, 150, 46);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0x77746c : 0x8d897f, 1).fillEllipse(x + Math.cos(a) * 62, y + Math.sin(a) * 20, 26, 16);
    }
    g.lineStyle(14, 0x5a3418, 1).lineBetween(x - 44, y + 6, x + 40, y - 12).lineBetween(x - 40, y - 12, x + 44, y + 6);
    g.lineStyle(14, 0x6d4220, 1).lineBetween(x - 10, y + 12, x + 8, y - 20);
  }

  private drawTable(g: Phaser.GameObjects.Graphics, t: { x: number; y: number; w: number; d: number }): void {
    const left = t.x - t.w / 2, top = t.y - t.d - 34;
    g.fillStyle(0x000000, 0.22).fillEllipse(t.x, t.y + 4, t.w + 20, 30);
    // 다리
    g.fillStyle(0x4a2c14, 1).fillRect(left + 12, t.y - 40, 12, 40).fillRect(left + t.w - 24, t.y - 40, 12, 40);
    // 상판과 천
    g.fillStyle(0x7a4a24, 1).fillRect(left, top, t.w, t.d);
    g.fillStyle(0xf1e6cf, 1).fillRect(left + 8, top + 4, t.w - 16, t.d - 16);
    g.fillStyle(0xc9483a, 1).fillRect(left + 8, top + t.d - 20, t.w - 16, 8);
    // 그릇과 빵, 과일
    for (let i = 0; i < 5; i++) {
      const cx = left + 34 + i * ((t.w - 68) / 4), cy = top + t.d / 2 - 4;
      g.fillStyle(0xdcd3c0, 1).fillEllipse(cx, cy, 40, 18);
      g.fillStyle([0xd28a3a, 0xb8442e, 0xe0b54a, 0x8a5a2b, 0x9fbf4a][i], 1).fillEllipse(cx, cy - 3, 26, 11);
    }
  }

  /** 장대와 줄은 한 번 그린다. 전구 자리는 기억해 두고 빛만 매 프레임 그린다. */
  private drawStrings(): void {
    for (const [a, b] of LANTERN_STRINGS) {
      for (const pole of [a, b]) {
        const g = this.scene.add.graphics().setDepth(pole.y);
        g.fillStyle(0x000000, 0.25).fillEllipse(pole.x, pole.y + 2, 30, 10);
        g.fillStyle(0x5b3a1e, 1).fillRect(pole.x - 5, pole.y - STRING_HEIGHT - 12, 10, STRING_HEIGHT + 12);
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
        this.bulbPoints.push({ x: p.x, y: p.y + 10, color: BULB_COLORS[i % BULB_COLORS.length] });
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
    const f = this.flame.clear();
    const tongues = [[-22, 0.8, 0xd2401c], [18, 0.85, 0xd2401c], [0, 1.15, 0xf07a22], [-8, 0.75, 0xffb43a], [10, 0.7, 0xffb43a], [0, 0.45, 0xfff0a0]] as const;
    tongues.forEach(([dx, h, color], i) => {
      const flicker = 0.85 + 0.15 * Math.sin(now / (70 + i * 13) + i * 1.7);
      const height = 120 * h * size * flicker;
      const width = 34 * (h + 0.3) * size;
      f.fillStyle(color, 0.95).fillTriangle(x + dx - width / 2, y - 6, x + dx + width / 2, y - 6, x + dx + lean * h, y - 6 - height);
      f.fillEllipse(x + dx, y - 10, width, width * 0.6);
    });
    // 불티
    for (let i = 0; i < 6; i++) {
      const t = ((now / 900 + i / 6) % 1);
      f.fillStyle(0xffd27a, 1 - t).fillCircle(x + Math.sin(now / 300 + i * 2) * 26 + lean * t, y - 40 - t * 160 * size, 3);
    }
    const g = this.glow.clear();
    const pulse = (0.9 + 0.1 * Math.sin(now / 90)) * size;
    for (const [r, a] of [[420, 0.035], [340, 0.04], [270, 0.05], [200, 0.06], [140, 0.08], [80, 0.1]] as const) {
      g.fillStyle(0xff9a3c, a * pulse).fillEllipse(x, y - 50, r * 2 * pulse, r * 1.5 * pulse);
    }
  }

  private drawBulbs(now: number, wind: number): void {
    const g = this.bulbs.clear();
    this.bulbPoints.forEach((p, i) => {
      // 바람이 불면 하나씩 꺼질 듯 깜박인다.
      const flicker = wind > 0 ? Math.max(0.15, 1 - wind * (0.5 + 0.5 * Math.sin(now / 45 + i * 3.1))) : 0.9 + 0.1 * Math.sin(now / 400 + i);
      const sway = wind * 6 * Math.sin(now / 160 + i);
      g.fillStyle(p.color, 0.22 * flicker).fillCircle(p.x + sway, p.y, 22);
      g.fillStyle(p.color, 0.9 * flicker).fillCircle(p.x + sway, p.y, 7);
    });
  }

  private releaseLanterns(): void {
    const rand = new Phaser.Math.RandomDataGenerator(['rowen-festival']);
    for (let i = 0; i < SKY_LANTERNS; i++) {
      this.lanterns.push({
        x: BONFIRE.x + rand.between(-560, 560), y: BONFIRE.y + rand.between(-60, 200) - 120,
        phase: rand.frac() * Math.PI * 2, speed: LANTERN_RISE * rand.realInRange(0.75, 1.3),
        born: this.now + i * 120, size: rand.realInRange(0.8, 1.2),
      });
    }
  }

  private drawSky(now: number, wind: number): void {
    const g = this.sky.clear();
    for (const l of this.lanterns) {
      const age = (now - l.born) / 1000;
      if (age < 0) continue;
      const x = l.x + Math.sin(age * 0.9 + l.phase) * 18 + wind * age * 20;
      const y = l.y - age * l.speed;
      const alpha = Math.max(0, Math.min(1, age * 2, 1 - (age - 14) / 4));
      const s = l.size;
      // 빛 번짐, 종이 몸통, 아래 불씨
      g.fillStyle(0xffb04a, 0.18 * alpha).fillCircle(x, y, 30 * s);
      g.fillStyle(0xffd27a, 0.95 * alpha).fillRoundedRect(x - 11 * s, y - 16 * s, 22 * s, 30 * s, 5 * s);
      g.fillStyle(0xff8a3c, 0.9 * alpha).fillRect(x - 11 * s, y + 8 * s, 22 * s, 4 * s);
      g.fillStyle(0xfff4c0, alpha).fillCircle(x, y + 16 * s, 3 * s);
    }
    this.lanterns = this.lanterns.filter((l) => (now - l.born) / 1000 < 18);
  }
}
