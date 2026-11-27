import assert from 'node:assert/strict';
import test from 'node:test';
import { QUESTS, currentObjective, continueMainQuest, markerFor, parseQuests, questDef, recordEvent, serializeQuests, talkTo, trackedQuests } from '../src/story/quests.ts';
import { DUSK_MOTH_POINTS, RAID_WAVES, chapterCanTalk, chapterDialogue, hasDuskMoths, lineaRecovery, chapterPhase, chapterNpcs, chapterSpots, isDusk, raidSpawns, raidSpawnsAnyStep, raidWaveSize, villageSignDialogue } from '../src/story/chapterOne.ts';
import { NPCS } from '../src/world/npcs.ts';
import { guardsForMap } from '../src/world/guards.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';

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
  assert.deepEqual(completed, ['watch-report', 'festival-supplies', 'sia-knot', 'harvest-help', 'evening-patrol', 'moth-trail', 'festival-eve', 'village-raid', 'missing-sia', 'sealed-letter', 'first-sword']);
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
  assert.equal(premature?.accepted?.id, 'linea-flowers', '첫날 서브 의뢰는 받을 수 있지만');
  assert.deepEqual(premature?.state['festival-supplies'], state['festival-supplies'], '선행 대화 없이 재료 전달이 진행되지 않는다');
  assert.equal(premature?.completed, undefined);
  state = premature.state;
  assert.equal(talkTo('linea', state)?.completed, undefined);
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
  assert.equal(knot.state['harvest-help'].status, 'active');
});

test('습격은 필드 슬라임으로 진행되지 않으며 남은 권속만 복원하고 시아를 숨긴다', () => {
  let state = through('festival-eve');
  assert.equal(chapterPhase(state), 'raid');
  assert.equal(raidSpawns(state, 'village').length, 6);
  assert.equal(raidSpawns(state, 'south-field').length, 0);
  for (const event of [{ type: 'kill', map: 'village' }, { type: 'kill', map: 'south-field', encounter: 'village-raid' }]) {
    assert.equal(recordEvent(state, event).updates.length, 0);
  }
  state = recordEvent(state, { type: 'kill', map: 'village', encounter: 'village-raid' }).state;
  state = parseQuests(serializeQuests(state));
  assert.equal(raidSpawns(state, 'village').length, 5);
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
  // 습격의 각 단계(입구·여관 앞·북쪽 길·북쪽 골목)와 해 질 무렵 들판의 풀숲
  for (const step of [0, 2, 4, 5]) states.push({ ...through('festival-eve'), 'village-raid': { status: 'active', count: 0, step } });
  states.push({ ...through('evening-patrol'), 'moth-trail': { status: 'active', count: 0, step: 1 } });
  for (const state of states) {
    for (const map of ['village', 'village-north', 'south-field']) {
      for (const point of [...chapterSpots(state, map), ...raidSpawnsAnyStep(state, map), ...chapterNpcs(MAPS[map].npcs, state, map)]) {
        assert.ok(walkable(MAPS[map], point.x, point.y), `${map}: ${JSON.stringify(point)}`);
      }
    }
  }
});

test('잿빛 나방은 해 질 무렵의 순찰을 받은 뒤부터 축제 전야 전까지만, 남쪽 들판의 걸을 수 있는 곳에 나온다', () => {
  assert.equal(isDusk(through('ruan-forest')), false, '낮에는 없다');
  assert.equal(isDusk(through('sia-knot')), false, '수확제 일손을 돕는 동안은 아직 낮');
  assert.equal(isDusk(through('harvest-help')), true, '순찰을 받으면 해 질 무렵');
  assert.equal(isDusk(through('evening-patrol')), true, '순찰을 보고한 뒤에도 축제 전까지는 있다');
  assert.equal(isDusk(through('festival-eve')), false, '습격이 시작되면 사라진다');
  const field = MAPS['south-field'];
  for (const [x, y] of DUSK_MOTH_POINTS) {
    assert.equal(walkable(field, x, y), true, `${x},${y}`);
    assert.equal(findExit(field, x, y), undefined);
    assert.ok(Math.hypot(x - field.spawn.x, y - field.spawn.y) > 300, '들어오자마자 덮치지 않는다');
  }
});

