import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterNpcs } from '../src/story/chapterOne.ts';
import { QUESTS, continueMainQuest } from '../src/story/quests.ts';
import { MAPS, walkable } from '../src/world/maps.ts';

const through = id => {
  const state = {};
  for (const q of QUESTS.filter(q => q.main)) {
    state[q.id] = { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need,
      ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    if (q.id === id) break;
  }
  return continueMainQuest(state);
};

test('에일라는 구조 전에는 응급 약품을 준비하고, 구조 뒤에는 환자가 있는 실내 한 곳에서만 치료한다', () => {
  const raid = step => ({ ...through('festival-eve'), 'village-raid': { status: 'active', step, count: 0 } });
  const early = chapterNpcs(MAPS.village.npcs, raid(4), 'village').find(n => n.id === 'eila');
  assert.equal(early.storyAction, 'mix-herbs');
  for (const [state, room, action] of [[raid(5), 'in-clinic', 'treat-left'],
    [through('village-raid'), 'in-clinic', 'treat-left'], [through('first-sword'), 'in-linea', 'treat-right']]) {
    const all = Object.entries(MAPS).flatMap(([map, data]) => chapterNpcs(data.npcs, state, map).filter(n => n.id === 'eila').map(n => ({ ...n, map })));
    assert.equal(all.length, 1); assert.equal(all[0].map, room);
    const e = all[0], patient = chapterNpcs(MAPS[room].npcs, state, room).find(n => n.id === 'linea');
    assert.equal(e.duty[0].action, action);
    assert.equal(e.duty[1].action, 'mix-herbs');
    assert.ok(e.duty[0].durationMs >= e.duty[1].durationMs * 3, '치료가 준비보다 길다');
    assert.deepEqual([e.x, e.y], [e.duty[0].x, e.duty[0].y]);
    assert.ok(Math.hypot(patient.x + patient.talkOffsetX - e.x, patient.y + patient.talkOffset - e.y) > 60, '환자와 대화하는 자리를 비운다');
    for (let i = 0; i < e.duty.length; i++) {
      const from = e.duty[i], to = e.duty[(i + 1) % e.duty.length];
      for (let sample = 0; sample <= 40; sample++) {
        assert.equal(walkable(MAPS[room], from.x + (to.x - from.x) * sample / 40,
          from.y + (to.y - from.y) * sample / 40), true, `${room}: 침대·책상·벽을 통과하지 않는다`);
      }
    }
  }
});
