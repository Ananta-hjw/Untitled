import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
// 맵 크기·좌표는 게임 코드에서 그대로 가져온다(맵을 넓히거나 줄여도 기대값이 따라간다).
import { PLAYER, WORLD_HEIGHT, WORLD_WIDTH } from '../src/config.ts';
import { ITEMS, ITEM_IDS } from '../src/items/inventory.ts';
import { mapLength } from '../src/world/mapScale.ts';
import { PLAYER_SPAWN } from '../src/world/villageLayout.ts';
import { VILLAGE_EDGE, VILLAGE_GATES, WALL_HALF_WIDTH, WALL_INNER_LEFT, WALL_INNER_RIGHT } from '../src/world/villagePerimeter.ts';

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

function send(method, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error(method + ' 시간 초과')); }, timeoutMs);
    requests.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, timeoutMs = 30000) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

/** 전투 테스트는 몬스터가 있는 남쪽 들판에서, 마을 지형 테스트는 마을에서 시작한다. */
/** guide: 초반 전투 가이드 창을 그대로 둔다. 기본은 모두 본 것으로 적어 다른 테스트를 막지 않게 한다. */
async function load(map = 'south-field', { guide = false } = {}) {
  // 긴 전체 실행의 끝무렵에는 헤드리스 Chromium에서 새 페이지가 가끔 아주 느리게(1초에 1프레임 남짓) 돌아
  // 준비 시간을 넘긴다(브라우저 디버깅 기능을 켜면 사라져 원인은 못 찾았다). 그럴 때 한 번 다시 불러온다.
  for (let attempt = 0; ; attempt++) {
    const search = '?test=' + ++navigation + '&map=' + map;
    await send('Page.navigate', { url: appUrl + search });
    try {
      await until(() => evaluate(`location.search === ${JSON.stringify(search)} && !!window.__game?.scene.getScene('game')?.damageNumbers`));
      break;
    } catch (error) {
      if (attempt >= 1) throw error;
    }
  }
  await evaluate('window.__game.loop.sleep()');
  if (!guide) await evaluate(`(() => { const all = ['attack', 'dodge', 'parry', 'potion', 'resonance'];
    localStorage.setItem('untitled-rpg.guide', JSON.stringify(all)); window.__game.scene.getScene('game').seenLessons = new Set(all); return true; })()`);
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
  const tabs = await until(async () => {
    const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    return tabs.length ? tabs : undefined;
  });
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
  // 크롬 본 프로세스가 끝난 뒤에도 보조 프로세스가 잠깐 프로필에 파일을 쓸 수 있어, 비우는 동안 ENOTEMPTY가 나면 다시 시도한다.
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test('2장 여섯 인물은 각자의 스프라이트와 대화 초상화를 쓰고 대화 뒤에도 같은 외형을 유지한다', async () => {
  await load('east-stream&npcs=chapter2&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    return s.npcs.map(n => {
      const before = n.figure.texture.key;
      s.openDialogue(n.spot);
      const portrait = s.dialogue.portrait.texture.key, name = s.dialogue.nameText.text;
      while (s.dialogue.isOpen) s.dialogue.advance();
      n.faceTowards(n.x - 100, n.y - 100);
      return { id: n.def.id, before, after: n.figure.texture.key, portrait, name,
        expectedName: n.def.name, height: n.figure.displayHeight, expectedHeight: n.def.height,
        footOrigin: n.figure.originY, walkable: s.walkArea.contains(n.x, n.y) };
    });
  })()`);
  assert.deepEqual(result.map(n => n.id).sort(), ['dor', 'evan', 'finn', 'joan', 'marta', 'morgan']);
  for (const n of result) {
    assert.equal(n.before, `npc-${n.id}-cardinal`);
    assert.equal(n.after, `npc-${n.id}-diagonal`);
    assert.equal(n.portrait, `portrait-${n.id}`);
    assert.equal(n.name, n.expectedName);
    assert.ok(Math.abs(n.height - n.expectedHeight) < 4);
    assert.ok(n.footOrigin > .98 && n.footOrigin <= 1);
    assert.equal(n.walkable, true);
  }
});

test('동료 조안은 따라오기·공격·피격·회복에 자신의 시트를 쓴다', async () => {
  await load('east-stream&npcs=chapter2&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    s.setCompanion('joan');
    const c = s.companion;
    const pose = () => [c.figure.texture.key, c.figure.frame.name];
    const guard = pose(), profile = c.fighter.skin;
    c.placeAt(s.player.x - 280, s.player.y);
    const before = c.x;
    for (let i = 0; i < 15; i++) s.updateCompanion(s.now + i * 20, .02);
    const walking = pose();
    const targets = [{ id: 0, x: c.x, y: c.y, alive: true, attacking: false }];
    c.updateCombat(s.now + 900, .02, targets, s.walkArea, () => true, () => {});
    const attack = pose();
    c.receiveCombatHit(s.now + 1000, {x:c.x, y:c.y-100}, 1);
    const hit = pose();
    c.receiveCombatHit(s.now + 3000, {x:c.x, y:c.y-100}, 10000);
    const injured = pose();
    const downed = c.downed;
    c.revive();
    const recovered = pose();
    s.setCompanion(undefined);
    return { guard, profile, walking, attack, hit, injured, recovered, moved: c.x > before, downed };
  })()`);
  assert.equal(result.profile, 'teon');
  assert.deepEqual(result.guard, ['npc-joan-combat', 'guard']);
  assert.equal(result.walking[0], 'npc-joan-cardinal');
  assert.match(result.walking[1], /^right-[1-3]$/);
  assert.deepEqual(result.attack, ['npc-joan-combat', 'attack']);
  assert.deepEqual(result.hit, ['npc-joan-combat', 'hit']);
  assert.deepEqual(result.injured, ['npc-joan-combat', 'injured']);
  assert.deepEqual(result.recovered, ['npc-joan-cardinal', 'right-0']);
  assert.equal(result.moved, true);
  assert.equal(result.downed, true);
});

test('조안의 고치는 잠든 자세를 유지하고 깨어나는 동작을 한 번 재생한다', async () => {
  await load('east-stream&npcs=chapter2&companion=none&action=joan-cocoon');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), j = s.npcs.find(n => n.def.id === 'joan');
    const advance = dt => j.update(s.now, dt, s.player, s.walkArea);
    const start = [j.x, j.y], texture = j.figure.texture.key;
    advance(3);
    const sleeping = j.figure.frame.name;
    j.setStoryAction('awaken');
    const frames = [j.figure.frame.name];
    for (let i = 0; i < 7; i++) {
      advance(.334);
      frames.push(j.figure.frame.name);
    }
    advance(4);
    return { texture, sleeping, frames, end: j.figure.frame.name, still: j.x === start[0] && j.y === start[1] };
  })()`);
  assert.equal(result.texture, 'npc-joan-cocoon-awaken');
  assert.equal(result.sleeping, result.frames[0]);
  assert.equal(new Set(result.frames).size, 8);
  assert.equal(result.end, result.frames[7]);
  assert.equal(result.still, true);
});

test('순찰 조사 전 테온과 대화하면 테온의 이름과 일러스트가 표시된다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    s.quests = { 'evening-patrol': { status: 'active', count: 0 }, 'teon-lunch': { status: 'done', count: 1 } };
    s.openDialogue(s.interactables.find(i => i.id === 'npc-teon'));
    return { name: s.dialogue.nameText.text, portrait: s.dialogue.portrait.texture.key,
      lines: s.dialogue.lines, progress: s.quests['evening-patrol'] };
  })()`);
  assert.equal(result.name, '테온');
  assert.equal(result.portrait, 'portrait-teon');
  assert.ok(result.lines.every(l => l.speaker === '테온'));
  assert.deepEqual(result.progress, { status: 'active', count: 0 });
});

test('들판 나무와 바위 객체는 같은 위치에 충돌이 있고 앞뒤 표시 순서가 바뀐다', async () => {
  await load('south-field');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const props = s.map.props.filter(p => p.frame !== 'sign');
    const objects = props.map(p => {
      const sprite = s.children.list.find(o => o.texture?.key === 'village-props' && o.frame.name === p.frame && o.x === p.x && o.y === p.y);
      const obstacle = s.walkArea.obstacles.find(o => o.x === p.x && Math.abs(o.y - (p.y - p.footprint.ry * .45)) < .001);
      return !!sprite && sprite.depth === p.y && !!obstacle && !s.walkArea.contains(obstacle.x, obstacle.y);
    });
    const tree = props.find(p => p.frame === 'oak' && p.x > 1500 && p.y > 2000);
    s.player.placeAt(tree.x, tree.y - 120);
    const behind = s.player.depth < tree.y;
    s.player.placeAt(tree.x, tree.y + 120);
    const inFront = s.player.depth > tree.y;
    const rock = props.find(p => p.frame === 'boulders' && p.y > 1000 && p.y < 1300);
    const o = s.walkArea.obstacles.find(o => o.x === rock.x);
    const from = { x: o.x - o.rx - 30, y: o.y };
    const point = { set(x, y) { this.x = x; this.y = y; return this; } };
    s.walkArea.move(from.x, from.y, o.rx * 2 + 60, 0, point);
    return { objects, behind, inFront, rockStops: point.x < o.x && s.walkArea.contains(point.x, point.y),
      noBakedForeground: !s.children.list.some(o => o.name === 'map-art-foreground') };
  })()`);
  assert.ok(result.objects.length >= 25 && result.objects.every(Boolean));
  assert.equal(result.behind, true);
  assert.equal(result.inFront, true);
  assert.equal(result.rockStops, true);
  assert.equal(result.noBakedForeground, true);
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

test('쓰러진 뒤의 창과 적의 부활은 시각 효과의 완료와 무관하게 공통 게임 시계의 기한에 실행된다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, e = s.enemies[0];
    p.sprite.setAttackFacing('up-left'); p.sprite.setGuarding(true);
    p.hurt(p.maxHp); s.onPlayerDeath(); const playerAt = s.playerRespawnAt;
    const poses = new Set([p.sprite.image.frame.name]);
    for (let t = 50; t <= 600; t += 50) {
      p.sprite.advance(50); poses.add(p.sprite.image.frame.name);
    }
    const collapse = { poses: [...poses], left: p.sprite.image.scaleX < 0,
      weaponVisible: p.sprite.weaponBack.visible || p.sprite.weaponFront.visible || p.sprite.supportHand.visible };
    const getDelta = s.tweens.getDelta; s.tweens.getDelta = () => 10000; s.tweens.update(); s.tweens.getDelta = getDelta;
    const cosmeticOnly = p.alive; s.updateRespawns(playerAt - 1); const before = p.alive;
    s.now = playerAt; s.updateRespawns(playerAt); const after = s.deathPanel.isOpen && !p.alive;
    p.setMotion(false); p.sprite.advance(50);
    const held = { frame: p.sprite.image.frame.name, alpha: p.sprite.alpha,
      nameVisible: p.nameText.visible, levelVisible: p.levelText.visible };
    p.revive(1000, 650); e.character.revive(1110, 650); e.character.hp = 1;
    const revived = { idle: !p.sprite.image.frame.name.startsWith('death-'),
      nameVisible: p.nameText.visible, levelVisible: p.levelText.visible };
    s.enemies = [e]; s.now = 0; s.comboStage = 2; s.comboExpiresAt = 10000; s.startAttack(0, 1);
    for (let t = 50; t <= 250; t += 50) {
      p.sprite.advance(50); s.now = t; s.updateAttackLunge(t); s.updateAttackTrace(t);
    }
    const pending = s.enemyRespawns[0]; if (!pending) throw new Error('적 사망 후 부활 예약 누락');
    s.updateRespawns(pending.at - 1); const enemyBefore = e.character.alive;
    s.now = pending.at; s.updateRespawns(pending.at);
    return { collapse, held, revived, cosmeticOnly, before, after, enemyBefore, enemyAfter: e.character.alive, pending: s.enemyRespawns.length };
  })()`);
  assert.deepEqual(result.collapse, { poses: Array.from({ length: 6 }, (_, i) => 'death-' + i), left: true, weaponVisible: false });
  assert.deepEqual(result.held, { frame: 'death-5', alpha: 1, nameVisible: false, levelVisible: false });
  assert.deepEqual(result.revived, { idle: true, nameVisible: true, levelVisible: true });
  assert.equal(result.cosmeticOnly, false);
  assert.equal(result.before, false, '기한 전에는 창이 뜨지 않는다');
  assert.equal(result.after, true, '기한에 창이 뜨고, 시온은 확인을 누를 때까지 쓰러져 있다');
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
        p.revive(1400, 1000); s.now = 1000; s.dodgeReadyAt = 0;
        s.startDodge(s.now, new p.knockback.constructor(x, y));
        let i = 0;
        while (s.now < 1350) s.update(0, deltas[i++ % deltas.length]);
        results.push({ x, y, dx: p.x - 1400, dy: p.y - 1000, progress: s.dodgeProgress, dodging: p.dodging });
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
      const tick = () => { s.update(0, 50); };
      reset(); tap(); tick(); const quickTap = attacks;
      while (s.now < 1700) tick(); const noExtraAfterTap = attacks;
      reset(); tap(); tick(); const ready = s.nextAttackAt;
      while (s.now < ready - 100) tick();
      tap(); tick(); while (s.now < ready + 50) tick(); const bufferedCombo = attacks;
      while (s.now < 1900) tick(); const consumedOnce = attacks;
      reset(); tap(); tick(); tap(); tick();
      while (s.now < 1700) tick(); const expired = attacks;
      reset(); down(); while (s.now < 2000) tick();
      const held = attacks; up(); while (s.now < 2600) tick(); const released = attacks;
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

test('공격 중에는 조이스틱으로 움직이지 않고 공격 자체의 전진만 하며, 공격이 끝나면 다시 걷는다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player;
    s.enemies = []; s.joystick.vector.set(0, 0);
    p.revive(1000, 650); s.now = 1000; s.nextAttackAt = 0; s.comboStage = 0; s.comboExpiresAt = 0;
    s.dodgeProgress = 1; s.dodgeUntil = 0; s.dodgeReadyAt = 0;
    const tick = () => s.update(0, 16);
    // 오른쪽을 보고 서서 공격한 뒤, 공격 중에 조이스틱을 아래로 민다.
    s.joystick.vector.set(1, 0); tick(); s.joystick.vector.set(0, 0); tick();
    const start = { x: p.x, y: p.y };
    s.attackButton.pressed = true; tick();
    const attacking = p.isAttacking;
    s.joystick.vector.set(0, 1);
    let maxDrift = 0;
    while (p.isAttacking && s.now < 3000) { tick(); if (p.isAttacking) maxDrift = Math.max(maxDrift, Math.abs(p.y - start.y)); }
    const lunged = p.x - start.x;
    const before = p.y;
    for (let i = 0; i < 20; i++) tick();
    s.joystick.vector.set(0, 0);
    return { attacking, maxDrift, lunged, walksAfter: p.y - before };
  })()`);
  assert.equal(result.attacking, true);
  assert.ok(result.maxDrift < 0.5, `공격 중 아래로 ${result.maxDrift}px 움직임`);
  assert.ok(result.lunged > 5, `공격 전진 ${result.lunged}px`);
  assert.ok(result.walksAfter > 20, `공격 뒤 걷기 ${result.walksAfter}px`);
});

test('조이스틱은 왼쪽 아래 영역 어디를 눌러도 그 자리에서 시작하고, 손을 떼면 쉬는 자리로 돌아가며, 버튼·메뉴 위에서는 잡히지 않는다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), j = s.joystick, H = 720, W = s.scale.gameSize.width;
    const rest = { x: j.centerX, y: j.centerY };
    const ptr = (id, x, y) => ({ id, x, y });
    // 예전 패드에서 먼 곳(쉬는 자리에서 300px 오른쪽 위)을 누른다.
    s.input.emit('pointerdown', ptr(41, rest.x + 300, rest.y - 200));
    const grabbed = j.isActive, center = { x: j.centerX, y: j.centerY };
    s.input.emit('pointermove', ptr(41, rest.x + 300 + j.size, rest.y - 200));
    const right = j.vector.x;
    s.input.emit('pointerup', ptr(41, rest.x + 300 + j.size, rest.y - 200));
    const released = !j.isActive && j.vector.length() === 0 && j.centerX === rest.x && j.centerY === rest.y;
    // 화면 모서리를 누르면 패드가 화면 안으로 당겨진다.
    s.input.emit('pointerdown', ptr(42, 3, H - 2));
    const corner = { x: j.centerX, y: j.centerY, r: j.size };
    s.input.emit('pointerup', ptr(42, 3, H - 2));
    // 공격 버튼, 화면 위쪽(체력 표시)은 잡지 않는다.
    s.input.emit('pointerdown', ptr(43, s.attackButton.image.x, s.attackButton.image.y));
    const onAttack = j.isActive; s.input.emit('pointerup', ptr(43, s.attackButton.image.x, s.attackButton.image.y));
    s.input.emit('pointerdown', ptr(44, 200, 100));
    const onHud = j.isActive; s.input.emit('pointerup', ptr(44, 200, 100));
    // 메뉴가 열려 있으면 잡지 않는다.
    s.openPause();
    s.input.emit('pointerdown', ptr(45, rest.x, rest.y));
    const onMenu = j.isActive; s.input.emit('pointerup', ptr(45, rest.x, rest.y));
    s.pauseMenu.close();
    return { grabbed, center: center.x === rest.x + 300 && center.y === rest.y - 200, right: right > 0.9, released,
      corner: corner.x === corner.r && corner.y === H - corner.r, onAttack, onHud, onMenu };
  })()`);
  assert.deepEqual(result, { grabbed: true, center: true, right: true, released: true, corner: true, onAttack: false, onHud: false, onMenu: false });
});

test('몬스터가 쓰러지면 머리 위 레벨 글씨도 몸과 함께 사라지고, 다시 나타나면 보인다', async () => {
  await load();
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.length > 0; })()`));
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), e = s.enemies[0], c = e.character;
    const tag = c.list.find(o => typeof o.text === 'string' && o.text.startsWith('Lv. '));
    const shown = tag.alpha;
    c.hurt(c.hp); e.kill();
    // 쓰러지는 연출은 실제 시간으로 흐르므로, 레벨 글씨가 몸과 같은 '사라지기' 연출에 들어 있는지 본다.
    const fade = s.tweens.getTweensOf(tag)[0];
    const together = !!fade && fade.targets.includes(c.sprite) && fade.targets.includes(tag);
    // 다 사라진 상태에서 다시 나타나면 레벨 글씨도 다시 보인다.
    tag.setAlpha(0);
    e.respawn(c.x, c.y);
    return { shown, together, revived: tag.alpha };
  })()`);
  assert.equal(result.shown, 1);
  assert.equal(result.together, true, '레벨 글씨도 몸과 함께 사라진다');
  assert.equal(result.revived, 1);
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
        for (let i = 0; i < 10; i++) { s.update(0, 50); }
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
      ['before', 130, 160, 605, 800], ['after', 230, 250, 700, 605],
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
        while (s.now < 1450) { s.update(0, 1000 / fps); }
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
    assert.equal(run.samples, result.results.find(r => r.stage === run.stage).samples, JSON.stringify(run));
    assert.ok(run.samples >= 6, JSON.stringify(run));
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
      while (s.now < end) { s.update(0, 16); }
      counts.push({ images, pool: s.effects.ghostPool.length,
        hidden: s.effects.ghostPool.every((e) => !e.object.active && !e.object.visible),
        children: s.effects.ghostPool.map((e) => e.object.list.length) });
    }
    s.add.image = image;
    const old = s.effects;
    s.startAttack(s.now, 1); s.now += 250; p.sprite.advance(50); s.updateAttackTrace(s.now);
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
    assert.ok(run.children.every((n) => n === 4));
  }
  assert.equal(result.oldAttackPool, 0);
  assert.equal(result.oldGhostPool, 0);
  assert.equal(result.newAttackPool, 0);
  assert.equal(result.newGhostPool, 0);
  assert.equal(result.enemies, 10);
});

test('실제 이동 방향에 맞는 원본 프레임을 표시하고 정지·잔상에서 발 위치와 그림을 유지한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, runs = [];
    s.enemies = []; s.now = 1000;
    for (const [name, x, y] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0],
      ['down-left', -.707, .707], ['down-right', .707, .707], ['up-left', -.707, -.707], ['up-right', .707, -.707]]) {
      p.revive(1000, 640); s.joystick.vector.set(x, y);
      for (let i = 0; i < 3; i++) { hero.advance(50); s.updatePlayer(s.now += 50, .05); }
      const moving = hero.image.frame.name;
      const foot = hero.image.getWorldTransformMatrix().transformPoint(0, 0);
      const mirrored = hero.image.scaleX < 0;
      s.joystick.vector.set(0, 0); s.updatePlayer(s.now += 50, .05);
      runs.push({ name, moving, idle: hero.image.frame.name, mirrored, error: Math.hypot(foot.x - p.x, foot.y - p.y) });
    }
    hero.play('dodge'); hero.advance(150);
    const ghost = hero.spawnGhost(p.x, p.y, p.y - 1, 0x9fc4ff, .35);
    hero.play('walk'); hero.setMovement(-1, -1);
    hero.spawnGhost(p.x, p.y, p.y - 1, 0x9fc4ff, .35, ghost);
    const copy = ghost.getAt(1);
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
        hero.advance(1000 / fps); s.now = 1000 + i * 1000 / fps;
        s.updateAttackLunge(s.now); s.updateAttackTrace(s.now);
      }
      runs.push({ fps, facing, stage, hits });
    }
    return runs;
  })()`);
  assert.equal(result.length, 24);
  for (const run of result) assert.equal(run.hits, 1, JSON.stringify(run));
});

test('8방향의 모든 콤보는 20·30·60·120fps에서 가까운 앞쪽만 명중하고 같은 방향으로 전진·넉백한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, enemies = s.enemies.slice(0, 4), runs = [];
    s.joystick.vector.set(0, 0);
    const directions = [['right', 1, 0], ['down-right', 1, 1], ['down', 0, 1], ['down-left', -1, 1],
      ['left', -1, 0], ['up-left', -1, -1], ['up', 0, -1], ['up-right', 1, -1]];
    const drawAttack = s.effects.drawAttack.bind(s.effects);
    let fx, maxTrailError, samples, longestPath, followThrough, maxFinishTurn, lastTip, maxFinishGap;
    s.effects.drawAttack = (effect, sweep, time, displayed) => {
      const graphic = effect.graphic, moveTo = graphic.moveTo, lineTo = graphic.lineTo;
      const path = [];
      graphic.moveTo = (x,y) => { path.push({ x, y }); return moveTo.call(graphic, x, y); };
      graphic.lineTo = (x,y) => { path.push({ x, y }); return lineTo.call(graphic, x, y); };
      try { drawAttack(effect, sweep, time, displayed); }
      finally { graphic.moveTo = moveTo; graphic.lineTo = lineTo; }
      const { base, tip } = hero.getBlade();
      const distance = (p, q) => p ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity;
      const error = effect.stage === 2
        // 찌르기 빛줄기는 칼끝 너머(칼 길이의 8%, 위쪽 3타는 원근으로 짧은 칼이라 thrustReach배)까지 뻗는다
        ? Math.max(distance(path[0], base), distance(path[2], { x: base.x + (tip.x - base.x) * effect.thrustReach * 1.08, y: base.y + (tip.y - base.y) * effect.thrustReach * 1.08 }))
        : Math.min(...path.map(p => distance(p, tip)));
      maxTrailError = Math.max(maxTrailError, error);
      const frame = hero.image.frame.name;
      fx ??= { frame, pathSize: path.length };
      longestPath = Math.max(longestPath, path.length);
      if (frame !== fx.frame) followThrough = true;
      if (frame === 'attack-side6-4' || frame === 'attack2-side6-4') {
        // Three filled smear ribbons, each with an outward and return edge. Measure the visible tip edge.
        const edge = path.slice(0, path.length / 6);
        lastTip = edge.at(-1);
        let heading;
        for (let i = 1; i < edge.length; i++) {
          const dx = edge[i].x - edge[i - 1].x, dy = edge[i].y - edge[i - 1].y;
          if (Math.hypot(dx, dy) <= 2) continue;
          const next = Math.atan2(dy, dx);
          if (heading !== undefined) {
            const turn = Math.atan2(Math.sin(next - heading), Math.cos(next - heading));
            maxFinishTurn = Math.max(maxFinishTurn ?? 0, Math.abs(turn));
          }
          heading = next;
        }
      }
      samples++;
    };
    for (const fps of [20, 30, 60, 120]) for (const [facing, signX, signY] of directions) for (const stage of [0, 1, 2]) for (const distance of [80, 110]) {
      const magnitude = Math.hypot(signX, signY), x = signX / magnitude, y = signY / magnitude;
      const worldX = x * distance, worldY = y * distance * .7, length = Math.hypot(worldX, worldY);
      const offsets = [[worldX, worldY], [-worldX, -worldY],
        [worldX - worldY / length * 100, worldY + worldX / length * 100], [worldX * 4, worldY * 4]];
      p.revive(1000, 640); s.enemies = enemies;
      const hits = [0, 0, 0, 0];
      enemies.forEach((enemy, i) => {
        enemy.character.revive(1000 + offsets[i][0], 640 + offsets[i][1]);
        enemy.character.hurt = () => { hits[i]++; return false; }; enemy.interrupt = () => {};
      });
      s.comboStage = stage; s.comboExpiresAt = 10000; s.now = 1000;
      fx = undefined; maxTrailError = 0; samples = 0; longestPath = 0; followThrough = false; maxFinishTurn = undefined; lastTip = undefined; maxFinishGap = 0;
      s.startAttack(1000, x, y);
      const texture = hero.image.texture.key, mirrored = hero.image.scaleX < 0;
      for (let i = 1; i <= Math.ceil(fps * .32); i++) {
        hero.advance(1000 / fps); s.now = 1000 + i * 1000 / fps;
        s.updateAttackLunge(s.now); s.updateAttackTrace(s.now);
        if (lastTip && hero.image.frame.name === 'attack2-side6-4') {
          const { tip } = hero.getBlade();
          maxFinishGap = Math.max(maxFinishGap, Math.hypot(lastTip.x - tip.x, lastTip.y - tip.y));
        }
      }
      const knockback = enemies[0].character.knockback;
      runs.push({ fps, facing, stage, distance, hits, texture, mirrored, fx, maxTrailError, samples, longestPath, followThrough, maxFinishTurn, maxFinishGap, signX, signY,
        dx: p.x - 1000, dy: p.y - 640, kx: knockback.x, ky: knockback.y });
    }
    return runs;
  })()`);
  assert.equal(result.length, 192);
  for (const run of result) {
    assert.deepEqual(run.hits, [1, 0, 0, 0], JSON.stringify(run));
    const downDiagSix = run.facing === 'down-right' || run.facing === 'down-left';
    const upDiagSix = run.facing === 'up-right' || run.facing === 'up-left';
    const sideSix = run.facing === 'right' || run.facing === 'left';
    const frontSix = run.facing === 'down';
    const backSix = run.facing === 'up';
    // 공격 자세는 4방향(옆·정면·뒷면) 6자세 원화로 통일되어 대각선은 옆모습을 쓴다(heroFrames.cardinalPoseFacing)
    const view = frontSix ? 'front' : backSix ? 'back' : 'side';
    assert.equal(run.texture, `hero-academy-attack${run.stage ? run.stage + 1 : ''}-${view}6`);
    assert.ok(run.fx, JSON.stringify(run));
    assert.equal(Number(run.fx.frame.slice(run.fx.frame.lastIndexOf('-') + 1)), 3, '검기는 타격 자세부터 나온다: ' + JSON.stringify(run));
    assert.ok(run.samples >= 2, JSON.stringify(run));
    assert.ok(run.maxTrailError < 1e-6, JSON.stringify(run));
    if (run.stage !== 2) assert.ok(run.longestPath > run.fx.pathSize, '베기 궤적이 점차 드러난다: ' + JSON.stringify(run));
    if ((sideSix || frontSix || downDiagSix || upDiagSix) && run.fps >= 30) assert.equal(run.followThrough, true, '마무리 자세까지 검기를 갱신한다: ' + JSON.stringify(run));
    if (sideSix && run.stage < 2) {
      assert.ok(run.maxFinishTurn < Math.PI / 4, '좌우 베기 검기의 접합부가 꺾이지 않는다: ' + JSON.stringify(run));
      // 타격 뒤 몸이 제자리로 기울어 돌아오는 여운(attackBodyMotion, 최대 0.025rad) 동안 칼끝(회전 중심에서 약 150px)이 4px 안쪽으로 움직일 수 있다.
      assert.ok(run.maxFinishGap < 5, '올려 베기 검기가 사라질 때 칼끝에서 떨어지지 않는다: ' + JSON.stringify(run));
    }
    assert.equal(run.mirrored, run.facing.includes('left'));
    assert.ok(Math.sign(run.dx) === run.signX);
    assert.ok(Math.sign(run.dy) === run.signY);
    assert.ok(Math.sign(run.kx) === run.signX);
    assert.ok(Math.sign(run.ky) === run.signY);
    if (run.signX && run.signY) {
      assert.ok(Math.abs(Math.abs(run.dy / run.dx) - .7) < 0.001);
      assert.ok(Math.abs(Math.abs(run.ky / run.kx) - .7) < 0.001);
    }
  }
});

test('근거리 찌르기와 좌우 올려 베기는 프레임 경계·변동·느린 시간에서도 앞의 적만 한 번 맞힌다', async () => {
  await load('south-field&companion=none');
  const runs = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite;
    const enemies = [s.enemies.find(e => e.kind === 'slime'), s.enemies.find(e => e.kind === 'waterdrop-mushroom')];
    s.joystick.vector.set(0, 0);
    // Keep the actual attack/lunge/lane/body collision path; omit visual allocation and knockback between samples.
    s.showDamage = () => {}; s.impacts.impact = () => {}; s.resolveEnemyHit = () => {};
    s.effects.beginAttack = () => ({}); s.effects.drawAttack = () => {};
    const patterns = [
      ...[20, 30, 50, 1000 / 17.5, 60, 1000 / 15, 75, 100, 120, 200, 240, 1000]
        .map(fps => ({ name: fps + 'fps', steps: [1000 / fps] })),
      { name: 'variable', steps: [13, 21, 17, 19, 14, 16] },
      { name: 'slow-variable', steps: [3, 6, 4, 5] },
    ];
    const attacks = [
      ['up-right', Math.SQRT1_2, -Math.SQRT1_2, 2, 70],
      ['up-left', -Math.SQRT1_2, -Math.SQRT1_2, 2, 70],
      ['right', 1, 0, 1, 110], ['left', -1, 0, 1, 110],
      ['right', 1, 0, 1, 120], ['left', -1, 0, 1, 120],
    ];
    const runs = [];
    for (const e of enemies) for (const pattern of patterns) for (const [facing, dx, dy, stage, distance] of attacks) {
      const x = dx * distance, y = dy * distance * .7, length = Math.hypot(x, y);
      const positions = [[x, y], [-x, -y], [x - y / length * 100, y + x / length * 100], [dx * 440, dy * 440 * .7]];
      const hits = [], firstHit = [];
      for (const [tx, ty] of positions) {
        p.revive(1000, 850); e.character.revive(1000 + tx, 850 + ty);
        e.character.sprite.setMovement(0, 1); e.character.sprite.advance(0);
        s.enemies = [e]; s.comboStage = stage; s.comboExpiresAt = 10000; s.now = 1000;
        let count = 0, hitAt;
        e.character.hurt = () => { count++; hitAt ??= s.now - 1000; return false; };
        e.interrupt = () => {};
        s.startAttack(1000, dx, dy);
        let elapsed = 0, index = 0;
        while (elapsed < 330) {
          const delta = pattern.steps[index++ % pattern.steps.length]; elapsed += delta;
          hero.advance(delta); s.now = 1000 + elapsed;
          s.updateAttackLunge(s.now); s.updateAttackTrace(s.now); s.updateAttackTrace(s.now);
        }
        hits.push(count); firstHit.push(hitAt);
      }
      runs.push({ kind: e.kind, pattern: pattern.name, facing, stage, distance, hits, firstHit });
    }
    return runs;
  })()`);
  assert.equal(runs.length, 168);
  for (const run of runs) {
    assert.deepEqual(run.hits, [1, 0, 0, 0], JSON.stringify(run));
    assert.ok(run.firstHit[0] + 1e-6 >= (run.stage === 1 ? 105 : 168), '준비 자세에서는 맞히지 않는다: ' + JSON.stringify(run));
  }
});

test('실제 느린 화면과 정상 속도의 장면 갱신에서도 70px 위 찌르기와 110px 좌우 2타가 맞는다', async () => {
  await load('south-field&companion=none');
  const runs = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, e = s.enemies.find(e => e.kind === 'slime'), runs = [];
    s.enemies = [e]; s.joystick.vector.set(0, 0); e.update = () => {}; e.interrupt = () => {};
    s.showDamage = () => {}; s.impacts.impact = () => {}; s.resolveEnemyHit = () => {};
    for (const slow of [false, true]) for (const [facing, dx, dy, stage, distance] of [
      ['up-right', Math.SQRT1_2, -Math.SQRT1_2, 2, 70],
      ['up-left', -Math.SQRT1_2, -Math.SQRT1_2, 2, 70],
      ['right', 1, 0, 1, 110], ['left', -1, 0, 1, 110],
    ]) {
      p.revive(1000, 850); e.character.revive(1000 + dx * distance, 850 + dy * distance * .7);
      s.comboStage = stage; s.comboExpiresAt = 10000; s.now = 1000;
      s.hitStopLeft = 0; s.slowMotionLeft = slow ? 10000 : 0; s.counterUntil = 0;
      let hits = 0; e.character.hurt = () => { hits++; return false; };
      s.startAttack(1000, dx, dy);
      for (let i = 0; i < 400 && s.now < 1330; i++) s.update(0, 1000 / 60);
      runs.push({ slow, facing, hits, elapsed: s.now - 1000 });
    }
    return runs;
  })()`);
  assert.equal(runs.length, 8);
  for (const run of runs) {
    assert.ok(run.elapsed >= 330, JSON.stringify(run));
    assert.equal(run.hits, 1, JSON.stringify(run));
  }
});

test('마지막 대각선과 자동 조준을 사용하고 공격 도중 반대 입력이 들어와도 검과 판정 방향은 고정된다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, hero = p.sprite, enemy = s.enemies[0];
    s.enemies = []; p.revive(1000, 640);
    hero.setMovement(-1, -1); hero.setMovement(0, 0);
    s.startAttack(1000, 0, 0);
    hero.advance(50);
    const before = { frame: hero.image.frame.name, scale: hero.image.scaleX, blade: hero.getBlade(), direction: {...s.attackTrace.direction} };
    hero.setMovement(1, 1); p.face(1);
    const after = { frame: hero.image.frame.name, scale: hero.image.scaleX, blade: hero.getBlade(), direction: {...s.attackTrace.direction} };
    p.endAttack(); p.revive(1000, 640); s.comboExpiresAt = 0;
    enemy.character.revive(1080, 695); s.enemies = [enemy];
    s.startAttack(2000, 0, 0);
    return { before, after, aimed: hero.image.texture.key, direction: s.attackTrace.direction };
  })()`);
  assert.ok(result.before.frame.startsWith('attack-side6-'));
  assert.ok(result.before.scale < 0);
  assert.deepEqual(result.after, result.before);
  assert.equal(result.aimed, 'hero-academy-attack-side6');
  assert.ok(result.direction.x > 0 && result.direction.y > 0);
});

test('집 앞 마을에서 시작하고 새 지형과 세로 카메라 경계가 적용된다', async () => {
  await load('village-north');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player, camera = s.cameras.main;
    const ground = s.children.list.find(o => o.texture?.key === 'village-ground');
    const home = s.children.list.find(o => o.texture?.key === 'village-buildings' && o.frame.name === 'family-house');
    const initial = { x: p.x, y: p.y, walkable: s.walkArea.contains(p.x, p.y),
      safe: s.enemies.every(e => Math.hypot(e.character.x - p.x, e.character.y - p.y) > 600) };
    s.enemies = []; p.placeAt(${mapLength(1180)}, ${mapLength(1500)}); camera.centerOn(p.x, p.y - 170);
    g.step(performance.now(), 0);
    const south = { scroll: camera.scrollY, bottom: camera.scrollY + camera.height / camera.zoom };
    p.placeAt(${mapLength(1180)}, s.walkArea.bounds.top); camera.centerOn(p.x, p.y - 170);
    g.step(performance.now(), 0);
    const nameTop = p.list.find(o => o.text === '시온').getBounds().top;
    return { initial, home: !!home, ground: { width: ground.displayWidth, height: ground.displayHeight },
      nativeGround: ground.width === ground.displayWidth && ground.height === ground.displayHeight,
      oldRoom: s.children.list.some(o => o.texture?.key === 'room'),
      ui: { width: s.scale.gameSize.width, attack: s.attackButton.image.x, dodge: s.dodgeButton.image.x, hp: s.hud.hpText.text,
        block: s.blockButton.image.x, gap: Math.hypot(s.blockButton.image.x - s.dodgeButton.image.x, s.blockButton.image.y - s.dodgeButton.image.y)
          - (s.blockButton.size + s.dodgeButton.size) * 1.2 },
      scroll: south.scroll, bottom: south.bottom, nameTop,
      skills: (() => { const mp = s.mp; s.skillButtons[0].pressed = true; s.update(0, 16);
        return { count: s.skillButtons.length, empty: s.skillSlots.every(x => x === null),
          labels: s.skillButtons.every(b => b.text.text === ''), noSpin: s.spinHitAt === undefined && s.mp >= mp }; })(),
      boundsHeight: camera.getBounds().height };
  })()`);
  assert.deepEqual(result.initial, { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, walkable: true, safe: true });
  assert.equal(result.home, true);
  assert.deepEqual(result.ground, { width: WORLD_WIDTH, height: WORLD_HEIGHT });
  assert.equal(result.nativeGround, true);
  assert.equal(result.oldRoom, false);
  assert.equal(result.ui.attack, result.ui.width - 170);
  // 막기는 공격 버튼 왼쪽 아래, 회피는 오른쪽 아래 모서리이며 터치 범위가 겹치지 않는다.
  assert.equal(result.ui.block, result.ui.width - 330);
  assert.ok(result.ui.dodge > result.ui.attack && result.ui.gap > 0, JSON.stringify(result.ui));
  // 기술 칸 다섯은 비어 있고, 눌러도 아무 기술도 나가지 않는다.
  assert.deepEqual(result.skills, { count: 5, empty: true, labels: true, noSpin: true });
  assert.equal(result.ui.hp, 'HP 100 / 100');
  assert.equal(result.boundsHeight, WORLD_HEIGHT);
  assert.ok(result.scroll > 400 && result.bottom <= WORLD_HEIGHT);
  assert.ok(result.nameTop >= 0);
});

test('이동·긴 회피 거리는 집과 바위를 통과하지 않고 나무 앞뒤는 발 위치로 정렬한다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player, home = s.walkArea.obstacles.find(o => o.shape === 'rect');
    s.enemies = []; p.revive(home.x, home.y + home.ry + 80); s.joystick.vector.set(0, -1);
    for (let i = 0; i < 60; i++) { p.sprite.advance(50); s.updatePlayer(s.now += 50, .05); }
    const stopped = { y: p.y, edge: home.y + home.ry, walkable: s.walkArea.contains(p.x, p.y), frame: p.sprite.image.frame.name };
    const out = new p.knockback.constructor();
    s.walkArea.move(home.x, home.y + home.ry + 80, 0, -500, out);
    const houseJump = { y: out.y, inside: !s.walkArea.contains(out.x, out.y) };
    const rockImage = s.children.list.find(o => o.frame?.name === 'rock');
    const rock = s.walkArea.obstacles.find(o => o.x === rockImage.x);
    s.walkArea.move(rock.x - rock.rx - 60, rock.y, rock.rx * 2 + 120, 0, out);
    const rockJump = { x: out.x, edge: rock.x - rock.rx, inside: !s.walkArea.contains(out.x, out.y) };
    const tree = s.children.list.find(o => o.frame?.name === 'oak');
    p.placeAt(tree.x + 90, tree.y - 40); s.children.depthSort();
    const behind = s.children.list.indexOf(p) < s.children.list.indexOf(tree);
    p.placeAt(tree.x + 90, tree.y + 40); s.children.depthSort();
    const front = s.children.list.indexOf(p) > s.children.list.indexOf(tree);
    return { stopped, houseJump, rockJump, behind, front };
  })()`);
  assert.equal(result.stopped.walkable, true);
  assert.ok(result.stopped.y >= result.stopped.edge && result.stopped.y < result.stopped.edge + 1);
  assert.equal(result.stopped.frame, 'walk-12');
  assert.ok(result.houseJump.y >= result.stopped.edge);
  assert.equal(result.houseJump.inside, false);
  assert.ok(result.rockJump.x <= result.rockJump.edge);
  assert.equal(result.rockJump.inside, false);
  assert.equal(result.behind, true);
  assert.equal(result.front, true);
});

test('적을 쓰러뜨리면 경험치가 쌓이고 레벨이 오르면 체력·공격력이 오르며 재시작해도 저장된 레벨로 이어진다', async () => {
  await load();
  await evaluate(`localStorage.removeItem('untitled-rpg.save'); window.__game.scene.getScene('game').scene.restart(); window.__game.step(performance.now(), 16); window.__game.step(performance.now() + 16, 16); true`);
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    const before = { level: s.progress.level, xp: s.progress.xp, maxHp: p.maxHp, damageMax: s.stats.damageMax };
    p.hurt(30);
    const hurtHp = p.hp;
    // 실제 처치 경로와 같은 함수로 경험치를 준다. 레벨 2까지 36이 필요하다(10 + 10 + 16).
    s.gainXp(10, p.x, p.y); s.gainXp(10, p.x, p.y);
    const twoKills = { level: s.progress.level, xp: s.progress.xp, hp: p.hp };
    s.gainXp(16, p.x, p.y);
    const levelUp = { level: s.progress.level, xp: s.progress.xp, hp: p.hp, maxHp: p.maxHp,
      damageMax: s.stats.damageMax, label: p.list.find((o) => o.text?.startsWith?.('Lv.'))?.text };
    s.scene.restart(); g.step(performance.now(), 16); g.step(performance.now() + 16, 16);
    const s2 = g.scene.getScene('game');
    s2.gainXp(7, s2.player.x, s2.player.y);
    const restarted = { level: s2.progress.level, xp: s2.progress.xp, maxHp: s2.player.maxHp, hp: s2.player.hp,
      label: s2.player.list.find((o) => o.text?.startsWith?.('Lv.'))?.text };
    return { before, hurtHp, twoKills, levelUp, restarted, saved: JSON.parse(localStorage.getItem('untitled-rpg.save')) };
  })()`);
  // 레벨 1: 기본 체력, 공격력은 처음 끼고 있는 나무검(STR +1)만큼 높다.
  assert.deepEqual(result.before, { level: 1, xp: 0, maxHp: 100, damageMax: 14 });
  assert.deepEqual(result.twoKills, { level: 1, xp: 20, hp: result.hurtHp });
  assert.equal(result.levelUp.level, 2);
  assert.equal(result.levelUp.xp, 0);
  // 레벨만으로는 체력이 조금 오르고(나머지는 능력치 포인트로 올린다), 레벨이 오르면 가득 찬다.
  assert.equal(result.levelUp.maxHp, 104);
  assert.equal(result.levelUp.hp, 104);
  assert.ok(result.levelUp.damageMax > result.before.damageMax);
  assert.equal(result.levelUp.label, 'Lv. 2');
  assert.deepEqual(result.restarted, { level: 2, xp: 7, maxHp: 104, hp: 104, label: 'Lv. 2' });
  assert.deepEqual(result.saved, { version: 1, level: 2, xp: 7 });

  // 페이지를 새로 열어도(앱을 껐다 켠 것과 같음) 이어서 시작하고, 깨진 저장은 무시한다.
  await load();
  const reopened = await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    return { level: s.progress.level, xp: s.progress.xp, maxHp: s.player.maxHp }; })()`);
  assert.deepEqual(reopened, { level: 2, xp: 7, maxHp: 104 });
  await evaluate(`localStorage.setItem('untitled-rpg.save', '{broken'); true`);
  await load();
  const corrupted = await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    const r = { level: s.progress.level, xp: s.progress.xp }; localStorage.removeItem('untitled-rpg.save'); return r; })()`);
  assert.deepEqual(corrupted, { level: 1, xp: 0 });
});

test('대화 대상 근처에서만 대화가 열리고, 대화 중에는 게임 시계가 멈추며, 넘기기 입력이 공격으로 이어지지 않는다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(performance.now(), 16); };
    for (const e of s.enemies) { e.character.placeAt(${mapLength(300)}, ${mapLength(1500)}); e.state = 'wander'; e.timer = 1e12; }
    const sign = s.map.interactables[0];
    step();
    const atSpawn = s.primaryAction !== 'attack';
    p.placeAt(sign.x - 60, sign.y + 20); step();
    const nearSign = s.attackButton.shown && s.talkMarker.visible;
    // 대화 버튼을 누른 것과 같은 효과
    s.attackButton.pressed = true; step();
    const opened = s.dialogue.isOpen;
    const frozenAt = s.now; step(30);
    const frozen = s.now === frozenAt;
    // 탭으로 끝까지 넘긴다 (줄마다: 글자 모두 보이기 → 다음 줄)
    let taps = 0;
    while (s.dialogue.isOpen && taps < 20) { s.onDialoguePointer(); taps++; step(); }
    // 다시 열고, 넘기는 동안 Space를 누른 것처럼 공격 입력을 남긴 채 닫는다.
    // 닫힐 때 공격 입력이 지워져 공격으로 이어지지 않아야 한다.
    s.attackButton.pressed = true; step();
    const reopened = s.dialogue.isOpen;
    while (s.dialogue.isOpen) { s.keyboardAttackPressed = true; s.attackBufferedUntil = s.now + 999; s.onDialoguePointer(); }
    step(3);
    const attackedAfterClose = p.isAttacking || !reopened;
    // 전투 중에는 대화 버튼이 사라진다
    // 쫓아오는 적은 플레이어 가까이에 둔다(맵이 넓어져 예전 고정 좌표는 추격 거리 밖이었다).
    s.enemies[0].state = 'chase'; s.enemies[0].character.placeAt(p.x + 250, p.y); step();
    const inCombat = s.primaryAction !== 'attack';
    return { atSpawn, nearSign, opened, frozen, closed: !s.dialogue.isOpen, taps, attackedAfterClose, inCombat };
  })()`);
  assert.equal(result.atSpawn, false);
  assert.equal(result.nearSign, true);
  assert.equal(result.opened, true);
  assert.equal(result.frozen, true);
  assert.equal(result.closed, true);
  assert.equal(result.taps, 4);
  assert.equal(result.attackedAfterClose, false);
  assert.equal(result.inCombat, false);
});

test('공격이 닿기 직전의 회피만 저스트 회피가 되어 느린 화면·반격·회피 초기화가 일어나고, 일찍 피하면 일반 회피다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(performance.now(), 16); };
    // 적 하나를 플레이어 바로 왼쪽에 두고 오른쪽(플레이어 쪽)을 보며 공격을 시작하게 한다.
    const run = (leadMs) => {
      s.scene.restart(); step(2);
      const s2 = g.scene.getScene('game'), p2 = s2.player, e = s2.enemies[0];
      for (const other of s2.enemies.slice(1)) { other.character.placeAt(300, 1500); other.state = 'wander'; other.timer = 1e12; }
      p2.placeAt(1600, 1200); e.character.placeAt(1520, 1200); e.character.face(1);
      s2.dodgeReadyAt = 0; p2.invulnerableUntil = 0;
      const hp = p2.hp;
      e.beginWindup(s2.now, 1);
      const strikeAt = s2.now + 480 + 110; // ENEMY.windupMs + strikeMs
      // 공격이 닿기 leadMs 전까지 기다렸다가 오른쪽으로 회피한다.
      while (s2.now < strikeAt - leadMs) step();
      s2.startDodge(s2.now, s2.input2.set(1, 0));
      const nowAtDodge = s2.now;
      step(8);
      const outcome = { slow: s2.slowMotionLeft > 0 || s2.now - nowAtDodge < 8 * 16 * 0.9, justDodged: s2.justDodged,
        counterReady: s2.counterUntil > s2.now, dodgeReady: s2.dodgeReadyAt <= s2.now, hpLost: hp - p2.hp,
        enemyState: e.state };
      // 반격: 창 안에서 시작한 공격은 반격으로 표시된다.
      p2.placeAt(e.character.x + 80, e.character.y); p2.endAttack(); s2.nextAttackAt = 0; s2.dodgeProgress = 1;
      s2.startAttack(s2.now, -1, 0);
      outcome.counterAttack = !!s2.attackTrace?.counter;
      return outcome;
    };
    return { just: run(100), early: run(450) };
  })()`);
  assert.equal(result.just.justDodged, true);
  assert.equal(result.just.slow, true);
  assert.equal(result.just.counterReady, true);
  assert.equal(result.just.dodgeReady, true);
  assert.equal(result.just.hpLost, 0);
  assert.equal(result.just.enemyState, 'recover');
  assert.equal(result.just.counterAttack, true);

  assert.equal(result.early.justDodged, false);
  assert.equal(result.early.counterReady, false);
  assert.equal(result.early.counterAttack, false);
});

test('일시정지는 게임 시계를 멈추고, 뒤로가기·앱 전환으로도 열리며, 설정은 바로 적용되고 다시 열어도 유지된다', async () => {
  await load();
  await evaluate(`localStorage.removeItem('untitled-rpg.settings'); true`);
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(performance.now(), 16); };
    step();
    const before = { attack: s.attackButton.size, joystick: s.joystick.size, window: s.justDodgeWindow };
    s.pauseButton.pressed = true; step();
    const opened = s.pauseMenu.isOpen;
    const frozenAt = s.now; step(20);
    const frozen = s.now === frozenAt;
    // 설정 변경: 버튼 크게, 조이스틱 작게, 판정 여유
    s.pauseMenu.settingsButton.emit('pointerup');
    s.pauseMenu.rows[0].choices[2].button.emit('pointerup');
    s.pauseMenu.rows[1].choices[0].button.emit('pointerup');
    s.pauseMenu.rows[2].choices[2].button.emit('pointerup');
    const changed = { attack: s.attackButton.size, joystick: s.joystick.size, window: s.justDodgeWindow,
      saved: JSON.parse(localStorage.getItem('untitled-rpg.settings')) };
    // 메뉴를 누르던 공격 입력이 남아 있어도 닫은 뒤 공격하지 않는다.
    s.keyboardAttackPressed = true; s.attackBufferedUntil = s.now + 999;
    s.pauseMenu.close(); step(3);
    const attackedAfterResume = s.player.isAttacking;
    // 앱을 내리면 일시정지, 뒤로가기는 메뉴에서 게임으로, 게임에서 메뉴로
    g.events.emit('hidden'); const hidden = s.pauseMenu.isOpen;
    s.onBackButton(); const backClosed = !s.pauseMenu.isOpen;
    s.onBackButton(); const backOpened = s.pauseMenu.isOpen;
    s.pauseMenu.close();
    return { before, opened, frozen, changed, attackedAfterResume, hidden, backClosed, backOpened };
  })()`);
  assert.equal(result.opened, true);
  assert.equal(result.frozen, true);
  assert.ok(result.changed.attack > result.before.attack);
  assert.ok(result.changed.joystick < result.before.joystick);
  assert.ok(result.changed.window > result.before.window);
  assert.deepEqual(result.changed.saved, { buttonSize: 'large', joystickSize: 'small', justDodgeTiming: 'lenient' });
  assert.equal(result.attackedAfterResume, false);
  assert.equal(result.hidden, true);
  assert.equal(result.backClosed, true);
  assert.equal(result.backOpened, true);

  await load();
  const reopened = await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    const r = { settings: s.settings, window: s.justDodgeWindow }; localStorage.removeItem('untitled-rpg.settings'); return r; })()`);
  assert.deepEqual(reopened.settings, { buttonSize: 'large', joystickSize: 'small', justDodgeTiming: 'lenient' });
  assert.equal(reopened.window, result.changed.window);
});

test('느린 화면 중의 공격도 맞고, 칼이 닿으면 게임 시간이 잠깐 멈추며 맞은 슬라임은 납작해졌다가 돌아온다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game;
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(performance.now(), 16); };
    const setup = () => {
      g.scene.getScene('game').scene.restart(); step(2);
      const s = g.scene.getScene('game'), p = s.player, e = s.enemies[0];
      for (const o of s.enemies.slice(1)) { o.character.placeAt(300, 1500); o.state = 'wander'; o.timer = 1e12; }
      p.placeAt(1600, 1200); e.character.placeAt(1680, 1200); e.state = 'wander'; e.timer = 1e12; e.character.hp = 999;
      return { s, p, e };
    };
    // 느린 화면 중 공격 (예전에는 그림이 먼저 끝나 빗나갔다)
    let { s, e } = setup();
    s.slowMotionLeft = 650; s.startAttack(s.now, 1, 0); step(80);
    const slowDamage = 999 - e.character.hp;
    // 히트스톱과 찌그러짐: 칼이 처음 닿는 프레임을 찾는다
    ({ s, e } = setup());
    s.startAttack(s.now, 1, 0);
    let frames = 0;
    while (e.character.hp === 999 && frames < 200) { step(); frames++; }
    const hitAtNow = s.now, stop = s.hitStopLeft, squash = e.character.sprite.scaleX;
    step(1);
    const frozenAfterHit = s.now === hitAtNow;
    step(30);
    const resumed = s.now > hitAtNow;
    const settled = Math.abs(e.character.sprite.scaleX - 1) < 1e-6 && Math.abs(e.character.sprite.scaleY - 1) < 1e-6;
    return { slowDamage, hit: e.character.hp < 999, stop, frozenAfterHit, resumed, squash, settled };
  })()`);
  assert.ok(result.slowDamage > 0, '느린 화면 중 공격이 맞아야 한다');
  assert.equal(result.hit, true);
  assert.ok(result.stop > 0);
  assert.equal(result.frozenAfterHit, true);
  assert.equal(result.resumed, true);
  assert.ok(result.squash > 1.1);
  assert.equal(result.settled, true);
});

test('로웬 마을 사람들은 이름표를 달고, 장사하는 사람은 제자리에 있고, 나머지는 맵 안을 넓게 걸어 다니며, 다가가도 계속 걷다가 말을 걸 때만 돌아본다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const g = window.__game;
    let s = g.scene.getScene('game');
    let t = performance.now();
    s.player.placeAt(s.map.spawn.x, s.map.spawn.y);
    const start = Object.fromEntries(s.npcs.map(n => [n.def.id, { x: n.x, y: n.y }]));
    const names = Object.fromEntries(s.npcs.filter(n=>!n.def.id.startsWith('guard-')).map(n => [n.def.id, n.list.find(o => o.text !== undefined)?.text]));
    const visible = s.npcs.every(n => n.list.some(o => o.texture && o.texture.key !== 'shadow' && o.texture.key !== '__MISSING' && o.displayHeight > 100));
    // 돌아다니다 제자리 근처로 돌아올 수도 있으니, 처음 자리에서 가장 멀리 간 거리를 잰다.
    const moved = Object.fromEntries(s.npcs.map(n => [n.def.id, 0]));
    // 화면을 900번 그리면 헤드리스 브라우저의 그리기 작업이 밀리므로, 게임 갱신(update)만 돌린다.
    for (let i = 0; i < 900; i++) {
      s.update(t += 16, 16);
      for (const n of s.npcs) moved[n.def.id] = Math.max(moved[n.def.id], Math.round(Math.hypot(n.x - start[n.def.id].x, n.y - start[n.def.id].y)));
    }
    let onGround = s.npcs.every(n => s.walkArea.contains(n.x, n.y));
    const count = s.npcs.filter(n=>!n.def.id.startsWith('guard-')).length;
    // 마을 북쪽(집들)의 네 사람도 이름표를 달고 돌아다닌다.
    s.scene.restart({ map: 'village-north' }); g.step(t += 16, 16);
    s = g.scene.getScene('game');
    s.player.placeAt(1180, 1440);
    const northStart = Object.fromEntries(s.npcs.map(n => [n.def.id, { x: n.x, y: n.y }]));
    Object.assign(names, Object.fromEntries(s.npcs.filter(n=>!n.def.id.startsWith('guard-')).map(n => [n.def.id, n.list.find(o => o.text !== undefined)?.text])));
    for (const n of s.npcs) moved[n.def.id] = 0;
    for (let i = 0; i < 900; i++) {
      s.update(t += 16, 16);
      for (const n of s.npcs) moved[n.def.id] = Math.max(moved[n.def.id], Math.round(Math.hypot(n.x - northStart[n.def.id].x, n.y - northStart[n.def.id].y)));
    }
    onGround &&= s.npcs.every(n => s.walkArea.contains(n.x, n.y));
    const northCount = s.npcs.filter(n=>!n.def.id.startsWith('guard-')).length;
    s.scene.restart({ map: 'village' }); g.step(t += 16, 16);
    s = g.scene.getScene('game');
    // 걷고 있는 루안 옆에 서도 루안은 멈추지 않고 계속 걷는다.
    const ruan = s.npcs.find(n => n.def.id === 'ruan');
    const goal = [{ x: ruan.x - 200, y: ruan.y }, { x: ruan.x + 200, y: ruan.y }].find(p => s.walkArea.contains(p.x, p.y) && s.walkArea.hasClearPath(ruan.x, ruan.y, p.x, p.y));
    ruan.restUntil = 0; ruan.target = goal; ruan.walkStartedAt = s.now;
    s.player.placeAt(ruan.x + 50, ruan.y + 10);
    const before = { x: ruan.x, y: ruan.y };
    for (let i = 0; i < 30; i++) s.update(t += 16, 16);
    const keptWalking = Math.hypot(ruan.x - before.x, ruan.y - before.y) > 20;
    const spotFollows = ruan.spot.x === ruan.x && ruan.spot.y === ruan.y;
    // 말을 걸면 그때 멈춰서 이쪽을 보고, 대화가 끝나도 잠깐 서 있다가 다시 걷는다.
    s.player.placeAt(ruan.x + 60, ruan.y + 10);
    s.openDialogue(ruan.spot);
    g.step(t += 16, 16);
    const dialogue = { open: s.dialogue.isOpen, name: s.dialogue.nameText.text, portrait: s.dialogue.portrait.texture.key };
    const faces = ruan.direction === 'right' || ruan.direction === 'down-right' || ruan.direction === 'up-right';
    s.dialogue.close();
    const stoppedAt = { x: ruan.x, y: ruan.y };
    for (let i = 0; i < 60; i++) s.update(t += 16, 16);
    const stayed = ruan.x === stoppedAt.x && ruan.y === stoppedAt.y;
    for (let i = 0; i < 600; i++) s.update(t += 16, 16);
    const resumed = Math.hypot(ruan.x - stoppedAt.x, ruan.y - stoppedAt.y) > 20;
    return { count, northCount, names, visible, moved, onGround, keptWalking, faces, stayed, resumed, spotFollows, dialogue,
      talkable: s.interactables.filter(i => i.id.startsWith('npc-')&&!i.id.startsWith('npc-guard-')).length };
  })()`);
  // 장사하는 세 사람(메리나·도란·로제타)은 가게 안, 에일라는 치유소 안, 시온의 가족·이웃 넷은 마을 북쪽, 셋은 광장에 있다.
  assert.equal(result.count, 3);
  assert.equal(result.northCount, 4);
  assert.equal(result.talkable, 3);
  assert.equal(result.visible, true);
  assert.deepEqual(result.names, {
    serena: '세레나', sia: '시아', linea: '리네아', ruan: '루안', herman: '헤르만',
    vernel: '베르넬', teon: '테온',
  });
  for (const id of ['serena', 'sia', 'linea', 'ruan', 'herman', 'vernel', 'teon']) {
    assert.ok(result.moved[id] > 15, `${id} moved ${result.moved[id]}`);
  }
  // 처음 자리에 묶이지 않고 멀리(예전 돌아다니던 반경 70~150px의 두 배 넘게) 간 사람이 여럿이다.
  assert.ok(Object.entries(result.moved).filter(([id, d]) => !id.startsWith('guard-') && d > 300).length >= 3, JSON.stringify(result.moved));
  assert.equal(result.onGround, true);
  assert.equal(result.keptWalking, true, '다가가도 멈추지 않는다');
  assert.equal(result.faces, true, '말을 걸면 이쪽(오른쪽)을 본다');
  assert.equal(result.stayed, true, '대화 뒤 잠깐 서 있다');
  assert.equal(result.resumed, true, '그 뒤 다시 걷는다');
  assert.equal(result.spotFollows, true);
  assert.deepEqual(result.dialogue, { open: true, name: '루안', portrait: 'portrait-ruan' });

  // 치유사 에일라는 치유소 안에서 조금씩 오간다. 시온은 멀리(침대 옆)에 세운다.
  await load('in-clinic');
  const clinic = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    let t = performance.now();
    const bed = s.interactables.find(i => i.id === 'heal-clinic');
    s.player.placeAt(bed.x, bed.y + 30);
    const eila = s.npcs.find(n => n.def.id === 'eila');
    const start = { x: eila.x, y: eila.y };
    let moved = 0;
    for (let i = 0; i < 900; i++) {
      s.update(t += 16, 16);
      moved = Math.max(moved, Math.hypot(eila.x - start.x, eila.y - start.y));
    }
    return { name: eila.list.find(o => o.text !== undefined)?.text, moved: moved > 15, onGround: s.walkArea.contains(eila.x, eila.y) };
  })()`);
  assert.deepEqual(clinic, { name: '에일라', moved: true, onGround: true });
});
test('성능 테스트 모드는 마을에 사람을 더 세우고 FPS·메모리를 보여 주며, 끄면 원래대로 돌아간다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const label = () => s.pauseMenu.stressButton.text;
    const before = { npcs: s.npcs.length, perf: !!s.perf, label: label() };
    s.scene.restart({ map: 'village', stress: 100 });
    g.step(t += 16, 16);
    for (let i = 0; i < 120; i++) s.update(t += 16, 16);
    s.perf.update(600);
    const on = { npcs: s.npcs.length, perf: s.perf.text.text, label: label(),
      onGround: s.npcs.every(n => s.walkArea.contains(n.x, n.y)) };
    s.scene.restart();
    g.step(t += 16, 16);
    const kept = s.npcs.length;
    s.pauseMenu.options.onStress(); // 100 → 200
    g.step(t += 16, 16);
    const next = s.npcs.length;
    s.scene.restart({ map: 'village', stress: 0 });
    g.step(t += 16, 16);
    return { before, on, kept, next, off: { npcs: s.npcs.length, perf: !!s.perf, label: label() } };
  })()`);
  assert.deepEqual(result.before, { npcs: 11, perf: false, label: '성능 테스트: 끔' });
  assert.equal(result.on.npcs, 111);
  assert.equal(result.on.label, '성능 테스트: 100명');
  assert.equal(result.on.onGround, true);
  assert.match(result.on.perf, /FPS \d+/);
  assert.match(result.on.perf, /인물 111 · 그림 메모리 \d+MB/);
  assert.equal(result.kept, 111);
  assert.equal(result.next, 211);
  assert.deepEqual(result.off, { npcs: 11, perf: false, label: '성능 테스트: 끔' });
});
test('퀘스트: 머리 위 표시, 대화로 받고 완료, 목록 표시, 저장 후 재시작에도 유지되고 미니맵에 그려진다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const g = window.__game;
    let s = g.scene.getScene('game');
    let t = performance.now();
    localStorage.removeItem('untitled-rpg.quests');
    s.scene.restart({ map: 'village' }); g.step(t += 16, 16);
    const marker = (id) => s.npcs.find(n => n.def.id === id).questMarker;
    const talk = (id) => { const n = s.npcs.find(n => n.def.id === id); s.openDialogue(n.spot); const name = s.dialogue.nameText.text;
      while (s.dialogue.isOpen) s.dialogue.advance(); return name; };
    const start = { ruan: marker('ruan'), doran: s.doorMarkers.find(d => d.spot.id === 'door-smithy').marker, smithyDoor: s.doorMarkers.find(d => d.spot.id === 'door-smithy').text.visible, teon: marker('teon'), vernel: marker('vernel') ?? null, tracker: s.questTracker.text.text };
    const speaker = talk('ruan');
    const accepted = { ruan: marker('ruan'), tracker: s.questTracker.text.text };
    // 3단 콤보의 마지막 일격을 세 번 시작하면 목표를 채운다.
    for (let i = 0; i < 3; i++) { s.comboStage = 2; s.comboExpiresAt = s.now + 999; s.startAttack(s.now, 0); s.now += 2000; }
    const ready = { ruan: marker('ruan'), tracker: s.questTracker.text.text };
    const xpBefore = s.progress.xp + s.progress.level * 1000;
    talk('ruan');
    const xpAfter = s.progress.xp + s.progress.level * 1000;
    const afterDone = { ruan: marker('ruan') };
    talk('ruan');
    s.player.placeAt(1600, 1150);
    for (let i = 0; i < 10; i++) g.step(t += 16, 16);
    s.minimap.elapsed = 999; s.update(t, 16);
    const ctx = s.minimap.texture.context, px = ctx.getImageData(150, 150, 1, 1).data, edge = ctx.getImageData(150, 6, 1, 1).data;
    const minimap = { center: [px[0], px[1], px[2]], edgeAlpha: edge[3], visible: s.minimap.image.visible, title: s.minimap.title.text };
    s.scene.restart(); g.step(t += 16, 16);
    return { start, speaker, accepted, ready, xpGained: xpAfter > xpBefore, afterDone, minimap,
      reloaded: { quests: s.quests, ruan: marker('ruan'), tracker: s.questTracker.text.text } };
  })()`);
  // 도란은 대장간 안에 있어서, 마을에서는 대장간 문 위에 표시가 뜬다.
  assert.deepEqual(result.start, { ruan: 'new', doran: 'sub-new', smithyDoor: true, teon: 'sub-new', vernel: null, tracker: '' });
  assert.equal(result.speaker, '루안');
  assert.equal(result.accepted.ruan, 'progress');
  assert.match(result.accepted.tracker, /마지막 수련 · 3단 콤보 마무리 0\/3/);
  assert.equal(result.ready.ruan, 'ready');
  assert.match(result.ready.tracker, /마지막 수련 · 루안에게 보고/);
  assert.equal(result.xpGained, true);
  assert.equal(result.afterDone.ruan, 'progress');
  assert.deepEqual(result.minimap.center, [94, 200, 255], '가운데는 플레이어(하늘색 점)');
  assert.ok(result.minimap.edgeAlpha > 200, '테두리가 그려진다');
  assert.equal(result.minimap.title, '로웬 마을');
  assert.deepEqual(result.reloaded.quests, { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'active', count: 0 } });
  assert.equal(result.reloaded.ruan, 'progress');
  assert.match(result.reloaded.tracker, /몸을 빼는 법 · 회피 3번 0\/3/);
});
test('골드와 아이템: 슬라임이 골드를 떨어뜨리고, 물약 버튼으로 회복하고, 잡화점에서 사고팔며, 재시작해도 남는다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const g = window.__game;
    let s = g.scene.getScene('game');
    let t = performance.now();
    // 이 테스트에서 오른 레벨과 가방은 끝날 때 되돌려, 다음 테스트에 영향을 주지 않는다.
    const savedProgress = localStorage.getItem('untitled-rpg.save');
    localStorage.removeItem('untitled-rpg.inventory');
    s.scene.restart({ map: 'south-field' }); g.step(t += 16, 16);
    s.quickSlots=[null,null];s.refreshInventory();
    const start = { gold: s.inventory.gold, hud: s.hud.goldText.text, label: s.potionButton.text.text };
    // 슬라임을 한 번에 쓰러뜨린다.
    const e = s.enemies[0], c = e.character, p = s.player;
    s.enemies = [e]; c.hp = 1; c.setPosition(p.x + 60, p.y); p.face(1);
    s.startAttack(s.now, 1, 0);
    for (let i = 0; i < 40 && c.alive; i++) g.step(t += 16, 16);
    const afterKill = { alive: c.alive, gold: s.inventory.gold, hud: s.hud.goldText.text };
    // 물약: 체력이 가득하면 못 쓰고, 다치면 버튼으로 쓴다.
    s.inventory = { gold: 100, items: { potion: 2 } }; s.refreshInventory();
    s.openQuickSlot(0);s.quickSlotPanel.rows[0].button.emit('pointerup');
    // 쓰러뜨린 순간의 히트스톱이 끝날 때까지 기다린다 (멈춘 동안 누른 버튼은 끝난 뒤 처리된다).
    for (let i = 0; i < 20; i++) g.step(t += 16, 16);
    s.potionButton.pressed = true; for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const fullHp = s.inventory.items.potion;
    p.hp = 30; s.drawHud(); s.potionButton.pressed = true; for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const healed = { hp: p.hp, potions: s.inventory.items.potion, label: s.potionButton.text.text };
    // 잡화점
    s.openItemPanel('shop');
    const frozen = s.now; g.step(t += 16, 16); const paused = s.now === frozen;
    s.onItemAction({ type: 'buy', id: 'potion' });
    s.inventory = { ...s.inventory, items: { ...s.inventory.items, 'slime-gel': 2 } };
    s.onItemAction({ type: 'sell', id: 'slime-gel' });
    const shop = { gold: s.inventory.gold, potions: s.inventory.items.potion, gel: s.inventory.items['slime-gel'] ?? 0 };
    s.itemPanel.close();
    s.scene.restart(); g.step(t += 16, 16);
    const reloaded = s.inventory;
    if (savedProgress === null) localStorage.removeItem('untitled-rpg.save'); else localStorage.setItem('untitled-rpg.save', savedProgress);
    localStorage.removeItem('untitled-rpg.inventory');
    s.scene.restart(); g.step(t += 16, 16);
    return { start, afterKill, fullHp, healed, paused, shop, reloaded };
  })()`);
  assert.deepEqual(result.start, { gold: 0, hud: '● 0 G', label: '등록' });
  assert.equal(result.afterKill.alive, false);
  assert.ok(result.afterKill.gold >= 3 && result.afterKill.gold <= 6, String(result.afterKill.gold));
  assert.equal(result.afterKill.hud, `● ${result.afterKill.gold} G`);
  assert.equal(result.fullHp, 2, '체력이 가득하면 물약을 쓰지 않는다');
  assert.deepEqual(result.healed, { hp: 80, potions: 1, label: '물약 1' });
  assert.equal(result.paused, true, '잡화점이 열려 있으면 게임이 멈춘다');
  assert.deepEqual(result.shop, { gold: 100 - 20 + 4, potions: 2, gel: 1 });
  assert.deepEqual(result.reloaded, { gold: 84, items: { potion: 2, 'slime-gel': 1 } });
});
test('건물 문 앞에서 들어가기를 누르면 실내로 들어가고, 아래쪽 문으로 나오면 그 건물 문 앞에 선다', async () => {
  await load('village');
  const result = await evaluate(`(async () => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const waitMap = async target => {
      for (let i = 0; i < 300; i++) {
        step();
        if (s.mapId === target && s.sys.isActive() && s.minimap) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw Error('맵 입장 시간 초과: ' + target);
    };
    s.scene.restart({ map: 'village' }); step();
    const door = s.interactables.find(i => i.id === 'door-inn');
    s.player.placeAt(door.x, door.y + 10); step(2);
    const atDoor = { button: s.attackButton.text.text, visible: s.attackButton.image.visible, marker: s.talkMarker.text };
    s.attackButton.pressed = true; step();
    const started = s.traveling;
    await waitMap('in-inn');
    step(2);
    const inside = { map: s.mapId, x: s.player.x, y: s.player.y, walkable: s.walkArea.contains(s.player.x, s.player.y),
      npcs: s.npcs.length, enemies: s.enemies.length, minimap: s.minimap.title.text,
      bounds: s.cameras.main.getBounds().width >= s.scale.gameSize.width };
    // 가구는 막힌다: 바(카운터) 한가운데는 걸을 수 없다.
    const counter = s.map.interior.furniture.find(f => f.kind === 'counter');
    const room = s.map.bounds;
    const blocked = !s.walkArea.contains(room.left + counter.x, room.top + counter.y - counter.d / 2);
    // 문 근처를 지나가기만 해서는 나가지 않는다.
    const exitSpot = s.interactables.find(i => i.id === 'exit-inn');
    s.player.placeAt(exitSpot.x, exitSpot.y - 10); step(3);
    const nearDoor = { map: s.mapId, button: s.attackButton.text.text, visible: s.attackButton.image.visible, marker: s.talkMarker.text };
    // 나가기 버튼을 누르면 나간다.
    s.attackButton.pressed = true; step();
    await waitMap('village');
    step(2);
    return { atDoor, started, inside, blocked, nearDoor, back: { map: s.mapId, x: s.player.x, y: s.player.y, door: { x: door.x, y: door.y } } };
  })()`);
  assert.equal(result.atDoor.visible, true);
  assert.equal(result.atDoor.button, '들어가기');
  assert.equal(result.atDoor.marker, '▲ 여관');
  assert.equal(result.started, true);
  assert.equal(result.inside.map, 'in-inn');
  assert.equal(result.inside.walkable, true);
  assert.deepEqual([result.inside.npcs, result.inside.enemies, result.inside.minimap], [1, 0, '여관'], '여관 안에는 로제타가 있다');
  assert.equal(result.inside.bounds, true);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.nearDoor, { map: 'in-inn', button: '나가기', visible: true, marker: '▼ 나가기' });
  assert.equal(result.back.map, 'village');
  // 문 앞에 서되, 들어가기 지점보다 조금 앞이라 나오자마자 다시 들어가기가 뜨지 않는다.
  const fromDoor = Math.hypot(result.back.x - result.back.door.x, result.back.y - result.back.door.y);
  assert.ok(fromDoor > 70 && fromDoor < 100, String(fromDoor));
});
test('실내 전경(계산대 앞면·문턱)은 원화 전체에서 잘라 그려져, 계산대 뒤의 사람을 가린다', async () => {
  for (const [map, id] of [['in-store', 'merina'], ['in-inn', 'rosetta']]) {
    await load(map);
    const r = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game');
      const fg = s.children.list.filter(o => o.name === 'map-art-foreground');
      const npc = s.npcs.find(n => n.def.id === '${id}');
      const counters = fg.filter(o => o.texture.key.includes('-foreground-') && o.depth > npc.depth && o.depth < npc.depth + 200);
      const walls = fg.filter(o => !o.texture.key.includes('-foreground-'));
      return { all: walls.length === 2 && walls.every(o => o._crop.width > 0 && o._crop.height > 0),
        counter: counters.filter(o => o.width > 0 && o.height > 0).length };
    })()`);
    assert.equal(r.all, true, map + ': 잘린 전경이 비어 있지 않다');
    assert.ok(r.counter >= 1, map + ': 계산대 앞면이 ' + id + '보다 앞에 그려진다');
  }
});

test('시온 집의 상자와 바구니 윤곽만 가리며 옆 통로의 바닥은 시온을 덮지 않는다', async () => {
  await load('in-home');
  const result = await evaluate(`(async () => {
    const { interiorArtRect } = await import('/src/world/interiors.ts');
    const s = window.__game.scene.getScene('game');
    const rect = interiorArtRect(s.map.interior);
    const width = rect.right - rect.left, height = rect.bottom - rect.top;
    const point = (x, y) => ({ x: rect.left + x * width / 768, y: rect.top + y * height / 512 });
    const alphaAt = (object, point) => {
      const x = Math.floor(point.x - object.x), y = Math.floor(point.y - object.y);
      if (x < 0 || y < 0 || x >= object.width || y >= object.height) return 0;
      return object.texture.context.getImageData(x, y, 1, 1).data[3];
    };
    const foot = point(560, 342);
    s.player.placeAt(foot.x, foot.y);
    const overlays = s.children.list.filter(o => o.name === 'interior-occluder' && o.depth > s.player.depth);
    const basket = overlays.find(o => o.getData('furnitureId') === 'home-barrel-10');
    const chest = s.children.list.find(o => o.name === 'interior-occluder' && o.getData('furnitureId') === 'home-crate-9');
    return {
      walkable: s.walkArea.contains(foot.x, foot.y),
      floor: overlays.every(o => alphaAt(o, point(566, 334)) === 0),
      basketGap: basket && alphaAt(basket, point(568, 353)) === 0,
      solidBasket: basket && alphaAt(basket, point(587, 379)) === 255,
      solidChest: chest && alphaAt(chest, point(657, 354)) === 255,
    };
  })()`);
  assert.deepEqual(result, { walkable: true, floor: true, basketGap: true, solidBasket: true, solidChest: true });
});

test('잡화점 안의 메리나에게 카운터 앞에서 말을 걸면 대화 뒤 잡화점이 열린다', async () => {
  await load('in-store');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const merina = s.npcs.find(n => n.def.id === 'merina');
    const counter = s.map.interior.furniture.find(f => f.kind === 'counter');
    const counterFront = s.map.bounds.top + counter.y;
    s.player.placeAt(merina.spot.x, merina.spot.y + 20);
    for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const ready = { button: s.attackButton.image.visible, label: s.attackButton.text.text, behind: merina.y > counterFront - counter.d && merina.y < counterFront && s.children.list.some(o => o.name === 'map-art-foreground' && o.depth > merina.depth), standing: s.player.y > counterFront };
    s.openDialogue(merina.spot);
    const name = s.dialogue.nameText.text;
    while (s.dialogue.isOpen) s.dialogue.advance();
    const shop = s.itemPanel.isOpen;
    s.itemPanel.close();
    return { npcs: s.npcs.map(n => n.def.id), ready, name, shop };
  })()`);
  assert.deepEqual(result.npcs, ['merina']);
  assert.deepEqual(result.ready, { button: true, label: '대화', behind: true, standing: true });
  assert.equal(result.name, '메리나');
  assert.equal(result.shop, true);
});
test('북쪽 건물 뒤의 틈으로는 들어갈 수 없고, 다른 건물 뒤에 서도 실내로 들어가지 않는다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const hall = s.map.buildings.find(b => b.frame === 'training-hall').footprint[0];
    s.player.placeAt(hall.x, hall.y - hall.ry - 25);
    for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const map = s.mapId;
    s.scene.restart({ map: 'village-north' }); g.step(t += 16, 16);
    const n = g.scene.getScene('game');
    const chief = n.map.buildings.find(b => b.frame === 'chief-house').footprint[0];
    return { map, gap: n.walkArea.contains(chief.x, n.map.bounds.top + 4) };
  })()`);
  assert.equal(result.map, 'village');
  assert.equal(result.gap, false);
});
test('미니맵을 누르면 현재 맵 원화와 실제 내 위치가 보이고, 열린 동안 멈추며 반복·회전에도 객체를 재사용한다', async () => {
  for(const map of ['village','village-north','south-field','west-forest','east-stream','in-home','in-store']) {
    await load(map);
    const result=await evaluate(`(() => {
      const g=window.__game,s=g.scene.getScene('game');
      s.minimap.image.emit('pointerup');const m=s.worldMap;
      const r=m.mapRect,b=m.preview.bounds;
      const expected={x:r.x+(s.player.x-b.left)/(b.right-b.left)*r.w,y:r.y+(s.player.y-b.top)/(b.bottom-b.top)*r.h};
      const first={open:m.isOpen,title:m.title.text,expected:s.map.name,key:m.image.texture.key,
        aligned:Math.hypot(m.here.x-expected.x,m.here.y-expected.y)<.01,
        npcs:m.dots.npcs.length,enemies:m.dots.enemies.length,labels:m.labels.map(l=>l.text.text),
        inside:m.here.x>=r.x&&m.here.x<=r.x+r.w&&m.here.y>=r.y&&m.here.y<=r.y+r.h};
      const now=s.now;s.update(0,50);const frozen=s.now===now;
      m.image.emit('pointerup');const inspecting=m.isOpen;
      const count=s.children.length,keys=Object.keys(s.textures.list).length;
      for(let i=0;i<5;i++){m.close();s.openWorldMap();m.layout(i%2?960:1558);}
      const stable=s.children.length===count&&Object.keys(s.textures.list).length===keys;
      const labelsInside=m.labels.filter(l=>l.direction).every(l=>{const b=l.text.getBounds(),r=m.mapRect;return b.left>=r.x&&b.right<=r.x+r.w+1&&b.top>=r.y&&b.bottom<=r.y+r.h+1;});
      m.closeButton.emit('pointerup');const closed=!m.isOpen;
      s.openWorldMap();m.shade.emit('pointerup');
      return {first,frozen,inspecting,stable,labelsInside,closed,outsideClosed:!m.isOpen};
    })()`);
    assert.equal(result.first.open,true,map);assert.equal(result.first.title,result.first.expected,map);
    assert.equal(result.first.key,'current-area-preview');assert.equal(result.first.aligned,true,map);
    assert.equal(result.first.inside,true,map);assert.ok(result.first.labels.length>0,map);
    for(const name of ['frozen','inspecting','stable','labelsInside','closed','outsideClosed']) assert.equal(result[name],true,map+': '+name);
  }
});

test('목적지 안내는 실제 출구 근처에만 나타나고 지도·일시정지 중에는 숨으며 습격 때 이동 제한을 알린다',async()=>{
  await load('village');
  const r=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    const at=(x,y)=>{s.player.placeAt(x,y);s.update(0,16);return {visible:s.exitHint.title.visible,text:s.exitHint.title.text,detail:s.exitHint.detail.text};};
    const far=at(1200,750),near=at(250,1050);
    s.openWorldMap();const mapHidden=!s.exitHint.title.visible;s.worldMap.close();
    at(250,1050);s.openPause();s.update(0,16);const pauseHidden=!s.exitHint.title.visible;s.pauseMenu.back();
    s.quests={'festival-eve':{status:'done',count:1},'village-raid':{status:'active',count:0}};
    const blocked=at(250,1050);s.player.placeAt(80,1050);s.update(0,16);
    return {far,near,mapHidden,pauseHidden,blocked,stayed:s.mapId==='village'&&!s.traveling};
  })()`);
  assert.equal(r.far.visible,false);assert.equal(r.near.visible,true);
  assert.ok(r.near.text.includes('서쪽')&&r.near.text.includes('서쪽 숲길'));
  assert.equal(r.mapHidden,true);assert.equal(r.pauseHidden,true);
  assert.ok(r.blocked.detail.includes('습격'));assert.equal(r.stayed,true);
});
test('마을 출구로 사냥터에 갔다가 돌아오고, 체력·레벨은 이어지며 마을에는 몬스터가 없다', async () => {
  await load('village');
  const result = await evaluate(`(async () => {
    const { exitPoint } = await import('/src/world/mapNavigation.ts');
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const travel = async (x, y) => {
      // 장면이 다시 시작되면 플레이어도 새로 만들어지므로 매번 s.player를 쓴다.
      const from = s.mapId; s.player.placeAt(x, y); step();
      const started = s.traveling, frozenAt = s.now; step(3);
      const frozen = s.now === frozenAt;
      for (let i = 0; i < 300; i++) {
        step();
        if (s.mapId !== from && s.sys.isActive() && s.minimap) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      step(2);
      return { started, frozen, map: s.mapId, x: s.player.x, y: s.player.y, hp: s.player.hp,
        enemies: s.enemies.length, traveling: s.traveling, hint: s.map.hint };
    };
    const travelTo = id => { const at = exitPoint(s.map, s.map.exits.find(e => e.to === id)); return travel(at.x, at.y); };
    const village = { enemies: s.enemies.length, map: s.mapId };
    s.player.hurt(25);
    const south = await travelTo('south-field');
    const backFromSouth = await travelTo('village');
    const west = await travelTo('west-forest');
    const backFromWest = await travelTo('village');
    const east = await travelTo('east-stream');
    const backFromEast = await travelTo('village');
    const north = await travelTo('village-north');
    const backFromNorth = await travelTo('village');
    await travelTo('east-stream');
    const restartedHere = (() => { s.scene.restart(); step(2); return { map: s.mapId, hp: s.player.hp, maxHp: s.player.maxHp }; })();
    return { village, south, backFromSouth, west, backFromWest, east, backFromEast, north, backFromNorth, restartedHere };
  })()`);
  assert.deepEqual(result.village, { enemies: 0, map: 'village' });
  assert.equal(result.south.started, true);
  assert.equal(result.south.frozen, true);
  assert.equal(result.south.map, 'south-field');
  assert.deepEqual([result.south.x, result.south.y], [1687.4, 600.6]);
  assert.equal(result.south.hp, 75);
  assert.equal(result.south.enemies, 10);
  assert.equal(result.south.traveling, false);
  assert.equal(result.backFromSouth.map, 'village');
  // 남문 아치 그림 뒤가 아니라 아치 안쪽 광장에 선다.
  assert.deepEqual([result.backFromSouth.x, result.backFromSouth.y], [mapLength(1180), VILLAGE_GATES.south.y - mapLength(280)]);
  assert.equal(result.backFromSouth.enemies, 0);
  assert.equal(result.backFromSouth.hp, 75);
  assert.equal(result.west.map, 'west-forest');
  assert.equal(result.backFromWest.map, 'village');
  // 서문 기둥과 문지기 사이가 아니라 문 안쪽으로 조금 들어온 곳에 선다.
  assert.deepEqual([result.backFromWest.x, result.backFromWest.y], [mapLength(400), mapLength(1050)]);
  assert.equal(result.east.map, 'east-stream');
  assert.equal(result.east.enemies, 5);
  assert.equal(result.backFromEast.map, 'village');
  assert.equal(result.north.map, 'village-north');
  assert.equal(result.backFromNorth.map, 'village');
  // 같은 맵에서 다시 시작하면 그 맵에 남고, 체력은 다시 이어 받지 않는다.
  assert.equal(result.restartedHere.map, 'east-stream');
  assert.equal(result.restartedHere.hp, result.restartedHere.maxHp);
});

test('세레나는 안전 확인 대화 뒤 북쪽 출입구로 걸어 대피하고 재진입해도 광장에 되돌아오지 않는다', async () => {
  await load('village');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'festival-eve') break;
    }
    seed['village-raid'] = { status: 'active', step: 3, count: 0 };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.festival', 'seen');
  })()`);
  await load('village');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), n = s.npcs.find(n => n.def.id === 'serena');
    const at = { x: n.x, y: n.y }; s.player.placeAt(n.spot.x, n.spot.y);
    s.attackButton.pressed = true; s.updateInteraction(s.now);
    while (s.dialogue.isOpen) s.dialogue.advance();
    const started = n.walking && n.visible, interactive = s.interactables.includes(n.spot);
    const step = s.quests['village-raid'].step;
    s.refreshQuests(); s.refreshQuests();
    let blocked = false, moved = false;
    for (let i = 0; i < 1200 && s.npcs.includes(n); i++) {
      s.update(0, 50); blocked ||= !s.walkArea.contains(n.x, n.y);
      moved ||= Math.hypot(n.x - at.x, n.y - at.y) > 20;
    }
    const zone = s.map.exits.find(e => e.to === 'village-north').zone;
    return { started, interactive, step, blocked, moved, left: !s.npcs.includes(n),
      atExit: n.x >= zone.left && n.x <= zone.right && n.y >= zone.top && n.y <= zone.bottom };
  })()`);
  assert.deepEqual(result, { started: true, interactive: false, step: 4, blocked: false, moved: true, left: true, atExit: true });
  await load('village');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.some(n => n.def.id === 'serena')`), false);
  await load('in-clinic');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.find(n => n.def.id === 'serena').currentStoryAction`), 'wring-cloth');
});

test('세레나는 치유소와 자택에서 간호·물수건 준비를 반복하며 대화 뒤에도 간호를 이어 간다', async () => {
  await load('village');
  for (const [through, map, nursing] of [['village-raid', 'in-clinic', 'nurse-left'], ['first-sword', 'in-linea', 'nurse-right']]) {
    await evaluate(`(async () => {
      const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
      for (const q of QUESTS.filter(q => q.main)) {
        seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
        if (q.id === ${JSON.stringify(through)}) break;
      }
      localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
      localStorage.setItem('untitled-rpg.festival', 'seen');
    })()`);
    await load(map);
    const result = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game'), n = s.npcs.find(n => n.def.id === 'serena');
      const frames = new Set(); let blocked = false, walked = false;
      const step = () => {
        const at = { x: n.x, y: n.y }; s.update(0, 50);
        blocked ||= !s.walkArea.contains(n.x, n.y);
        walked ||= !n.currentStoryAction && Math.hypot(n.x - at.x, n.y - at.y) > .01;
      };
      const until = check => { for (let i = 0; i < 1400 && !check(); i++) step(); return check(); };
      const talk = () => {
        s.player.placeAt(n.spot.x, n.spot.y); s.attackButton.pressed = true; s.updateInteraction(s.now); if (s.storyChoice.isOpen) s.storyChoice.choose(0);
        const opened = s.dialogue.isOpen, ownPortrait = s.dialogue.lines.some(l => l.portrait === 'serena');
        const before = n.currentStoryAction;
        while (s.dialogue.isOpen) s.dialogue.advance();
        const frame = n.figure.frame.name;
        for (let i = 0; i < 5; i++) step();
        const paused = frame === n.figure.frame.name;
        s.player.placeAt(s.map.spawn.x, s.map.spawn.y);
        return { opened, ownPortrait, before, after: n.currentStoryAction, paused };
      };
      const start = n.currentStoryAction, kneelingLabel = n.nameLabel.y;
      for (let i = 0; i < 40; i++) { frames.add(n.figure.frame.name); step(); }
      const nursingTalk = talk();
      const beganWalking = until(() => n.currentStoryAction === undefined), walkingLabel = n.nameLabel.y;
      const reachedWater = until(() => n.currentStoryAction === 'wring-cloth');
      const water = { x: n.x, y: n.y, frame: n.figure.frame.name };
      for (let i = 0; i < 12; i++) step();
      const waterAnimates = water.frame !== n.figure.frame.name, waterTalk = talk();
      const returned = until(() => n.currentStoryAction === start);
      return { start, frames: [...frames], kneelingLabel, walkingLabel, nursingTalk, waterTalk, beganWalking, reachedWater,
        waterAnimates, returned, blocked, walked, flipX: n.figure.flipX,
        atBed: Math.hypot(n.x - n.def.duty[0].x, n.y - n.def.duty[0].y) };
    })()`);
    assert.equal(result.start, nursing); assert.equal(result.frames.length, 4);
    assert.equal(result.kneelingLabel, -135); assert.equal(result.walkingLabel, -158);
    for (const key of ['beganWalking', 'reachedWater', 'waterAnimates', 'returned', 'walked']) assert.equal(result[key], true, key);
    assert.equal(result.blocked, false); assert.ok(result.atBed < .01); assert.equal(result.flipX, nursing === 'nurse-right');
    for (const talk of [result.nursingTalk, result.waterTalk]) {
      assert.equal(talk.opened, true); assert.equal(talk.ownPortrait, true); assert.equal(talk.before, talk.after); assert.equal(talk.paused, true);
    }
    await load(map);
    assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.find(n => n.def.id === 'serena').currentStoryAction`), nursing);
  }
});

test('여러 사람이 모여 손이 닿으면 이름표를 정리하고 대화 버튼으로 이야기할 사람을 고른다', async () => {
  await load('village');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'first-sword') break;
    }
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.festival', 'seen');
  })()`);
  await load('in-linea');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const linea = s.npcs.find(n => n.def.id === 'linea'), serena = s.npcs.find(n => n.def.id === 'serena');
    const eila = s.npcs.find(n => n.def.id === 'eila');
    // 에일라가 치료하러 와서 리네아와 대화하는 자리 곁에 선 순간: 시온은 리네아 쪽에 조금 더 가깝게 선다.
    eila.placeAt(linea.spot.x + 90, linea.spot.y);
    s.player.placeAt(linea.spot.x + 30, linea.spot.y); s.updateInteraction(s.now);
    const labels = { target: linea.nameLabel.style.color, other: eila.nameLabel.alpha, activity: eila.activity.alpha };
    s.attackButton.pressed = true; s.updateInteraction(s.now);
    const picking = s.storyChoice.isOpen && s.menuOpen();
    const names = s.storyChoice.options.filter(b => b.visible).map(b => b.text);
    s.storyChoice.choose(1);
    const portrait = s.dialogue.isOpen && s.dialogue.lines[0].portrait;
    while (s.dialogue.isOpen) s.dialogue.advance();
    if (s.storyChoice.isOpen) s.storyChoice.cancel();
    // 한 사람만 닿는 자리에서는 고르지 않고 바로 대화하며, 이름표도 평소대로 돌아온다.
    s.player.placeAt(s.map.spawn.x, s.map.spawn.y); s.updateInteraction(s.now);
    const restored = eila.nameLabel.alpha === 1 && eila.activity.alpha === 1;
    s.player.placeAt(serena.spot.x, serena.spot.y); s.attackButton.pressed = true; s.updateInteraction(s.now);
    const direct = !s.storyChoice.isOpen && s.dialogue.isOpen;
    while (s.dialogue.isOpen) s.dialogue.advance();
    return { labels, picking, names, portrait, restored, direct };
  })()`);
  assert.deepEqual(result.labels, { target: '#ffe46b', other: .5, activity: 0 });
  assert.equal(result.picking, true);
  assert.deepEqual(result.names, ['리네아', '에일라']);
  assert.equal(result.portrait, 'eila');
  assert.equal(result.restored, true);
  assert.equal(result.direct, true);
});

test('에일라는 약품 준비와 짧은 병상 치료를 반복하고, 대화·이동·재접속 뒤에도 올바른 동작을 유지한다', async () => {
  await load('village');
  for (const [through, map, treatment] of [['village-raid', 'in-clinic', 'treat-left'], ['first-sword', 'in-linea', 'treat-right']]) {
    await evaluate(`(async () => {
      const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
      for (const q of QUESTS.filter(q => q.main)) {
        seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
        if (q.id === ${JSON.stringify(through)}) break;
      }
      localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
      localStorage.setItem('untitled-rpg.festival', 'seen');
    })()`);
    await load(map);
    const result = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game'), e = s.npcs.find(n => n.def.id === 'eila'), patient = s.npcs.find(n => n.def.id === 'linea');
      const frames = new Set(), walking = new Set(); let blocked = false;
      const step = () => {
        const x = e.x, y = e.y;
        s.update(0, 50); blocked ||= !s.walkArea.contains(e.x, e.y);
        if (Math.hypot(e.x - x, e.y - y) > .001 && !e.currentStoryAction) walking.add(e.figure.texture.key);
      };
      const until = check => { for (let i = 0; i < 900 && !check(); i++) step(); return check(); };
      const talk = () => {
        s.player.placeAt(e.spot.x, e.spot.y); s.attackButton.pressed = true; s.updateInteraction(s.now); if (s.storyChoice.isOpen) s.storyChoice.choose(0);
        const opened = s.dialogue.isOpen, ownPortrait = s.dialogue.lines.some(l => l.portrait === 'eila');
        const before = e.currentStoryAction;
        while (s.dialogue.isOpen) s.dialogue.advance();
        if (s.storyChoice.isOpen) s.storyChoice.cancel();
        const frame = e.figure.frame.name;
        for (let i = 0; i < 5; i++) step();
        const paused = frame === e.figure.frame.name;
        s.player.placeAt(s.map.spawn.x, s.map.spawn.y);
        return { opened, ownPortrait, before, after: e.currentStoryAction, paused };
      };
      // 약을 준비하다(duty[0]) 병상으로 가서 짧게 치료하고(duty[1]) 다시 준비 자리로 돌아온다.
      const start = e.currentStoryAction;
      const medicine = { x: e.x, y: e.y, frame: e.figure.frame.name };
      for (let i = 0; i < 12; i++) step();
      const medicineAnimates = medicine.frame !== e.figure.frame.name;
      const medicineTalk = talk();
      const startedWalking = until(() => e.currentStoryAction === undefined);
      const walkingTalk = talk();
      const reachedBed = until(() => e.currentStoryAction === ${JSON.stringify(treatment)});
      const bed = { x: e.x, y: e.y };
      for (let i = 0; i < 40; i++) { frames.add(e.figure.frame.name); step(); }
      const treatingTalk = talk(), flipX = e.figure.flipX;
      const returned = until(() => e.currentStoryAction === start);
      return { start, frames: [...frames], treatingTalk, walkingTalk, startedWalking, medicineTalk, reachedBed, medicineAnimates,
        returned, blocked, walking: [...walking], atBed: Math.hypot(bed.x - e.def.duty[1].x, bed.y - e.def.duty[1].y),
        patientAction: patient.currentStoryAction, flipX,
        atMedicine: Math.hypot(medicine.x - e.def.duty[0].x, medicine.y - e.def.duty[0].y) };
    })()`);
    assert.equal(result.start, 'mix-herbs'); assert.equal(result.frames.length, 4);
    assert.equal(result.startedWalking, true); assert.equal(result.reachedBed, true); assert.equal(result.medicineAnimates, true); assert.equal(result.returned, true);
    assert.equal(result.blocked, false); assert.ok(result.walking.length > 0); assert.ok(result.atBed < .01); assert.ok(result.atMedicine < .01);
    assert.equal(result.flipX, treatment === 'treat-right');
    for (const talk of [result.treatingTalk, result.walkingTalk, result.medicineTalk]) {
      assert.equal(talk.opened, true); assert.equal(talk.ownPortrait, true); assert.equal(talk.before, talk.after); assert.equal(talk.paused, true);
    }
    assert.equal(result.patientAction, map === 'in-clinic' ? 'unconscious' : 'journal');
    await load(map);
    assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.find(n => n.def.id === 'eila').currentStoryAction`), 'mix-herbs');
  }
});

test('리네아는 구조 후 병상에서 의식을 되찾고 출발 전 집에서 요양하며 대화해도 일어서지 않는다', async () => {
  await load('village');
  for (const [through, map, action, raidStep] of [
    ['festival-eve', 'in-clinic', 'unconscious', 5],
    ['village-raid', 'in-clinic', 'unconscious', undefined],
    ['missing-sia', 'in-clinic', 'awake', undefined],
    ['first-sword', 'in-linea', 'journal', undefined],
  ]) {
    await evaluate(`(async () => {
      const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
      for (const q of QUESTS.filter(q => q.main)) {
        seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
        if (q.id === ${JSON.stringify(through)}) break;
      }
      if (${JSON.stringify(raidStep ?? null)} !== null) seed['village-raid'] = { status: 'active', step: 5, count: 0 };
      localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
      localStorage.setItem('untitled-rpg.festival', 'seen');
    })()`);
    await load(map);
    const result = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game'), n = s.npcs.find(n => n.def.id === 'linea');
      const before = JSON.stringify(s.quests), frame = n.figure.frame.name, at = { x: n.x, y: n.y };
      s.player.placeAt(n.spot.x, n.spot.y);
      const reachable = s.walkArea.contains(n.spot.x, n.spot.y);
      s.attackButton.pressed = true; s.updateInteraction(s.now);
      const picked = s.storyChoice.isOpen; if (picked) s.storyChoice.choose(0);
      const opened = s.dialogue.isOpen;
      const lines = s.dialogue.lines.map(l => ({ speaker: l.speaker, portrait: l.portrait }));
      while (s.dialogue.isOpen) s.dialogue.advance();
      for (let i = 0; i < 100; i++) n.update(s.now + i * 50, .05, s.player, s.walkArea);
      const bed = s.children.list.find(o => o.name?.startsWith('interior-furniture-') && o.getData('kind') === 'bed');
      return { frame, afterFrame: n.figure.frame.name, action: n.currentStoryAction, at, after: { x: n.x, y: n.y },
        reachable, opened, lines, unchanged: JSON.stringify(s.quests) === before, aboveBed: n.depth > bed.depth,
        marker: n.questMarker, carers: s.npcs.filter(n => ['eila', 'serena'].includes(n.def.id)).map(n => n.def.id).sort() };
    })()`);
    assert.equal(result.action, action); assert.equal(result.frame, action); assert.equal(result.afterFrame, action);
    assert.deepEqual(result.after, result.at); assert.equal(result.reachable, true); assert.equal(result.opened, true); assert.equal(result.aboveBed, true);
    assert.deepEqual(result.carers, ['eila', 'serena']);
    if (action === 'unconscious') {
      assert.ok(result.lines.every(l => l.speaker !== '리네아')); assert.equal(result.unchanged, true); assert.equal(result.marker, undefined);
    } else assert.ok(result.lines.some(l => l.portrait === 'linea'));
  }
});

test('후속 메인: 전달·매듭·순찰·축제 선택·습격 전투·수색·서신이 재시작 후에도 이어진다', async () => {
  await load('village');
  const result = await evaluate(`(async () => {
    const { QUESTS, currentObjective } = await import('/src/story/quests.ts');
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const seed = {};
    // 루안의 숲 퀘스트(초반 수련 포함)까지 끝낸 저장에서 시작한다.
    const mains = QUESTS.filter(q => q.main);
    for (const q of mains.slice(0, mains.findIndex(q => q.id === 'ruan-forest') + 1)) seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    const restart = async map => {
      s.scene.restart({ map }); g.step(t += 16, 16);
      for (let i = 0; i < 300; i++) {
        s = g.scene.getScene('game');
        if (s.mapId === map && s.sys.isActive() && s.minimap) return;
        await new Promise(resolve => setTimeout(resolve, 10)); g.step(t += 16, 16);
      }
      throw Error('맵 재시작 시간 초과: ' + map);
    };
    const flush = () => { while (s.dialogue.isOpen) s.dialogue.advance(); };
    const settle = () => { for (let i = 0; i < 30; i++) g.step(t += 16, 16); s = g.scene.getScene('game'); };
    // 장면이 다른 맵으로 다시 시작할 때(습격 권속 그림을 읽는 동안) 준비될 때까지 기다린다.
    const ready = async map => {
      for (let i = 0; i < 300; i++) {
        g.step(t += 16, 16); s = g.scene.getScene('game');
        if (s.mapId === map && s.sys.isActive() && s.minimap && !s.traveling) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw Error('준비 시간 초과: ' + map);
    };
    const talk = id => { const n = s.npcs.find(n => n.def.id === id); if (!n) throw Error('NPC 없음: ' + id); s.openDialogue(n.spot); flush(); };
    const inspect = id => { const spot = s.interactables.find(p => p.id === id); if (!spot) throw Error('조사 지점 없음: ' + id); s.openDialogue(spot); flush(); };
    await restart('village');
    const migrated = s.quests['watch-report']?.status;
    talk('teon');
    await restart('in-inn'); talk('rosetta');
    await restart('village-north'); talk('linea'); talk('sia'); talk('linea');
    // 수확제 일손: 헤르만 → 도란(걸쇠) → 메리나(초) → 헤르만
    talk('herman');
    await restart('in-smithy'); talk('doran'); s.characterPanel.close();
    await restart('in-store'); talk('merina');
    await restart('village-north'); talk('herman');
    const harvest = s.quests['harvest-help']?.status;
    await restart('village');
    const patrolMarker = s.storyMarkers.length;
    inspect('story-south-watch'); talk('teon');
    // 잿빛 날갯가루: 들판의 나방 4마리 → 풀숲 살피기 → 테온
    await restart('south-field');
    const moths = s.enemies.filter(e => e.kind === 'ashen-moth').length;
    for (let i = 0; i < 4; i++) s.questEvent({ type: 'kill', map: 'south-field', monster: 'ashen-moth' });
    inspect('story-moth-nest');
    await restart('village'); talk('teon');
    await restart('in-inn');
    s.openDialogue(s.npcs.find(n => n.def.id === 'rosetta').spot);
    const choice = s.storyChoice.isOpen;
    const frozenAt = s.now; s.update(0, 100); const frozen = s.now === frozenAt;
    s.storyChoice.cancel();
    const cancelled = s.quests['festival-eve'].status === 'active' && !s.quests['village-raid'];
    s.openDialogue(s.npcs.find(n => n.def.id === 'rosetta').spot);
    s.storyChoice.accept(); flush(); await ready('village');
    // 잔치를 시작하면 광장에서 수확제 연출이 나온다. 건너뛰면 광장이 습격 상태로 다시 열린다.
    const festival = { playing: !!s.opening && s.playFestival, sia: s.npcs.some(n => n.def.id === 'sia'), enemies: s.enemies.length };
    s.opening.skip(); await ready('village');
    const raid = { map: s.mapId, enemies: s.enemies.length, sia: s.npcs.some(n => n.def.id === 'sia'), shade: !!s.chapterShade,
      festival: localStorage.getItem('untitled-rpg.festival') };
    s.player.placeAt(1180, 1130); s.player.invulnerableUntil = Infinity;
    s.stats.damageMin = 1000; s.stats.damageMax = 1000;
    for (const e of s.enemies) { e.character.placeAt(1250, 1130); e.character.hp = 1; }
    s.comboStage = 2; s.comboExpiresAt = s.now + 9999; s.nextAttackAt = 0;
    s.startAttack(s.now, 1);
    for (let i = 0; i < 16; i++) { s.player.sprite.advance(50); s.now += 50; s.updateAttackLunge(s.now); s.updateAttackTrace(s.now); }
    const battle = { alive: s.enemies.filter(e => e.character.alive).length, pending: s.enemyRespawns.length, step: s.quests['village-raid'].step };
    await restart('village');
    const noRespawn = s.enemies.length === 0;
    // 테온을 살피면 여관 앞 골목에 다음 무리가 나타난다.
    const clear = () => { for (const e of [...s.raidEnemies].filter(e => e.character.alive)) { e.character.hp = 0; s.resolveEnemyHit(e, true, 1, 0, 0); } };
    talk('teon');
    const wave2 = s.enemies.filter(e => e.character.alive).length;
    clear(); talk('serena');
    // 북쪽 길: 추적자 넷·나방 넷을 막으면 경고 뒤에 보스 집행자
    await restart('village-north');
    const wave3 = s.enemies.map(e => e.kind);
    clear();
    const warned = s.bossHud.warning && !s.boss;
    for (let i = 0; i < 400 && !s.boss; i++) g.step(t += 16, 16);
    const boss = s.boss?.kind;
    clear(); inspect('story-north-alley');
    // 북쪽 길을 막은 뒤 에일라는 다친 사람들과 치유소에 있다.
    await restart('in-clinic'); talk('eila');
    await restart('village'); talk('ruan'); settle();
    await restart('village-north');
    const aftermath = { sia: s.npcs.some(n => n.def.id === 'sia'), linea: s.npcs.some(n => n.def.id === 'linea'), shade: !!s.chapterShade };
    await restart('in-clinic'); talk('serena');
    await restart('village-north');
    const searchMarker = s.storyMarkers.length;
    await restart('village-north');
    const searchRestored = s.interactables.some(p => p.id === 'story-home-search');
    inspect('story-home-search'); await restart('in-clinic'); talk('eila'); talk('linea');
    await restart('village-north'); talk('herman');
    await restart('village'); talk('vernel');
    // 도란의 검: 도란이 무기 칸을 1단계 진화(도란의 검)로 승급해 준다.
    await restart('in-smithy'); talk('doran'); s.characterPanel.close();
    const sword = s.character.gear.rank.weapon;
    await restart('village');
    // 1장의 메인 퀘스트는 모두 끝나고, 2장의 첫 퀘스트(남문의 수레)가 이어진다.
    const complete = mains.slice(0, mains.findIndex(q => q.id === 'first-sword') + 1).every(q => s.quests[q.id]?.status === 'done');
    const tracker = s.questTracker.text.text;
    localStorage.removeItem('untitled-rpg.quests');
    await restart('village');
    localStorage.removeItem('untitled-rpg.festival');
    return { sword, migrated, harvest, moths, patrolMarker, choice, frozen, cancelled, festival, raid, battle, noRespawn, wave2, wave3, warned, boss, aftermath, searchMarker, searchRestored, complete, tracker };
  })()`, 90000); // 여러 맵을 연속 재시작하며 원화를 읽는 긴 시나리오다.
  assert.equal(result.migrated, 'active');
  assert.equal(result.harvest, 'done');
  assert.equal(result.moths, 4);
  assert.equal(result.patrolMarker, 1);
  assert.equal(result.choice, true);
  assert.equal(result.frozen, true);
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.festival, { playing: true, sia: true, enemies: 0 });
  assert.deepEqual(result.raid, { map: 'village', enemies: 6, sia: false, shade: true, festival: 'seen' });
  assert.deepEqual(result.battle, { alive: 0, pending: 0, step: 1 });
  assert.equal(result.noRespawn, true);
  assert.equal(result.wave2, 3);
  assert.deepEqual([...result.wave3].sort(), [...Array(4).fill('ashen-moth'), ...Array(4).fill('corrosion-tracker')]);
  assert.equal(result.warned, true, '첫 떼를 다 잡으면 보스 등장 경고');
  assert.equal(result.boss, 'corrosion-executioner');
  assert.deepEqual(result.aftermath, { sia: false, linea: false, shade: false });
  assert.equal(result.searchMarker, 1);
  assert.equal(result.searchRestored, true);
  assert.equal(result.complete, true);
  assert.equal(result.sword, 1);
  assert.match(result.tracker, /남문의 수레/);
});

test('원화가 있는 실내 여덟 곳과 단일 배경 사냥터는 해당 그림만 읽고, 전경·충돌·출입을 유지한다', async () => {
  for (const id of ['home', 'linea', 'chief', 'clinic', 'hall', 'store', 'smithy', 'inn', 'south-field', 'reed-swamp']) {
    const map = ['south-field', 'reed-swamp'].includes(id) ? id : 'in-' + id;
    await load(map);
    const art = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game');
      const background = s.children.getByName('map-art-background');
      const foreground = s.children.list.filter(c => c.name === 'map-art-foreground');
      return { key: background.texture.key, width: background.displayWidth, height: background.displayHeight,
        native: s.children.list.filter(c => c.name.startsWith('map-art-') || c.name.startsWith('interior-furniture-')).every(c => c.displayWidth === c.width && c.displayHeight === c.height),
        textures: Object.keys(s.textures.list).filter(k => k.startsWith('map-art-')),
        foreground: foreground.map(c => ({ width: c.displayWidth, depth: c.depth })),
        walkable: s.walkArea.contains(s.player.x, s.player.y),
        blocked: s.map.interior ? s.map.interior.furniture.every(f => !s.walkArea.contains(s.map.bounds.left + f.x, s.map.bounds.top + f.y - f.d / 2)) : !s.walkArea.contains(...(s.map.id === 'south-field' ? [1865.703125, 2095.84375] : [725, 795])) };
    })()`);
    assert.equal(art.key, 'map-art-' + id);
    assert.ok(art.textures.every(k => k === art.key || k.startsWith(art.key + '-foreground-')), id + ': 다른 맵 원화를 미리 읽지 않는다');
    assert.equal(art.walkable, true, id);
    assert.equal(art.blocked, true, id);
    assert.ok(art.width > 0 && art.height > 0, id);
    assert.equal(art.native, true, id);
    if (id === 'south-field' || id === 'reed-swamp') assert.equal(art.foreground.length, 0, '나무·바위는 배경 복사 대신 독립 소품으로 그린다');
    else {
      assert.ok(art.foreground.length >= 2, id);
      const back = await evaluate(`(async () => {
        const g = window.__game, s = g.scene.getScene('game'), spot = s.interactables.find(i => i.enter), exit = spot.enter;
        let t = performance.now();
        s.player.placeAt(spot.x, spot.y - 10);
        for (let i = 0; i < 3; i++) g.step(t += 16, 16);
        s.attackButton.pressed = true;
        for (let i = 0; i < 300; i++) {
          g.step(t += 16, 16);
          if (s.mapId === exit.to && s.sys.isActive() && s.minimap) return { map: s.mapId, expected: exit.to, walkable: s.walkArea.contains(s.player.x, s.player.y) };
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw Error('실내 출구 이동 실패');
      })()`);
      assert.equal(back.map, back.expected, id);
      assert.equal(back.walkable, true, id);
    }
  }
});

test('맵을 지정하지 않으면 처음 화면에서 시작하고, 시작하기를 누르면 화면이 스르르 바뀌어 시온의 집 앞에서 시작한다', async () => {
  const search = '?test=' + ++navigation;
  await send('Page.navigate', { url: appUrl + search });
  await until(() => evaluate(`location.search === ${JSON.stringify(search)} && !!window.__game?.scene.isActive('title')`));
  const before = await evaluate(`(() => {
    const g = window.__game, t = g.scene.getScene('title');
    return { game: g.scene.isActive('game'), start: t.startButton.text, settings: t.settingsButton.text };
  })()`);
  assert.deepEqual(before, { game: false, start: '시작하기', settings: '설정' });
  // 설정은 일시정지 메뉴의 설정 화면을 열고, 돌아가기로 닫힌다.
  const settings = await evaluate(`(() => {
    const t = window.__game.scene.getScene('title');
    t.menu.openSettings(); const open = t.menu.isOpen; t.menu.back();
    return { open, closed: !t.menu.isOpen };
  })()`);
  assert.deepEqual(settings, { open: true, closed: true });
  // 시작하기: 바로 넘어가지 않고 어두워진 뒤 게임이 시작된다.
  const fading = await evaluate(`(() => {
    const g = window.__game, t = g.scene.getScene('title');
    t.start(); t.start();
    return { fading: t.cameras.main.fadeEffect.isRunning, game: g.scene.isActive('game') };
  })()`);
  assert.deepEqual(fading, { fading: true, game: false });
  await until(() => evaluate(`!!window.__game.scene.getScene('game')?.damageNumbers && window.__game.scene.isActive('game')`));
  const after = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    return { title: g.scene.isActive('title'), map: s.mapId, fadeIn: s.cameras.main.fadeEffect.isRunning || s.cameras.main.fadeEffect.progress > 0 };
  })()`);
  assert.equal(after.title, false);
  assert.equal(after.map, 'village-north');
  assert.equal(after.fadeIn, true);
  await evaluate('window.__game.loop.sleep()');
});

test('조작 설정은 선택 표시·미리보기·저장을 갱신하고, 화면 크기 변경·재진입·기본값 복원에도 일관된다', async () => {
  await load('village-north');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), m=s.pauseMenu;
    m.openSettings();
    const count=s.children.list.length;
    const expected={buttonSize:'small',joystickSize:'large',justDodgeTiming:'strict'};
    for(const row of m.rows) row.choices.find(c=>c.value===expected[row.key]).button.emit('pointerup');
    const selected=m.rows.every(r=>r.choices.filter(c=>c.button.text.startsWith('✓')).length===1 &&
      r.choices.find(c=>c.value===expected[r.key]).button.text.startsWith('✓'));
    const saved=JSON.parse(localStorage.getItem('untitled-rpg.settings'));
    const preview=m.previewLabel.text;
    const bounds=[];
    for(const width of [960,1280,1728]) {
      m.layout(width);
      bounds.push(m.rows.every(r=>{
        const d=r.description.getBounds(), choices=r.choices.map(c=>c.button.getBounds());
        return d.right<choices[0].left && choices.every(b=>b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=720);
      }));
    }
    m.layout(s.scale.gameSize.width);
    for(let i=0;i<4;i++){m.back();m.openSettings();}
    const reused=s.children.list.length===count;
    const retained=m.rows.every(r=>r.choices.find(c=>c.value===expected[r.key]).button.text.startsWith('✓'));
    m.resetButton.emit('pointerup');
    const reset={...s.settings}, resetSaved=JSON.parse(localStorage.getItem('untitled-rpg.settings'));
    const defaultSelected=m.rows.every(r=>r.choices[1].button.text.startsWith('✓'));
    m.backButton.emit('pointerup');
    const closed=!m.isOpen;
    localStorage.removeItem('untitled-rpg.settings');
    return {selected,saved,preview,bounds,reused,retained,reset,resetSaved,defaultSelected,closed};
  })()`);
  assert.equal(result.selected,true);
  assert.deepEqual(result.saved,{buttonSize:'small',joystickSize:'large',justDodgeTiming:'strict'});
  assert.match(result.preview,/85%.*118%/);
  assert.match(result.preview,/엄격/);
  assert.ok(result.bounds.every(Boolean));
  assert.equal(result.reused,true);
  assert.equal(result.retained,true);
  assert.deepEqual(result.reset,{buttonSize:'normal',joystickSize:'normal',justDodgeTiming:'normal'});
  assert.deepEqual(result.resetSaved,result.reset);
  assert.equal(result.defaultSelected,true);
  assert.equal(result.closed,true);
});

test('몬스터 원화는 8방향 이동과 공격 단계를 표시하며 맵별로 필요한 시트만 읽는다', async () => {
  await load();
  const field = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), e = s.enemies[0], art = e.character.sprite;
    const directions = [[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
    const frames = directions.map(([x,y]) => { art.play('slime-green-walk'); art.setMovement(x,y); art.advance(140); return art.list[0].frame.name; });
    art.showAttack(100,480,110,220); const windup=art.list[0].frame.name;
    art.showAttack(500,480,110,220); const strike=art.list[0].frame.name;
    art.showAttack(620,480,110,220); const recover=art.list[0].frame.name;
    return { kinds:s.enemies.map(e=>e.kind), frames, windup,strike,recover,
      textures:Object.keys(s.textures.list).filter(k=>k.startsWith('monster-')) };
  })()`);
  assert.deepEqual(new Set(field.kinds), new Set(['slime', 'waterdrop-mushroom']));
  assert.equal(new Set(field.frames).size, 8);
  assert.ok(field.windup.endsWith('-1') && field.strike.endsWith('-2') && field.recover.endsWith('-3'));
  assert.equal(field.textures.some(k => k.includes('iron-scale-lizard')), false);
  await load('west-forest');
  const kinds = await evaluate(`window.__game.scene.getScene('game').enemies.map(e=>e.kind)`);
  assert.deepEqual(new Set(kinds), new Set(['waterdrop-mushroom', 'iron-scale-lizard']));
});

test('버섯 물방울은 준비 뒤 발사하고 경로에서 한 번만 맞으며 중단·사망·벽으로 취소된다', async () => {
  await load('west-forest');
  const r = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), p=s.player, e=s.enemies.find(e=>e.kind==='waterdrop-mushroom');
    e.character.placeAt(900,700); p.revive(1150,700); p.invulnerableUntil=0;
    e.beginWindup(0,250,0);
    e.update(759,.016,p,s.walkArea,s.nav,s.onEnemyStrike); const before=!!e.projectile;
    s.now=760; e.update(760,.001,p,s.walkArea,s.nav,s.onEnemyStrike); const launched=!!e.projectile;
    const hp=p.hp;
    for(let time=810;time<=1500;time+=50){s.now=time;e.update(time,.05,p,s.walkArea,s.nav,s.onEnemyStrike);}
    const damage=hp-p.hp, consumed=!e.projectile;
    e.beginWindup(2000,250,0);e.interrupt(2100);e.update(2800,.05,p,s.walkArea,s.nav,s.onEnemyStrike);const interrupted=!e.projectile;
    e.fireProjectile(3000);e.kill();const dead=!e.projectile;
    // 벽(돌) 너머의 플레이어를 향해 쏜다. 맵이 넓어져도 같은 돌을 사이에 두도록 좌표를 맵 배율로 옮긴다.
    e.respawn(${mapLength(1100)},${mapLength(1020)});e.aim={x:1,y:0};e.fireProjectile(4000);p.revive(${mapLength(1450)},${mapLength(1020)});
    const hpWall=p.hp;for(let time=4050;time<=4800;time+=50){s.now=time;e.updateProjectile(time,.05,p,s.walkArea,s.onEnemyStrike);}
    // 맞은 피해는 몬스터 레벨에 맞춘 공격력에 방어력을 적용한 값이다.
    const expected=Math.max(1,Math.round(e.stats.damage*s.derived.damageTaken));
    return {before,launched,damage:damage===expected,consumed,interrupted,dead,wall:!e.projectile&&p.hp===hpWall};
  })()`);
  assert.deepEqual(r, { before:false, launched:true, damage:true, consumed:true, interrupted:true, dead:true, wall:true });
});

test('도마뱀은 준비 중 멈추고 잠근 방향으로 돌진하며 한 번만 명중하고 옆으로 피하면 빗나간다', async () => {
  await load('west-forest');
  const r = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),p=s.player,e=s.enemies.find(e=>e.kind==='iron-scale-lizard');
    const run=(evade)=>{
      e.respawn(900,700);p.revive(1100,700);p.invulnerableUntil=0;e.beginWindup(0,200,0);const w=e.windupMs;
      e.update(w-1,.05,p,s.walkArea,s.nav,s.onEnemyStrike);const still=e.character.x===900;
      if(evade)p.placeAt(1100,850);const hp=p.hp;
      for(let t=w;t<=w+600;t+=40){s.now=t;e.update(t,.04,p,s.walkArea,s.nav,s.onEnemyStrike);}
      return {still,moved:e.character.x>1100,damage:hp-p.hp,y:e.character.y,expected:Math.max(1,Math.round(e.stats.damage*s.derived.damageTaken))};
    };
    const hit=run(false),miss=run(true);
    e.respawn(900,700);e.beginWindup(0,200,0);e.interrupt(700);e.update(1000,.05,p,s.walkArea,s.nav,s.onEnemyStrike);
    return {hit,miss,interrupted:e.character.x===900};
  })()`);
  assert.equal(r.hit.still,true);assert.equal(r.hit.moved,true);assert.equal(r.hit.damage,r.hit.expected); // 레벨에 맞춘 공격력에서 낡은 수련복(DEF +1)만큼 줄어든다
  assert.equal(r.miss.damage,0);assert.equal(r.miss.y,700);assert.equal(r.interrupted,true);
});

test('일시정지에서 정보와 가방을 터치로 열고, 다음 가방 페이지를 확인한 뒤 일시정지로 돌아간다', async () => {
  await load('village-north');
  const before = await evaluate(`(async () => {
    const { GEAR_IDS } = await import('/src/items/equipment.ts');
    const { ITEM_IDS } = await import('/src/items/inventory.ts');
    const s = window.__game.scene.getScene('game');
    s.inventory.items = Object.fromEntries(ITEM_IDS.map(id => [id, 1]));
    s.character.gear.bag = Object.fromEntries(GEAR_IDS.map(id => [id, 1]));
    s.openPause();
    return s.now;
  })()`);
  const tap = async selector => {
    const at = await evaluate(`(() => {
      const g = window.__game, s = g.scene.getScene('game'), box = s.${selector}.getBounds();
      const canvas = g.canvas.getBoundingClientRect(), size = g.scale.gameSize;
      return { x: canvas.left + (box.left + 8) * canvas.width / size.width,
        y: canvas.top + box.centerY * canvas.height / size.height };
    })()`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 });
      await evaluate('window.__game.step(performance.now(), 16)');
    }
  };
  await tap('pauseMenu.characterButton');
  assert.equal(await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    return s.characterPanel.currentTab === 'status' && s.characterPanel.isOpen && !s.pauseMenu.isOpen;
  })()`), true);
  await tap('characterPanel.tabs.equip');
  await tap('characterPanel.slots[3].hit');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').characterPanel.selectedSlot`), 'hands');
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: 'i', code: 'KeyI', windowsVirtualKeyCode: 73 });
    await evaluate('window.__game.step(performance.now(), 16)');
  }
  assert.equal(await evaluate(`window.__game.scene.getScene('game').characterPanel.currentTab`), 'items');
  await tap('characterPanel.closeButton');
  await tap('pauseMenu.bagButton');
  await tap('characterPanel.next');
  const page = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), panel = s.characterPanel;
    // 둘째 쪽에는 첫 쪽에 다 못 넣은 나머지(아이템·장비 전체 - 한 쪽 칸 수)가 나온다
    const total = Object.keys(s.inventory.items).length + Object.keys(s.character.gear.bag).length;
    const per = panel.cells.length;
    return { page: panel.pageLabel.text, entries: panel.cells.filter(c => c.shown).length, rest: Math.min(per, total - per),
      pages: Math.ceil(total / per), frozen: s.now === ${before} };
  })()`);
  assert.equal(page.page, `2 / ${page.pages}`);
  assert.equal(page.frozen, true);
  assert.ok(page.entries > 0 && page.entries === page.rest, JSON.stringify(page));
  await tap('characterPanel.cellNames[0]');
  assert.ok(await evaluate(`window.__game.scene.getScene('game').characterPanel.selectedEntry`));
  await evaluate(`window.__game.scene.getScene('game').onBackButton()`);
  assert.equal(await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    return s.pauseMenu.isOpen && !s.characterPanel.isOpen;
  })()`), true);
  await tap('pauseMenu.resumeButton');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').pauseMenu.isOpen`), false);
});

test('새 몬스터도 실제 검날에 맞아 쓰러지고 종류별 경험치를 주며 버섯 물방울은 일시정지 중 멈춘다', async () => {
  await load('south-field');
  const kills=[];
  for(const [map,kind] of [['south-field','slime'],['west-forest','waterdrop-mushroom'],['west-forest','iron-scale-lizard'],['east-pass','fog-crow']]) {
    // 레벨 1로 시작해야 경험치가 줄지 않는다(앞선 테스트가 남긴 레벨을 지운다).
    await evaluate(`localStorage.removeItem('untitled-rpg.save'); true`);
    await load(map);
    kills.push(await evaluate(`(() => {
      const s=window.__game.scene.getScene('game'),p=s.player,e=s.enemies.find(e=>e.kind==='${kind}');
      for(const other of s.enemies) { other.character.placeAt(200,1400);other.state='recover';other.timer=1e12; }
      const y=e.kind==='fog-crow'?1200:700;p.revive(1000,y);e.character.revive(1110,y);e.character.hp=1;
      s.wantsAttack=()=>false;s.now=0;s.nextAttackAt=0;s.comboStage=0;
      let xp=0;s.gainXp=(amount)=>{xp+=amount;};
      s.startAttack(0,1,0);
      for(let i=0;i<50;i++)s.update(0,16);
      return {kind:e.kind,dead:e.state==='dead',xp:xp===e.stats.xp&&xp>0,level:e.level>=1};
    })()`));
  }
  // 레벨 1 주인공은 경험치 감소 없이 몬스터 레벨에 맞춘 경험치를 다 받는다.
  assert.deepEqual(kills,[{kind:'slime',dead:true,xp:true,level:true},{kind:'waterdrop-mushroom',dead:true,xp:true,level:true},{kind:'iron-scale-lizard',dead:true,xp:true,level:true},{kind:'fog-crow',dead:true,xp:true,level:true}]);
  await load('west-forest');
  const paused=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),e=s.enemies.find(e=>e.kind==='waterdrop-mushroom');
    e.character.placeAt(900,700);s.player.placeAt(1200,700);e.fireProjectile(s.now);
    const x=e.projectile.x,now=s.now;s.openPause();
    for(let i=0;i<20;i++)s.update(0,50);
    return s.now===now&&e.projectile.x===x;
  })()`);
  assert.equal(paused,true);
});

test('캐릭터 창: 포인트로 능력치를 올리고, 도란에게 장비를 사서 끼면 전투 수치가 바뀌며, 다시 켜도 남는다', async () => {
  await load('village');
  await evaluate(`localStorage.setItem('untitled-rpg.save', JSON.stringify({ version: 1, level: 3, xp: 0 }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 500, items: {} }));
    localStorage.removeItem('untitled-rpg.character'); localStorage.removeItem('untitled-rpg.quests');`);
  await load('in-smithy');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const before = { damage: s.stats.damageMax, maxHp: s.player.maxHp, points: s.characterView().pointsLeft };
    // 정보 버튼으로 상태 탭을 열면 게임이 멈춘다.
    s.characterButton.pressed = true;
    g.step(t += 16, 16);
    const opened = s.characterPanel.isOpen && s.characterPanel.currentTab === 'status';
    const clock = s.now; g.step(t += 16, 16);
    const frozen = s.now === clock;
    s.allocateStat('vit'); s.allocateStat('vit');
    const vit = { maxHp: s.player.maxHp, points: s.characterView().pointsLeft };
    s.characterPanel.close();
    // 도란과 평소 대화를 마치면 대장간이 열린다.
    const doran = s.npcs.find(n => n.def.id === 'doran');
    // 처음에는 도란이 퀘스트를 준다(그 대화 뒤에는 열지 않는다). 다시 말을 걸면 대장간이 열린다.
    for (let i = 0; i < 2; i++) {
      s.openDialogue(doran.spot);
      while (s.dialogue.isOpen) s.dialogue.advance();
    }
    const smithy = s.characterPanel.isOpen && s.characterPanel.mode === 'smithy' && s.characterPanel.currentShopTab === 'enhance';
    // 도란의 대장간에서 장갑 칸을 강화(+1)하고, 장신구 탭에서 네잎 부적을 사서 장신구 칸에 낀다.
    s.enhanceGearSlot('hands');
    s.characterPanel.switchShopTab('buy');
    s.tradeGear('clover-charm', 'buy');
    const gold = s.inventory.gold;
    s.characterPanel.close();
    s.openCharacterPanel('equip');
    s.characterPanel.selectSlot('accessory1');
    s.characterPanel.selectCell(0);
    s.characterPanel.primary();
    const hands = s.character.gear.enhance.hands;
    const equipped = s.character.gear.equipped.accessory1;
    s.characterPanel.close();
    return { before, opened, frozen, vit, smithy, gold, hands, equipped, damage: s.stats.damageMax };
  })()`);
  assert.equal(result.opened, true);
  assert.equal(result.frozen, true);
  assert.equal(result.before.points, 6);
  assert.deepEqual(result.vit, { maxHp: result.before.maxHp + 20, points: 4 });
  assert.equal(result.smithy, true, JSON.stringify(result));
  assert.equal(result.gold, 310);
  assert.equal(result.hands, 1);
  assert.equal(result.equipped, 'clover-charm');
  assert.ok(result.damage > result.before.damage, JSON.stringify(result));
  // 다시 불러와도 분배·강화·장신구가 남는다.
  await load('in-smithy');
  const reloaded = await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    const r = { hands: s.character.gear.enhance.hands, accessory1: s.character.gear.equipped.accessory1, vit: s.character.alloc.vit };
    localStorage.removeItem('untitled-rpg.character'); localStorage.removeItem('untitled-rpg.save'); localStorage.removeItem('untitled-rpg.inventory'); localStorage.removeItem('untitled-rpg.quests');
    return r; })()`);
  assert.deepEqual(reloaded, { hands: 1, accessory1: 'clover-charm', vit: 2 });
});

test('막기는 누른 순간 잠깐만 막는 패링이다: 앞에서 온 공격은 피해가 없고 적이 휘청이며 반격이 열리고, 늦거나 뒤에서 오면 그대로 맞으며, 민첩이 높으면 피하기도 한다', async () => {
  await load('south-field');
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.length > 0; })()`));
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player, e = s.enemies[0];
    let t = performance.now();
    const settle = () => { for (let i = 0; i < 60; i++) g.step(t += 16, 16); };
    s.derived.evadeChance = 0;
    const strike = (side) => {
      // 막기 판정은 주인공이 보는 쪽(위·아래 포함)으로 정한다. 이 검사는 옆을 보고 막는다.
      p.sprite.setAttackFacing(p.facing > 0 ? 'right' : 'left');
      e.character.placeAt(p.x + 80 * side * p.facing, p.y);
      e.character.facing = -side * p.facing;
      p.invulnerableUntil = 0; p.hp = p.maxHp;
      s.onEnemyStrike(e);
      return p.maxHp - p.hp;
    };
    const parry = () => { s.parryReadyAt = 0; s.blockButton.pressed = true; g.step(t += 16, 16); };
    parry();
    const blocking = s.blocking, shield = s.shield.visible;
    // 회피 대기 시간이 3초 남은 상태에서 패링하면 1초 줄어든다.
    s.dodgeReadyAt = s.now + 3000;
    const front = strike(1);
    const stunned = e.state, counter = s.counterUntil > s.now, again = s.now >= s.parryReadyAt;
    const dodgeLeft = s.dodgeReadyAt - s.now;
    settle(); parry();
    s.dodgeReadyAt = s.now + 400;
    const floorDamage = strike(1);
    const dodgeFloor = floorDamage === 0 ? s.dodgeReadyAt - s.now : NaN;
    s.dodgeReadyAt = 0;
    settle();
    const open = strike(1);
    settle(); parry();
    const back = strike(-1);
    settle(); parry(); settle();
    const late = strike(1);
    // 민첩: 회피 확률이 100%면 맞지 않는다.
    settle(); s.derived.evadeChance = 1;
    const evaded = strike(1);
    s.derived.evadeChance = 0;
    return { blocking, shield, front, stunned, counter, again, open, back, late, evaded, dodgeLeft, dodgeFloor };
  })()`);
  assert.equal(result.blocking, true);
  assert.equal(result.shield, true);
  assert.equal(result.front, 0, '패링하면 피해가 없다');
  assert.ok(result.open > 0, JSON.stringify(result));
  assert.equal(result.counter, true);
  assert.equal(result.again, true, '패링에 성공하면 바로 다시 막을 수 있다');
  assert.ok(Math.abs(result.dodgeLeft - 2000) < 1, `패링하면 회피 대기 시간 1초 감소: ${result.dodgeLeft}`);
  assert.ok(result.dodgeFloor <= 0 && result.dodgeFloor > -1, `남은 시간이 1초보다 적으면 바로 회피할 수 있다: ${result.dodgeFloor}`);
  assert.equal(result.back, result.open, '뒤에서 온 공격은 막지 못한다');
  assert.equal(result.late, result.open, '판정 시간이 지나면 막지 못한다');
  assert.equal(result.evaded, 0);
});

test('연타와 흡수: 추적자는 예비 동작 중 따라오며 2연타를 하고, 둘 다 정밀 패링하면 연타가 이어지다 파훼되며, 3단(2.5배)이 3초 이어지고 첫 명중에만 부식 웅덩이가 남는다', async () => {
  await load('south-field&monsters=corrosion-tracker');
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.some(e => e.kind === 'corrosion-tracker'); })()`));
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const e = s.enemies.find(x => x.kind === 'corrosion-tracker');
    for (const other of s.enemies) if (other !== e) other.character.placeAt(other.character.x, other.character.y + 2000);
    s.enemies = [e];
    s.derived.evadeChance = 0;
    p.hp = p.maxHp;
    e.character.placeAt(p.x + 90, p.y);
    p.face(1);
    p.sprite.setAttackFacing('right');
    for (let i = 0; i < 300 && e.state !== 'windup'; i++) step();
    // 이번 묶음을 2연타로 정해 둔다.
    e.comboWindups = [320, 230]; e.chainTotal = 2; e.chainLeft = 1; e.comboIndex = 0; e.windupMs = 320;
    // 예비 동작 중 주인공이 물러서면 따라온다.
    const startX = e.character.x;
    p.placeAt(p.x - 60, p.y);
    step(8);
    const tracked = startX - e.character.x;
    const log = [];
    for (let i = 0; i < 400 && log.length < 2; i++) {
      if (e.state === 'windup' && e.attackStartedAt !== undefined) {
        const left = e.attackStartedAt + e.windupMs + e.stats.strikeMs - s.now;
        if (left < 70 && s.now >= s.parryReadyAt && !s.blocking) s.blockButton.pressed = true;
      }
      const dir = Math.sign(e.character.x - p.x) || 1;
      p.face(dir);
      p.sprite.setAttackFacing(dir > 0 ? 'right' : 'left');
      const before = s.parryChain.count;
      step();
      if (s.parryChain.count !== before) log.push({ state: e.state, pending: e.chainPending, tier: s.absorb.tier, element: s.absorb.element });
    }
    const stunLeft = e.parryStunUntil - s.now;
    const hpAfterParries = p.hp;
    const tierBefore = s.absorb.tier;
    // 파훼로 멀리 밀려난 적 앞으로 다가가 벤다.
    e.character.knockback.set(0, 0);
    e.character.placeAt(p.x + 80, p.y);
    const enemyHp = e.character.hp;
    p.face(1);
    s.attackBufferedUntil = s.now + 300; s.keyboardAttackPressed = true;
    let pools = 0;
    for (let i = 0; i < 40; i++) { step(); pools = Math.max(pools, s.allyPools.length); }
    return { tracked, log, stunLeft, hpAfterParries, maxHp: p.maxHp, tierBefore, tierAfter: s.absorb.tier, charged: s.absorb.charged, left: s.absorb.until - s.now, pools, damage: enemyHp - e.character.hp };
  })()`);
  assert.ok(result.tracked > 15, `예비 동작 중 물러선 주인공을 따라온다: ${JSON.stringify(result)}`);
  assert.equal(result.log.length, 2, JSON.stringify(result));
  assert.equal(result.log[0].pending, true, '첫 타를 패링해도 연타가 이어진다');
  assert.equal(result.log[0].tier, 1);
  assert.equal(result.log[0].element, 'corrosion');
  assert.equal(result.log[1].tier, 3, '마지막 타까지 정밀 패링하면 파훼로 두 단 더');
  assert.ok(result.stunLeft > 1200, `파훼 경직: ${result.stunLeft}`);
  assert.equal(result.hpAfterParries, result.maxHp);
  assert.equal(result.tierBefore, 3);
  assert.equal(result.tierAfter, 3, '단수는 3초 동안 이어진다');
  assert.equal(result.charged, false, '속성은 첫 명중에 쓰였다');
  assert.ok(result.left > 0 && result.left < 3000, JSON.stringify(result));
  assert.equal(result.pools, 1, '부식 웅덩이가 남는다');
  assert.ok(result.damage > 0);
});

test('흘리기: 막는 순간 조이스틱을 기울이면 근접 공격이 그쪽 적에게 맞고, 공격한 적은 그쪽으로 밀려 몸이 돌아간다. 적 쪽으로 밀면 그냥 패링이다', async () => {
  await load('south-field&monsters=corrosion-tracker');
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.filter(e => e.kind === 'corrosion-tracker').length >= 2; })()`));
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const [a, b] = s.enemies.filter(x => x.kind === 'corrosion-tracker');
    for (const other of s.enemies) if (other !== a && other !== b) other.character.placeAt(other.character.x, other.character.y + 2000);
    s.enemies = [a, b];
    s.derived.evadeChance = 0;
    const run = (input) => {
      p.hp = p.maxHp; p.invulnerableUntil = 0;
      a.state = 'wander'; b.state = 'wander';
      a.character.placeAt(p.x + 80, p.y); a.character.facing = -1; a.character.knockback.set(0, 0);
      b.character.placeAt(p.x + 20, p.y + 80); b.character.hp = b.character.maxHp;
      p.face(1); p.sprite.setAttackFacing('right');
      s.parryReadyAt = 0; s.blockButton.pressed = true; step();
      s.joystick.vector.set(input.x, input.y);
      s.onEnemyStrike(a);
      s.joystick.vector.set(0, 0);
      return { bDamage: b.character.maxHp - b.character.hp, pushY: a.character.knockback.y, facingY: a.character.sprite.facingVector().y, hp: p.maxHp - p.hp };
    };
    const down = run({ x: 0, y: 1 });
    step(60);
    const toward = run({ x: 1, y: 0 });
    return { down, toward };
  })()`);
  assert.equal(result.down.hp, 0);
  assert.ok(result.down.bDamage > 0, `흘린 쪽의 적이 맞는다: ${JSON.stringify(result)}`);
  assert.ok(result.down.pushY > 0, '공격한 적이 아래로 밀린다');
  assert.ok(result.down.facingY > 0, '공격한 적의 몸이 흘린 쪽으로 돌아간다');
  assert.equal(result.toward.hp, 0);
  assert.equal(result.toward.bDamage, 0, '적 쪽으로 밀면 흘리기가 아니다');
});

test('정예의 돌진은 정밀 패링해도 멈추지 않고 원래 가려던 자리까지 지나간 뒤 휘청이고, 보통 돌진(도마뱀)은 앞에서 멈춘다', async () => {
  const charge = async (kind) => {
    await load('south-field&monsters=' + kind);
    await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.some(e => e.kind === ${JSON.stringify(kind)}); })()`));
    return evaluate(`(() => {
      const g = window.__game, s = g.scene.getScene('game'), p = s.player;
      let t = performance.now();
      const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
      const e = s.enemies.find(x => x.kind === ${JSON.stringify(kind)});
      for (const other of s.enemies) if (other !== e) other.character.placeAt(other.character.x, other.character.y + 2000);
      s.enemies = [e];
      s.derived.evadeChance = 0;
      p.hp = p.maxHp;
      e.character.placeAt(p.x + 200, p.y);
      p.face(1); p.sprite.setAttackFacing('right');
      for (let i = 0; i < 300 && e.state !== 'windup'; i++) step();
      e.comboWindups = [e.windupMs]; e.chainTotal = 1; e.chainLeft = 0; e.comboIndex = 0;
      const startX = e.character.x;
      let parried = false;
      for (let i = 0; i < 200 && e.state === 'windup'; i++) {
        // 돌진은 몸이 주인공에게 닿기 조금 전에 막는다.
        if (!parried && e.chargingNow(s.now) && e.character.x - p.x < 150) { s.parryReadyAt = 0; s.blockButton.pressed = true; parried = true; }
        step();
      }
      return { startX, endX: e.character.x, heroX: p.x, state: e.state, stunned: e.parryStunUntil > s.now, chain: s.parryChain.count, hp: p.maxHp - p.hp, elite: e.elite };
    })()`);
  };
  const elite = await charge('corrosion-executioner');
  assert.equal(elite.elite, true);
  assert.equal(elite.hp, 0, JSON.stringify(elite));
  assert.equal(elite.chain, 1, '정밀 패링');
  assert.ok(elite.endX < elite.heroX - 20, `주인공을 지나쳐 간다: ${JSON.stringify(elite)}`);
  assert.equal(elite.stunned, true, '지나간 뒤 휘청인다');
  const lizard = await charge('iron-scale-lizard');
  assert.equal(lizard.elite, false);
  assert.equal(lizard.hp, 0, JSON.stringify(lizard));
  assert.ok(lizard.endX > lizard.heroX, `보통 돌진은 주인공 앞에서 멈춘다: ${JSON.stringify(lizard)}`);
});

test('패링마다 공명 구슬이 1/3씩 차고, 구슬 다섯 개가 다 차야 10초 동안 주는 피해 1.2배·받는 피해 80%가 되며, 끝나면 돌아온다', async () => {
  await load('south-field');
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.length > 0; })()`));
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player, e = s.enemies[0];
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    s.derived.evadeChance = 0;
    localStorage.removeItem('untitled-rpg.resonance'); s.resonanceCharge = 0; s.resonanceUntil = 0;
    // 앞선 시험의 약초 기운(보너스 최대 체력)이 남아 있으면 첫 피격 때 최대 체력이 바뀌어 피해를 잘못 잰다.
    s.herb = 0; p.setMaxHp(s.stats.maxHp, true);
    const hit = () => {
      p.sprite.setAttackFacing(p.facing > 0 ? 'right' : 'left');
      e.character.placeAt(p.x + 80 * p.facing, p.y); e.character.facing = -p.facing;
      p.invulnerableUntil = 0; p.hp = p.maxHp; s.onEnemyStrike(e); return p.maxHp - p.hp;
    };
    const parry = () => { s.parryReadyAt = 0; s.blockButton.pressed = true; step(); hit(); step(2); };
    // 구슬이 없으면 공명할 수 없다.
    s.resonanceButton.pressed = true; step();
    const noCharge = !s.resonating;
    parry();
    const third = s.resonanceCharge;
    for (let i = 0; i < 13; i++) parry();
    // 14번: 아직 하나가 모자라 쓸 수 없다.
    // 패링 직후의 히트스톱 동안 누른 입력은 다음 프레임까지 남으므로 충분히 진행해 처리되게 한다.
    s.resonanceButton.pressed = true; step(30);
    const notYet = !s.resonating && s.resonanceCharge === 14;
    parry();
    const one = s.resonanceCharge, saved = localStorage.getItem('untitled-rpg.resonance');
    step(80);
    const normal = hit(); step(80);
    s.resonanceButton.pressed = true; step();
    const active = s.resonating, spent = s.resonanceCharge, aura = s.resonanceAura.visible;
    const reduced = hit(); step(80);
    const scale = s.resonanceDamage();
    // 10초가 지나면 끝난다.
    step(Math.ceil(10000 / 16) + 5);
    const ended = !s.resonating && !s.resonanceAura.visible && s.resonanceDamage() === 1;
    s.derived.evadeChance = 0.0;
    return { noCharge, notYet, third, one, saved, normal, reduced, expected: Math.max(1, Math.round(normal * 0.8)), active, spent, aura, scale, ended };
  })()`);
  assert.equal(result.noCharge, true);
  assert.equal(result.third, 1, '패링 한 번 = 구슬 1/3');
  assert.equal(result.notYet, true, '구슬 다섯 개가 다 차야 쓴다');
  assert.equal(result.one, 15);
  assert.equal(result.saved, '15');
  assert.equal(result.active, true);
  assert.equal(result.spent, 0);
  assert.equal(result.aura, true);
  assert.equal(result.reduced, result.expected, JSON.stringify(result));
  assert.equal(result.scale, 1.2);
  assert.equal(result.ended, true);
});

test('새 게임 오프닝: 시온이 스스로 걸으며 마을 사람과 이야기하고, 조작·버튼은 막히며, 건너뛰면 화면 UI가 돌아오고 다시 나오지 않는다', async () => {
  await load('village-north');
  await evaluate(`localStorage.removeItem('untitled-rpg.opening'); true`);
  const search = '?test=' + ++navigation + '&map=village-north&opening';
  await send('Page.navigate', { url: appUrl + search });
  await until(() => evaluate(`location.search === ${JSON.stringify(search)} && !!window.__game?.scene.getScene('game')?.damageNumbers`));
  await evaluate('window.__game.loop.sleep()');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now();
    const playing = !!s.opening;
    const hudHidden = !s.hud.hpText.visible && !s.attackButton.text.visible;
    const start = { x: s.player.x, y: s.player.y };
    // 첫 자막과 첫 걸음까지 진행한다. 대화가 열리면 넘긴다.
    let talked = 0;
    for (let i = 0; i < 1200 && s.opening && s.opening.step < 15; i++) {
      if (s.dialogue.isOpen) { s.dialogue.advance(); s.dialogue.advance(); talked++; }
      // 플레이어 입력은 무시된다.
      s.joystick.vector.set(-1, 0); s.attackButton.pressed = true;
      g.step(t += 16, 16);
    }
    s.joystick.vector.set(0, 0);
    const walked = Math.hypot(s.player.x - start.x, s.player.y - start.y) > 300;
    const noAttack = !s.player.isAttacking;
    const serena = s.npcs.find(n => n.def.id === 'serena');
    // 건너뛰기
    s.opening.skip();
    for (let i = 0; i < 5; i++) g.step(t += 16, 16);
    return { playing, hudHidden, talked: talked > 3, walked, noAttack,
      ended: !s.opening, hudBack: s.hud.hpText.visible && s.attackButton.text.visible,
      seen: localStorage.getItem('untitled-rpg.opening'), released: !serena.scripted, dialogue: s.dialogue.isOpen };
  })()`);
  assert.deepEqual(result, { playing: true, hudHidden: true, talked: true, walked: true, noAttack: true,
    ended: true, hudBack: true, seen: 'seen', released: true, dialogue: false });
  // 다시 열어도(같은 새 게임이라도) 한 번 본 오프닝은 나오지 않는다.
  await load('village-north');
  const again = await evaluate(`(() => { const s = window.__game.scene.getScene('game'); const r = !s.opening; localStorage.removeItem('untitled-rpg.opening'); return r; })()`);
  assert.equal(again, true);
});

test('시온이 쓰러지면 누구에게 몇 번 얼마나 맞았는지 보여 주고, 확인하면 마지막으로 쉰 곳에서 체력을 채워 다시 시작한다', async () => {
  await load('south-field');
  await evaluate(`localStorage.setItem('untitled-rpg.rest', JSON.stringify({ version: 1, point: 'inn' })); true`);
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const e = s.enemies[0], c = e.character;
    s.derived.evadeChance = 0; s.blocking = false; s.mp = 1;
    let hits = 0;
    while (p.alive && hits < 200) {
      c.placeAt(p.x - 60, p.y); c.facing = 1; p.invulnerableUntil = 0;
      if (s.onEnemyStrike(e)) hits++;
    }
    const dead = !p.alive;
    let opened = false;
    for (let i = 0; i < 400 && !opened; i++) { g.step(t += 16, 16); opened = s.deathPanel.isOpen; }
    const panel = s.deathPanel;
    const killer = panel.killer.text, row = panel.rows[0].map(x => x.text), total = panel.total[2].text, dest = panel.destination.text;
    // 창이 열려 있는 동안 게임은 멈춘다.
    const frozenAt = s.now; for (let i = 0; i < 10; i++) g.step(t += 16, 16);
    const frozen = s.now === frozenAt && !p.alive;
    window.__deathT = t;
    return { dead, opened, hits, killer, row, total, dest, frozen, name: e.stats.name, level: e.level, logTotal: s.damageLog.entries.reduce((n, x) => n + x.damage, 0) };
  })()`);
  assert.equal(result.dead, true);
  assert.equal(result.opened, true);
  assert.ok(result.killer.includes(result.name) && result.killer.includes('Lv. ' + result.level), result.killer);
  assert.deepEqual(result.row, [result.name + '  Lv. ' + result.level, result.hits + '회', String(result.logTotal)]);
  assert.equal(result.total, String(result.logTotal));
  assert.ok(result.dest.includes('여관'), result.dest);
  assert.equal(result.frozen, true);
  // 확인(Enter와 같은 동작)을 누르면 여관에서 체력·마나를 다 채워 다시 시작한다.
  const after = await evaluate(`(async () => {
    const g = window.__game; let t = window.__deathT;
    g.scene.getScene('game').deathPanel.confirm();
    for (let i = 0; i < 400; i++) {
      g.step(t += 16, 16); const s = g.scene.getScene('game');
      if (s.mapId === 'in-inn' && s.sys.isActive() && s.minimap && !s.traveling) break;
      await new Promise(r => setTimeout(r, 5));
    }
    const s = g.scene.getScene('game');
    const r = { map: s.mapId, alive: s.player.alive, full: s.player.hp === s.player.maxHp, mana: s.mp === s.maxMp, open: !!s.deathPanel?.isOpen, log: s.damageLog.entries.length };
    localStorage.removeItem('untitled-rpg.rest');
    return r;
  })()`);
  assert.deepEqual(after, { map: 'in-inn', alive: true, full: true, mana: true, open: false, log: 0 });
});

test('초반 전투 가이드: 수련을 받으면 시스템 안내 창이 한 번 뜨고(게임 멈춤) 해당 버튼이 반짝이며, 물약 수련은 다친 채로, 공명 수련은 구슬이 찬 채로 연습한다', async () => {
  await load('village');
  await evaluate(`(() => { localStorage.removeItem('untitled-rpg.guide'); localStorage.removeItem('untitled-rpg.quests'); return true; })()`);
  await load('village', { guide: true });
  const result = await evaluate(`(async () => {
    const g = window.__game; let s = g.scene.getScene('game');
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const restart = async (map) => {
      s.scene.restart({ map }); step();
      for (let i = 0; i < 300; i++) { s = g.scene.getScene('game'); if (s.mapId === map && s.sys.isActive() && s.minimap) return; await new Promise(r => setTimeout(r, 10)); step(); }
      throw Error('재시작 시간 초과');
    };
    // 루안에게 첫 수련을 받으면 공격 안내
    const ruan = s.npcs.find(n => n.def.id === 'ruan');
    s.openDialogue(ruan.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    step(2);
    const attack = { open: s.guideCard.isOpen, title: s.guideCard.title.text, badge: s.guideCard.badge.text };
    const frozenAt = s.now; step(10); const frozen = s.now === frozenAt;
    s.guideCard.close(); step(3);
    const ring = s.guideCard.ring.commandBuffer.length > 0;
    step(5); const again = s.guideCard.isOpen;
    // 물약 수련: 에일라에게 들은 뒤(두 번째 단계) 다친 채로 안내가 뜬다.
    s.quests = { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'done', count: 3 }, 'ruan-parry': { status: 'done', count: 2 },
      'ruan-field': { status: 'done', count: 5 }, 'eila-potion': { status: 'active', count: 0, step: 1 } };
    s.saveQuests(); s.inventory = { gold: 0, items: { potion: 3 } }; s.saveInventory();
    await restart('in-clinic');
    step(2);
    const potion = { open: s.guideCard.isOpen, title: s.guideCard.title.text, hurt: s.player.hp < s.player.maxHp };
    s.guideCard.close(); step(2);
    s.useHealItem('potion');
    const potionDone = s.quests['eila-potion'].status;
    // 공명 수련: 베르넬에게 들은 뒤 구슬이 가득 찬 채로 안내가 뜬다.
    s.quests = { ...s.quests, 'eila-potion': { status: 'done', count: 1, step: 1 }, 'vernel-resonance': { status: 'active', count: 0, step: 1 } };
    s.saveQuests(); s.setResonanceCharge(0);
    await restart('village');
    step(2);
    const resonance = { open: s.guideCard.isOpen, title: s.guideCard.title.text, full: s.resonanceCharge === 15 };
    s.guideCard.close(); step(2);
    s.resonanceButton.pressed = true; step(3);
    const resonanceDone = s.quests['vernel-resonance'].status;
    const seen = JSON.parse(localStorage.getItem('untitled-rpg.guide'));
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.resonance');
    return { attack, frozen, ring, again, potion, potionDone, resonance, resonanceDone, seen };
  })()`);
  assert.equal(result.attack.open, true, '첫 수련을 받으면 안내 창');
  assert.equal(result.attack.title, '공격');
  assert.match(result.attack.badge, /전투 가이드 1\/5 · 루안/);
  assert.equal(result.frozen, true, '안내 창이 열려 있으면 게임이 멈춘다');
  assert.equal(result.ring, true, '연습하는 동안 공격 버튼 둘레가 반짝인다');
  assert.equal(result.again, false, '한 번 본 안내는 다시 뜨지 않는다');
  assert.deepEqual(result.potion, { open: true, title: '물약', hurt: true });
  assert.equal(result.potionDone, 'ready');
  assert.deepEqual(result.resonance, { open: true, title: '공명', full: true });
  assert.equal(result.resonanceDone, 'ready');
  assert.deepEqual(result.seen, ['attack', 'potion', 'resonance']);
});

test('1장 보스 부식의 집행자: 경고 뒤 등장하고, 1초 쉬고 두 번 돌진하며, 보통 공격에 움찔하지 않고, 절반에서 모두 멈춘 채 포효한 뒤 물러나 2페이즈', async () => {
  await load('village-north');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.quests = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 8, step: 4 } }; s.saveQuests(); return true; })()`);
  await load('village-north');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.headlessStep(t += 16, 16); };
    const warning = s.bossHud.warning && !s.boss && s.enemies.length === 0;
    const warnStart = s.now;
    step(1);
    for (let i = 0; i < 400 && !s.boss; i++) step();
    const boss = s.boss, c = boss.character;
    const appearedAfter = s.now - warnStart;
    const spawned = { kind: boss.kind, isBoss: boss.boss, hp: c.hp, bar: s.bossHud.barVisible };
    // 연속 돌진: 주인공을 가까이 두고 준비 동작이 시작되는 시각을 잰다.
    p.invulnerableUntil = Infinity; s.derived.evadeChance = 0;
    p.placeAt(c.x - 180, c.y);
    const windups = [], recovers = [], chargePoses = new Set();
    let returnedToWalk = false;
    let last = boss.state;
    for (let i = 0; i < 600 && windups.length < 3; i++) {
      step();
      const frame = c.sprite.image.frame.name;
      if (boss.state === 'windup' && frame.startsWith('attack-')) chargePoses.add(Number(frame.at(-1)));
      if (boss.state !== last) {
        if (boss.state === 'windup') windups.push(s.now);
        if (boss.state === 'recover') {
          recovers.push(s.now);
          returnedToWalk ||= frame.startsWith('walk-');
        }
        last = boss.state;
      }
    }
    // 첫 돌진이 끝나고(recover) 다음 준비 동작까지 약 1초, 두 번째 돌진 뒤에는 원래의 긴 숨 고르기
    const gap1 = windups[1] - recovers[0], gap2 = windups[2] - recovers[1];
    // 슈퍼아머: 준비 동작 중에 맞아도 끊기지 않는다.
    for (let i = 0; i < 300 && boss.state !== 'windup'; i++) step();
    c.hurt(1); s.resolveEnemyHit(boss, false, 1, 0, 300);
    const armored = boss.state === 'windup';
    // 절반 아래로: 포효, 주인공도 멈춘다.
    c.hp = Math.floor(c.maxHp / 2) + 3; c.hurt(5); s.resolveEnemyHit(boss, false, 1, 0, 300);
    const roar = { state: boss.state, untouchable: boss.untouchable, until: s.bossRoarUntil > s.now };
    const roarFrames = new Set([c.sprite.image.frame.name]);
    const before = { x: p.x, y: p.y };
    s.joystick.vector.set(1, 0);
    step(20);
    const frozen = Math.hypot(p.x - before.x, p.y - before.y) < 1;
    const startDist = Math.hypot(c.x - p.x, c.y - p.y);
    s.joystick.vector.set(0, 0);
    let retreated = false;
    for (let i = 0; i < 300 && boss.phase === 1; i++) {
      step();
      if (boss.state === 'roar') roarFrames.add(c.sprite.image.frame.name);
      if (boss.state === 'retreat') retreated = true;
    }
    const endDist = Math.hypot(c.x - p.x, c.y - p.y);
    const phase = boss.phase;
    // 쓰러뜨리면 막대가 사라지고 다음 단계(북쪽 골목 살피기)로
    c.hp = 0; s.resolveEnemyHit(boss, true, 1, 0, 0);
    const after = { bar: s.bossHud.barVisible, boss: !!s.boss, step: s.quests['village-raid'].step };
    localStorage.removeItem('untitled-rpg.quests');
    return { warning, appearedAfter, spawned, gap1, gap2, chargePoses: [...chargePoses], returnedToWalk,
      armored, roar, roarFrames: [...roarFrames], frozen, retreated, farther: endDist > startDist + 150, phase, after };
  })()`);
  assert.equal(result.warning, true, '보스 등장 경고가 먼저 뜬다');
  assert.ok(result.appearedAfter >= 2700 && result.appearedAfter <= 3000, String(result.appearedAfter));
  assert.deepEqual(result.spawned, { kind: 'corrosion-executioner', isBoss: true, hp: 1000, bar: true });
  assert.ok(Math.abs(result.gap1 - 1000) <= 40, `연속 돌진 사이 ${result.gap1}ms`);
  assert.ok(result.gap2 >= 1250, `두 번째 돌진 뒤에는 길게 쉰다 ${result.gap2}ms`);
  assert.deepEqual(result.chargePoses, [1, 2, 3], '돌진 준비·타격·제동에 전용 공격 그림을 쓴다');
  assert.equal(result.returnedToWalk, true, '돌진이 끝나면 기본 자세로 돌아온다');
  assert.equal(result.armored, true);
  assert.deepEqual(result.roar, { state: 'roar', untouchable: true, until: true });
  assert.deepEqual(result.roarFrames, ['roar-windup', 'roar-cast', 'roar-recover']);
  assert.equal(result.frozen, true, '포효하는 동안 주인공도 움직이지 못한다');
  assert.equal(result.retreated, true);
  assert.equal(result.farther, true, '물러나 거리를 벌린다');
  assert.equal(result.phase, 2);
  assert.deepEqual(result.after, { bar: false, boss: false, step: 5 });
});

test('습격의 부식의 추적자와 잿빛 나방은 8방향 전용 공격 그림을 쓰며 한 번만 타격한다', async () => {
  await load('village-north');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.quests = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 0, step: 4 } };
    localStorage.setItem('untitled-rpg.festival', 'seen'); s.saveQuests(); return true; })()`);
  await load('village-north');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const directions = [[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
    return Object.fromEntries(['corrosion-tracker', 'ashen-moth'].map(kind => {
      const enemy = s.enemies.find(e => e.kind === kind), sprite = enemy.character.sprite;
      const { strikeMs, returnMs } = enemy.stats;
      return [kind, directions.map(([x,y], i) => {
        let hits = 0;
        const now = s.now + i * 5000;
        enemy.beginWindup(now, x, y);
        // 연타 묶음의 타마다 예비 동작 길이가 다를 수 있어 이번 타의 길이를 쓴다. dt 0이면 지연 추적으로 돌지 않는다.
        const windupMs = enemy.windupMs;
        const at = (time) => {
          enemy.updateStrike(now + time, 0, { x: 0, y: 0, alive: false }, () => { hits++; return true; }, s.walkArea);
          return { frame: sprite.image.frame.name, key: sprite.image.texture.key };
        };
        const strike = windupMs + strikeMs, end = strike + returnMs;
        const poses = [at(1), at(windupMs + 1), at(strike), at(strike + 1), at(end)];
        return { poses, hits, state: enemy.state };
      })];
    }));
  })()`);
  const directions = ['down', 'left', 'right', 'up', 'down-left', 'down-right', 'up-left', 'up-right'];
  for (const [kind, attacks] of Object.entries(result)) {
    for (const [i, { poses, hits, state }] of attacks.entries()) {
      const direction = directions[i], sheet = i < 4 ? 'cardinal' : 'diagonal';
      for (const [j, pose] of [1, 2, 2, 3].entries()) {
        assert.deepEqual(poses[j], { frame: `attack-${direction}-${pose}`, key: `monster-${kind}-attack_${sheet}` });
      }
      assert.equal(poses[4].frame, `walk-${direction}-0`);
      assert.equal(hits, 1);
      assert.equal(state, 'recover');
    }
  }
});

test('보스전 결계: 경고와 함께 병사들이 물러나고 고리가 번지며, 밖의 주인공은 밀려 들어오고, 보스가 나오면 고리 밖으로 못 나가고, 쓰러뜨리면 모두 돌아온다', async () => {
  await load('village-north');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.quests = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 8, step: 4 } }; s.saveQuests(); return true; })()`);
  await load('village-north');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const fighters = s.npcs.filter((n) => n.isFighter);
    const arena = s.arena;
    const away = fighters.length > 0 && fighters.every((n) => s.awayNpcs.has(n) && !s.interactables.includes(n.spot));
    // 고리 밖 멀리로 옮겨 두면 경고 동안 밀려 들어온다.
    const ellipse = (x, y, k = 1) => ((x - arena.x) / (arena.rx * k)) ** 2 + ((y - arena.y) / (arena.ry * k)) ** 2 <= 1;
    const outside = [[arena.x, arena.y + arena.ry * 1.6], [arena.x, arena.y - arena.ry * 1.6], [arena.x + arena.rx * 1.4, arena.y], [arena.x - arena.rx * 1.4, arena.y]]
      .find(([x, y]) => s.walkArea.contains(x, y));
    p.placeAt(outside[0], outside[1]);
    for (let i = 0; i < 400 && !s.boss; i++) step();
    step(30);
    const hidden = fighters.every((n) => !n.visible);
    const inside = ellipse(p.x, p.y);
    const boss = s.boss, c = boss.character;
    const bossInside = ellipse(c.x, c.y);
    // 닫힌 뒤에는 한쪽으로 계속 걸어도 고리 밖으로 나가지 못한다.
    p.invulnerableUntil = Infinity; s.derived.evadeChance = 0;
    s.joystick.vector.set(0, 1);
    step(240);
    s.joystick.vector.set(0, 0);
    const held = ellipse(p.x, p.y);
    const fenced = !s.walkArea.contains(arena.x, arena.y + arena.ry * 1.2) && s.baseWalkArea.contains(p.x, p.y);
    c.hp = 0; s.resolveEnemyHit(boss, true, 1, 0, 0);
    step(90);
    const back = fighters.every((n) => n.visible && n.alpha === 1 && s.interactables.includes(n.spot)) && s.awayNpcs.size === 0;
    const released = s.walkArea === s.baseWalkArea || s.baseWalkArea === undefined;
    const ringGone = s.arena === undefined;
    localStorage.removeItem('untitled-rpg.quests');
    return { fighters: fighters.length, away, hidden, inside, bossInside, held, fenced, back, released, ringGone };
  })()`);
  assert.ok(result.fighters > 0, '북쪽 맵에 병사가 있다');
  assert.equal(result.away, true, '경고와 함께 병사들이 물러난다(대화도 안 된다)');
  assert.equal(result.hidden, true);
  assert.equal(result.inside, true, '고리 밖의 주인공은 경고 동안 고리 안으로 들어온다');
  assert.equal(result.bossInside, true, '보스는 고리 안에 내려앉는다');
  assert.equal(result.held, true, '닫힌 고리 밖으로는 걸어 나가지 못한다');
  assert.equal(result.fenced, true);
  assert.equal(result.back, true, '보스를 쓰러뜨리면 병사들이 돌아온다');
  assert.equal(result.released, true, '걸을 수 있는 영역도 원래대로');
  assert.equal(result.ringGone, true, '안개 고리가 걷힌다');
});

test('보스 2페이즈: 멀면 부식 산탄 3발(빗나가면 웅덩이), 돌진 자리에 웅덩이, 웅덩이는 작은 피해·둔화, 체력 1/4에서 부식의 장막 한 번', async () => {
  await load('village-north');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.quests = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 8, step: 4 } }; s.saveQuests(); return true; })()`);
  await load('village-north');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player;
    const step = (n = 1) => { for (let i = 0; i < n; i++) s.update(0, 16); };
    for (let i = 0; i < 400 && !s.boss; i++) step();
    const boss = s.boss, c = boss.character, hz = boss.hazards;
    boss.phase = 2; s.derived.evadeChance = 0;
    p.invulnerableUntil = Infinity;
    // 부식 산탄: 멀리 서 있으면 겨눈 뒤 세 발. 쏜 뒤 비켜서면 떨어진 자리에 웅덩이가 남는다.
    p.placeAt(c.x - 460, c.y);
    const skillFrames = new Set();
    let volley = false, fired = 0;
    for (let i = 0; i < 200 && !fired; i++) {
      step();
      if (boss.state === 'volley') volley = true;
      fired = hz.shotCount;
      skillFrames.add(c.sprite.image.frame.name);
    }
    p.placeAt(c.x - 120, c.y - 320);
    for (let i = 0; i < 150 && hz.shotCount; i++) { step(); skillFrames.add(c.sprite.image.frame.name); }
    const shotPools = hz.poolCount;
    // 웅덩이 위: 작은 피해와 둔화, 무적 시간은 주지 않는다.
    const pool = hz.pools[0];
    p.invulnerableUntil = 0; boss.state = 'recover'; boss.timer = s.now + 99999;
    const hp0 = p.hp; p.placeAt(pool.x, pool.y);
    step(45);
    const poolHurt = hp0 - p.hp, slowed = s.slowedUntil > s.now, noInvuln = p.invulnerableUntil <= s.now + 1;
    // 돌진이 끝난 자리에도 웅덩이
    p.hp = p.maxHp; p.invulnerableUntil = Infinity; hz.clear();
    boss.state = 'chase'; boss.shotReadyAt = s.now + 99999;
    p.placeAt(c.x - 200, c.y);
    for (let i = 0; i < 400 && hz.poolCount === 0; i++) step();
    const chargePool = hz.poolCount > 0;
    // 부식의 장막: 체력 1/4 아래에서 한 번. 범위 안에 있으면 큰 피해.
    hz.clear(); boss.state = 'chase';
    c.hp = Math.floor(c.maxHp * 0.24);
    p.placeAt(c.x - 120, c.y); p.invulnerableUntil = 0; p.hp = p.maxHp;
    let veil = false;
    for (let i = 0; i < 30 && !veil; i++) { step(); veil = boss.state === 'veil'; }
    // 장막이 터지기 전까지는 웅덩이·산탄 없이 기다린다(주인공은 범위 안).
    const hp1 = p.hp;
    for (let i = 0; i < 200 && boss.state === 'veil'; i++) {
      p.placeAt(c.x - 120, c.y); step(); skillFrames.add(c.sprite.image.frame.name);
    }
    const veilHurt = hp1 - p.hp;
    for (let i = 0; i < 80 && c.sprite.image.frame.name === 'veil-cast'; i++) step();
    skillFrames.add(c.sprite.image.frame.name);
    boss.state = 'chase'; step(5);
    const once = boss.state !== 'veil';
    const log = s.damageLog.entries.map(e => e.name);
    c.hp = 0; s.resolveEnemyHit(boss, true, 1, 0, 0);
    const cleared = hz.poolCount === 0 && hz.shotCount === 0;
    localStorage.removeItem('untitled-rpg.quests');
    return { volley, fired, shotPools, poolHurt, slowed, noInvuln, chargePool, veil, veilHurt, once, log, cleared, skillFrames: [...skillFrames] };
  })()`);
  assert.equal(result.volley, true);
  assert.equal(result.fired, 3);
  for (const skill of ['volley', 'veil']) {
    for (const pose of ['windup', 'cast', 'recover']) assert.ok(result.skillFrames.includes(skill + '-' + pose), JSON.stringify(result.skillFrames));
  }
  assert.ok(result.shotPools >= 3, `빗나간 산탄 웅덩이 ${result.shotPools}`);
  assert.ok(result.poolHurt > 0 && result.poolHurt < 30, `웅덩이 피해 ${result.poolHurt}`);
  assert.equal(result.slowed, true);
  assert.equal(result.noInvuln, true, '웅덩이 틱은 무적 시간을 주지 않는다');
  assert.equal(result.chargePool, true, '2페이즈 돌진 자리에 웅덩이');
  assert.equal(result.veil, true);
  assert.ok(result.veilHurt >= 30, `장막 피해 ${result.veilHurt}`);
  assert.equal(result.once, true, '장막은 한 번만');
  assert.ok(result.log.includes('부식의 집행자(부식 웅덩이)') && result.log.includes('부식의 집행자(부식의 장막)'), result.log.join(','));
  assert.equal(result.cleared, true, '보스가 쓰러지면 부식 효과도 사라진다');
});

test('1장 수확제 연출: 잔치에 모두 모이고 하늘 등불·경보·권속 입장까지 스스로 흘러가며, 끝나면 광장이 습격 상태로 다시 열린다', async () => {
  await load('village');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.quests = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 0 } }; s.saveQuests();
    localStorage.setItem('untitled-rpg.festival', 'pending'); return true; })()`);
  await load('village');
  // 연출 전체(게임 시간 1분 남짓)를 여러 번에 나눠 진행한다(한 번의 evaluate는 30초 제한).
  await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    window.__fest = { t: performance.now(), playing: !!s.opening && s.playFestival,
      named: s.npcs.filter(n => !n.def.id.startsWith('guard-')).map(n => n.def.id).sort(),
      hudHidden: !s.hud.hpText.visible && !s.attackButton.text.visible, noEnemies: s.enemies.length === 0,
      lanterns: 0, raiders: 0, fought: false, talked: 0, attacked: false };
    return true;
  })()`);
  // 연출 로직은 렌더링 없이 진행한다. 화면 객체·UI 상태는 그대로 검사하고 재시작 후에는 실제 프레임을 그린다.
  for (let chunk = 0; chunk < 180; chunk++) {
    const running = await evaluate(`(() => {
      const g = window.__game, s = g.scene.getScene('game'), f = window.__fest;
      for (let i = 0; i < 100 && s.opening; i++) {
        if (s.dialogue.isOpen) { s.dialogue.advance(); s.dialogue.advance(); f.talked++; }
        // 플레이어 입력은 무시된다.
        s.joystick.vector.set(1, 0); s.attackButton.pressed = true;
        g.headlessStep(f.t += 16, 16);
        if (s.player.isAttacking) f.attacked = true;
        f.lanterns = Math.max(f.lanterns, s.festivalStage?.lanternCount ?? 0);
        f.raiders = Math.max(f.raiders, s.festivalRaiders.length);
        // 연출 속 권속은 싸우는 적이 아니다
        if (s.festivalRaiders.length && s.enemies.length) f.fought = true;
      }
      s.joystick.vector.set(0, 0);
      return !!s.opening;
    })()`);
    if (!running) break;
  }
  const result = await evaluate(`(() => {
    const f = window.__fest;
    return { playing: f.playing, named: f.named, hudHidden: f.hudHidden, noEnemies: f.noEnemies, lanterns: f.lanterns > 10, raiders: f.raiders,
      notEnemies: !f.fought, talked: f.talked > 30, attacked: f.attacked, ended: !window.__game.scene.getScene('game').opening,
      seen: localStorage.getItem('untitled-rpg.festival') };
  })()`);
  assert.deepEqual(result, { playing: true, named: ['doran', 'eila', 'herman', 'linea', 'merina', 'rosetta', 'ruan', 'serena', 'sia', 'teon', 'vernel'],
    hudHidden: true, noEnemies: true, lanterns: true, raiders: 3, notEnemies: true, talked: true, attacked: false, ended: true, seen: 'seen' });
  // 끝나면 광장이 다시 열리며 첫 무리와 싸운다.
  const after = await evaluate(`(async () => {
    const g = window.__game; let t = window.__fest.t;
    for (let i = 0; i < 400; i++) {
      g.step(t += 16, 16); const s = g.scene.getScene('game');
      if (s.sys.isActive() && s.minimap && !s.traveling && !s.opening) break;
      await new Promise(r => setTimeout(r, 5));
    }
    const s = g.scene.getScene('game');
    const r = { map: s.mapId, festival: s.playFestival, enemies: s.enemies.filter(e => e.character.alive).length, sia: s.npcs.some(n => n.def.id === 'sia'), hud: s.hud.hpText.visible };
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.festival');
    return r;
  })()`);
  assert.deepEqual(after, { map: 'village', festival: false, enemies: 6, sia: false, hud: true });
});

test('회전 베기는 마나를 써서 둘레의 적을 한꺼번에 베고, 마나가 모자라면 쓸 수 없으며, 마나는 다시 찬다', async () => {
  await load('south-field');
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.enemies.length >= 3; })()`));
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now();
    const step = (n) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    // 기술은 배워야 칸에 들어간다. 아직 배우는 방법이 없어 시험에서 첫 칸에 직접 넣는다.
    s.skillSlots[0] = 'spin'; s.refreshSkillButtons();
    const [a, b, c] = s.enemies;
    a.character.placeAt(p.x - 150, p.y); b.character.placeAt(p.x + 120, p.y + 40);
    c.character.placeAt(p.x + 900, p.y);
    const before = [a, b, c].map(e => e.character.hp);
    const full = s.mp === s.maxMp;
    s.skillButtons[0].pressed = true;
    step(2);
    const spent = s.mp < s.maxMp - 10;
    step(20);
    const after = [a, b, c].map(e => e.character.hp);
    // 마나가 모자라면 쓰지 못한다.
    s.mp = 1; s.nextSpinAt = 0; step(60);
    const low = s.mp;
    s.skillButtons[0].pressed = true; step(2);
    const blocked = s.spinHitAt === undefined && s.mp >= low;
    // 저절로 찬다.
    const regen = s.mp > low;
    return { full, spent, hitNear: after[0] < before[0] && after[1] < before[1], missFar: after[2] === before[2], blocked, regen };
  })()`);
  assert.deepEqual(result, { full: true, spent: true, hitNear: true, missFar: true, blocked: true, regen: true });
});

test('여관의 로제타에게 쉬어 가거나 집 침대에서 쉬면 체력이 차고, 처음 화면에서 시작하면 그곳에서 이어진다', async () => {
  await load('in-inn');
  const inn = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    localStorage.removeItem('untitled-rpg.rest');
    localStorage.removeItem('untitled-rpg.quests');
    s.quests = {};
    s.player.hp = 10;
    const rosetta = s.npcs.find(n => n.def.id === 'rosetta');
    s.openDialogue(rosetta.spot);
    while (s.dialogue.isOpen) s.dialogue.advance();
    const asked = s.storyChoice.isOpen;
    s.storyChoice.accept();
    return { asked, hp: s.player.hp, max: s.player.maxHp, saved: JSON.parse(localStorage.getItem('untitled-rpg.rest')).point };
  })()`);
  assert.equal(inn.asked, true, '평소 대화 뒤 쉬어 갈지 묻는다');
  assert.equal(inn.hp, inn.max);
  assert.equal(inn.saved, 'inn');

  await load('in-home');
  const home = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    const bed = s.interactables.find(i => i.id === 'rest-home');
    s.player.placeAt(bed.x, bed.y + 30);
    let t = performance.now();
    for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const label = s.attackButton.text.text;
    s.openDialogue(bed);
    const asked = s.storyChoice.isOpen;
    s.storyChoice.accept();
    return { label, asked, saved: JSON.parse(localStorage.getItem('untitled-rpg.rest')).point };
  })()`);
  assert.deepEqual(home, { label: '쉬기', asked: true, saved: 'home' });

  // 치유소 침대: 체력과 둔화를 회복하지만 다시 시작할 자리는 바꾸지 않는다.
  await load('in-clinic');
  const clinic = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    const bed = s.interactables.find(i => i.id === 'heal-clinic');
    s.player.placeAt(bed.x, bed.y + 30);
    s.player.hp = 5;
    s.slowedUntil = s.now + 99999;
    s.mp = 0;
    let t = performance.now();
    for (let i = 0; i < 3; i++) g.step(t += 16, 16);
    const label = s.attackButton.text.text;
    s.openDialogue(bed);
    const base = s.stats.maxHp;
    return { label, full: s.player.hp === s.player.maxHp, boosted: s.player.maxHp === base + s.herb && s.herb > 0, mpFull: s.mp === s.maxMp, slowed: s.now < s.slowedUntil, saved: JSON.parse(localStorage.getItem('untitled-rpg.rest')).point };
  })()`);
  // 에일라와 평소 대화를 마치면 치료해 줄지 묻고, 받으면 체력이 찬다.
  const eilaHeal = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const eila = s.npcs.find(n => n.def.id === 'eila');
    s.player.hp = 5;
    s.openDialogue(eila.spot);
    while (s.dialogue.isOpen) s.dialogue.advance();
    const asked = s.storyChoice.isOpen;
    s.storyChoice.accept();
    return { asked, full: s.player.hp === s.player.maxHp };
  })()`);
  assert.deepEqual(eilaHeal, { asked: true, full: true });
  assert.deepEqual(clinic, { label: '치료받기', full: true, boosted: true, mpFull: true, slowed: false, saved: 'home' });

  // 약초 기운은 맵을 옮겨도 이어지고, 처음 맞으면 사라진다.
  await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    s.scene.restart({ map: 'south-field', hp: s.player.hp, herb: s.herb }); g.step(performance.now(), 16);
  })()`);
  // 남쪽 들판의 몬스터 그림을 읽고 몬스터가 생길 때까지 기다린다.
  await until(() => evaluate(`(() => { const g = window.__game, s = g.scene.getScene('game'); g.step(performance.now(), 16); return s.mapId === 'south-field' && s.enemies.length > 0; })()`));
  const herb = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const carried = s.mapId === 'south-field' && s.herb > 0 && s.player.maxHp === s.stats.maxHp + s.herb && s.player.hp === s.player.maxHp;
    const enemy = s.enemies[0], c = enemy.character, p = s.player;
    c.placeAt(p.x - 60, p.y); c.facing = 1;
    p.invulnerableUntil = 0;
    const struck = s.onEnemyStrike(enemy);
    return { carried, struck, gone: s.herb === 0 && p.maxHp === s.stats.maxHp, hp: p.hp <= s.stats.maxHp };
  })()`);
  assert.deepEqual(herb, { carried: true, struck: true, gone: true, hp: true });

  // 처음 화면에서 시작하면 마지막으로 쉰 시온의 집 안에서 시작한다.
  const search = '?test=' + ++navigation;
  await send('Page.navigate', { url: appUrl + search });
  await until(() => evaluate(`location.search === ${JSON.stringify(search)} && !!window.__game?.scene.isActive('title')`));
  await evaluate(`window.__game.scene.getScene('title').start()`);
  await until(() => evaluate(`!!window.__game.scene.getScene('game')?.damageNumbers && window.__game.scene.isActive('game')`));
  const resumed = await evaluate(`(() => { const s = window.__game.scene.getScene('game'); return { map: s.mapId, walkable: s.walkArea.contains(s.player.x, s.player.y) }; })()`);
  assert.deepEqual(resumed, { map: 'in-home', walkable: true });
  await evaluate(`localStorage.removeItem('untitled-rpg.rest'); window.__game.loop.sleep()`);
});


test('잡화점 구매·판매 탭은 한 개씩 거래하고 부족·한도를 막으며 거래 결과와 빈 상태를 보여 준다', async () => {
  await load('in-store');
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),m=s.itemPanel;
    const saved=localStorage.getItem('untitled-rpg.inventory');
    s.inventory={gold:79,items:{potion:3,lunch:1,'slime-gel':6}};
    s.openItemPanel('shop');
    const objects=s.children.list.length, buyRows=m.visibleRows;
    m.rows[0].button.emit('pointerup');
    const bought={gold:s.inventory.gold,count:s.inventory.items.potion,status:m.status.text};
    m.sellTab.emit('pointerup');const sellRows=m.visibleRows;
    m.rows[2].button.emit('pointerup');
    const sold={gold:s.inventory.gold,count:s.inventory.items['slime-gel'],status:m.status.text};
    const bounds=[];
    for(const width of [960,1280,1728]){
      m.layout(width);
      bounds.push(m.rows.every(r=>!r.name.visible||(r.stock.getBounds().right<r.button.getBounds().left&&r.button.getBounds().right<width&&r.button.getBounds().bottom<m.status.getBounds().top)));
    }
    m.layout(s.scale.gameSize.width);
    s.inventory={gold:0,items:{}};m.refresh(s.inventory);m.buyTab.emit('pointerup');
    const blocked={enabled:!!m.rows[0].button.input.enabled,reason:m.rows[0].stock.text};
    m.rows[0].button.emit('pointerup');const noPurchase=s.inventory.gold===0&&!s.inventory.items.potion;
    s.inventory={gold:100,items:{potion:99}};m.refresh(s.inventory);
    const full={enabled:!!m.rows[0].button.input.enabled,reason:m.rows[0].stock.text};
    m.rows[0].button.emit('pointerup');const noOverflow=s.inventory.gold===100&&s.inventory.items.potion===99;
    s.inventory={gold:999999,items:{potion:1}};m.refresh(s.inventory);m.sellTab.emit('pointerup');
    const goldCap=!m.rows[0].button.input.enabled;
    s.inventory={gold:0,items:{}};m.refresh(s.inventory);
    const empty=m.empty.visible&&m.visibleRows===0&&m.empty.text.includes('판매할');
    for(let i=0;i<5;i++){m.buyTab.emit('pointerup');m.sellTab.emit('pointerup');}
    const reused=s.children.list.length===objects;
    const now=s.now;s.update(0,50);const frozen=s.now===now;
    m.closeButton.emit('pointerup');
    if(saved===null)localStorage.removeItem('untitled-rpg.inventory');else localStorage.setItem('untitled-rpg.inventory',saved);
    return {buyRows,sellRows,bought,sold,bounds,blocked,noPurchase,full,noOverflow,goldCap,empty,reused,frozen,closed:!m.isOpen};
  })()`);
  assert.equal(result.buyRows,2);assert.equal(result.sellRows,3);
  assert.deepEqual([result.bought.gold,result.bought.count],[59,4]);assert.match(result.bought.status,/구매/);
  assert.deepEqual([result.sold.gold,result.sold.count],[63,5]);assert.match(result.sold.status,/판매/);
  assert.ok(result.bounds.every(Boolean));assert.equal(result.blocked.enabled,false);assert.match(result.blocked.reason,/골드/);
  assert.equal(result.full.enabled,false);assert.match(result.full.reason,/가득/);
  for(const key of ['noPurchase','noOverflow','goldCap','empty','reused','frozen','closed'])assert.equal(result[key],true,key);
});

test('창이 열려 있을 때 그 아래 전투 버튼 자리를 눌러도 버튼이 눌리지 않는다 (쉬어 가기 아래의 공명)', async () => {
  await load('in-inn');
  const at = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    localStorage.removeItem('untitled-rpg.rest'); s.quests = {};
    s.setResonanceCharge(15); s.player.hp = 10;
    s.openDialogue(s.npcs.find(n => n.def.id === 'rosetta').spot);
    while (s.dialogue.isOpen) s.dialogue.advance();
    const c = s.resonanceButton.center, yes = s.storyChoice.yes.getBounds();
    const r = window.__game.canvas.getBoundingClientRect(), size = window.__game.scale.gameSize;
    return { open: s.storyChoice.isOpen, underYes: yes.contains(c.x, c.y),
      x: r.left + c.x * r.width / size.width, y: r.top + c.y * r.height / size.height };
  })()`);
  assert.equal(at.open, true);
  // 실제 마우스로 공명 버튼 가운데를 누른다. 이 자리는 쉬어 가기 버튼 위이기도 하다.
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await evaluate(`(() => { const g = window.__game; let t = performance.now(); for (let i = 0; i < 3; i++) g.step(t += 16, 16); return true; })()`);
  }
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    let t = performance.now(); for (let i = 0; i < 10; i++) g.step(t += 16, 16);
    const out = { choice: s.storyChoice.isOpen, resonating: s.resonating, charge: s.resonanceCharge, healed: s.player.hp === s.player.maxHp };
    localStorage.removeItem('untitled-rpg.rest'); s.setResonanceCharge(0);
    return out;
  })()`);
  assert.equal(result.resonating, false, '공명이 쓰이지 않는다');
  assert.equal(result.charge, 15, '구슬도 그대로');
  if (at.underYes) assert.deepEqual([result.choice, result.healed], [false, true], '누른 곳의 창 버튼(쉬어 가기)만 동작한다');
});

test('대화를 넘기려고 공명·막기 버튼 자리를 눌러도, 대화가 닫힌 뒤 그 버튼이 쓰이지 않는다', async () => {
  await load('village');
  for (const name of ['resonanceButton', 'blockButton']) {
    const at = await evaluate(`(() => {
      const s = window.__game.scene.getScene('game');
      s.quests = {}; s.setResonanceCharge(15); s.parryReadyAt = 0; s.parryUntil = 0;
      s.openDialogue(s.npcs.find(n => n.def.id === 'vernel').spot);
      const c = s.${name}.center, r = window.__game.canvas.getBoundingClientRect(), size = window.__game.scale.gameSize;
      return { open: s.dialogue.isOpen, x: r.left + c.x * r.width / size.width, y: r.top + c.y * r.height / size.height };
    })()`);
    assert.equal(at.open, true);
    // 대화가 닫힐 때까지 같은 자리를 실제 마우스로 누른다(마지막 누름이 대화를 닫는다).
    for (let i = 0; i < 16; i++) {
      if (!await evaluate(`window.__game.scene.getScene('game').dialogue.isOpen`)) break;
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
        await evaluate(`(() => { const g = window.__game; let t = performance.now(); for (let i = 0; i < 3; i++) g.step(t += 16, 16); return true; })()`);
      }
    }
    const result = await evaluate(`(() => {
      const g = window.__game, s = g.scene.getScene('game');
      let t = performance.now(); for (let i = 0; i < 10; i++) g.step(t += 16, 16);
      const out = { open: s.dialogue.isOpen, resonating: s.resonating, charge: s.resonanceCharge, parried: s.parryUntil > 0 };
      s.setResonanceCharge(0);
      return out;
    })()`);
    assert.deepEqual(result, { open: false, resonating: false, charge: 15, parried: false }, name);
  }
});

test('동료는 주인공을 따라오고, 가까운 적과 스스로 싸우며, 쓰러지면 다시 일어나고, 맵을 옮겨도 함께 온다', async () => {
  await load('south-field');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game'), p = s.player;
    let t = performance.now(); const step = (n) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); };
    const before = !!s.companion;
    s.setCompanion('joan');
    const c = s.companion;
    const saved = localStorage.getItem('untitled-rpg.companion');
    for (const e of s.enemies) e.character.placeAt(e.character.x + 6000, e.character.y);
    s.joystick.vector.set(1, 0); step(120); s.joystick.vector.set(0, 0); step(90);
    const follow = Math.hypot(c.x - p.x, c.y - p.y);
    p.invulnerableUntil = Infinity;
    const e = s.enemies[0]; e.character.placeAt(c.x + 60, c.y);
    const hp0 = e.character.hp; let hit = false;
    for (let i = 0; i < 400 && !hit; i++) { step(1); if (e.character.hp < hp0) hit = true; }
    c.receiveCombatHit(s.now, { x: c.x + 10, y: c.y }, 9999);
    const downed = c.downed;
    step(2);
    // 일어나기까지 기다리는 대신, 쓰러진 시각을 회복 시간만큼 앞당긴다.
    const stillDown = c.downed && s.companionDownAt !== undefined;
    s.companionDownAt -= 8000;
    step(2);
    return { before, name: c.def.name, saved, follow, hit, downed: downed && stillDown, revived: !c.downed && c.canFight };
  })()`);
  assert.equal(result.before, false, '정하기 전에는 동료가 없다');
  assert.equal(result.name, '조안');
  assert.equal(result.saved, 'joan');
  assert.ok(result.follow < 200, '걸어간 주인공을 따라온다: ' + result.follow);
  assert.equal(result.hit, true, '가까운 적을 스스로 친다');
  assert.equal(result.downed, true);
  assert.equal(result.revived, true, '쓰러져도 잠시 뒤 다시 일어난다');
  const after = await evaluate(`(async () => {
    const g = window.__game; let s = g.scene.getScene('game');
    s.travel(s.map.exits.find(x => x.to === 'village'));
    for (let i = 0; i < 400; i++) {
      await new Promise(r => setTimeout(r, 10)); g.step(performance.now(), 16); s = g.scene.getScene('game');
      if (s.mapId === 'village' && s.sys.isActive() && s.minimap && !s.traveling) break;
    }
    const near = s.companion && Math.hypot(s.companion.x - s.player.x, s.companion.y - s.player.y);
    s.setCompanion(undefined);
    return { map: s.mapId, near, gone: !s.companion && localStorage.getItem('untitled-rpg.companion') === null };
  })()`);
  assert.equal(after.map, 'village');
  assert.ok(after.near < 250, '맵을 옮기면 주인공 곁에 함께 선다: ' + after.near);
  assert.equal(after.gone, true, '떠나보내면 사라지고 저장도 지운다');
});

test('여관 휴식 창은 회복량·다음 위치를 보여 주고 취소 시 유지하며 확인 시 한 번만 회복·저장한다', async () => {
  await load('in-inn');
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),m=s.storyChoice;
    localStorage.removeItem('untitled-rpg.rest');s.quests={};s.player.hp=10;
    const n=s.npcs.find(n=>n.def.id==='rosetta');
    const ask=()=>{s.openDialogue(n.spot);while(s.dialogue.isOpen)s.dialogue.advance();};
    ask();const summary=m.summary.text, title=m.title.text;
    const now=s.now;s.update(0,50);const frozen=s.now===now;
    const bounds=[];
    for(const width of [960,1280,1728]){
      m.layout(width);const a=m.no.getBounds(),b=m.yes.getBounds();
      bounds.push(a.left>=0&&a.right<b.left&&b.right<=width&&a.bottom<=720&&b.bottom<=720&&m.summary.getBounds().bottom<m.hint.y);
    }
    m.layout(s.scale.gameSize.width);m.no.emit('pointerup');
    const cancelled=!m.isOpen&&s.player.hp===10&&localStorage.getItem('untitled-rpg.rest')===null;
    ask();m.yes.emit('pointerup');
    const accepted=!m.isOpen&&s.player.hp===s.player.maxHp&&JSON.parse(localStorage.getItem('untitled-rpg.rest')).point==='inn';
    s.player.hp=10;m.accept();const once=s.player.hp===10;
    localStorage.removeItem('untitled-rpg.rest');
    return {summary,title,frozen,bounds,cancelled,accepted,once};
  })()`);
  assert.match(result.title,/여관/);assert.match(result.summary,/10 \/ /);assert.match(result.summary,/다음 시작 위치/);
  assert.ok(result.bounds.every(Boolean));
  for(const key of ['frozen','cancelled','accepted','once'])assert.equal(result[key],true,key);
});

test('마을 돌담은 긴 이동·회피 거리도 막고 세 문은 통과하며 지도와 미니맵에도 표시된다', async () => {
  await load('village');
  // 담과 문의 자리는 게임의 담 상수에서 계산한다(맵 배율·담 위치가 바뀌어도 따라간다).
  const L = mapLength, E = VILLAGE_EDGE, G = VILLAGE_GATES;
  const westStart = { x: WALL_INNER_LEFT + L(48), y: L(700) }, eastStart = { x: WALL_INNER_RIGHT - L(48), y: L(750) };
  const eastGate = { x: G.east.x - L(108), y: (G.east.top + G.east.bottom) / 2 };
  const plaza=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    const out={x:0,y:0,set(x,y){this.x=x;this.y=y;return this;}};
    const move=(x,y,dx,dy)=>{s.walkArea.move(x,y,dx,dy,out);return {x:out.x,y:out.y};};
    const west=move(${westStart.x},${westStart.y},${-L(400)},0),east=move(${eastStart.x},${eastStart.y},${L(500)},0),south=move(${L(800)},${L(1580)},0,${L(400)});
    const gates=[move(${L(200)},${L(1050)},${-L(100)},0),move(${eastGate.x},${eastGate.y},${L(120)},0),move(${L(1180)},${L(1520)},0,${L(100)})];
    const bodyBounds=[];
    const bodyInside=[west,east].every((point,i)=>{
      s.player.placeAt(point.x,point.y);
      return [[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]].every(([dx,dy])=>{
        s.player.sprite.setMovement(dx,dy);
        s.player.sprite.play('hero-walk');
        const body=s.player.sprite.getBounds(),shadow=s.player.shadow.getBounds();
        bodyBounds.push({i,dx,dy,body,shadow,image:s.player.sprite.image.getBounds()});
        // 몸과 그림자가 담의 안쪽 면을 넘지 않는다.
        return i===0?Math.min(body.left,shadow.left)>=${E.left + WALL_HALF_WIDTH}:Math.max(body.right,shadow.right)<=${E.right - WALL_HALF_WIDTH + 2};
      });
    });
    const treesInside=s.children.list.filter(o=>o.name==='village-prop-oak'||o.name==='village-prop-pine')
      .every(o=>{const b=o.getBounds();return b.left>=${E.left + L(52)}&&b.right<=${E.right - L(50)};});
    const wallCount=s.children.list.filter(o=>o.name==='village-wall').length;
    const posts=s.children.list.filter(o=>o.name==='village-gate-west'||o.name==='village-gate-east').length;
    s.openWorldMap();
    const shared=s.worldMap.preview.key===s.minimap.preview.key;
    s.worldMap.close();
    return {west,east,south,gates,wallCount,posts,shared,bodyInside,treesInside,bodyBounds};
  })()`);
  assert.equal(plaza.bodyInside,true,JSON.stringify(plaza.bodyBounds));assert.equal(plaza.treesInside,true);
  // 담 안쪽 경계(담 반폭 + 캐릭터 여유)에서 멈춘다.
  assert.ok(plaza.west.x>=WALL_INNER_LEFT&&plaza.west.x<WALL_INNER_LEFT+L(14),JSON.stringify(plaza.west));
  assert.ok(plaza.east.x<=WALL_INNER_RIGHT&&plaza.east.x>WALL_INNER_RIGHT-L(14),JSON.stringify(plaza.east));
  assert.ok(plaza.south.y<=L(1656)&&plaza.south.y>L(1640),JSON.stringify(plaza.south));
  // 세 문은 막지 않는다.
  for (const [i, expected] of [{x:L(100),y:L(1050)},{x:eastGate.x+L(120),y:eastGate.y},{x:L(1180),y:L(1620)}].entries()) {
    assert.ok(Math.hypot(plaza.gates[i].x-expected.x,plaza.gates[i].y-expected.y)<1e-6,JSON.stringify([plaza.gates[i],expected]));
  }
  assert.ok(plaza.wallCount>30&&plaza.wallCount<90);assert.equal(plaza.posts,4);assert.equal(plaza.shared,true);
  await load('village-north');
  const north=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),out={x:0,y:0,set(x,y){this.x=x;this.y=y;return this;}};
    s.walkArea.move(${L(850)},${L(350)},0,${-L(400)},out);
    return {y:out.y,walls:s.children.list.filter(o=>o.name==='village-wall').length};
  })()`);
  assert.ok(north.y>=E.north+L(6)&&north.y<E.north+L(22),JSON.stringify(north));assert.ok(north.walls>30);
});

test('일반 병사들은 그림을 공유하고 세 문에 두 명씩 서며 순찰·8방향 모션·대화가 동작한다', async () => {
  await load('village');
  await evaluate(`localStorage.removeItem('untitled-rpg.quests')`);
  await load('village');
  const plaza=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game'),guards=s.npcs.filter(n=>n.def.skin==='soldier');
    const start=new Map(guards.map(n=>[n.def.id,{x:n.x,y:n.y}]));
    const moved=Object.fromEntries(guards.map(n=>[n.def.id,0]));
    s.player.placeAt(1180,380);
    for(let i=0;i<1100;i++){
      s.update(i*16,16);
      for(const n of guards){const p=start.get(n.def.id);moved[n.def.id]=Math.max(moved[n.def.id],Math.hypot(p.x-n.x,p.y-n.y));}
    }
    const posts=guards.filter(n=>n.def.gate),patrol=guards.filter(n=>n.def.wander);
    const frames=[];const n=guards[0];
    for(const d of ['down','left','right','up','down-left','down-right','up-left','up-right'])for(let p=0;p<4;p++){
      n.direction=d;n.showFrame(p);frames.push(n.figure.texture.key+':'+n.figure.frame.name);
    }
    n.showFrame(0);
    const shared=guards.every(g=>g.walk===n.walk);
    const textures=Object.keys(s.textures.list).filter(k=>k.startsWith('npc-soldier-'));
    s.player.placeAt(n.spot.x,n.spot.y+20);s.openDialogue(n.spot);
    const dialogue={open:s.dialogue.isOpen,name:s.dialogue.nameText.text,key:s.dialogue.portrait.texture.key};
    while(s.dialogue.isOpen)s.dialogue.advance();
    return {count:guards.length,posts:posts.length,patrol:patrol.length,stationary:posts.every(n=>moved[n.def.id]===0),
      walking:patrol.every(n=>moved[n.def.id]>20),onGround:guards.every(n=>s.walkArea.contains(n.x,n.y)),
      frames:new Set(frames).size,shared,textures,dialogue};
  })()`);
  assert.deepEqual([plaza.count,plaza.posts,plaza.patrol],[8,6,2]);
  for(const key of ['stationary','walking','onGround','shared'])assert.equal(plaza[key],true,key);
  assert.equal(plaza.frames,32);assert.equal(plaza.textures.length,3);
  assert.deepEqual(plaza.dialogue,{open:true,name:'서문 병사',key:'portrait-soldier'});
  await load('village-north');
  const north=await evaluate(`(()=>{const s=window.__game.scene.getScene('game');return s.npcs.filter(n=>n.def.skin==='soldier').map(n=>({wander:n.def.wander,clear:s.walkArea.contains(n.x,n.y)}));})()`);
  assert.equal(north.length,2);assert.ok(north.every(n=>n.wander>0&&n.clear));
});

test('물약·도시락 바로 사용 버튼은 해당 물품만 쓰고 대기시간·메뉴 입력·큰 버튼 배치를 처리한다', async () => {
  await load('village');
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game');
    const saved=localStorage.getItem('untitled-rpg.inventory');
    s.player.setMaxHp(200,true);s.player.hp=10;s.drawHud();
    s.quickSlots=['potion','lunch'];s.inventory={gold:0,items:{potion:3,lunch:2}};s.refreshInventory();
    const tick=(n=1)=>{for(let i=0;i<n;i++)s.update(0,50);};
    s.lunchButton.pressed=true;tick();
    const lunch={hp:s.player.hp,p:s.inventory.items.potion,l:s.inventory.items.lunch};
    s.potionButton.pressed=true;tick();const shared=s.player.hp===160&&s.inventory.items.potion===3;
    tick(600);s.potionButton.pressed=true;tick();
    const potion={hp:s.player.hp,p:s.inventory.items.potion,l:s.inventory.items.lunch};
    tick(600);s.lunchButton.pressed=true;tick();const full=s.inventory.items.lunch===1;
    s.player.hp=10;s.inventory={gold:0,items:{lunch:2}};s.refreshInventory();
    s.potionButton.pressed=true;tick();const exact=s.player.hp===10&&s.inventory.items.lunch===2;
    s.lunchButton.pressed=true;s.lunchButton.isDown=true;tick(40);s.lunchButton.isDown=false;
    const once=s.player.hp===160&&s.inventory.items.lunch===1;
    s.player.hp=10;s.inventory={gold:0,items:{potion:2,lunch:2}};s.refreshInventory();
    s.openPause();s.potionButton.pressed=true;s.lunchButton.pressed=true;tick(2);s.pauseMenu.close();tick(2);
    const noBufferedUse=s.player.hp===10&&s.inventory.items.potion===2&&s.inventory.items.lunch===2;
    const guard=s.npcs.find(n=>n.def.skin==='soldier');s.openDialogue(guard.spot);
    s.potionButton.pressed=true;s.lunchButton.pressed=true;while(s.dialogue.isOpen)s.dialogue.advance();tick(2);
    const dialogueCleared=s.player.hp===10&&s.inventory.items.potion===2&&s.inventory.items.lunch===2;
    const layouts=[];
    for(const width of [960,1280,1728])for(const size of ['small','normal','large']){
      // 4:3(960) 화면의 '크게' 버튼은 물약 칸이 조이스틱 쉬는 자리에 가까워지므로 뺀다(tools/button-layout.test.mjs와 같다).
      if(width===960&&size==='large')continue;
      s.applySettings({...s.settings,buttonSize:size,joystickSize:'large'});
      // Use the same layout method as a resize without changing the canvas underneath the browser harness.
      const original=s.scale.gameSize.width;s.scale.gameSize.width=width;s.layout();
      const items=[s.potionButton,s.lunchButton],other=[s.attackButton,s.dodgeButton,s.blockButton,s.resonanceButton,...s.skillButtons];
      layouts.push(items.every((a,i)=>{
        const all=[...other,...items.filter((_,j)=>j!==i)];
        return a.image.x-a.size*1.2>=0&&a.image.x+a.size*1.2<=width&&a.image.y+a.size*1.2<=720&&
          all.every(b=>Math.hypot(a.image.x-b.image.x,a.image.y-b.image.y)>=(a.size+b.size)*1.2+4)&&
          Math.hypot(a.image.x-s.joystick.centerX,a.image.y-s.joystick.centerY)>a.size*1.2+s.joystick.size*1.35;
      }));
      s.scale.gameSize.width=original;
    }
    s.applySettings({...s.settings,buttonSize:'normal',joystickSize:'normal'});
    const icons=[s.potionButton.icon.frame.name,s.lunchButton.icon.frame.name];
    if(saved===null)localStorage.removeItem('untitled-rpg.inventory');else localStorage.setItem('untitled-rpg.inventory',saved);
    return {lunch,shared,potion,full,exact,once,noBufferedUse,dialogueCleared,layouts,icons};
  })()`);
  assert.deepEqual(result.lunch,{hp:160,p:3,l:1});assert.deepEqual(result.potion,{hp:200,p:2,l:1});
  for(const key of ['shared','full','exact','once','noBufferedUse','dialogueCleared'])assert.equal(result[key],true,key);
  assert.ok(result.layouts.every(Boolean));assert.deepEqual(result.icons,['potion','lunch']);
});

test('빈 슬롯 등록·가방에서 교체·해제·저장이 가능하고 20초 원형 대기는 교체와 가방으로 우회되지 않는다', async () => {
  await load('village');
  await evaluate(`localStorage.removeItem('untitled-rpg.quick-slots')`);
  await load('village');
  const result=await evaluate(`(()=>{
    const g=window.__game,s=g.scene.getScene('game');
    s.player.setMaxHp(200,true);s.player.hp=10;s.inventory={gold:0,items:{potion:3,lunch:2}};s.refreshInventory();
    const tick=(n=1)=>{for(let i=0;i<n;i++)s.update(0,50);};
    const empty=s.quickSlots.every(x=>x===null)&&!s.potionButton.icon.visible;
    s.potionButton.pressed=true;tick();const opened=s.quickSlotPanel.isOpen;
    const frozenAt=s.now;tick(10);const frozen=s.now===frozenAt;
    s.quickSlotPanel.rows[0].button.emit('pointerup');tick();
    s.openItemPanel('bag');s.itemPanel.sellTab.emit('pointerup');
    const bagSetup=s.quickSlotPanel.isOpen;s.quickSlotPanel.rows[1].button.emit('pointerup');tick();
    const saved=JSON.parse(localStorage.getItem('untitled-rpg.quick-slots')).slots;
    s.potionButton.pressed=true;tick();
    const afterUse={hp:s.player.hp,p:s.inventory.items.potion,l:s.inventory.items.lunch,
      seconds:s.potionButton.cooldownSeconds,visible:s.potionButton.cooldownShade.visible};
    tick(200);const middle={seconds:s.potionButton.cooldownSeconds,step:s.potionButton.cooldownStep};
    const remaining=s.nextUseAt-s.now;
    s.openQuickSlot(0);s.quickSlotPanel.rows[1].button.emit('pointerup');
    const kept=s.nextUseAt-s.now===remaining;
    s.potionButton.pressed=true;tick();const swapBlocked=s.player.hp===60&&s.inventory.items.lunch===2;
    s.openItemPanel('bag');s.onItemAction({type:'use',id:'potion'});
    const bagBlocked=s.player.hp===60&&s.itemPanel.status.text.includes('재사용');s.itemPanel.close();
    s.openCharacterPanel('items');
    const characterHidesSlots=!s.potionButton.image.visible&&!s.lunchButton.image.visible;
    s.onItemAction({type:'use',id:'potion'});s.openQuickSlot(0);
    const characterBlocked=s.player.hp===60&&s.characterPanel.status.text.includes('재사용')&&!s.quickSlotPanel.isOpen;
    s.characterPanel.close();
    s.openQuickSlot(0);s.openCharacterPanel('items');
    const selectorExclusive=!s.characterPanel.isOpen;s.quickSlotPanel.close();
    tick(200);s.potionButton.pressed=true;tick();const expired=s.player.hp===200&&s.inventory.items.lunch===1;
    s.openQuickSlot(0);s.quickSlotPanel.clear.emit('pointerup');
    const cleared=s.quickSlots[0]===null&&!s.potionButton.icon.visible&&s.potionButton.cooldownStep===0;
    s.scene.restart();g.step(performance.now(),16);g.step(performance.now()+16,16);
    const restored={slots:s.quickSlots,cooldown:s.nextUseAt-s.now};
    localStorage.removeItem('untitled-rpg.quick-slots');g.registry.set('quick-item-cooldown',0);s.nextUseAt=0;
    return {empty,opened,frozen,bagSetup,saved,afterUse,middle,kept,swapBlocked,bagBlocked,characterHidesSlots,characterBlocked,selectorExclusive,expired,cleared,restored};
  })()`);
  for(const key of ['empty','opened','frozen','bagSetup','kept','swapBlocked','bagBlocked','characterHidesSlots','characterBlocked','selectorExclusive','expired','cleared'])assert.equal(result[key],true,key);
  assert.deepEqual(result.saved,['potion','lunch']);assert.deepEqual(result.afterUse,{hp:60,p:2,l:2,seconds:20,visible:true});
  assert.equal(result.middle.seconds,10);assert.ok(result.middle.step>=179&&result.middle.step<=181);
  assert.deepEqual(result.restored.slots,[null,'lunch']);assert.ok(result.restored.cooldown>19000);
});

test('회피·막기·회전베기는 원형 대기가 줄어들고 메뉴에서는 멈추며 성공 초기화와 마나 부족을 구분한다', async () => {
  await load('village');
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game');
    const tick=(n=1)=>{for(let i=0;i<n;i++)s.update(0,50);};
    s.skillSlots[0]='spin';s.refreshSkillButtons();const skillButton=s.skillButtons[0];
    const state=b=>({seconds:b.cooldownSeconds,step:b.cooldownStep,visible:b.cooldownShade.visible});
    // 게임 시계가 소수 ms에서 시작해도(실제 프레임 간격에 따라 달라진다) 남은 초가 1초 더 보이지 않아야 한다.
    s.now=1573.3629902798957;
    s.dodgeButton.pressed=true;tick();const dodge=state(s.dodgeButton);
    tick(100);const half=state(s.dodgeButton);
    s.openPause();const pausedAt=s.now;tick(20);
    const frozen=s.now===pausedAt&&s.dodgeButton.cooldownStep===half.step;s.pauseMenu.close();
    s.onJustDodge({interrupt(){}});s.hitStopLeft=0;s.slowMotionLeft=0;tick();
    const reset=state(s.dodgeButton);
    s.derived.dodgeCooldown=.5;s.dodgeButton.pressed=true;tick();const dex=state(s.dodgeButton);
    tick(8);s.blockButton.pressed=true;tick();const block=state(s.blockButton);
    // 헛막기 대기 BLOCK.cooldownMs(450ms)의 절반: 25ms씩 9번
    for(let i=0;i<9;i++)s.update(0,25);const blockHalf=state(s.blockButton);
    tick(12);const blockDone=state(s.blockButton);
    s.mp=s.maxMp;skillButton.pressed=true;tick();const skill=state(skillButton);
    const labels=[s.dodgeButton,skillButton].every(b=>{
      const a=b.cooldownText.getBounds(),c=b.text.getBounds();return a.bottom<c.top&&c.bottom<b.image.y+b.size;
    });
    tick(10);const skillHalf=state(skillButton);
    tick(12);s.mp=0;tick();const noMana=state(skillButton);
    return {dodge,half,frozen,reset,dex,block,blockHalf,blockDone,skill,skillHalf,noMana,labels};
  })()`);
  assert.deepEqual(result.dodge,{seconds:10,step:360,visible:true});
  assert.equal(result.half.seconds,5);assert.ok(Math.abs(result.half.step-180)<=1);
  assert.equal(result.frozen,true);assert.equal(result.reset.visible,false);
  assert.equal(result.dex.seconds,5);assert.equal(result.dex.step,360);
  assert.equal(result.block.visible,true);assert.equal(result.block.step,360);
  assert.ok(Math.abs(result.blockHalf.step-180)<=1);assert.equal(result.blockDone.visible,false);
  assert.equal(result.skill.visible,true);assert.equal(result.skill.step,360);
  assert.ok(result.skillHalf.step>0&&result.skillHalf.step<360);
  assert.equal(result.noMana.visible,false);assert.equal(result.labels,true);
});

test('캐릭터 창·장비창·대장간은 기존 아이템과 승급·장신구 아이콘을 원본 비율로 재사용한다', async () => {
  await load('village');
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game');
    s.inventory={gold:1000,items:{potion:3,lunch:2,'slime-gel':4}};
    s.character.gear={enhance:{weapon:0,head:0,body:0,hands:0,feet:0},rank:{weapon:1,head:1,body:1,hands:1,feet:1},bag:{'clover-charm':1,'blue-bead':1},equipped:{accessory1:'wildflower-bracelet'}};
    s.openCharacterPanel('items');const m=s.characterPanel;
    const read=c=>({key:c.image.texture.key,frame:c.image.frame.name,image:c.image.visible,glyph:c.glyph.text,
      fits:Math.abs(Math.max(c.image.displayWidth,c.image.displayHeight)-c.size*.82)<.01});
    const cells=Object.fromEntries(m.entries.map((e,i)=>[e.id,read(m.cells[i])]));
    const details={};m.entries.forEach((e,i)=>{m.selectCell(i);details[e.id]=read(m.detailIcon);});
    m.close();s.openCharacterPanel('equip');
    const weapon=read(m.slots[0].icon),body=read(m.slots[2].icon),acc=read(m.slots[5].icon);
    m.close();s.openCharacterPanel('items',true);
    m.switchShopTab('buy');
    const shop=Object.fromEntries(m.entries.map((e,i)=>[e.id,read(m.cells[i])]));m.close();
    const textures=Object.keys(s.textures.list).length;
    for(let i=0;i<3;i++){s.openCharacterPanel('items');m.close();}
    return {cells,details,weapon,body,acc,shop,reused:Object.keys(s.textures.list).length===textures};
  })()`);
  for(const id of ['potion','lunch','slime-gel']){
    for(const group of [result.cells,result.details]){
      assert.deepEqual(group[id],{key:'item-icons',frame:id,image:true,glyph:'',fits:true});
    }
  }
  assert.equal(result.cells['clover-charm'].image,true);
  assert.equal(result.cells['blue-bead'].image,true);
  for(const [cell,id] of [[result.weapon,'iron-sword'],[result.body,'leather-armor']]){
    assert.equal(cell.key,'item-icons');assert.equal(cell.frame,id);assert.equal(cell.image,true);assert.equal(cell.fits,true);
  }
  assert.equal(result.acc.image,true);
  assert.equal(result.shop['clover-charm'].image,true);
  assert.equal(result.reused,true);
});

test('무기 강화는 외형을 바꾸지 않고, 무기 승급이 별도 레이어와 칼집 손잡이·잔상·저장에 반영된다', async () => {
  await load('village');
  const result=await evaluate(`(()=>{
    const g=window.__game,s=g.scene.getScene('game'),h=s.player.sprite;
    s.inventory={gold:2000,items:{'iron-shard':4,'slime-gel':4}};
    s.openCharacterPanel('items',true);
    for(let i=0;i<3;i++)s.enhanceGearSlot('weapon');
    const enhanceKeepsWood=h.weapon==='wooden-sword'&&s.character.gear.enhance.weapon===3;
    s.characterPanel.switchShopTab('promote');
    s.promoteGearSlot('weapon');
    s.characterPanel.close();
    h.play('hero-idle');const promoted=h.weapon==='iron-sword'&&h.weaponFront.frame.name==='iron-sword-hilt'&&!h.weaponBack.visible;
    const errors=[];
    for(const weapon of ['wooden-sword','iron-sword']){
      h.setWeapon(weapon);
      for(const facing of ['left','right','down-left','down-right','up-left','up-right'])for(const action of ['attack1','attack2','attack3','dodge']){
        h.setAttackFacing(facing);h.setFlipX(facing.includes('left'));h.play('hero-'+action);
        for(let i=0;i<8;i++){
          h.advance(30);const f=h.frame,b=h.getBlade(),matrix=h.image.getWorldTransformMatrix(),body=h.getWorldTransformMatrix();
          const expected=p=>matrix.transformPoint(p.x-f.originX*f.w,p.y-f.originY*f.h);
          // 공격 중 몸이 늘었다 줄어들어도(attackBodyMotion) 코등이는 몸을 따라가고 칼날은 원래 배율(f.scale) 그대로다.
          const sx=f.scale*(h.image.scaleX<0?-1:1),local={x:(f.blade.base.x-f.originX*f.w)*h.image.scaleX+(f.blade.tip.x-f.blade.base.x)*sx,
            y:h.image.y+(f.blade.base.y-f.originY*f.h)*h.image.scaleY+(f.blade.tip.y-f.blade.base.y)*f.scale};
          const a=expected(f.blade.base),z=body.transformPoint(local.x,local.y);
          errors.push(Math.hypot(a.x-b.base.x,a.y-b.base.y),Math.hypot(z.x-b.tip.x,z.y-b.tip.y));
        }
      }
    }
    h.setWeapon('iron-sword');h.play('hero-attack1');h.advance(50);
    const ghost=h.spawnGhost(s.player.x,s.player.y,0,0x9fc4ff,.3),copies=ghost.list.map(o=>o.texture.key+':'+o.frame.name);
    h.setWeapon(undefined);const empty=!h.weaponFront.visible&&!h.weaponBack.visible&&Math.hypot(h.getBlade().tip.x-h.getBlade().base.x,h.getBlade().tip.y-h.getBlade().base.y)===0;
    h.spawnGhost(s.player.x,s.player.y,0,0x9fc4ff,.3,ghost);
    // 무기를 뺀 잔상: 무기 그림 조각은 모두 숨는다(손잡이를 덮는 주먹 그림이 있는 자세는 조각 순서가 달라 순서로 찾지 않는다).
    const weaponCopies=ghost.list.filter(o=>o.texture.key.startsWith('hero-weapons'));const emptyGhost=weaponCopies.length===2&&weaponCopies.every(o=>!o.visible);ghost.destroy();
    s.scene.restart();g.step(performance.now(),16);g.step(performance.now()+16,16);
    const restored=s.player.sprite.weapon==='iron-sword'&&s.character.gear.rank.weapon===1&&s.character.gear.enhance.weapon===3;
    return {enhanceKeepsWood,promoted,maxError:Math.max(...errors),copies,empty,emptyGhost,restored};
  })()`);
  for(const key of ['enhanceKeepsWood','promoted','empty','emptyGhost','restored'])assert.equal(result[key],true,key);
  assert.ok(result.maxError<.001,JSON.stringify(result));
  // 잔상은 무기의 손잡이와 칼날 조각을 함께 복사한다(조각 순서는 자세마다 다르다).
  assert.ok(result.copies.includes('hero-weapons:iron-sword-grip')&&result.copies.includes('hero-weapons:iron-sword-blade'),JSON.stringify(result.copies));
});

test('네 검은 정면 찌르기와 좌우·앞대각선 공격에서 주먹에 맞는 손잡이를 표시한다', async () => {
  await load('village');
  const results = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), h=s.player.sprite;
    h.setAttackFacing('down');
    const sample=(action,time)=>{
      h.play('hero-'+action);
      h.time=time;h.applyFrame();
      const blade=h.getBlade(), front=h.weaponFront, back=h.weaponBack;
      return {body:h.frame.name, blade, front:front.frame.name, grip:back.frame.name,
        // 주먹 덮개가 있는 자세는 손잡이를 몸 앞에 두고 원화의 주먹(덮개)으로 가린다: 몸 < 손잡이 < 주먹 < 칼날.
        depth:h.frame.gripCover
          ? h.list.indexOf(h.image)<h.list.indexOf(back)&&h.list.indexOf(back)<h.list.indexOf(h.supportHand)
            &&h.list.indexOf(h.supportHand)<h.list.indexOf(front)&&h.supportHand.visible
          : h.list.indexOf(back)<h.list.indexOf(h.image)&&h.list.indexOf(h.image)<h.list.indexOf(front),
        visible:front.visible&&back.visible,
        length:Math.hypot(blade.tip.x-blade.base.x,blade.tip.y-blade.base.y)};
    };
    return ['wooden-sword','iron-sword','short-sword','long-sword'].map(id=>{
      h.setWeapon(id);
      const end=sample('attack2',800), start=sample('attack3',0), thrust=sample('attack3',180);
      h.setAttackFacing('right');
      const side=sample('attack1',200);
      const grips = ['right', 'left', 'down-right', 'down-left'].flatMap(facing => {
        h.setAttackFacing(facing);
        // 공격 자세는 4방향으로 통일되어 대각선도 옆모습 자세를 쓴다. 주먹 덮개가 있는 예비·들어 올림 자세를 본다.
        const times = [50, 120];
        return times.map(time => {
          sample('attack1', time);
          const fist = h.supportHand, grip = h.weaponBack, cover = h.frame.gripCover;
          const pm = grip.getWorldTransformMatrix(), hm = fist.getWorldTransformMatrix();
          const center = hm.transformPoint(cover.w / 2, cover.h / 2);
          const a = pm.transformPoint(-grip.displayOriginX, 0), b = pm.transformPoint(-grip.displayOriginX + grip.width, 0);
          const span = Math.hypot(b.x - a.x, b.y - a.y), dx = (b.x - a.x) / span, dy = (b.y - a.y) / span;
          return { facing, time, visible: fist.visible && grip.visible, mirrored: fist.scaleX < 0,
            depth: h.list.indexOf(h.image) < h.list.indexOf(grip) && h.list.indexOf(grip) < h.list.indexOf(fist),
            throughFist: Math.abs((center.x - a.x) * dy - (center.y - a.y) * dx),
            alongGrip: ((center.x - a.x) * dx + (center.y - a.y) * dy) / span };
        });
      });
      h.setAttackFacing('down');
      return {id,end,start,thrust,side,grips};
    });
  })()`);
  for (const {id,end,start,thrust,side,grips} of results) {
    for (const pose of grips) {
      assert.ok(pose.visible && pose.depth, JSON.stringify(pose));
      assert.equal(pose.mirrored, pose.facing.endsWith('left'));
      const guardSideLimit = pose.facing.startsWith('down') ? .9 : .7;
      // 주먹 덮개는 몸의 불투명 픽셀로 잘라 내므로(build_attack_six.py) 덮개 상자의 가운데가 손잡이 선에서 조금 비켜날 수 있다.
      assert.ok(pose.throughFist < 3 && pose.alongGrip > .2 && pose.alongGrip < guardSideLimit, JSON.stringify(pose));
    }
    assert.equal(end.body,'attack2-front6-5');
    assert.equal(start.body,'attack3-front6-0');
    assert.equal(thrust.body,'attack3-front6-3');
    assert.deepEqual(end.blade,start.blade);
    for (const pose of [end,start,thrust]) {
      assert.equal(pose.front,`${id}-down`);
      assert.equal(pose.grip,`${id}-down-grip`);
      assert.ok(pose.visible && pose.depth, JSON.stringify(pose));
      assert.ok(Math.abs(pose.blade.tip.x-pose.blade.base.x)<.01 && pose.blade.tip.y>pose.blade.base.y);
    }
    assert.equal(side.front,`${id}-blade`);
    assert.equal(side.grip,`${id}-grip`);
  }
  for (const k of ['side','thrust']) {
    assert.ok(results[2][k].length < results[1][k].length);
    assert.ok(results[3][k].length > results[1][k].length);
  }
});

test('타격 뒤 잠깐 멈춰도 세계 시계와 예약 입력·회피는 동작한다', async () => {
  // 각 타의 잔심 멈춤 구간(config.ts의 followPauseAtMs·followPauseMs). 경계의 자세 전환을 피해 안쪽 5ms만 쓴다.
  const holds = PLAYER.combo.map((c, stage) => [stage, c.followPauseAtMs + 5, c.followPauseMs - 5]);
  await load('village');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),p=s.player,h=p.sprite,runs=[];
    s.enemies=[];let starts=0;const original=s.startAttack;
    s.startAttack=(...args)=>{starts++;return original.apply(s,args);};
    const tick=()=>s.update(0,5);
    const reset=(stage,time)=>{
      p.revive(1180,1220);s.now=time;s.clearAttackInput();s.joystick.vector.set(0,0);
      s.attackButton.isDown=false;s.comboStage=stage;s.comboExpiresAt=1e9;s.nextAttackAt=0;
      s.dodgeProgress=1;s.dodgeUntil=0;s.dodgeReadyAt=0;s.hitStopLeft=0;s.slowMotionLeft=0;
    };
    for(const [stage,holdAt,holdMs] of ${JSON.stringify(holds)}){
      reset(stage,1000+stage*2000);const began=s.now;s.startAttack(began,1);const ready=s.nextAttackAt;
      while(s.now<began+holdAt)tick();
      const before={x:p.x,y:p.y,frame:h.image.frame.name,rotation:h.weaponFront.rotation,clock:s.now,count:starts};
      s.joystick.vector.set(1,0);s.attackButton.pressed=true;tick();
      while(s.now<began+holdAt+holdMs-5)tick();
      const stopped=p.x===before.x&&p.y===before.y&&h.image.frame.name===before.frame&&Math.abs(h.weaponFront.rotation-before.rotation)<1e-8;
      const waited=starts===before.count,clockRan=s.now>before.clock;
      while(s.now<ready+5)tick();
      runs.push({stage,stopped,waited,clockRan,queuedOnce:starts===before.count+1});
    }
    reset(0,9000);s.startAttack(s.now,1);while(s.now<9300)tick();
    s.dodgeButton.pressed=true;tick();const dodge=!p.isAttacking&&p.dodging&&!h.isInFollowPause;
    s.startAttack=original;return {runs,dodge};
  })()`);
  for (const run of result.runs) {
    for (const [key,value] of Object.entries(run).filter(([key])=>key!=='stage')) {
      assert.equal(value,true,JSON.stringify({key,...run}));
    }
  }
  assert.equal(result.dodge,true);
});

test('막기는 콤보·후딜·회전 베기를 즉시 취소하고 남은 공격 판정과 전진을 없애며 재사용 대기는 유지한다', async () => {
  await load();
  const result = await evaluate(`(async () => {
    const { PLAYER, BLOCK, SPIN_SLASH } = await import('/src/config.ts');
    const s = window.__game.scene.getScene('game'), p = s.player, h = p.sprite, e = s.enemies[0];
    s.enemies = [e]; s.derived.evadeChance = 0;
    let ownHits = 0; e.character.hurt = () => { ownHits++; return false; };
    const reset = (stage) => {
      p.revive(1000,650);e.character.revive(1100,650);s.now=1000;
      s.clearAttackInput();s.attackButton.isDown=false;s.joystick.vector.set(0,0);
      s.dodgeProgress=1;s.dodgeUntil=0;s.dodgeReadyAt=0;
      s.parryUntil=0;s.parryReadyAt=0;s.blocking=false;s.spinHitAt=undefined;
      s.comboStage=stage;s.comboExpiresAt=1e9;s.nextAttackAt=0;
      s.hitStopLeft=0;s.slowMotionLeft=0;ownHits=0;
    };
    const runs = [];
    for (const stage of [0,1,2]) {
      const combo = PLAYER.combo[stage];
      for (const elapsed of [20,combo.hitDelayMs+5,combo.followPauseAtMs+10]) {
        reset(stage);s.startAttack(s.now,1);
        for(let t=0;t<elapsed;t+=10)h.advance(Math.min(10,elapsed-t));
        s.now+=elapsed;s.updateAttackLunge(s.now);
        // 다음 공격도 가능한 순간에 두 버튼을 동시에 누른다. 막기가 우선해야 한다.
        s.nextAttackAt=s.now;s.attackButton.isDown=true;s.attackButton.pressed=true;s.blockButton.pressed=true;
        s.updatePlayer(s.now,0);s.drawShield(s.now);
        const canceled=!p.isAttacking&&!h.isInFollowPause&&s.attackTrace===undefined&&s.attackLunge===undefined;
        const cleared=s.attackBufferedUntil===undefined&&s.comboStage===0&&s.comboExpiresAt===0;
        const immediate=s.blocking&&s.shield.visible&&s.parryReadyAt===s.now+BLOCK.cooldownMs;
        const x=p.x,y=p.y;s.now+=100;h.advance(50);
        s.updatePlayer(s.now,0);s.updateAttackLunge(s.now);s.updateAttackTrace(s.now);
        const heldSafe=s.blocking&&!p.isAttacking&&p.x===x&&p.y===y&&ownHits===0;
        e.character.placeAt(p.x+80*p.facing,p.y);e.character.face(-p.facing);p.invulnerableUntil=0;
        const hp=p.hp;s.onEnemyStrike(e);
        runs.push({stage,elapsed,canceled,cleared,immediate,heldSafe,protected:p.hp===hp&&s.counterUntil>s.now});
      }
    }
    reset(0);s.startAttack(s.now,1);const trace=s.attackTrace,lunge=s.attackLunge;
    s.parryReadyAt=s.now+500;s.blockButton.pressed=true;s.updatePlayer(s.now,0);
    const cooldownKept=p.isAttacking&&!s.blocking&&s.attackTrace===trace&&s.attackLunge===lunge;
    reset(0);s.mp=s.maxMp;s.nextSpinAt=0;s.startSpin(s.now);
    const paid=s.mp,spinReady=s.nextSpinAt;s.now+=20;s.blockButton.pressed=true;s.updatePlayer(s.now,0);
    const spinCanceled=!p.isAttacking&&s.spinHitAt===undefined&&s.blocking;
    s.now+=SPIN_SLASH.hitDelayMs;s.updateSkill(s.now,10);
    const noSpinHit=ownHits===0&&s.nextSpinAt===spinReady&&s.mp>=paid&&s.mp<s.maxMp;
    reset(0);s.mp=s.maxMp;s.nextSpinAt=0;s.skillSlots[0]='spin';s.refreshSkillButtons();s.blockButton.pressed=true;s.skillButtons[0].pressed=true;
    s.updatePlayer(s.now,0);s.updateSkill(s.now,0);
    const skillPriority=s.blocking&&!p.isAttacking&&s.spinHitAt===undefined&&s.mp===s.maxMp;
    s.attackButton.isDown=false;
    return {runs,cooldownKept,spinCanceled,noSpinHit,skillPriority};
  })()`);
  assert.equal(result.runs.length, 9);
  for (const run of result.runs) {
    for (const key of ['canceled','cleared','immediate','heldSafe','protected']) {
      assert.equal(run[key], true, JSON.stringify({ key, ...run }));
    }
  }
  for (const key of ['cooldownKept','spinCanceled','noSpinHit','skillPriority']) {
    assert.equal(result[key], true, JSON.stringify(result));
  }
});

test('검 막기 자세는 여섯 방향에서 장착 검을 들어 올리고 검날 접점에서 패링하며 종료·회피 시 복귀한다', async () => {
  await load();
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),p=s.player,h=p.sprite,e=s.enemies[0],runs=[];
    s.enemies=[];s.derived.evadeChance=0;
    // 패링 접점은 parryBurst(x, y, ...)가 그린다(2단 패링 도입 뒤 반격 impact 대신).
    const contacts=[],burst=s.impacts.parryBurst;
    s.impacts.parryBurst=(...args)=>{contacts.push({x:args[0],y:args[1]});return burst.apply(s.impacts,args);};
    for(const [facing,dx,dy] of [['right',1,0],['left',-1,0],['down-right',1,1],['down-left',-1,1],['up-right',1,-1],['up-left',-1,-1]]){
      p.revive(1000,650);s.now=1000;s.clearAttackInput();s.joystick.vector.set(0,0);
      s.dodgeProgress=1;s.dodgeUntil=0;s.dodgeReadyAt=0;s.parryUntil=0;s.parryReadyAt=0;
      s.spinHitAt=undefined;s.comboStage=0;s.comboExpiresAt=0;s.nextAttackAt=0;
      h.setWeapon('iron-sword');s.startAttack(s.now,dx,dy);s.blockButton.pressed=true;
      s.updatePlayer(s.now,0);s.drawShield(s.now);
      const name=h.image.frame.name,texture=h.image.texture.key,mirror=h.image.scaleX<0;
      const lengths=[];for(let i=0;i<5;i++){h.advance(20);s.now+=20;s.drawShield(s.now);const b=h.getBlade();lengths.push(Math.hypot(b.tip.x-b.base.x,b.tip.y-b.base.y));}
      const blade=h.getBlade(),raised=blade.tip.y<blade.base.y&&(blade.tip.x-blade.base.x)*dx>0;
      const tilt=Math.atan2(Math.abs(blade.tip.x-blade.base.x),Math.abs(blade.tip.y-blade.base.y))*180/Math.PI;
      const slanted=tilt>=48&&tilt<=53;
      const f=h.frame,m=h.image.getWorldTransformMatrix();
      const palm=m.transformPoint(f.supportGrip.x-f.originX*f.w,f.supportGrip.y-f.h);
      const vx=blade.tip.x-blade.base.x,vy=blade.tip.y-blade.base.y;
      const palmDistance=Math.abs((palm.x-blade.base.x)*vy-(palm.y-blade.base.y)*vx)/Math.hypot(vx,vy);
      // 8방향 막기: 뒤대각선(guard-up-back)은 칼·보조손이 몸 뒤에 숨고, 측면·앞대각선은 보조손이 칼날 앞에 겹친다.
      const rear=facing.startsWith('up');
      const palmVisible=rear?!h.supportHand.visible&&h.list.indexOf(h.weaponFront)<h.list.indexOf(h.image)
        :h.supportHand.visible&&h.list.indexOf(h.weaponFront)>h.list.indexOf(h.supportHand);
      const held=h.isGuarding&&s.shield.visible&&!p.isAttacking&&h.weaponFront.frame.name==='iron-sword-blade';
      h.setWeapon('wooden-sword');const wood=h.weaponFront.frame.name==='wooden-sword-blade';h.setWeapon('iron-sword');
      const dlen=Math.hypot(dx,dy)||1;
      e.character.revive(p.x+80*dx/dlen,p.y+40*dy/dlen);e.character.face(-dx);p.invulnerableUntil=0;const hp=p.hp;
      s.onEnemyStrike(e,{fromX:e.character.x,fromY:e.character.y,toX:p.x,toY:p.y,radiusX:80,radiusY:60,dx:-dx/dlen,dy:-dy/dlen,melee:true});
      const contact=contacts.at(-1),error=Math.hypot(contact.x-blade.base.x-(blade.tip.x-blade.base.x)*.55,contact.y-blade.base.y-(blade.tip.y-blade.base.y)*.55);
      // 정밀 패링 뒤 막기 자세는 반동(guardPoseUntil, 150ms)만큼 유지되고 그다음 돌아온다.
      s.now=Math.max(s.now,s.guardPoseUntil??0)+5;s.updatePlayer(s.now,0);s.drawShield(s.now);const restored=!h.isGuarding&&h.image.texture.key!=='hero-academy-guard';
      runs.push({facing,name,texture,mirror,raised,slanted,palmDistance,palmVisible,held,wood,lengths,error,restored,protected:p.hp===hp&&s.counterUntil>s.now});
    }
    const verticalPoses=[];
    for(const dy of [-1,1]){
      h.play('hero-idle');h.setMovement(0,dy);h.setGuarding(true);
      verticalPoses.push(h.image.frame.name===(dy<0?'guard-back':'guard-front')
        &&(dy<0?!h.supportHand.visible&&h.list.indexOf(h.weaponFront)<h.list.indexOf(h.image):h.supportHand.visible));
      h.setGuarding(false);
    }
    s.parryReadyAt=0;s.blockButton.pressed=true;s.updatePlayer(s.now,0);s.drawShield(s.now);
    h.setWeapon(undefined);s.drawShield(s.now);const empty=h.getBlade();
    const unequipped=!h.weaponFront.visible&&!h.weaponBack.visible&&!h.supportHand.visible&&Math.hypot(empty.tip.x-empty.base.x,empty.tip.y-empty.base.y)===0;
    s.dodgeButton.pressed=true;s.updatePlayer(s.now,0);s.drawShield(s.now);
    const dodged=p.dodging&&!h.isGuarding&&h.image.texture.key!=='hero-academy-guard';
    s.impacts.parryBurst=burst;return {runs,unequipped,dodged,verticalPoses};
  })()`);
  for (const run of result.runs) {
    assert.equal(run.texture, 'hero-academy-guard');
    assert.equal(run.name, run.facing.startsWith('up') ? 'guard-up-back' : run.facing.startsWith('down') ? 'guard-down' : 'guard-side');
    assert.equal(run.mirror, run.facing.includes('left'));
    for (const key of ['raised','slanted','palmVisible','held','wood','restored','protected']) assert.equal(run[key],true,JSON.stringify({key,...run}));
    assert.ok(run.error<.001,JSON.stringify(run));
    assert.ok(run.palmDistance<.75,JSON.stringify(run));
    assert.ok(run.lengths.every(n=>Math.abs(n-75)<.001),JSON.stringify(run));
  }
  assert.equal(result.unequipped,true);assert.equal(result.dodged,true);
  assert.ok(result.verticalPoses.every(Boolean),JSON.stringify(result));
});

test('공격 버튼 하나가 가까운 대상에 따라 대화·입장으로 바뀌고 상호작용 입력은 공격으로 새지 않는다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),p=s.player,b=s.attackButton;
    s.enemies=[];s.joystick.vector.set(0,0);
    const spot=s.interactables.find(i=>i.id==='npc-teon');
    p.placeAt(spot.x,spot.y+35);s.update(0,16);
    const near={label:b.text.text,icon:b.icon.texture.key,x:b.image.x,y:b.image.y};
    const pointer={id:22,x:b.image.x,y:b.image.y};
    s.input.emit('pointerdown',pointer);s.update(0,16);
    const opened=s.dialogue.isOpen&&!p.isAttacking&&s.attackBufferedUntil===undefined;
    s.input.emit('pointerup',pointer);s.dialogue.close();
    // 대화를 닫는 동안 누르고 있던 공격 키는 멀어져도 떼기 전까지 공격하지 않는다.
    s.attackKeys[0].isDown=true;
    p.placeAt(10,10);s.update(0,16);
    const far={label:b.text.text,icon:b.icon.texture.key,x:b.image.x,y:b.image.y,safe:!p.isAttacking};
    s.attackKeys[0].isDown=false;s.update(0,16);
    s.input.emit('pointerdown',pointer);s.update(0,16);
    const attacks=p.isAttacking;s.input.emit('pointerup',pointer);
    p.endAttack();s.attackTrace=undefined;s.attackLunge=undefined;s.clearAttackInput();
    const door=s.interactables.find(i=>i.id==='door-inn');
    p.placeAt(door.x,door.y+10);s.update(0,16);
    const enter={label:b.text.text,icon:b.icon.texture.key,x:b.image.x,y:b.image.y};
    s.enemies=[{state:'chase'}];s.updateInteraction(s.now);
    const combat=b.text.text==='공격'&&b.icon.texture.key==='action-icon-attack';s.enemies=[];
    return {near,far,enter,opened,attacks,combat,icons:[s.dodgeButton.icon.texture.key,s.blockButton.icon.texture.key]};
  })()`);
  assert.equal(result.near.label,'대화');assert.equal(result.near.icon,'action-icon-talk');
  assert.equal(result.enter.label,'들어가기');assert.equal(result.enter.icon,'action-icon-enter');
  assert.equal(result.far.label,'공격');assert.equal(result.far.icon,'action-icon-attack');
  assert.equal(result.near.x,result.far.x);assert.equal(result.near.y,result.enter.y);
  for(const key of ['opened','attacks','combat'])assert.equal(result[key],true,JSON.stringify(result));
  assert.equal(result.far.safe,true,JSON.stringify(result));
  assert.deepEqual(result.icons,['action-icon-dodge','action-icon-block']);
});

test('여덟 실내의 가구는 개별 객체이며 회피처럼 큰 이동으로도 가구·벽 위에 올라가지 않는다', async()=>{
  for(const id of ['home','linea','chief','clinic','hall','store','smithy','inn']){
    await load(`in-${id}`);
    const result=await evaluate(`(()=>{
      const s=window.__game.scene.getScene('game'),area=s.walkArea,room=s.map.bounds;
      const objects=s.children.list.filter(o=>o.name.startsWith('interior-furniture-'));
      let attempts=0,solid=true,stopped=true;
      for(const object of objects){
        const f=object.getData('footprint'),o=area.obstacles.find(o=>Math.abs(o.x-f.x)<.01&&Math.abs(o.y-f.y)<.01);
        solid&&=!!o&&!area.contains(f.x,f.y);
        if(!o)continue;
        for(const [x,y,dx,dy] of [[o.x,o.y+o.ry+2,0,-600],[o.x+o.rx+2,o.y,-600,0],[o.x-o.rx-2,o.y,600,0]]){
          if(!area.contains(x,y))continue;
          const end=area.move(x,y,dx,dy,s.joystick.vector.clone());
          stopped&&=area.contains(end.x,end.y)&&!((Math.abs(end.x-o.x)<o.rx)&&(Math.abs(end.y-o.y)<o.ry));
          // A large move must stop on the same side, rather than teleport across the footprint.
          if(dy<0)stopped&&=end.y>=o.y+o.ry-.01;
          if(dx<0)stopped&&=end.x>=o.x+o.rx-.01;
          if(dx>0)stopped&&=end.x<=o.x-o.rx+.01;
          attempts++;
        }
      }
      return {count:objects.length,expected:s.map.interior.furniture.length,solid,stopped,attempts,
        spawn:area.contains(s.player.x,s.player.y),wall:!area.contains((room.left+room.right)/2,room.top-30)};
    })()`);
    assert.equal(result.count,result.expected,id);
    for(const key of ['solid','stopped','spawn','wall'])assert.equal(result[key],true,JSON.stringify({id,key,...result}));
    assert.ok(result.attempts>=3,JSON.stringify({id,...result}));
  }
});

test('정면 막기에서 철검·나무검 손잡이 중심이 실제 오른손 주먹 안에 유지된다',async()=>{
  await load();
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game'),h=s.player.sprite,results=[];
    h.play('hero-idle');h.setMovement(0,1);
    for(const weapon of ['iron-sword','wooden-sword'])for(const time of [0,40,110,200]){
      h.setGuarding(false);h.setWeapon(weapon);h.setGuarding(true);h.guardTime=time;h.applyFrame();
      const f=h.frame,hand=f.gripHandCenter,body=h.image.getWorldTransformMatrix();
      const target=body.transformPoint(hand.x-f.originX*f.w,hand.y-f.h);
      const part=h.weaponBack,frame=part.frame;
      const actual=part.getWorldTransformMatrix().transformPoint(frame.width/2-part.displayOriginX,frame.height/2-part.displayOriginY);
      results.push({weapon,time,error:Math.hypot(actual.x-target.x,actual.y-target.y),frame:f.name});
    }
    h.setGuarding(false);return results;
  })()`);
  for(const r of result){assert.equal(r.frame,'guard-front');assert.ok(r.error<1.5,JSON.stringify(r));}
});

test('글자와 함께 그린 8방향 막기 검날은 실제 화면에서도 중간이 투명하게 잘리지 않는다', async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
  await load('village');
  const results = await evaluate(`(() => {
    const g=window.__game,s=g.scene.getScene('game'),camera=s.cameras.main;
    s.sys.sceneUpdate=()=>{};
    s.children.list.forEach(o=>o.setVisible(false));
    camera.setScroll(0,0).setZoom(1);
    const width=g.renderer.width,height=g.renderer.height;
    const directions=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
    const heroes=[];
    directions.forEach(([dx,dy],i)=>{
      const x=(i%4)*256,y=Math.floor(i/4)*325;
      // Separate text textures put weapons in different texture slots in the same GPU batch.
      s.add.text(x+35,y+30,'Direction '+i,{fontSize:'17px'}).setScrollFactor(0).setDepth(99999);
      s.add.text(x+30,y+70,'Idle          Guard',{fontSize:'14px'}).setScrollFactor(0).setDepth(99999);
      for(let j=0;j<2;j++){
        const h=new s.player.sprite.constructor(s);s.add.existing(h);
        h.setPosition(x+65+j*125,y+300).setScale(.55).setScrollFactor(0).setDepth(99999);
        h.setMovement(dx,dy);h.setWeapon('iron-sword');h.setGuarding(!!j);
        if(j)heroes.push(h);
      }
    });
    const results=[];
    for(const weapon of ['iron-sword','wooden-sword'])for(const time of [0,160]){
      for(const h of heroes){
        h.setWeapon(weapon);h.guardTime=time;h.applyFrame();
        // Keep body textures in the batch, but expose the full blade even in rear views.
        h.image.setAlpha(.001);h.supportHand.setAlpha(.001);h.weaponBack.setAlpha(.001);
      }
      g.step(performance.now(),16);
      const gl=g.renderer.gl,pixels=new Uint8Array(width*height*4);
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      heroes.forEach((h,direction)=>{
        const blade=h.getBlade(),missing=[];
        for(let sample=1;sample<=18;sample++){
          const t=sample/20,x=Math.round(blade.base.x+(blade.tip.x-blade.base.x)*t);
          const y=Math.round(blade.base.y+(blade.tip.y-blade.base.y)*t);
          let brightest=0;
          for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
            const offset=((height-1-y-oy)*width+x+ox)*4;
            brightest=Math.max(brightest,pixels[offset]+pixels[offset+1]+pixels[offset+2]);
          }
          if(brightest<100)missing.push(sample);
        }
        results.push({weapon,time,direction,missing});
      });
    }
    return results;
  })()`);
  await send('Emulation.clearDeviceMetricsOverride');
  for (const result of results) assert.deepEqual(result.missing, [], JSON.stringify(result));
});

test('수비대 부상은 보고 전 적용되고 경비병은 재접속 뒤에도 회복 중이며 치료 후 복귀한다', async () => {
  await load('village');
  await evaluate(`(() => {
    localStorage.removeItem('untitled-rpg.defender-injuries');
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({version:1,quests:{
      'festival-eve':{status:'done',count:0}, 'village-raid':{status:'active',step:0,count:0}
    }}));
  })()`);
  await load('village');
  const raid = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), teon=s.npcs.find(n=>n.def.id==='teon'), ruan=s.npcs.find(n=>n.def.id==='ruan');
    const guard=s.npcs.find(n=>n.def.id==='guard-plaza-west');
    guard.receiveCombatHit(1000,{x:guard.x,y:guard.y+100},99999);
    s.updateNpcCombat(1001,0);
    const saved=JSON.parse(localStorage.getItem('untitled-rpg.defender-injuries'));
    s.quests['village-raid'].step=1;s.refreshQuests();
    const teonBeforeTalk=teon.combatPose==='injured'&&!teon.canFight;
    teon.talkedTo(1100,s.player);s.updateNpcCombat(1101,0);
    s.quests['village-raid'].step=5;s.refreshQuests();
    const ruanBeforeReport=ruan.combatPose==='injured'&&!ruan.canFight;
    s.saveQuests();
    return {saved,teonBeforeTalk,teonAfterTalk:teon.combatPose,ruanBeforeReport};
  })()`);
  assert.ok(raid.saved.includes('guard-plaza-west'));
  assert.equal(raid.teonBeforeTalk,true);assert.equal(raid.teonAfterTalk,'injured');assert.equal(raid.ruanBeforeReport,true);
  await load('village');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.find(n=>n.def.id==='guard-plaza-west').combatPose`),'injured');
  await evaluate(`(() => { const s=window.__game.scene.getScene('game');s.quests['village-raid']={status:'done',count:0};s.saveQuests(); })()`);
  await load('village');
  const recovery=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), result=[];
    for(const id of ['ruan','teon','guard-plaza-west']) {
      const n=s.npcs.find(n=>n.def.id===id), x=n.x,y=n.y,frames=new Set();
      for(let i=0;i<50;i++){s.updateNpcCombat(2000+i*100,.1);n.update(2000+i*100,.1,s.player,s.walkArea);frames.add(n.figure.frame.name);}
      const stable=n.x===x&&n.y===y;
      s.openDialogue(n.spot);const portrait=s.dialogue.portrait.texture.key;
      while(s.dialogue.isOpen)s.dialogue.advance();
      n.update(9000,.1,s.player,s.walkArea);
      result.push({id,action:n.currentStoryAction,canFight:n.canFight,stable,frames:[...frames],portrait,afterTalk:n.figure.texture.key});
    }
    s.quests['first-sword']={status:'done',count:0};s.refreshQuests();s.saveQuests();
    return {result,healed:s.npcs.filter(n=>['teon','guard-plaza-west'].includes(n.def.id)).every(n=>!n.isRecovering&&!n.combatControlled)};
  })()`);
  assert.equal(recovery.healed,true);
  for(const n of recovery.result) {
    assert.equal(n.action,n.id==='teon'?'sentry':'rest');assert.equal(n.canFight,false);assert.equal(n.stable,true);
    assert.equal(n.frames.length,2);assert.equal(n.afterTalk,'npc-defender-recovery');
    assert.equal(n.portrait,n.id.startsWith('guard-')?'portrait-soldier':'portrait-'+n.id);
  }
  await load('village');
  assert.equal(await evaluate(`(() => { const s=window.__game.scene.getScene('game');return s.npcs.filter(n=>['teon','guard-plaza-west'].includes(n.def.id)).every(n=>!n.isRecovering&&!n.combatControlled);})()`),true);
  await evaluate(`localStorage.removeItem('untitled-rpg.defender-injuries')`);
});

test('건강한 병사는 목재 수리 동작 뒤 걸어서 다음 작업장으로 이동한다', async () => {
  await load('village');
  await evaluate(`localStorage.removeItem('untitled-rpg.defender-injuries');localStorage.setItem('untitled-rpg.quests',JSON.stringify({version:1,quests:{'village-raid':{status:'done',count:0},'first-sword':{status:'done',count:0}}}))`);
  await load('village');
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),n=s.npcs.find(n=>n.def.id==='guard-plaza-west');
    const frames=new Set(),start={x:n.x,y:n.y};let walked=false,returned=false,clear=true;
    for(let i=0;i<600;i++){
      n.update(i*50,.05,s.player,s.walkArea);
      clear &&= s.walkArea.contains(n.x,n.y);
      if(n.currentStoryAction==='repair')frames.add(n.figure.frame.name);
      if(n.figure.texture.key.includes('cardinal')||n.figure.texture.key.includes('diagonal'))walked=true;
      if(Math.hypot(n.x-start.x,n.y-start.y)>200&&n.currentStoryAction==='repair'){returned=true;break;}
    }
    return {frames:[...frames],walked,returned,clear};
  })()`);
  assert.equal(result.frames.length,2);assert.equal(result.walked,true);assert.equal(result.returned,true);assert.equal(result.clear,true);
});

test('마을 수비대는 습격 중 실제 공격·막기·피격·부상 그림을 쓰고 평소에는 순찰로 돌아온다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    const savedQuests=localStorage.getItem('untitled-rpg.quests');
    s.quests={'festival-eve':{status:'done',count:0},'village-raid':{status:'active',step:0,count:0}};
    s.syncRaidEnemies(false);
    const enemy=s.enemies[0];
    for(const e of s.enemies.slice(1))e.kill();
    let x=0,y=0;
    search:for(let yy=700;yy<2200;yy+=100)for(let xx=700;xx<2500;xx+=100){
      if(s.walkArea.contains(xx,yy)&&s.walkArea.contains(xx+90,yy)&&s.walkArea.hasClearPath(xx,yy,xx+90,yy)){x=xx;y=yy;break search;}
    }
    if(!x)throw Error('No test battle ground');
    s.player.placeAt(x-800,y-800);
    const runs=[];
    for(const [index,skin] of ['ruan','teon','soldier'].entries()){
      for(const n of s.npcs){n.setBattle(false);n.placeAt(x-700,y-700);}
      const npc=s.npcs.find(n=>n.skin===skin);npc.placeAt(x,y);
      enemy.respawn(x+80,y);enemy.character.face(-1);enemy.state='chase';
      s.now=1000+index*10000;
      const hp=enemy.character.hp;
      s.updateNpcCombat(s.now,0);
      const attack=npc.figure.texture.key==='npc-'+skin+'-combat'&&npc.figure.frame.name==='attack';
      const selected=s.defenderTarget(enemy)===npc;
      s.now+=210;s.updateNpcCombat(s.now,0);
      const damage=hp-enemy.character.hp;
      s.now+=10;s.updateNpcCombat(s.now,0);
      const once=hp-enemy.character.hp===damage;
      npc.setBattle(false);npc.setBattle(true);enemy.state='windup';
      s.now+=2000;s.updateNpcCombat(s.now,0);
      const before=npc.fighter.hp;
      const blocked=s.onEnemyStrike(enemy)&&npc.fighter.hp===before&&npc.combatPose==='guard';
      s.now+=800;s.updateNpcCombat(s.now,0);
      const hit=s.onEnemyStrike(enemy)&&npc.fighter.hp<before&&npc.figure.frame.name==='hit';
      npc.receiveCombatHit(s.now+800,enemy.character,9999);
      npc.update(s.now+900,.1,s.player,s.walkArea);
      const injuryFrame=skin==='soldier'
        ? npc.figure.texture.key==='npc-soldier-fallen' && npc.figure.frame.name.startsWith('fallen-')
        : npc.figure.frame.name==='injured';
      const injured=injuryFrame&&!npc.canFight;
      runs.push({skin,attack,selected,damage,once,blocked,hit,injured});
    }
    // 아군 마무리도 같은 습격 처치 이벤트를 사용한다.
    for(const n of s.npcs){n.setBattle(false);n.placeAt(x-700,y-700);}
    const ruan=s.npcs.find(n=>n.def.id==='ruan');ruan.placeAt(x,y);
    enemy.respawn(x+80,y);enemy.character.hp=1;enemy.state='chase';
    s.now+=4000;s.updateNpcCombat(s.now,0);s.now+=210;s.updateNpcCombat(s.now,0);
    const credited=enemy.state==='dead'&&s.quests['village-raid'].count===1;
    s.quests={};s.updateNpcCombat(s.now,0);
    for(const n of s.npcs)n.update(s.now,0,s.player,s.walkArea);
    const peace=s.npcs.filter(n=>['ruan','teon','soldier'].includes(n.skin)).every(n=>!n.combatControlled&&!n.figure.texture.key.endsWith('-combat'));
    s.quests={'village-raid':{status:'done',count:0}};s.updateNpcCombat(s.now,0);
    const aftermath=ruan.figure.frame.name.startsWith('ruan-rest-')&&!ruan.canFight;
    if(savedQuests===null)localStorage.removeItem('untitled-rpg.quests');else localStorage.setItem('untitled-rpg.quests',savedQuests);
    return {runs,credited,peace,aftermath};
  })()`);
  for (const run of result.runs) {
    for (const key of ['attack','selected','once','blocked','hit','injured']) assert.equal(run[key],true,JSON.stringify(run));
    assert.ok(run.damage>0,JSON.stringify(run));
  }
  for (const key of ['credited','peace','aftermath']) assert.equal(result[key],true,JSON.stringify(result));
});

test('습격의 적 AI는 가까운 경비병을 추격하고 실시간 교전으로 서로 피해를 준다', async () => {
  await load('village');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    const savedQuests=localStorage.getItem('untitled-rpg.quests');
    s.quests={'festival-eve':{status:'done',count:0},'village-raid':{status:'active',step:0,count:0}};
    s.syncRaidEnemies(false);
    const enemy=s.enemies[0];for(const e of s.enemies.slice(1))e.kill();
    let x=0,y=0;
    search:for(let yy=700;yy<2200;yy+=100)for(let xx=700;xx<2500;xx+=100){
      if(s.walkArea.contains(xx,yy)&&s.walkArea.contains(xx+250,yy)&&s.walkArea.hasClearPath(xx,yy,xx+250,yy)){x=xx;y=yy;break search;}
    }
    if(!x)throw Error('No test battle ground');
    for(const n of s.npcs)n.placeAt(x-800,y-800);
    const npc=s.npcs.find(n=>n.skin==='soldier');npc.placeAt(x,y);
    s.player.placeAt(x-1000,y-1000);
    enemy.respawn(x+210,y);enemy.character.setAlpha(1);
    const initial=enemy.character.hp,poses=new Set();let onGround=true;
    for(let i=0;i<1200&&enemy.character.alive;i++){
      s.now+=20;s.updateNpcCombat(s.now,.02);
      const defender=s.defenderTarget(enemy);
      enemy.update(s.now,.02,s.player,s.walkArea,s.nav,s.onEnemyStrike,undefined,
        defender?{x:defender.x,y:defender.y,alive:defender.canFight}:undefined);
      npc.update(s.now,.02,s.player,s.walkArea);
      poses.add(npc.combatPose);onGround&&=s.walkArea.contains(npc.x,npc.y);
      if(npc.combatPose==='injured')break;
    }
    if(savedQuests===null)localStorage.removeItem('untitled-rpg.quests');else localStorage.setItem('untitled-rpg.quests',savedQuests);
    return {poses:[...poses],enemyHurt:enemy.character.hp<initial,npcHurt:npc.fighter.hp<75,onGround};
  })()`);
  for (const key of ['enemyHurt','npcHurt','onGround']) assert.equal(result[key],true,JSON.stringify(result));
  for (const pose of ['attack','guard','hit']) assert.ok(result.poses.includes(pose),JSON.stringify(result));
});

test('퀘스트로 배운 기술은 빈 첫 칸에 들어가 쓸 수 있고, 맵을 다시 열어도 남는다', async () => {
  await load('south-field');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    localStorage.removeItem('untitled-rpg.skills');
    const before = s.skillSlots.slice();
    s.learnSkill('spin'); s.learnSkill('spin');
    const learned = { slots: s.skillSlots.slice(), label: s.skillButtons[0].text.text, saved: JSON.parse(localStorage.getItem('untitled-rpg.skills')) };
    s.scene.restart(); g.step(performance.now(), 16); g.step(performance.now() + 16, 16);
    const r = g.scene.getScene('game');
    const restarted = { slots: r.skillSlots.slice(), label: r.skillButtons[0].text.text };
    r.mp = r.maxMp; r.nextSpinAt = 0; r.skillButtons[0].pressed = true; r.update(r.now, 16);
    const cast = r.spinHitAt !== undefined;
    localStorage.removeItem('untitled-rpg.skills');
    return { before, learned, restarted, cast };
  })()`);
  assert.deepEqual(result.before, [null, null, null, null, null]);
  assert.deepEqual(result.learned.slots, ['spin', null, null, null, null], '두 번 배워도 한 칸');
  assert.equal(result.learned.label, '회전베기');
  assert.deepEqual(result.learned.saved, { version: 1, learned: ['spin'], slots: ['spin', null, null, null, null] });
  assert.deepEqual(result.restarted, { slots: ['spin', null, null, null, null], label: '회전베기' });
  assert.equal(result.cast, true, '배운 칸을 누르면 회전 베기가 나간다');
});

test('페른의 수레는 여행 물품만 팔고, 푸른 이슬은 마나를, 해독 약초는 느려짐을 푼다', async () => {
  await load('south-field');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    s.inventory = { gold: 500, items: {} };
    s.openItemPanel('shop', 'fern');
    const m = s.itemPanel;
    const shown = m.rows.filter(r => r.name.visible).map(r => r.name.text);
    const title = m.title.text;
    const paged = m.nextButton.visible;
    m.nextButton.emit('pointerup');
    const second = m.rows.filter(r => r.name.visible).map(r => r.name.text);
    m.prevButton.emit('pointerup');
    s.onItemAction({ type: 'buy', id: 'blue-dew' }); s.onItemAction({ type: 'buy', id: 'antidote-herb' }); s.onItemAction({ type: 'buy', id: 'lunch' });
    const bought = { ...s.inventory.items }, gold = s.inventory.gold;
    m.close();
    s.nextUseAt = 0; s.mp = 0; s.drawMp();
    const usedDew = s.useHealItem('blue-dew'), mpAfter = s.mp, maxMp = s.maxMp;
    s.nextUseAt = 0; s.slowedUntil = s.now + 5000;
    const usedHerb = s.useHealItem('antidote-herb'), slowedAfter = s.now < s.slowedUntil;
    s.nextUseAt = 0;
    const unused = s.useHealItem('antidote-herb');
    // 빠른 칸 선택 창: 소모품 다섯이 한 줄로 겹치지 않게 늘어선다
    s.openQuickSlot(0);
    const tiles = s.quickSlotPanel.rows.map(r => ({ id: r.id, b: r.button.getBounds() }));
    s.quickSlotPanel.close();
    const overlap = tiles.some((a, i) => tiles.some((b, j) => i < j && a.b.right > b.b.left && b.b.right > a.b.left));
    return { title, shown, paged, second, bought, gold, usedDew, mpAfter, maxMp, usedHerb, slowedAfter, unused, tileIds: tiles.map(t => t.id), overlap,
      inside: tiles.every(t => t.b.left >= 0 && t.b.right <= s.scale.gameSize.width) };
  })()`);
  assert.equal(result.title, '페른의 수레');
  assert.deepEqual(result.shown, ['회복 물약', '여행용 건빵', '푸른 이슬']);
  assert.equal(result.paged, true, '네 가지라 두 쪽으로 넘긴다');
  assert.deepEqual(result.second, ['해독 약초']);
  assert.deepEqual(result.bought, { 'blue-dew': 1, 'antidote-herb': 1 }, '도시락은 페른에게 살 수 없다');
  assert.equal(result.gold, 455);
  assert.equal(result.usedDew, true);
  assert.equal(result.mpAfter, Math.min(40, result.maxMp), '마나 40, 최대 마나를 넘지 않는다');
  assert.equal(result.usedHerb, true);
  assert.equal(result.slowedAfter, false);
  assert.equal(result.unused, false, '느려지지 않았으면 해독 약초를 쓰지 않는다');
  // 빠른 칸 창은 소모품 전부를 아이템 목록 순서로 늘어놓는다(새 소모품이 생기면 함께 늘어난다).
  assert.deepEqual(result.tileIds, ITEM_IDS.filter(id => ITEMS[id].kind === 'consumable'));
  assert.equal(result.overlap, false);
  assert.equal(result.inside, true);
});

test('2장 남문의 수레: 광장에 페른과 삭은 수레가 서고, 들판의 나방 넷을 쫓으면 페른의 수레가 열린다', async () => {
  await load('village');
  const result = await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts');
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const seed = {};
    const mains = QUESTS.filter(q => q.main);
    for (const q of mains.slice(0, mains.findIndex(q => q.id === 'first-sword') + 1)) seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 200, items: {} }));
    const restart = async map => {
      s.scene.restart({ map }); g.step(t += 16, 16);
      for (let i = 0; i < 300; i++) {
        s = g.scene.getScene('game');
        if (s.mapId === map && s.sys.isActive() && s.minimap && !s.traveling) return;
        await new Promise(resolve => setTimeout(resolve, 10)); g.step(t += 16, 16);
      }
      throw Error('맵 재시작 시간 초과: ' + map);
    };
    const flush = () => { while (s.dialogue.isOpen) s.dialogue.advance(); };
    await restart('village');
    const fern = s.npcs.find(n => n.def.id === 'fern');
    const cart = s.children.list.find(o => o.texture?.key === 'fern-cart-damaged');
    const quest = s.quests['fern-cart']?.status;
    const marker = s.npcs.find(n => n.def.id === 'fern')?.questMarker?.text ?? null;
    const blocked = !s.walkArea.contains(cart.x, cart.y - 30);
    s.openDialogue(fern.spot); const firstSpeaker = s.dialogue.lines?.[0]?.speaker ?? null; flush();
    const afterTalk = s.quests['fern-cart'];
    await restart('south-field');
    const moths = s.enemies.filter(e => e.kind === 'ashen-moth');
    const hint = s.hud.hint?.text ?? s.children.list.find(o => o.text?.includes?.('잿빛 나방'))?.text ?? '';
    // 나방 넷을 쓰러뜨린 것으로 친다(전투 자체는 다른 테스트가 본다).
    for (const m of moths) s.questEvent({ type: 'kill', map: 'south-field', monster: 'ashen-moth' });
    const afterHunt = s.quests['fern-cart'];
    await restart('village');
    const fern2 = s.npcs.find(n => n.def.id === 'fern');
    s.openDialogue(fern2.spot); flush();
    // 페른의 수레는 여행 물품과 여행 장비 가운데 고른다
    const goods = () => { if (s.storyChoice.isOpen) s.storyChoice.choose(0); };
    goods();
    const shop = { open: s.itemPanel.isOpen, title: s.itemPanel.title.text };
    s.itemPanel.close();
    const done = s.quests['fern-cart']?.status, herbs = s.inventory.items['antidote-herb'] ?? 0;
    // 남문의 수레 뒤 첫 대화는 서브 퀘스트 "행상인의 짐" 제안, 그다음 평소 대화 뒤에 수레가 열린다
    s.openDialogue(fern2.spot); flush();
    const cover = s.quests['fern-cover']?.status;
    if (s.storyChoice.isOpen) s.storyChoice.cancel();
    if (s.itemPanel.isOpen) s.itemPanel.close();
    s.openDialogue(fern2.spot); flush(); goods();
    const again = cover === 'active' && s.itemPanel.isOpen; s.itemPanel.close();
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.inventory');
    return { hint, hasFern: !!fern, fernName: fern?.def.name, cart: !!cart, blocked, quest, firstSpeaker, afterTalk, moths: moths.length, afterHunt, shop, done, herbs, again };
  })()`);
  assert.equal(result.hasFern, true);
  assert.equal(result.fernName, '페른');
  assert.equal(result.cart, true, '삭은 수레 그림');
  assert.equal(result.blocked, true, '수레 바퀴 자리는 지나갈 수 없다');
  assert.equal(result.quest, 'active', '도란의 검 다음에 이어진다');
  assert.equal(result.afterTalk.step, 1, '이야기를 들으면 나방 쫓기');
  assert.equal(result.moths, 4);
  assert.match(result.hint, /남은 잿빛 나방/);
  assert.equal(result.afterHunt.step, 2);
  assert.deepEqual(result.shop, { open: true, title: '페른의 수레' });
  assert.equal(result.done, 'done');
  assert.equal(result.herbs, 2, '보상 해독 약초 둘');
  assert.equal(result.again, true, '그 뒤 평소 대화 뒤에도 수레가 열린다');
});

test('2장 떠날 채비: 루안에게 말하면 회전 베기가 기술 칸에 들어오고, 북쪽 사람들에게 인사하면 헤르만이 여비를 준다', async () => {
  await load('village');
  const result = await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts');
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const seed = {};
    const mains = QUESTS.filter(q => q.main);
    for (const q of mains.slice(0, mains.findIndex(q => q.id === 'fern-cart') + 1)) seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 0, items: {} }));
    localStorage.removeItem('untitled-rpg.skills');
    const restart = async map => {
      s.scene.restart({ map }); g.step(t += 16, 16);
      for (let i = 0; i < 300; i++) {
        s = g.scene.getScene('game');
        if (s.mapId === map && s.sys.isActive() && s.minimap && !s.traveling) return;
        await new Promise(resolve => setTimeout(resolve, 10)); g.step(t += 16, 16);
      }
      throw Error('맵 재시작 시간 초과: ' + map);
    };
    const flush = () => { while (s.dialogue.isOpen) s.dialogue.advance(); };
    const talk = id => { const n = s.npcs.find(n => n.def.id === id); s.openDialogue(n.spot); flush(); };
    await restart('village');
    const started = s.quests.farewell?.status;
    const ruanMarker = s.npcs.find(n => n.def.id === 'ruan').questMarker?.text ?? null;
    talk('ruan');
    const skill = { slots: s.skillSlots.slice(), label: s.skillButtons[0].text.text };
    await restart('village-north');
    await restart('in-linea');
    for (const id of ['serena', 'linea', 'eila']) talk(id);
    await restart('village-north'); talk('herman');
    const done = s.quests.farewell?.status, gold = s.inventory.gold;
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.inventory'); localStorage.removeItem('untitled-rpg.skills');
    return { started, skill, done, gold };
  })()`);
  assert.equal(result.started, 'active');
  assert.deepEqual(result.skill, { slots: ['spin', null, null, null, null], label: '회전베기' });
  assert.equal(result.done, 'done');
  assert.ok(result.gold >= 100, '여비 100 G');
});

test('서리 딱정벌레는 그림과 전투가 연결되고, 정면의 칼은 껍질에 막히고 등 뒤에서는 베인다', async () => {
  await load('south-field&monsters=frost-beetle');
  const result = await evaluate(`(() => {
    const g = window.__game, s = g.scene.getScene('game');
    const beetles = s.enemies.filter(e => e.kind === 'frost-beetle');
    const b = beetles[0], c = b.character;
    for (const other of s.enemies) if (other !== b) { other.character.alive = false; other.character.setVisible(false); }
    const facing = c.sprite.facingVector();
    const p = s.player;
    // 정면: 딱정벌레가 바라보는 쪽에 선다
    p.placeAt(c.x + facing.x * 90, c.y + facing.y * 50);
    const hp0 = c.hp;
    const front = s.shellBlocked(b, false, c.x, c.y - 40);
    // 반격은 뚫는다
    const counter = s.shellBlocked(b, true, c.x, c.y - 40);
    // 등 뒤
    p.placeAt(c.x - facing.x * 90, c.y - facing.y * 50);
    const back = s.shellBlocked(b, false, c.x, c.y - 40);
    // 몸은 한 번에 한 칸씩 천천히 돈다
    const sprite = c.sprite, before = sprite.facingVector();
    sprite.setMovement(-before.x, -before.y);
    const step1 = sprite.facingVector();
    sprite.setMovement(-before.x, -before.y);
    const step2 = sprite.facingVector();
    return { count: beetles.length, name: b.stats.name, texture: c.sprite.list[0].texture.key, front, counter, back, hp: c.hp === hp0,
      turnedOneStep: Math.abs(step1.x * before.x + step1.y * before.y - 0.707) < 0.01, waited: step2.x === step1.x && step2.y === step1.y };
  })()`);
  assert.equal(result.count, 3);
  assert.equal(result.name, '서리 딱정벌레');
  assert.match(result.texture, /^monster-frost-beetle-/);
  assert.equal(result.front, true, '정면은 막힌다');
  assert.equal(result.counter, false, '반격은 뚫는다');
  assert.equal(result.back, false, '등 뒤는 베인다');
  assert.equal(result.turnedOneStep, true, '반대쪽을 봐도 한 칸만 돈다');
  assert.equal(result.waited, true, '다음 칸은 조금 기다렸다 돈다');
});

test('안개 까마귀는 고갯길에서 무리로 날고 덮치며, 피격 잔상과 안전한 이동·재사용 대기·사망 정리를 처리한다', async () => {
  await load('east-pass&companion=none');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), flock=s.enemies.filter(e=>e.kind==='fog-crow');
    const e=flock[0], c=e.character, p=s.player, sprite=c.sprite;
    for(const other of s.enemies) if(other!==e) other.kill();
    c.placeAt(2900,1620); p.placeAt(3040,1620);
    const poses=new Set();
    for(let i=0;i<4;i++){sprite.advance(100);poses.add(sprite.list[0].frame.name);}
    const flight={count:flock.length, poses:poses.size, height:sprite.list[0].y, texture:sprite.list[0].texture.key};
    let t=s.now+1000, strikes=0;
    const strike=()=>{strikes++;return true;};
    e.state='chase'; e.update(t,0,p,s.walkArea,s.nav,strike);
    const windup=e.state==='windup';
    e.update(t+e.stats.windupMs+e.stats.strikeMs,0,p,s.walkArea,s.nav,strike);
    const swooped=c.x>3000 && sprite.list[0].frame.name.startsWith('attack-right-');
    s.now=t+1000; const old={x:c.x,y:c.y}, hp=c.hp;
    c.hurt(1);s.resolveEnemyHit(e,false,1,0,100);
    const moved=Math.hypot(c.x-old.x,c.y-old.y)>100, safe=s.walkArea.contains(c.x,c.y), decoy=e.decoy?.image;
    const at={x:c.x,y:c.y};
    c.hurt(1);s.resolveEnemyHit(e,false,1,0,100);
    const cooldown=c.x===at.x&&c.y===at.y, single=e.decoy?.image===decoy;
    e.updateDecoy(s.now+700);
    const expired=!e.decoy&&!decoy.active;
    s.now+=2500;c.hurt(1);s.resolveEnemyHit(e,false,1,0,100);
    const next=e.decoy?.image;
    const died=c.hurt(c.hp);s.resolveEnemyHit(e,died,1,0,0);
    return {flight,windup,strikes,swooped,moved,safe,cooldown,single,expired,damage:hp-c.hp>0,
      killed:e.state==='dead'&&!e.decoy&&(!next||!next.active)};
  })()`);
  assert.equal(result.flight.count,6);
  assert.equal(result.flight.poses,4,'hovering still flaps');
  assert.ok(result.flight.height<0);
  assert.match(result.flight.texture,/^monster-fog-crow-/);
  for(const key of ['windup','swooped','moved','safe','cooldown','single','expired','damage','killed']) assert.equal(result[key],true,key);
  assert.equal(result.strikes,1,'one swept strike');
});

test('동쪽 고갯길은 개울가에서 왕복하며 큰 카메라·지도·개별 소품·쉼터 가림·불을 연결한다', async () => {
  // 1장을 끝내기 전(도란의 검 전)에는 개울가에서 고갯길로 넘어가지 못한다. 1장을 끝낸 저장으로 시작한다.
  await load('east-stream&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'first-sword') break;
    }
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
  })()`);
  await load('east-stream&companion=none');
  await evaluate(`(() => {const s=window.__game.scene.getScene('game');s.player.placeAt(3280,1400);window.__passTime=performance.now();})()`);
  await until(()=>evaluate(`(() => {const g=window.__game;g.step(window.__passTime+=16,16);const s=g.scene.getScene('game');return s.mapId==='east-pass'&&s.sys.isActive()&&!!s.passScenery&&s.minimap&&!s.traveling;})()`));
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    const props=s.map.props.filter(p=>p.texture);
    const painted=props.every(p=>s.children.list.some(o=>o.name==='village-prop-'+p.frame&&o.texture?.key===p.texture));
    const shelter=s.children.getByName('village-prop-stone-shelter');
    s.passScenery.update(s.now,{x:1800,y:1380});const faded=shelter.alpha<1;
    s.passScenery.update(s.now,{x:1800,y:1500});const restored=shelter.alpha===1;
    const fire=s.children.getByName('pass-fire'), before=fire.frame.name;s.passScenery.update(s.now+110,s.player);
    return {painted,faded,restored,fire:fire.frame.name!==before,camera:s.cameras.main.getBounds().width,
      map:s.minimap.preview.bounds.right,dor:s.npcs.some(n=>n.def.id==='dor'),
      tiles:s.children.list.filter(o=>o.name==='map-art-background').map(o=>[o.x,o.y,o.width,o.height,o.displayWidth,o.displayHeight])};
  })()`);
  const tiles = [0, 1600].flatMap(y => [0, 1600, 3200].map(x => [x, y, 1600, 1600, 1600, 1600]));
  assert.deepEqual(result,{painted:true,faded:true,restored:true,fire:true,camera:4800,map:4800,dor:true,tiles});
  await evaluate(`window.__game.scene.getScene('game').player.placeAt(120,2150)`);
  await until(()=>evaluate(`(() => {const g=window.__game;g.step(window.__passTime+=16,16);const s=g.scene.getScene('game');return s.mapId==='east-stream'&&s.sys.isActive()&&!s.passScenery&&s.minimap&&!s.traveling;})()`));
  assert.equal(await evaluate(`window.__game.scene.getScene('game').walkArea.contains(3040,1420)`),true);
  await evaluate(`localStorage.removeItem('untitled-rpg.quests')`);
});

test('물안개 나루는 바닥을 1:1로 표시하고 고갯길에서 왕복하며 두 선착장만 강 위로 걸을 수 있다', async () => {
  await load('east-pass&companion=none');
  await evaluate(`(() => { const s = window.__game.scene.getScene('game');
    s.player.placeAt(4680, 1960); window.__ferryTime = performance.now(); })()`);
  const reached = map => until(() => evaluate(`(() => {
    const g = window.__game; g.step(window.__ferryTime += 16, 16);
    const s = g.scene.getScene('game');
    return s.mapId === ${JSON.stringify(map)} && s.sys.isActive() && !!s.minimap && !s.traveling;
  })()`));
  await reached('ferry-village');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), a = s.walkArea;
    return { tiles: s.children.list.filter(c => c.name === 'map-art-background')
      .map(c => [c.x, c.y, c.width, c.height, c.displayWidth, c.displayHeight]),
      bounds: [s.minimap.preview.bounds.right, s.minimap.preview.bounds.bottom],
      camera: [s.cameras.main.getBounds().width, s.cameras.main.getBounds().height],
      decks: [1046.875, 2125].map(y => a.hasClearPath(2937.5, y, 3656.25, y)),
      water: [[3750, 1046.875], [3750, 2125], [3484.375, 1562.5], [3437.5, 921.875]].map(([x,y]) => a.contains(x, y)),
      spawn: [s.player.x, s.player.y] };
  })()`);
  const tiles = [0, 1600].flatMap(y => [0, 1600, 3200].map(x => [x, y, 1600, 1600, 1600, 1600]));
  assert.deepEqual(result, { tiles, bounds: [4800, 3200], camera: [4800, 3200],
    decks: [true, true], water: [false, false, false, false], spawn: [593.75, 1609.375] });
  await evaluate(`window.__game.scene.getScene('game').player.placeAt(181.25, 1609.375)`);
  await reached('east-pass');
});

test('멈춘 나루: 나루 사람들이 제 그림으로 서고(여관 주인과 핀은 여관 안), 에반에게 말을 걸면 다음 단계로, 여관 주인에게는 쉬어 갈 수 있다', async () => {
  await load('east-pass&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'pass-shelter') break;
    }
    seed['still-ferry'] = { status: 'active', count: 0 };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.removeItem('untitled-rpg.rest');
  })()`);
  await load('ferry-village&companion=none');
  const outside = await evaluate(`window.__game.scene.getScene('game').npcs.map(n => ({ id: n.def.id, texture: n.figure.texture.key }))`);
  const evanResult = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const n = s.npcs.find(n => n.def.id === 'evan'), evanMarker = n.questMarker;
    s.player.placeAt(n.spot.x, n.spot.y + 10); s.attackButton.pressed = true; s.updateInteraction(s.now);
    const lines = [...s.dialogue.lines];
    while (s.dialogue.isOpen) s.dialogue.advance();
    return { evanMarker, evanSpeaks: lines.some(l => l.portrait === 'evan'), step: s.quests['still-ferry'].step, fog: s.children.list.filter(o => o.name === 'ferry-river-fog').length };
  })()`);
  // 여관 주인과 핀은 여관 안에 있다
  await load('in-ferry-inn&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const people = s.npcs.map(n => ({ id: n.def.id, texture: n.figure.texture.key }));
    const talk = id => {
      const n = s.npcs.find(n => n.def.id === id);
      s.player.placeAt(n.spot.x, n.spot.y + 10); s.attackButton.pressed = true; s.updateInteraction(s.now);
      if (s.storyChoice.isOpen && !s.dialogue.isOpen) s.storyChoice.choose(0);
      const lines = [...s.dialogue.lines];
      while (s.dialogue.isOpen) s.dialogue.advance();
      return lines;
    };
    const innLines = talk('fog-innkeeper');
    const afterInn = s.quests['still-ferry'].step;
    // 진행이 아닌 안내 대화 뒤에는 쉬어 갈지 묻는다
    talk('fog-innkeeper');
    const restOffered = s.storyChoice.isOpen;
    if (restOffered) s.storyChoice.accept();
    return { people, innSpeaks: innLines.some(l => l.portrait === 'fog-innkeeper'),
      afterInn, restOffered, rest: localStorage.getItem('untitled-rpg.rest') };
  })()`);
  assert.deepEqual(outside.map(p => p.id).sort(), ['evan', 'ferry-fisher', 'morgan']);
  assert.deepEqual(result.people.map(p => p.id).sort(), ['finn', 'fog-innkeeper', 'innkeeper-wife']);
  for (const p of [...outside, ...result.people]) assert.notEqual(p.texture, '__MISSING', p.id);
  assert.equal(evanResult.evanMarker, 'target');
  assert.equal(evanResult.evanSpeaks, true); assert.equal(evanResult.step, 1);
  assert.equal(result.innSpeaks, true); assert.equal(result.afterInn, 2);
  assert.equal(result.restOffered, true);
  assert.equal(JSON.parse(result.rest).point, 'ferry-inn');
  assert.ok(evanResult.fog >= 10, '강 위 안개');
});

test('밤의 종소리: 여관에서 방을 얻으면 밤 연출 → 잠든 여관 주인과 안개 환영 → 물가에서 깨우기 → 핀을 달래면 여관에서 아침', { timeout: 120000 }, async () => {
  await load('east-pass&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'still-ferry') break;
    }
    seed['night-bell'] = { status: 'active', count: 0 };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.removeItem('untitled-rpg.rest');
  })()`);
  await load('in-ferry-inn&companion=none');
  const result = await evaluate(`(async () => {
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const step = (n = 1) => { for (let i = 0; i < n; i++) g.step(t += 16, 16); s = g.scene.getScene('game'); };
    const ready = async map => {
      for (let i = 0; i < 400; i++) {
        step();
        if (s.mapId === map && s.sys.isActive() && s.minimap && !s.traveling && !s.opening) return;
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      throw Error('준비 시간 초과: ' + map);
    };
    const flush = () => { while (s.dialogue.isOpen) s.dialogue.advance(); };
    const npc = id => s.npcs.find(n => n.def.id === id);
    const day = { people: s.npcs.map(n => n.def.id).sort(), marker: npc('fog-innkeeper').questMarker,
      spot: s.walkArea.contains(npc('fog-innkeeper').spot.x, npc('fog-innkeeper').spot.y) };
    s.openDialogue(npc('fog-innkeeper').spot); flush();
    for (let i = 0; i < 200 && !s.opening; i++) { step(); await new Promise(r => setTimeout(r, 4)); }
    const inn = { opening: !!s.opening, shade: !!s.chapterShade, stage: !!s.nightBellStage, finn: npc('finn').figure.frame.name,
      step: s.quests['night-bell'].step, rest: localStorage.getItem('untitled-rpg.rest') };
    s.opening.skip(); await ready('ferry-village');
    const sleeper = npc('fog-innkeeper');
    const chase = { shade: !!s.chapterShade, phantoms: s.enemies.filter(e => e.kind === 'mist-phantom').length,
      sleeping: sleeper.sleepwalking, talkable: s.interactables.includes(sleeper.spot), finn: npc('finn').figure.frame.name,
      others: s.npcs.map(n => n.def.id).sort() };
    for (const e of s.enemies) e.character.setVisible(false);
    s.enemies = [];
    for (let i = 0; i < 3; i++) s.questEvent({ type: 'kill', map: 'ferry-village', monster: 'mist-phantom' });
    const bank = { step: s.quests['night-bell'].step, talkable: s.interactables.includes(sleeper.spot),
      fog: s.children.list.filter(o => o.name === 'night-fog-path').length };
    s.player.placeAt(sleeper.spot.x - 60, sleeper.spot.y + 20);
    s.openDialogue(sleeper.spot);
    const stillAsleep = sleeper.sleepwalking;
    flush(); step();
    const river = { opening: !!s.opening, step: s.quests['night-bell'].step, stillAsleep };
    s.opening.skip(); await ready('ferry-village');
    const hug = { people: s.npcs.map(n => n.def.id), frame: npc('finn').figure.frame.name, marker: npc('finn').questMarker };
    s.openDialogue(npc('finn').spot); flush();
    const status = s.quests['night-bell'].status;
    await ready('in-ferry-inn');
    const morning = { people: s.npcs.map(n => n.def.id).sort(), shade: !!s.chapterShade, rest: JSON.parse(localStorage.getItem('untitled-rpg.rest')).point };
    localStorage.removeItem('untitled-rpg.quests');
    return { day, inn, chase, bank, river, hug, status, morning };
  })()`);
  assert.deepEqual(result.day, { people: ['finn', 'fog-innkeeper', 'innkeeper-wife'], marker: 'target', spot: true });
  assert.deepEqual(result.inn, { opening: true, shade: true, stage: true, finn: 'watch-awake', step: 1, rest: null });
  assert.deepEqual(result.chase, { shade: true, phantoms: 3, sleeping: true, talkable: false, finn: 'warn-father', others: ['finn', 'fog-innkeeper'] });
  assert.deepEqual(result.bank, { step: 2, talkable: true, fog: 8 });
  assert.deepEqual(result.river, { opening: true, step: 3, stillAsleep: true });
  assert.deepEqual(result.hug, { people: ['finn'], frame: 'hug-father', marker: 'target' });
  assert.equal(result.status, 'done');
  assert.deepEqual(result.morning, { people: ['finn', 'fog-innkeeper', 'innkeeper-wife'], shade: false, rest: 'ferry-inn' });
});

test('안개 환영은 안개 줄기에서 몸이 생기며 나타나고(그동안 멈춰 있다), 쓰러지면 몸이 흩어지고, 다시 나타날 때도 몸이 생긴다', async () => {
  await load('reed-swamp&monsters=mist-phantom&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), e = s.enemies.find(e => e.kind === 'mist-phantom'), sp = e.character.sprite;
    const tick = ms => e.update(s.now += ms, ms / 1000, s.player, s.walkArea, s.nav, () => {});
    s.player.placeAt(e.character.x - 150, e.character.y);
    sp.playFade('materialize');
    const start = { x: e.character.x, y: e.character.y }, frames = [sp.image.frame.name];
    for (let i = 0; i < 3; i++) { tick(130); frames.push(sp.image.frame.name); }
    const still = e.character.x === start.x && e.character.y === start.y && sp.materializing;
    tick(130);
    const after = { frame: sp.image.frame.name, texture: sp.image.texture.key, materializing: sp.materializing };
    e.character.hurt(99999); e.kill();
    const dying = [sp.image.frame.name];
    for (let i = 0; i < 3; i++) { tick(120); dying.push(sp.image.frame.name); }
    e.respawn(start.x, start.y);
    return { frames, still, after, dying, respawn: sp.image.frame.name, alpha: e.character.alpha };
  })()`);
  assert.deepEqual(result.frames, ['materialize-0', 'materialize-1', 'materialize-2', 'materialize-3']);
  assert.equal(result.still, true);
  assert.equal(result.after.materializing, false);
  assert.match(result.after.texture, /^monster-mist-phantom-walk/);
  assert.deepEqual(result.dying, ['dissipate-0', 'dissipate-1', 'dissipate-2', 'dissipate-3']);
  assert.equal(result.respawn, 'materialize-0');
  assert.equal(result.alpha, 1);
});

test('행상인의 짐: 메리나의 천을 페른에게 가져가면 그 자리에서 수레가 고쳐지고 페른의 수레에 말린 무화과가 생긴다', async () => {
  await load('south-field&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'fern-cart') break;
    }
    seed['fern-cover'] = { status: 'active', count: 0, step: 1 };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 200, items: {} }));
  })()`);
  await load('village&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), fern = s.npcs.find(n => n.def.id === 'fern');
    const cart = () => s.children.getByName('fern-cart').texture.key;
    const before = cart(), marker = fern.questMarker;
    s.openDialogue(fern.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const after = cart(), status = s.quests['fern-cover'].status;
    // 끝낸 대화 뒤 바로 수레가 열린다: 물품과 장비 가운데 고른다
    const choice = s.storyChoice.isOpen;
    s.storyChoice.choose(1);
    const gearShop = { open: s.characterPanel.isOpen, title: s.characterPanel.title.text,
      bracelet: s.characterPanel.collectEntries(s.characterView()).some(e => e.id === 'reed-knot-bracelet') };
    s.characterPanel.close();
    s.openItemPanel('shop', 'fern');
    const names = s.itemPanel.rows.filter(r => r.name.visible).map(r => r.name.text);
    // 한 쪽에 세 줄: 다음 쪽까지 본다
    s.itemPanel.nextButton.emit('pointerup');
    names.push(...s.itemPanel.rows.filter(r => r.name.visible).map(r => r.name.text));
    s.itemPanel.close();
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.inventory');
    return { before, marker, after, status, choice, gearShop, fig: names.some(n => n.includes('말린 무화과')) };
  })()`);
  assert.deepEqual(result, { before: 'fern-cart-damaged', marker: 'target', after: 'fern-cart-repaired', status: 'done', choice: true,
    gearShop: { open: true, title: '페른의 수레 · 여행 장신구', bracelet: true }, fig: true });
});

test('마르타는 나루 대장간 안에 서 있고, 멈춘 나루를 끝낸 뒤 대화하면 2단계 강화와 청동 장신구를 연다', async () => {
  await load('east-pass&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'still-ferry') break;
    }
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 1000, items: {} }));
  })()`);
  await load('in-ferry-marta-smithy&companion=none');
  const result = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), marta = s.npcs.find(n => n.def.id === 'marta');
    const placed = { people: s.npcs.map(n => n.def.id), texture: marta.figure.texture.key, spot: s.walkArea.contains(marta.spot.x, marta.spot.y) };
    s.player.placeAt(marta.spot.x - 60, marta.spot.y + 20);
    s.openDialogue(marta.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const panel = s.characterPanel, open = panel.isOpen, title = panel.title.text, tab = panel.currentShopTab;
    s.enhanceGearSlot('body');
    const bodyLv = s.character.gear.enhance.body;
    panel.switchShopTab('buy');
    const ids = panel.collectEntries(s.characterView()).map(e => e.id);
    s.tradeGear('bronze-bell-earring', 'buy');
    const bought = { gold: s.inventory.gold, bag: s.character.gear.bag['bronze-bell-earring'] };
    panel.close();
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.inventory'); localStorage.removeItem('untitled-rpg.character');
    return { placed, open, title, tab, bodyLv, ids, bought };
  })()`);
  assert.deepEqual(result.placed.people, ['marta']);
  assert.notEqual(result.placed.texture, '__MISSING');
  assert.equal(result.placed.spot, true);
  assert.equal(result.open, true);
  assert.equal(result.title, '마르타의 대장간');
  assert.equal(result.tab, 'enhance');
  assert.equal(result.bodyLv, 1);
  assert.deepEqual(result.ids, ['bronze-bell-earring']);
  assert.deepEqual(result.bought, { gold: 660, bag: 1 });
});

test('사라진 다섯·새는 지붕·엉킨 그물: 증인은 각자 집에서 증언하고, 늪의 갈대와 그물을 모으면 여관 지붕이 고쳐진다', { timeout: 120000 }, async () => {
  await load('east-pass&companion=none');
  await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts'); const seed = {};
    for (const q of QUESTS.filter(q => q.main)) {
      seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
      if (q.id === 'night-bell') break;
    }
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.setItem('untitled-rpg.inventory', JSON.stringify({ version: 1, gold: 0, items: {} }));
  })()`);
  await load('in-ferry-inn&companion=none');
  const result = await evaluate(`(async () => {
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const restart = async map => {
      s.scene.restart({ map }); g.step(t += 16, 16);
      for (let i = 0; i < 300; i++) {
        s = g.scene.getScene('game');
        if (s.mapId === map && s.sys.isActive() && s.minimap && !s.traveling) return;
        await new Promise(resolve => setTimeout(resolve, 10)); g.step(t += 16, 16);
      }
      throw Error('맵 재시작 시간 초과: ' + map);
    };
    const flush = () => { while (s.dialogue.isOpen) s.dialogue.advance(); if (s.storyChoice?.isOpen) s.storyChoice.cancel(); if (s.characterPanel?.isOpen) s.characterPanel.close(); };
    const witnessPoses = {};
    const talk = id => {
      const n = s.npcs.find(n => n.def.id === id);
      if (!n) throw Error('NPC 없음: ' + id + ' @' + s.mapId);
      s.openDialogue(n.spot);
      const portrait = s.dialogue.portrait.texture.key;
      if (['fisher-daughter', 'herbalist-elder', 'evan'].includes(id)) {
        const poses = new Set();
        while (s.dialogue.isOpen) { poses.add(n.figure.frame.name); s.dialogue.advance(); }
        witnessPoses[id] = [...poses];
      }
      flush();
      return portrait;
    };
    const inspectAll = () => { for (const spot of s.interactables.filter(i => i.id.startsWith('story-'))) { s.openDialogue(spot); flush(); } };
    // 사라진 다섯: 여관 주인 → 증인 셋(각자 집) → 에반 → 마르타
    talk('fog-innkeeper');
    // 서브 의뢰도 받는다: 핀의 어머니(여관)
    talk('innkeeper-wife');
    const portraits = [];
    await restart('in-ferry-fisherman-house'); portraits.push(talk('fisher-daughter'));
    await restart('in-ferry-herbalist-shop'); portraits.push(talk('herbalist-elder'));
    await restart('in-ferry-watermill'); portraits.push(talk('mill-apprentice'));
    await restart('ferry-village'); talk('evan'); talk('ferry-fisher');
    const innBefore = s.children.getByName('village-prop-inn').texture.key;
    await restart('in-ferry-marta-smithy'); talk('marta');
    const missing = s.quests['missing-five'].status;
    // 갈대밭 늪: 갈대 묶음과 그물을 차례로 (한 번에 하나씩 보인다)
    await restart('reed-swamp');
    const art = s.storyMarkers.filter(m => m.type === 'Image').map(m => m.texture.key).sort();
    for (let i = 0; i < 3; i++) inspectAll();
    const ready = [s.quests['leaky-roof'].step, s.quests['tangled-nets'].step];
    await restart('in-ferry-inn'); talk('innkeeper-wife');
    await restart('ferry-village'); talk('ferry-fisher');
    const innAfter = s.children.getByName('village-prop-inn').texture.key;
    const result = { portraits, witnessPoses, missing, art, ready, roof: s.quests['leaky-roof'].status, nets: s.quests['tangled-nets'].status,
      fish: s.inventory.items['dried-fish'] ?? 0, innBefore, innAfter };
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.inventory');
    return result;
  })()`);
  assert.deepEqual(result.portraits, ['portrait-fisher-daughter', 'portrait-herbalist-elder', 'portrait-mill-apprentice']);
  assert.deepEqual(result.witnessPoses, {
    'fisher-daughter': ['fidget-twine', 'tell-story', 'lower-gaze'],
    'herbalist-elder': ['add-herb', 'offer-cup', 'reassuring-nod'],
    evan: ['riverbank-rise', 'riverbank-point', 'riverbank-warn'],
  });
  assert.equal(result.missing, 'done');
  assert.deepEqual(result.art, ['quest-net-1', 'quest-reed-bundle']);
  assert.deepEqual(result.ready, [3, 3]);
  assert.equal(result.roof, 'done');
  assert.equal(result.nets, 'done');
  assert.equal(result.fish, 3);
  assert.equal(result.innBefore, 'ferry-inn');
  assert.equal(result.innAfter, 'ferry-inn-repaired');
});

test('나루 여관 주인은 전용 SD·잠든 걸음·대화 초상화를 사용하고 대화하면 깨어난다', async () => {
  await load('east-stream&npcs=innkeeper&sleepwalk=1&companion=none');
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'), n=s.npcs[0], start={x:n.x,y:n.y}, poses=new Set();
    const sleeping=n.sleepwalking, texture=n.figure.texture.key;
    for(let i=0;i<6;i++){n.update(s.now+i*250,.25,s.player,s.walkArea);poses.add(n.figure.frame.name);}
    const moved=n.x>start.x&&n.y>start.y, safe=s.walkArea.contains(n.x,n.y);
    const x=n.x,y=n.y;n.update(s.now,0,s.player,s.walkArea);const paused=x===n.x&&y===n.y;
    s.openDialogue(n.spot);
    const portrait=s.dialogue.portrait.texture.key, awake=!n.sleepwalking, idle=n.figure.texture.key;
    while(s.dialogue.isOpen)s.dialogue.advance();
    return {sleeping,texture,poses:poses.size,moved,safe,paused,portrait,awake,idle};
  })()`);
  assert.deepEqual(result,{sleeping:true,texture:'npc-fog-innkeeper-sleepwalk',poses:4,moved:true,safe:true,paused:true,
    portrait:'portrait-fog-innkeeper',awake:true,idle:'npc-fog-innkeeper-cardinal'});
});

test('2장 동쪽 고갯길 퀘스트: 떠날 채비 뒤 고갯길로 가서 딱정벌레 셋을 쫓고 쉼터의 도르를 만난다', async () => {
  await load('east-stream');
  const result = await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts');
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const seed = {};
    const mains = QUESTS.filter(q => q.main);
    for (const q of mains.slice(0, mains.findIndex(q => q.id === 'farewell') + 1)) seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    const ready = () => s.sys.isActive() && s.minimap && !s.traveling;
    s.scene.restart({ map: 'east-stream' }); g.step(t += 16, 16);
    for (let i = 0; i < 300 && !(s.mapId === 'east-stream' && ready()); i++) { await new Promise(r => setTimeout(r, 10)); g.step(t += 16, 16); s = g.scene.getScene('game'); }
    const started = s.quests['mountain-pass']?.status;
    const toPass = s.map.exits.find(e => e.to === 'east-pass');
    s.player.placeAt((toPass.zone.left + toPass.zone.right) / 2, (toPass.zone.top + toPass.zone.bottom) / 2);
    for (let i = 0; i < 300 && !(s.mapId === 'east-pass' && ready()); i++) { await new Promise(r => setTimeout(r, 10)); g.step(t += 16, 16); s = g.scene.getScene('game'); }
    const arrived = s.mapId, beetles = s.enemies.filter(e => e.kind === 'frost-beetle').length;
    const tracker = s.questTracker.text.text;
    for (let i = 0; i < 3; i++) s.questEvent({ type: 'kill', map: 'east-pass', monster: 'frost-beetle' });
    const step = s.quests['mountain-pass']?.step;
    const dor = s.npcs.find(n => n.def.id === 'dor');
    s.openDialogue(dor.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const done = s.quests['mountain-pass']?.status;
    localStorage.removeItem('untitled-rpg.quests');
    return { started, arrived, beetles, tracker, step, done };
  })()`);
  assert.equal(result.started, 'active', '떠날 채비 뒤 이어진다');
  assert.equal(result.arrived, 'east-pass');
  assert.equal(result.beetles, 3);
  assert.match(result.tracker, /동쪽 고갯길/);
  assert.equal(result.step, 1, '딱정벌레 셋 뒤 도르를 찾아간다');
  assert.equal(result.done, 'done');
});

test('2장 고개의 쉼터: 까마귀 넷 뒤 도르와 하룻밤을 보내 쉼터가 시작 자리가 되고, 꼭대기를 살펴본 뒤 도르에게 인사한다', async () => {
  await load('east-pass');
  const result = await evaluate(`(async () => {
    const { QUESTS } = await import('/src/story/quests.ts');
    const g = window.__game;
    let s = g.scene.getScene('game'), t = performance.now();
    const seed = {};
    const mains = QUESTS.filter(q => q.main);
    for (const q of mains.slice(0, mains.findIndex(q => q.id === 'mountain-pass') + 1)) seed[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    seed['pass-shelter'] = { status: 'active', count: 0 };
    localStorage.setItem('untitled-rpg.quests', JSON.stringify({ version: 1, quests: seed }));
    localStorage.removeItem('untitled-rpg.rest');
    const ready = () => s.sys.isActive() && s.minimap && !s.traveling;
    s.scene.restart({ map: 'east-pass' }); g.step(t += 16, 16);
    for (let i = 0; i < 300 && !(s.mapId === 'east-pass' && ready()); i++) { await new Promise(r => setTimeout(r, 10)); g.step(t += 16, 16); s = g.scene.getScene('game'); }
    const tracker = s.questTracker.text.text;
    for (let i = 0; i < 4; i++) s.questEvent({ type: 'kill', map: 'east-pass', monster: 'fog-crow' });
    const before = s.interactables.some(i => i.id === 'story-pass-summit');
    s.player.hp = 1;
    const dor = s.npcs.find(n => n.def.id === 'dor');
    s.openDialogue(dor.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const sleeping = s.traveling;
    for (let i = 0; i < 400 && s.traveling; i++) { await new Promise(r => setTimeout(r, 10)); g.step(t += 16, 16); }
    const rest = JSON.parse(localStorage.getItem('untitled-rpg.rest') ?? 'null')?.point;
    const healed = s.player.hp === s.player.maxHp;
    const summit = s.interactables.find(i => i.id === 'story-pass-summit');
    s.openDialogue(summit); while (s.dialogue.isOpen) s.dialogue.advance();
    const step = s.quests['pass-shelter'].step;
    s.openDialogue(dor.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const done = s.quests['pass-shelter'].status;
    // 끝낸 뒤 첫 대화는 서브 퀘스트 "쉼터의 약초" 제안, 그다음 평소 대화 뒤에 쉬어 갈지 묻는다
    s.openDialogue(dor.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const herbs = s.quests['dor-herbs']?.status;
    s.openDialogue(dor.spot); while (s.dialogue.isOpen) s.dialogue.advance();
    const offer = herbs === 'active' && s.storyChoice?.isOpen;
    s.storyChoice?.close?.();
    localStorage.removeItem('untitled-rpg.quests'); localStorage.removeItem('untitled-rpg.rest');
    return { tracker, before, sleeping, rest, healed, summit: !!summit, step, done, offer };
  })()`);
  assert.match(result.tracker, /고개의 쉼터/);
  assert.equal(result.before, false, '하룻밤 전에는 꼭대기 자리가 없다');
  assert.equal(result.sleeping, true, '화면이 어두워지는 동안 게임이 멈춘다');
  assert.equal(result.rest, 'shelter', '고개 쉼터가 다시 시작할 자리가 된다');
  assert.equal(result.healed, true);
  assert.equal(result.summit, true);
  assert.equal(result.step, 3);
  assert.equal(result.done, 'done');
  assert.equal(result.offer, true, '끝낸 뒤 도르에게 말하면 쉬어 갈지 묻는다');
});

test('미연결 조연: 토비·종 사내·어머니는 전용 외형과 초상화, 풀무·종·고치 동작을 쓴다', async () => {
  await load('east-stream&npcs=support&companion=none');
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game'),t=s.npcs.find(n=>n.def.id==='toby'),r=s.npcs.find(n=>n.def.id==='bell-ringer'),m=s.npcs.find(n=>n.def.id==='bell-ringer-mother');
    const start=t.figure.frame.name;t.update(s.now,.35,s.player,s.walkArea);const bellows=t.figure.frame.name!==start;
    const clock=t.storyElapsed;t.update(s.now,0,s.player,s.walkArea);const frozen=t.storyElapsed===clock;
    const ring=r.figure.frame.name;r.update(s.now,.26,s.player,s.walkArea);const ringing=r.figure.frame.name!==ring;
    const portraits=[];
    const witnesses=['fisher-daughter','herbalist-elder','mill-apprentice','innkeeper-wife','ferry-fisher'].map(id=>s.npcs.find(n=>n.def.id===id));
    for(const n of [r,m,t,...witnesses]){s.openDialogue(n.spot);portraits.push(s.dialogue.portrait.texture.key);while(s.dialogue.isOpen)s.dialogue.advance();}
    const stopped=r.currentStoryAction===undefined&&['npc-bell-ringer-cardinal','npc-bell-ringer-diagonal'].includes(r.figure.texture.key);
    const paused=t.storyElapsed;t.update(s.now,.3,s.player,s.walkArea);const talkPause=t.storyElapsed===paused;
    t.update(s.now+10000,.35,s.player,s.walkArea);const resumed=t.storyElapsed>paused;
    const set=t.setStoryAction('cocoon'),cocoon=t.figure.texture.key;
    s.openDialogue(t.spot);const hero=s.dialogue.portrait.texture.key,asleep=t.currentStoryAction==='cocoon';while(s.dialogue.isOpen)s.dialogue.advance();
    t.setStoryAction();const idle=t.figure.texture.key,normalTalk=t.spot.dialogue;
    return {ids:s.npcs.map(n=>n.def.id).sort(),bellows,frozen,ringing,portraits,stopped,talkPause,resumed,set,cocoon,hero,asleep,idle,normalTalk,
      mother:m.figure.texture.key,motherHeight:m.figure.displayHeight,unsupported:m.setStoryAction('ring'),unknown:r.setStoryAction('toString')};
  })()`);
  assert.deepEqual(result.ids,['bell-ringer','bell-ringer-mother','ferry-fisher','fisher-daughter','fog-innkeeper','herbalist-elder','innkeeper-wife','mill-apprentice','toby']);
  for(const key of ['bellows','frozen','ringing','stopped','talkPause','resumed','set','asleep'])assert.equal(result[key],true,key);
  assert.deepEqual(result.portraits,['portrait-bell-ringer','portrait-bell-ringer-mother','portrait-toby','portrait-fisher-daughter','portrait-herbalist-elder','portrait-mill-apprentice','portrait-innkeeper-wife','portrait-ferry-fisher']);
  assert.equal(result.cocoon,'npc-toby-cocoon');assert.equal(result.hero,'portrait-hero-neutral');
  assert.match(result.idle,/^npc-toby-(cardinal|diagonal)$/);assert.equal(result.normalTalk,'npc-toby');
  assert.equal(result.mother,'npc-bell-ringer-mother-idle');assert.equal(result.motherHeight,118);assert.equal(result.unsupported,false);assert.equal(result.unknown,false);
  await load('east-stream&npcs=support&companion=none&action=sleepwalk');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').textures.get('npc-bell-ringer-ring').getFrameNames().length`),4);
  const motion = await evaluate(`(() => {
    const scene = window.__game.scene.getScene('game');
    const toby = scene.npcs.find(n => n.def.id === 'toby');
    const first = toby.figure.frame.name;
    toby.update(scene.now, .26, scene.player, scene.walkArea);
    const sleepwalk = { texture: toby.figure.texture.key, advanced: toby.figure.frame.name !== first };
    toby.setStoryAction();
    const directions = [[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
    const frames = directions.map(([x,y]) => {
      toby.faceTowards(toby.x + x * 100, toby.y + y * 100);
      return toby.figure.frame.name;
    });
    toby.walkTo([{ x: toby.x + 80, y: toby.y }]);
    toby.update(scene.now, .25, scene.player, scene.walkArea);
    return { sleepwalk, frames, walk: toby.figure.frame.name };
  })()`);
  assert.deepEqual(motion.sleepwalk, { texture: 'npc-toby-sleepwalk', advanced: true });
  assert.deepEqual(motion.frames, ['down-0', 'left-0', 'right-0', 'up-0', 'down-left-0', 'down-right-0', 'up-left-0', 'up-right-0']);
  assert.match(motion.walk, /^right-[123]$/);

  await load('east-stream&npcs=support&companion=none&actor=toby&action=sleepwalk');
  const route = await evaluate(`(() => {
    const scene = window.__game.scene.getScene('game');
    const toby = scene.npcs.find(n => n.def.id === 'toby'), x = toby.x;
    const frames = new Set([toby.figure.frame.name]);
    for (let i = 0; i < 5; i++) {
      toby.update(scene.now + i * 100, .1, scene.player, scene.walkArea);
      frames.add(toby.figure.frame.name);
    }
    return { moving: toby.x > x, sleeping: toby.sleepwalking, frames: [...frames] };
  })()`);
  assert.equal(route.moving && route.sleeping, true);
  assert(route.frames.length > 1 && route.frames.every(name => name.startsWith('sleepwalk-')));
});

test('미연결 계승자 다섯은 각자의 8방향 이동·초상화를 쓰며 본편에 일찍 배치되지 않는다', async () => {
  await load('east-stream&npcs=successors&companion=none');
  const result=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('game');
    return s.npcs.map(n=>{
      const dirs=[[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
      const frames=dirs.map(([x,y])=>{n.faceTowards(n.x+x*100,n.y+y*100);return n.figure.frame.name;});
      const start={x:n.x,y:n.y};n.walkTo([{x:n.x+80,y:n.y}],1);n.update(s.now,.25,s.player,s.walkArea);const moved=n.x>start.x&&n.spot.x===n.x;
      n.release();s.openDialogue(n.spot);const portrait=s.dialogue.portrait.texture.key;while(s.dialogue.isOpen)s.dialogue.advance();
      return {id:n.def.id,frames:new Set(frames).size,moved,portrait,own:n.figure.texture.key.startsWith('npc-'+n.def.id+'-'),safe:s.walkArea.contains(n.x,n.y)};
    });
  })()`);
  assert.deepEqual(result.map(n=>n.id),['bram','mirel','kairen','velka','razen']);
  for(const n of result){assert.equal(n.frames,8,n.id);assert.equal(n.moved,true,n.id);assert.equal(n.own,true,n.id);assert.equal(n.safe,true,n.id);assert.equal(n.portrait,'portrait-'+n.id);}
  await load('east-stream&companion=none');
  assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.some(n=>['bram','mirel','kairen','velka','razen','toby','bell-ringer','bell-ringer-mother'].includes(n.def.id))`),false);
});

test('복구 상점 주민은 작업 그림을 유지하고 대화·거래·재접속 뒤에도 준비를 이어 간다', async () => {
  await load('in-smithy');
  assert.equal(await evaluate(`(() => {
    const doran = window.__game.scene.getScene('game').npcs.find(n => n.def.id === 'doran');
    return doran.currentStoryAction === 'hammer' && doran.figure.texture.key === 'npc-doran-hammer';
  })()`), true, '평상시에도 망치질한다');
  await evaluate(`localStorage.setItem('untitled-rpg.quests',JSON.stringify({version:1,quests:{'village-raid':{status:'done',count:0},'doran-gel':{status:'done',count:5}}}))`);
  for (const [map,id,action] of [['in-smithy','doran','hammer'],['in-store','merina','supplies'],['in-inn','rosetta','blankets']]) {
    await load(map);
    const result=await evaluate(`(() => {
      const s=window.__game.scene.getScene('game'),n=s.npcs.find(n=>n.def.id===${JSON.stringify(id)}),frames=new Set();
      for(let i=0;i<40;i++){n.update(4000+i*100,.1,s.player,s.walkArea);frames.add(n.figure.frame.name);}
      n.talkedTo(8000,s.player);const before=n.storyElapsed;n.update(8100,.1,s.player,s.walkArea);
      const paused=n.storyElapsed===before;
      s.openDialogue(n.spot);const portrait=s.dialogue.portrait.texture.key;
      while(s.dialogue.isOpen)s.dialogue.advance();
      const trade=n.def.id==='merina'?s.itemPanel.isOpen:n.def.id==='doran'?s.characterPanel.isOpen:true;
      n.update(12000,.6,s.player,s.walkArea);
      return {frames:[...frames],paused,portrait,trade,action:n.currentStoryAction,texture:n.figure.texture.key,resumed:n.storyElapsed>before,
        offset:n.spot.y-n.y,expectedOffset:n.def.talkOffset??0};
    })()`);
    if (id === 'doran') assert.deepEqual(result.frames, ['ready', 'raise', 'swing', 'strike']);
    else assert.equal(result.frames.length, 2, id);
    assert.equal(result.paused,true,id);assert.equal(result.resumed,true,id);
    assert.equal(result.trade,true,id);assert.equal(result.action,action,id);assert.equal(result.texture, id === 'doran' ? 'npc-doran-hammer' : 'npc-village-relief', id);
    assert.equal(result.portrait,'portrait-'+id);assert.ok(Math.abs(result.offset-result.expectedOffset)<.001,id);
    await load(map);
    assert.equal(await evaluate(`window.__game.scene.getScene('game').npcs.find(n=>n.def.id===${JSON.stringify(id)}).currentStoryAction`),action);
  }
});

test('담금질 재료를 도란에게 보고하면 무기가 무료로 +1 강화되고 대장간 창이 열린다', async () => {
  await load('in-smithy');
  await evaluate(`localStorage.setItem('untitled-rpg.quests',JSON.stringify({version:1,quests:{'ruan-training':{status:'done',count:3},'doran-gel':{status:'ready',count:5}}}))`);
  await load('in-smithy');
  const result = await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),n=s.npcs.find(n=>n.def.id==='doran');
    const before=s.character.gear.enhance.weapon??0,gold=s.inventory.gold;
    s.openDialogue(n.spot);
    while(s.dialogue.isOpen)s.dialogue.advance();
    return {before,after:s.character.gear.enhance.weapon,gold,goldAfter:s.inventory.gold,status:s.quests['doran-gel'].status,panel:s.characterPanel.isOpen,
      saved:JSON.parse(localStorage.getItem('untitled-rpg.character')).gear.enhance.weapon};
  })()`);
  assert.equal(result.status, 'done');
  assert.equal(result.after, result.before + 1, JSON.stringify(result));
  assert.equal(result.saved, result.after, '강화가 저장된다');
  assert.equal(result.goldAfter, result.gold, '골드는 그대로다(비용도 보상도 없다)');
  assert.equal(result.panel, true, '대장간 창이 열린다');
});

test('헤르만과 베르넬은 기록·조사 동작에서 걷기로 전환하고 다음 현장에서 작업을 재개한다', async () => {
  await load('village');
  await evaluate(`localStorage.setItem('untitled-rpg.quests',JSON.stringify({version:1,quests:{'village-raid':{status:'done',count:0}}}))`);
  for(const [map,id,action] of [['village-north','herman','record'],['village','vernel','inspect']]) {
    await load(map);
    const result=await evaluate(`(() => {
      const s=window.__game.scene.getScene('game'),n=s.npcs.find(n=>n.def.id===${JSON.stringify(id)}),start={x:n.x,y:n.y},frames=new Set();
      let walked=false,resumed=false,safe=true;
      for(let i=0;i<1800;i++){
        n.update(i*50,.05,s.player,s.walkArea,s.npcCanStand);safe&&=s.walkArea.contains(n.x,n.y);
        if(n.currentStoryAction===${JSON.stringify(action)})frames.add(n.figure.frame.name);
        else if(n.figure.texture.key.includes('cardinal')||n.figure.texture.key.includes('diagonal'))walked=true;
        if(walked&&Math.hypot(n.x-start.x,n.y-start.y)>100&&n.currentStoryAction===${JSON.stringify(action)}){resumed=true;break;}
      }
      n.talkedTo(100000,s.player);const before=n.storyElapsed;n.update(100100,.1,s.player,s.walkArea);
      const paused=n.storyElapsed===before;
      return {frames:[...frames],walked,resumed,safe,paused,action:n.currentStoryAction,label:n.nameLabel.y};
    })()`);
    assert.equal(result.frames.length,2,id);for(const key of ['walked','resumed','safe','paused'])assert.equal(result[key],true,id+':'+key);
    assert.equal(result.action,action);if(id==='vernel')assert.equal(result.label,-135);
  }
});

test('습격 중 메리나와 로제타는 치유소에서 구호 물품과 담요를 준비한다', async () => {
  await load('village');
  await evaluate(`localStorage.setItem('untitled-rpg.quests',JSON.stringify({version:1,quests:{'festival-eve':{status:'done',count:0},'village-raid':{status:'active',step:5,count:0}}}))`);
  await load('in-clinic');
  const result=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game');
    return ['merina','rosetta'].map(id=>{const n=s.npcs.find(n=>n.def.id===id),frames=new Set();
      for(let i=0;i<30;i++) {n.update(i*100,.1,s.player,s.walkArea);frames.add(n.figure.frame.name);}
      return {id,action:n.currentStoryAction,frames:[...frames],safe:s.walkArea.contains(n.x,n.y),texture:n.figure.texture.key};});
  })()`);
  for(const n of result){assert.equal(n.action,n.id==='merina'?'supplies':'blankets');assert.equal(n.frames.length,2);assert.equal(n.safe,true);assert.equal(n.texture,'npc-village-relief');}
});

test('위아래 회피는 입력을 놓거나 스틱이 조금 흔들려도 직진하고 전용 정면·뒷면 그림을 쓴다', async () => {
  await load('south-field&companion=none');
  const results=await evaluate(`(() => {
    const s=window.__game.scene.getScene('game'),p=s.player,hero=p.sprite,out=[];
    s.enemies=[];s.joystick.vector.set(0,0);
    const dirs=['up','down','left','right','up-left','up-right','down-left','down-right'];
    const vector=name=>({x:name==='up'||name==='down'?0:name.includes('left')?-1:1,y:name==='left'||name==='right'?0:name.startsWith('up')?-1:1});
    let ground;
    outer:for(let y=600;y<1700;y+=150)for(let x=600;x<2400;x+=150){
      const safe=dirs.every(name=>{const v=vector(name),len=Math.hypot(v.x,v.y);for(let k=0;k<=25;k++)if(!s.walkArea.contains(x+v.x/len*k*10,y+v.y/len*k*7))return false;return true;});
      if(safe){ground={x,y};break outer;}
    }
    if(!ground)throw Error('회피 테스트용 빈 바닥 없음');
    for(const name of dirs)for(const mode of ['released','held',...(['up','down'].includes(name)?['drift']:[])]){
      p.setDodging(false);p.revive(ground.x,ground.y);hero.play('idle');hero.setAttackFacing(name);
      // The old left/right field deliberately disagrees with the eight-way visual facing.
      p.face(name==='up'?-1:1);
      const v=vector(name),input=mode==='released'?{x:0,y:0}:mode==='drift'?{x:.15,y:v.y}:v;
      s.now+=1000;s.dodgeReadyAt=0;s.startDodge(s.now,new p.knockback.constructor(input.x,input.y));
      const frames=new Set(),mirror=hero.image.scaleX<0;
      for(let i=0;i<6;i++){hero.advance(50);frames.add(hero.image.frame.name);s.now+=50;s.updateDodge(s.now);}
      const parts=hero.spawnGhost(p.x,p.y,p.y-1,0x9fc4ff,.35);const body=parts.getAt(1);
      const ghost=body.texture.key===hero.image.texture.key&&body.frame.name===hero.image.frame.name;parts.destroy();
      const len=Math.hypot(v.x,v.y);
      out.push({name,mode,dx:p.x-ground.x,dy:p.y-ground.y,expectedX:v.x/len*250,expectedY:v.y/len*250*.7,
        look:hero.lookDirection,frames:[...frames],mirror,ghost,finite:hero.parts.every(part=>Number.isFinite(part.x)&&Number.isFinite(part.y)&&Number.isFinite(part.scaleX))});
      p.setDodging(false);
    }
    return out;
  })()`);
  assert.equal(results.length,18);
  for(const r of results){
    assert.ok(Math.abs(r.dx-r.expectedX)<1e-6,JSON.stringify(r));assert.ok(Math.abs(r.dy-r.expectedY)<1e-6,JSON.stringify(r));
    assert.equal(r.look,r.name);assert.equal(r.ghost,true);assert.equal(r.finite,true);
    if(r.name==='up'||r.name==='down'){assert.equal(r.frames.length,4);assert.ok(r.frames.every(f=>f.startsWith('dodge-'+r.name+'-')));assert.equal(r.mirror,false);}
  }
});

test('갈대밭 늪에서 잠복 마물의 물줄기가 조준한 방향으로 나가며 벽과 공격 중단을 반영한다', async () => {
  // 갈대밭 늪은 물안개 나루 남서쪽 길에서 들어간다.
  await load('ferry-village&companion=none');
  assert.equal(await evaluate(`(() => {
    const game = window.__game, scene = game.scene.getScene('game');
    const exit = scene.map.exits.find(exit => exit.to === 'reed-swamp');
    scene.player.placeAt(exit.zone.left + 10, (exit.zone.top + exit.zone.bottom) / 2);
    game.loop.wake();
    return scene.checkExit();
  })()`), true);
  await until(() => evaluate(`window.__game.scene.getScene('game').mapId === 'reed-swamp'
    && window.__game.scene.getScene('game').enemies.some(enemy => enemy.kind === 'swamp-lurker')`));
  const result = await evaluate(`(() => {
    const game = window.__game, scene = game.scene.getScene('game');
    game.loop.sleep();
    const e = scene.enemies[0], p = scene.player, sprite = e.character.sprite;
    const jet = scene.children.getByName('swamp-water-jet'), warning = scene.children.getByName('swamp-jet-warning');
    const { windupMs, strikeMs, returnMs } = e.stats;
    const tick = (ms) => {
      scene.now += ms;
      e.update(scene.now, ms / 1000, p, scene.walkArea, scene.nav, scene.onEnemyStrike);
    };
    const aim = (x, y, targetX, targetY) => {
      e.interrupt(scene.now, 0);
      e.state = 'chase';
      e.character.placeAt(x, y);
      p.revive(targetX, targetY);
      p.invulnerableUntil = 0;
      tick(10);
    };
    scene.derived.evadeChance = 0;
    aim(1240, 825, 1500, 825);
    const strikeEnd = scene.now + windupMs + strikeMs;
    tick(windupMs - 1);
    const prepared = warning.commandBuffer.length > 0 && jet.commandBuffer.length === 0
      && sprite.list[0].frame.name === 'attack-right-1' && p.hp === p.maxHp;
    tick(31);
    const fired = jet.commandBuffer.length > 0 && warning.commandBuffer.length === 0
      && sprite.list[0].frame.name === 'attack-right-2' && p.hp === p.maxHp;
    tick(220);
    const hpAfterHit = p.hp;
    p.invulnerableUntil = 0;
    tick(120);
    const hitOnce = hpAfterHit < p.maxHp && p.hp === hpAfterHit;
    tick(strikeEnd - scene.now + 10);
    const released = sprite.list[0].frame.name === 'attack-right-3';
    tick(returnMs);
    const cleared = !jet.commandBuffer.length && !warning.commandBuffer.length;

    aim(1240, 825, 1500, 825);
    p.placeAt(1500, 935);
    tick(windupMs + 275);
    const avoided = p.hp === p.maxHp && sprite.list[0].frame.name === 'attack-right-2';
    e.interrupt(scene.now);
    const interrupted = !jet.commandBuffer.length && !warning.commandBuffer.length;

    aim(1005, 781, 880, 781);
    p.placeAt(620, 781);
    tick(windupMs + 310);
    const blocked = p.hp === p.maxHp && e.waterJet.aim.start.x - e.waterJet.aim.length > 780;
    const terrain = scene.textures.exists('map-art-reed-swamp') && !scene.walkArea.contains(1300, 300);
    return { prepared, fired, hitOnce, released, cleared, avoided, interrupted, blocked, terrain };
  })()`);
  for (const [check, passed] of Object.entries(result)) assert.equal(passed, true, check);
});

test('안개 실 잣기는 바닥을 예고하고 시온·에반을 묶으며 검날에 끊어진다', async () => {
  const map = 'reed-swamp&companion=none&monsters=mist-weaver';
  await load(map);
  // 앞선 테스트가 남긴 저장(장비·능력치·레벨·퀘스트 등)이 검의 길이와 피해를 바꾸지 않게 깨끗한 저장으로 시작한다.
  await evaluate('localStorage.clear()');
  await load(map);
  const bound = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player;
    const {threads, caster, evan} = s.mistWeaver;
    const pattern = s.children.getByName('mist-thread-pattern');
    const tethers = s.children.getByName('mist-thread-bind');
    const tick = (n = 1) => { for (let i = 0; i < n; i++) s.update(0, 16); };
    const until = (condition) => { for (let i = 0; !condition() && i < 450; i++) tick(); return condition(); };
    until(() => threads.active);
    const warned = pattern.commandBuffer.length > 0 && !threads.holds(p)
      && caster.character.sprite.list[0].frame.name === 'attack-left-1';
    const realShadow = caster.character.shadow.frame.name === 'shadow-left-1';
    const hp = p.hp, bossHp = caster.character.hp;
    const caught = until(() => threads.holds(p));
    const heldArt = tethers.commandBuffer.length > 0;
    const before = p.x;
    s.joystick.vector.set(1,0); s.dodgeButton.pressed = true;
    tick(16);
    const rooted = p.x === before && s.dodgeProgress === 1 && hp === p.hp;
    s.joystick.vector.set(0,0);
    s.onAttackKeyDown();
    const selfFreed = until(() => !threads.holds(p));

    tick(35); s.joystick.vector.set(1,0); tick(6); s.joystick.vector.set(0,0);
    const walkingAgain = p.x > before;
    const evanCaught = until(() => threads.holds(evan));
    const evanX = evan.x;
    tick(12);
    const evanRooted = threads.holds(evan) && evan.x === evanX;
    p.placeAt(caster.character.x - 92, caster.character.y);
    s.comboStage = 0;
    s.onAttackKeyDown(); tick(36);
    const bodyUnaffected = caster.untouchable && caster.character.hp === bossHp;
    const missedEvan = threads.holds(evan);
    p.placeAt(evan.x - 103, evan.y);
    s.comboStage = 0;
    s.onAttackKeyDown();
    const evanFreed = until(() => !threads.holds(evan));
    tick(8);
    const evanWalked = evan.x !== evanX;
    return {warned,realShadow,caught,heldArt,rooted,selfFreed,walkingAgain,evanCaught,evanRooted,bodyUnaffected,missedEvan,evanFreed,evanWalked};
  })()`);
  for (const [key, ok] of Object.entries(bound)) assert.equal(ok, true, key);

  await load(map);
  const dodged = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player;
    const {threads} = s.mistWeaver;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) s.update(0,16); };
    for (let i = 0; !threads.active && i < 125; i++) tick();
    const origin = {...threads.weave.at};
    s.joystick.vector.set(1,0); s.dodgeButton.pressed = true; tick(); s.joystick.vector.set(0,0);
    tick(25);
    const fixed = origin.x === threads.weave.at.x && origin.y === threads.weave.at.y;
    tick(90);
    return {fixed, moved: p.x > origin.x + 84, escaped: !threads.holds(p)};
  })()`);
  assert.deepEqual(dodged, {fixed: true, moved: true, escaped: true});
});

test('나루의 아홉 실내가 기본 행동 버튼으로 열리고 원본 크기 배경과 투명 가구를 그린다', { timeout: 90000 }, async () => {
  await load('ferry-village&companion=none');
  const results = await evaluate(`(async () => {
    const game = window.__game, s = game.scene.getScene('game');
    let time = performance.now();
    const step = () => game.headlessStep(time += 16, 16);
    async function useDoor(spot, offsetY, action, target) {
      s.player.placeAt(spot.x, spot.y + offsetY);
      step();
      if (s.attackButton.text.text !== action) throw Error(spot.id + ': ' + s.attackButton.text.text);
      s.attackButton.pressed = true;
      for (let i = 0; i < 400; i++) {
        step();
        if (s.mapId === target && s.sys.isActive() && s.minimap?.title.text === s.map.name) {
          step();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 8));
      }
      throw Error('지도 이동 시간 초과: ' + target);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const results = [];
    for (const door of s.map.interactables) {
      await useDoor(door, 0, '들어가기', door.enter.to);
      const bg = s.children.getByName('map-art-background');
      results.push({
        map: s.mapId,
        background: [bg.displayWidth, bg.displayHeight, bg.scaleX, bg.scaleY],
        safeArrival: s.walkArea.contains(s.player.x, s.player.y),
        props: s.map.props.every(p => {
          const object = s.children.getByName('village-prop-' + p.id);
          if (!object || object.texture.key !== p.texture || object.depth !== (p.depth ?? p.y)) return false;
          ctx.clearRect(0, 0, 1, 1);
          ctx.drawImage(object.texture.getSourceImage(), 0, 0);
          if (ctx.getImageData(0, 0, 1, 1).data[3] !== 0) return false;
          return !p.footprint || !s.walkArea.contains(p.x, p.y + p.footprint.offsetY);
        }),
      });
      await useDoor(s.map.interactables[0], -10, '나가기', 'ferry-village');
      results.at(-1).returned = s.walkArea.contains(s.player.x, s.player.y);
    }
    return results;
  })()`, 85000);
  assert.equal(results.length, 9);
  for (const room of results) {
    assert.deepEqual(room.background, [1536, 1024, 1, 1], room.map);
    assert.ok(room.safeArrival && room.props && room.returned, room.map);
  }
});

test('나루의 후반부 원화와 늪 마물의 잠복·출현을 재생한다', { timeout: 120000 }, async () => {
  await load('east-stream&npcs=all&actor=bell-ringer&action=caught&companion=none');
  const actions = await evaluate(`(() => {
    const scene = window.__game.scene.getScene('game');
    const groups = {
      evan: ['riverbank', 'defense', 'oar-swing', 'rowing', 'mooring', 'rope-pull', 'cocoon-guard', 'reunion'],
      morgan: ['pole-row', 'work', 'bell-ring', 'confession'],
      marta: ['bell-repair', 'wax-earplugs'], finn: ['kite-flight'], 'mill-apprentice': ['bell-strike'],
    };
    const missing = [];
    for (const [id, names] of Object.entries(groups)) {
      const npc = scene.npcs.find(n => n.def.id === id);
      for (const name of names) {
        if (!npc.setStoryAction(name) || npc.figure.texture.key !== 'npc-' + id + '-' + name) missing.push([id, name]);
      }
    }
    const caught = scene.npcs.find(n => n.def.id === 'bell-ringer').figure.texture.key;
    return { missing, caught };
  })()`);
  assert.deepEqual(actions, { missing: [], caught: 'npc-bell-ringer-caught' });

  for (const [group, count, first] of [['rescue', 4, 'cocoon-asleep'], ['bell-carry', 1, 'carry-step-1']]) {
    await load('east-stream&companion=none&npcs=' + group);
    const found = await evaluate(`window.__game.scene.getScene('game').children.list
      .filter(o => o.texture?.key.startsWith('../assets/chapter2/'))
      .map(o => [o.frame.name, o.texture.getFrameNames().length])`);
    assert.equal(found.length, count);
    assert(found.every(([name, size]) => name === first && size > 1), JSON.stringify(found));
  }

  await load('reed-swamp&companion=none');
  const swamp = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game');
    const enemy = s.enemies.find(e => e.kind === 'swamp-lurker');
    const c = enemy.character, sprite = c.sprite;
    const tick = (dt) => { s.now += dt * 1000; enemy.update(s.now, dt, s.player, s.walkArea, s.nav, () => false); };
    s.player.placeAt(c.x - 1000, c.y);
    tick(0); tick(.5);
    const hidden = [sprite.image.frame.name, enemy.untouchable, c.levelTagText.visible];
    s.player.placeAt(c.x - 100, c.y);
    tick(0);
    const emerge = sprite.image.texture.key;
    tick(.5);
    return { hidden, emerge, ready: enemy.state, frame: sprite.image.texture.key };
  })()`);
  assert.deepEqual(swamp.hidden, ['burrow-hidden', true, false]);
  assert.equal(swamp.emerge, 'monster-swamp-lurker-emerge');
  assert.equal(swamp.ready, 'chase');
  assert.match(swamp.frame, /^monster-swamp-lurker-walk_/);
});

test('1장 신규 시트: 시아의 매듭 대화와 개울가 전투에서 각 동작을 재생한다', { timeout: 120000 }, async () => {
  await load('village-north&companion=none');
  const knot = await evaluate(`(() => {
    const scene = window.__game.scene.getScene('game');
    scene.quests = { 'sia-knot': {status: 'active', count: 0, step: 0} };
    const sia = scene.npcs.find(n => n.def.id === 'sia');
    scene.openDialogue(sia.spot);
    const frames = new Set();
    while (scene.dialogue.isOpen) {
      if (sia.figure.texture.key === 'npc-sia-knot') frames.add(sia.figure.frame.name);
      scene.dialogue.advance();
    }
    const result = { frames: [...frames], step: scene.quests['sia-knot'].step, idle: !sia.currentStoryAction };
    localStorage.removeItem('untitled-rpg.quests');
    return result;
  })()`);
  assert.deepEqual(knot, { frames: ['take-cord', 'first-wrap', 'second-wrap', 'finish-knot'], step: 1, idle: true });

  await load('east-stream&companion=none');
  const stream = await evaluate(`(() => {
    const s = window.__game.scene.getScene('game'), p = s.player;
    const fairy = s.enemies.find(e => e.kind === 'blink-fairy');
    const stone = s.enemies.find(e => e.kind === 'stone-sentry');
    const tick = (e, t, dt = .016) => e.update(t, dt, p, s.walkArea, s.nav, () => false);
    p.placeAt(fairy.character.x - 100, fairy.character.y);
    const left = fairy.character.x;
    const fairyFrames = new Set();
    const remember = () => fairyFrames.add(fairy.character.sprite.image.frame.name);
    fairy.onHit(1000, s.walkArea, p); remember();
    for (const offset of [120, 240, 300, 380]) { tick(fairy, 1000 + offset); remember(); }
    const moved = fairy.character.x > left && s.walkArea.contains(fairy.character.x, fairy.character.y);
    tick(fairy, 1600);
    const visible = !fairy.untouchable && fairy.character.sprite.image.frame.name.startsWith('walk-');
    fairy.onHit(1610, s.walkArea, p);
    const cooldown = !fairy.untouchable;
    p.placeAt(stone.character.x - 800, stone.character.y);
    const home = { x: stone.character.x, y: stone.character.y };
    let min = home.x, max = home.x, patrolled = false;
    for (let i = 0; i < 600; i++) {
      tick(stone, 2000 + i * 30, .03);
      min = Math.min(min, stone.character.x); max = Math.max(max, stone.character.x);
      patrolled ||= /^walk-(left|right)-[123]$/.test(stone.character.sprite.image.frame.name);
    }
    p.placeAt(stone.character.x - 68, stone.character.y);
    const stoneFrames = new Set();
    for (let i = 0; i < 60; i++) {
      tick(stone, 20010 + i * 30, .03);
      stoneFrames.add(stone.character.sprite.image.frame.name);
    }
    return { fairyFrames: [...fairyFrames], moved, visible, cooldown, patrolled,
      route: min >= home.x - 94 && min < home.x - 65 && max <= home.x + 94 && max > home.x + 65,
      strike: stoneFrames.has('attack-left-2') };
  })()`);
  assert.deepEqual(stream.fairyFrames, ['blink-ready', 'blink-break', 'blink-trace', 'blink-return']);
  for (const key of ['moved', 'visible', 'cooldown', 'patrolled', 'route', 'strike']) assert.equal(stream[key], true, key);
});