test('리네아와 간호자는 습격 뒤 치유소에, 출발 전에는 리네아의 집 안에 있다', () => {
  const where = (state, id) => Object.keys(MAPS).filter(map => chapterNpcs(MAPS[map].npcs, state, map).some(n => n.id === id));
  assert.deepEqual(where({}, 'eila'), ['in-clinic']);
  assert.deepEqual(where(through('festival-eve'), 'eila'), ['village']);
  for (const id of ['linea', 'eila', 'serena']) {
    assert.deepEqual(where(through('village-raid'), id), ['in-clinic']);
    assert.deepEqual(where(through('first-sword'), id), ['in-linea']);
  }
});

test('리네아는 구조 전에는 숨고, 병상에서 깨어난 뒤 집에서 일지를 쓰며 저장으로 복원된다', () => {
  const raid = step => ({ ...through('festival-eve'), 'village-raid': { status: 'active', count: 0, step } });
  assert.equal(lineaRecovery(raid(4)), undefined);
  assert.equal(chapterNpcs(MAPS['in-clinic'].npcs, raid(4), 'in-clinic').some(n => n.id === 'linea'), false);
  for (const [state, expected, room] of [
    [raid(5), 'unconscious', 'in-clinic'], [through('village-raid'), 'unconscious', 'in-clinic'],
    [{ ...through('village-raid'), 'missing-sia': { status: 'active', count: 0, step: 2 } }, 'awake', 'in-clinic'],
    [through('missing-sia'), 'awake', 'in-clinic'], [through('first-sword'), 'journal', 'in-linea'],
  ]) {
    const loaded = parseQuests(serializeQuests(state));
    assert.equal(lineaRecovery(loaded), expected);
    const people = Object.keys(MAPS).flatMap(map => chapterNpcs(MAPS[map].npcs, loaded, map).filter(n => n.id === 'linea').map(n => ({ ...n, map })));
    assert.equal(people.length, 1);
    const n = people[0]; assert.equal(n.map, room); assert.equal(n.storyAction, expected);
    assert.equal(n.wander, undefined); assert.equal(n.shadow, false);
    assert.equal(walkable(MAPS[room], n.x, n.y), false, '환자가 누운 침대는 계속 통행을 막는다');
    assert.equal(walkable(MAPS[room], n.x + n.talkOffsetX, n.y + n.talkOffset), true, '침대를 밟지 않고 옆에서 대화한다');
    assert.equal(chapterCanTalk('linea', loaded), expected !== 'unconscious');
    if (expected === 'unconscious') assert.ok(chapterDialogue('linea', loaded).every(l => l.speaker !== '리네아'));
  }
});

test('습격이 진행되면 세레나는 안전 확인 뒤, 에일라는 북쪽 길을 막은 뒤 치유소로 옮긴다', () => {
  const at = (step) => ({ 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 0, step } });
  const where = (state, id) => Object.keys(MAPS).filter((map) => chapterNpcs(MAPS[map].npcs, state, map).some((n) => n.id === id));
  assert.deepEqual(where(at(3), 'serena'), ['village'], '안전 확인 전에는 광장');
  assert.deepEqual(where(at(4), 'serena'), ['in-clinic']);
  assert.deepEqual(where(at(4), 'eila'), ['village'], '북쪽 무리를 막기 전에는 광장에서 부상자를 살핀다');
  assert.deepEqual(where(at(5), 'eila'), ['in-clinic']);
  assert.deepEqual(where(at(6), 'eila'), ['in-clinic'], '리네아 상태를 묻는 마지막 단계도 치유소');
  const clinic = chapterNpcs(MAPS['in-clinic'].npcs, at(6), 'in-clinic');
  assert.deepEqual(clinic.map((n) => n.id).sort(), ['eila', 'linea', 'merina', 'rosetta', 'serena']);
  for (const n of clinic) assert.equal(walkable(MAPS['in-clinic'], n.x + (n.talkOffsetX ?? 0), n.y + (n.talkOffset ?? 0)), true, n.id);
  for (let i = 0; i < clinic.length; i++) for (let j = i + 1; j < clinic.length; j++) {
    assert.ok(Math.hypot(clinic[i].x - clinic[j].x, clinic[i].y - clinic[j].y) > 60, `${clinic[i].id}·${clinic[j].id} 겹침`);
  }
});

