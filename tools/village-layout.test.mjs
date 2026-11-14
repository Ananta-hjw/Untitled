import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HOME, OBSTACLES, ENEMY_SPAWNS, PLAYER_SPAWN, PROPS, WALK_BOUNDS } from '../src/world/villageLayout.ts';
import { insideObstacle } from '../src/world/obstacles.ts';
import { NavGrid } from '../src/world/navGrid.ts';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config.ts';

const contains = (x, y) => x >= WALK_BOUNDS.left && x <= WALK_BOUNDS.right &&
  y >= WALK_BOUNDS.top && y <= WALK_BOUNDS.bottom && !OBSTACLES.some((o) => insideObstacle(o, x, y));

test('집 앞 시작점·현관 접근점·마을 외곽 몬스터 시작점은 모두 걸을 수 있다', () => {
  assert.ok(WALK_BOUNDS.right < WORLD_WIDTH && WALK_BOUNDS.bottom < WORLD_HEIGHT);
  for (const point of [PLAYER_SPAWN, HOME.entrance, ...ENEMY_SPAWNS]) {
    assert.equal(contains(point.x, point.y), true, JSON.stringify(point));
  }
  for (const spawn of ENEMY_SPAWNS) assert.ok(Math.hypot(spawn.x - PLAYER_SPAWN.x, spawn.y - PLAYER_SPAWN.y) > 600);
  assert.equal(contains(HOME.footprint.x, HOME.footprint.y), false);
});

test('집의 네모난 벽과 나무·바위의 바닥 접점은 막고 넓은 잎·장식용 돌은 통과한다', () => {
  const wall = HOME.footprint;
  assert.equal(insideObstacle(wall, wall.x + wall.rx - 1, wall.y + wall.ry - 1), true);
  assert.equal(insideObstacle(wall, wall.x + wall.rx + 1, wall.y), false);
  const tree = PROPS.find((p) => p.frame === 'oak');
  const trunk = OBSTACLES.find((o) => o.x === tree.x);
  assert.equal(insideObstacle(trunk, trunk.x, trunk.y), true);
  assert.equal(insideObstacle(trunk, trunk.x + 100, trunk.y - 150), false);
  assert.equal(contains(1180, 506), true);
});

test('집 뒤에서 집 앞까지 건물을 뚫지 않고 우회 경로를 찾는다', () => {
  const b = WALK_BOUNDS;
  const nav = new NavGrid(b.left, b.top, b.right, b.bottom, 32, contains);
  nav.setTarget(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
  const point = { x: HOME.x, y: 290 }, next = { x: 0, y: 0 };
  let steps = 0, around = false;
  while (nav.next(point.x, point.y, next)) {
    assert.equal(contains(next.x, next.y), true);
    point.x = next.x; point.y = next.y;
    around ||= Math.abs(point.x - HOME.x) >= HOME.footprint.rx;
    assert.ok(++steps < 200);
  }
  assert.equal(around, true);
  assert.ok(Math.hypot(point.x - PLAYER_SPAWN.x, point.y - PLAYER_SPAWN.y) < 50);
});

test('집과 여덟 소품의 프레임은 각 원본 PNG 내부에 있다', () => {
  const root = new URL('../src/assets/village/', import.meta.url);
  const { frames } = JSON.parse(readFileSync(new URL('frames.json', root)));
  assert.equal(frames.length, 9);
  for (const frame of frames) {
    const source = readFileSync(new URL(frame.texture === 'village-home' ? 'home.png' : 'props.png', root));
    assert.ok(frame.w > 0 && frame.h > 0);
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= source.readUInt32BE(16) && frame.y + frame.h <= source.readUInt32BE(20));
  }
});
