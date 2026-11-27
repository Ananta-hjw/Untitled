import assert from 'node:assert/strict';
import test from 'node:test';
import { INTERIORS, WALKABLE_FURNITURE, arrivalOf, doorOf, furnitureAt, furnitureObstacles, interiorFor, roomRect } from '../src/world/interiors.ts';
import { FERRY_INTERIOR_MAPS } from '../src/world/ferryInteriors.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { findInteractable, interactablesInReach } from '../src/world/interactables.ts';
import { BUILDINGS, PLAYER_SPAWN } from '../src/world/villageLayout.ts';

test('남쪽 입구를 뺀 여덟 건물에 실내가 있고, 그 건물이 있는 마을 맵의 문 앞에 "들어가기"가 있다', () => {
  for (const b of BUILDINGS) {
    const interior = interiorFor(b.frame);
    assert.equal(!!interior, b.frame !== 'south-gate', b.frame);
    if (!interior) continue;
    const door = MAPS[b.area].interactables.find((i) => i.enter?.to === `in-${interior.id}`);
    assert.ok(door, b.frame);
    assert.deepEqual([door.x, door.y], [b.door.x, b.door.y]);
    assert.equal(door.enter.label, interior.name);
  }
  assert.equal(new Set(INTERIORS.map((i) => i.id)).size, INTERIORS.length);
  assert.equal(INTERIORS.length, 8);
});

test('가구는 방 안의 독립된 객체이고 밟을 수 없으며, 들어온 자리와 문 앞은 비어 있다', () => {
  for (const interior of INTERIORS) {
    const room = roomRect(interior);
    const map = MAPS[`in-${interior.id}`];
    for (const f of interior.furniture) {
      const p = furnitureAt(interior, f);
      assert.ok(p.x - f.w / 2 >= room.left - 1e-6 && p.x + f.w / 2 <= room.right + 1e-6 && p.y - f.d >= room.top - 1e-6 && p.y <= room.bottom + 1e-6, `${interior.id} ${f.kind}`);
    }
    const solid = furnitureObstacles(interior);
    assert.equal(solid.length, interior.furniture.filter((f) => !WALKABLE_FURNITURE.includes(f.kind)).length);
    assert.equal(new Set(interior.furniture.map(f => f.id)).size, interior.furniture.length);
    for (const o of solid) assert.equal(walkable(map, o.x, o.y), false, `${interior.id}: 가구 중심`);
    const at = arrivalOf(interior);
    assert.equal(walkable(map, at.x, at.y), true, interior.id);
    assert.equal(findExit(map, at.x, at.y), undefined, interior.id);
    // 문 앞에서 방 안쪽으로 한 발 더 들어갈 수 있다.
    assert.equal(walkable(map, at.x, at.y - 30), true, interior.id);
  }
});

test('실내에서는 문 앞에서 나가기를 눌러야 나가고, 나오면 그 건물 문 앞, 마을의 걸을 수 있는 자리에 선다', () => {
  for (const interior of INTERIORS) {
    const map = MAPS[`in-${interior.id}`];
    assert.equal(map.exits.length, 0, '문 근처를 지나가기만 해서는 나가지 않는다');
    const spots = map.interactables.filter((i) => i.enter);
    assert.equal(spots.length, 1);
    const exit = spots[0].enter;
    const building = BUILDINGS.find((b) => b.frame === interior.building);
    assert.equal(exit.to, building.area);
    // 나오면 건물 문 앞에 서되, 들어가기 지점(반지름)보다는 조금 앞이라 나오자마자 다시 들어가기가 뜨지 않는다.
    const door = MAPS[building.area].interactables.find((i) => i.enter?.to === map.id);
    const fromDoor = Math.hypot(exit.at.x - building.door.x, exit.at.y - building.door.y);
    assert.ok(fromDoor < 100 && fromDoor > door.radius, `${interior.id} ${fromDoor}`);
    assert.ok(exit.at.y > building.door.y, '문 앞(아래)쪽');
    assert.equal(walkable(MAPS[building.area], exit.at.x, exit.at.y), true, interior.id);
    assert.equal(findExit(MAPS[building.area], exit.at.x, exit.at.y), undefined, interior.id);
    // 들어온 자리에서는 바로 나가기 버튼이 뜨지 않는다.
    const at = arrivalOf(interior);
    assert.equal(findInteractable(at.x, at.y, map.interactables), undefined, interior.id);
    assert.equal(map.enemies.length, 0);
  }
});

