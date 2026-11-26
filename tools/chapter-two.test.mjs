import assert from 'node:assert/strict';
import test from 'node:test';
import { FERRY_FOG_PATH, FERRY_INN_DOOR, FERRY_NIGHT_PHANTOMS, FERRY_RIVERBANK, FERRY_SLEEPWALK_PATH, ferryInnRestOpen, ferryNight, ferryNightSpawns, ferryNightStep } from '../src/story/chapterTwo.ts';
import { CHAPTER_TWO_INSPECTIONS, FERN, FERN_CART, FERN_CART_FOOTPRINT, chapterTwoDialogue, chapterTwoSpots, eastPassBlockedDialogue, eastPassOpen, shelterRestOpen, chapterTwoNpcs, chapterTwoStarted, fernCartVisible, fernMothHunt, fernShopOpen } from '../src/story/chapterTwo.ts';
import { QUESTS, continueMainQuest, parseQuests, recordEvent, serializeQuests, talkTo } from '../src/story/quests.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { findInteractable } from '../src/world/interactables.ts';
import { REST_POINTS, canRest } from '../src/story/restPoints.ts';
import { chapterDialogue, chapterNpcs } from '../src/story/chapterOne.ts';
import { guardsForMap } from '../src/world/guards.ts';
import { insideObstacle } from '../src/world/obstacles.ts';
import { propObstacles } from '../src/world/villageLayout.ts';

// 1장의 메인 퀘스트를 모두 끝낸 저장
const chapterOneDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'first-sword') + 1)
  .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
const afterSword = continueMainQuest(chapterOneDone);

test('도란의 검을 끝내면 2장이 시작되어 "남문의 수레"가 이어지고, 페른과 수레가 광장에만 나타난다', () => {
  assert.equal(chapterTwoStarted({}), false);
  assert.deepEqual(chapterTwoNpcs({ 'first-sword': { status: 'active', count: 0 } }, 'village'), []);
  assert.equal(chapterTwoStarted(afterSword), true);
  assert.deepEqual(afterSword['fern-cart'], { status: 'active', count: 0 });
  assert.deepEqual(chapterTwoNpcs(afterSword, 'village').map(n => n.id), ['fern']);
  assert.deepEqual(chapterTwoNpcs(afterSword, 'village-north'), []);
  assert.equal(fernCartVisible(afterSword, 'village'), true);
  assert.equal(fernCartVisible(afterSword, 'south-field'), false);
  // 예전 저장: 도란의 검을 이미 끝냈으면 불러올 때 "남문의 수레"를 받는다
  assert.equal(parseQuests(serializeQuests(chapterOneDone))['fern-cart']?.status, 'active');
});

test('남문의 수레: 페른과 이야기 → 남쪽 들판의 잿빛 나방 넷 → 페른에게 보고하면 끝나고 수레가 열린다', () => {
  let state = afterSword;
  assert.equal(fernMothHunt(state), false);
  const met = talkTo('fern', state);
  assert.ok(met.lines.every(l => l.speaker === '페른' || l.portrait === 'hero-neutral'));
  state = met.state;
  assert.equal(fernMothHunt(state), true, '이야기를 들은 뒤 나방 쫓기');
  // 슬라임이나 다른 맵의 나방은 세지 않는다
  state = recordEvent(state, { type: 'kill', map: 'south-field', monster: 'slime' }).state;
  state = recordEvent(state, { type: 'kill', map: 'west-forest', monster: 'ashen-moth' }).state;
  assert.equal(state['fern-cart'].count, 0);
  for (let i = 0; i < 4; i++) state = recordEvent(state, { type: 'kill', map: 'south-field', monster: 'ashen-moth' }).state;
  assert.equal(fernMothHunt(state), false);
  assert.equal(fernShopOpen(state), false);
  const done = talkTo('fern', state);
  assert.equal(done.completed?.id, 'fern-cart');
  assert.ok(done.lines.some(l => l.text.includes('나루가 멈췄어')), '나루 소식을 전한다');
  assert.equal(fernShopOpen(done.state), true);
});

