import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

let vite;
let chrome;
let profile;
let socket;
let appUrl;
let requestId = 0;
let navigation = 0;
const requests = new Map();

async function port() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}

async function until(check) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { const value = await check(); if (value) return value; } catch { /* 브라우저 준비 중 */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('개발 서버 또는 Chromium 준비 시간 초과');
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error(method + ' 시간 초과')); }, 10000);
    requests.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function load() {
  const search = '?test=' + ++navigation;
  await send('Page.navigate', { url: appUrl + search });
  await until(() => evaluate(`location.search === ${JSON.stringify(search)} && !!window.__game?.scene.getScene('game')?.player`));
  await evaluate('window.__game.loop.sleep()');
}

before(async () => {
  const appPort = await port();
  const debugPort = await port();
  appUrl = `http://127.0.0.1:${appPort}/`;
  profile = await mkdtemp(join(tmpdir(), 'untitled-gameplay-'));
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(appPort), '--strictPort'], { stdio: 'ignore' });
  await until(async () => (await fetch(appUrl)).ok);
  chrome = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  chrome.on('error', () => {});
  const tabs = await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json`)).json());
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { requests.get(message.id)?.(message); requests.delete(message.id); }
  };
}, { timeout: 70000 });

after(async () => {
  socket?.close();
  const stop = async (child) => {
    if (!child || child.exitCode !== null || !child.pid) return;
    await new Promise((resolve) => { child.once('exit', resolve); child.kill(); });
  };
  await Promise.all([stop(chrome), stop(vite)]);
  if (profile) await rm(profile, { recursive: true, force: true });
});

test('장면을 다섯 번 재시작해도 적·포인터·텍스처 수와 초기 상태가 유지된다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    const counts = () => [s.enemies.length, s.input.manager.pointers.length, Object.keys(s.textures.list).length,
      s.events.listenerCount('update'), g.events.listenerCount('blur'), s.attackKeys.reduce((n, key) => n + key.listenerCount('down'), 0)];
    const initial = counts(), restarts = [];
    for (let i = 0; i < 5; i++) {
      s.now = 8000; s.nextAttackAt = 9999; s.dodgeReadyAt = 9999;
      s.startAttack(s.now, 1); s.player.hurt(s.player.maxHp); s.onPlayerDeath();
      s.attackBufferedUntil = 9999; s.keyboardAttackPressed = true;
      s.playerRespawnAt = 9999; s.enemyRespawns.push({ at: 9999, enemy: s.enemies[0] });
      s.scene.restart(); g.step(performance.now(), 16); g.step(performance.now() + 16, 16);
      restarts.push({ counts: counts(), now: s.now, attack: s.nextAttackAt, dodge: s.dodgeReadyAt,
        pending: s.enemyRespawns.length, playerPending: s.playerRespawnAt !== undefined,
        trace: !!s.attackTrace, lunge: !!s.attackLunge, alive: s.player.alive,
        buffered: s.attackBufferedUntil !== undefined || s.keyboardAttackPressed });
    }
    return { initial, restarts };
  })()`);
  for (const run of result.restarts) {
    assert.deepEqual(run.counts, result.initial);
    assert.ok(run.now < 100);
    assert.equal(run.attack, 0);
    assert.equal(run.dodge, 0);
    assert.equal(run.pending, 0);
    assert.equal(run.playerPending, false);
    assert.equal(run.trace, false);
    assert.equal(run.lunge, false);
    assert.equal(run.buffered, false);
    assert.equal(run.alive, true);
  }
});

