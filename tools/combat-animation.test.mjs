import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER } from '../src/config.ts';
import { HERO_ANIMATIONS } from '../src/entities/heroAnimations.ts';

test('3타는 팔을 뻗은 유지 구간에 타격한다', () => {
  const animation = HERO_ANIMATIONS.attack3;
  const phase = PLAYER.combo[2].hitDelayMs / (animation.duration * 1000);
  const pose = animation.pose(phase);
  assert.ok(phase >= 0.42 && phase <= 0.72);
  assert.ok(pose.upper_arm_r < -70);
  assert.equal(pose.forearm_r, -18);
});

test('1·2타는 기본 자세로 복귀하기 전에 다음 공격으로 연결한다', () => {
  for (const stage of [0, 1]) {
    const combo = PLAYER.combo[stage];
    const animation = HERO_ANIMATIONS[`attack${stage + 1}`];
    const phase = combo.intervalMs / (animation.duration * 1000);
    assert.ok(combo.intervalMs > combo.hitDelayMs);
    assert.ok(combo.intervalMs > combo.lungeEndMs);
    assert.ok(phase < 1);
    assert.ok(Math.abs(animation.pose(phase).upper_arm_r - 5) > 20);
  }
});

test('3타 종료와 다음 콤보 시작 사이에 빈 대기 시간을 두지 않는다', () => {
  assert.equal(PLAYER.combo[2].intervalMs, HERO_ANIMATIONS.attack3.duration * 1000);
});