test('페른과 수레는 광장의 걸을 수 있는 곳에 있고, 수레는 페른의 말 거는 자리와 남문 통로를 막지 않는다', () => {
  const map = MAPS.village;
  assert.ok(walkable(map, FERN.x, FERN.y), '페른의 자리');
  assert.ok(!insideObstacle(FERN_CART_FOOTPRINT, FERN.x, FERN.y), '수레가 페른을 덮지 않는다');
  assert.ok(walkable(map, FERN_CART_FOOTPRINT.x, FERN_CART_FOOTPRINT.y), '수레는 원래 걸을 수 있던 풀밭에 선다');
  assert.ok(FERN_CART.y < FERN.y, '페른은 수레 앞(아래)에 서서 수레보다 앞에 그려진다');
});

test('습격 뒤 광장에서 일하는 사람들의 길은 페른의 수레를 지나지 않는다', () => {
  const people = chapterNpcs([...MAPS.village.npcs, ...guardsForMap('village')], afterSword, 'village');
  for (const n of people) {
    assert.ok(!insideObstacle(FERN_CART_FOOTPRINT, n.x, n.y), n.id);
    const points = n.duty ?? [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      for (let k = 0; k <= 40; k++) {
        const x = a.x + (b.x - a.x) * k / 40, y = a.y + (b.y - a.y) * k / 40;
        assert.ok(!insideObstacle(FERN_CART_FOOTPRINT, x, y), `${n.id} ${i}`);
      }
    });
  }
});

test('떠날 채비: 남문의 수레 뒤 이어지고, 루안에게 회전 베기를 배운 뒤 세레나·리네아·에일라에게 인사하고 헤르만에게 여비를 받는다', () => {
  let state = { ...afterSword, 'fern-cart': { status: 'ready', count: 1, step: 2 } };
  const shop = talkTo('fern', state);
  assert.equal(shop.completed?.id, 'fern-cart');
  assert.equal(shop.next?.id, 'farewell', '남문의 수레를 끝내면 떠날 채비가 이어진다');
  state = shop.state;
  const order = ['ruan', 'serena', 'linea', 'eila', 'herman'];
  const skills = [];
  let completed;
  for (const npc of order) {
    // 순서를 건너뛰어 말을 걸면 단계가 넘어가지 않는다
    if (npc !== 'herman') assert.equal(talkTo('herman', state)?.stepDone, undefined);
    const r = talkTo(npc, state);
    assert.ok(r.stepDone, npc);
    if (r.stepDone.rewardSkill) skills.push(r.stepDone.rewardSkill);
    state = r.state;
    completed = r.completed ?? completed;
  }
  assert.deepEqual(skills, ['spin'], '루안에게서 회전 베기 하나');
  assert.equal(completed?.id, 'farewell');
  assert.equal(completed.rewardGold, 100);
  assert.equal(state.farewell.status, 'done');
});

test('1장 완료 전에는 동쪽 고갯길 통로가 막히고 시온이 자연스럽게 되돌아선다', () => {
  assert.equal(eastPassOpen({}), false);
  assert.equal(eastPassOpen({ 'village-raid': { status: 'done', count: 1 } }), false);
  assert.equal(eastPassOpen(afterSword), true);
  assert.equal(eastPassBlockedDialogue({})[0].portrait, 'hero-neutral');
  assert.match(eastPassBlockedDialogue({})[0].text, /여기는 아니야/);
  assert.match(eastPassBlockedDialogue({ 'festival-eve': { status: 'done', count: 1 } })[0].text, /마을로 돌아가야/);
  assert.match(eastPassBlockedDialogue({ 'village-raid': { status: 'done', count: 1 } })[0].text, /대장간/);
});

