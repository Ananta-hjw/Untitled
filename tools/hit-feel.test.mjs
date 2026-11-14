import assert from 'node:assert/strict';
import test from 'node:test';
import { HIT_FEEL, JUST_DODGE } from '../src/config.ts';
import { gameTimeScale, hitSquash, hitStopMs } from '../src/combat/hitFeel.ts';

test('히트스톱 중에는 게임 시간이 멈추고, 끝나면 느린 화면 또는 원래 속도로 흐른다', () => {
  assert.equal(gameTimeScale(10, 0), 0);
  assert.equal(gameTimeScale(10, JUST_DODGE.slowMs), 0);
  assert.equal(gameTimeScale(0, 0), 1);
  assert.equal(gameTimeScale(0, JUST_DODGE.slowMs), JUST_DODGE.slowScale);
});

test('강한 타격일수록 오래 멈춘다', () => {
  assert.ok(hitStopMs('normal') < hitStopMs('finisher'));
  assert.ok(hitStopMs('finisher') < hitStopMs('counter'));
  assert.ok(hitStopMs('hurt') > 0);
  // 한 번에 0.15초를 넘게 멈추면 조작이 끊긴 느낌이 든다.
  for (const kind of ['normal', 'finisher', 'counter', 'hurt']) assert.ok(hitStopMs(kind) <= 150, kind);
});

test('맞는 순간 납작해졌다가 출렁이며 원래 모양으로 돌아온다', () => {
  const start = hitSquash(0);
  assert.ok(start.scaleX > 1 && start.scaleY < 1);
  assert.deepEqual(hitSquash(HIT_FEEL.squashMs), { scaleX: 1, scaleY: 1 });
  assert.deepEqual(hitSquash(-5), { scaleX: 1, scaleY: 1 });
  // 중간에 한 번은 반대로(길쭉하게) 튄다
  let stretched = false;
  for (let t = 0; t < HIT_FEEL.squashMs; t += 5) if (hitSquash(t).scaleX < 1) stretched = true;
  assert.ok(stretched);
  // 시간이 갈수록 흔들림이 줄어든다
  assert.ok(Math.abs(hitSquash(HIT_FEEL.squashMs * 0.9).scaleX - 1) < Math.abs(start.scaleX - 1));
});
