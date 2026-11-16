import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { MAPS } from '../src/world/maps.ts';
import { WORLD_WIDTH, WORLD_HEIGHT, MAP_SIZE_SCALE } from '../src/config.ts';
import { INTERIORS } from '../src/world/interiors.ts';
import { MONSTERS, monsterKind, enemyHitReaches } from '../src/combat/monsterTypes.ts';
import { recordEvent } from '../src/story/quests.ts';

test('남쪽 들판은 슬라임·버섯, 서쪽 숲길은 버섯·도마뱀이 함께 나온다', () => {
  for (const [map, kinds] of [['south-field', ['slime', 'waterdrop-mushroom']], ['west-forest', ['waterdrop-mushroom', 'iron-scale-lizard']]]) {
    assert.deepEqual(new Set(MAPS[map].enemies.map(s => monsterKind(s.key))), new Set(kinds));
  }
});

test('모든 몬스터의 모든 방향·모션에 실사용 WebP와 프레임 좌표가 있다 (잿빛 나방은 이동 그림으로 공격한다)', () => {
  for (const kind of Object.keys(MONSTERS)) {
    const root = new URL(`../src/assets/monsters/${kind}/`, import.meta.url);
    const data = JSON.parse(readFileSync(new URL('animation_frames.json', root)));
    const actions = kind === 'ashen-moth' ? ['walk'] : ['walk', 'attack'];
    assert.equal(data.frames.length, actions.length * 32, kind);
    for (const sheet of Object.keys(data.sheets)) assert.ok(existsSync(new URL(sheet.replace('.png', '.webp'), root)));
    for (const direction of ['down', 'left', 'right', 'up', 'down-left', 'down-right', 'up-left', 'up-right']) {
      for (const action of actions) for (let pose = 0; pose < 4; pose++) {
        assert.ok(data.frames.some(f => f.name === `${action}-${direction}-${pose}`));
      }
    }
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


test('사냥터는 종류별 다섯 마리이며 야외·실내 바닥은 확장된 크기를 사용한다', () => {
  assert.equal(MAP_SIZE_SCALE, 1.1);
  assert.deepEqual([WORLD_WIDTH, WORLD_HEIGHT], [2640, 1760]);
  for (const id of ['south-field', 'west-forest', 'east-stream']) {
    const counts = {};
    for (const enemy of MAPS[id].enemies) {
      const kind = monsterKind(enemy.key);
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    assert.ok(Object.values(counts).every(count => count === 5), id);
    assert.ok(MAPS[id].bounds.right > 2400 && MAPS[id].bounds.bottom > 1600, id);
  }
  for(const id of ['village','village-north']) {
    assert.ok(MAPS[id].bounds.right > 2336 && MAPS[id].bounds.bottom > 1560);
  }
  const original = {home:1000,linea:900,chief:1100,clinic:1100,hall:1200,store:1000,smithy:1100,inn:1400};
  for(const interior of INTERIORS) assert.equal(interior.width, original[interior.id] * MAP_SIZE_SCALE);
});
