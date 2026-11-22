import assert from 'node:assert/strict';
import test from 'node:test';
import { DODGE, PLAYER } from '../src/config.ts';
import { dodgeProgress, lungeProgress, locomotionRate } from '../src/entities/movement.ts';

test('모든 콤보는 준비 중에 정지하고 타격 구간에서 정해진 거리만 전진한다', () => {
  for (const combo of PLAYER.combo) {
    const { lungeStartMs: start, lungeEndMs: end, lungeDistance: distance } = combo;
    assert.equal(lungeProgress(0, start, end), 0);
    assert.equal(lungeProgress(start, start, end), 0);
    assert.ok(combo.hitDelayMs > start && combo.hitDelayMs < end);
    for (const fps of [20, 30, 60, 120]) {
      let previous = 0;
      let moved = 0;
      for (let time = 0; time < end + 1000 / fps; time += 1000 / fps) {
        const progress = lungeProgress(time, start, end);
        moved += (progress - previous) * distance;
        previous = progress;
      }
      assert.ok(Math.abs(moved - distance) < 1e-9);
    }
  }
});

test('벽에 막히면 걷기가 멈추고 느린 입력과 세로 이동은 느리게 재생된다', () => {
  const dt = 1 / 60;
  assert.equal(locomotionRate(0, 0, dt, 300), 0);
  assert.equal(locomotionRate(5, 0, dt, 300), 1);
  assert.equal(locomotionRate(0, 3.5, dt, 300), 0.7);
  assert.equal(locomotionRate(0.05, 0, dt, 300), 0.01);
  assert.equal(locomotionRate(0, 0, 0, 300), 0);
  assert.equal(locomotionRate(3, 4, dt, 300), 1);
});

test('회피는 프레임 속도와 관계없이 정해진 거리를 가고, 처음이 끝보다 빠르다', () => {
  const duration = DODGE.durationMs;
  assert.equal(dodgeProgress(0, duration), 0);
  assert.equal(dodgeProgress(duration, duration), 1);
  assert.equal(dodgeProgress(duration * 3, duration), 1);
  assert.ok(dodgeProgress(duration / 2, duration) > 0.5);
  for (const fps of [20, 30, 60, 120]) {
    let previous = 0;
    let moved = 0;
    // 회피는 시작한 다음 프레임부터 움직이고, 진행도가 1이 되는 프레임에 끝난다.
    for (let time = 1000 / fps; previous < 1; time += 1000 / fps) {
      const progress = dodgeProgress(time, duration);
      moved += (progress - previous) * DODGE.distance;
      previous = progress;
    }
    assert.ok(Math.abs(moved - DODGE.distance) < 1e-9);
  }
});

test('1·2·3타 모두 전진이 끝난 뒤에 다음 공격으로 이어진다', () => {
  for (const combo of PLAYER.combo) {
    assert.ok(combo.intervalMs > combo.hitDelayMs);
    assert.ok(combo.intervalMs > combo.lungeEndMs);
  }
});