test('습격 뒤 마을 사람들은 복구·치료·경계로 맡은 자리들을 오가고, 자리와 그 사이 길은 막히지 않았다', () => {
  const after = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'done', count: 3 } };
  const clear = (map, a, b) => {
    for (let i = 0; i <= 20; i++) if (!walkable(map, a.x + (b.x - a.x) * i / 20, a.y + (b.y - a.y) * i / 20)) return false;
    return true;
  };
  const working = [];
  for (const id of ['village', 'village-north']) {
    const map = MAPS[id];
    for (const n of chapterNpcs([...map.npcs, ...guardsForMap(id)], after, id)) {
      if (!n.duty) continue;
      working.push(n.id);
      assert.deepEqual([n.x, n.y], [n.duty[0].x, n.duty[0].y], `${n.id}: 첫 자리에서 시작`);
      assert.ok(n.duty.length >= 2 && n.duty.every((p) => p.label.length > 0), n.id);
      n.duty.forEach((p, i) => {
        assert.equal(walkable(map, p.x, p.y), true, `${id} ${n.id} ${i}`);
        assert.equal(findExit(map, p.x, p.y), undefined, `${n.id} ${i}: 출구가 아니다`);
        assert.equal(clear(map, p, n.duty[(i + 1) % n.duty.length]), true, `${id} ${n.id} ${i}→다음`);
      });
    }
  }
  for (const id of ['herman', 'teon', 'vernel', 'guard-homes-west', 'guard-homes-east', 'guard-plaza-west', 'guard-plaza-east']) {
    assert.ok(working.includes(id), id);
  }
  assert.equal(working.length, new Set(working).size);
  // 습격 중과 낮에는 맡은 일이 없다.
  const raid = { 'festival-eve': { status: 'done', count: 1 } };
  assert.ok(chapterNpcs(MAPS.village.npcs, raid, 'village').every((n) => !n.duty));
  assert.ok(chapterNpcs(MAPS.village.npcs, {}, 'village').every((n) => !n.duty));
});

test('습격 때 마을 사람들은 여관·대장간이 아니라 북쪽 치유소·촌장의 집으로 피하고, 몇 명은 밖에 남는다', () => {
  const raid = { 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count: 0, step: 0 } };
  const at = (map) => chapterNpcs(MAPS[map].npcs, raid, map).filter((n) => !n.id.startsWith('guard-'));
  const ids = (map) => at(map).map((n) => n.id).sort();
  for (const map of ['in-inn', 'in-smithy', 'in-store']) assert.deepEqual(ids(map), [], `${map}은 비어 있다`);
  assert.deepEqual(ids('in-clinic'), ['merina', 'rosetta']);
  assert.deepEqual(ids('in-chief'), ['vernel']);
  assert.deepEqual(ids('village-north'), ['doran', 'herman'], '북쪽 밖에서 문을 지킨다');
  assert.deepEqual(ids('village'), ['eila', 'ruan', 'serena', 'teon'], '광장에 남아 이끄는 사람과 싸우는 사람');
  // 한 사람은 한 곳에만, 모두 그 맵의 걸을 수 있는 곳(실내는 바닥)에 선다.
  const seen = Object.keys(MAPS).flatMap((map) => at(map).map((n) => n.id));
  assert.equal(new Set(seen).size, seen.length);
  for (const map of ['in-clinic', 'in-chief', 'village-north', 'village']) {
    for (const n of at(map)) {
      assert.equal(walkable(MAPS[map], n.x, n.y), true, `${map} ${n.id}`);
      assert.equal(n.wander, undefined);
      assert.equal(n.inside, map.startsWith('in-') ? map.slice(3) : undefined, n.id);
    }
  }
});

