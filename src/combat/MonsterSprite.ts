import Phaser from 'phaser';
import { FROST_SHELL, MONSTERS, monsterKind, type EnemyKey, type MonsterKind } from './monsterTypes';
import { direction8, type Direction8 } from '../world/npcs';
import phantomFadeUrl from '../assets/monsters/mist-phantom/fade.webp?url';
import phantomFade from '../assets/monsters/mist-phantom/fade-frames.json';

interface Frame {
  name: string; animation: string; direction: string; pose: number; sheet: string;
  x: number; y: number; w: number; h: number; originX: number; originY: number; scale: number;
}
interface FrameData { animations?: { walk: { fps: number; poses: number[] } }; frames: Frame[]; bounds: { top: number; bottom: number }; sheets: Record<string, { width: number; height: number }> }
const DATA = import.meta.glob<FrameData>('../assets/monsters/*/animation_frames.json', { eager: true, import: 'default' });
const URLS = import.meta.glob<string>('../assets/monsters/*/*.webp', { eager: true, query: '?url', import: 'default' });
const keyFor = (kind: MonsterKind, sheet: string) => `monster-${kind}-${sheet.replace('.png', '')}`;
const frameData = (kind: MonsterKind): FrameData | undefined => DATA[`../assets/monsters/${kind}/animation_frames.json`];
const idleKey = (kind: MonsterKind) => keyFor(kind, 'idle');
/**
 * 안개 환영의 등장(안개 한 줄기에서 몸이 생긴다)·쓰러짐(몸이 흩어져 사라진다) 4칸씩 (tools/build_mist_phantom_fade.py).
 * 게임 시계로 칸을 넘긴다. FADE_FRAME_MS × 4가 한 동작의 길이다.
 */
const FADE_KEY = 'monster-mist-phantom-fade';
export const FADE_FRAME_MS = { materialize: 130, dissipate: 120 };
export type FadeMotion = keyof typeof FADE_FRAME_MS;
// 입을 벌린 타격 프레임에서 잰 입 위치. 원본 시트 px, 프레임의 기준점 상대 좌표.
const SWAMP_MOUTH: Record<Direction8, [number, number]> = {
  down: [13, -119], left: [-100, -97], right: [99, -97], up: [13, -223],
  'down-left': [-92, -112], 'down-right': [91, -112], 'up-left': [-99, -174], 'up-right': [98, -174],
};

/** Load only species that inhabit the current map; textures are reused on revisits. */
export function preloadMonsters(scene: Phaser.Scene, spawns: readonly { key: EnemyKey }[]): void {
  const kinds = new Set(spawns.map(s => monsterKind(s.key)).filter((k): k is MonsterKind => !!k));
  for (const kind of kinds) {
    const data = frameData(kind);
    if (!data) {
      const key = idleKey(kind);
      if (!scene.textures.exists(key)) scene.load.image(key, URLS[`../assets/monsters/${kind}/sd_idle.webp`]);
      continue;
    }
    for (const sheet of Object.keys(data.sheets)) {
      const key = keyFor(kind, sheet);
      if (!scene.textures.exists(key)) scene.load.image(key, URLS[`../assets/monsters/${kind}/${sheet.replace('.png', '.webp')}`]);
    }
    if (kind === 'fog-crow' && !scene.textures.exists('monster-fog-afterimage')) {
      scene.load.image('monster-fog-afterimage', URLS['../assets/monsters/fog-crow/afterimage-512.webp']);
    }
    if (kind === 'mist-phantom' && !scene.textures.exists(FADE_KEY)) scene.load.image(FADE_KEY, phantomFadeUrl);
    if (kind === 'waterdrop-mushroom' && !scene.textures.exists('monster-water-shot')) {
      scene.load.image('monster-water-shot', URLS['../assets/monsters/waterdrop-mushroom/projectile.webp']);
    }
  }
}

