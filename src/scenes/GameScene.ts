import Phaser from 'phaser';
import { bladeHitsEllipse, type Blade } from '../combat/blade';
import { BladeTrail } from '../combat/BladeTrail';
import { Enemy } from '../combat/Enemy';
import {
  DODGE,
  ENEMY,
  KNOCKBACK_DAMPING,
  PLAYER,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config';
import { Character } from '../entities/Character';
import { HERO_RIG_HEIGHT, HeroRig, preloadHeroRig } from '../entities/HeroRig';
import { dodgeProgress, lungeProgress, locomotionRate } from '../entities/movement';
import { ActionButton } from '../ui/ActionButton';
import { DamageNumbers } from '../ui/DamageNumbers';
import { Hud } from '../ui/Hud';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { NavGrid } from '../world/navGrid';
import { createPlaceholderArt } from '../world/placeholderArt';
import { buildTavern, ENEMY_SPAWNS, NPCS, PLAYER_SPAWN, type Tavern } from '../world/tavern';
import type { WalkArea } from '../world/walkArea';

/** 뼈대 캐릭터(키 400)를 화면에 그릴 때의 배율 */
const HERO_SCALE = 0.5;
/** 길 찾기 격자 한 칸의 크기(px) */
const NAV_CELL = 32;

/**
 * 한 판의 진행을 맡는다: 입력을 읽어 플레이어를 움직이고, 공격·회피·피격을 판정한다.
 * 맵은 world/tavern.ts, 화면 표시는 ui/Hud.ts, 적의 행동은 combat/Enemy.ts에 있다.
 */
export class GameScene extends Phaser.Scene {
  private tavern!: Tavern;
  private walkArea!: WalkArea;
  private nav!: NavGrid;
  private player!: Character;
  /** 플레이어의 몸. 검날 위치와 잔상은 뼈대 캐릭터에서만 얻을 수 있다. */
  private rig!: HeroRig;
  private enemies: Enemy[] = [];

  private joystick!: VirtualJoystick;
  private attackButton!: ActionButton;
  private dodgeButton!: ActionButton;
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private attackKeys: Phaser.Input.Keyboard.Key[] = [];
  private dodgeKeys: Phaser.Input.Keyboard.Key[] = [];
  private hud!: Hud;
  private damageNumbers!: DamageNumbers;
  private bladeTrail!: BladeTrail;

  /** 게임 시계(ms). update()에서만 흐른다. */
  private now = 0;
  /** 게임 시계 기준으로 나중에 실행할 일들 */
  private timers: Array<{ at: number; run: () => void }> = [];
  private attackTrace?: { startedAt: number; stage: number; previous: Blade; elapsed: number; hit: Set<Enemy> };
  private attackLunge?: { startedAt: number; stage: number; facing: number; progress: number };
  private nextAttackAt = 0;
  private comboStage = 0;
  private comboExpiresAt = 0;
  /** 회피 중일 때만 있다. progress는 지금까지 이동한 비율(0~1). */
  private dodge?: { startedAt: number; progress: number };
  private dodgeReadyAt = 0;
  private nextGhostAt = 0;

  private readonly dodgeDirection = new Phaser.Math.Vector2();
  private readonly inputVector = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();
  private readonly boundsScratch = new Phaser.Geom.Rectangle();

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
    this.timers = [];
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.nextAttackAt = 0;
    this.comboStage = 0;
    this.comboExpiresAt = 0;
    this.dodge = undefined;
    this.dodgeReadyAt = 0;
    this.nextGhostAt = 0;
  }

  preload(): void {
    preloadHeroRig(this);
  }

  create(): void {
    createPlaceholderArt(this);
    this.tavern = buildTavern(this);
    this.walkArea = this.tavern.walkArea;
    const bounds = this.walkArea.bounds;
    this.nav = new NavGrid(bounds.left, bounds.top, bounds.right, bounds.bottom, NAV_CELL, (x, y) =>
      this.walkArea.contains(x, y),
    );

    this.buildCharacters();
    this.buildControls();
    this.hud = new Hud(this, '왼쪽 패드로 이동, 오른쪽 버튼으로 공격과 회피');
    this.hud.setHp(this.player.hp, this.player.maxHp);
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

    this.runTimers(time);
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

    this.bladeTrail.update(step);
    this.damageNumbers.update(step);
  }

  // ---------------------------------------------------------------- 준비

  private buildCharacters(): void {
    for (const npc of NPCS) {
      const character = new Character(this, npc.x, npc.y, { key: npc.key, name: npc.name, level: npc.level });
      if (npc.faceLeft) character.face(-1);
    }

    for (const spawn of ENEMY_SPAWNS) this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y));

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
    if (!(this.player.sprite instanceof HeroRig)) throw new Error('플레이어는 뼈대 캐릭터여야 합니다.');
    this.rig = this.player.sprite;
  }

  private buildControls(): void {
    // 동시에 누를 수 있는 터치 수(조이스틱 + 공격 + 회피)는 main.ts의 activePointers로 정한다.
    this.joystick = new VirtualJoystick(this, { x: 190, y: VIEW_HEIGHT - 170 });
    this.attackButton = new ActionButton(this, { x: 0, y: 0, label: '공격' });
    this.dodgeButton = new ActionButton(this, {
      x: 0,
      y: 0,
      radius: 56,
      label: '회피',
      color: 0x2f4a86,
      fontSize: 24,
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.attackKeys = [keyboard.addKey(codes.SPACE), keyboard.addKey(codes.J)];
    this.dodgeKeys = [keyboard.addKey(codes.SHIFT), keyboard.addKey(codes.K)];
    this.keys = keyboard.addKeys({
      up: codes.UP,
      down: codes.DOWN,
      left: codes.LEFT,
      right: codes.RIGHT,
      w: codes.W,
      a: codes.A,
      s: codes.S,
      d: codes.D,
    }) as GameScene['keys'];
  }

  /** 화면 너비가 바뀔 때(회전, 창 크기 변경) 화면에 고정된 요소를 다시 배치한다. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.tavern.layout(width, height);
    this.hud.layout(width);
    this.attackButton.setPosition(width - 170, VIEW_HEIGHT - 185);
    this.dodgeButton.setPosition(width - 330, VIEW_HEIGHT - 105);
  }

  // ---------------------------------------------------------------- 시간

  /** 게임 시계로 ms 뒤에 실행한다. (Phaser 타이머와 달리 게임 시계가 멈추면 같이 멈춘다) */
  private after(ms: number, run: () => void): void {
    this.timers.push({ at: this.now + ms, run });
  }

  private runTimers(time: number): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      if (time < timer.at) continue;
      this.timers.splice(i, 1);
      timer.run();
    }
  }

  // ---------------------------------------------------------------- 이동

  private readInput(): Phaser.Math.Vector2 {
    const v = this.inputVector.copy(this.joystick.vector);
    const k = this.keys;
    if (v.lengthSq() === 0 && k) {
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
      this.hud.dismissHint();
    }
    const rate = locomotionRate(player.x - fromX, player.y - fromY, dt, PLAYER_SPEED);
    player.setMotion(rate > 0, v.x, rate);
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

  /** 적끼리 한 자리에 겹쳐 서지 않도록 서로 조금씩 밀어낸다. */
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

  // ---------------------------------------------------------------- 회피

  /** 회피 시작. 조이스틱 방향으로, 입력이 없으면 바라보는 쪽으로 미끄러진다. */
  private startDodge(time: number, input: Phaser.Math.Vector2): void {
    const player = this.player;
    this.hud.dismissHint();
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
      this.rig.spawnGhost(player.x, player.y, player.y - 1, 0x9fc4ff, 0.35);
    }
  }

  // ---------------------------------------------------------------- 공격

  private wantsAttack(): boolean {
    return this.attackButton.isDown || this.attackKeys.some((key) => key.isDown);
  }

  private startAttack(time: number, inputX: number): void {
    const player = this.player;
    if (time > this.comboExpiresAt) this.comboStage = 0;
    const stage = this.comboStage;
    const combo = PLAYER.combo[stage];
    this.nextAttackAt = time + combo.intervalMs;
    this.comboExpiresAt = this.nextAttackAt + PLAYER.comboWindowMs;
    this.comboStage = (stage + 1) % PLAYER.combo.length;
    this.hud.dismissHint();

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
    this.attackTrace = { startedAt: time, stage, previous: this.rig.getBlade(), elapsed: 0, hit: new Set() };
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
    if (!trace) return;
    if (!player.alive || !player.isAttacking) {
      this.attackTrace = undefined;
      return;
    }
    const combo = PLAYER.combo[trace.stage];
    const elapsed = time - trace.startedAt;
    const current = this.rig.getBlade();
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
      const bounds = c.sprite.getBounds(this.boundsScratch);
      const center = this.scratch.set(bounds.centerX, bounds.centerY);
      if (
        !bladeHitsEllipse(
          previous,
          current,
          center,
          bounds.width * 0.42 + PLAYER.bladeRadius,
          bounds.height * 0.42 + PLAYER.bladeRadius,
        )
      ) {
        continue;
      }
      trace.hit.add(enemy);

      hitAny = true;
      const damage = Math.round(Phaser.Math.Between(PLAYER.damageMin, PLAYER.damageMax) * combo.damage);
      const died = c.hurt(damage);
      this.damageNumbers.show(c.x, c.y - 100, damage, finisher ? 0xffb35a : 0xfff3c4, finisher ? 46 : 34);
      if (died) {
        enemy.kill();
        this.after(ENEMY.respawnMs, () => this.respawnEnemy(enemy));
      } else {
        c.knockback.set(player.facing * PLAYER.knockback * combo.knockback, 0);
        enemy.interrupt(this.now);
      }
    }
    if (hitAny) this.cameras.main.shake(finisher ? 130 : 70, finisher ? 0.009 : 0.004);
  }

  // ---------------------------------------------------------------- 피격

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
    this.hud.setHp(player.hp, player.maxHp);
    if (died) this.onPlayerDeath();
  };

  private onPlayerDeath(): void {
    const player = this.player;
    player.playDeath();
    const banner = this.hud.showBanner('쓰러졌습니다', this.scale.gameSize.width, VIEW_HEIGHT);

    this.after(PLAYER.respawnMs, () => {
      banner.destroy();
      player.revive(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
      player.invulnerableUntil = this.now + 1500;
      this.hud.setHp(player.hp, player.maxHp);
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
    const g = this.add.graphics().setDepth(9000);
    g.lineStyle(3, 0x37ff8b, 0.9);
    g.strokePoints(this.walkArea.polygon.points, true);
    g.lineStyle(3, 0xff5a5a, 0.9);
    for (const o of this.walkArea.obstacles) g.strokeEllipse(o.x, o.y, o.rx * 2, o.ry * 2);
  }
}
