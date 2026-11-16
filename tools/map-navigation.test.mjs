import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, insideRect } from '../src/world/maps.ts';
import { exitPoint, exitDirection, nearbyExit, EXIT_NOTICE_DISTANCE } from '../src/world/mapNavigation.ts';

test('광장의 실제 네 출구를 동서남북으로 구분하며 다른 지역은 자기 연결만 안내한다', () => {
  const expected = { 'village-north': 'north', 'south-field': 'south', 'west-forest': 'west', 'east-stream': 'east' };
  for(const exit of MAPS.village.exits) {
    const point=exitPoint(MAPS.village,exit);
    assert.equal(exitDirection(MAPS.village,point),expected[exit.to]);
    assert.equal(nearbyExit(MAPS.village,point),exit);
  }
  for(const map of Object.values(MAPS)) for(const exit of map.exits) {
    assert.equal(insideRect(map.bounds,exitPoint(map,exit).x,exitPoint(map,exit).y),true,map.id);
  }
});

test('출구에서 떨어지면 안내하지 않으며, 길이 없는 경계와 실내에는 야외 안내를 띄우지 않는다', () => {
  const map=MAPS.village;
  assert.equal(nearbyExit(map,{x:1200,y:800}),undefined);
  assert.equal(nearbyExit(map,{x:map.bounds.left,y:450}),undefined);
  const west=map.exits.find(e=>e.to==='west-forest');
  assert.equal(nearbyExit(map,{x:west.zone.right+EXIT_NOTICE_DISTANCE,y:1050}),west);
  assert.equal(nearbyExit(map,{x:west.zone.right+EXIT_NOTICE_DISTANCE+1,y:1050}),undefined);
  for(const m of Object.values(MAPS).filter(m=>m.interior)) assert.equal(nearbyExit(m,m.spawn),undefined);
});