test('습격은 입구(추적자 6) → 여관 앞(3) → 북쪽 길(추적자 4·나방 4 뒤에 보스 집행자)이고, 남은 수만 복원한다', () => {
  const at = (step, count = 0) => ({ ...through('festival-eve'), 'village-raid': { status: 'active', count, step } });
  assert.equal(raidSpawns(at(0), 'village').length, 6);
  assert.ok(raidSpawns(at(0), 'village').every(s => s.key === 'corrosion-tracker'));
  assert.equal(raidSpawns(at(0), 'village-north').length, 0);
  assert.equal(raidSpawns(at(1), 'village').length, 0, '테온과 이야기하는 동안은 적이 없다');
  assert.equal(raidSpawns(at(2, 1), 'village').length, 2);
  const north = raidSpawns(at(4), 'village-north');
  assert.deepEqual(north.map(s => s.key).sort(), [...Array(4).fill('ashen-moth'), ...Array(4).fill('corrosion-tracker')]);
  assert.equal(raidSpawns(at(4, 5), 'village-north').length, 3, '첫 떼에서 남은 수만');
  const boss = raidSpawns(at(4, 8), 'village-north');
  assert.deepEqual(boss.map(s => [s.key, s.boss]), [['corrosion-executioner', true]], '첫 떼를 다 잡으면 보스');
  assert.equal(raidSpawns(at(4, 9), 'village-north').length, 0);
  assert.equal(raidSpawns(at(4), 'village').length, 0);
  assert.equal(chapterSpots(at(5), 'village-north').some(s => s.id === 'story-north-alley'), true);
  // 퀘스트의 처치 목표 수는 무리의 크기와 같다.
  const raid = questDef('village-raid');
  for (const wave of RAID_WAVES) assert.equal(raid.steps[wave.step].need, raidWaveSize(wave.step), `step ${wave.step}`);
});

test('습격 전 첫날: 진행 단계에 맞춰 루안·리네아·시아·테온·세레나 대사가 이어지고 끝난 일을 반복하지 않는다', () => {
  assert.equal(chapterDialogue('ruan', {}), undefined, '수련 전에는 첫날 대사를 쓴다');
  const midTrain = { 'ruan-training': { status: 'done', count: 3 } };
  assert.match(chapterDialogue('ruan', midTrain)[0].text, /수련이 남았다/);
  assert.match(chapterDialogue('linea', midTrain)[0].text, /수련 잘 되고/);
  assert.equal(chapterDialogue('teon', midTrain), undefined);
  const forestDone = through('ruan-forest');
  assert.match(chapterDialogue('ruan', forestDone)[0].text, /저녁에 광장/);
  const reported = through('watch-report');
  assert.match(chapterDialogue('teon', reported)[0].text, /숲 얘기 고마워/);
  const knotted = through('sia-knot');
  assert.match(chapterDialogue('linea', knotted)[0].text, /저녁만 기다리면/);
  assert.match(chapterDialogue('sia', knotted)[0].text, /단단히 묶어/);
  const dusk = through('harvest-help');
  assert.match(chapterDialogue('serena', dusk)[0].text, /해가 기울/);
  assert.equal(hasDuskMoths(dusk), true);
  assert.equal(hasDuskMoths(through('moth-trail')), false, '나방 쫓기를 끝내면 들판 나방은 사라진다');
  assert.equal(isDusk(through('moth-trail')), true, '축제 전야까지는 노을 시간대가 이어진다');
});

test('sia-knot 완료 직후 자동 수락되는 harvest-help 대사에 헤르만이 끼어들지 않는다', () => {
  const state = { ...through('festival-supplies'), 'sia-knot': { status: 'active', count: 0, step: 1 } };
  const result = talkTo('linea', state);
  assert.equal(result.completed?.id, 'sia-knot');
  assert.equal(result.next?.id, 'harvest-help');
  assert.ok(result.lines.every(l => l.portrait !== 'herman'), '리네아 앞에서 헤르만 초상화가 나오지 않는다');
});

