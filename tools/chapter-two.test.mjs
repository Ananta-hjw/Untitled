import assert from 'node:assert/strict';
import test from 'node:test';
import { FERN, FERN_CART, FERN_CART_FOOTPRINT, chapterTwoDialogue, chapterTwoNpcs, chapterTwoStarted, fernCartVisible, fernMothHunt, fernShopOpen } from '../src/story/chapterTwo.ts';
import { QUESTS, continueMainQuest, parseQuests, recordEvent, serializeQuests, talkTo } from '../src/story/quests.ts';
import { MAPS, walkable } from '../src/world/maps.ts';
import { chapterNpcs } from '../src/story/chapterOne.ts';
import { guardsForMap } from '../src/world/guards.ts';
import { insideObstacle } from '../src/world/obstacles.ts';

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

test('2장의 베르넬과 테온은 떠나는 시온에게 한마디씩 한다(그 전에는 1장 대사)', () => {
  assert.equal(chapterTwoDialogue('teon', {}), undefined);
  assert.match(chapterTwoDialogue('teon', afterSword)[0].text, /여기 남을게/);
  assert.match(chapterTwoDialogue('vernel', afterSword)[0].text, /유적 길/);
  assert.equal(chapterTwoDialogue('doran', afterSword), undefined, '나머지는 1장 습격 뒤 대사를 그대로 쓴다');
});
