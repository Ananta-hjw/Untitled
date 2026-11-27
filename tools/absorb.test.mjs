import assert from 'node:assert/strict';
import test from 'node:test';
import { ABSORB, NO_ABSORB, elementReady, spendElement, absorbDamageScale, absorbElementOf, absorbParry, absorbReach, activeAbsorb, insidePool } from '../src/combat/absorb.ts';

test('막은 적의 속성: 딱정벌레는 서리, 부식 권속과 나방은 부식, 안개 계열은 안개, 나머지는 기운', () => {
  assert.equal(absorbElementOf('frost-beetle'), 'frost');
  assert.equal(absorbElementOf('corrosion-tracker'), 'corrosion');
  assert.equal(absorbElementOf('corrosion-executioner'), 'corrosion');
  assert.equal(absorbElementOf('ashen-moth'), 'corrosion');
  assert.equal(absorbElementOf('mist-phantom'), 'mist');
  assert.equal(absorbElementOf('fog-crow'), 'mist');
  assert.equal(absorbElementOf('slime'), 'force');
  assert.equal(absorbElementOf(undefined), 'force');
});

test('정밀 패링마다 한 단씩 최대 3단까지 쌓이고, 속성은 마지막에 막은 적을 따른다', () => {
  let s = absorbParry(NO_ABSORB, 'force', 1000);
  assert.deepEqual(s, { tier: 1, element: 'force', until: 1000 + ABSORB.keepMs, charged: true });
  s = absorbParry(s, 'frost', 1500);
  assert.equal(s.tier, 2);
  assert.equal(s.element, 'frost');
  s = absorbParry(s, 'frost', 1800);
  s = absorbParry(s, 'mist', 2000);
  assert.equal(s.tier, ABSORB.maxTier);
  assert.equal(s.element, 'mist');
  assert.equal(absorbParry(NO_ABSORB, 'force', 0, 2).tier, 2, '연속 패링 파훼는 두 단');
  assert.equal(absorbParry(NO_ABSORB, 'force', 0, ABSORB.maxTier).tier, 3, '차지 패링은 단번에 가득');
});

test('담은 힘은 keepMs가 지나면 사라지고, 사라진 뒤 막으면 1단부터 다시 쌓인다', () => {
  const s = absorbParry(absorbParry(NO_ABSORB, 'force', 0), 'force', 100);
  assert.ok(activeAbsorb(s, 100 + ABSORB.keepMs - 1));
  assert.equal(activeAbsorb(s, 100 + ABSORB.keepMs), undefined);
  assert.equal(absorbParry(s, 'force', 100 + ABSORB.keepMs).tier, 1);
  assert.equal(activeAbsorb(NO_ABSORB, 0), undefined);
});

test('기본 칼질은 0.3배, 1단 0.65배, 2단 1.1배, 3단 2.5배이고 3초 동안 이어진다', () => {
  assert.equal(ABSORB.keepMs, 3000);
  assert.deepEqual([0, 1, 2, 3].map(absorbDamageScale), [0.3, 0.65, 1.1, 2.5]);
});

test('속성은 3단일 때만 실린다', () => {
  let s = absorbParry(NO_ABSORB, 'frost', 0);
  assert.equal(elementReady(s), false, '1단');
  s = absorbParry(s, 'frost', 100);
  assert.equal(elementReady(s), false, '2단');
  s = absorbParry(s, 'frost', 200);
  assert.equal(elementReady(s), true, '3단');
  assert.equal(elementReady(undefined), false);
  assert.equal(absorbReach({ tier: 2, element: 'mist', until: 1, charged: true }), 1, '2단 안개는 길어지지 않는다');
});

test('속성은 정밀 패링 뒤 첫 명중 한 번에만 실리고, 단수와 남은 시간은 그대로 남는다', () => {
  const s = absorbParry(NO_ABSORB, 'frost', 0, 3);
  const spent = spendElement(s);
  assert.equal(spent.charged, false);
  assert.equal(spent.tier, s.tier);
  assert.equal(spent.until, s.until);
  assert.equal(spendElement(spent), spent);
  assert.equal(elementReady(spent), false);
  assert.equal(elementReady(absorbParry(spent, 'frost', 100)), true, '3단에서 다시 정밀 패링하면 또 실린다');
});

test('단수가 높을수록 세고, 3단에서 속성을 아직 싣지 않은 안개는 칼끝이 길어진다', () => {
  for (let t = 1; t <= ABSORB.maxTier; t++) assert.ok(absorbDamageScale(t) > absorbDamageScale(t - 1));
  assert.equal(absorbDamageScale(9), absorbDamageScale(ABSORB.maxTier));
  assert.equal(absorbReach(undefined), 1);
  assert.equal(absorbReach({ tier: 3, element: 'frost', until: 1, charged: true }), 1);
  assert.ok(absorbReach({ tier: 3, element: 'mist', until: 1, charged: true }) > 1);
  assert.equal(absorbReach({ tier: 3, element: 'mist', until: 1, charged: false }), 1, '속성을 쓴 뒤에는 길어지지 않는다');
});

test('부식 웅덩이는 바닥 타원 안의 적만 갉는다', () => {
  assert.equal(insidePool(0, 0), true);
  assert.equal(insidePool(ABSORB.corrosion.rx - 1, 0), true);
  assert.equal(insidePool(ABSORB.corrosion.rx + 1, 0), false);
  assert.equal(insidePool(0, ABSORB.corrosion.ry + 1), false);
});
