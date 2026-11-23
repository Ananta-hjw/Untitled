import assert from 'node:assert/strict';
import test from 'node:test';
import { fogEscape, FOG_CROW } from '../src/combat/fogCrow.ts';
import { MAPS, outdoorArtBounds, walkable } from '../src/world/maps.ts';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../src/config.ts';

test('안개 까마귀는 공격자에게서 떨어진 통행 가능한 곳으로만 옮기며 막히면 원위치에 남는다', () => {
  const from = { x: 400, y: 400 }, player = { x: 350, y: 400 };
  const p = fogEscape(from, player, (x, y) => x > 450 && y > 200 && y < 600);
  assert.ok(p && p.x > from.x);
  assert.ok(Math.hypot(p.x - from.x, p.y - from.y) <= FOG_CROW.escapeDistance + 1e-6);
  assert.ok(Math.hypot(p.x - player.x, p.y - player.y) >= FOG_CROW.minPlayerDistance);
  assert.equal(fogEscape(from, player, () => false), undefined);
  const edge = fogEscape({ x: 98, y: 50 }, { x: 90, y: 50 }, (x, y) => x >= 0 && y >= 0 && x <= 100 && y <= 100);
  if (edge) assert.ok(edge.x <= 100 && edge.y <= 100);
});

test('고갯길은 별도 큰 월드를 쓰며 소품 크기와 쉼터 입구·벽 충돌은 따로 유지한다', () => {
  const map = MAPS['east-pass'], b = outdoorArtBounds(map);
  assert.ok(b.right > WORLD_WIDTH && b.bottom > WORLD_HEIGHT);
  assert.equal(map.props.find(p => p.frame === 'stone-shelter').width, 520);
  assert.ok(walkable(map, 1800, 1380), 'open shelter floor');
  for (const [x, y] of [[1795, 1250], [1585, 1340], [2015, 1325], [4430, 790], [2000, 650], [2780, 2040]]) {
    assert.equal(walkable(map, x, y), false, `${x},${y} solid`);
  }
  assert.equal(map.enemies.filter(e => e.key === 'fog-crow').length, 6);
  for (const p of map.props.filter(p => p.texture)) assert.match(p.texture, /^east-pass-/);
});