test('공격을 중단당하거나 죽은 적은 이전 명중 예약을 실행하지 않는다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, e = s.enemies[0];
    p.placeAt(2000, 650); let hits = 0;
    e.beginWindup(0, 1); e.interrupt(100);
    e.update(590, 0.05, p, s.walkArea, s.nav, () => hits++);
    const interrupted = hits;
    e.beginWindup(1000, 1); e.character.hurt(e.character.maxHp); e.kill();
    e.update(1590, 0.05, p, s.walkArea, s.nav, () => hits++);
    return { interrupted, hits, state: e.state };
  })()`);
  assert.equal(result.interrupted, 0);
  assert.equal(result.hits, 0);
  assert.equal(result.state, 'dead');
});

test('적 명중은 저프레임에서도 게임 시간 590ms 이후 한 번만 발생한다', async () => {
  await load();
  const results = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, e = s.enemies[0];
    s.enemies = [e]; s.wantsAttack = () => false;
    const getDelta = s.tweens.getDelta, strike = s.onEnemyStrike, results = [];
    for (const delta of [1000 / 60, 100]) {
      p.revive(1000, 650); p.invulnerableUntil = 0; e.character.revive(1100, 650);
      s.now = 0; e.beginWindup(0, -1); const hits = [];
      s.onEnemyStrike = (enemy) => { hits.push(s.now); strike(enemy); };
      s.tweens.getDelta = () => delta;
      while (s.now < 1000) { s.update(0, delta); s.tweens.update(); }
      results.push({ delta, hits, hp: p.hp, maxHp: p.maxHp, state: e.state });
    }
    s.tweens.getDelta = getDelta; s.onEnemyStrike = strike;
    return results;
  })()`);
  for (const run of results) {
    assert.equal(run.hits.length, 1);
    assert.ok(run.hits[0] >= 590 && run.hits[0] < 590 + Math.min(run.delta, 50) + 1e-6);
    assert.equal(run.hp, run.maxHp - 8);
    assert.equal(run.state, 'recover');
  }
});

test('부활은 시각 효과의 완료와 무관하게 공통 게임 시계의 기한에 실행된다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, e = s.enemies[0];
    p.hurt(p.maxHp); s.onPlayerDeath(); const playerAt = s.playerRespawnAt;
    const getDelta = s.tweens.getDelta; s.tweens.getDelta = () => 10000; s.tweens.update(); s.tweens.getDelta = getDelta;
    const cosmeticOnly = p.alive; s.updateRespawns(playerAt - 1); const before = p.alive;
    s.now = playerAt; s.updateRespawns(playerAt); const after = p.alive, invulnerableUntil = p.invulnerableUntil;
    p.revive(1000, 650); e.character.revive(1110, 650); e.character.hp = 1;
    s.enemies = [e]; s.now = 0; s.comboStage = 2; s.comboExpiresAt = 10000; s.startAttack(0, 1);
    for (let t = 50; t <= 250; t += 50) {
      p.sprite.onSceneUpdate(0, 50); s.now = t; s.updateAttackLunge(t); s.updateAttackTrace(t);
    }
    const pending = s.enemyRespawns[0]; if (!pending) throw new Error('적 사망 후 부활 예약 누락');
    s.updateRespawns(pending.at - 1); const enemyBefore = e.character.alive;
    s.now = pending.at; s.updateRespawns(pending.at);
    return { cosmeticOnly, before, after, invulnerableUntil, playerAt, enemyBefore, enemyAfter: e.character.alive, pending: s.enemyRespawns.length };
  })()`);
  assert.equal(result.cosmeticOnly, false);
  assert.equal(result.before, false);
  assert.equal(result.after, true);
  assert.equal(result.invulnerableUntil, result.playerAt + 1500);
  assert.equal(result.enemyBefore, false);
  assert.equal(result.enemyAfter, true);
  assert.equal(result.pending, 0);
});

test('회피는 가변 프레임과 좌우·세로·대각선 이동에서 같은 누적 거리를 적용한다', async () => {
  await load();
  const results = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, results = [];
    s.enemies = []; s.joystick.vector.set(0, 0);
    for (const deltas of [[50], [1000 / 30], [1000 / 60], [1000 / 120], [100], [7, 41, 19, 50, 33, 11]]) {
      for (const [x, y] of [[1, 0], [-1, 0], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]]) {
        p.revive(1600, 675); s.now = 1000; s.dodgeReadyAt = 0;
        s.startDodge(s.now, new p.knockback.constructor(x, y));
        let i = 0;
        while (s.now < 1350) s.update(0, deltas[i++ % deltas.length]);
        results.push({ x, y, dx: p.x - 1600, dy: p.y - 675, progress: s.dodgeProgress, dodging: p.dodging });
      }
    }
    return results;
  })()`);
  assert.equal(results.length, 24);
  for (const result of results) {
    assert.ok(Math.abs(result.dx - result.x * 250) < 1e-6);
    assert.ok(Math.abs(result.dy - result.y * 250 * 0.7) < 1e-6);
    assert.equal(result.progress, 1);
    assert.equal(result.dodging, false);
  }
});

