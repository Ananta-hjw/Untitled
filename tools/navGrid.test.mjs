import assert from 'node:assert/strict';
import test from 'node:test';
import { NavGrid } from '../src/world/navGrid.ts';

// 400x200 바닥. 가운데에 위에서 내려온 벽(x 180~220, y 0~140)이 있어 아래로 돌아가야 한다.
const contains = (x, y) => x >= 0 && x < 400 && y >= 0 && y < 200 && !(x >= 180 && x < 220 && y < 140);
const makeGrid = () => new NavGrid(0, 0, 400, 200, 20, contains);

function walk(grid, from, limit = 200) {
  const position = { ...from };
  const next = { x: 0, y: 0 };
  let steps = 0;
  let lowest = position.y;
  while (grid.next(position.x, position.y, next)) {
    assert.ok(contains(next.x, next.y), '막힌 칸으로 안내하면 안 된다');
    position.x = next.x;
    position.y = next.y;
    lowest = Math.max(lowest, position.y);
    assert.ok(++steps < limit, '목표에 도착하지 못하고 맴돈다');
  }
  return { position, steps, lowest };
}

test('벽 반대편의 목표까지 벽을 돌아서 도착한다', () => {
  const grid = makeGrid();
  grid.setTarget(350, 30);
  const { position, lowest } = walk(grid, { x: 50, y: 30 });
  assert.ok(Math.abs(position.x - 350) <= 20 && Math.abs(position.y - 30) <= 20);
  // 벽(y 140까지)을 뚫지 않고 그 아래로 돌아갔어야 한다.
  assert.ok(lowest >= 140);
});

test('목표 칸에 있거나 길이 없으면 안내하지 않는다', () => {
  const grid = makeGrid();
  grid.setTarget(350, 30);
  const out = { x: 0, y: 0 };
  assert.equal(grid.next(350, 30, out), false);

  // 사방이 벽으로 둘러싸인 방 안의 목표
  const inRing = (x, y) => x >= 60 && x < 140 && y >= 60 && y < 140 && !(x >= 80 && x < 120 && y >= 80 && y < 120);
  const island = new NavGrid(0, 0, 200, 200, 20, (x, y) => !inRing(x, y));
  island.setTarget(100, 100);
  assert.equal(island.next(20, 20, out), false);
});

test('목표가 같은 칸에 있는 동안은 결과가 같고, 옮겨 가면 새 목표로 안내한다', () => {
  const grid = makeGrid();
  grid.setTarget(350, 30);
  grid.setTarget(355, 35);
  assert.ok(Math.abs(walk(grid, { x: 50, y: 30 }).position.x - 350) <= 20);
  grid.setTarget(50, 170);
  const { position } = walk(grid, { x: 350, y: 30 });
  assert.ok(Math.abs(position.x - 50) <= 20 && Math.abs(position.y - 170) <= 20);
});
