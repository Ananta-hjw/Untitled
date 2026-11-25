import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK, HIT_FEEL, RESONANCE } from '../src/config.ts';
import { BOSS } from '../src/combat/bossPattern.ts';
import { maxCharge } from '../src/combat/resonance.ts';
import {
  addResonanceParts,
  bossParryOutcome,
  chargeParryProgress,
  gradeParry,
  imperfectGuardDamage,
  isChargeParryReady,
  isUnboundActive,
  nextParryChain,
  parryImpactShadeAlpha,
  parryPitchRatio,
  parrySlowOutScale,
  parryZoom,
  recoverInternal,
  stepInternalHeal,
} from '../src/combat/parry.ts';
import { gameTimeScale, hitStopMs } from '../src/combat/hitFeel.ts';
import { guardMotion } from '../src/entities/guardMotion.ts';

test('2단 패링: 앞쪽 공격은 정밀 구간(0~perfectWindowMs)에서 완벽 패링, 나머지는 불완전 막기, 뒤쪽·만료는 실패다', () => {
  assert.ok(BLOCK.perfectWindowMs > 0 && BLOCK.perfectWindowMs < BLOCK.windowMs);
  assert.equal(gradeParry(true, 0, true), 'perfect');
  assert.equal(gradeParry(true, BLOCK.perfectWindowMs, true), 'perfect');
  assert.equal(gradeParry(true, BLOCK.perfectWindowMs + 1, true), 'imperfect');
  assert.equal(gradeParry(true, BLOCK.windowMs, true), 'imperfect');
  assert.equal(gradeParry(true, BLOCK.windowMs + 1, true), 'none');
  assert.equal(gradeParry(true, -1, true), 'none');
  assert.equal(gradeParry(true, 20, false), 'none', '뒤쪽 공격은 막지 못한다');
  assert.equal(gradeParry(false, 20, true), 'none', '막기 중이 아니면 막지 못한다');
});

test('연속 정밀 패링은 제한 시간 안에 이어질수록 체인과 금속음 음정이 올라간다', () => {
  let chain = { count: 0, lastAt: -Infinity };
  const pitches = [];
  for (let i = 0; i < 6; i++) {
    chain = nextParryChain(chain, 1000 + i * 400);
    assert.equal(chain.count, i + 1);
    pitches.push(parryPitchRatio(chain.count));
  }
  for (let i = 1; i < pitches.length; i++) assert.ok(pitches[i] > pitches[i - 1], '연속 패링마다 피치 상승');
  // 최대 6단계에서 고정되고, 시간이 지나면 1로 돌아온다.
  const capped = nextParryChain(chain, 1000 + 6 * 400);
  assert.equal(capped.count, 6);
  const reset = nextParryChain(capped, capped.lastAt + BLOCK.chainWindowMs + 1);
  assert.equal(reset.count, 1);
});

test('불완전 막기 내상은 치명적이지 않고(최소 HP 1 유지), 타격이나 대기 후 자연 회복된다', () => {
  const normal = imperfectGuardDamage(20, 100);
  assert.equal(normal.applied, Math.round(20 * BLOCK.imperfectDamageRatio));
  assert.equal(normal.nextHp, 100 - normal.applied);

  // 체력이 아주 낮아도 불완전 막기 자체로는 쓰러지지 않는다.
  const clutch = imperfectGuardDamage(50, 3);
  assert.equal(clutch.applied, 2);
  assert.equal(clutch.nextHp, 1);
  assert.deepEqual(imperfectGuardDamage(50, 1), { applied: 0, nextHp: 1 });

  // 적을 맞히거나 정밀 패링에 성공하면 내상이 즉시 회복된다.
  const onHit = recoverInternal(90, 100, 8, BLOCK.internalHealOnHit);
  assert.deepEqual(onHit, { hp: 94, internal: 4, recovered: 4 });
  const capped = recoverInternal(98, 100, 10, 8);
  assert.deepEqual(capped, { hp: 100, internal: 8, recovered: 2 });

  // 대기 시간 전에는 자연 회복되지 않고, 대기 시간 이후 초당 internalHealPerSec만큼 회복된다.
  const wait = stepInternalHeal(90, 100, 8, 0, 2000, 3000, 0.5);
  assert.equal(wait.hp, 90);
  assert.equal(wait.internal, 8);
  const heal = stepInternalHeal(90, 100, 8, 0, 3500, 3000, 0.5);
  assert.equal(heal.hp, 96);
  assert.equal(heal.internal, 2);
  const done = stepInternalHeal(heal.hp, 100, heal.internal, heal.carry, 4000, 3000, 0.5);
  assert.equal(done.hp, 98);
  assert.equal(done.internal, 0);
  assert.equal(done.carry, 0);
});