test('습격 중에는 1일차 서브 퀘스트가 숨고 메인 대사를 가로채지 않으며, 습격 후반 대사가 현재 위치·상태와 맞는다', () => {
  const raidReadySub = {
    ...through('festival-eve'),
    'village-raid': { status: 'active', count: 0, step: 1 },
    'teon-lunch': { status: 'ready', count: 1 },
    'doran-gel': { status: 'ready', count: 5 },
  };
  assert.equal(markerFor('teon', raidReadySub), 'target');
  assert.equal(markerFor('doran', raidReadySub), undefined);
  assert.equal(talkTo('teon', raidReadySub)?.progressed?.id, 'village-raid');
  assert.equal(talkTo('doran', raidReadySub), undefined);
  assert.deepEqual(trackedQuests(raidReadySub).map(t => t.quest.id), ['village-raid']);

  // 수습기에도 완료 대기 서브 퀘스트가 메인 대상(도란의 검)을 가로채지 않는다.
  const swordWithSub = { ...through('sealed-letter'), 'doran-gel': { status: 'ready', count: 5 } };
  assert.equal(markerFor('doran', swordWithSub), 'target');
  assert.equal(talkTo('doran', swordWithSub)?.completed?.id, 'first-sword');

  // 습격 후반(step 5~6) 치유소 에일라·세레나, 광장 루안·테온 대사 일치
  const raid5 = { ...through('festival-eve'), 'village-raid': { status: 'active', count: 0, step: 5 } };
  assert.match(chapterDialogue('eila', raid5)[0].text, /골목/);
  assert.match(chapterDialogue('serena', raid5)[0].text, /골목/);
  assert.match(chapterDialogue('ruan', raid5)[0].text, /물러난 모양/);
  assert.match(chapterDialogue('teon', raid5)[0].text, /남문은 내가/);
  assert.equal(villageSignDialogue({}), undefined);
  assert.match(villageSignDialogue(raid5)[1].text, /마을을 지키자/);
  assert.match(villageSignDialogue(through('village-raid'))[1].text, /무사히 돌아오면/);
});

test('돌아오지 않은 동생: 에일라에게 상태를 들은 뒤 깨어난 리네아에게 북쪽 골목 증언을 듣고 완료한다', () => {
  let state = through('village-raid');
  state = talkTo('serena', state).state;
  state = recordEvent(state, { type: 'inspect', map: 'village-north', spot: 'home-search' }).state;
  assert.equal(lineaRecovery(state), 'awake');
  const eilaTalk = talkTo('eila', state);
  assert.equal(eilaTalk.progressed?.id, 'missing-sia');
  state = eilaTalk.state;
  assert.equal(markerFor('linea', state), 'target');
  const lineaTalk = talkTo('linea', state);
  assert.equal(lineaTalk.completed?.id, 'missing-sia');
  assert.equal(lineaTalk.next?.id, 'sealed-letter');
  assert.ok(lineaTalk.lines.some(l => l.portrait === 'linea' && /북쪽 골목/.test(l.text)));
  assert.match(chapterDialogue('linea', lineaTalk.state)[0].text, /북쪽 골목/);
});

