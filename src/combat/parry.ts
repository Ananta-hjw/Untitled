import { BLOCK } from '../config.ts';
import { attackVector, type Facing } from '../entities/heroFrames.ts';

/**
 * 나인솔즈 스타일 2단 패링(정밀 패링 / 불완전 막기), 내상(회복 가능 체력),
 * 연속 패링 음정 상승, 카메라 줌 펀치와 임팩트 프레임 계산.
 * Phaser를 쓰지 않는 순수 모듈이라 tools/parry.test.mjs가 직접 불러 검사한다.
 */

export type ParryGrade = 'perfect' | 'imperfect' | 'none';

export interface ParryChainState {
  count: number;
  lastAt: number;
}

export interface WhiffState {
  count: number;
  lastWhiffAt: number;
}

/**
 * 헛막기 연타 상태에 따른 이번 막기의 정밀 패링 인정 시간(ms).
 * - 정상: 170ms / 1회 연타: 110ms / 2회 이상 연타: 80ms.
 * - whiffMemoryMs(800ms) 이상 쉬거나 한 번이라도 막기에 성공하면 즉시 170ms로 복구된다.
 */
export function effectivePerfectWindowMs(
  whiff: WhiffState,
  now: number,
  memoryMs = BLOCK.whiffMemoryMs,
  windows: readonly number[] = BLOCK.whiffPerfectWindowsMs,
): number {
  const recent = whiff.count > 0 && Number.isFinite(whiff.lastWhiffAt)
    && now >= whiff.lastWhiffAt && now - whiff.lastWhiffAt <= memoryMs;
  const tier = recent ? Math.min(windows.length - 1, whiff.count) : 0;
  return windows[tier];
}

/** 아무 공격도 막지 못하고 막기 창이 끝났을 때(헛막기) 연타 누적 단계를 올린다. */
export function recordParryWhiff(
  previous: WhiffState,
  whiffAt: number,
  memoryMs = BLOCK.whiffMemoryMs,
  maxTier = BLOCK.whiffPerfectWindowsMs.length - 1,
): WhiffState {
  const chained = previous.count > 0 && Number.isFinite(previous.lastWhiffAt)
    && whiffAt >= previous.lastWhiffAt && whiffAt - previous.lastWhiffAt <= memoryMs + BLOCK.windowMs;
  return { count: chained ? Math.min(maxTier, previous.count + 1) : 1, lastWhiffAt: whiffAt };
}

/**
 * 원거리 공격(투사체·산탄·물줄기)을 패링했을 때 되돌려 보내는 단위 방향 벡터.
 * 공격이 날아온 방향(hitDx, hitDy)의 정반대(원래 온 방향)로 그대로 반사한다.
 */
export function reflectDirection(hitDx: number, hitDy: number): { x: number; y: number } {
  const len = Math.hypot(hitDx, hitDy);
  if (len <= 1e-6) return { x: 1, y: 0 };
  return { x: -hitDx / len, y: -hitDy / len };
}

/** 8방향 막기 1개 섹터의 반각(±22.5°, 총 45°) 코사인 기준. */
const GUARD_SECTOR_COS = Math.cos(Math.PI / 8);

/**
 * 공격이 들어온 방향(플레이어 → 공격 출처 벡터 fromX, fromY)이
 * 현재 막기 방향(8방향: 상·하·좌·우 + 대각선 4방향, 각 ±22.5° / 총 45° 구간)과 일치하는지 판정한다.
 *
 * - 오른쪽에서 온 공격은 오른쪽 막기(`right`)일 때만, 오른쪽 위 대각선 공격은 오른쪽 위 막기(`up-right`)일 때만 막힌다.
 * - 정확한 22.5° 경계는 미세 여유를 두어 인접한 두 방향 모두 허용함으로써 사각지대를 없앤다.
 */
export function isAttackInGuardDirection(
  heroDir: Facing,
  fromX: number,
  fromY: number,
): boolean {
  const len = Math.hypot(fromX, fromY);
  if (len <= 1e-6) return true;
  const fx = fromX / len;
  const fy = fromY / len;
  const dir = attackVector(heroDir);
  return fx * dir.x + fy * dir.y >= GUARD_SECTOR_COS - 1e-6;
}