test('터치·키보드의 짧은 공격과 콤보 예약을 처리하고 누르고 있을 때만 자동 반복한다', async () => {
  await load();
  const results = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, results = [];
    s.enemies = []; s.joystick.vector.set(0, 0);
    let attacks = 0; const start = s.startAttack;
    s.startAttack = (...args) => { attacks++; start.apply(s, args); };
    const pointer = { id: 77, x: s.attackButton.image.x, y: s.attackButton.image.y };
    for (const source of ['touch', 'keyboard']) {
      const key = s.attackKeys[0];
      const down = () => source === 'touch' ? s.input.emit('pointerdown', pointer)
        : key.onDown(new KeyboardEvent('keydown', { code: 'Space', keyCode: 32 }));
      const up = () => source === 'touch' ? s.input.emit('pointerup', pointer)
        : key.onUp(new KeyboardEvent('keyup', { code: 'Space', keyCode: 32 }));
      const tap = () => { down(); up(); };
      const reset = () => {
        up(); s.clearAttackInput(); p.revive(1000, 650); s.now = 1000;
        s.nextAttackAt = 0; s.comboStage = 0; s.comboExpiresAt = 0; s.playerRespawnAt = undefined;
        s.dodgeProgress = 1; s.dodgeUntil = 0; s.dodgeReadyAt = 0; attacks = 0;
      };
      const tick = () => { p.sprite.onSceneUpdate(0, 50); s.update(0, 50); };
      reset(); tap(); tick(); const quickTap = attacks;
      while (s.now < 1700) tick(); const noExtraAfterTap = attacks;
      reset(); tap(); tick(); const ready = s.nextAttackAt;
      while (s.now < ready - 100) tick();
      tap(); tick(); while (s.now < ready + 50) tick(); const bufferedCombo = attacks;
      while (s.now < 1900) tick(); const consumedOnce = attacks;
      reset(); tap(); tick(); tap(); tick();
      while (s.now < 1700) tick(); const expired = attacks;
      reset(); down(); while (s.now < 1800) tick();
      const held = attacks; up(); while (s.now < 2350) tick(); const released = attacks;
      results.push({ source, quickTap, noExtraAfterTap, bufferedCombo, consumedOnce, expired, held, released });
    }
    return results;
  })()`);
  for (const result of results) {
    assert.equal(result.quickTap, 1, result.source);
    assert.equal(result.noExtraAfterTap, 1, result.source);
    assert.equal(result.bufferedCombo, 2, result.source);
    assert.equal(result.consumedOnce, 2, result.source);
    assert.equal(result.expired, 1, result.source);
    assert.ok(result.held >= 3, result.source);
    assert.equal(result.released, result.held, result.source);
  }
});

test('회피·포커스 이탈·사망은 이전 공격 예약을 취소하고 부활 직전의 죽은 상태 입력도 버린다', async () => {
  await load();
  const results = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, results = [];
    s.enemies = []; s.joystick.vector.set(0, 0);
    const pointer = { id: 77, x: s.attackButton.image.x, y: s.attackButton.image.y };
    const tap = () => { s.input.emit('pointerdown', pointer); s.input.emit('pointerup', pointer); };
    for (const cancel of ['dodge', 'blur', 'death']) {
      p.revive(1000, 650); s.clearAttackInput(); s.now = 1000;
      s.nextAttackAt = 1100; s.dodgeProgress = 1; s.dodgeUntil = 0; s.dodgeReadyAt = 0; s.comboStage = 0;
      tap(); s.updatePlayer(s.now, 0.05);
      if (cancel === 'dodge') s.startDodge(s.now, new p.knockback.constructor(1, 0));
      if (cancel === 'blur') s.game.events.emit('blur');
      if (cancel === 'death') { p.hurt(p.maxHp); s.onPlayerDeath(); }
      const cleared = s.attackBufferedUntil === undefined && !s.keyboardAttackPressed;
      if (cancel === 'death') {
        // 마지막 사망 프레임의 짧은 입력도 부활 시 이어받지 않는다.
        s.now = s.playerRespawnAt; tap(); s.updateRespawns(s.now); s.updatePlayer(s.now, 0.05);
      } else {
        for (let i = 0; i < 10; i++) { p.sprite.onSceneUpdate(0, 50); s.update(0, 50); }
      }
      results.push({ cancel, cleared, stage: s.comboStage, attacking: p.isAttacking });
    }
    return results;
  })()`);
  for (const result of results) {
    assert.equal(result.cleared, true, result.cancel);
    assert.equal(result.stage, 0, result.cancel);
    assert.equal(result.attacking, false, result.cancel);
  }
});

