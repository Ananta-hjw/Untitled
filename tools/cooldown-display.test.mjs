import assert from 'node:assert/strict';
import test from 'node:test';
import { cooldownDisplay } from '../src/ui/cooldownDisplay.ts';

test('재사용 대기 표시는 게임 시계의 소수 오차로 1초 더 많아 보이지 않는다', () => {
  // 1573.36ms에서 시작해 50ms를 100번 더하면 남은 시간이 5000.000000000001ms가 된다.
  const start = 1573.3629902798957;
  let now = start;
  for (let i = 0; i < 100; i++) now += 50;
  const remaining = start + 10000 - now;
  assert.notEqual(remaining, 5000, '이 경우 실제로 오차가 생긴다');
  assert.deepEqual(cooldownDisplay(remaining, 10000), { step: 180, seconds: 5 });
});

test('남은 시간에 맞는 초와 각도를 보여 주고, 끝나면 0이다', () => {
  assert.deepEqual(cooldownDisplay(10000, 10000), { step: 360, seconds: 10 });
  assert.deepEqual(cooldownDisplay(4001, 10000), { step: 145, seconds: 5 });
  assert.deepEqual(cooldownDisplay(1, 10000), { step: 1, seconds: 1 });
  assert.deepEqual(cooldownDisplay(0.2, 10000), { step: 0, seconds: 0 });
  assert.deepEqual(cooldownDisplay(-30, 10000), { step: 0, seconds: 0 });
});
