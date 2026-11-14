import assert from 'node:assert/strict';
import test from 'node:test';
import { DODGE, PLAYER } from '../src/config.ts';
import { dodgeDistanceRatio, lungeProgress, locomotionRate } from '../src/entities/movement.ts';

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

test('회피 누적 거리는 시간 경계를 포함하고 모든 프레임 속도에서 설정 거리와 일치한다', () => {
  assert.equal(dodgeDistanceRatio(-1), 0);
  assert.equal(dodgeDistanceRatio(0), 0);
  assert.equal(dodgeDistanceRatio(1), 1);
  assert.equal(dodgeDistanceRatio(2), 1);
  assert.ok(dodgeDistanceRatio(0.25) > 1 - dodgeDistanceRatio(0.75));
  for (const fps of [20, 30, 60, 120, 144]) {
    let previous = 0;
    let distance = 0;
    for (let t = 0; t < DODGE.durationMs + 1000 / fps; t += 1000 / fps) {
      const progress = dodgeDistanceRatio(t / DODGE.durationMs);
      assert.ok(progress >= previous);
      distance += (progress - previous) * DODGE.distance;
      previous = progress;
    }
    assert.ok(Math.abs(distance - DODGE.distance) < 1e-9);
  }
});