/** Whole-character artwork with a fixed measured pivot; effects scale the outer container. */
export class MonsterSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  private readonly image: Phaser.GameObjects.Image;
  private readonly sheetData?: FrameData;
  private readonly frames: Map<string, Frame>;
  private readonly scale0: number;
  private direction: Direction8 = 'down';
  private motion: 'idle' | 'walk' = 'idle';
  private elapsed = 0;
  private attackPose?: number;
  /** 서리 딱정벌레가 마지막으로 몸을 돌린 시각(이 스프라이트가 받은 게임 시간 누계) */
  private turnedAt = -Infinity;
  private clock = 0;
  /** 등장·쓰러짐 동작 중이면 그 동작과 시작한 뒤 흐른 시간 */
  private fade?: { motion: FadeMotion; elapsed: number };

  constructor(scene: Phaser.Scene, readonly kind: MonsterKind) {
    super(scene, 0, 0);
    const data = this.sheetData = frameData(kind);
    this.frames = new Map(data?.frames.map(f => [f.name, f]));
    if (!data) {
      this.image = scene.add.image(0, 0, idleKey(kind)).setOrigin(0.5, 1);
      this.scale0 = MONSTERS[kind].height / this.image.height;
      this.image.setScale(this.scale0);
      this.add(this.image);
      return;
    }
    for (const f of data.frames) {
      const texture = scene.textures.get(keyFor(kind, f.sheet));
      const source = data.sheets[f.sheet];
      const sx = texture.getSourceImage().width / source.width;
      const sy = texture.getSourceImage().height / source.height;
      if (!texture.has(f.name)) texture.add(f.name, 0, Math.round(f.x * sx), Math.round(f.y * sy),
        Math.round((f.x + f.w) * sx) - Math.round(f.x * sx), Math.round((f.y + f.h) * sy) - Math.round(f.y * sy));
    }
    const idleHeight = Math.max(...data.frames.filter(f => f.animation === 'walk' && f.pose === 0).map(f => f.h * f.scale));
    this.scale0 = MONSTERS[kind].height / idleHeight;
    this.image = scene.add.image(0, 0, keyFor(kind, 'walk_cardinal.png'));
    // 나방은 땅에서 조금 떠서 난다. 그림자는 바닥(컨테이너 원점)에 그대로 남는다.
    if (kind === 'ashen-moth') this.image.setY(-28);
    if (kind === 'fog-crow') this.image.setY(-12);
    this.add(this.image);
    if (kind === 'mist-phantom') {
      const texture = scene.textures.get(FADE_KEY);
      phantomFade.frames.forEach((name, i) => {
        if (!texture.has(name)) texture.add(name, 0, i * phantomFade.cell, 0, phantomFade.cell, phantomFade.cell);
      });
    }
    this.showFrame();
  }

  /** 등장·쓰러짐 그림이 있는 종류인지 (안개 환영) */
  get hasFade(): boolean { return this.kind === 'mist-phantom' && this.scene.textures.exists(FADE_KEY); }
  /** 등장 동작을 하는 중인지 (그동안 적은 움직이지 않는다) */
  get materializing(): boolean { return this.fade?.motion === 'materialize'; }

  /** 등장·쓰러짐 동작을 처음부터 보여 준다. 쓰러짐은 마지막 칸(거의 흩어진 안개)에서 멈춘다. */
  playFade(motion: FadeMotion): void {
    if (!this.hasFade) return;
    this.fade = { motion, elapsed: 0 };
    this.showFrame();
  }

  play(key: string): this {
    // 다시 살아나면(revive) 흩어진 그림을 지운다. 등장 동작은 끝까지 보여 준다.
    if (this.fade?.motion === 'dissipate') this.fade = undefined;
    this.motion = key.endsWith('-walk') ? 'walk' : 'idle';
    this.elapsed = 0;
    this.attackPose = undefined;
    this.showFrame();
    return this;
  }
  setMovement(dx: number, dy: number): void {
    const wanted = direction8(dx, dy, this.direction);
    // 서리 딱정벌레는 무거워서 한 번에 8방향 한 칸씩, 천천히 몸을 돌린다(등 뒤를 잡을 틈).
    if (this.kind === 'frost-beetle' && wanted !== this.direction) {
      if (this.clock - this.turnedAt < FROST_SHELL.turnMs) return;
      this.turnedAt = this.clock;
      const order: Direction8[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
      const from = order.indexOf(this.direction), to = order.indexOf(wanted);
      const step = ((to - from + 8) % 8) <= 4 ? 1 : -1;
      this.direction = order[(from + step + 8) % 8];
    } else this.direction = wanted;
    if (!this.sheetData && (wanted.endsWith('left') || wanted.endsWith('right'))) {
      this.image.setFlipX(wanted.endsWith('left'));
    }
    this.showFrame();
  }
  /** 바라보는 방향 (화면 좌표의 단위 벡터에 가까운 값) */
  facingVector(): { x: number; y: number } {
    const v: Record<Direction8, [number, number]> = {
      right: [1, 0], 'down-right': [0.707, 0.707], down: [0, 1], 'down-left': [-0.707, 0.707],
      left: [-1, 0], 'up-left': [-0.707, -0.707], up: [0, -1], 'up-right': [0.707, -0.707],
    };
    const [x, y] = v[this.direction];
    return { x, y };
  }

  swampMouthOffset(): { x: number; y: number } {
    const [x, y] = SWAMP_MOUTH[this.direction];
    const scale = this.scale0 * this.frames.get(`attack-${this.direction}-2`)!.scale;
    return { x: x * scale, y: y * scale };
  }
  // Character.face is horizontal compatibility; real direction comes from setMovement.
  setFlipX(_flip: boolean): this { return this; }
  setTint(color: number): this { this.image.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { this.image.setTintMode(mode); return this; }
  clearTint(): this { this.image.clearTint(); return this; }
  advance(deltaMs: number): void {
    this.elapsed += deltaMs * this.anims.timeScale;
    this.clock += deltaMs;
    if (this.fade) {
      this.fade.elapsed += deltaMs;
      // 등장이 끝나면 평소 그림으로 돌아간다.
      if (this.fade.motion === 'materialize' && this.fade.elapsed >= FADE_FRAME_MS.materialize * 4) this.fade = undefined;
    }
    this.showFrame();
  }
  showAttack(elapsed: number, windup: number, strike: number, recovery: number): void {
    this.attackPose = elapsed < windup ? 1 : elapsed < windup + strike ? 2 : elapsed < windup + strike + recovery ? 3 : undefined;
    this.showFrame();
  }
  endStrike(): void { this.attackPose = undefined; this.showFrame(); }

  /** A visual decoy only: no Character, HP, collision or ground shadow. */
  createAfterimage(x: number, y: number): Phaser.GameObjects.Image {
    if (this.direction === 'down-right') {
      return this.scene.add.image(x, y + this.image.y, 'monster-fog-afterimage').setOrigin(0.5, 0.85)
        .setDisplaySize(MONSTERS[this.kind].height * 1.8, MONSTERS[this.kind].height * 1.2).setDepth(y);
    }
    return this.scene.add.image(x + this.image.x, y + this.image.y, this.image.texture.key, this.image.frame.name)
      .setOrigin(this.image.originX, this.image.originY).setScale(this.image.scaleX, this.image.scaleY)
      .setTint(0xbacbe0).setDepth(y);
  }

  private showFrame(): void {
    if (!this.sheetData) return;
    if (this.fade) { this.showFade(this.fade.motion, this.fade.elapsed); return; }
    const flight = this.kind === 'fog-crow';
    const cycle = this.sheetData.animations?.walk;
    const poses = flight ? (cycle?.poses ?? [0, 1, 2, 3]) : [1, 2, 3, 2];
    const animate = this.motion === 'walk' || flight;
    const fps = flight ? (cycle?.fps ?? 10) : 8;
    const pose = this.attackPose ?? (animate ? poses[Math.floor(this.elapsed * fps / 1000) % poses.length] : 0);
    const f = this.frames.get(`${this.attackPose === undefined ? 'walk' : 'attack'}-${this.direction}-${pose}`)
      ?? this.frames.get(`walk-${this.direction}-${pose}`)!;
    const texture = this.scene.textures.get(keyFor(this.kind, f.sheet));
    const source = this.sheetData.sheets[f.sheet];
    const sx = texture.getSourceImage().width / source.width, sy = texture.getSourceImage().height / source.height;
    this.image.setTexture(texture.key, f.name).setOrigin(f.originX, f.originY)
      .setScale(this.scale0 * f.scale / sx, this.scale0 * f.scale / sy).setFlipX(false);
  }

  /** 온몸이 보이는 칸을 걷기 그림의 오른쪽 아래 정지 자세와 같은 높이로 그린다. 왼쪽을 보면 뒤집는다. */
  private showFade(motion: FadeMotion, elapsed: number): void {
    const index = Math.min(3, Math.floor(elapsed / FADE_FRAME_MS[motion]));
    const idle = this.frames.get('walk-down-right-0')!;
    const scale = this.scale0 * idle.h * idle.scale / phantomFade.bodyHeight;
    this.image.setTexture(FADE_KEY, `${motion}-${index}`).setOrigin(phantomFade.originX, phantomFade.originY)
      .setScale(scale).setFlipX(this.direction.endsWith('left'));
  }
}