test('2장의 베르넬과 테온은 남문의 수레 이후 떠나는 시온에게 한마디씩 한다(그 전에는 1장 회복 대사)', () => {
  assert.equal(chapterTwoDialogue('teon', {}), undefined);
  // 도란의 검 직후(아직 페른을 만나기 전)에는 1장 회복 대사가 정상 출력된다.
  assert.equal(chapterTwoDialogue('teon', afterSword), undefined);
  assert.match(chapterDialogue('teon', afterSword)[0].text, /순찰도 다시 시작/);
  const afterCart = { ...afterSword, 'fern-cart': { status: 'done', count: 1, step: 2 }, farewell: { status: 'active', count: 0, step: 0 } };
  assert.match(chapterTwoDialogue('teon', afterCart)[0].text, /여기 남을게/);
  assert.match(chapterTwoDialogue('vernel', afterCart)[0].text, /유적 길/);
  assert.equal(chapterTwoDialogue('doran', afterCart), undefined, '나머지는 1장 습격 뒤 대사를 그대로 쓴다');
  const afterFarewell = { ...afterCart, farewell: { status: 'done', count: 1, step: 4 } };
  assert.match(chapterTwoDialogue('linea', afterFarewell)[0].text, /일지에 적어 둘게/);
  assert.match(chapterTwoDialogue('herman', afterFarewell)[0].text, /몸 조심하게나/);
});

test('동쪽 고갯길: 떠날 채비 뒤 이어지고, 고갯길의 서리 딱정벌레 셋을 쫓은 뒤 쉼터의 도르를 만나면 끝난다', () => {
  let state = { ...afterSword, 'fern-cart': { status: 'done', count: 1, step: 2 }, farewell: { status: 'ready', count: 1, step: 4 } };
  const bye = talkTo('herman', state);
  assert.equal(bye.completed?.id, 'farewell');
  assert.equal(bye.next?.id, 'mountain-pass');
  state = bye.state;
  // 다른 몬스터는 세지 않는다
  state = recordEvent(state, { type: 'kill', map: 'east-pass', monster: 'fog-crow' }).state;
  for (let i = 0; i < 3; i++) state = recordEvent(state, { type: 'kill', map: 'east-pass', monster: 'frost-beetle' }).state;
  assert.equal(state['mountain-pass'].step, 1);
  const met = talkTo('dor', state);
  assert.equal(met.completed?.id, 'mountain-pass');
  assert.ok(met.lines.some(l => l.text.includes('안개가 밤마다 짙어져')));
});

test('동쪽 고갯길에는 퀘스트에 필요한 서리 딱정벌레가 셋 있고, 도르가 맵에 서 있다', () => {
  const pass = MAPS['east-pass'];
  assert.equal(pass.enemies.filter(e => e.key === 'frost-beetle').length, 3);
  assert.ok(pass.npcs.some(n => n.id === 'dor'));
});

test('고개의 쉼터: 동쪽 고갯길 뒤 이어지고, 안개 까마귀 넷 → 도르와 하룻밤 → 고개 꼭대기 살펴보기 → 도르에게 인사하면 끝난다', () => {
  let state = { ...afterSword, 'fern-cart': { status: 'done', count: 1, step: 2 }, farewell: { status: 'done', count: 1, step: 4 },
    'mountain-pass': { status: 'active', count: 0, step: 1 } };
  const met = talkTo('dor', state);
  assert.equal(met.completed?.id, 'mountain-pass');
  assert.equal(met.next?.id, 'pass-shelter');
  assert.ok(met.lines.some(l => l.text.includes('안개 까마귀')), '도르가 까마귀 이야기를 꺼낸다');
  state = met.state;
  assert.equal(state['pass-shelter'].status, 'active');
  // 딱정벌레나 다른 맵의 까마귀는 세지 않는다
  state = recordEvent(state, { type: 'kill', map: 'east-pass', monster: 'frost-beetle' }).state;
  state = recordEvent(state, { type: 'kill', map: 'east-stream', monster: 'fog-crow' }).state;
  assert.equal(state['pass-shelter'].count, 0);
  for (let i = 0; i < 4; i++) state = recordEvent(state, { type: 'kill', map: 'east-pass', monster: 'fog-crow' }).state;
  assert.equal(state['pass-shelter'].step, 1);
  assert.deepEqual(chapterTwoSpots(state, 'east-pass'), [], '하룻밤을 묵기 전에는 꼭대기 자리가 없다');
  const night = talkTo('dor', state);
  assert.equal(night.stepDone?.night, true, '하룻밤을 보내는 단계');
  state = night.state;
  const [summit] = chapterTwoSpots(state, 'east-pass');
  assert.equal(summit?.id, 'story-pass-summit');
  assert.deepEqual(chapterTwoSpots(state, 'east-stream'), []);
  assert.ok(CHAPTER_TWO_INSPECTIONS[summit.id].some(l => l.text.includes('안개')));
  state = recordEvent(state, { type: 'inspect', spot: 'pass-summit', map: 'east-pass' }).state;
  assert.equal(state['pass-shelter'].step, 3);
  assert.equal(shelterRestOpen(state), false);
  const bye = talkTo('dor', state);
  assert.equal(bye.completed?.id, 'pass-shelter');
  assert.equal(shelterRestOpen(bye.state), true);
  // 저장했다 읽어도 같다
  assert.deepEqual(parseQuests(serializeQuests(bye.state))['pass-shelter'], bye.state['pass-shelter']);
});

