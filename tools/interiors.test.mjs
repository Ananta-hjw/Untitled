import assert from 'node:assert/strict';
import test from 'node:test';
import { INTERIORS, WALKABLE_FURNITURE, arrivalOf, furnitureAt, furnitureObstacles, interiorFor, roomRect } from '../src/world/interiors.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { BUILDINGS } from '../src/world/villageLayout.ts';

test('남쪽 입구를 뺀 일곱 건물에 실내가 있고, 마을 문 앞에 "들어가기"가 있다', () => {
  for (const b of BUILDINGS) {
    const interior = interiorFor(b.frame);
    assert.equal(!!interior, b.frame !== 'south-gate', b.frame);
    if (!interior) continue;
    const door = MAPS.village.interactables.find((i) => i.enter?.to === `in-${interior.id}`);
    assert.ok(door, b.frame);
    assert.deepEqual([door.x, door.y], [b.door.x, b.door.y]);
    assert.equal(door.enter.label, interior.name);
  }
  assert.equal(new Set(INTERIORS.map((i) => i.id)).size, INTERIORS.length);
});

test('가구는 방 안에 있고 서로 겹치지 않으며, 들어온 자리와 문 앞은 비어 있다', () => {
  for (const interior of INTERIORS) {
    const room = roomRect(interior);
    const map = MAPS[`in-${interior.id}`];
    for (const f of interior.furniture) {
      const p = furnitureAt(interior, f);
      assert.ok(p.x - f.w / 2 >= room.left && p.x + f.w / 2 <= room.right && p.y - f.d >= room.top && p.y <= room.bottom, `${interior.id} ${f.kind}`);
    }
    const solid = furnitureObstacles(interior);
    assert.equal(solid.length, interior.furniture.filter((f) => !WALKABLE_FURNITURE.includes(f.kind)).length);
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i], c = solid[j];
        assert.ok(Math.abs(a.x - c.x) >= a.rx + c.rx || Math.abs(a.y - c.y) >= a.ry + c.ry, `${interior.id}: 가구 ${i}, ${j}가 겹친다`);
      }
    }
    const at = arrivalOf(interior);
    assert.equal(walkable(map, at.x, at.y), true, interior.id);
    assert.equal(findExit(map, at.x, at.y), undefined, interior.id);
    // 문 앞에서 방 안쪽으로 한 발 더 들어갈 수 있다.
    assert.equal(walkable(map, at.x, at.y - 60), true, interior.id);
  }
});

test('실내에서 나오면 그 건물 문 앞, 마을의 걸을 수 있는 자리에 선다', () => {
  for (const interior of INTERIORS) {
    const map = MAPS[`in-${interior.id}`];
    assert.equal(map.exits.length, 1);
    const exit = map.exits[0];
    assert.equal(exit.to, 'village');
    const building = BUILDINGS.find((b) => b.frame === interior.building);
    assert.ok(Math.hypot(exit.arrive.x - building.door.x, exit.arrive.y - building.door.y) < 40, interior.id);
    assert.equal(walkable(MAPS.village, exit.arrive.x, exit.arrive.y), true, interior.id);
    assert.equal(findExit(MAPS.village, exit.arrive.x, exit.arrive.y), undefined, interior.id);
    assert.equal(map.enemies.length, 0);
  }
});