test('뒤쪽 모서리의 창문·벽 위로는 올라설 수 없다 (바닥은 원화의 사다리꼴 모양)', () => {
  for (const interior of INTERIORS) {
    const map = MAPS[`in-${interior.id}`], room = roomRect(interior);
    assert.equal(walkable(map, room.right - 2, room.top + 2), false, `${interior.id} 오른쪽 뒤`);
    assert.equal(walkable(map, room.left + 2, room.top + 2), false, `${interior.id} 왼쪽 뒤`);
  }
});

test('창문·온실·계단과 침대·의자 같은 가구 위는 밟을 수 없다', async () => {
  const { interiorArtPoint } = await import('../src/world/interiors.ts');
  const forbidden = { home:[[1000,430],[300,650]], linea:[[900,420],[1340,550],[1200,540]],
    clinic:[[1280,580],[320,620],[1020,490]], chief:[[1500,490]], inn:[[1370,420],[915,420],[1300,740]],
    store:[[220,530],[900,500],[1320,760]], smithy:[[300,650],[1300,530]], hall:[[1380,690],[350,430]] };
  for (const interior of INTERIORS) for (const [x,y] of forbidden[interior.id]) {
    const p=interiorArtPoint(interior,x,y);
    assert.equal(walkable(MAPS[`in-${interior.id}`],p.x,p.y),false,`${interior.id}: ${x},${y}`);
  }
});

test('가구와 배경 조각을 분리해도 원화에 빈 영역이 생기거나 가구가 배경에 중복되지 않는다', async () => {
  const { interiorBackgroundPieces }=await import('../src/world/interiorLayers.ts');
  const { INTERIOR_ART }=await import('../src/world/interiors.ts');
  for (const interior of INTERIORS) {
    const pieces=interiorBackgroundPieces(interior),art=INTERIOR_ART[interior.id];
    assert.ok(pieces.length<150,interior.id);
    for(let y=7;y<art.height;y+=23)for(let x=7;x<art.width;x+=23){
      const inside=([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b;
      const background=pieces.filter(inside).length;
      const object=interior.furniture.some(f=>inside(f.art));
      assert.equal(background,object?0:1,`${interior.id}: ${x},${y}`);
    }
  }
});

test('방 크기를 줄여도 침대의 쉬기·치료 자리와 상인 앞은 이동 가능한 바닥이다', async()=>{
  const { REST_POINTS,CLINIC_BED_SPOT }=await import('../src/story/restPoints.ts');
  const { interiorShop }=await import('../src/world/interiors.ts');
  for(const point of Object.values(REST_POINTS)) assert.ok(walkable(MAPS[point.map],point.at.x,point.at.y),point.id);
  assert.ok(walkable(MAPS['in-clinic'],CLINIC_BED_SPOT.x,CLINIC_BED_SPOT.y));
  for(const id of ['store','inn','smithy','clinic']){
    const p=interiorShop(id);assert.ok(walkable(MAPS[`in-${id}`],p.x+p.talkOffsetX,p.y+p.talkOffset+20),id);
  }
});

test('입구에서 상인·침대 앞까지 가구 사이의 바닥으로 이어진 통로가 있다',async()=>{
  const { interiorShop }=await import('../src/world/interiors.ts');
  const { REST_POINTS,CLINIC_BED_SPOT }=await import('../src/story/restPoints.ts');
  for(const interior of INTERIORS){
    const map=MAPS[`in-${interior.id}`],start=map.spawn,step=12;
    const targets=[];
    if(['store','inn','smithy','clinic'].includes(interior.id)){
      const p=interiorShop(interior.id);targets.push({x:p.x+p.talkOffsetX,y:p.y+p.talkOffset+20});
    }
    if(interior.id==='home')targets.push(REST_POINTS.home.at);
    if(interior.id==='clinic')targets.push(CLINIC_BED_SPOT);
    const seen=new Set(['0,0']),queue=[[0,0]];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
        if(seen.has(key)||!walkable(map,start.x+nx*step,start.y+ny*step))continue;
        seen.add(key);queue.push([nx,ny]);
      }
    }
    for(const p of targets)assert.ok(queue.some(([x,y])=>Math.hypot(start.x+x*step-p.x,start.y+y*step-p.y)<24),`${interior.id}: 입구에서 접근 가능`);
  }
});

