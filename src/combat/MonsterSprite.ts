import Phaser from 'phaser';
import { FROST_SHELL, MONSTERS, monsterKind, type EnemyKey, type MonsterKind } from './monsterTypes';
import { direction8, type Direction8 } from '../world/npcs';

interface Frame {
  name: string; animation: string; direction: string; pose: number; sheet: string;
  x: number; y: number; w: number; h: number; originX: number; originY: number; scale: number;
}
interface FrameData { animations?: { walk: { fps: number; poses: number[] } }; frames: Frame[]; bounds: { top: number; bottom: number }; sheets: Record<string, { width: number; height: number }> }
const DATA = import.meta.glob<FrameData>('../assets/monsters/*/animation_frames.json', { eager: true, import: 'default' });
const URLS = import.meta.glob<string>('../assets/monsters/*/*.webp', { eager: true, query: '?url', import: 'default' });
const keyFor = (kind: MonsterKind, sheet: string) => `monster-${kind}-${sheet.replace('.png', '')}`;
const frameData = (kind: MonsterKind) => DATA[`../assets/monsters/${kind}/animation_frames.json`];

/** Load only species that inhabit the current map; textures are reused on revisits. */
export function preloadMonsters(scene: Phaser.Scene, spawns: readonly { key: EnemyKey }[]): void {
  const kinds = new Set(spawns.map(s => monsterKind(s.key)).filter((k): k is MonsterKind => !!k));
  for (const kind of kinds) {
    for (const sheet of Object.keys(frameData(kind).sheets)) {
      const key = keyFor(kind, sheet);
      if (!scene.textures.exists(key)) scene.load.image(key, URLS[`../assets/monsters/${kind}/${sheet.replace('.png', '.webp')}`]);
    }
    if (kind === 'fog-crow' && !scene.textures.exists('monster-fog-afterimage')) {
      scene.load.image('monster-fog-afterimage', URLS['../assets/monsters/fog-crow/afterimage-512.webp']);
    }
    if (kind === 'waterdrop-mushroom' && !scene.textures.exists('monster-water-shot')) {
      scene.load.image('monster-water-shot', URLS['../assets/monsters/waterdrop-mushroom/projectile.webp']);
    }
  }
}

/** Whole-character artwork with a fixed measured pivot; effects scale the outer container. */
export class MonsterSprite extends Phaser.GameObjects.Container {
  readonly anims = { timeScale: 1 };
  private readonly image: Phaser.GameObjects.Image;
  private readonly frames: Map<string, Frame>;
  private readonly scale0: number;
  private direction: Direction8 = 'down';
  private motion: 'idle' | 'walk' = 'idle';
  private elapsed = 0;
  private attackPose?: number;
  /** 서리 딱정벌레가 마지막으로 몸을 돌린 시각(이 스프라이트가 받은 게임 시간 누계) */
  private turnedAt = -Infinity;
  private clock = 0;

  constructor(scene: Phaser.Scene, readonly kind: MonsterKind) {
    super(scene, 0, 0);
    const data = frameData(kind);
    this.frames = new Map(data.frames.map(f => [f.name, f]));
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
    this.showFrame();
  }

  play(key: string): this {
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
  // Character.face is horizontal compatibility; real direction comes from setMovement.
  setFlipX(_flip: boolean): this { return this; }
  setTint(color: number): this { this.image.setTint(color); return this; }
  setTintMode(mode: Phaser.TintModes): this { this.image.setTintMode(mode); return this; }
  clearTint(): this { this.image.clearTint(); return this; }
  advance(deltaMs: number): void { this.elapsed += deltaMs * this.anims.timeScale; this.clock += deltaMs; this.showFrame(); }
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
    const flight = this.kind === 'fog-crow';
    const cycle = frameData(this.kind).animations?.walk;
    const poses = flight ? (cycle?.poses ?? [0, 1, 2, 3]) : [1, 2, 3, 2];
    const animate = this.motion === 'walk' || flight;
    const fps = flight ? (cycle?.fps ?? 10) : 8;
    const pose = this.attackPose ?? (animate ? poses[Math.floor(this.elapsed * fps / 1000) % poses.length] : 0);
    // 공격 그림이 없는 종류(잿빛 나방)는 같은 자세의 이동(날갯짓) 그림으로 공격한다.
    const f = this.frames.get(`${this.attackPose === undefined ? 'walk' : 'attack'}-${this.direction}-${pose}`)
      ?? this.frames.get(`walk-${this.direction}-${pose}`)!;
    const texture = this.scene.textures.get(keyFor(this.kind, f.sheet));
    const source = frameData(this.kind).sheets[f.sheet];
    const sx = texture.getSourceImage().width / source.width, sy = texture.getSourceImage().height / source.height;
    this.image.setTexture(texture.key, f.name).setOrigin(f.originX, f.originY)
      .setScale(this.scale0 * f.scale / sx, this.scale0 * f.scale / sy);
  }
}
