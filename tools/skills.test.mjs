import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILLS, emptySkills, learnSkill, parseSkills, serializeSkills } from '../src/entities/skills.ts';
import { QUESTS } from '../src/story/quests.ts';

test('처음 배운 기술은 비어 있는 첫 기술 칸에 들어가고, 다시 배워도 늘지 않는다', () => {
  const start = emptySkills(5);
  const first = learnSkill(start, 'spin');
  assert.equal(first.learned, true);
  assert.deepEqual(first.state.learned, ['spin']);
  assert.deepEqual(first.state.slots, ['spin', null, null, null, null]);
  const again = learnSkill(first.state, 'spin');
  assert.equal(again.learned, false);
  assert.equal(again.state, first.state);
});

test('이미 칸에 놓인 기술은 다시 넣지 않는다', () => {
  const result = learnSkill({ learned: [], slots: [null, 'spin'] }, 'spin');
  assert.deepEqual(result.state.slots, [null, 'spin'], '이미 칸에 있으면 또 넣지 않는다');
});

test('저장은 깨졌거나 없어진·알 수 없는 기술(구 저장의 spin 포함)은 안전하게 버린다', () => {
  assert.deepEqual(parseSkills(null, 5), emptySkills(5));
  assert.deepEqual(parseSkills('{깨짐', 5), emptySkills(5));
  assert.deepEqual(parseSkills(JSON.stringify({ version: 99, learned: ['spin'], slots: ['spin'] }), 5), emptySkills(5));
  assert.deepEqual(parseSkills(JSON.stringify({ version: 1, learned: [], slots: ['spin'] }), 3).slots, [null, null, null], '배우지 않은 기술은 칸에 둘 수 없다');
  assert.deepEqual(parseSkills(JSON.stringify({ version: 1, learned: ['spin', 'fly'], slots: ['spin', 'spin', 'fly'] }), 3), emptySkills(3), '삭제된 회전 베기와 모르는 기술은 불러올 때 비운다');
  assert.deepEqual(parseSkills(serializeSkills(emptySkills(5)), 2), emptySkills(2), '칸 수는 지금 화면에 맞춘다');
});

test('퀘스트 보상 기술은 모두 아는 기술이다', () => {
  for (const q of QUESTS) if (q.rewardSkill) assert.ok(SKILLS[q.rewardSkill], q.id);
});
