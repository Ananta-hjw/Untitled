import assert from 'node:assert/strict';
import test from 'node:test';
import { DIALOGUES } from '../src/story/dialogues.ts';
import { INTERACTABLES, findInteractable } from '../src/world/interactables.ts';
import { PLAYER_SPAWN } from '../src/world/villageLayout.ts';

test('모든 대상의 대사가 있고, 대사는 비어 있지 않다', () => {
  const ids = new Set();
  for (const item of INTERACTABLES) {
    assert.ok(!ids.has(item.id), `중복 id ${item.id}`);
    ids.add(item.id);
    const lines = DIALOGUES[item.dialogue];
    assert.ok(Array.isArray(lines) && lines.length > 0, item.dialogue);
    for (const line of lines) {
      assert.ok(line.speaker.trim().length > 0);
      assert.ok(line.text.trim().length > 0);
      // 대화창 세 줄 안에 들어가는 길이
      assert.ok(line.text.length <= 90, `${item.dialogue}: ${line.text.length}자`);
    }
  }
});

test('대상 근처에서만 찾고, 여러 개가 닿으면 가장 가까운 것을 고른다', () => {
  const a = { id: 'a', x: 0, y: 0, radius: 100, markerHeight: 0, dialogue: 'home-door' };
  const b = { id: 'b', x: 150, y: 0, radius: 100, markerHeight: 0, dialogue: 'village-sign' };
  assert.equal(findInteractable(0, 0, [a, b])?.id, 'a');
  assert.equal(findInteractable(90, 0, [a, b])?.id, 'b');
  assert.equal(findInteractable(0, 59, [a, b])?.id, 'a');
  // 세로는 원근감 때문에 더 짧게 닿는다
  assert.equal(findInteractable(0, 61, [a, b]), undefined);
  assert.equal(findInteractable(400, 0, [a, b]), undefined);
});

test('시작 위치에서는 대화 버튼이 뜨지 않고, 집 문 앞과 표지판 옆에서는 뜬다', () => {
  assert.equal(findInteractable(PLAYER_SPAWN.x, PLAYER_SPAWN.y), undefined);
  for (const item of INTERACTABLES) assert.equal(findInteractable(item.x, item.y + 20)?.id, item.id);
});
