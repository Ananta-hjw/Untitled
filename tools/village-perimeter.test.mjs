import { mapLength, mapRect } from '../src/world/mapScale.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { perimeterPieces, VILLAGE_EDGE, VILLAGE_GATES, WALL_HALF_WIDTH, WALL_CHARACTER_CLEARANCE, WALL_INNER_LEFT, WALL_INNER_RIGHT } from '../src/world/villagePerimeter.ts';

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
    if (x > mapLength(840) && x < mapLength(1510)) continue; // 초소·수레와 기존 아치가 있는 구간
    assert.equal(walkable(MAPS.village, x, e.south), false, '남쪽 외곽');
  }
  for (const [x, y, to] of [[mapLength(100), mapLength(1050), 'west-forest'], [mapLength(2291), mapLength(1050), 'east-stream'], [mapLength(1180), VILLAGE_GATES.south.y + 10, 'south-field']]) {
    assert.equal(walkable(MAPS.village, x, y), true, to);
    assert.equal(findExit(MAPS.village, x, y)?.to, to);
  }
  assert.equal(walkable(MAPS['village-north'], mapLength(1180), mapLength(1510)), true);
  assert.equal(walkable(MAPS.village, mapLength(1180), mapLength(250)), true);
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
  for(const yard of [{left:150,right:360,top:960,bottom:1140},{left:2090,right:2240,top:980,bottom:1120}].map(mapRect)){
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

test('나무의 수관은 좌우 담 안에 있고 줄기는 건물 안에 겹치지 않는다',()=>{
  for(const id of ['village','village-north']){
    const map=MAPS[id];
    for(const tree of map.props.filter(p=>p.frame==='oak'||p.frame==='pine')){
      assert.ok(tree.x-tree.width/2>=VILLAGE_EDGE.left+WALL_HALF_WIDTH+20,`${id} ${tree.frame} 왼쪽 수관`);
      assert.ok(tree.x+tree.width/2<=VILLAGE_EDGE.right-WALL_HALF_WIDTH-20,`${id} ${tree.frame} 오른쪽 수관`);
      for(const b of map.buildings)for(const o of b.footprint){
        assert.ok(Math.abs(tree.x-o.x)>=o.rx||Math.abs(tree.y-o.y)>=o.ry,`${id} ${tree.frame} 줄기 / ${b.frame}`);
      }
    }
  }
});

test('발뿐 아니라 캐릭터 몸·그림자 폭을 확보하고 담 바깥에는 NPC를 생성할 수 없다',()=>{
  assert.ok(WALL_CHARACTER_CLEARANCE>=65.25);
  for(const id of ['village','village-north']){
    const map=MAPS[id];
    for(const y of [650,800,1400].map(mapLength)){
      assert.equal(walkable(map,WALL_INNER_LEFT-1,y),false,`${id} 왼쪽 몸 여유`);
      assert.equal(walkable(map,WALL_INNER_RIGHT+1,y),false,`${id} 오른쪽 몸 여유`);
      assert.equal(walkable(map,mapLength(70),y),false,`${id} 왼쪽 담 바깥`);
      assert.equal(walkable(map,mapLength(2500),y),false,`${id} 오른쪽 담 바깥`);
    }
  }
  assert.equal(walkable(MAPS.village,mapLength(1800),mapLength(1710)),false,'남쪽 담 바깥');
  for(const [x,y] of [[100,1050],[2291,1050],[1180,1610]])assert.equal(walkable(MAPS.village,mapLength(x),mapLength(y)),true,'실제 문 통행');
});