test('고개 꼭대기 살펴보기 자리와 고개 쉼터에서 다시 시작하는 자리는 걸을 수 있고, 출구와 도르의 말 거는 자리와 겹치지 않는다', () => {
  const pass = MAPS['east-pass'];
  const state = { 'pass-shelter': { status: 'active', count: 0, step: 2 } };
  const [summit] = chapterTwoSpots(state, 'east-pass');
  const at = { x: summit.x, y: summit.y + 30 };
  assert.equal(walkable(pass, at.x, at.y), true);
  assert.equal(findExit(pass, at.x, at.y), undefined);
  assert.equal(findInteractable(at.x, at.y, [...pass.interactables, summit])?.id, summit.id);
  const shelter = REST_POINTS.shelter;
  assert.equal(walkable(pass, shelter.at.x, shelter.at.y), true);
  assert.equal(findExit(pass, shelter.at.x, shelter.at.y), undefined);
});

test('고개의 쉼터 뒤 "멈춘 나루": 에반 → 여관 → 마르타와 풀무 → 핀 → 갈대밭 늪의 마물과 연 → 핀 순서로 이어진다', () => {
  const shelterDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'pass-shelter') + 1)
    .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
  // 도르에게 마지막 인사를 하면 나루로 가라는 말과 함께 이어진다
  const before = { ...shelterDone, 'pass-shelter': { status: 'active', count: 0, step: 3 } };
  const farewell = talkTo('dor', before);
  assert.equal(farewell.completed?.id, 'pass-shelter');
  assert.equal(farewell.next?.id, 'still-ferry');
  let state = farewell.state;
  assert.deepEqual(state['still-ferry'], { status: 'active', count: 0 });
  // 나루 사람들은 나루에만, 퀘스트를 받은 뒤에만 있다
  assert.deepEqual(chapterTwoNpcs(state, 'ferry-village').map(n => n.id), ['evan', 'morgan', 'ferry-fisher']);
  // 마르타는 대장간 안에 있다
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-marta-smithy').map(n => n.id), ['marta']);
  // 여관 주인과 핀은 여관 안에 있다
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-inn').map(n => n.id), ['fog-innkeeper', 'finn', 'innkeeper-wife']);
  assert.deepEqual(chapterTwoNpcs(before, 'ferry-village'), []);
  assert.deepEqual(chapterTwoNpcs(state, 'east-pass'), []);

  const talk = npc => { const r = talkTo(npc, state); state = r.state; return r; };
  const inspect = (spot, map) => {
    assert.deepEqual(chapterTwoSpots(state, map).map(s => s.id), [`story-${spot}`]);
    state = recordEvent(state, { type: 'inspect', spot, map }).state;
  };
  // 아직 마르타에게 가도 퀘스트가 앞서 나가지 않는다
  assert.equal((talkTo('marta', state)?.state ?? state)['still-ferry'].step ?? 0, 0);
  talk('evan');
  assert.equal(state['still-ferry'].step, 1);
  talk('fog-innkeeper');
  talk('marta');
  assert.deepEqual(chapterTwoSpots(state, 'reed-swamp'), []);
  inspect('ferry-forge', 'in-ferry-marta-smithy');
  assert.ok(CHAPTER_TWO_INSPECTIONS['story-ferry-forge'].some(l => l.text.includes('종')));
  talk('marta');
  talk('finn');
  assert.equal(state['still-ferry'].step, 6);
  for (let i = 0; i < 3; i++) state = recordEvent(state, { type: 'kill', map: 'reed-swamp', monster: 'reed-stalker' }).state;
  assert.equal(state['still-ferry'].step, 7);
  inspect('reed-kite', 'reed-swamp');
  assert.ok(CHAPTER_TWO_INSPECTIONS['story-reed-kite'].some(l => l.text.includes('놋쇠 종')));
  const done = talk('finn');
  assert.equal(done.completed?.id, 'still-ferry');
  assert.equal(done.next?.id, 'night-bell');
  assert.equal(state['still-ferry'].status, 'done');
  assert.deepEqual(serializeQuests(state) && parseQuests(serializeQuests(state))['still-ferry'], state['still-ferry']);
});

