import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY, JUST_DODGE } from '../src/config.ts';
import { isJustDodge, slowMotionScale, strikeReaches } from '../src/combat/justDodge.ts';

test('공격이 닿기 직전에 시작한 회피만 저스트 회피다', () => {
  const strike = 1000;
  const w = JUST_DODGE.windowMs;
  assert.equal(isJustDodge(strike - 10, strike, w), true);
  assert.equal(isJustDodge(strike - w, strike, w), true);
  assert.equal(isJustDodge(strike - w - 1, strike, w), false, '너무 일찍 피함');
  assert.equal(isJustDodge(strike + 30, strike, w), true, '닿은 프레임에 누름');
  assert.equal(isJustDodge(strike + 80, strike, w), false, '이미 늦음');
  assert.equal(isJustDodge(undefined, strike, w), false);
});

test('돌진은 적이 바라보는 쪽 앞의 일정 범위만 닿는다', () => {
  assert.equal(strikeReaches(0, 0, 1, 60, 0), true);
  assert.equal(strikeReaches(0, 0, 1, ENEMY.strikeRangeX, 0), true);
  assert.equal(strikeReaches(0, 0, 1, ENEMY.strikeRangeX + 1, 0), false);
  assert.equal(strikeReaches(0, 0, 1, -60, 0), false, '등 뒤');
  assert.equal(strikeReaches(0, 0, -1, -60, 0), true, '왼쪽을 보면 왼쪽이 앞');
  assert.equal(strikeReaches(0, 0, 1, 60, ENEMY.strikeRangeY + 1), false, '다른 줄');
});

test('느린 화면은 정해진 배율로 시작해 끝에서 부드럽게 원래 속도로 돌아온다', () => {
  const { slowScale, rampMs } = JUST_DODGE;
  assert.equal(slowMotionScale(JUST_DODGE.slowMs, slowScale, rampMs), slowScale);
  assert.equal(slowMotionScale(rampMs, slowScale, rampMs), slowScale);
  assert.equal(slowMotionScale(0, slowScale, rampMs), 1);
  let previous = slowScale;
  for (let remaining = rampMs; remaining >= 0; remaining -= 10) {
    const value = slowMotionScale(remaining, slowScale, rampMs);
    assert.ok(value >= previous - 1e-12 && value <= 1);
    previous = value;
  }
});

test('저스트 회피는 3배 반격 일섬을 열고 회피 대기 시간을 30% 단축한다', () => {
  assert.equal(JUST_DODGE.counterDamage, 3);
  assert.equal(JUST_DODGE.cooldownRefundRatio, 0.3);
});
