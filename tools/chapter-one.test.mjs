import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTS, currentObjective, continueMainQuest, markerFor, parseQuests, questDef, recordEvent, serializeQuests, talkTo, trackedQuests } from '../src/story/quests.ts';
import { DUSK_MOTH_POINTS, chapterPhase, chapterNpcs, chapterSpots, isDusk, raidSpawns } from '../src/story/chapterOne.ts';
import { NPCS } from '../src/world/npcs.ts';
import { MAPS, fieldPoint, findExit, walkable } from '../src/world/maps.ts';

const through = id => {
  const result = {};
  for (const q of QUESTS.filter(q => q.main)) {
    result[q.id] = { status: 'done', count: q.steps?.at(-1).need ?? q.objective.need, ...(q.steps ? { step: q.steps.length - 1 } : {}) };
    if (q.id === id) break;
  }
  return continueMainQuest(result);
};

test('숲 이후 보고부터 서신까지 모든 메인 목표가 순서대로 이어지고 보상은 한 번만 완료된다', () => {
  let state = through('ruan-forest');
  const completed = [];
  for (let i = 0; i < 50; i++) {
    const active = trackedQuests(state).find(t => t.quest.main);
    if (!active) break;
    const { quest, progress } = active;
    let result;
    if (progress.status === 'ready') result = talkTo(quest.turnIn ?? quest.giver, state);
    else {
      const o = currentObjective(quest, progress);
      if (o.event === 'talk') result = talkTo(o.npc, state);
      else {
        const event = o.event === 'kill' ? { type: 'kill', map: o.map, encounter: o.encounter, monster: o.monster } : { type: 'inspect', map: o.map, spot: o.spot };
        result = recordEvent(state, event);
      }
    }
    assert.ok(result && result.state !== state, quest.id);
    if (result.completed) completed.push(result.completed.id);
    state = parseQuests(serializeQuests(result.state));
  }
  assert.deepEqual(completed, ['watch-report', 'festival-supplies', 'sia-knot', 'evening-patrol', 'festival-eve', 'village-raid', 'missing-sia', 'sealed-letter']);
  assert.equal(chapterPhase(state), 'aftermath');
  assert.equal(talkTo('vernel', state), undefined, '완료 보상을 다시 받을 수 없다');
});

test('이전 버전에서 숲 퀘스트를 끝낸 저장은 다음 보고 퀘스트가 자동으로 열린다', () => {
  const state = through('ruan-forest');
  delete state['watch-report'];
  const loaded = parseQuests(JSON.stringify({ version: 1, quests: state }));
  assert.equal(loaded['watch-report'].status, 'active');
  assert.equal(markerFor('teon', loaded), 'target');
  assert.equal(loaded['ruan-forest'].status, 'done');
});

test('재료 전달과 매듭은 선행 대화를 생략할 수 없고 서브 의뢰보다 메인 대상을 먼저 처리한다', () => {
  let state = through('watch-report');
  const premature = talkTo('linea', state);
  assert.equal(premature?.state ?? state, state);
  assert.equal(premature?.completed, undefined);
  state = talkTo('rosetta', state).state;
  assert.equal(state['festival-supplies'].step, 1);
  assert.equal(markerFor('linea', state), 'target');
  state = talkTo('linea', state).state;
  assert.equal(state['sia-knot'].status, 'active');
  const skipped = talkTo('linea', state);
  assert.equal(skipped.completed, undefined);
  state = talkTo('sia', state).state;
  const knot = talkTo('linea', state);
  assert.equal(knot.completed.id, 'sia-knot');
  assert.equal(knot.state['evening-patrol'].status, 'active');
});

test('습격은 필드 슬라임으로 진행되지 않으며 남은 권속만 복원하고 시아를 숨긴다', () => {
  let state = through('festival-eve');
  assert.equal(chapterPhase(state), 'raid');
  assert.equal(raidSpawns(state, 'village').length, 3);
  assert.equal(raidSpawns(state, 'south-field').length, 0);
  for (const event of [{ type: 'kill', map: 'village' }, { type: 'kill', map: 'south-field', encounter: 'village-raid' }]) {
    assert.equal(recordEvent(state, event).updates.length, 0);
  }
  state = recordEvent(state, { type: 'kill', map: 'village', encounter: 'village-raid' }).state;
  state = parseQuests(serializeQuests(state));
  assert.equal(raidSpawns(state, 'village').length, 2);
  assert.equal(chapterNpcs(NPCS, state).some(n => n.id === 'sia'), false);
  assert.equal(chapterNpcs(NPCS, state).some(n => n.id === 'linea'), false);
  const after = through('village-raid');
  assert.equal(raidSpawns(after, 'village').length, 0);
  assert.equal(chapterNpcs(NPCS, after).some(n => n.id === 'linea'), true);
  assert.equal(chapterNpcs(NPCS, after).some(n => n.id === 'sia'), false);
});

