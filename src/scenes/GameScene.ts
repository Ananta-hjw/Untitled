import Phaser from 'phaser';
import { bladeHitsEllipse, clipBladeSweep, type Blade } from '../combat/blade';
import { CombatEffects, type AttackEffect } from '../combat/CombatEffects';
import { Enemy } from '../combat/Enemy';
import { isJustDodge, slowMotionScale, strikeReaches } from '../combat/justDodge';
import {
  DEPTH_LIGHTING,
  DODGE,
  JUST_DODGE,
  ENEMY,
  KNOCKBACK_DAMPING,
  PLAYER,
  PROGRESSION,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config';
import { dodgeDistanceRatio, lungeProgress, locomotionRate } from '../entities/movement';
import { Character } from '../entities/Character';
import { addXp, statsForLevel, xpToNext, type LevelStats, type Progress } from '../entities/progression';
import { browserStorage, loadProgress, saveProgress, type SaveStorage } from '../entities/saveData';
import { ActionButton } from '../ui/ActionButton';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HERO_SPRITE_HEIGHT, HeroSprite, preloadHeroSprite } from '../entities/HeroSprite';
import { attackFacingFor, attackVector, insideAttackLane, movementFacing } from '../entities/heroFrames';
import { createPlaceholderArt } from '../world/placeholderArt';
import type { WalkArea } from '../world/walkArea';
import { NavGrid } from '../world/navGrid';
import { buildVillage, preloadVillage, ENEMY_SPAWNS, PLAYER_SPAWN, type Village } from '../world/village';
import { Hud } from '../ui/Hud';
import { DamageNumbers } from '../ui/DamageNumbers';
import { DialogueBox, preloadDialogue } from '../ui/DialogueBox';
import { DIALOGUES } from '../story/dialogues';
import { findInteractable, type Interactable } from '../world/interactables';
import { ProgressEffects } from '../ui/ProgressEffects';

/** Scale shared by all academy frames. */
const HERO_SCALE = 0.5;
const NAV_CELL = 32;

export class GameScene extends Phaser.Scene {
  private player!: Character;
  private effects!: CombatEffects;
  private joystick!: VirtualJoystick;
  private walkArea!: WalkArea;
  private attackButton!: ActionButton;
  private enemies: Enemy[] = [];
  private attackKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 게임 시계(ms). update()에서만 흐른다. */
  private now = 0;
  private enemyRespawns: Array<{ at: number; enemy: Enemy }> = [];
  private playerRespawnAt?: number;
  private deathMessage?: Phaser.GameObjects.Text;
  private attackTrace?: { startedAt: number; stage: number; direction: { x: number; y: number }; previous: Blade; elapsed: number; hit: Set<Enemy>; effect?: AttackEffect; counter: boolean };
  private nextAttackAt = 0;
  private attackBufferedUntil?: number;
  private keyboardAttackPressed = false;
  private attackLunge?: { startedAt: number; stage: number; direction: { x: number; y: number }; progress: number };
  private comboStage = 0;
  private comboExpiresAt = 0;
  private dodgeButton!: ActionButton;
  private dodgeKeys: Phaser.Input.Keyboard.Key[] = [];
  private dodgeUntil = 0;
  private dodgeProgress = 1;
  private dodgeReadyAt = 0;
  /** 이번 회피를 시작한 시각과 위치. 저스트 회피는 "피하지 않았으면 맞았을 자리"로 판정한다. */
  private dodgeStartedAt?: number;
  private readonly dodgeOrigin = { x: 0, y: 0 };
  /** 이번 회피로 이미 저스트 회피가 났는지 (한 번의 회피에 한 번만) */
  private justDodged = false;
  /** 느린 화면이 끝날 때까지 남은 실제 시간(ms) */
  private slowMotionLeft = 0;
  /** 이 시각(게임 시계)까지 시작한 공격 한 번은 반격으로 강해진다 */
  private counterUntil = 0;
  private nextGhostAt = 0;
  private readonly dodgeDirection = new Phaser.Math.Vector2();
  private hud!: Hud;
  private damageNumbers!: DamageNumbers;
  private progressEffects!: ProgressEffects;
  private dialogue!: DialogueBox;
  private talkButton!: ActionButton;
  private talkKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 말풍선 표시. 대화할 수 있는 대상 위에 뜬다. */
  private talkMarker!: Phaser.GameObjects.Text;
  /** 플레이어의 레벨과 경험치. 쓰러져도 잃지 않고, 바뀔 때마다 기기에 저장한다. */
  private progress: Progress = { level: 1, xp: 0 };
  private stats: LevelStats = statsForLevel(1);
  private storage?: SaveStorage;
  private village!: Village;
  private nav!: NavGrid;
  private readonly boundsScratch = new Phaser.Geom.Rectangle();
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private readonly input2 = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();

