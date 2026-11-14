import Phaser from 'phaser';
import { bladeHitsEllipse, type Blade } from '../combat/blade';
import { BladeTrail } from '../combat/BladeTrail';
import { Enemy } from '../combat/Enemy';
import {
  DEPTH_LIGHTING,
  DEPTH_UI,
  DODGE,
  ENEMY,
  FLOOR_TOP,
  KNOCKBACK_DAMPING,
  PLAYER,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config';
import { dodgeProgress, lungeProgress, locomotionRate } from '../entities/movement';
import { Character } from '../entities/Character';
import { ActionButton } from '../ui/ActionButton';
import { DamageNumbers } from '../ui/DamageNumbers';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HERO_RIG_HEIGHT, HeroRig, preloadHeroRig } from '../entities/HeroRig';
import { createPlaceholderArt } from '../world/placeholderArt';
import { WalkArea } from '../world/walkArea';

/** 화면 왼쪽 위 체력 막대 */
const HUD = { x: 44, y: 26, width: 300, height: 26 };
/** 뼈대 캐릭터(키 400)를 화면에 그릴 때의 배율 */
const HERO_SCALE = 0.5;
const PLAYER_SPAWN = { x: 1180, y: 620 };
const COUNTER = { left: 900, right: 1460, front: 505 };
const TABLES = [
  { x: 520, y: 600 },
  { x: 1900, y: 610 },
];

export class GameScene extends Phaser.Scene {
  private player!: Character;
  private joystick!: VirtualJoystick;
  private walkArea!: WalkArea;
  private attackButton!: ActionButton;
  private enemies: Enemy[] = [];
  private attackKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 게임 시계(ms). update()에서만 흐른다. */
  private now = 0;
  private attackTrace?: { startedAt: number; stage: number; previous: Blade; elapsed: number; hit: Set<Enemy> };
  private nextAttackAt = 0;
  private attackLunge?: { startedAt: number; stage: number; facing: number; progress: number };
  private comboStage = 0;
  private comboExpiresAt = 0;
  private dodgeButton!: ActionButton;
  private dodgeKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 회피 중일 때만 있다. progress는 지금까지 이동한 비율(0~1). */
  private dodge?: { startedAt: number; progress: number };
  private dodgeReadyAt = 0;
  private nextGhostAt = 0;
  private readonly dodgeDirection = new Phaser.Math.Vector2();
  private damageNumbers!: DamageNumbers;
  private bladeTrail!: BladeTrail;
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
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

  /**
   * 씬이 시작될 때마다(재시작 포함) 불린다.
   * 클래스 필드 초기값은 처음 한 번만 적용되므로, 한 판 동안 바뀌는 상태는 여기서 되돌린다.
   */
  init(): void {
    this.enemies = [];
    this.now = 0;
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.nextAttackAt = 0;
    this.comboStage = 0;
    this.comboExpiresAt = 0;
    this.dodge = undefined;
    this.dodgeReadyAt = 0;
    this.nextGhostAt = 0;
    this.hint = undefined;
  }

  preload(): void {
    preloadHeroRig(this);
  }

  create(): void {
    createPlaceholderArt(this);
    this.buildRoom();
    this.buildWalkArea();
    this.buildCharacters();
    this.buildLighting();
    this.buildUi();
    this.damageNumbers = new DamageNumbers(this);
    this.bladeTrail = new BladeTrail(this);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();

    if (new URLSearchParams(location.search).has('debug')) this.drawDebug();
  }

