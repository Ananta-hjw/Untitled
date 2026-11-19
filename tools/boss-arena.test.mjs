import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA, arenaOpenness, bossLanding, chooseArena, entryPoint, insideArena, pushTowardArena } from '../src/combat/bossArena.ts';

const bounds = { left: 0, top: 0, right: 3400, bottom: 2200 };
// 왼쪽 위에 큰 집(막힌 사각형)이 있는 들판
const house = { left: 200, top: 100, right: 1100, bottom: 900 };
const open = (x, y) => x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
  && !(x >= house.left && x <= house.right && y >= house.top && y <= house.bottom);

test('트인 곳에 선 주인공은 고리 안쪽에 들고, 고리 안 바닥은 거의 다 열려 있다', () => {
  const hero = { x: 1800, y: 1300 };
  const arena = chooseArena(hero, bounds, open);
  assert.ok(insideArena(arena, hero.x, hero.y, ARENA.heroInner));
  assert.ok(arenaOpenness(arena.x, arena.y, open) >= ARENA.minOpen);
});

test('집 바로 옆에 서도 고리가 집을 덮지 않도록 중심이 트인 쪽으로 옮겨진다', () => {
  const hero = { x: 1200, y: 950 };
  const arena = chooseArena(hero, bounds, open);
  assert.ok(arenaOpenness(arena.x, arena.y, open) >= ARENA.minOpen);
  assert.ok(arena.x > hero.x || arena.y > hero.y, '집에서 멀어지는 쪽');
  assert.ok(insideArena(arena, hero.x, hero.y), '주인공은 여전히 고리 안');
});

test('고리 밖의 주인공은 중심 쪽으로 밀려 들어오고, 안쪽에 들면 더 밀리지 않는다', () => {
  const arena = { x: 1000, y: 1000, rx: ARENA.rx, ry: ARENA.ry };
  const pushed = pushTowardArena(arena, 1000, 1500, 100);
  assert.deepEqual(pushed, { x: 1000, y: 1400 });
  assert.deepEqual(pushTowardArena(arena, 1100, 1050, 100), { x: 1100, y: 1050 });
  // 경고 시간 동안이면 꽤 먼 곳에서도 들어온다.
  let p = { x: 1000, y: 1000 + ARENA.ry * 2.5 };
  for (let i = 0; i < 60 * BOSS_WARNING_S; i++) p = pushTowardArena(arena, p.x, p.y, ARENA.pushSpeed / 60);
  assert.ok(insideArena(arena, p.x, p.y, ARENA.pushInner));
});
const BOSS_WARNING_S = 2.8;

test('닫힐 때 아직 밖이면 고리 안쪽 첫 열린 자리로, 보스는 주인공 반대편 열린 자리에 내려앉는다', () => {
  const arena = { x: 1600, y: 1300, rx: ARENA.rx, ry: ARENA.ry };
  const at = entryPoint(arena, 1600, 2000, open);
  assert.ok(insideArena(arena, at.x, at.y) && open(at.x, at.y));
  assert.deepEqual(entryPoint(arena, 1650, 1320, open), { x: 1650, y: 1320 });
  const boss = bossLanding(arena, { x: 1300, y: 1300 }, open);
  assert.ok(boss.x > arena.x, '주인공 반대편');
  assert.ok(insideArena(arena, boss.x, boss.y) && open(boss.x, boss.y));
});