/**
 * 막기 버튼을 누른 뒤 elapsedMs가 지났을 때 막기 방향에서 온 공격을 어떻게 막았는지 판정한다.
 * - 0 ~ perfectWindowMs: 정밀 패링 ('perfect')
 * - perfectWindowMs ~ windowMs: 불완전 막기 ('imperfect')
 * - 그 밖이나 다른 방향 공격: 막지 못함 ('none')
 */
export function gradeParry(
  blocking: boolean,
  elapsedMs: number,
  inFront: boolean,
  perfectWindowMs = BLOCK.perfectWindowMs,
  windowMs = BLOCK.windowMs,
): ParryGrade {
  if (!blocking || !inFront || elapsedMs < 0 || elapsedMs > windowMs) return 'none';
  return elapsedMs <= perfectWindowMs ? 'perfect' : 'imperfect';
}

/** 연속 정밀 패링 횟수를 갱신한다. chainWindowMs 안에 이어지면 최대 6단계까지 올라간다. */
export function nextParryChain(
  previous: ParryChainState,
  now: number,
  windowMs = BLOCK.chainWindowMs,
): ParryChainState {
  const continued = Number.isFinite(previous.lastAt) && now >= previous.lastAt && now - previous.lastAt <= windowMs;
  return { count: continued ? Math.min(6, previous.count + 1) : 1, lastAt: now };
}

/** 연속 패링 단계에 따른 금속음 피치 배율(반음~온음씩 상승). */
const CHAIN_PITCH = [1, 1.09, 1.19, 1.3, 1.41, 1.5] as const;

export function parryPitchRatio(chain: number): number {
  const index = Math.max(0, Math.min(CHAIN_PITCH.length - 1, Math.floor(chain) - 1));
  return CHAIN_PITCH[index];
}

/**
 * 불완전 막기 시 받는 내상 계산.
 * 원래 경감 피해의 ratio만큼 체력이 줄고 같은 양이 회복 가능한 내상으로 쌓인다.
 * 불완전 막기 자체로는 쓰러지지 않으며 체력은 최소 1을 남긴다.
 */
export function imperfectGuardDamage(
  mitigatedDamage: number,
  currentHp: number,
  ratio = BLOCK.imperfectDamageRatio,
): { applied: number; nextHp: number } {
  if (currentHp <= 1 || mitigatedDamage <= 0) return { applied: 0, nextHp: currentHp };
  const raw = Math.max(1, Math.round(mitigatedDamage * ratio));
  const applied = Math.min(raw, currentHp - 1);
  return { applied, nextHp: currentHp - applied };
}

/** 적을 맞히거나 정밀 패링에 성공했을 때 쌓여 있는 내상 중 일부를 즉시 체력으로 되돌린다. */
export function recoverInternal(
  hp: number,
  maxHp: number,
  internal: number,
  amount: number,
): { hp: number; internal: number; recovered: number } {
  if (internal <= 0 || amount <= 0 || hp >= maxHp) return { hp, internal: Math.min(internal, Math.max(0, maxHp - hp)), recovered: 0 };
  const recoverable = Math.min(internal, maxHp - hp);
  const recovered = Math.min(recoverable, amount);
  return { hp: hp + recovered, internal: Math.max(0, internal - recovered), recovered };
}

/**
 * 대기 시간(healAt)이 지난 뒤 내상을 서서히 체력으로 되돌린다.
 * 정수 HP 단위라 소수점 누적치(carry)를 함께 유지한다.
 */
export function stepInternalHeal(
  hp: number,
  maxHp: number,
  internal: number,
  carry: number,
  now: number,
  healAt: number,
  dtSec: number,
  healPerSec = BLOCK.internalHealPerSec,
): { hp: number; internal: number; carry: number } {
  if (internal <= 0 || hp >= maxHp) return { hp, internal: 0, carry: 0 };
  if (now < healAt || dtSec <= 0) return { hp, internal: Math.min(internal, maxHp - hp), carry };
  const total = carry + healPerSec * dtSec;
  const whole = Math.floor(total);
  if (whole <= 0) return { hp, internal, carry: total };
  const { hp: nextHp, internal: nextInternal } = recoverInternal(hp, maxHp, internal, whole);
  return { hp: nextHp, internal: nextInternal, carry: nextInternal > 0 ? total - whole : 0 };
}

