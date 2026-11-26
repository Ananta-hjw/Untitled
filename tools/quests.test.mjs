import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARKER_PRIORITY, QUESTS, markerFor, parseQuests, recordEvent, serializeQuests, talkTo, trackedQuests,
} from '../src/story/quests.ts';
import { NPCS } from '../src/world/npcs.ts';
import { MAPS } from '../src/world/maps.ts';
import { FERN, FERRY_PEOPLE } from '../src/story/chapterTwo.ts';

// 2장의 페른과 물안개 나루 사람들은 처음부터 있지 않고 story/chapterTwo.ts가 더한다. 도르는 동쪽 고갯길 맵의 사람이다.
const names = Object.fromEntries([...NPCS, FERN, ...FERRY_PEOPLE, ...MAPS['east-pass'].npcs].map((n) => [n.id, n.name]));

test('퀘스트는 마을 사람이 주고, 대사의 화자와 그림이 그 사람이다', () => {
  assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
  for (const q of QUESTS) {
    assert.ok(names[q.giver], q.id);
    if (q.requires) assert.ok(QUESTS.some((r) => r.id === q.requires), q.id);
    if (q.objective.map) assert.ok(MAPS[q.objective.map], q.id);
    if (q.objective.event === 'talk') assert.ok(names[q.objective.npc] && (q.target?.length || q.steps?.[0].lines?.length), q.id);
    assert.ok(q.objective.need > 0 && q.rewardXp > 0, q.id);
    for (const l of [...q.offer, ...q.reminder, ...Object.values(q.remindersByNpc ?? {}).flat(), ...q.done, ...(q.target ?? []), ...(q.steps ?? []).flatMap(o => o.lines ?? [])]) {
      if (l.portrait && l.portrait !== 'hero-neutral') assert.equal(l.speaker, names[l.portrait], `${q.id}: ${l.text}`);
    }
  }
});

test('순찰 조사 전에는 테온 자신의 안내를 하고, 조사 후에는 정상 보고로 이어진다', () => {
  const state = { 'evening-patrol': { status: 'active', count: 0 }, 'teon-lunch': { status: 'done', count: 1 } };
  const before = talkTo('teon', state);
  assert.ok(before.lines.length);
  assert.ok(before.lines.every(l => l.speaker === '테온' && l.portrait === 'teon'));
  assert.deepEqual(before.state, state);
  assert.equal(before.completed, undefined);
  assert.equal(talkTo('herman', state).lines[0].speaker, '헤르만');
  const inspected = recordEvent(state, { type: 'inspect', map: 'village', spot: 'south-watch' });
  const report = talkTo('teon', inspected.state);
  assert.equal(report.completed.id, 'evening-patrol');
  assert.equal(report.next.id, 'moth-trail');
  assert.ok(report.lines.some(l => l.portrait === 'teon'));
  assert.ok(report.lines.every(l => l.portrait !== 'herman'));
});

test('다른 보고 대상에게 의뢰인 전용 안내를 대신 말하게 하지 않는다', () => {
  for (const q of QUESTS.filter(q => q.turnIn && q.turnIn !== q.giver && !q.remindersByNpc?.[q.turnIn])) {
    // 앞선 메인과 서브는 끝낸 상태로 두고 보고 전에만 말을 건다.
    const state = Object.fromEntries(QUESTS.map(def => [def.id, { status: 'done', count: 1 }]));
    state[q.id] = { status: 'active', count: 0 };
    if ((q.steps?.[0] ?? q.objective).event === 'talk' && (q.steps?.[0] ?? q.objective).npc === q.turnIn) continue;
    assert.equal(talkTo(q.turnIn, state), undefined, q.id);
  }
});

test('루안의 수련은 순서대로 열리고, 완료하면 다음 메인이 자동으로 이어진다', () => {
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
  assert.equal(markerFor('ruan', state), 'progress');
  assert.equal(r.next.id, 'ruan-dodge');
  assert.deepEqual(state['ruan-dodge'], { status: 'active', count: 0 });
});

test('초반 전투 수련은 공격 → 회피 → 막기 → (들판) → 물약(에일라) → 공명(베르넬) 순서로 하나씩 이어지고, 숲 퀘스트로 넘어간다', () => {
  let state = { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'active', count: 0 } };
  const step = (event, n = 1) => { for (let i = 0; i < n; i++) state = recordEvent(state, event).state; };
  const talk = (npc) => { const r = talkTo(npc, state); state = r.state; return r; };
  step({ type: 'dodge' }, 3);
  assert.equal(talk('ruan').next.id, 'ruan-parry');
  step({ type: 'parry' }, 2);
  assert.equal(talk('ruan').next.id, 'ruan-field');
  step({ type: 'kill', map: 'south-field', monster: 'slime' }, 5);
  const field = talk('ruan');
  assert.equal(field.next.id, 'eila-potion');
  assert.equal(markerFor('eila', state), 'target', '에일라에게 가라는 표시');
  assert.equal(talk('eila').progressed.id, 'eila-potion');
  assert.equal(state['eila-potion'].step, 1);
  step({ type: 'item' });
  assert.equal(state['eila-potion'].status, 'ready');
  const potion = talk('eila');
  assert.equal(potion.completed.id, 'eila-potion');
  assert.deepEqual(potion.completed.rewardItems, [{ id: 'potion', count: 2 }]);
  assert.equal(potion.next.id, 'vernel-resonance');
  assert.ok(potion.lines.at(-1).speaker === '에일라', '다음 수련은 에일라가 이어서 안내한다');
  talk('vernel');
  assert.equal(state['vernel-resonance'].step, 1);
  step({ type: 'resonance' });
  const resonance = talk('ruan');
  assert.equal(resonance.completed.id, 'vernel-resonance');
  assert.equal(resonance.next.id, 'ruan-forest');
  for (const id of ['ruan-training', 'ruan-dodge', 'ruan-parry', 'eila-potion', 'vernel-resonance']) assert.equal(QUESTS.find((q) => q.id === id).tutorial, true, id);
});

