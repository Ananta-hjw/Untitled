import assert from 'node:assert/strict';
import test from 'node:test';
import { DIALOGUES } from '../src/story/dialogues.ts';
import { findInteractable } from '../src/world/interactables.ts';
import { MAPS, START_MAP, findExit, insideRect, isMapId, mapObstacles, walkable } from '../src/world/maps.ts';

const maps = Object.values(MAPS);

/** 시작점에서 32px 격자로 걸어서 닿을 수 있는 칸들 (출구 영역은 지나가지 않는다) */
function reachable(map, from) {
  const obstacles = mapObstacles(map), cell = 32, seen = new Set(), queue = [from], points = [];
  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  seen.add(key(from.x, from.y));
  while (queue.length) {
    const p = queue.shift();
    points.push(p);
    if (findExit(map, p.x, p.y)) continue;
    for (const [dx, dy] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (seen.has(key(next.x, next.y)) || !walkable(map, next.x, next.y, obstacles)) continue;
      seen.add(key(next.x, next.y));
      queue.push(next);
    }
  }
  return points;
}

test('시작 맵은 로웬 마을이고, 맵 id를 구별한다', () => {
  assert.equal(START_MAP, 'village');
  assert.equal(MAPS.village.name, '로웬 마을');
  assert.equal(isMapId('south-field'), true);
  assert.equal(isMapId('nowhere'), false);
  assert.equal(isMapId('toString'), false);
});

test('마을에는 몬스터가 없고, 사냥터마다 몬스터가 있다', () => {
  assert.equal(MAPS.village.enemies.length, 0);
  for (const id of ['south-field', 'west-forest', 'east-stream']) assert.ok(MAPS[id].enemies.length > 0, id);
});

test('시작점·몬스터·도착점은 걸을 수 있고, 시작점과 도착점은 출구 영역 밖이다', () => {
  for (const map of maps) {
    assert.equal(walkable(map, map.spawn.x, map.spawn.y), true, `${map.id} spawn`);
    assert.equal(findExit(map, map.spawn.x, map.spawn.y), undefined, `${map.id} spawn in exit`);
    for (const enemy of map.enemies) {
      assert.equal(walkable(map, enemy.x, enemy.y), true, `${map.id} enemy ${enemy.x},${enemy.y}`);
      assert.ok(Math.hypot(enemy.x - map.spawn.x, enemy.y - map.spawn.y) > 600, `${map.id} enemy too close`);
    }
    for (const exit of map.exits) {
      const target = MAPS[exit.to];
      assert.ok(target, exit.to);
      assert.equal(walkable(target, exit.arrive.x, exit.arrive.y), true, `${map.id} → ${exit.to} arrive`);
      // 도착하자마자 다시 출구에 걸려 되돌아가지 않는다.
      assert.equal(findExit(target, exit.arrive.x, exit.arrive.y), undefined, `${map.id} → ${exit.to} arrive in exit`);
      for (const enemy of target.enemies) {
        assert.ok(Math.hypot(enemy.x - exit.arrive.x, enemy.y - exit.arrive.y) > 600, `${exit.to} enemy near arrival`);
      }
    }
  }
});

test('모든 출구는 되돌아오는 출구가 있고, 그 출구로 돌아오면 처음 출구 근처에 선다', () => {
  for (const map of maps) {
    for (const exit of map.exits) {
      // 되돌아오는 길은 출구이거나, 실내라면 마을 건물의 문("들어가기")이다.
      const target = MAPS[exit.to];
      const door = target.interactables.find((i) => i.enter?.to === map.id);
      const back = target.exits.find((e) => e.to === map.id) ?? (door && { arrive: door.enter.at });
      assert.ok(back, `${exit.to} → ${map.id}`);
      const z = exit.zone;
      const nearest = { x: Math.min(Math.max(back.arrive.x, z.left), z.right), y: Math.min(Math.max(back.arrive.y, z.top), z.bottom) };
      assert.ok(Math.hypot(back.arrive.x - nearest.x, back.arrive.y - nearest.y) < 200, `${map.id} ↔ ${exit.to}`);
    }
  }
});

test('마을에서 세 사냥터로, 사냥터에서 마을로 갈 수 있다', () => {
  assert.deepEqual(MAPS.village.exits.map((e) => e.to).sort(), ['east-stream', 'south-field', 'west-forest']);
  for (const map of maps) {
    const points = reachable(map, map.spawn);
    for (const exit of map.exits) {
      assert.ok(points.some((p) => insideRect(exit.zone, p.x, p.y)), `${map.id}: ${exit.to} 출구에 걸어서 닿지 못한다`);
    }
    for (const enemy of map.enemies) {
      assert.ok(points.some((p) => Math.hypot(p.x - enemy.x, p.y - enemy.y) < 40), `${map.id}: 몬스터 ${enemy.x},${enemy.y}에 닿지 못한다`);
    }
  }
});

test('사냥터의 표지판은 대사가 있고, 시작점에서는 대화 버튼이 뜨지 않는다', () => {
  for (const map of maps) {
    assert.equal(findInteractable(map.spawn.x, map.spawn.y, map.interactables), undefined, map.id);
    for (const spot of map.interactables) {
      if (spot.enter) {
        // 건물 문: 들어가는 실내가 있고, 들어가면 걸을 수 있는 자리에 선다.
        const inside = MAPS[spot.enter.to];
        assert.ok(inside?.interior, spot.id);
        assert.equal(walkable(inside, spot.enter.at.x, spot.enter.at.y), true, spot.id);
        assert.equal(findInteractable(spot.x, spot.y + 20, map.interactables)?.id, spot.id);
        continue;
      }
      const lines = DIALOGUES[spot.dialogue];
      assert.ok(lines?.length > 0, spot.dialogue);
      for (const line of lines) assert.ok(line.text.length <= 90, `${spot.dialogue}: ${line.text.length}자`);
      assert.equal(findInteractable(spot.x, spot.y + 20, map.interactables)?.id, spot.id);
      assert.equal(findExit(map, spot.x, spot.y), undefined);
    }
  }
});