test('패링 줌 펀치·임팩트 프레임·히트스톱·슬로우아웃은 정밀 패링이 불완전 막기보다 강하고 깔끔하게 원복된다', () => {
  assert.ok(hitStopMs('parry') > hitStopMs('imperfectGuard'));
  assert.ok(hitStopMs('parry') <= 150);
  assert.ok(HIT_FEEL.shake.parry[1] > HIT_FEEL.shake.imperfectGuard[1]);

  // 줌 펀치: 순간 확대 후 정확히 1로 복귀
  assert.equal(parryZoom(0), 1);
  assert.ok(Math.abs(parryZoom(BLOCK.zoomInMs) - BLOCK.zoomPeak) < 1e-6);
  assert.ok(parryZoom(BLOCK.zoomInMs + BLOCK.zoomOutMs * 0.5) > 1);
  assert.equal(parryZoom(BLOCK.zoomInMs + BLOCK.zoomOutMs), 1);

  // 임팩트 프레임 어두운 오버레이: 짧게 진했다가 0으로 사라짐
  assert.ok(parryImpactShadeAlpha(10) > 0.4);
  assert.ok(parryImpactShadeAlpha(45) > 0 && parryImpactShadeAlpha(45) < parryImpactShadeAlpha(10));
  assert.equal(parryImpactShadeAlpha(100), 0);

  // 히트스톱이 풀린 뒤 패링 슬로우아웃이 0.5 → 1로 자연스럽게 가속한다.
  assert.equal(gameTimeScale(20, 0, BLOCK.slowOutMs), 0);
  assert.equal(gameTimeScale(0, 0, BLOCK.slowOutMs), BLOCK.slowOutScale);
  assert.ok(parrySlowOutScale(BLOCK.slowOutMs * 0.5) > BLOCK.slowOutScale);
  assert.equal(gameTimeScale(0, 0, 0), 1);

  // 가드 리코일: 충돌 직후 검과 몸이 탄성 반동하고 220ms 뒤 원래 자세로 돌아온다(좌우 대칭 유지).
  const baseR = guardMotion(160, 'right');
  const kickR = guardMotion(160, 'right', 0);
  const kickL = guardMotion(160, 'left', 0);
  assert.notEqual(kickR.swordAngle, baseR.swordAngle);
  assert.equal(kickL.swordAngle, kickR.swordAngle);
  assert.equal(kickL.bodyAngle, -kickR.bodyAngle);
  assert.deepEqual(guardMotion(160, 'right', 240), baseR);
});

test('보스 연속 패링: 남은 연타가 있으면 이어지고, 마지막 타를 정밀 패링하면 연속 파훼가 터진다', () => {
  assert.equal(BOSS.chain, 2);
  assert.equal(BOSS.phaseTwoChain, 3);
  assert.ok(BOSS.parryChainGapMs < BOSS.chainGapMs, '패링 뒤 다음 연타는 더 쫀득한 박자로 이어진다');
  assert.ok(BOSS.parryChainStunMs > BLOCK.stunMs, '연속 파훼는 일반 패링보다 오래 경직시킨다');

  // 일반 적은 단타 패링으로 바로 경직
  assert.equal(bossParryOutcome(false, 0, 1, true), 'normalBreak');
  assert.equal(bossParryOutcome(false, 2, 1, true), 'normalBreak');

  // 보스 1페이즈 2연타: 1타 패링(chainLeft=1) → 연타 유지, 2타 정밀 패링(chainLeft=0, comboParries=2) → 연속 파훼
  assert.equal(bossParryOutcome(true, 1, 1, true), 'continueChain');
  assert.equal(bossParryOutcome(true, 0, 2, true), 'chainBreak');

  // 보스 2페이즈 3연타: 1·2타는 연타 유지, 3타 정밀 패링 → 연속 파훼
  assert.equal(bossParryOutcome(true, 2, 1, true), 'continueChain');
  assert.equal(bossParryOutcome(true, 1, 2, true), 'continueChain');
  assert.equal(bossParryOutcome(true, 0, 3, true), 'chainBreak');

  // 보스 마지막 타를 불완전 막기하거나 단타만 막았을 때는 일반 경직
  assert.equal(bossParryOutcome(true, 0, 2, false), 'normalBreak');
  assert.equal(bossParryOutcome(true, 0, 1, true), 'normalBreak');
});

test('차지 패링(무량반격): 길게 눌러 충전하고 떼는 창에서 최고 등급 히트스톱·줌·공명 보상을 준다', () => {
  assert.equal(chargeParryProgress(0), 0);
  assert.equal(isChargeParryReady(BLOCK.chargeHoldMs - 1), false);
  assert.equal(chargeParryProgress(BLOCK.chargeHoldMs), 1);
  assert.equal(isChargeParryReady(BLOCK.chargeHoldMs), true);
  assert.equal(isUnboundActive(1000, 1000 + BLOCK.unboundWindowMs), true);
  assert.equal(isUnboundActive(1000 + BLOCK.unboundWindowMs, 1000 + BLOCK.unboundWindowMs), false);

  // 히트스톱·흔들림·줌·경직 위계: 불완전 막기 < 정밀 패링 < 연속 파훼 < 무량반격
  assert.ok(hitStopMs('imperfectGuard') < hitStopMs('parry'));
  assert.ok(hitStopMs('parry') < hitStopMs('chainBreak'));
  assert.ok(hitStopMs('chainBreak') < hitStopMs('unbound'));
  assert.ok(hitStopMs('unbound') <= 150);
  assert.ok(HIT_FEEL.shake.parry[1] < HIT_FEEL.shake.chainBreak[1]);
  assert.ok(HIT_FEEL.shake.chainBreak[1] < HIT_FEEL.shake.unbound[1]);
  assert.ok(BLOCK.zoomPeak < BLOCK.zoomChainBreakPeak && BLOCK.zoomChainBreakPeak < BLOCK.zoomUnboundPeak);
  assert.ok(BOSS.unboundStunMs > BOSS.parryChainStunMs);

  // 무량반격 슬로우아웃은 정밀 패링보다 더 깊고 길다.
  assert.equal(gameTimeScale(0, 0, BLOCK.unboundSlowOutMs, BLOCK.unboundSlowOutScale, BLOCK.unboundSlowOutMs), BLOCK.unboundSlowOutScale);
  assert.ok(BLOCK.unboundSlowOutScale < BLOCK.slowOutScale);

  // 무량반격 공명 보상(구슬 1칸 = 3조각)과 최대치 상한 확인
  assert.equal(addResonanceParts(0, BLOCK.unboundResonanceParts, maxCharge(RESONANCE)), 3);
  assert.equal(addResonanceParts(14, BLOCK.unboundResonanceParts, maxCharge(RESONANCE)), maxCharge(RESONANCE));
});