test('물안개 나루 사람들은 걸을 수 있는 곳에 따로 서고, 살펴보기·쉬는 자리·늪 출구는 닿을 수 있다', () => {
  const ferry = MAPS['ferry-village'];
  const state = { 'pass-shelter': { status: 'done', count: 1 }, 'still-ferry': { status: 'active', count: 0 } };
  for (const map of ['ferry-village', 'in-ferry-inn', 'in-ferry-marta-smithy', 'in-ferry-fisherman-house', 'in-ferry-herbalist-shop', 'in-ferry-watermill']) {
    const people = chapterTwoNpcs(state, map);
    // 대화 자리(카운터 뒤 여관 주인은 카운터 앞)가 걸을 수 있는 곳이다
    const spot = n => ({ x: n.x, y: n.y + (n.talkOffset ?? 0) });
    for (const n of people) assert.equal(walkable(MAPS[map], spot(n).x, spot(n).y), true, n.id);
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
      const a = spot(people[i]), b = spot(people[j]);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 220, `${people[i].id}·${people[j].id}: 대화 자리가 겹치지 않는다`);
    }
  }
  for (const [map, spot] of [['in-ferry-marta-smithy', 'story-ferry-forge'], ['reed-swamp', 'story-reed-kite']]) {
    const s = { 'story-ferry-forge': { x: 340, y: 590 }, 'story-reed-kite': { x: 1780, y: 1250 } }[spot];
    assert.equal(walkable(MAPS[map], s.x, s.y), true, spot);
    assert.equal(findExit(MAPS[map], s.x, s.y), undefined, spot);
  }
  const inn = REST_POINTS['ferry-inn'];
  assert.equal(inn.map, 'in-ferry-inn');
  assert.equal(walkable(MAPS[inn.map], inn.at.x, inn.at.y), true);
  // 갈대밭 늪은 나루 남서쪽 길에서 오가고, 동쪽 고갯길에는 늪 출구가 없다
  assert.ok(ferry.exits.some(e => e.to === 'reed-swamp'));
  assert.ok(MAPS['reed-swamp'].exits.every(e => e.to === 'ferry-village'));
  assert.ok(MAPS['east-pass'].exits.every(e => e.to !== 'reed-swamp'));
});

