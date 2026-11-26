import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { findInteractable } from '../src/world/interactables.ts';
import { CLINIC_BED_SPOT, HERB_BONUS_RATIO, HOME_BED_SPOT, herbBonus, REST_POINTS, canRest, parseRestPoint, serializeRestPoint } from '../src/story/restPoints.ts';

test('쉬는 곳(여관·시온의 집·고개 쉼터·나루 여관)에서 다시 시작하는 자리는 걸을 수 있는 곳이고, 출구나 나가기 버튼 바로 앞이 아니다', () => {
  for (const point of Object.values(REST_POINTS)) {
    const map = MAPS[point.map];
    // 마을과 나루의 쉬는 곳은 실내(나루 여관은 원화 실내 indoorThreshold), 2장의 고개 쉼터는 바깥
    const outside = { shelter: 'east-pass' }[point.id];
    assert.ok(outside ? point.map === outside : map?.interior || map?.indoorThreshold, point.id);
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

test('치유소 침대 옆 치료받기 자리는 걸어서 닿을 수 있고, 나가기 문과 겹치지 않는다', () => {
  const map = MAPS['in-clinic'];
  const at = { x: CLINIC_BED_SPOT.x, y: CLINIC_BED_SPOT.y + 30 };
  assert.equal(walkable(map, at.x, at.y), true);
  assert.equal(findInteractable(at.x, at.y, [...map.interactables, CLINIC_BED_SPOT])?.id, 'heal-clinic');
  const door = map.interactables.find((i) => i.enter?.label === '나가기');
  assert.ok(door);
  assert.equal(findInteractable(door.x, door.y, [...map.interactables, CLINIC_BED_SPOT])?.id, door.id);
});

test('쉰 곳을 저장했다가 읽고, 모르는 값이나 깨진 값은 버린다', () => {
  assert.equal(parseRestPoint(serializeRestPoint('inn'))?.map, 'in-inn');
  assert.equal(parseRestPoint(serializeRestPoint('home'))?.map, 'in-home');
  assert.equal(parseRestPoint(serializeRestPoint('shelter'))?.map, 'east-pass');
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

test('약초 기운은 기본 최대 체력의 일정 비율이고 최소 1이다', () => {
  assert.equal(herbBonus(100), Math.round(100 * HERB_BONUS_RATIO));
  assert.equal(herbBonus(1), 1);
});
