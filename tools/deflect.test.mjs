import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFLECT, bendCharge, deflectDirection, pickDeflectTarget } from '../src/combat/deflect.ts';

test('흘리기 방향: 약한 입력이나 공격한 적 쪽으로 미는 입력은 흘리기가 아니다', () => {
  // 적이 오른쪽에 있다.
  assert.equal(deflectDirection(0, 0, 100, 0), undefined);
  assert.equal(deflectDirection(DEFLECT.minInput - 0.01, 0, -100, 0), undefined, '약한 입력');
  assert.equal(deflectDirection(1, 0, 100, 0), undefined, '적 쪽으로 밀기');
  assert.deepEqual(deflectDirection(0, 1, 100, 0), { x: 0, y: 1 }, '아래로 흘린다');
  assert.deepEqual(deflectDirection(-1, 0, 100, 0), { x: -1, y: 0 }, '뒤로 흘린다');
  const d = deflectDirection(0.3, 0.95, 100, 0);
  assert.ok(d && Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9);
});

test('흘린 돌진은 흘린 쪽으로 꺾인다', () => {
  const bent = bendCharge({ x: 1, y: 0 }, { x: 0, y: 1 });
  assert.ok(Math.abs(Math.hypot(bent.x, bent.y) - 1) < 1e-9);
  assert.ok(bent.y > bent.x, '대부분 흘린 쪽');
  assert.deepEqual(bendCharge({ x: 1, y: 0 }, { x: -1, y: 0 }, 0.5), { x: -1, y: 0 }, '정반대로 꺾여 겹치면 흘린 쪽');
});

test('흘린 힘은 흘린 쪽 부채꼴 안의 가장 가까운 적에게 맞는다', () => {
  const from = { x: 0, y: 0 };
  const dir = { x: 1, y: 0 };
  const list = [{ x: 150, y: 0 }, { x: 80, y: 10 }, { x: -60, y: 0 }, { x: 60, y: 200 }];
  assert.equal(pickDeflectTarget(from, dir, list, 0.6), 1);
  assert.equal(pickDeflectTarget(from, dir, [{ x: DEFLECT.reach + 10, y: 0 }], 0.6), -1, '너무 멀다');
  assert.equal(pickDeflectTarget(from, dir, [{ x: -50, y: 0 }], 0.6), -1, '뒤쪽');
  assert.equal(pickDeflectTarget(from, { x: 0, y: 1 }, [{ x: 0, y: 90 }], 0.6), 0, '세로는 바닥 거리로 잰다');
});
