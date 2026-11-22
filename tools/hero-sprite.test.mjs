import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACTION_DURATION, attackVector, guardFrame, heroFrame, insideAttackLane, movementFacing } from '../src/entities/heroFrames.ts';
import { PLAYER } from '../src/config.ts';
import { attackPoseTime, isAttackFollowPause } from '../src/entities/attackTiming.ts';

const root = new URL('../src/assets/hero/academy/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('frames.json', root)));
const attackFrontData = JSON.parse(readFileSync(new URL('combo-proto/attack-front_frames.json', root)));
const attackDownDiagData = JSON.parse(readFileSync(new URL('combo-proto/attack-down-diag_frames.json', root)));
const allFrames = [...data.frames, ...attackFrontData.frames, ...attackDownDiagData.frames];

test('원본 4방향 시트는 Unity 아래쪽 좌표를 Phaser 위쪽 좌표로 변환한다', () => {
  const original = JSON.parse(readFileSync(new URL('player_walk_atlas.json', root)));
  for (let i = 0; i < 16; i++) {
    const source = original.frames[i], frame = data.frames[i];
    // 영역은 실제로 그리는 unarmed 시트의 그림 전체로 넓혔고, 발은 그 그림의 위치(최대 2px 위)로 옮겼다.
    const foot = frame.y + frame.originY * frame.h;
    const bottom = original.height - source.y;
    assert.ok(foot <= bottom && foot >= bottom - 2, frame.name);
    assert.ok(frame.h >= source.height);
    assert.equal(frame.scale, 1);
  }
});

test('72개 프레임의 영역과 발·검 기준점은 원본 시트 안에 있다', () => {
  assert.equal(data.frames.length, 72);
  assert.equal(new Set(data.frames.map((f) => f.name)).size, 72);
  const pngs = new Map(['walk', 'combat', 'diagonal', 'attack-down', 'attack-up'].map((name) => {
    const file = name === 'diagonal' ? 'player_walk_diagonal.png' : `player_${name.replace('-', '_')}.png`;
    const png = readFileSync(new URL(file, root));
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
  for (const [row, facing] of ['down-left', 'down-right', 'up-left', 'up-right'].entries()) {
    assert.equal(heroFrame('idle', facing, 900), `diagonal-${row * 4}`);
    assert.deepEqual([0, 125, 250, 375, 500].map((t) => heroFrame('walk', facing, t)),
      [1, 2, 3, 2, 1].map((col) => `diagonal-${row * 4 + col}`));
  }
  assert.equal(movementFacing(0, 0, 'up', true), 'up');
  assert.equal(movementFacing(0, -2, 'down', false), 'up');
  assert.equal(movementFacing(0, 2, 'up', false), 'down');
  assert.equal(movementFacing(-2, 0, 'down', false), 'left');
  assert.equal(movementFacing(2, 0, 'down', false), 'right');
  assert.equal(movementFacing(-1, 1, 'down', false), 'down-left');
  assert.equal(movementFacing(1, 1, 'down', false), 'down-right');
  assert.equal(movementFacing(-1, -1, 'up', false), 'up-left');
  assert.equal(movementFacing(1, -1, 'up', false), 'up-right');
  assert.equal(movementFacing(0, 0, 'up-left', true), 'up-left');
  assert.equal(movementFacing(1, .5, 'right', true), 'right');
  assert.equal(movementFacing(1, .7, 'right', true), 'down-right');
  assert.equal(movementFacing(1, .3, 'down-right', true), 'down-right');
  assert.equal(movementFacing(1, .2, 'down-right', true), 'right');
  assert.equal(movementFacing(-1, -.1, 'left', true), 'left');
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

test('대각선 4방향은 각 콤보에서 전용 타격 그림을 선택한다', () => {
  for (const facing of ['down-left', 'down-right', 'up-left', 'up-right']) {
    for (let stage = 0; stage < 3; stage++) {
      const frame = heroFrame(`attack${stage + 1}`, facing, PLAYER.combo[stage].hitDelayMs + 30);
      assert.equal(frame, `${facing.startsWith('up') ? 'attack-up' : 'attack-down-diag'}-${stage * 4 + 2}`);
      assert.ok(allFrames.find((f) => f.name === frame).blade);
    }
  }
});

test('회전한 타격 레인은 앞쪽만 허용하고 뒤쪽·옆 레인은 제외한다', () => {
  for (const facing of ['left', 'right', 'down-left', 'down-right', 'up-left', 'up-right']) {
    const direction = attackVector(facing);
    assert.ok(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-9);
    const x = direction.x * 100, y = direction.y * 100 * .7;
    assert.equal(insideAttackLane(x, y, direction, 52, .7), true, facing);
    assert.equal(insideAttackLane(-x, -y, direction, 52, .7), false, facing);
    const length = Math.hypot(x, y);
    assert.equal(insideAttackLane(x - y / length * 53, y + x / length * 53, direction, 52, .7), false, facing);
  }
  assert.equal(insideAttackLane(100, 52, { x: 1, y: 0 }, 52, .7), true);
});

test('각 타격 뒤 여섯 방향의 자세를 잠깐 유지하고 명중 구간 이후에만 쉬며 회복 동작을 이어간다', () => {
  for (const [stage, combo] of PLAYER.combo.entries()) {
    const action = `attack${stage + 1}`, start = combo.followPauseAtMs, end = start + combo.followPauseMs;
    assert.ok(start > combo.hitDelayMs + PLAYER.hitWindowMs);
    assert.ok(start > combo.lungeEndMs);
    assert.ok(combo.intervalMs >= end);
    assert.equal(ACTION_DURATION[action], [420, 320, 400][stage] + combo.followPauseMs);
    for (const facing of ['left', 'right', 'up-left', 'up-right', 'down-left', 'down-right']) {
      const held = heroFrame(action, facing, start);
      for (let elapsed = start; elapsed < end; elapsed += 5) {
        assert.equal(isAttackFollowPause(stage, elapsed), true);
        assert.equal(heroFrame(action, facing, elapsed), held);
      }
    }
    assert.equal(isAttackFollowPause(stage, start - 1), false);
    assert.equal(isAttackFollowPause(stage, end), false);
    assert.equal(attackPoseTime(stage, end + 20), start + 20);
  }
});

test('검 막기는 50도 기울인 칼날 중간을 왼손으로 받치고 오른손으로 손잡이를 잡는다', () => {
  const guard = JSON.parse(readFileSync(new URL('guard/frames.json', root)));
  assert.equal(guard.frames.length, 5);
  assert.equal(guardFrame('down'), 'guard-front');
  assert.equal(guardFrame('up'), 'guard-back');
  assert.notEqual(guardFrame('down'), guardFrame('down-right'));
  assert.notEqual(guardFrame('up'), guardFrame('up-right'));
  for (const facing of ['left','right','down','up','down-left','down-right','up-left','up-right']) {
    assert.ok(guard.frames.some(f => f.name === guardFrame(facing)));
  }
  for (const f of guard.frames) {
    assert.equal(f.originY, 1);
    const { base, tip } = f.blade;
    assert.ok(tip.y < base.y);
    assert.equal(tip.x > base.x, f.name !== 'guard-back');
    assert.ok(Math.abs(f.supportGrip.x - f.grip.x) > 60, 'hands are separated in front of the body');
    assert.ok(Math.abs(f.supportGrip.x - (base.x + tip.x) / 2) < 1e-6);
    assert.ok(Math.abs(f.supportGrip.y - (base.y + tip.y) / 2) < 1e-6, 'left palm supports blade midpoint');
    assert.ok(f.grip.y>165, 'hilt hand stays below the chest');
    assert.ok(f.supportGrip.y<f.grip.y-30, 'support palm is above the hilt hand');
    const vx=tip.x-base.x,vy=tip.y-base.y;
    const distance=Math.abs((f.supportGrip.x-base.x)*vy-(f.supportGrip.y-base.y)*vx)/Math.hypot(vx,vy);
    assert.ok(distance<1e-6,'blade runs through the support palm');
    const rear = f.name === 'guard-back' || f.name === 'guard-up-back';
    assert.equal(!!f.weaponBehind, rear, 'rear weapons stay behind the body');
    assert.equal(!!f.supportCover, !rear, 'rear hands are hidden in the body art');
    const tilt=Math.atan2(Math.abs(vx),Math.abs(vy))*180/Math.PI;
    assert.ok(Math.abs(tilt-50)<1e-6, '50 degrees from vertical');
    assert.ok(Math.abs(f.supportGrip.x-f.supportPalm.x)<14, 'contact stays within the palm');

    assert.ok(Math.abs(Math.hypot(tip.x-base.x,tip.y-base.y)-150)<1e-6);
    assert.ok(Math.abs(Math.hypot(base.x-f.grip.x,base.y-f.grip.y)-12)<1e-6);
  }
});
