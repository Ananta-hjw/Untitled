import assert from 'node:assert/strict';
import test from 'node:test';
import { IDLE_FPS, PLAY_FPS, shouldRunFrame } from '../src/core/frameRate.ts';

/** refreshHz 화면에서 1초 동안 몇 번 그리는지 (requestAnimationFrame 간격을 그대로 흉내 낸다) */
function drawsPerSecond(refreshHz, fps, jitter = 0) {
  let last = 0, draws = 0;
  for (let i = 1; i <= refreshHz; i++) {
    const time = i * 1000 / refreshHz + (i % 2 ? jitter : -jitter);
    if (shouldRunFrame(time - last, fps)) { draws++; last = time; }
  }
  return draws;
}

test('플레이 중에는 60Hz 화면에서 매번 그리고, 120Hz·144Hz 화면에서도 1초에 60~72번만 그린다', () => {
  assert.equal(drawsPerSecond(60, PLAY_FPS), 60);
  // 60Hz 화면의 간격이 조금 흔들려도 건너뛰지 않는다.
  assert.equal(drawsPerSecond(60, PLAY_FPS, 1.5), 60);
  assert.equal(drawsPerSecond(120, PLAY_FPS), 60);
  const at144 = drawsPerSecond(144, PLAY_FPS);
  assert.ok(at144 >= 48 && at144 <= 72, String(at144));
});

test('메뉴·대화가 열려 멈춘 동안에는 1초에 30번만 그린다', () => {
  assert.equal(drawsPerSecond(60, IDLE_FPS), 30);
  assert.equal(drawsPerSecond(120, IDLE_FPS), 30);
});