test('수색은 맞는 장소·맵·순서에서만 진행되고 다단계 저장의 잘못된 단계는 버린다', () => {
  let state = through('village-raid');
  assert.equal(recordEvent(state, { type: 'inspect', map: 'village', spot: 'home-search' }).updates.length, 0);
  state = talkTo('serena', state).state;
  assert.equal(chapterSpots(state, 'village-north')[0].id, 'story-home-search');
  assert.equal(chapterSpots(state, 'south-field').length, 0);
  assert.equal(recordEvent(state, { type: 'inspect', map: 'south-field', spot: 'home-search' }).updates.length, 0);
  const next = recordEvent(state, { type: 'inspect', map: 'village-north', spot: 'home-search' }).state;
  assert.equal(currentObjective(questDef('missing-sia'), next['missing-sia']).npc, 'eila');
  for (const step of [-1, 99, '1', 0.5]) {
    const loaded = parseQuests(JSON.stringify({ version: 1, quests: { 'missing-sia': { status: 'active', count: 0, step } } }));
    assert.equal(loaded['missing-sia'], undefined);
  }
});

test('추가 조사 지점·습격 배치·이동한 NPC는 장애물 안에 놓이지 않는다', () => {
  const states = [through('sia-knot'), through('festival-eve'), through('village-raid')];
  states[2] = talkTo('serena', states[2]).state;
  for (const state of states) {
    for (const map of ['village', 'village-north']) {
      for (const point of [...chapterSpots(state, map), ...raidSpawns(state, map), ...chapterNpcs(MAPS[map].npcs, state, map)]) {
        assert.ok(walkable(MAPS[map], point.x, point.y), `${map}: ${JSON.stringify(point)}`);
      }
    }
  }
});

test('잿빛 나방은 해 질 무렵의 순찰을 받은 뒤부터 축제 전야 전까지만, 남쪽 들판의 걸을 수 있는 곳에 나온다', () => {
  assert.equal(isDusk(through('ruan-forest')), false, '낮에는 없다');
  assert.equal(isDusk(through('sia-knot')), true, '순찰을 받으면 해 질 무렵');
  assert.equal(isDusk(through('evening-patrol')), true, '순찰을 보고한 뒤에도 축제 전까지는 있다');
  assert.equal(isDusk(through('festival-eve')), false, '습격이 시작되면 사라진다');
  const field = MAPS['south-field'];
  for (const [x, y] of DUSK_MOTH_POINTS) {
    const p = fieldPoint(x, y);
    assert.equal(walkable(field, p.x, p.y), true, `${x},${y}`);
    assert.equal(findExit(field, p.x, p.y), undefined);
    assert.ok(Math.hypot(p.x - field.spawn.x, p.y - field.spawn.y) > 300, '들어오자마자 덮치지 않는다');
  }
});

test('에일라는 낮에는 치유소 안, 습격 때는 광장, 습격 뒤에는 마을 북쪽 리네아 곁에 있다', () => {
  const where = (state) => Object.keys(MAPS).filter((map) => chapterNpcs(MAPS[map].npcs, state, map).some((n) => n.id === 'eila'));
  const raid = { 'festival-eve': { status: 'done', count: 1 } };
  const after = { ...raid, 'village-raid': { status: 'done', count: 3 } };
  assert.deepEqual(where({}), ['in-clinic']);
  assert.deepEqual(where(raid), ['village']);
  assert.deepEqual(where(after), ['village-north']);
  const outside = chapterNpcs(MAPS['village-north'].npcs, after, 'village-north').find((n) => n.id === 'eila');
  assert.equal(outside.inside, undefined);
  assert.equal(walkable(MAPS['village-north'], outside.x, outside.y), true);
});
