import assert from 'node:assert/strict';
import test from 'node:test';
import { LESSONS, activeLesson, lessonToShow, parseSeenLessons, serializeSeenLessons } from '../src/story/tutorial.ts';
import { QUESTS, currentObjective } from '../src/story/quests.ts';

test('전투 가이드는 공격 → 회피 → 막기 → 물약 → 공명 다섯 가지이고, 각 수련 퀘스트의 연습 단계와 맞물린다', () => {
  assert.deepEqual(LESSONS.map((l) => l.id), ['attack', 'dodge', 'parry', 'potion', 'resonance']);
  const events = { attack: 'finisher', dodge: 'dodge', parry: 'parry', potion: 'item', resonance: 'resonance' };
  const mains = QUESTS.filter((q) => q.main);
  let last = -1;
  for (const lesson of LESSONS) {
    const quest = QUESTS.find((q) => q.id === lesson.quest);
    assert.ok(quest?.tutorial, lesson.id);
    assert.equal(currentObjective(quest, { status: 'active', count: 0, step: lesson.step }).event, events[lesson.id], lesson.id);
    const index = mains.indexOf(quest);
    assert.ok(index > last, `${lesson.id}: 이야기 순서대로`);
    last = index;
    assert.ok(lesson.lines.length >= 2 && lesson.lines.every((l) => l.length <= 90), lesson.id);
  }
});

test('안내 창은 연습 단계가 진행 중이고 아직 본 적이 없을 때 한 번만 뜬다', () => {
  const state = { 'ruan-training': { status: 'done', count: 3 }, 'ruan-dodge': { status: 'active', count: 0 } };
  assert.equal(activeLesson(state)?.id, 'dodge');
  assert.equal(lessonToShow(state, new Set())?.id, 'dodge');
  assert.equal(lessonToShow(state, new Set(['dodge'])), undefined);
  assert.equal(activeLesson({ 'ruan-dodge': { status: 'ready', count: 3 } }), undefined, '보고하러 갈 때는 연습이 끝났다');
  // 물약·공명은 사람을 찾아가 이야기를 들은 뒤(두 번째 단계)부터 연습이다.
  assert.equal(activeLesson({ 'eila-potion': { status: 'active', count: 0 } }), undefined);
  assert.equal(activeLesson({ 'eila-potion': { status: 'active', count: 0, step: 1 } })?.id, 'potion');
  assert.equal(activeLesson({ 'vernel-resonance': { status: 'active', count: 0, step: 1 } })?.button, 'resonance');
});

test('본 안내 목록은 저장했다가 그대로 읽고, 깨진 값과 모르는 값은 버린다', () => {
  assert.deepEqual([...parseSeenLessons(serializeSeenLessons(new Set(['attack', 'parry'])))], ['attack', 'parry']);
  assert.deepEqual([...parseSeenLessons('["dodge","nope",3]')], ['dodge']);
  assert.equal(parseSeenLessons('{broken').size, 0);
  assert.equal(parseSeenLessons(null).size, 0);
});
