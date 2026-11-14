import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACTION_DURATION, heroFrame, movementFacing } from '../src/entities/heroFrames.ts';
import { PLAYER } from '../src/config.ts';

const root = new URL('../src/assets/hero/academy/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('frames.json', root)));

test('원본 4방향 시트는 Unity 아래쪽 좌표를 Phaser 위쪽 좌표로 변환한다', () => {
  const original = JSON.parse(readFileSync(new URL('player_walk_atlas.json', root)));
  for (let i = 0; i < 16; i++) {
    const source = original.frames[i], frame = data.frames[i];
    assert.equal(frame.y, original.height - source.y - source.height);
    assert.equal(frame.h, source.height);
    assert.equal(frame.originY, 1);
    assert.equal(frame.scale, 1);
  }
});

test('32개 프레임의 영역과 발·검 기준점은 원본 시트 안에 있다', () => {
  assert.equal(data.frames.length, 32);
  assert.equal(new Set(data.frames.map((f) => f.name)).size, 32);
  const pngs = new Map(['walk', 'combat'].map((name) => {
    const png = readFileSync(new URL(`player_${name}.png`, root));
    return [`hero-academy-${name}`, { w: png.readUInt32BE(16), h: png.readUInt32BE(20) }];
  }));
  for (const frame of data.frames) {
    const size = pngs.get(frame.texture);
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= size.w && frame.y + frame.h <= size.h);
    assert.ok(frame.originX >= 0 && frame.originX <= 1);
    assert.ok(frame.originY > 0 && frame.originY <= 1.01);
    if (frame.blade) {
      for (const point of [frame.blade.base, frame.blade.tip]) {
        assert.ok(point.x >= -2 && point.x <= frame.w + 2, frame.name);
        assert.ok(point.y >= -2 && point.y <= frame.h + 2, frame.name);
      }
    }
  }
});

test('걷기는 방향별 실제 그림과 8fps의 1→2→3→2 순서를 사용한다', () => {
  for (const [row, facing] of ['down', 'left', 'right', 'up'].entries()) {
    assert.equal(heroFrame('idle', facing, 900), `walk-${row * 4}`);
    assert.deepEqual([0, 125, 250, 375, 500].map((t) => heroFrame('walk', facing, t)),
      [1, 2, 3, 2, 1].map((col) => `walk-${row * 4 + col}`));
  }
  assert.equal(movementFacing(0, 0, 'up', true), 'up');
  assert.equal(movementFacing(0, -2, 'down', false), 'up');
  assert.equal(movementFacing(0, 2, 'up', false), 'down');
  assert.equal(movementFacing(-2, 0, 'down', false), 'left');
  assert.equal(movementFacing(2, 0, 'down', false), 'right');
  assert.equal(movementFacing(1, 1.1, 'right', true), 'right');
  assert.equal(movementFacing(1, 1.3, 'right', true), 'down');
});

test('각 콤보의 실제 타격 그림은 명중 구간 안에 표시되고 3타는 다음 콤보 전에 끝난다', () => {
  for (let stage = 0; stage < 3; stage++) {
    const action = `attack${stage + 1}`;
    const frame = heroFrame(action, 'right', PLAYER.combo[stage].hitDelayMs + 30);
    assert.equal(frame, `combat-${stage * 4 + 2}`);
    assert.ok(data.frames.find((f) => f.name === frame).blade);
    assert.ok(ACTION_DURATION[action] >= PLAYER.combo[stage].intervalMs);
  }
  assert.equal(ACTION_DURATION.attack3, PLAYER.combo[2].intervalMs);
});