  constructor() {
    super('game');
  }

  init(): void {
    this.resetState();
    // 저장된 진행 상황이 있으면 그 레벨로 시작한다 (재시작 포함).
    this.storage = browserStorage();
    const saved = loadProgress(this.storage);
    if (saved) {
      this.progress = saved;
      this.stats = statsForLevel(saved.level);
    }
  }

  private resetState(): void {
    this.enemies = [];
    this.attackKeys = [];
    this.dodgeKeys = [];
    this.keys = undefined;
    this.now = 0;
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.nextAttackAt = 0;
    this.attackBufferedUntil = undefined;
    this.keyboardAttackPressed = false;
    this.comboStage = 0;
    this.comboExpiresAt = 0;
    this.dodgeUntil = 0;
    this.dodgeProgress = 1;
    this.dodgeReadyAt = 0;
    this.dodgeStartedAt = undefined;
    this.justDodged = false;
    this.slowMotionLeft = 0;
    this.counterUntil = 0;
    this.nextGhostAt = 0;
    this.dodgeDirection.set(0, 0);
    this.input2.set(0, 0);
    this.scratch.set(0, 0);
    this.enemyRespawns = [];
    this.talkKeys = [];
    this.progress = { level: 1, xp: 0 };
    this.stats = statsForLevel(1);
    this.playerRespawnAt = undefined;
    this.deathMessage = undefined;
  }

  preload(): void {
    preloadHeroSprite(this);
    preloadVillage(this);
    preloadDialogue(this);
  }