test('멈춘 나루 뒤 "밤의 종소리": 여관 주인에게 방 얻기(여관의 밤) → 안개 환영 셋 → 물가에서 깨우기 → 핀 달래기', () => {
  const ferryDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'still-ferry') + 1)
    .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
  let state = continueMainQuest(ferryDone);
  assert.deepEqual(state['night-bell'], { status: 'active', count: 0 });
  // 낮: 여관 주인과 핀은 여관 안, 쉬어 갈 수 있다
  assert.equal(ferryNight(state), false);
  assert.equal(ferryInnRestOpen(state), true);
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-inn').map(n => n.id), ['fog-innkeeper', 'finn', 'innkeeper-wife']);
  const talk = npc => { const r = talkTo(npc, state); state = r.state; return r; };

  // 방을 얻으면 여관의 밤 연출을 본다
  assert.equal(talk('fog-innkeeper').stepDone?.cutscene, 'night-bell');
  assert.equal(ferryNightStep(state), 1);
  assert.equal(canRest(state), false);
  assert.equal(ferryInnRestOpen(state), false);
  // 밤: 여관은 비고, 잠든 여관 주인은 여관 문 앞, 핀은 문 앞에서 아버지를 가리킨다. 다른 나루 사람들은 자고 있다
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-inn'), []);
  const night = chapterTwoNpcs(state, 'ferry-village');
  assert.deepEqual(night.map(n => n.id), ['fog-innkeeper', 'finn']);
  assert.deepEqual({ x: night[0].x, y: night[0].y }, FERRY_INN_DOOR);
  assert.equal(night[1].storyAction, 'warn-father');
  assert.equal(ferryNightSpawns(state, 'ferry-village').length, 3);
  assert.deepEqual(ferryNightSpawns(state, 'reed-swamp'), []);
  for (let i = 0; i < 3; i++) state = recordEvent(state, { type: 'kill', map: 'ferry-village', monster: 'mist-phantom' }).state;
  assert.equal(ferryNightStep(state), 2);
  assert.deepEqual(ferryNightSpawns(state, 'ferry-village'), []);
  const bank = chapterTwoNpcs(state, 'ferry-village').find(n => n.id === 'fog-innkeeper');
  assert.deepEqual({ x: bank.x, y: bank.y }, FERRY_RIVERBANK);
  // 물가에서 깨우면 깨어나는 연출, 핀이 아버지를 끌어안는다(한 그림)
  assert.equal(talk('fog-innkeeper').stepDone?.cutscene, 'river-wake');
  assert.equal(ferryNightStep(state), 3);
  const hug = chapterTwoNpcs(state, 'ferry-village');
  assert.deepEqual(hug.map(n => n.id), ['finn']);
  assert.equal(hug[0].storyAction, 'hug-father');
  const done = talk('finn');
  assert.equal(done.completed?.id, 'night-bell');
  assert.ok(done.lines.some(l => l.text.includes('어머니')));
  assert.equal(ferryNight(state), false);
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-inn').map(n => n.id), ['fog-innkeeper', 'finn', 'innkeeper-wife']);
  assert.deepEqual(parseQuests(serializeQuests(state))['night-bell'], state['night-bell']);
});

test('종소리의 밤: 잠든 걸음 길·물가·안개 환영 자리는 걸을 수 있고, 길은 벽과 소품을 지나지 않는다', () => {
  const ferry = MAPS['ferry-village'];
  const obstacles = [...ferry.obstacles, ...propObstacles(ferry.props)];
  const clear = (x, y) => walkable(ferry, x, y) && !obstacles.some(o => insideObstacle(o, x, y)) && !findExit(ferry, x, y);
  const path = [FERRY_INN_DOOR, ...FERRY_SLEEPWALK_PATH];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      assert.ok(clear(x, y), `잠든 걸음 ${i}: (${Math.round(x)}, ${Math.round(y)})`);
    }
  }
  for (const p of FERRY_NIGHT_PHANTOMS) assert.ok(clear(p.x, p.y), JSON.stringify(p));
  // 핀이 서는 자리와 안개 길: 핀은 문 앞 걸을 수 있는 곳, 안개 길은 강둑 끝에서 물(걸을 수 없는 곳) 위로 뻗는다
  assert.ok(clear(FERRY_INN_DOOR.x - 150, FERRY_INN_DOOR.y + 20));
  assert.equal(walkable(ferry, FERRY_FOG_PATH.x + FERRY_FOG_PATH.length * 0.5, FERRY_FOG_PATH.y), false);
});

