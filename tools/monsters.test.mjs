import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { MAPS } from '../src/world/maps.ts';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../src/config.ts';
import { INTERIORS } from '../src/world/interiors.ts';
import { MONSTERS, monsterKind, enemyHitReaches } from '../src/combat/monsterTypes.ts';
import { recordEvent } from '../src/story/quests.ts';

test('남쪽 들판은 슬라임·버섯, 서쪽 숲길은 버섯·도마뱀이 함께 나온다', () => {
  for (const [map, kinds] of [['south-field', ['slime', 'waterdrop-mushroom']], ['west-forest', ['waterdrop-mushroom', 'iron-scale-lizard']]]) {
    assert.deepEqual(new Set(MAPS[map].enemies.map(s => monsterKind(s.key))), new Set(kinds));
  }
});

test('방향별 몬스터 시트에는 실사용 WebP와 프레임 좌표가 있다', () => {
  for (const kind of Object.keys(MONSTERS)) {
    if (kind === 'river-fish-hunter') continue;
    const foundry = kind === 'foundry-waterdrop-mushroom';
    const base = new URL(`../src/assets/monsters/${foundry ? 'waterdrop-mushroom' : kind}/`, import.meta.url);
    const root = foundry ? new URL(`../src/assets/chapter2/${kind}/`, import.meta.url) : base;
    const data = JSON.parse(readFileSync(new URL('animation_frames.json', base)));
    const actions = ['walk', 'attack'];
    assert.equal(data.frames.length, actions.length * 32, kind);
    for (const sheet of Object.keys(data.sheets)) assert.ok(existsSync(new URL(sheet.replace('.png', '.webp'), root)));
    for (const direction of ['down', 'left', 'right', 'up', 'down-left', 'down-right', 'up-left', 'up-right']) {
      for (const action of actions) for (let pose = 0; pose < 4; pose++) {
        assert.ok(data.frames.some(f => f.name === `${action}-${direction}-${pose}`));
      }
    }
  }
});

test('주물터 버섯은 보라색 발사체를 쓰고 나루 물 마물에는 수면·공격 시트가 있다', () => {
  const chapter = new URL('../src/assets/chapter2/', import.meta.url);
  assert.ok(existsSync(new URL('foundry-waterdrop-mushroom/projectile.webp', chapter)));
  const river = new URL('river-fish-hunter/', chapter);
  assert.ok(existsSync(new URL('sd_idle.webp', river)));
  for (const sheet of ['surface-idle', 'breach-attack']) {
    const { frames } = JSON.parse(readFileSync(new URL(`${sheet}-frames.json`, river)));
    assert.ok(existsSync(new URL(`${sheet}.webp`, river)));
    assert.equal(frames.length, 4);
  }
});

test('물방울·돌진의 연속 타격 범위는 중간 경로를 검사하고 옆과 뒤는 맞지 않는다', () => {
  const h = { fromX: 100, fromY: 100, toX: 200, toY: 150, radiusX: 20, radiusY: 10, dx: 1, dy: .5 };
  assert.equal(enemyHitReaches(h, 150, 125), true);
  assert.equal(enemyHitReaches(h, 150, 160), false);
  assert.equal(enemyHitReaches(h, 70, 85), false);
  assert.equal(enemyHitReaches({ ...h, toX: 100, toY: 100 }, 100, 100), true);
  assert.equal(enemyHitReaches({ ...h, toX: 100, toY: 100 }, 121, 100), false);
});

test('혼합 사냥터에서도 슬라임 전용 의뢰는 버섯·도마뱀·습격 권속을 세지 않는다', () => {
  const state = { 'ruan-field': { status: 'active', count: 0 }, 'doran-gel': { status: 'active', count: 0 }, 'ruan-forest': { status: 'active', count: 0 } };
  for (const monster of ['waterdrop-mushroom', 'iron-scale-lizard']) {
    assert.equal(recordEvent(state, { type: 'kill', map: 'south-field', monster }).updates.length, 0);
    const forest = recordEvent(state, { type: 'kill', map: 'west-forest', monster });
    assert.deepEqual(forest.updates.map(u => u.quest.id), ['ruan-forest']);
  }
  assert.equal(recordEvent(state, { type: 'kill', map: 'village', encounter: 'village-raid' }).updates.length, 0);
  assert.equal(recordEvent(state, { type: 'kill', map: 'south-field', monster: 'slime' }).state['ruan-field'].count, 1);
});


test('사냥터는 정해진 마릿수와 야외·실내의 월드 크기를 유지한다', () => {
  assert.deepEqual([WORLD_WIDTH, WORLD_HEIGHT], [3432, 2288]);
  for (const id of ['south-field', 'west-forest', 'east-stream']) {
    const counts = {};
    for (const enemy of MAPS[id].enemies) {
      const kind = monsterKind(enemy.key);
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    if (id === 'east-stream') assert.deepEqual(counts, { slime: 5, 'blink-fairy': 2, 'stone-sentry': 1 });
    else assert.ok(Object.values(counts).every(count => count === 5), id);
    assert.ok(MAPS[id].bounds.right > 2400 && MAPS[id].bounds.bottom > 1600, id);
  }
  for(const id of ['village','village-north']) {
    assert.ok(MAPS[id].bounds.right > 2336 && MAPS[id].bounds.bottom > 1560);
  }
  const original = {home:1000,linea:900,chief:1100,clinic:1100,hall:1200,store:1000,smithy:1100,inn:1400};
  for(const interior of INTERIORS) assert.equal(interior.width, original[interior.id]);
});

test('서리 딱정벌레의 얼음 껍질은 정면 공격만 막고, 옆·뒤와 반격은 막지 못한다', async () => {
  const { shellBlocks, FROST_SHELL } = await import('../src/combat/monsterTypes.ts');
  const facingRight = { x: 1, y: 0 };
  assert.equal(shellBlocks('frost-beetle', facingRight, 100, 0), true, '정면');
  assert.equal(shellBlocks('frost-beetle', facingRight, 100, 40), true, '정면 조금 비스듬히');
  assert.equal(shellBlocks('frost-beetle', facingRight, 0, 100), false, '옆');
  assert.equal(shellBlocks('frost-beetle', facingRight, -100, 0), false, '뒤');
  assert.equal(shellBlocks('frost-beetle', facingRight, 100, 0, true), false, '패링·저스트 회피 뒤의 반격은 뚫는다');
  assert.equal(shellBlocks('iron-scale-lizard', facingRight, 100, 0), false, '다른 몬스터는 껍질이 없다');
  assert.ok(FROST_SHELL.frontDegrees > 0 && FROST_SHELL.frontDegrees < 90);
  assert.ok(MONSTERS['frost-beetle'].speed < MONSTERS.slime.speed, '느리다');
});