test('1장 첫날 서브 퀘스트 5종은 마지막 수련 뒤 열리고, 모든 채집 지점이 걸을 수 있으며 습격 이후에는 숨겨진다', () => {
  const subs = [
    { id: 'linea-flowers', npc: 'linea', spots: [['south-field', 'wildflower']], gear: ['wildflower-bracelet'] },
    { id: 'sia-pebble', npc: 'sia', spots: [['east-stream', 'stream-pebble']], gold: 15, items: [{ id: 'sia-pebble', count: 1 }] },
    { id: 'vernel-tablet', npc: 'vernel', spots: [['south-field', 'ancient-tablet']], gold: 30, items: [{ id: 'vernel-memo', count: 1 }] },
    { id: 'eila-herbs', npc: 'eila', spots: [['south-field', 'silver-herb-1'], ['south-field', 'silver-herb-2'], ['south-field', 'silver-herb-3']], items: [{ id: 'potion', count: 5 }] },
    { id: 'serena-water', npc: 'serena', spots: [['east-stream', 'clear-water']], items: [{ id: 'serena-lunch', count: 1 }] },
  ];
  // 첫 시작({})에는 5개 첫날 의뢰가 아직 열리지 않는다.
  for (const s of subs) assert.equal(markerFor(s.npc, {}), undefined, `${s.id} 시작 전`);

  const base = { 'ruan-training': { status: 'done', count: 3 } };
  for (const s of subs) {
    assert.equal(markerFor(s.npc, base), 'sub-new', `${s.id} 수련 후 개방`);
    let state = talkTo(s.npc, base).state;
    assert.equal(state[s.id]?.status, 'active');
    for (const [mapId, spotName] of s.spots) {
      const spots = chapterSpots(state, mapId);
      const found = spots.find(p => p.id === `story-${spotName}`);
      assert.ok(found, `${s.id}: ${mapId}/${spotName} 지점 생성`);
      assert.equal(walkable(MAPS[mapId], found.x, found.y), true, `${spotName} 걸을 수 있는 위치`);
      assert.equal(findExit(MAPS[mapId], found.x, found.y), undefined, `${spotName} 출구 밖`);
      state = recordEvent(state, { type: 'inspect', map: mapId, spot: spotName }).state;
    }
    assert.equal(state[s.id]?.status, 'ready', `${s.id} 목표 완료`);
    assert.equal(markerFor(s.npc, state), 'sub-ready');
    const done = talkTo(s.npc, state);
    assert.equal(done.completed?.id, s.id);
    if (s.gear) assert.deepEqual(done.completed.rewardGear, s.gear);
    if (s.gold) assert.equal(done.completed.rewardGold, s.gold);
    if (s.items) assert.deepEqual(done.completed.rewardItems, s.items);
  }

  // dayOnly 서브 퀘스트는 습격과 수습기 모두에서 숨고 조사 지점도 나타나지 않는다.
  for (const phaseState of [through('festival-eve'), through('village-raid'), through('first-sword')]) {
    const withActive = { ...phaseState, 'linea-flowers': { status: 'active', count: 0 }, 'sia-pebble': { status: 'active', count: 0 } };
    assert.equal(chapterSpots(withActive, 'south-field').length, 0);
    assert.equal(chapterSpots(withActive, 'east-stream').length, 0);
    assert.equal(recordEvent(withActive, { type: 'inspect', map: 'south-field', spot: 'wildflower' }).updates.length, 0);
    assert.ok(!trackedQuests(withActive).some(t => t.quest.id === 'linea-flowers' || t.quest.id === 'sia-pebble'));
    for (const s of subs) assert.notEqual(markerFor(s.npc, phaseState), 'sub-new', `${s.id} 첫날 이후 비노출`);
  }
});

test('첫날 서브 퀘스트를 했으면 메인 대사가 그 일을 기억한다: 베르넬의 연구 메모와 서신, 도란의 점액과 검', () => {
  // 봉인된 서신: 헤르만에게 서신을 받은 뒤 베르넬에게 간다.
  const letter = (extra) => {
    let state = { ...through('missing-sia'), ...extra };
    state = talkTo('herman', state).state;
    return talkTo('vernel', state);
  };
  const plain = letter({});
  assert.equal(plain.completed?.id, 'sealed-letter');
  assert.ok(plain.lines.some(l => /석판 조각이 나왔다던데/.test(l.text)), '메모가 없으면 석판 소문만 듣는다');
  assert.ok(!plain.lines.some(l => /연구 메모/.test(l.text)));
  const memo = letter({ 'vernel-tablet': { status: 'done', count: 1 } });
  assert.equal(memo.completed?.id, 'sealed-letter');
  assert.ok(memo.lines.some(l => /연구 메모를 꺼낸다/.test(l.text)), '메모를 꺼내 같은 표식임을 확인한다');
  assert.ok(memo.lines.some(l => /…똑같아/.test(l.text)));

  // 도란의 검: 담금질 재료를 했으면 그 점액으로 검을 담금질했다고 말한다.
  const sword = talkTo('doran', through('sealed-letter'));
  assert.equal(sword.completed?.id, 'first-sword');
  assert.ok(!sword.lines.some(l => /점액/.test(l.text)));
  const gelSword = talkTo('doran', { ...through('sealed-letter'), 'doran-gel': { status: 'done', count: 5 } });
  assert.equal(gelSword.completed?.id, 'first-sword');
  assert.ok(gelSword.lines.some(l => /슬라임 점액/.test(l.text)));
  assert.equal(gelSword.lines.at(-1).text, sword.lines.at(-1).text, '그 밖의 흐름(완료 대사)은 같다');

  // 담금질 재료의 보상은 골드 대신 무기 무료 강화 +1이고, 완료 대사가 강화를 알려 준다.
  const gel = QUESTS.find(q => q.id === 'doran-gel');
  assert.deepEqual(gel.rewardEnhance, [{ slot: 'weapon', levels: 1 }]);
  assert.equal(gel.rewardGold, undefined);
  assert.ok(gel.done.some(l => /강화/.test(l.text)));
});
