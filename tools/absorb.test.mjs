import assert from 'node:assert/strict';
import test from 'node:test';
import { ABSORB, NO_ABSORB, elementReady, spendElement, absorbDamageScale, absorbElementOf, absorbParry, absorbReach, activeAbsorb, insidePool } from '../src/combat/absorb.ts';
import { JUST_DODGE } from '../src/config.ts';

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
  let s = absorbParry(NO_ABSORB, 'force');
  assert.deepEqual(s, { tier: 1, element: 'force', charged: true });
  s = absorbParry(s, 'frost');
  assert.equal(s.tier, 2);
  assert.equal(s.element, 'frost');
  s = absorbParry(s, 'frost');
  s = absorbParry(s, 'mist');
  assert.equal(s.tier, ABSORB.maxTier);
  assert.equal(s.element, 'mist');
  assert.equal(absorbParry(NO_ABSORB, 'force', 2).tier, 2, '연속 패링 파훼는 두 단');
  assert.equal(absorbParry(NO_ABSORB, 'force', ABSORB.maxTier).tier, 3, '차지 패링은 단번에 가득');
});

test('담은 힘은 시간 제한이 없고, 피격·불완전 막기 등으로 NO_ABSORB로 초기화되기 전까지 계속 유지된다', () => {
  const s = absorbParry(absorbParry(NO_ABSORB, 'force'), 'force');
  assert.equal(activeAbsorb(s), s);
  assert.equal(s.tier, 2);
  assert.equal('keepMs' in ABSORB, false);
  assert.equal(activeAbsorb(NO_ABSORB), undefined);
  assert.equal(absorbParry(NO_ABSORB, 'force').tier, 1, '초기화 뒤 다시 막으면 1단부터 쌓인다');
});

test('기본 칼질은 0.5배, 1단 0.9배, 2단 1.4배, 3단 2.5배이고 회피 일섬(3배)이 3단보다 강하다', () => {
  assert.deepEqual([0, 1, 2, 3].map(absorbDamageScale), [0.5, 0.9, 1.4, 2.5]);
  assert.ok(absorbDamageScale(2) < absorbDamageScale(3) && absorbDamageScale(3) < JUST_DODGE.counterDamage);
});

test('속성은 3단일 때만 실린다', () => {
  let s = absorbParry(NO_ABSORB, 'frost');
  assert.equal(elementReady(s), false, '1단');
  s = absorbParry(s, 'frost');
  assert.equal(elementReady(s), false, '2단');
  s = absorbParry(s, 'frost');
  assert.equal(elementReady(s), true, '3단');
  assert.equal(elementReady(undefined), false);
  assert.equal(absorbReach({ tier: 2, element: 'mist', charged: true }), 1, '2단 안개는 길어지지 않는다');
});

test('속성은 정밀 패링 뒤 첫 명중 한 번에만 실리고, 단수는 그대로 남는다', () => {
  const s = absorbParry(NO_ABSORB, 'frost', 3);
  const spent = spendElement(s);
  assert.equal(spent.charged, false);
  assert.equal(spent.tier, s.tier);
  assert.equal(spendElement(spent), spent);
  assert.equal(elementReady(spent), false);
  assert.equal(elementReady(absorbParry(spent, 'frost')), true, '3단에서 다시 정밀 패링하면 또 실린다');
});

test('단수가 높을수록 세고, 3단에서 속성을 아직 싣지 않은 안개는 칼끝이 길어진다', () => {
  for (let t = 1; t <= ABSORB.maxTier; t++) assert.ok(absorbDamageScale(t) > absorbDamageScale(t - 1));
  assert.equal(absorbDamageScale(9), absorbDamageScale(ABSORB.maxTier));
  assert.equal(absorbReach(undefined), 1);
  assert.equal(absorbReach({ tier: 3, element: 'frost', charged: true }), 1);
  assert.ok(absorbReach({ tier: 3, element: 'mist', charged: true }) > 1);
  assert.equal(absorbReach({ tier: 3, element: 'mist', charged: false }), 1, '속성을 쓴 뒤에는 길어지지 않는다');
});

test('부식 웅덩이는 바닥 타원 안의 적만 갉는다', () => {
  assert.equal(insidePool(0, 0), true);
  assert.equal(insidePool(ABSORB.corrosion.rx - 1, 0), true);
  assert.equal(insidePool(ABSORB.corrosion.rx + 1, 0), false);
  assert.equal(insidePool(0, ABSORB.corrosion.ry + 1), false);
});