test('프레임이 타격 시간 경계를 넘을 때 유효 구간 밖 접촉은 빗나가고 안쪽 접촉만 한 번 맞는다', async () => {
  await load();
  const results = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, rig = p.sprite, e = s.enemies[0];
    s.enemies = [e]; e.interrupt = () => {};
    const line = (y) => ({ base: { x: 1060, y }, tip: { x: 1150, y } });
    const blade = rig.getBlade, results = [];
    for (const [name, from, to, y0, y1] of [
      ['before', 160, 190, 605, 800], ['after', 230, 250, 700, 605],
      ['inside', 170, 200, 700, 560], ['both', 100, 300, 700, 500]
    ]) {
      p.revive(1000, 650); e.character.revive(1100, 650); s.comboStage = 2; s.comboExpiresAt = 10000;
      s.startAttack(0, 1); s.attackTrace.elapsed = from; s.attackTrace.previous = line(y0);
      rig.getBlade = () => line(y1); let hits = 0;
      e.character.hurt = () => { hits++; return false; };
      s.now = to; s.updateAttackTrace(to); s.updateAttackTrace(to + 1);
      results.push({ name, hits });
    }
    rig.getBlade = blade; return results;
  })()`);
  assert.deepEqual(results.map((r) => r.hits), [0, 0, 1, 1]);
});

test('공격 효과는 프레임 속도와 무관하게 한 객체와 일정한 수의 궤적 표본을 사용한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, results = [];
    s.enemies = []; s.joystick.vector.set(0, 0);
    let created = 0, begun = 0;
    const graphics = s.add.graphics, begin = s.effects.beginAttack;
    s.add.graphics = (...args) => { created++; return graphics.apply(s.add, args); };
    s.effects.beginAttack = (...args) => { begun++; return begin.apply(s.effects, args); };
    for (const fps of [20, 30, 60, 120]) {
      for (const stage of [0, 1, 2]) {
        s.effects.update(1e9); p.revive(1000, 650); s.now = 1000;
        s.comboStage = stage; s.comboExpiresAt = 10000; s.startAttack(1000, 1);
        const before = begun;
        while (s.now < 1450) { p.sprite.onSceneUpdate(0, 1000 / fps); s.update(0, 1000 / fps); }
        const effect = s.effects.attackPool[0];
        results.push({ fps, stage, begun: begun - before, samples: effect.samples.length,
          active: effect.graphic.active, visible: effect.graphic.visible, pool: s.effects.attackPool.length });
      }
    }
    s.add.graphics = graphics; s.effects.beginAttack = begin;
    return { results, created };
  })()`);
  assert.equal(result.created, 1);
  assert.equal(result.results.length, 12);
  for (const run of result.results) {
    assert.equal(run.begun, 1, JSON.stringify(run));
    assert.equal(run.samples, 6, JSON.stringify(run));
    assert.equal(run.pool, 1);
    assert.equal(run.active, false);
    assert.equal(run.visible, false);
  }
});

