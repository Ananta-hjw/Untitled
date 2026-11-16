import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BUILDINGS, HOME, PLAYER_SPAWN, PROPS, SOUTH_GATE_PASSAGE, WALK_BOUNDS, areaObstacles,
} from '../src/world/villageLayout.ts';
import { insideObstacle } from '../src/world/obstacles.ts';
import { NavGrid } from '../src/world/navGrid.ts';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config.ts';

// 마을은 두 맵(광장 village, 북쪽 village-north)이라 맵마다 따로 잰다.
const OBSTACLES = areaObstacles('village');
const blocks = { village: OBSTACLES, 'village-north': areaObstacles('village-north') };
const containsIn = (area, x, y) => x >= WALK_BOUNDS.left && x <= WALK_BOUNDS.right &&
  y >= WALK_BOUNDS.top && y <= WALK_BOUNDS.bottom && !blocks[area].some((o) => insideObstacle(o, x, y));
const contains = (x, y) => containsIn('village', x, y);

test('시작점과 모든 건물의 문 앞은 걸을 수 있고, 건물의 벽은 막는다', () => {
  assert.ok(WALK_BOUNDS.right < WORLD_WIDTH && WALK_BOUNDS.bottom < WORLD_HEIGHT);
  assert.equal(HOME.frame, 'family-house');
  assert.equal(HOME.area, 'village-north');
  assert.equal(containsIn('village-north', PLAYER_SPAWN.x, PLAYER_SPAWN.y), true);
  assert.equal(new Set(BUILDINGS.map((b) => b.frame)).size, 9);
  for (const b of BUILDINGS) {
    assert.equal(containsIn(b.area, b.door.x, b.door.y), true, `${b.frame} door`);
    for (const wall of b.footprint) {
      if (wall.y < WALK_BOUNDS.bottom) assert.equal(containsIn(b.area, wall.x, wall.y), false, `${b.frame} wall`);
      assert.ok(wall.y + wall.ry <= b.y + 40, `${b.frame} wall below the art`);
    }
  }
});

test('건물 벽은 서로 겹치지 않고, 건물 그림은 맵 안에 있다', () => {
  const walls = BUILDINGS.flatMap((b) => b.footprint.map((w) => ({ ...w, frame: b.frame, area: b.area })));
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], c = walls[j];
      const apart = Math.abs(a.x - c.x) >= a.rx + c.rx || Math.abs(a.y - c.y) >= a.ry + c.ry;
      assert.ok(apart || a.frame === c.frame || a.area !== c.area, `${a.frame} / ${c.frame}`);
    }
  }
  for (const b of BUILDINGS) assert.ok(b.x - b.width / 2 >= 0 && b.x + b.width / 2 <= WORLD_WIDTH && b.y <= WORLD_HEIGHT, b.frame);
});

test('남쪽 입구는 아치 기둥 사이로만 지나간다', () => {
  const y = BUILDINGS.find(b => b.frame === 'south-gate').y - 20;
  for (let x = 900; x <= 1460; x += 8) {
    const open = x >= SOUTH_GATE_PASSAGE.left && x <= SOUTH_GATE_PASSAGE.right;
    assert.equal(contains(x, y), open, `x=${x}`);
  }
});

test('나무·바위의 바닥 접점은 막고 넓은 잎은 통과한다', () => {
  const tree = PROPS.find((p) => p.frame === 'oak');
  const trunk = OBSTACLES.find((o) => o.x === tree.x && o.shape !== 'rect');
  assert.equal(insideObstacle(trunk, trunk.x, trunk.y), true);
  assert.equal(insideObstacle(trunk, trunk.x + 100, trunk.y - 150), false);
});

