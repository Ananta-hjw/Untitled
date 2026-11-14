import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { DIALOGUES } from '../src/story/dialogues.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { BUILDINGS, PLAYER_SPAWN } from '../src/world/villageLayout.ts';
import { NPCS, direction8, pickWanderTarget, wanderPauseMs } from '../src/world/npcs.ts';

const village = MAPS.village;
const characters = new URL('../src/assets/characters/', import.meta.url);

test('마을 사람은 열한 명이고, 이름과 대사·그림이 연결되어 있다', () => {
  assert.equal(NPCS.length, 11);
  assert.equal(new Set(NPCS.map((n) => n.id)).size, NPCS.length);
  assert.equal(village.npcs, NPCS);
  assert.equal(NPCS.some((n) => n.id === 'fern'), false, '페른은 첫날 없다');
  for (const npc of NPCS) {
    const lines = DIALOGUES[npc.dialogue];
    assert.ok(lines?.length, npc.id);
    // 대화창의 이름과 그림이 그 사람의 것이다.
    const own = lines.filter((l) => l.portrait === npc.id);
    assert.ok(own.length > 0, `${npc.id} speaks`);
    for (const line of own) assert.equal(line.speaker, npc.name, npc.id);
    assert.ok(existsSync(new URL(`${npc.id}/dialogue-768.webp`, characters)), `${npc.id} portrait`);
  }
});

test('장사하는 사람은 걷지 않고, 나머지는 모두 돌아다니며, 모두 8방향 걷기 그림이 있다', () => {
  const shops = NPCS.filter((n) => n.shop).map((n) => n.id).sort();
  assert.deepEqual(shops, ['doran', 'merina', 'rosetta']);
  for (const npc of NPCS) assert.equal(npc.wander === undefined, !!npc.shop, npc.id);
  for (const { id } of NPCS) {
    const data = JSON.parse(readFileSync(new URL(`${id}/walk_frames.json`, characters)));
    for (const dir of ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left']) {
      for (const pose of [data.idlePose, ...data.walkPoses]) {
        assert.ok(data.frames.some((f) => f.name === `${dir}-${pose}`), `${id} ${dir}-${pose}`);
      }
    }
    for (const sheet of ['walk_cardinal', 'walk_diagonal']) assert.ok(existsSync(new URL(`${id}/${sheet}-60.webp`, characters)), `${id} ${sheet}`);
  }
});

test('마을 사람은 걸을 수 있는 곳에 서 있고, 출구·문·시작점을 막지 않는다', () => {
  for (const npc of NPCS) {
    assert.equal(walkable(village, npc.x, npc.y), true, npc.id);
    assert.equal(findExit(village, npc.x, npc.y), undefined, npc.id);
    assert.ok(Math.hypot(npc.x - PLAYER_SPAWN.x, npc.y - PLAYER_SPAWN.y) > 110, `${npc.id} on spawn`);
    for (const b of BUILDINGS) assert.ok(Math.hypot(npc.x - b.door.x, npc.y - b.door.y) > 50, `${npc.id} at ${b.frame} door`);
  }
  for (let i = 0; i < NPCS.length; i++) {
    for (let j = i + 1; j < NPCS.length; j++) {
      assert.ok(Math.hypot(NPCS[i].x - NPCS[j].x, NPCS[i].y - NPCS[j].y) > 90, `${NPCS[i].id} / ${NPCS[j].id}`);
    }
  }
});

test('돌아다닐 곳은 반지름 안의 걸을 수 있는 곳이고, 없으면 제자리로 돌아간다', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const npc of NPCS.filter((n) => n.wander)) {
    for (let i = 0; i < 50; i++) {
      const t = pickWanderTarget(npc, npc.wander, rand, (x, y) => walkable(village, x, y) && !findExit(village, x, y));
      assert.equal(walkable(village, t.x, t.y), true, npc.id);
      assert.ok(Math.hypot(t.x - npc.x, t.y - npc.y) <= npc.wander + 1, npc.id);
    }
  }
  assert.deepEqual(pickWanderTarget({ x: 5, y: 6 }, 100, rand, () => false), { x: 5, y: 6 });
  for (let i = 0; i < 20; i++) {
    const ms = wanderPauseMs(rand);
    assert.ok(ms >= 1500 && ms <= 4000);
  }
});

test('이동 방향을 8방향 그림 중 가장 가까운 것으로 고른다', () => {
  assert.equal(direction8(1, 0), 'right');
  assert.equal(direction8(0, 1), 'down');
  assert.equal(direction8(-1, 0), 'left');
  assert.equal(direction8(0, -1), 'up');
  assert.equal(direction8(1, 1), 'down-right');
  assert.equal(direction8(-1, -1), 'up-left');
  assert.equal(direction8(-1, 0.3), 'left');
  assert.equal(direction8(0, 0, 'up-right'), 'up-right');
});