test('회피 잔상은 프레임 이미지를 재사용하고 장면 재시작 때 효과 풀을 비운다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    s.enemies = []; s.joystick.vector.set(0, 0);
    let images = 0; const image = s.add.image;
    s.add.image = (...args) => { images++; return image.apply(s.add, args); };
    const counts = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      p.revive(1000, 650); s.now = 1000 + repeat * 1000;
      const end = s.now + 600; s.startDodge(s.now, new p.knockback.constructor(1, 0));
      while (s.now < end) { p.sprite.onSceneUpdate(0, 16); s.update(0, 16); }
      counts.push({ images, pool: s.effects.ghostPool.length,
        hidden: s.effects.ghostPool.every((e) => !e.object.active && !e.object.visible),
        children: s.effects.ghostPool.map((e) => e.object.list.length) });
    }
    s.add.image = image;
    const old = s.effects;
    s.startAttack(s.now, 1); s.now += 250; p.sprite.onSceneUpdate(0, 50); s.updateAttackTrace(s.now);
    s.scene.restart(); g.step(performance.now(), 16); g.step(performance.now() + 16, 16);
    return { counts, oldAttackPool: old.attackPool.length, oldGhostPool: old.ghostPool.length,
      newAttackPool: s.effects.attackPool.length, newGhostPool: s.effects.ghostPool.length, enemies: s.enemies.length };
  })()`);
  assert.ok(result.counts[0].images > 0);
  for (const run of result.counts) {
    assert.equal(run.images, result.counts[0].images);
    assert.equal(run.pool, result.counts[0].pool);
    assert.ok(run.pool <= 6);
    assert.equal(run.hidden, true);
    assert.ok(run.children.every((n) => n === 1));
  }
  assert.equal(result.oldAttackPool, 0);
  assert.equal(result.oldGhostPool, 0);
  assert.equal(result.newAttackPool, 0);
  assert.equal(result.newGhostPool, 0);
  assert.equal(result.enemies, 4);
});

test('실제 이동 방향에 맞는 원본 프레임을 표시하고 정지·잔상에서 발 위치와 그림을 유지한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, runs = [];
    s.enemies = []; s.now = 1000;
    for (const [name, x, y] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0],
      ['down-left', -.707, .707], ['down-right', .707, .707], ['up-left', -.707, -.707], ['up-right', .707, -.707]]) {
      p.revive(1000, 640); s.joystick.vector.set(x, y);
      for (let i = 0; i < 3; i++) { hero.onSceneUpdate(0, 50); s.updatePlayer(s.now += 50, .05); }
      const moving = hero.image.frame.name;
      const foot = hero.image.getWorldTransformMatrix().transformPoint(0, 0);
      const mirrored = hero.image.scaleX < 0;
      s.joystick.vector.set(0, 0); s.updatePlayer(s.now += 50, .05);
      runs.push({ name, moving, idle: hero.image.frame.name, mirrored, error: Math.hypot(foot.x - p.x, foot.y - p.y) });
    }
    hero.play('dodge'); hero.onSceneUpdate(0, 150);
    const ghost = hero.spawnGhost(p.x, p.y, p.y - 1, 0x9fc4ff, .35);
    hero.play('walk'); hero.setMovement(-1, -1);
    hero.spawnGhost(p.x, p.y, p.y - 1, 0x9fc4ff, .35, ghost);
    const copy = ghost.getAt(0);
    const reused = copy.texture.key === hero.image.texture.key && copy.frame.name === hero.image.frame.name;
    ghost.destroy();
    return { runs, reused };
  })()`);
  for (const [row, name] of ['down', 'left', 'right', 'up'].entries()) {
    const run = result.runs.find((r) => r.name === name);
    assert.equal(Math.floor(Number(run.moving.slice(5)) / 4), row);
    assert.equal(run.idle, `walk-${row * 4}`);
    assert.equal(run.mirrored, false);
    assert.ok(run.error < 0.001);
  }
  for (const [row, name] of ['down-left', 'down-right', 'up-left', 'up-right'].entries()) {
    const run = result.runs.find((r) => r.name === name);
    assert.equal(Math.floor(Number(run.moving.slice(9)) / 4), row);
    assert.equal(run.idle, `diagonal-${row * 4}`);
    assert.equal(run.mirrored, false);
    assert.ok(run.error < 0.001);
  }
  assert.equal(result.reused, true);
});

