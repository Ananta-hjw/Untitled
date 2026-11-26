import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterNpcs } from '../src/story/chapterOne.ts';
import { QUESTS, continueMainQuest } from '../src/story/quests.ts';
import { MAPS, walkable } from '../src/world/maps.ts';
import { npcExitPath } from '../src/world/npcExitPath.ts';

const through = id => {
  const state = {};
  for (const q of QUESTS.filter(q => q.main)) {
    state[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need,
      ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    if (q.id === id) break;
  }
  return continueMainQuest(state);
};

test('세레나는 구조 전 물수건을 준비하고, 구조 뒤에는 리네아와 같은 방에서 간호한다', () => {
  const raid = step => ({ ...through('festival-eve'), 'village-raid': { status: 'active', step, count: 0 } });
  assert.equal(chapterNpcs(MAPS['in-clinic'].npcs, raid(4), 'in-clinic').find(n => n.id === 'serena').storyAction, 'wring-cloth');
  for (const [state, room, action] of [[raid(5), 'in-clinic', 'nurse-left'],
    [through('village-raid'), 'in-clinic', 'nurse-left'], [through('first-sword'), 'in-linea', 'nurse-right']]) {
    const all = Object.entries(MAPS).flatMap(([map, data]) => chapterNpcs(data.npcs, state, map).filter(n => n.id === 'serena').map(n => ({ ...n, map })));
    assert.equal(all.length, 1); assert.equal(all[0].map, room);
    const n = all[0], people = chapterNpcs(MAPS[room].npcs, state, room);
    const patient = people.find(n => n.id === 'linea'), eila = people.find(n => n.id === 'eila');
    assert.equal(n.duty[0].action, action);
    assert.deepEqual([n.x, n.y], [n.duty[0].x, n.duty[0].y]);
    assert.equal(n.duty.find(p => p.action === 'wring-cloth').durationMs, 5000);
    assert.ok(n.duty[0].durationMs >= 30000);
    assert.ok(Math.hypot(n.x - patient.x, n.y - patient.y) < 180, '병상 가까이에서 간호한다');
    assert.ok(Math.hypot(n.x - eila.x, n.y - eila.y) > 60, '에일라의 치료 자리를 비운다');
    assert.ok(Math.hypot(n.x - patient.x - patient.talkOffsetX, n.y - patient.y - patient.talkOffset) > 100, '리네아와 대화하는 자리를 비운다');
    for (let i = 0; i < n.duty.length; i++) {
      const from = n.duty[i], to = n.duty[(i + 1) % n.duty.length];
      for (let sample = 0; sample <= 60; sample++) assert.equal(walkable(MAPS[room],
        from.x + (to.x - from.x) * sample / 60, from.y + (to.y - from.y) * sample / 60), true, `${room}: 침대를 가로지르지 않는다`);
    }
  }
});

test('세레나의 대피 경로는 북쪽 출입구 안으로 이어지며 장애물을 통과하지 않는다', () => {
  const state = { ...through('festival-eve'), 'village-raid': { status: 'active', step: 3, count: 0 } };
  const map = MAPS.village, n = chapterNpcs(map.npcs, state, 'village').find(n => n.id === 'serena');
  const exit = map.exits.find(e => e.to === 'village-north');
  const target = { x: (exit.zone.left + exit.zone.right) / 2, y: exit.zone.bottom - 20 };
  const route = npcExitPath(n, target, map.bounds, (x, y) => walkable(map, x, y));
  assert.ok(route.length > 0); assert.deepEqual(route.at(-1), target);
  for (const [i, to] of route.entries()) {
    const from = i ? route[i - 1] : n, samples = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 3);
    for (let s = 0; s <= samples; s++) assert.equal(walkable(map, from.x + (to.x - from.x) * s / samples,
      from.y + (to.y - from.y) * s / samples), true);
  }
});

test('대피 경로는 막힌 길을 돌아가며 완전히 막힌 경우 순간이동 경로를 만들지 않는다', () => {
  const bounds = { left: 0, top: 0, right: 200, bottom: 160 };
  const start = { x: 20, y: 80 }, target = { x: 180, y: 80 };
  const open = (x, y) => x >= 0 && x < 200 && y >= 0 && y < 160 && !(x >= 90 && x <= 110 && y < 120);
  const path = npcExitPath(start, target, bounds, open);
  assert.ok(path.length > 1); assert.ok(path.some(p => p.y >= 120));
  assert.deepEqual(npcExitPath(start, target, bounds, (x, y) => open(x, y) && !(x >= 90 && x <= 110)), []);
});