test('수련을 넣기 전의 저장: 이미 그 뒤의 메인 퀘스트를 하고 있으면 수련은 끝낸 것으로 치고 다시 끼어들지 않는다', () => {
  const old = parseQuests(JSON.stringify({ version: 1, quests: { 'ruan-training': { status: 'done', count: 3 }, 'ruan-field': { status: 'active', count: 2 } } }));
  assert.equal(old['ruan-dodge'].status, 'done');
  assert.equal(old['ruan-parry'].status, 'done');
  assert.deepEqual(old['ruan-field'], { status: 'active', count: 2 });
  assert.equal(old['eila-potion'], undefined, '아직 들판 중이면 물약 수련은 그대로 나중에 온다');
  const later = parseQuests(JSON.stringify({ version: 1, quests: { 'ruan-training': { status: 'done', count: 3 }, 'ruan-field': { status: 'done', count: 5 }, 'ruan-forest': { status: 'active', count: 1 } } }));
  for (const id of ['ruan-dodge', 'ruan-parry', 'eila-potion', 'vernel-resonance']) assert.equal(later[id].status, 'done', id);
  assert.deepEqual(later['ruan-forest'], { status: 'active', count: 1 });
  // 새 게임에서 막 회피 수련 중이면 건드리지 않는다.
  const fresh = parseQuests(JSON.stringify({ version: 1, quests: { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'active', count: 1 } } }));
  assert.deepEqual(fresh, { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'active', count: 1 } });
});

test('처치는 정해진 맵에서만 세고, 맵을 가리지 않는 퀘스트는 어디서든 센다', () => {
  let state = { 'ruan-field': { status: 'active', count: 0 }, 'doran-gel': { status: 'active', count: 0 } };
  const forest = recordEvent(state, { type: 'kill', map: 'west-forest', monster: 'slime' });
  assert.equal(forest.state['ruan-field'].count, 0);
  assert.equal(forest.state['doran-gel'].count, 1);
  assert.deepEqual(forest.updates.map((u) => u.quest.id), ['doran-gel']);
  state = forest.state;
  for (let i = 0; i < 6; i++) state = recordEvent(state, { type: 'kill', map: 'south-field', monster: 'slime' }).state;
  assert.deepEqual(state['ruan-field'], { status: 'ready', count: 5 });
  assert.deepEqual(state['doran-gel'], { status: 'ready', count: 5 });
  // 완료를 기다리는 퀘스트는 더 세지 않는다.
  assert.equal(recordEvent(state, { type: 'kill', map: 'south-field', monster: 'slime' }).updates.length, 0);
});

test('심부름 퀘스트: 테온에게 받고, 로제타에게 말을 걸면 채워지고, 테온에게 완료한다', () => {
  let state = talkTo('teon', {}).state;
  assert.equal(markerFor('rosetta', state), 'target');
  assert.equal(markerFor('teon', state), 'progress');
  const r = talkTo('rosetta', state);
  assert.equal(r.progressed.id, 'teon-lunch');
  state = r.state;
  assert.equal(markerFor('rosetta', state), undefined);
  assert.equal(markerFor('teon', state), 'sub-ready');
  assert.equal(talkTo('rosetta', state), undefined, '로제타는 평소 대사로 돌아간다');
  state = talkTo('teon', state).state;
  assert.equal(state['teon-lunch'].status, 'done');
  assert.equal(markerFor('teon', state), undefined);
});

test('메인 퀘스트는 노란 표시(new/ready), 서브 퀘스트는 초록 표시(sub-new/sub-ready)', () => {
  assert.equal(markerFor('ruan', {}), 'new');
  assert.equal(markerFor('doran', {}), 'sub-new');
  assert.equal(markerFor('teon', {}), 'sub-new');
  assert.equal(markerFor('doran', { 'doran-gel': { status: 'ready', count: 5 } }), 'sub-ready');
  assert.ok(MARKER_PRIORITY.indexOf('ready') < MARKER_PRIORITY.indexOf('sub-ready'));
  assert.ok(MARKER_PRIORITY.indexOf('sub-ready') < MARKER_PRIORITY.indexOf('new'));
  assert.ok(MARKER_PRIORITY.indexOf('new') < MARKER_PRIORITY.indexOf('sub-new'));
  assert.equal(new Set(MARKER_PRIORITY).size, 6);
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
  const state = { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'done', count: 3 }, 'ruan-parry': { status: 'done', count: 2 }, 'ruan-field': { status: 'active', count: 2 } };
  assert.deepEqual(parseQuests(serializeQuests(state)), state);
  assert.deepEqual(parseQuests(null), {});
  assert.deepEqual(parseQuests('{broken'), {});
  assert.deepEqual(parseQuests(JSON.stringify({ version: 99, quests: state })), {});
  const raw = JSON.stringify({ version: 1, quests: {
    'ruan-field': { status: 'active', count: 99 }, nope: { status: 'active', count: 1 },
    'doran-gel': { status: 'weird', count: 1 }, 'teon-lunch': { status: 'active', count: -1 },
  } });
  assert.deepEqual(parseQuests(raw), { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'done', count: 3 }, 'ruan-parry': { status: 'done', count: 2 }, 'ruan-field': { status: 'ready', count: 5 } });
});