  create(): void {
    createPlaceholderArt(this);
    this.village = buildVillage(this);
    this.walkArea = this.village.walkArea;
    const bounds = this.walkArea.bounds;
    this.nav = new NavGrid(bounds.left, bounds.top, bounds.right, bounds.bottom, NAV_CELL,
      (x, y) => this.walkArea.contains(x, y));
    this.buildCharacters();
    this.effects = new CombatEffects(this);
    this.buildUi();
    this.damageNumbers = new DamageNumbers(this);
    this.progressEffects = new ProgressEffects(this);
    this.dialogue = new DialogueBox(this);
    this.talkMarker = this.add
      .text(0, 0, '···', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#1a1008',
        backgroundColor: '#f5ead2',
        padding: { x: 10, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_LIGHTING + 4)
      .setResolution(2)
      .setVisible(false);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 170);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.clearAttackInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.clearAttackInput, this);
      this.resetState();
    });
    this.layout();

    if (new URLSearchParams(location.search).has('debug')) this.drawDebug();
  }

  update(_time: number, delta: number): void {
    // 게임 안의 모든 시간 계산은 이 시계 하나만 쓴다.
    // 프레임이 끊겨도 이동 거리와 타이밍이 서로 어긋나지 않게 하기 위해서다.
    const step = Math.min(delta, 50);

    // 대화 중에는 게임 시계를 멈춘다. 적·타이머·부활이 모두 그대로 기다린다.
    if (this.dialogue.isOpen) {
      this.dialogue.update(step);
      // 대화 키(E·Enter)와 공격 키(Space·J) 모두 넘기기로 쓴다.
      let advance = this.talkPressed();
      for (const key of this.attackKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) advance = true;
      }
      if (advance) this.dialogue.advance();
      return;
    }

    // 저스트 회피 뒤에는 잠깐 게임 시간이 느리게 흐른다. 적·플레이어·타이머가 모두 같이 느려진다.
    const scale = slowMotionScale(this.slowMotionLeft, JUST_DODGE.slowScale, JUST_DODGE.rampMs);
    this.slowMotionLeft = Math.max(0, this.slowMotionLeft - step);
    this.hud.setSlowMotion((1 - scale) / (1 - JUST_DODGE.slowScale));
    const gameStep = step * scale;

    this.now += gameStep;
    const time = this.now;
    const dt = gameStep / 1000;

    this.effects.update(time);
    this.updateRespawns(time);
    this.updateAttackLunge(time);
    this.updatePlayer(time, dt);
    this.updateAttackTrace(time);
    this.nav.setTarget(this.player.x, this.player.y);
    for (const enemy of this.enemies) {
      enemy.update(time, dt, this.player, this.walkArea, this.nav, this.onEnemyStrike);
      this.applyKnockback(enemy.character, dt);
    }
    this.separateEnemies(dt);
    this.applyKnockback(this.player, dt);
    this.damageNumbers.update(gameStep);
    this.updateInteraction(time);
  }

  // ---------------------------------------------------------------- 월드

  private buildCharacters(): void {
    for (const spawn of ENEMY_SPAWNS) this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y));

    this.player = new Character(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, {
      key: 'hero',
      name: '용사',
      level: this.progress.level,
      hero: true,
      scale: HERO_SCALE,
      labelOffset: HERO_SPRITE_HEIGHT * HERO_SCALE + 8,
      shadowWidth: 110,
      maxHp: this.stats.maxHp,
    });
  }

  // ---------------------------------------------------------------- UI

  private buildUi(): void {
    // 포인터 수는 main.ts의 activePointers로 설정한다. 재시작 때 추가하지 않는다.
    this.joystick = new VirtualJoystick(this, { x: 190, y: VIEW_HEIGHT - 170 });

    this.attackButton = new ActionButton(this, { x: 0, y: VIEW_HEIGHT - 170, label: '공격' });
    this.talkButton = new ActionButton(this, {
      x: 0,
      y: VIEW_HEIGHT - 340,
      radius: 56,
      label: '대화',
      color: 0x3d6b3a,
      fontSize: 24,
    });
    this.talkButton.setVisible(false);
    // 대화창은 화면 어디를 눌러도 넘어간다.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    });
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
      for (const key of this.attackKeys) key.on('down', this.onAttackKeyDown, this);
      const attackKeys = this.attackKeys;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        for (const key of attackKeys) key.off('down', this.onAttackKeyDown, this);
      });
      this.talkKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
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

    this.hud = new Hud(this, '집 앞에서 시작합니다 · 조이스틱 또는 WASD로 마을을 둘러보세요');
    this.drawHud();
  }

  private drawHud(): void {
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.setXp(this.progress.level, this.progress.xp, xpToNext(this.progress.level));
  }

  /** 화면 너비가 바뀔 때(회전, 창 크기 변경) 화면에 고정된 요소를 다시 배치한다. */
  private layout(): void {
    const { width } = this.scale.gameSize;
    this.hud.layout(width);
    this.attackButton.setPosition(width - 170, VIEW_HEIGHT - 185);
    this.dodgeButton.setPosition(width - 330, VIEW_HEIGHT - 105);
    this.talkButton.setPosition(width - 170, VIEW_HEIGHT - 340);
    this.dialogue.layout(width);
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
    let dodgePressed = this.dodgeButton.consumePress();
    for (const key of this.dodgeKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) dodgePressed = true;
    }
    const attackPressed = this.attackButton.consumePress() || this.keyboardAttackPressed;
    this.keyboardAttackPressed = false;
    if (!player.alive) {
      this.attackBufferedUntil = undefined;
      return;
    }

    if (this.attackBufferedUntil !== undefined && time > this.attackBufferedUntil) {
      this.attackBufferedUntil = undefined;
    }
    if (attackPressed) this.attackBufferedUntil = time + PLAYER.attackBufferMs;

    const v = this.readInput();
    const force = v.length();

    this.dodgeButton.setEnabled(time >= this.dodgeReadyAt);

    if (this.dodgeProgress < 1) {
      this.updateDodge(time);
      if (this.dodgeProgress === 1) player.setDodging(false);
      return;
    }
    player.setDodging(false);

    if (dodgePressed && time >= this.dodgeReadyAt) {
      this.startDodge(time, v);
      return;
    }

    // 초 단위 애니메이션과 밀리초 시계의 부동소수점 오차로 한 프레임 쉬지 않게 한다.
    if (this.wantsAttack(time) && time + 1e-6 >= this.nextAttackAt) {
      this.startAttack(time, v.x, v.y);
      this.attackBufferedUntil = undefined;
    }

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
    if (player.sprite instanceof HeroSprite) player.sprite.setMovement(player.x - fromX, player.y - fromY);
  }

  private dismissHint(): void {
    this.hud.dismissHint();
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

  private separateEnemies(dt: number): void {
    const push = ENEMY.separationSpeed * dt;
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i].character;
      if (!a.alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j].character;
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= ENEMY.separationX || Math.abs(dy) >= ENEMY.separationY) continue;
        // 완전히 같은 자리에 있으면 순서대로 좌우로 나눈다.
        const side = dx === 0 ? 1 : Math.sign(dx);
        let next = this.walkArea.move(a.x, a.y, -side * push, 0, this.scratch);
        a.placeAt(next.x, next.y);
        next = this.walkArea.move(b.x, b.y, side * push, 0, this.scratch);
        b.placeAt(next.x, next.y);
      }
    }
  }

  // ---------------------------------------------------------------- 전투

  private onAttackKeyDown(): void {
    // JustDown은 같은 프레임의 keyup에서 지워지므로 눌림 이벤트를 별도로 기억한다.
    this.keyboardAttackPressed = true;
  }

  private clearAttackInput(): void {
    this.attackBufferedUntil = undefined;
    this.keyboardAttackPressed = false;
    this.attackButton?.consumePress();
  }

  private wantsAttack(time = this.now): boolean {
    return this.attackButton.isDown || this.attackKeys.some((key) => key.isDown) ||
      (this.attackBufferedUntil !== undefined && time <= this.attackBufferedUntil);
  }

  /** 회피 시작. 조이스틱 방향으로, 입력이 없으면 바라보는 쪽으로 미끄러진다. */
  private startDodge(time: number, input: Phaser.Math.Vector2): void {
    const player = this.player;
    this.dismissHint();
    this.clearAttackInput();
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

    this.dodgeUntil = time + DODGE.durationMs;
    this.dodgeProgress = 0;
    this.dodgeStartedAt = time;
    this.dodgeOrigin.x = player.x;
    this.dodgeOrigin.y = player.y;
    this.justDodged = false;
    this.dodgeReadyAt = time + DODGE.cooldownMs;
    this.nextAttackAt = Math.max(this.nextAttackAt, this.dodgeUntil);
    this.nextGhostAt = 0;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, this.dodgeUntil + DODGE.graceMs);
    player.knockback.set(0, 0);
    player.setDodging(true);
    this.dodgeButton.setEnabled(false);
  }

  private updateDodge(time: number): void {
    const player = this.player;
    const elapsed = time + 1e-6 >= this.dodgeUntil
      ? DODGE.durationMs : time - (this.dodgeUntil - DODGE.durationMs);
    const progress = dodgeDistanceRatio(elapsed / DODGE.durationMs);
    const distance = (progress - this.dodgeProgress) * DODGE.distance;
    this.dodgeProgress = progress;
    const next = this.walkArea.move(
      player.x,
      player.y,
      this.dodgeDirection.x * distance,
      this.dodgeDirection.y * distance * VERTICAL_SPEED_RATIO,
      this.scratch,
    );
    player.placeAt(next.x, next.y);

    if (time >= this.nextGhostAt) {
      this.nextGhostAt = time + 45;
      this.effects.spawnGhost(player.sprite, player.x, player.y, player.y - 1, time);
    }
  }

  private startAttack(time: number, inputX: number, inputY = 0): void {
    const player = this.player;
    if (time > this.comboExpiresAt) this.comboStage = 0;
    const stage = this.comboStage;
    const combo = PLAYER.combo[stage];
    this.nextAttackAt = time + combo.intervalMs;
    this.comboExpiresAt = this.nextAttackAt + PLAYER.comboWindowMs;
    this.comboStage = (stage + 1) % PLAYER.combo.length;
    this.dismissHint();

    const hero = player.sprite;
    if (!(hero instanceof HeroSprite)) return;
    let facing = attackFacingFor(hero.lookDirection, player.facing);
    // Input wins. Otherwise retain the last facing unless an aimable enemy is nearby.
    if (Math.hypot(inputX, inputY) > 0.25) {
      facing = attackFacingFor(movementFacing(inputX, inputY, hero.lookDirection, false), player.facing);
    } else {
      let nearest = PLAYER.autoFaceRange;
      for (const enemy of this.enemies) {
        const c = enemy.character;
        if (!c.alive) continue;
        const dx = c.x - player.x, dy = (c.y - player.y) / VERTICAL_SPEED_RATIO;
        const candidate = movementFacing(dx, dy, hero.lookDirection, false);
        if (candidate === 'up' || candidate === 'down') continue;
        const distance = Math.hypot(dx, dy);
        if (distance < nearest) {
          nearest = distance;
          facing = candidate;
        }
      }
    }

    const direction = attackVector(facing);
    player.face(direction.x);
    hero.setAttackFacing(facing);
    player.playAttack(stage + 1);
    this.attackLunge = { startedAt: time, stage, direction, progress: 0 };
    // 저스트 회피 직후의 첫 공격은 반격이다.
    const counter = time <= this.counterUntil;
    if (counter) this.counterUntil = 0;
    this.attackTrace = { startedAt: time, stage, direction, previous: hero.getBlade(), elapsed: 0, hit: new Set(), counter };
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
    const distance = (progress - lunge.progress) * combo.lungeDistance;
    lunge.progress = progress;
    const next = this.walkArea.move(this.player.x, this.player.y,
      distance * lunge.direction.x, distance * lunge.direction.y * VERTICAL_SPEED_RATIO, this.scratch);
    this.player.placeAt(next.x, next.y);
    if (progress === 1) this.attackLunge = undefined;
  }

  /** 시각 효과와 명중 판정이 같은 검날 좌표를 사용한다. 적마다 한 공격에 한 번만 맞는다. */
  private updateAttackTrace(time: number): void {
    const trace = this.attackTrace;
    const player = this.player;
    const rig = player.sprite;
    if (!trace) return;
    if (!player.alive || !player.isAttacking || !(rig instanceof HeroSprite)) {
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
    const end = combo.hitDelayMs + PLAYER.hitWindowMs;
    const sweep = clipBladeSweep(previous, current, lastElapsed, elapsed, combo.hitDelayMs, end);
    if (elapsed >= end) this.attackTrace = undefined;
    if (!sweep) return;
    const finisher = trace.stage === PLAYER.combo.length - 1;
    trace.effect ??= this.effects.beginAttack(trace.stage, trace.startedAt + end, combo.hitDelayMs, player.y + 2);
    this.effects.drawAttack(trace.effect, sweep, time);

    let hitAny = false;
    for (const enemy of this.enemies) {
      const c = enemy.character;
      if (!c.alive || trace.hit.has(enemy)) continue;
      // Use a corridor around the locked attack direction, then test the visible blade.
      if (!insideAttackLane(c.x - player.x, c.y - player.y, trace.direction,
        PLAYER.attackLane, VERTICAL_SPEED_RATIO)) continue;
      const bounds = c.sprite.getBounds(this.boundsScratch);
      if (!bladeHitsEllipse(sweep.previous, sweep.current, { x: bounds.centerX, y: bounds.centerY },
        bounds.width * 0.42 + PLAYER.bladeRadius, bounds.height * 0.42 + PLAYER.bladeRadius)) continue;
      trace.hit.add(enemy);

      hitAny = true;
      const bonus = trace.counter ? JUST_DODGE.counterDamage : 1;
      const damage = Math.round(Phaser.Math.Between(this.stats.damageMin, this.stats.damageMax) * combo.damage * bonus);
      const died = c.hurt(damage);
      if (trace.counter) this.showDamage(c.x, c.y - 100, damage, '#9fdcff', 50);
      else this.showDamage(c.x, c.y - 100, damage, finisher ? '#ffb35a' : '#fff3c4', finisher ? 46 : 34);
      if (died) {
        enemy.kill();
        this.enemyRespawns.push({ at: this.now + ENEMY.respawnMs, enemy });
        this.gainXp(PROGRESSION.slimeXp, c.x, c.y - 185);
      } else {
        const push = PLAYER.knockback * combo.knockback;
        c.knockback.set(trace.direction.x * push, trace.direction.y * push * VERTICAL_SPEED_RATIO);
        enemy.interrupt(this.now);
      }
    }
    if (hitAny) {
      const strong = finisher || trace.counter;
      this.cameras.main.shake(strong ? 130 : 70, strong ? 0.009 : 0.004);
    }
  }

  /** 경험치를 더하고, 레벨이 오르면 능력치를 올리고 체력을 가득 채운다. */
  private gainXp(amount: number, x: number, y: number): void {
    const result = addXp(this.progress, amount);
    this.progress = { level: result.level, xp: result.xp };
    saveProgress(this.storage, this.progress);
    if (amount > 0) this.progressEffects.showXp(x, y, amount);

    if (result.levelsGained > 0) {
      const player = this.player;
      this.stats = statsForLevel(result.level);
      player.setMaxHp(this.stats.maxHp, player.alive);
      player.setLevel(result.level);
      this.hud.showLevelUp(result.level);
      this.progressEffects.levelUpBurst(player.x, player.y);
    }
    this.drawHud();
  }

  // ---------------------------------------------------------------- 대화

  /** 대화 버튼이나 E·Enter 키를 이번 프레임에 눌렀는지. 눌림은 한 번만 센다. */
  private talkPressed(): boolean {
    let pressed = this.talkButton.consumePress();
    for (const key of this.talkKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    }
    return pressed;
  }

  private onDialoguePointer(): void {
    if (this.dialogue.isOpen) this.dialogue.advance();
  }

  /** 싸우는 중에는 말을 걸 수 없다. 대화 중에는 게임이 멈추므로 공격받는 도중에 열리지 않게 한다. */
  private inCombat(): boolean {
    return this.enemies.some((e) => e.state === 'chase' || e.state === 'windup' || e.state === 'recover');
  }

  /** 가까이 있는 대상을 찾아 말풍선과 대화 버튼을 보여 주고, 누르면 대화를 연다. */
  private updateInteraction(time: number): void {
    const player = this.player;
    const free = player.alive && !player.isAttacking && this.dodgeProgress >= 1 && !this.inCombat();
    const target = free ? findInteractable(player.x, player.y) : undefined;
    this.talkButton.setVisible(!!target);

    const marker = this.talkMarker;
    if (!target) {
      marker.setVisible(false);
      this.talkPressed(); // 대상이 없을 때 누른 키는 버린다
      return;
    }
    marker.setVisible(true).setPosition(target.x, target.y - target.markerHeight - 6 * Math.abs(Math.sin(time / 260)));

    if (this.talkPressed()) this.openDialogue(target);
  }

  private openDialogue(target: Interactable): void {
    const player = this.player;
    this.hud.dismissHint();
    this.clearAttackInput();
    player.setMotion(false, target.x - player.x);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    this.dialogue.open(DIALOGUES[target.dialogue], () => {
      // 대화를 넘기려고 누른 공격 키가 닫힌 뒤 공격으로 이어지지 않게 한다.
      this.clearAttackInput();
      this.dodgeButton.consumePress();
      for (const key of this.dodgeKeys) Phaser.Input.Keyboard.JustDown(key);
    });
  }

  /** 몬스터의 돌진이 닿는 순간. 화살표 함수라서 콜백으로 그대로 넘길 수 있다. */
  private readonly onEnemyStrike = (enemy: Enemy): void => {
    const player = this.player;
    const c = enemy.character;
    const now = this.now;
    if (!player.alive || this.dialogue.isOpen) return;

    // 공격이 닿기 직전에 피했고, 피하지 않았다면 맞았을 자리였으면 저스트 회피다.
    if (!this.justDodged && enemy.lastStrikeAt !== undefined
      && isJustDodge(this.dodgeStartedAt, enemy.lastStrikeAt, JUST_DODGE.windowMs)
      && strikeReaches(c.x, c.y, c.facing, this.dodgeOrigin.x, this.dodgeOrigin.y)) {
      this.onJustDodge(enemy);
      return;
    }

    if (now < player.invulnerableUntil) return;
    if (!strikeReaches(c.x, c.y, c.facing, player.x, player.y)) return;

    player.invulnerableUntil = now + PLAYER.invulnerableMs;
    const died = player.hurt(ENEMY.damage, 0xff5a4a);
    player.knockback.set(c.facing * ENEMY.knockback, 0);
    this.showDamage(player.x, player.y - 190, ENEMY.damage, '#ff8a7a');
    this.cameras.main.shake(110, 0.007);
    this.drawHud();
    if (died) this.onPlayerDeath();
  };

  /** 저스트 회피 성공: 느린 화면, 다음 공격 강화, 회피 재사용 대기 초기화, 피한 적은 멈칫. */
  private onJustDodge(enemy: Enemy): void {
    const now = this.now;
    this.justDodged = true;
    this.slowMotionLeft = JUST_DODGE.slowMs;
    this.counterUntil = now + JUST_DODGE.counterMs;
    this.dodgeReadyAt = now;
    this.dodgeButton.setEnabled(true);
    enemy.interrupt(now, JUST_DODGE.stunMs);
    this.hud.showCallout('저스트 회피!');
    this.cameras.main.flash(120, 170, 220, 255);
  }

  private onPlayerDeath(): void {
    const player = this.player;
    this.clearAttackInput();
    this.dodgeProgress = 1;
    this.dodgeUntil = 0;
    player.setDodging(false);
    player.playDeath();

    const message = this.hud.showBanner('쓰러졌습니다', this.scale.gameSize.width, VIEW_HEIGHT);

    this.deathMessage = message;
    this.playerRespawnAt = this.now + PLAYER.respawnMs;
  }

  /** 부활은 시각 효과의 재생 시간과 무관하게 게임 시계로만 결정한다. */
  private updateRespawns(time: number): void {
    if (this.playerRespawnAt !== undefined && time >= this.playerRespawnAt) {
      this.playerRespawnAt = undefined;
      this.deathMessage?.destroy();
      this.deathMessage = undefined;
      if (!this.player.alive) {
        this.clearAttackInput();
        this.player.revive(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
        this.player.invulnerableUntil = time + 1500;
        this.drawHud();
      }
    }
    for (let i = this.enemyRespawns.length - 1; i >= 0; i--) {
      const pending = this.enemyRespawns[i];
      if (time < pending.at) continue;
      this.enemyRespawns.splice(i, 1);
      if (pending.enemy.state === 'dead') this.respawnEnemy(pending.enemy);
    }
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

  private showDamage(x: number, y: number, amount: number, color: string, size = 34): void {
    this.damageNumbers.show(x, y, amount, Number.parseInt(color.slice(1), 16), size);
  }

  // ---------------------------------------------------------------- 디버그

  /** 주소 뒤에 ?debug 를 붙이면 이동 가능 영역과 장애물을 표시한다. */
  private drawDebug(): void {
    const g = this.add.graphics().setDepth(DEPTH_LIGHTING + 10);
    g.lineStyle(3, 0x37ff8b, 0.9);
    g.strokePoints(this.walkArea.polygon.points, true);
    g.lineStyle(3, 0xff5a5a, 0.9);
    for (const o of this.walkArea.obstacles) {
      if (o.shape === 'rect') g.strokeRect(o.x - o.rx, o.y - o.ry, o.rx * 2, o.ry * 2);
      else g.strokeEllipse(o.x, o.y, o.rx * 2, o.ry * 2);
    }
  }
}
