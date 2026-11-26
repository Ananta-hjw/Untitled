import assert from 'node:assert/strict';
import test from 'node:test';
import { interactablesInReach, talkChoices } from '../src/world/interactables.ts';

const spot = (id, x, y) => ({ id, x, y, radius: 110, markerHeight: 100 });

test('손이 닿는 대상은 가까운 순서로 모두 고르고, 사람이 둘 이상 모였을 때만 대화 상대를 고르게 한다', () => {
  const list = [spot('npc-eila', 100, 0), spot('npc-linea', 30, 0), spot('npc-serena', 400, 0), spot('exit-clinic', 0, 50)];
  assert.deepEqual(interactablesInReach(0, 0, list).map(s => s.id), ['npc-linea', 'exit-clinic', 'npc-eila']);
  // 가장 가까운 대상이 사람이면, 닿는 사람들만 가까운 순서로
  assert.deepEqual(talkChoices(0, 0, list).map(s => s.id), ['npc-linea', 'npc-eila']);
  // 한 사람뿐이면 고르지 않는다
  assert.deepEqual(talkChoices(0, 0, [spot('npc-linea', 30, 0)]), []);
  // 문이 가장 가까우면 문을 쓴다
  assert.deepEqual(talkChoices(0, 45, list), []);
  // 세로는 원근 때문에 0.6배까지만 닿는다
  assert.deepEqual(interactablesInReach(0, 0, [spot('npc-far', 0, 70)]), []);
});
