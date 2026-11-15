import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUESTS, markerFor, parseQuests, recordEvent, serializeQuests, talkTo, trackedQuests,
} from '../src/story/quests.ts';
import { NPCS } from '../src/world/npcs.ts';
import { MAPS } from '../src/world/maps.ts';

const names = Object.fromEntries(NPCS.map((n) => [n.id, n.name]));

test('퀘스트는 마을 사람이 주고, 대사의 화자와 그림이 그 사람이다', () => {
  assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
  for (const q of QUESTS) {
    assert.ok(names[q.giver], q.id);
    if (q.requires) assert.ok(QUESTS.some((r) => r.id === q.requires), q.id);
    if (q.objective.map) assert.ok(MAPS[q.objective.map], q.id);
    if (q.objective.event === 'talk') assert.ok(names[q.objective.npc] && q.target?.length, q.id);
    assert.ok(q.objective.need > 0 && q.rewardXp > 0, q.id);
    for (const l of [...q.offer, ...q.reminder, ...q.done, ...(q.target ?? [])]) {
      if (l.portrait !== 'hero-neutral') assert.equal(l.speaker, names[l.portrait], `${q.id}: ${l.text}`);
    }
  }
});

test('루안의 수련은 순서대로 열리고, 표시는 ! → … → ? → 다음 ! 로 바뀐다', () => {
  let state = {};
  assert.equal(markerFor('ruan', state), 'new');
  let r = talkTo('ruan', state);
  assert.equal(r.accepted.id, 'ruan-training');
  state = r.state;
  assert.equal(markerFor('ruan', state), 'progress');
  assert.deepEqual(talkTo('ruan', state).lines, QUESTS[0].reminder);
  for (let i = 0; i < 3; i++) state = recordEvent(state, { type: 'finisher' }).state;
  assert.equal(state['ruan-training'].status, 'ready');
  assert.equal(markerFor('ruan', state), 'ready');
  r = talkTo('ruan', state);
  assert.equal(r.completed.id, 'ruan-training');
  state = r.state;
  assert.equal(markerFor('ruan', state), 'new');
  assert.equal(talkTo('ruan', state).accepted.id, 'ruan-field');
});

test('처치는 정해진 맵에서만 세고, 맵을 가리지 않는 퀘스트는 어디서든 센다', () => {
  let state = { 'ruan-field': { status: 'active', count: 0 }, 'doran-gel': { status: 'active', count: 0 } };
  const forest = recordEvent(state, { type: 'kill', map: 'west-forest' });
  assert.equal(forest.state['ruan-field'].count, 0);
  assert.equal(forest.state['doran-gel'].count, 1);
  assert.deepEqual(forest.updates.map((u) => u.quest.id), ['doran-gel']);
  state = forest.state;
  for (let i = 0; i < 6; i++) state = recordEvent(state, { type: 'kill', map: 'south-field' }).state;
  assert.deepEqual(state['ruan-field'], { status: 'ready', count: 5 });
  assert.deepEqual(state['doran-gel'], { status: 'ready', count: 5 });
  // 완료를 기다리는 퀘스트는 더 세지 않는다.
  assert.equal(recordEvent(state, { type: 'kill', map: 'south-field' }).updates.length, 0);
});

test('심부름 퀘스트: 테온에게 받고, 로제타에게 말을 걸면 채워지고, 테온에게 완료한다', () => {
  let state = talkTo('teon', {}).state;
  assert.equal(markerFor('rosetta', state), 'target');
  assert.equal(markerFor('teon', state), 'progress');
  const r = talkTo('rosetta', state);
  assert.equal(r.progressed.id, 'teon-lunch');
  state = r.state;
  assert.equal(markerFor('rosetta', state), undefined);
  assert.equal(markerFor('teon', state), 'ready');
  assert.equal(talkTo('rosetta', state), undefined, '로제타는 평소 대사로 돌아간다');
  state = talkTo('teon', state).state;
  assert.equal(state['teon-lunch'].status, 'done');
  assert.equal(markerFor('teon', state), undefined);
});

test('퀘스트가 없는 사람은 표시도 퀘스트 대화도 없다', () => {
  for (const id of ['serena', 'herman', 'merina', 'vernel']) {
    assert.equal(markerFor(id, {}), undefined, id);
    assert.equal(talkTo(id, {}), undefined, id);
  }
});

test('추적 표시는 메인 퀘스트를 먼저 보여 주고 끝난 퀘스트는 뺀다', () => {
  const state = { 'doran-gel': { status: 'active', count: 2 }, 'ruan-field': { status: 'ready', count: 5 }, 'ruan-training': { status: 'done', count: 3 } };
  assert.deepEqual(trackedQuests(state).map((t) => t.quest.id), ['ruan-field', 'doran-gel']);
});

test('퀘스트 진행은 저장했다가 그대로 불러오고, 깨진 값은 버린다', () => {
  const state = { 'ruan-training': { status: 'done', count: 3 }, 'ruan-field': { status: 'active', count: 2 } };
  assert.deepEqual(parseQuests(serializeQuests(state)), state);
  assert.deepEqual(parseQuests(null), {});
  assert.deepEqual(parseQuests('{broken'), {});
  assert.deepEqual(parseQuests(JSON.stringify({ version: 99, quests: state })), {});
  const raw = JSON.stringify({ version: 1, quests: {
    'ruan-field': { status: 'active', count: 99 }, nope: { status: 'active', count: 1 },
    'doran-gel': { status: 'weird', count: 1 }, 'teon-lunch': { status: 'active', count: -1 },
  } });
  assert.deepEqual(parseQuests(raw), { 'ruan-field': { status: 'ready', count: 5 } });
});