test('2장 서브 퀘스트 1·2: 리네아의 첫 잉크와 행상인의 짐은 메리나를 거쳐 끝나고, 수레가 고쳐지며 페른이 말린 무화과를 판다', async () => {
  const { fernCartState, fernExtraStock } = await import('../src/story/chapterTwo.ts');
  const { markerFor } = await import('../src/story/quests.ts');
  // 남문의 수레를 끝내고 떠날 채비가 시작된 저장
  let state = talkTo('fern', { ...afterSword, 'fern-cart': { status: 'ready', count: 4, step: 2 } }).state;
  state = { ...state, 'fern-cart': { status: 'done', count: 1, step: 2 } };
  assert.equal(fernCartState(state), 'damaged');
  assert.deepEqual(fernExtraStock(state), []);
  // 페른과 리네아가 초록 느낌표로 새 의뢰를 준다
  assert.equal(markerFor('fern', state), 'sub-new');
  const talk = npc => { const r = talkTo(npc, state); state = r.state; return r; };
  assert.equal(talk('fern').accepted?.id, 'fern-cover');
  // 떠날 채비의 리네아 차례에는 메인 대화가 먼저다
  state = { ...state, farewell: { status: 'active', count: 0, step: 2 } };
  assert.equal(talk('linea').progressed?.id, 'farewell');
  assert.equal(talk('linea').accepted?.id, 'linea-ink');
  // 메리나에게 두 번 말을 걸어 잉크와 천을 받는다
  const first = talk('merina'), second = talk('merina');
  assert.deepEqual([first.progressed?.id, second.progressed?.id].sort(), ['fern-cover', 'linea-ink']);
  const ink = talk('linea');
  assert.equal(ink.completed?.id, 'linea-ink');
  assert.ok(ink.completed.rewardItems.some(i => i.id === 'linea-letter-paper'));
  const cover = talk('fern');
  assert.equal(cover.completed?.id, 'fern-cover');
  assert.equal(fernCartState(state), 'repaired');
  assert.deepEqual(fernExtraStock(state), ['dried-fig']);
});

test('2장 서브 퀘스트 3 쉼터의 약초: 고개의 쉼터 뒤 도르에게 받고, 고갯길 약초 다섯 포기를 차례로 캐서 도르에게 가져간다', async () => {
  const { PASS_HERBS } = await import('../src/story/chapterTwo.ts');
  const shelterDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'pass-shelter') + 1)
    .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
  let state = continueMainQuest(shelterDone);
  const accepted = talkTo('dor', state);
  assert.equal(accepted.accepted?.id, 'dor-herbs');
  state = accepted.state;
  const pass = MAPS['east-pass'];
  const obstacles = [...pass.obstacles, ...propObstacles(pass.props)];
  for (let i = 1; i <= 5; i++) {
    // 지금 캘 한 포기만 보인다
    assert.deepEqual(chapterTwoSpots(state, 'east-pass').map(s => s.id), [`story-pass-herb-${i}`]);
    assert.ok(CHAPTER_TWO_INSPECTIONS[`story-pass-herb-${i}`]?.length);
    state = recordEvent(state, { type: 'inspect', spot: `pass-herb-${i}`, map: 'east-pass' }).state;
  }
  for (const p of PASS_HERBS) {
    assert.equal(walkable(pass, p.x, p.y), true, JSON.stringify(p));
    assert.ok(!obstacles.some(o => insideObstacle(o, p.x, p.y)), JSON.stringify(p));
    assert.equal(findExit(pass, p.x, p.y), undefined);
  }
  assert.equal(state['dor-herbs'].status, 'ready');
  const done = talkTo('dor', state);
  assert.equal(done.completed?.id, 'dor-herbs');
  assert.ok(done.completed.rewardItems.some(i => i.id === 'dor-herb-pouch'));
});

