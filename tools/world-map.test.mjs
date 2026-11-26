import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, isIndoorMap } from '../src/world/maps.ts';
import { REGIONS, ROUTES, parseVisited, regionOf, serializeVisited } from '../src/world/worldMap.ts';

test('실내는 각 건물이 있는 마을의 지역으로 기록된다', () => {
  for (const id of Object.keys(MAPS)) {
    const region = regionOf(id);
    if (id.startsWith('in-ferry-')) assert.equal(region, 'ferry-village', id);
    else if (id.startsWith('in-') || id === 'village-north') assert.equal(region, 'village', id);
    else assert.equal(REGIONS.find((r) => r.id === region).mapId, id);
  }
  assert.equal(new Set(REGIONS.map((r) => `${r.gx},${r.gy}`)).size, REGIONS.length, '칸이 겹치지 않는다');
  assert.ok(REGIONS.some((r) => !r.mapId), '아직 갈 수 없는 곳이 있다');
});

test('지도의 길은 실제 맵의 출구와 같다 (아직 갈 수 없는 곳은 빼고)', () => {
  const real = new Set();
  for (const map of Object.values(MAPS)) {
    if (isIndoorMap(map)) continue;
    for (const exit of map.exits) if (regionOf(map.id) !== regionOf(exit.to)) real.add([regionOf(map.id), regionOf(exit.to)].sort().join('-'));
  }
  const drawn = new Set(ROUTES.filter(([a, b]) => [a, b].every((id) => REGIONS.find((r) => r.id === id).mapId))
    .map((pair) => [...pair].sort().join('-')));
  assert.deepEqual([...drawn].sort(), [...real].sort());
  // 길로 이어진 두 지역은 지도에서 이웃한 칸이다.
  for (const [a, b] of ROUTES) {
    const ra = REGIONS.find((r) => r.id === a), rb = REGIONS.find((r) => r.id === b);
    assert.equal(Math.abs(ra.gx - rb.gx) + Math.abs(ra.gy - rb.gy), 1, `${a}-${b}`);
  }
});

test('가 본 지역은 저장했다가 불러오고, 모르는 값이나 갈 수 없는 곳은 버린다', () => {
  const visited = new Set(['village', 'east-stream']);
  assert.deepEqual([...parseVisited(serializeVisited(visited))].sort(), ['east-stream', 'village']);
  assert.deepEqual([...parseVisited(null)], []);
  assert.deepEqual([...parseVisited('{oops')], []);
  assert.deepEqual([...parseVisited(JSON.stringify(['village', 'moon', 'north-ruins', 3]))], ['village']);
});