  update(_time: number, delta: number): void {
    // 게임 안의 모든 시간 계산은 이 시계 하나만 쓴다.
    // 프레임이 끊겨도 이동 거리와 타이밍이 서로 어긋나지 않게 하기 위해서다.
    const step = Math.min(delta, 50);
    this.now += step;
    const time = this.now;
    const dt = step / 1000;

    this.updateAttackLunge(time);
    this.updatePlayer(time, dt);
    this.updateAttackTrace(time);
    for (const enemy of this.enemies) {
      enemy.update(time, dt, this.player, this.walkArea, this.onEnemyStrike);
      this.applyKnockback(enemy.character, dt);
    }
    this.applyKnockback(this.player, dt);
    this.bladeTrail.update(step);
    this.damageNumbers.update(step);
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

    const slimes: Array<[string, number, number]> = [
      ['slime-green', 760, 665],
      ['slime-blue', 1680, 560],
      ['slime-green', 1720, 670],
      ['slime-blue', 2180, 560],
    ];
    for (const [key, x, y] of slimes) this.enemies.push(new Enemy(this, key, x, y));

    this.player = new Character(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, {
      key: 'hero',
      name: '용사',
      level: 1,
      rig: true,
      scale: HERO_SCALE,
      labelOffset: HERO_RIG_HEIGHT * HERO_SCALE + 8,
      shadowWidth: 110,
      maxHp: PLAYER.maxHp,
    });
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

    this.attackButton = new ActionButton(this, { x: 0, y: VIEW_HEIGHT - 170, label: '공격' });
    this.dodgeButton = new ActionButton(this, {
      x: 0,
      y: VIEW_HEIGHT - 95,
      radius: 56,
      label: '회피',
      color: 0x2f4a86,
      fontSize: 24,
    });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.attackKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      ];
      this.dodgeKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      ];
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
      .text(0, 18, '프로토타입 v0.10', { fontFamily: font, fontSize: '18px', color: '#e9d7b0' })
      .setOrigin(1, 0)
      .setAlpha(0.7)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2);

    this.hint = this.add
      .text(0, 90, '왼쪽 패드로 이동, 오른쪽 버튼으로 공격과 회피', {
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

    this.hud = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_UI);
    this.hudText = this.add
      .text(HUD.x + 10, HUD.y + HUD.height / 2, '', {
        fontFamily: font,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 1)
      .setResolution(2);
    this.drawHud();
  }

  private drawHud(): void {
    const { x, y, width, height } = HUD;
    const ratio = this.player.hp / this.player.maxHp;
    this.hud.clear();
    this.hud.fillStyle(0x1a1008, 0.85);
    this.hud.fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 9);
    this.hud.fillStyle(0x3a1512);
    this.hud.fillRoundedRect(x, y, width, height, 7);
    if (ratio > 0) {
      this.hud.fillStyle(ratio > 0.3 ? 0xc8443a : 0xe07a2e);
      this.hud.fillRoundedRect(x, y, Math.max(14, width * ratio), height, 7);
    }
    this.hudText.setText(`HP ${this.player.hp} / ${this.player.maxHp}`);
  }

  /** 화면 너비가 바뀔 때(회전, 창 크기 변경) 화면에 고정된 요소를 다시 배치한다. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.dim.setSize(width, height);
    this.vignette.setDisplaySize(width, height);
    this.badge.setX(width - 22);
    this.attackButton.setPosition(width - 170, VIEW_HEIGHT - 185);
    this.dodgeButton.setPosition(width - 330, VIEW_HEIGHT - 105);
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

  private updatePlayer(time: number, dt: number): void {
    const player = this.player;

    // 회피 입력은 매 프레임 빠짐없이 읽어서 비운다. 쓰러졌거나 회피 중일 때 누른 입력이
    // 남아 있다가 나중에 발동하지 않게 하기 위해서다. (버튼과 모든 키를 다 확인해야 한다)
    let dodgePressed = this.dodgeButton.consumePress();
    for (const key of this.dodgeKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) dodgePressed = true;
    }
    if (!player.alive) return;

    const v = this.readInput();
    const force = v.length();
    this.dodgeButton.setEnabled(time >= this.dodgeReadyAt);

    if (this.dodge) {
      this.updateDodge(time);
      if (this.dodge) return;
    }
    player.setDodging(false);

    if (dodgePressed && time >= this.dodgeReadyAt) {
      this.startDodge(time, v);
      return;
    }

    // 초 단위 애니메이션과 밀리초 시계의 부동소수점 오차로 한 프레임 쉬지 않게 한다.
    if (this.wantsAttack() && time + 1e-6 >= this.nextAttackAt) this.startAttack(time, v.x);

    const fromX = player.x;
    const fromY = player.y;
    if (force > 0) {
      const speed = PLAYER_SPEED * (player.isAttacking ? PLAYER.attackMoveRatio : 1);
      const next = this.walkArea.move(
        player.x,
        player.y,
        v.x * speed * dt,
        v.y * speed * VERTICAL_SPEED_RATIO * dt,
        this.scratch,
      );
      player.placeAt(next.x, next.y);
      this.dismissHint();
    }
    const rate = locomotionRate(player.x - fromX, player.y - fromY, dt, PLAYER_SPEED);
    player.setMotion(rate > 0, v.x, rate);
  }

  private dismissHint(): void {
    const hint = this.hint;
    if (!hint) return;
    this.hint = undefined;
    this.tweens.add({ targets: hint, alpha: 0, duration: 500, onComplete: () => hint.destroy() });
  }

  /** 밀려남을 적용하고 서서히 줄인다. 벽은 통과하지 못한다. */
  private applyKnockback(character: Character, dt: number): void {
    const k = character.knockback;
    if (k.lengthSq() < 4) {
      k.set(0, 0);
      return;
    }
    if (character.alive) {
      const next = this.walkArea.move(character.x, character.y, k.x * dt, k.y * dt, this.scratch);
      character.placeAt(next.x, next.y);
    }
    k.scale(Math.max(0, 1 - KNOCKBACK_DAMPING * dt));
  }

  // ---------------------------------------------------------------- 전투

  private wantsAttack(): boolean {
    return this.attackButton.isDown || this.attackKeys.some((key) => key.isDown);
  }

  /** 회피 시작. 조이스틱 방향으로, 입력이 없으면 바라보는 쪽으로 미끄러진다. */
  private startDodge(time: number, input: Phaser.Math.Vector2): void {
    const player = this.player;
    this.dismissHint();
    player.endAttack();
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.comboStage = 0;

    if (input.lengthSq() > 0.04) {
      this.dodgeDirection.copy(input).normalize();
      player.face(input.x);
    } else {
      this.dodgeDirection.set(player.facing, 0);
    }

    const endsAt = time + DODGE.durationMs;
    this.dodge = { startedAt: time, progress: 0 };
    this.dodgeReadyAt = time + DODGE.cooldownMs;
    this.nextAttackAt = Math.max(this.nextAttackAt, endsAt);
    this.nextGhostAt = 0;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, endsAt + DODGE.graceMs);
    player.knockback.set(0, 0);
    player.setDodging(true);
    this.dodgeButton.setEnabled(false);
  }

  /** 진행도의 차이만큼 이동해 프레임 속도와 관계없이 같은 거리를 간다. */
  private updateDodge(time: number): void {
    const dodge = this.dodge;
    if (!dodge) return;
    const player = this.player;
    const progress = dodgeProgress(time - dodge.startedAt, DODGE.durationMs);
    const step = (progress - dodge.progress) * DODGE.distance;
    dodge.progress = progress;
    const next = this.walkArea.move(
      player.x,
      player.y,
      this.dodgeDirection.x * step,
      this.dodgeDirection.y * step * VERTICAL_SPEED_RATIO,
      this.scratch,
    );
    player.placeAt(next.x, next.y);
    if (progress >= 1) this.dodge = undefined;

    if (time >= this.nextGhostAt) {
      this.nextGhostAt = time + 45;
      const sprite = player.sprite;
      if (sprite instanceof HeroRig) {
        sprite.spawnGhost(player.x, player.y, player.y - 1, 0x9fc4ff, 0.35);
      } else {
        const ghost = this.add
          .image(player.x, player.y, sprite.texture.key, sprite.frame.name)
          .setOrigin(0.5, 1)
          .setFlipX(sprite.flipX)
          .setScale(sprite.scaleX, sprite.scaleY)
          .setAngle(sprite.angle)
          .setTint(0x9fc4ff)
          .setAlpha(0.4)
          .setDepth(player.y - 1);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      }
    }
  }

  private startAttack(time: number, inputX: number): void {
    const player = this.player;
    if (time > this.comboExpiresAt) this.comboStage = 0;
    const stage = this.comboStage;
    const combo = PLAYER.combo[stage];
    this.nextAttackAt = time + combo.intervalMs;
    this.comboExpiresAt = this.nextAttackAt + PLAYER.comboWindowMs;
    this.comboStage = (stage + 1) % PLAYER.combo.length;
    this.dismissHint();

    // 방향 입력이 있으면 그쪽으로, 없으면 가까운 적 쪽으로 돌아선다.
    if (Math.abs(inputX) > 0.25) {
      player.face(inputX);
    } else {
      let nearest = PLAYER.autoFaceRange;
      for (const enemy of this.enemies) {
        const c = enemy.character;
        if (!c.alive || Math.abs(c.y - player.y) > PLAYER.attackLane * 1.6) continue;
        const distance = Math.abs(c.x - player.x);
        if (distance < nearest) {
          nearest = distance;
          player.face(c.x - player.x);
        }
      }
    }

    player.playAttack(stage + 1);
    this.attackLunge = { startedAt: time, stage, facing: player.facing, progress: 0 };
    const rig = player.sprite;
    if (rig instanceof HeroRig) {
      this.attackTrace = { startedAt: time, stage, previous: rig.getBlade(), elapsed: 0, hit: new Set() };
    }
  }

  /** 전진 진행도의 차이를 적용해 프레임 속도와 관계없이 같은 거리를 이동한다. */
  private updateAttackLunge(time: number): void {
    const lunge = this.attackLunge;
    if (!lunge) return;
    if (!this.player.alive || !this.player.isAttacking) {
      this.attackLunge = undefined;
      return;
    }
    const combo = PLAYER.combo[lunge.stage];
    const progress = lungeProgress(time - lunge.startedAt, combo.lungeStartMs, combo.lungeEndMs);
    const dx = (progress - lunge.progress) * combo.lungeDistance * lunge.facing;
    lunge.progress = progress;
    const next = this.walkArea.move(this.player.x, this.player.y, dx, 0, this.scratch);
    this.player.placeAt(next.x, next.y);
    if (progress === 1) this.attackLunge = undefined;
  }

  /** 시각 효과와 명중 판정이 같은 검날 좌표를 사용한다. 적마다 한 공격에 한 번만 맞는다. */
  private updateAttackTrace(time: number): void {
    const trace = this.attackTrace;
    const player = this.player;
    const rig = player.sprite;
    if (!trace) return;
    if (!player.alive || !player.isAttacking || !(rig instanceof HeroRig)) {
      this.attackTrace = undefined;
      return;
    }
    const combo = PLAYER.combo[trace.stage];
    const elapsed = time - trace.startedAt;
    const current = rig.getBlade();
    const previous = trace.previous;
    trace.previous = current;
    const lastElapsed = trace.elapsed;
    trace.elapsed = elapsed;
    if (elapsed < combo.hitDelayMs) return;
    if (lastElapsed >= combo.hitDelayMs + PLAYER.hitWindowMs) {
      this.attackTrace = undefined;
      return;
    }
    const finisher = trace.stage === PLAYER.combo.length - 1;
    this.bladeTrail.add(previous, current, finisher, player.y + 2);

    let hitAny = false;
    for (const enemy of this.enemies) {
      const c = enemy.character;
      if (!c.alive || trace.hit.has(enemy)) continue;
      // 높이 방향의 레인을 유지해 화면상 겹쳐 보이는 다른 줄의 적을 치지 않는다.
      if (Math.abs(c.y - player.y) > PLAYER.attackLane) continue;
      const bounds = c.sprite.getBounds();
      if (!bladeHitsEllipse(previous, current, { x: bounds.centerX, y: bounds.centerY },
        bounds.width * 0.42 + PLAYER.bladeRadius, bounds.height * 0.42 + PLAYER.bladeRadius)) continue;
      trace.hit.add(enemy);

      hitAny = true;
      const damage = Math.round(Phaser.Math.Between(PLAYER.damageMin, PLAYER.damageMax) * combo.damage);
      const died = c.hurt(damage);
      this.damageNumbers.show(c.x, c.y - 100, damage, finisher ? 0xffb35a : 0xfff3c4, finisher ? 46 : 34);
      if (died) {
        enemy.kill();
        this.time.delayedCall(ENEMY.respawnMs, () => this.respawnEnemy(enemy));
      } else {
        c.knockback.set(player.facing * PLAYER.knockback * combo.knockback, 0);
        enemy.interrupt(this.now);
      }
    }
    if (hitAny) this.cameras.main.shake(finisher ? 130 : 70, finisher ? 0.009 : 0.004);
  }

  /** 몬스터의 돌진이 닿는 순간. 화살표 함수라서 콜백으로 그대로 넘길 수 있다. */
  private readonly onEnemyStrike = (enemy: Enemy): void => {
    const player = this.player;
    const c = enemy.character;
    const now = this.now;
    if (!player.alive || now < player.invulnerableUntil) return;

    const forward = (player.x - c.x) * c.facing;
    if (forward < -20 || forward > ENEMY.strikeRangeX) return;
    if (Math.abs(player.y - c.y) > ENEMY.strikeRangeY) return;

    player.invulnerableUntil = now + PLAYER.invulnerableMs;
    const died = player.hurt(ENEMY.damage, 0xff5a4a);
    player.knockback.set(c.facing * ENEMY.knockback, 0);
    this.damageNumbers.show(player.x, player.y - 190, ENEMY.damage, 0xff8a7a);
    this.cameras.main.shake(110, 0.007);
    this.drawHud();
    if (died) this.onPlayerDeath();
  };

  private onPlayerDeath(): void {
    const player = this.player;
    player.playDeath();

    const { width } = this.scale.gameSize;
    const message = this.add
      .text(width / 2, VIEW_HEIGHT / 2 - 40, '쓰러졌습니다', {
        fontFamily: 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        fontSize: '54px',
        fontStyle: 'bold',
        color: '#f5ead2',
        stroke: '#1a1008',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI + 5)
      .setResolution(2)
      .setAlpha(0);
    this.tweens.add({ targets: message, alpha: 1, duration: 300 });

    this.time.delayedCall(PLAYER.respawnMs, () => {
      message.destroy();
      player.revive(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
      player.invulnerableUntil = this.now + 1500;
      this.drawHud();
    });
  }

  private respawnEnemy(enemy: Enemy): void {
    // 플레이어 바로 옆에서 다시 나타나지 않게 한다.
    const point = this.scratch;
    for (let i = 0; i < 20; i++) {
      this.walkArea.randomPoint(point);
      if (Math.abs(point.x - this.player.x) > ENEMY.aggroX + 80) break;
    }
    enemy.respawn(point.x, point.y);
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