test('밤의 종소리 뒤 "사라진 다섯": 여관 주인 → 어부의 딸 → 약초 가게 할머니 → 방앗간 젊은이 → 에반 → 마르타 순서로 증언을 듣는다', () => {
  const bellDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'night-bell') + 1)
    .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
  let state = continueMainQuest(bellDone);
  assert.deepEqual(state['missing-five'], { status: 'active', count: 0 });
  // 증인들은 각자 집 안에 있다
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-fisherman-house').map(n => n.id), ['fisher-daughter']);
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-herbalist-shop').map(n => n.id), ['herbalist-elder']);
  assert.deepEqual(chapterTwoNpcs(state, 'in-ferry-watermill').map(n => n.id), ['mill-apprentice']);
  const talk = npc => { const r = talkTo(npc, state); state = r.state; return r; };
  // 차례가 아닌 사람에게 먼저 가도 앞서 나가지 않는다
  assert.equal(talkTo('marta', state)?.state['missing-five']?.step ?? 0, 0);
  const order = ['fog-innkeeper', 'fisher-daughter', 'herbalist-elder', 'mill-apprentice', 'evan'];
  for (const [i, npc] of order.entries()) {
    const r = talk(npc);
    assert.equal(r.progressed?.id, 'missing-five', npc);
    assert.equal(state['missing-five'].step, i + 1);
    assert.ok(r.lines.some(l => l.portrait === npc), npc);
  }
  const done = talk('marta');
  assert.equal(done.completed?.id, 'missing-five');
  assert.ok(done.lines.some(l => l.text.includes('흉내')));
  assert.equal(state['missing-five'].status, 'done');
});

test('2장 서브 퀘스트 4·5: 새는 지붕과 엉킨 그물은 갈대밭 늪에서 세 곳을 차례로 살피고 의뢰인에게 돌아가며, 자리는 걸을 수 있다', async () => {
  const { REED_BUNDLES, TANGLED_NETS, STORY_SPOT_ART } = await import('../src/story/chapterTwo.ts');
  const ferryDone = Object.fromEntries(QUESTS.slice(0, QUESTS.findIndex(q => q.id === 'still-ferry') + 1)
    .filter(q => q.main).map(q => [q.id, { status: 'done', count: (q.steps?.at(-1) ?? q.objective).need, ...(q.steps ? { step: q.steps.length - 1 } : {}) }]));
  let state = continueMainQuest(ferryDone);
  const swamp = MAPS['reed-swamp'];
  const obstacles = [...(swamp.obstacles ?? []), ...propObstacles(swamp.props)];
  for (const [giver, quest, prefix, points, reward] of [
    ['innkeeper-wife', 'leaky-roof', 'reed-bundle', REED_BUNDLES, 'lunch'],
    ['ferry-fisher', 'tangled-nets', 'tangled-net', TANGLED_NETS, 'dried-fish'],
  ]) {
    const offer = talkTo(giver, state);
    assert.equal(offer.accepted?.id, quest);
    state = offer.state;
    for (let i = 1; i <= 3; i++) {
      const spots = chapterTwoSpots(state, 'reed-swamp').map(s => s.id);
      assert.ok(spots.includes(`story-${prefix}-${i}`), `${quest} ${i}: ${spots}`);
      assert.ok(STORY_SPOT_ART[`story-${prefix}-${i}`], '소품 그림');
      assert.ok(CHAPTER_TWO_INSPECTIONS[`story-${prefix}-${i}`]?.length);
      state = recordEvent(state, { type: 'inspect', spot: `${prefix}-${i}`, map: 'reed-swamp' }).state;
    }
    for (const p of points) {
      assert.equal(walkable(swamp, p.x, p.y), true, JSON.stringify(p));
      assert.ok(!obstacles.some(o => insideObstacle(o, p.x, p.y)), JSON.stringify(p));
      assert.equal(findExit(swamp, p.x, p.y), undefined);
    }
    const done = talkTo(giver, state);
    assert.equal(done.completed?.id, quest);
    assert.ok(done.completed.rewardItems.some(r => r.id === reward));
    state = done.state;
  }
  // 늪의 살펴보기 자리끼리(핀의 연 포함) 겹치지 않는다
  const all = [...REED_BUNDLES, ...TANGLED_NETS, { x: 1780, y: 1250 }];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) > 220, `${JSON.stringify(all[i])} ${JSON.stringify(all[j])}`);
  }
});
