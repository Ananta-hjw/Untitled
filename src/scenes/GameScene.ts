import Phaser from 'phaser';
import {
  DEPTH_LIGHTING,
  DEPTH_UI,
  FLOOR_TOP,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config';
import { Character } from '../entities/Character';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { createPlaceholderArt } from '../world/placeholderArt';
import { WalkArea } from '../world/walkArea';

interface Wanderer {
  character: Character;
  target: Phaser.Math.Vector2;
  speed: number;
  waitUntil: number;
}

const COUNTER = { left: 900, right: 1460, front: 505 };
const TABLES = [
  { x: 520, y: 600 },
  { x: 1900, y: 610 },
];

export class GameScene extends Phaser.Scene {
  private player!: Character;
  private joystick!: VirtualJoystick;
  private walkArea!: WalkArea;
  private wanderers: Wanderer[] = [];
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private readonly input2 = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();
  private vignette!: Phaser.GameObjects.Image;
  private dim!: Phaser.GameObjects.Rectangle;
  private hint?: Phaser.GameObjects.Text;
  private badge!: Phaser.GameObjects.Text;

  constructor() {
    super('game');
  }

  create(): void {
    createPlaceholderArt(this);
    this.buildRoom();
    this.buildWalkArea();
    this.buildCharacters();
    this.buildLighting();
    this.buildUi();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();

    if (new URLSearchParams(location.search).has('debug')) this.drawDebug();
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.updatePlayer(dt);
    this.updateWanderers(time, dt);
  }

  // ---------------------------------------------------------------- 월드

  private buildRoom(): void {
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'room').setOrigin(0).setDepth(-100);

    // 벽 장식 (걸어다니는 것들보다 항상 뒤)
    for (const x of [300, 1180, 2080]) this.add.image(x, 170, 'prop-window').setDepth(-50);
    for (const x of [700, 1640]) this.add.image(x, 200, 'prop-shelf').setDepth(-50);
    this.add.image(1180, 330, 'prop-shelf').setDepth(-49);

    // 바닥에 놓인 것들: 원점을 "바닥 접점"에 두고 깊이를 y로 준다.
    const grounded = (x: number, y: number, key: string) =>
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);

    for (const [x, y] of [
      [90, 440],
      [180, 432],
      [2250, 436],
      [2330, 446],
    ]) {
      grounded(x, y, 'prop-barrel');
    }

    grounded((COUNTER.left + COUNTER.right) / 2, COUNTER.front, 'prop-counter');
    this.addCandle(COUNTER.left + 70, COUNTER.front - 148, COUNTER.front + 1);
    this.addCandle(COUNTER.right - 70, COUNTER.front - 148, COUNTER.front + 1);

    for (const table of TABLES) {
      grounded(table.x, table.y, 'prop-table');
      this.addCandle(table.x + 10, table.y - 116, table.y + 1);
      grounded(table.x - 165, table.y - 6, 'prop-stool');
      grounded(table.x + 165, table.y + 14, 'prop-stool');
    }
  }

  private addCandle(x: number, y: number, depth: number): void {
    this.add.image(x, y, 'prop-candle').setOrigin(0.5, 1).setDepth(depth);
    const glow = this.add
      .image(x, y - 40, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_LIGHTING + 1)
      .setScale(1.6);
    this.tweens.add({
      targets: glow,
      scale: { from: 1.5, to: 1.75 },
      alpha: { from: 0.8, to: 1 },
      duration: Phaser.Math.Between(260, 420),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildWalkArea(): void {
    const top = FLOOR_TOP + 40;
    this.walkArea = new WalkArea(
      [
        // 왼쪽 위에서 시계 방향. 가운데가 움푹한 부분은 바 카운터 자리.
        250, top,
        COUNTER.left - 20, top,
        COUNTER.left - 20, COUNTER.front + 12,
        COUNTER.right + 20, COUNTER.front + 12,
        COUNTER.right + 20, top,
        2190, top,
        2370, 470,
        2385, VIEW_HEIGHT - 14,
        15, VIEW_HEIGHT - 14,
        30, 470,
      ],
      TABLES.map((t) => ({ x: t.x, y: t.y - 8, rx: 130, ry: 42 })),
    );
  }

  private buildCharacters(): void {
    // 서 있는 NPC들
    new Character(this, 1180, COUNTER.front - 70, { key: 'keeper', name: '주인장' });
    new Character(this, 360, 590, { key: 'mage', name: '마법사', level: 21 });
    new Character(this, 690, 615, { key: 'bard', name: '음유시인', level: 24 }).sprite.setFlipX(true);
    new Character(this, 2060, 640, { key: 'archer', name: '궁수', level: 25 }).sprite.setFlipX(true);

    // 돌아다니는 몬스터 (Y정렬 확인용)
    const slimes: Array<[string, number, number]> = [
      ['slime-green', 1000, 640],
      ['slime-blue', 1500, 600],
      ['slime-green', 1750, 520],
    ];
    for (const [key, x, y] of slimes) {
      this.wanderers.push({
        character: new Character(this, x, y, { key, shadowWidth: 100 }),
        target: new Phaser.Math.Vector2(x, y),
        speed: Phaser.Math.Between(50, 85),
        waitUntil: Phaser.Math.Between(300, 1800),
      });
    }

    this.player = new Character(this, 1180, 620, { key: 'hero', name: '용사', level: 1 });
  }

  private buildLighting(): void {
    this.dim = this.add
      .rectangle(0, 0, 10, 10, 0x140a04, 0.22)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH_LIGHTING);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH_LIGHTING + 2);
  }

  // ---------------------------------------------------------------- UI

  private buildUi(): void {
    this.input.addPointer(2); // 동시에 3개 터치까지
    this.joystick = new VirtualJoystick(this, { x: 190, y: VIEW_HEIGHT - 170 });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        d: Phaser.Input.Keyboard.KeyCodes.D,
      }) as GameScene['keys'];
    }

    const font = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    this.badge = this.add
      .text(0, 18, '프로토타입 v0.1', { fontFamily: font, fontSize: '18px', color: '#e9d7b0' })
      .setOrigin(1, 0)
      .setAlpha(0.7)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2);

    this.hint = this.add
      .text(0, 90, '왼쪽 아래 패드를 드래그해서 이동하세요', {
        fontFamily: font,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2);
  }

  /** 화면 너비가 바뀔 때(회전, 창 크기 변경) 화면에 고정된 요소를 다시 배치한다. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.dim.setSize(width, height);
    this.vignette.setDisplaySize(width, height);
    this.badge.setX(width - 22);
    this.hint?.setX(width / 2);
  }

  // ---------------------------------------------------------------- 이동

  private readInput(): Phaser.Math.Vector2 {
    const v = this.input2.copy(this.joystick.vector);
    if (v.lengthSq() === 0 && this.keys) {
      const k = this.keys;
      v.set(
        (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
        (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
      );
      if (v.lengthSq() > 1) v.normalize();
    }
    return v;
  }

  private updatePlayer(dt: number): void {
    const v = this.readInput();
    const force = v.length();
    if (force > 0) {
      const next = this.walkArea.move(
        this.player.x,
        this.player.y,
        v.x * PLAYER_SPEED * dt,
        v.y * PLAYER_SPEED * VERTICAL_SPEED_RATIO * dt,
        this.scratch,
      );
      this.player.placeAt(next.x, next.y);

      if (this.hint) {
        const hint = this.hint;
        this.hint = undefined;
        this.tweens.add({ targets: hint, alpha: 0, duration: 500, onComplete: () => hint.destroy() });
      }
    }
    this.player.setMotion(force > 0, v.x, force);
  }

  private updateWanderers(time: number, dt: number): void {
    for (const w of this.wanderers) {
      const c = w.character;
      if (time < w.waitUntil) {
        c.setMotion(false);
        continue;
      }
      const dx = w.target.x - c.x;
      const dy = w.target.y - c.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) {
        this.walkArea.randomPoint(w.target);
        w.waitUntil = time + Phaser.Math.Between(600, 2400);
        continue;
      }
      const step = w.speed * dt;
      const next = this.walkArea.move(c.x, c.y, (dx / distance) * step, (dy / distance) * step, this.scratch);
      if (next.x === c.x && next.y === c.y) {
        // 막혔으면 다른 목적지를 고른다.
        this.walkArea.randomPoint(w.target);
        continue;
      }
      c.placeAt(next.x, next.y);
      c.setMotion(true, dx);
    }
  }

  // ---------------------------------------------------------------- 디버그

  /** 주소 뒤에 ?debug 를 붙이면 이동 가능 영역과 장애물을 표시한다. */
  private drawDebug(): void {
    const g = this.add.graphics().setDepth(DEPTH_LIGHTING + 10);
    g.lineStyle(3, 0x37ff8b, 0.9);
    g.strokePoints(this.walkArea.polygon.points, true);
    g.lineStyle(3, 0xff5a5a, 0.9);
    for (const o of this.walkArea.obstacles) g.strokeEllipse(o.x, o.y, o.rx * 2, o.ry * 2);
  }
}