/** 정밀 패링 직후 짧은 여운 슬로우아웃의 게임 시간 배율 (scale → 1). */
export function parrySlowOutScale(
  remainingMs: number,
  scale = BLOCK.slowOutScale,
  durationMs = BLOCK.slowOutMs,
): number {
  if (remainingMs <= 0 || durationMs <= 0) return 1;
  const t = 1 - Math.min(1, remainingMs / durationMs);
  return scale + (1 - scale) * t * t;
}

/**
 * 패링 카메라 줌 펀치(실제 시간 기준).
 * inMs 동안 1 → peak로 빠르게 당겼다가 outMs에 걸쳐 부드럽게 1로 돌아온다.
 */
export function parryZoom(
  elapsedMs: number,
  peak = BLOCK.zoomPeak,
  inMs = BLOCK.zoomInMs,
  outMs = BLOCK.zoomOutMs,
): number {
  if (elapsedMs < 0 || elapsedMs >= inMs + outMs || peak <= 1) return 1;
  if (elapsedMs < inMs) {
    const t = elapsedMs / inMs;
    const ease = 1 - (1 - t) * (1 - t);
    return 1 + (peak - 1) * ease;
  }
  const t = (elapsedMs - inMs) / outMs;
  const ease = (1 - t) * (1 - t);
  return 1 + (peak - 1) * ease;
}

/**
 * 패링 1~2프레임 임팩트 프레임 어두운 오버레이 투명도(실제 시간 기준).
 * holdMs 동안 진하게 눌렀다가 fadeMs 동안 빠르게 걷힌다.
 */
export function parryImpactShadeAlpha(
  elapsedMs: number,
  holdMs = 34,
  fadeMs = 24,
  maxAlpha = 0.46,
): number {
  if (elapsedMs < 0 || elapsedMs >= holdMs + fadeMs) return 0;
  if (elapsedMs <= holdMs) return maxAlpha;
  return maxAlpha * (1 - (elapsedMs - holdMs) / fadeMs);
}

/**
 * 연타 중 패링 결과 판정 (보스의 연속 돌진과 중급 이상 적의 연타 묶음, combat/enemyCombo.ts).
 * - 'continueChain': 연타 중 아직 남은 타격이 있어 바로 끊기지 않고 다음 타를 짧은 박자로 이어 간다.
 * - 'chainBreak': 연타의 마지막 타까지 정밀 패링으로 이어 받아 파훼했다(대경직 + 보너스 공명).
 * - 'normalBreak': 연타를 쓰지 않는 적이거나, 단타·불완전 막기로 마무리된 경우.
 * chained: 이 적이 지금 연타를 하는지 (보스이거나 연타 묶음을 쓰는 적)
 */
export type BossParryOutcome = 'continueChain' | 'chainBreak' | 'normalBreak';

export function bossParryOutcome(
  chained: boolean,
  chainLeft: number,
  comboParries: number,
  perfect: boolean,
): BossParryOutcome {
  if (!chained) return 'normalBreak';
  if (chainLeft > 0) return 'continueChain';
  if (perfect && comboParries >= 2) return 'chainBreak';
  return 'normalBreak';
}

/** 막기 버튼을 길게 누른 시간(heldMs)에 따른 차지 패링 충전 비율(0~1). */
export function chargeParryProgress(heldMs: number, chargeHoldMs = BLOCK.chargeHoldMs): number {
  if (heldMs <= 0 || chargeHoldMs <= 0) return 0;
  return Math.min(1, heldMs / chargeHoldMs);
}

/** 차지 패링 발사 준비가 끝났는지. */
export function isChargeParryReady(heldMs: number, chargeHoldMs = BLOCK.chargeHoldMs): boolean {
  return heldMs >= chargeHoldMs;
}

/** 충전한 막기 버튼을 뗀 직후 차지 패링 판정 창 안에 있고(필요 시 8방향 막기 각도 일치 포함) 발동 가능한지. */
export function isUnboundActive(now: number, unboundUntil: number, inGuardDir = true): boolean {
  return inGuardDir && now < unboundUntil;
}

/** 공명 조각을 여러 개 한 번에 채운다(최대치 초과 방지). */
export function addResonanceParts(charge: number, parts: number, maxParts: number): number {
  if (parts <= 0) return charge;
  return Math.min(maxParts, charge + parts);
}