test('새 공격 그림의 실제 검날은 20·30·60·120fps와 좌우 모든 콤보에서 적을 한 번 맞힌다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, e = s.enemies[0], runs = [];
    s.enemies = [e]; s.joystick.vector.set(0, 0);
    for (const fps of [20, 30, 60, 120]) for (const facing of [-1, 1]) for (const stage of [0, 1, 2]) {
      p.revive(1000, 650); e.character.revive(1000 + facing * 110, 650);
      s.comboStage = stage; s.comboExpiresAt = 10000; s.now = 1000;
      s.startAttack(1000, facing);
      let hits = 0;
      e.character.hurt = () => { hits++; return false; }; e.interrupt = () => {};
      for (let i = 1; i <= Math.ceil(fps * .32); i++) {
        hero.onSceneUpdate(0, 1000 / fps); s.now = 1000 + i * 1000 / fps;
        s.updateAttackLunge(s.now); s.updateAttackTrace(s.now);
      }
      runs.push({ fps, facing, stage, hits });
    }
    return runs;
  })()`);
  assert.equal(result.length, 24);
  for (const run of result) assert.equal(run.hits, 1, JSON.stringify(run));
});

test('대각선 4방향의 모든 콤보는 20·30·60·120fps에서 앞쪽만 명중하고 같은 방향으로 전진·넉백한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, enemies = s.enemies, runs = [];
    s.joystick.vector.set(0, 0);
    const directions = [['down-left', -1, 1], ['down-right', 1, 1], ['up-left', -1, -1], ['up-right', 1, -1]];
    for (const fps of [20, 30, 60, 120]) for (const [facing, signX, signY] of directions) for (const stage of [0, 1, 2]) {
      const x = signX * Math.SQRT1_2, y = signY * Math.SQRT1_2;
      const worldX = x * 110, worldY = y * 110 * .7, length = Math.hypot(worldX, worldY);
      const offsets = [[worldX, worldY], [-worldX, -worldY],
        [worldX - worldY / length * 100, worldY + worldX / length * 100], [worldX * 4, worldY * 4]];
      p.revive(1000, 640); s.enemies = enemies;
      const hits = [0, 0, 0, 0];
      enemies.forEach((enemy, i) => {
        enemy.character.revive(1000 + offsets[i][0], 640 + offsets[i][1]);
        enemy.character.hurt = () => { hits[i]++; return false; }; enemy.interrupt = () => {};
      });
      s.comboStage = stage; s.comboExpiresAt = 10000; s.now = 1000;
      s.startAttack(1000, x, y);
      const texture = hero.image.texture.key, mirrored = hero.image.scaleX < 0;
      for (let i = 1; i <= Math.ceil(fps * .32); i++) {
        hero.onSceneUpdate(0, 1000 / fps); s.now = 1000 + i * 1000 / fps;
        s.updateAttackLunge(s.now); s.updateAttackTrace(s.now);
      }
      const knockback = enemies[0].character.knockback;
      runs.push({ fps, facing, stage, hits, texture, mirrored,
        dx: p.x - 1000, dy: p.y - 640, kx: knockback.x, ky: knockback.y });
    }
    return runs;
  })()`);
  assert.equal(result.length, 48);
  for (const run of result) {
    assert.deepEqual(run.hits, [1, 0, 0, 0], JSON.stringify(run));
    assert.equal(run.texture, `hero-academy-attack-${run.facing.startsWith('up') ? 'up' : 'down'}`);
    assert.equal(run.mirrored, run.facing.includes('left'));
    assert.equal(Math.sign(run.dx), run.facing.includes('left') ? -1 : 1);
    assert.equal(Math.sign(run.dy), run.facing.startsWith('up') ? -1 : 1);
    assert.ok(Math.abs(Math.abs(run.dy / run.dx) - .7) < 0.001);
    assert.equal(Math.sign(run.kx), Math.sign(run.dx));
    assert.equal(Math.sign(run.ky), Math.sign(run.dy));
    assert.ok(Math.abs(Math.abs(run.ky / run.kx) - .7) < 0.001);
  }
});

test('마지막 대각선과 자동 조준을 사용하고 공격 도중 반대 입력이 들어와도 검과 판정 방향은 고정된다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, enemy = s.enemies[0];
    s.enemies = []; p.revive(1000, 640);
    hero.setMovement(-1, -1); hero.setMovement(0, 0);
    s.startAttack(1000, 0, 0);
    hero.onSceneUpdate(0, 50);
    const before = { frame: hero.image.frame.name, scale: hero.image.scaleX, blade: hero.getBlade(), direction: {...s.attackTrace.direction} };
    hero.setMovement(1, 1); p.face(1);
    const after = { frame: hero.image.frame.name, scale: hero.image.scaleX, blade: hero.getBlade(), direction: {...s.attackTrace.direction} };
    p.endAttack(); p.revive(1000, 640); s.comboExpiresAt = 0;
    enemy.character.revive(1080, 695); s.enemies = [enemy];
    s.startAttack(2000, 0, 0);
    return { before, after, aimed: hero.image.texture.key, direction: s.attackTrace.direction };
  })()`);
  assert.ok(result.before.frame.startsWith('attack-up-'));
  assert.ok(result.before.scale < 0);
  assert.deepEqual(result.after, result.before);
  assert.equal(result.aimed, 'hero-academy-attack-down');
  assert.ok(result.direction.x > 0 && result.direction.y > 0);
});
