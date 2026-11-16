import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { findInteractable } from '../src/world/interactables.ts';
import { HOME_BED_SPOT, REST_POINTS, canRest, parseRestPoint, serializeRestPoint } from '../src/story/restPoints.ts';

test('쉬는 곳(여관·시온의 집)에서 다시 시작하는 자리는 그 실내의 걸을 수 있는 곳이고, 나가기 버튼 바로 앞이 아니다', () => {
  for (const point of Object.values(REST_POINTS)) {
    const map = MAPS[point.map];
    assert.ok(map?.interior, point.id);
    assert.equal(walkable(map, point.at.x, point.at.y), true, point.id);
    assert.equal(findExit(map, point.at.x, point.at.y), undefined, point.id);
    assert.notEqual(findInteractable(point.at.x, point.at.y, map.interactables)?.enter?.label, '나가기', point.id);
  }
});

test('시온의 집 침대 앞 쉬기 자리는 걸어서 닿을 수 있다', () => {
  const map = MAPS['in-home'];
  const at = { x: HOME_BED_SPOT.x, y: HOME_BED_SPOT.y + 30 };
  assert.equal(walkable(map, at.x, at.y), true);
  assert.equal(findInteractable(at.x, at.y, [...map.interactables, HOME_BED_SPOT])?.id, 'rest-home');
});

test('쉰 곳을 저장했다가 읽고, 모르는 값이나 깨진 값은 버린다', () => {
  assert.equal(parseRestPoint(serializeRestPoint('inn'))?.map, 'in-inn');
  assert.equal(parseRestPoint(serializeRestPoint('home'))?.map, 'in-home');
  assert.equal(parseRestPoint(null), undefined);
  assert.equal(parseRestPoint('{oops'), undefined);
  assert.equal(parseRestPoint(JSON.stringify({ version: 1, point: 'moon' })), undefined);
  assert.equal(parseRestPoint(JSON.stringify({ version: 1, point: 'toString' })), undefined);
});

test('습격의 밤에는 쉴 수 없고, 낮과 습격 뒤에는 쉴 수 있다', () => {
  assert.equal(canRest({}), true);
  assert.equal(canRest({ 'festival-eve': { status: 'done', count: 1 } }), false);
  assert.equal(canRest({ 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'done', count: 3 } }), true);
});