test('건물 벽 앞까지 바짝 다가가거나 좌우로 비켜 서도 들어가기가 끊기지 않는다', () => {
  assert.equal(findInteractable(PLAYER_SPAWN.x, PLAYER_SPAWN.y, MAPS['village-north'].interactables), undefined);
  for (const b of BUILDINGS) {
    const interior = interiorFor(b.frame);
    if (!interior) continue;
    const map = MAPS[b.area];
    const wall = b.footprint[0];
    const wallBottom = wall.y + wall.ry;
    for (const dx of [-70, 0, 70]) {
      const hit = findInteractable(b.door.x + dx, wallBottom + 0.5, map.interactables);
      assert.equal(hit?.id, `door-${interior.id}`, `${b.frame} 벽 앞 dx=${dx}`);
    }
    const exitBack = MAPS[`in-${interior.id}`].interactables.find((i) => i.enter).enter.at;
    assert.equal(findInteractable(exitBack.x, exitBack.y, map.interactables), undefined, `${b.frame} 나온 자리`);
  }
});

test('실내 문턱 바닥 끝과 좌우 가장자리까지 바짝 다가가도 나가기가 유지된다', () => {
  for (const interior of INTERIORS) {
    const map = MAPS[`in-${interior.id}`];
    const door = doorOf(interior);
    const arrival = arrivalOf(interior);
    let maxWalkY = arrival.y;
    for (let y = arrival.y; y <= map.bounds.bottom + 100; y += 1) {
      if (walkable(map, door.x, y)) maxWalkY = y;
    }
    for (const dx of [-90, 0, 90]) {
      const hit = findInteractable(door.x + dx, maxWalkY, map.interactables);
      assert.equal(hit?.id, `exit-${interior.id}`, `${interior.id} 문턱 끝 dx=${dx}`);
    }
    assert.equal(findInteractable(arrival.x, arrival.y, map.interactables), undefined, `${interior.id} 입장 자리`);
  }
});

test('물안개 나루 실내 문턱(±115px) 좌우 끝까지 나가기 범위가 닿고, interactablesInReach와 findInteractable 판정이 일치한다', () => {
  for (const [id, map] of Object.entries(FERRY_INTERIOR_MAPS)) {
    const exit = map.interactables.find((i) => i.enter);
    assert.ok(exit && exit.reach, id);
    assert.ok(exit.reach.rx >= 115, `${id} 문턱 폭(${exit.reach.rx}) >= 115`);
    for (const dx of [-114, 0, 114]) {
      const hit = findInteractable(exit.x + dx, exit.y + 10, map.interactables);
      const list = interactablesInReach(exit.x + dx, exit.y + 10, map.interactables);
      assert.equal(hit?.id, exit.id, `${id} dx=${dx}`);
      assert.deepEqual(list.map((i) => i.id), [exit.id], `${id} interactablesInReach 일치 dx=${dx}`);
    }
  }
});
