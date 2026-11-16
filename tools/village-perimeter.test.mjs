import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { perimeterPieces, VILLAGE_EDGE, VILLAGE_GATES } from '../src/world/villagePerimeter.ts';

test('마을 외곽 돌담은 닫혀 있고 실제 세 출입구와 마을 안길만 열려 있다', () => {
  const e = VILLAGE_EDGE;
  for (const id of ['village', 'village-north']) {
    for (let y = 300; y < 1500; y += 32) {
      for (const side of ['west', 'east']) {
        const gate = VILLAGE_GATES[side];
        if (id === 'village' && y >= gate.top - 30 && y <= gate.bottom + 35) continue;
        assert.equal(walkable(MAPS[id], gate.x, y), false, `${id} ${side} ${y}`);
      }
    }
  }
  for (let x = e.left + 40; x < e.right - 40; x += 32) {
    assert.equal(walkable(MAPS['village-north'], x, e.north), false, '북쪽 외곽');
    if (x > 840 && x < 1510) continue; // 초소·수레와 기존 아치가 있는 구간
    assert.equal(walkable(MAPS.village, x, e.south), false, '남쪽 외곽');
  }
  for (const [x, y, to] of [[100, 1050, 'west-forest'], [2291, 1050, 'east-stream'], [1180, VILLAGE_GATES.south.y + 10, 'south-field']]) {
    assert.equal(walkable(MAPS.village, x, y), true, to);
    assert.equal(findExit(MAPS.village, x, y)?.to, to);
  }
  assert.equal(walkable(MAPS['village-north'], 1180, 1510), true);
  assert.equal(walkable(MAPS.village, 1180, 250), true);
});

test('마을 돌담은 외곽 양쪽에만 생성하고 서문·동문의 두 문기둥과 기존 남문을 사용한다', () => {
  for (const id of ['village', 'village-north']) {
    const pieces = perimeterPieces(id);
    assert.ok(pieces.length > 30 && pieces.length < 90, id);
    assert.ok(pieces.every(p => p.width > 0 && p.height > 0));
  }
  for (const side of ['west', 'east']) assert.equal(perimeterPieces('village').filter(p => p.name === `village-gate-${side}`).length, 2);
  assert.ok(MAPS.village.buildings.some(b => b.frame === 'south-gate'));
  for (const id of ['south-field', 'west-forest', 'east-stream', 'in-home', 'in-store']) assert.deepEqual(perimeterPieces(id), []);
});


test('동서문 앞에는 건물 지붕까지 침범하지 않는 진입 마당이 있고 남쪽 건물 문 앞도 열려 있다', () => {
  const map=MAPS.village;
  const frames=JSON.parse(readFileSync(new URL('../src/assets/village/rowen/buildings.json',import.meta.url))).frames;
  for(const yard of [{left:150,right:360,top:960,bottom:1140},{left:2090,right:2240,top:980,bottom:1120}]){
    for(let x=yard.left;x<=yard.right;x+=30)for(let y=yard.top;y<=yard.bottom;y+=30) assert.equal(walkable(map,x,y),true,`진입 마당 ${x},${y}`);
    for(const b of map.buildings){
      const f=frames.find(f=>f.name===b.frame),top=b.y-b.width*f.h/f.w;
      assert.ok(b.x+b.width/2<=yard.left||b.x-b.width/2>=yard.right||b.y<=yard.top||top>=yard.bottom,`${b.frame} 지붕이 진입 마당을 가린다`);
    }
  }
  for(const b of map.buildings.filter(b=>b.frame!=='south-gate')){
    assert.equal(walkable(map,b.door.x,b.door.y+24),true,`${b.frame} 문 앞`);
    assert.ok(b.door.y+24<VILLAGE_EDGE.south-24,`${b.frame} 문과 남쪽 담 간격`);
  }
});