test('수련소 뒤에서 앞문까지 건물을 뚫지 않고 돌아간다', () => {
  const b = WALK_BOUNDS;
  const hall = BUILDINGS.find((x) => x.frame === 'training-hall');
  const wall = hall.footprint[0];
  const nav = new NavGrid(b.left, b.top, b.right, b.bottom, 32, contains);
  nav.setTarget(hall.door.x, hall.door.y);
  const point = { x: hall.x, y: wall.y - wall.ry - 20 }, next = { x: 0, y: 0 };
  assert.equal(contains(point.x, point.y), true);
  let steps = 0, around = false;
  while (nav.next(point.x, point.y, next)) {
    assert.equal(contains(next.x, next.y), true);
    point.x = next.x; point.y = next.y;
    around ||= Math.abs(point.x - wall.x) >= wall.rx;
    assert.ok(++steps < 300);
  }
  assert.equal(around, true);
  assert.ok(Math.hypot(point.x - hall.door.x, point.y - hall.door.y) < 50);
});

test('북쪽 줄 건물 뒤에는 캐릭터가 숨을 틈이 없다', () => {
  for (const frame of ['family-house', 'chief-house', 'clinic']) {
    const wall = BUILDINGS.find((x) => x.frame === frame).footprint[0];
    for (const dx of [-0.8, 0, 0.8]) assert.equal(containsIn('village-north', wall.x + dx * wall.rx, WALK_BOUNDS.top + 4), false, frame);
  }
});

test('문 앞에서 위로, 옆에서 다가가도 발이 건물 그림 아래 끝보다 위로 가지 않는다 (건물 앞에 그려진다)', () => {
  for (const b of BUILDINGS.filter((x) => x.frame !== 'south-gate')) {
    for (let x = b.x - b.width / 2; x <= b.x + b.width / 2; x += 20) {
      assert.equal(containsIn(b.area, x, b.y - 1), false, `${b.frame} 그림 아래 끝 (${x})`);
    }
    for (const side of [-1, 1]) assert.equal(containsIn(b.area, b.x + side * (b.width / 2 + 16), b.y - 20), false, `${b.frame} 옆`);
  }
});

/** VP8X(투명 WebP) 머리에서 그림 크기를 읽는다. */
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 12, 16), 'VP8X');
  return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
}

test('소품과 건물 프레임은 각 그림 안에 있다', () => {
  const root = new URL('../src/assets/village/', import.meta.url);
  const { frames } = JSON.parse(readFileSync(new URL('frames.json', root)));
  for (const frame of frames) {
    const source = readFileSync(new URL(frame.texture === 'village-home' ? 'home.png' : 'props.png', root));
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= source.readUInt32BE(16) && frame.y + frame.h <= source.readUInt32BE(20));
  }
  const buildings = JSON.parse(readFileSync(new URL('rowen/buildings.json', root))).frames;
  const size = webpSize(readFileSync(new URL('rowen/buildings.webp', root)));
  assert.deepEqual(buildings.map((f) => f.name).sort(), BUILDINGS.map((b) => b.frame).sort());
  for (const f of buildings) {
    assert.ok(f.w > 100 && f.h > 100, f.name);
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= size.width && f.y + f.h <= size.height, f.name);
  }
});

test('건물 몸체 안으로는 걸어 들어갈 수 없다 (기단만이 아니라 벽 앞까지)', () => {
  const root = new URL('../src/assets/village/rowen/', import.meta.url);
  const frames = Object.fromEntries(JSON.parse(readFileSync(new URL('buildings.json', root))).frames.map((f) => [f.name, f]));
  for (const b of BUILDINGS.filter((x) => x.frame !== 'south-gate')) {
    const height = b.width * frames[b.frame].h / frames[b.frame].w;
    for (const fy of [0.05, 0.2, 0.35, 0.45]) {
      for (const fx of [-0.35, 0, 0.35]) {
        const x = b.x + fx * b.width, y = b.y - fy * height;
        if (y < WALK_BOUNDS.top) continue;
        assert.equal(containsIn(b.area, x, y), false, `${b.frame} (${Math.round(x)}, ${Math.round(y)})`);
      }
    }
  }
});
