import assert from 'node:assert/strict';
import test from 'node:test';
import { OPENING, openingLineCount, shouldPlayOpening } from '../src/story/opening.ts';
import { MAPS, walkable } from '../src/world/maps.ts';
import { DIALOGUES } from '../src/story/dialogues.ts';

test('오프닝은 새 게임을 처음 시작할 때만 보여 준다', () => {
  const base = { fromTitle: true, hasProgress: false, quests: {}, seen: false };
  assert.equal(shouldPlayOpening(base), true);
  assert.equal(shouldPlayOpening({ ...base, fromTitle: false }), false, '맵 이동·재시작에는 없다');
  assert.equal(shouldPlayOpening({ ...base, hasProgress: true }), false, '하던 저장이 있으면 없다');
  assert.equal(shouldPlayOpening({ ...base, quests: { 'ruan-training': { status: 'active', count: 0 } } }), false);
  assert.equal(shouldPlayOpening({ ...base, seen: true }), false, '한 번 본(또는 건너뛴) 뒤에는 없다');
});

test('오프닝은 자막으로 시작해 자막으로 끝나고, 대사는 2분 남짓 분량이며 모든 지점은 마을 북쪽의 걸을 수 있는 곳이다', () => {
  assert.equal(OPENING.find((s) => s.type !== 'place')?.type, 'caption');
  assert.equal(OPENING.at(-1).type, 'outro');
  const lines = openingLineCount();
  assert.ok(lines >= 18 && lines <= 30, `${lines}줄`);
  const map = MAPS['village-north'];
  for (const step of OPENING) {
    const points = step.type === 'place' ? [step.at] : step.type === 'hero' || step.type === 'npc' ? step.path : [];
    for (const p of points) assert.equal(walkable(map, p.x, p.y), true, `${step.type} ${JSON.stringify(p)}`);
    if (step.type === 'say') for (const l of step.lines) assert.ok(l.text.length <= 90, l.text);
  }
  // 오프닝 대사는 루안에게 가라는 말로 끝나, 첫 메인 퀘스트(루안의 수련)로 이어진다.
  const last = OPENING.filter((s) => s.type === 'say').at(-1);
  assert.ok(last.lines.some((l) => l.text.includes('루안')));
  assert.ok(DIALOGUES['npc-ruan']);
});
