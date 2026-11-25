import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTACK_FEEL, BLOCK } from '../src/config.ts';
import {
  attackTrailStyle,
  attackZoomPeak,
  counterLungeDistance,
  damageNumberMotion,
  isHitComboActive,
  nextHitCombo,
} from '../src/combat/attackFeel.ts';
import { hitStopMs } from '../src/combat/hitFeel.ts';

test('검기 스타일은 반격 > 공명 > 3타 마무리 > 2타 > 1타 우선순위로 구분된다', () => {
  assert.equal(attackTrailStyle(0, false, false), 'stage1');
  assert.equal(attackTrailStyle(1, false, false), 'stage2');
  assert.equal(attackTrailStyle(2, false, false), 'finisher');
  assert.equal(attackTrailStyle(0, false, true), 'resonance');
  assert.equal(attackTrailStyle(2, false, true), 'resonance');
  assert.equal(attackTrailStyle(0, true, false), 'counter');
  assert.equal(attackTrailStyle(2, true, true), 'counter', '반격 일섬은 공명 중에도 청백 일섬으로 구분된다');
});

test('반격 돌진 일섬은 목표 적 앞까지 거리를 자동 보정해 꽂히고, 일반 공격은 기본 전진 거리를 유지한다', () => {
  assert.equal(counterLungeDistance(13, 180, false), 13);
  assert.equal(counterLungeDistance(46, undefined, true), ATTACK_FEEL.counterRushDefaultLunge);
  assert.equal(
    counterLungeDistance(46, 180, true),
    180 - ATTACK_FEEL.counterRushStopGap,
    '적 바로 앞(stopGap)에서 멈추도록 거리를 맞춘다',
  );
  assert.equal(counterLungeDistance(46, 40, true), ATTACK_FEEL.counterRushMinLunge, '가까워도 최소 돌진 거리 보장');
  assert.equal(counterLungeDistance(46, 400, true), ATTACK_FEEL.counterRushMaxLunge, '너무 멀어도 최대 돌진 거리 상한');
});

test('연속 히트 카운터는 유지 시간 안에 누적되고 시간이 지나면 만료된다', () => {
  let combo = { count: 0, lastAt: -Infinity };
  combo = nextHitCombo(combo, 1000, 1);
  assert.equal(combo.count, 1);
  assert.equal(isHitComboActive(combo, 1000 + ATTACK_FEEL.comboTimeoutMs), true);
  combo = nextHitCombo(combo, 2500, 3);
  assert.equal(combo.count, 4);
  assert.equal(isHitComboActive(combo, 2500 + ATTACK_FEEL.comboTimeoutMs + 1), false);
  combo = nextHitCombo(combo, 2500 + ATTACK_FEEL.comboTimeoutMs + 10, 1);
  assert.equal(combo.count, 1, '만료 뒤 새 타격은 1부터 다시 시작');
});

test('공격·처치 카메라 줌과 히트스톱은 일반 < 치명타 < 3타 < 처치 < 반격 < 마지막 적 막타 위계를 따른다', () => {
  assert.equal(attackZoomPeak('normal', false, false), 1);
  assert.ok(attackZoomPeak('crit', false, false) > 1);
  assert.ok(attackZoomPeak('finisher', false, false) > attackZoomPeak('crit', false, false));
  assert.ok(attackZoomPeak('normal', true, false) > attackZoomPeak('finisher', false, false));
  assert.ok(attackZoomPeak('counter', false, false) > attackZoomPeak('normal', true, false));
  assert.ok(attackZoomPeak('normal', true, true) > attackZoomPeak('counter', false, false));
  // 일반 공격 줌은 정밀 패링보다 과하지 않고, 막타 킬 줌만 정밀 패링 수준으로 크게 터진다.
  assert.ok(attackZoomPeak('counter', false, false) < BLOCK.zoomPeak);
  assert.ok(hitStopMs('kill') > hitStopMs('normal') && hitStopMs('kill') < hitStopMs('counter'));
});

test('탄성 데미지 숫자는 초반 크게 팝인되었다가 안착하고 끝에서 부드럽게 사라진다', () => {
  const startNormal = damageNumberMotion(0, false);
  const startHeavy = damageNumberMotion(0, true);
  const mid = damageNumberMotion(0.4, true);
  const end = damageNumberMotion(1, true);
  assert.ok(startHeavy.scaleMult > startNormal.scaleMult && startNormal.scaleMult > 1.3);
  assert.equal(mid.scaleMult, 1);
  assert.equal(mid.alpha, 1);
  assert.equal(end.alpha, 0);
  assert.ok(end.riseRatio > mid.riseRatio && mid.riseRatio > startHeavy.riseRatio);
});
