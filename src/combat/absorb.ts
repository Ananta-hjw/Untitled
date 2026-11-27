import type { MonsterKind } from './monsterTypes.ts';

/**
 * 흡수: 정밀 패링으로 받아 낸 적의 힘을 칼에 담는다 (게임 시계 ms).
 *  - 칼의 기본 공격력은 약하다: 담긴 힘이 없으면 칼질 피해가 damageScale[0](0.3배)이다.
 *  - 정밀 패링마다 한 단씩(최대 maxTier) 쌓이고, 막은 적의 속성이 칼에 묻는다(마지막에 막은 적의 속성).
 *    연속 패링 파훼는 한 단 더, 차지 패링은 단번에 가득 찬다.
 *  - 담긴 힘은 마지막 정밀 패링부터 keepMs(3초) 동안 이어지며, 그동안의 모든 칼질(반격 일섬 포함)이
 *    단수만큼 세진다(0.65 / 1.1 / 2.5배). 막지 못하고 맞으면 사라진다.
 *  - 속성은 3단일 때만, 정밀 패링 뒤 맨 첫 명중 한 번에만 실린다(charged, elementReady). 다시 정밀 패링하면 또 실린다.
 * 속성별로 첫 명중의 효과가 다르다:
 *  - 기운(force): 피해와 밀어내기만 커진다.
 *  - 서리(frost): 맞은 적이 잠깐 얼어 느려지고 공격도 굼떠진다.
 *  - 부식(corrosion): 맞은 자리에 시온 편 부식 웅덩이가 남아 그 위의 적을 갉는다.
 *  - 안개(mist): 칼끝이 안개로 길어져 더 멀리 닿는다.
 * Phaser를 쓰지 않아 tools/absorb.test.mjs가 직접 검사한다.
 */
export type AbsorbElement = 'force' | 'frost' | 'corrosion' | 'mist';

export const ABSORB = {
  maxTier: 3,
  keepMs: 3000,
  /** 단수별 칼질 피해 배율 (0단: 담긴 힘이 없을 때의 기본 칼질) */
  damageScale: [0.3, 0.65, 1.1, 2.5],
  force: { knockbackScale: 1.7 },
  frost: { chillMs: [0, 1600, 2200, 2800], speedScale: 0.45, windupScale: 1.4 },
  corrosion: { poolMs: 3200, rx: 95, ry: 42, tickMs: 400, tickRatio: [0, 0.16, 0.22, 0.28] },
  mist: { reach: [1, 1.35, 1.5, 1.7] },
} as const;

export const ABSORB_LOOK: Record<AbsorbElement, { name: string; color: number; text: string }> = {
  force: { name: '기운', color: 0xffe08a, text: '#ffe08a' },
  frost: { name: '서리', color: 0x9fe6ff, text: '#bff0ff' },
  corrosion: { name: '부식', color: 0xb07ae8, text: '#d6b0ff' },
  mist: { name: '안개', color: 0xdfe8ec, text: '#eef6f8' },
};

/** charged: 아직 속성을 싣지 않았다 (정밀 패링 뒤 첫 명중을 기다리는 중) */
export interface AbsorbState { tier: number; element: AbsorbElement; until: number; charged: boolean }
export const NO_ABSORB: AbsorbState = { tier: 0, element: 'force', until: -Infinity, charged: false };

/** 막은 적의 속성 */
export function absorbElementOf(kind: MonsterKind | undefined): AbsorbElement {
  switch (kind) {
    case 'frost-beetle': return 'frost';
    case 'corrosion-tracker': case 'corrosion-executioner': case 'ashen-moth': return 'corrosion';
    case 'mist-phantom': case 'fog-crow': case 'mist-weaver': return 'mist';
    default: return 'force';
  }
}

/** 정밀 패링 한 번(또는 tiers단)을 담는다 */
export function absorbParry(state: AbsorbState, element: AbsorbElement, now: number, tiers = 1, keepMs: number = ABSORB.keepMs): AbsorbState {
  const base = activeAbsorb(state, now)?.tier ?? 0;
  return { tier: Math.min(ABSORB.maxTier, base + Math.max(1, Math.floor(tiers))), element, until: now + keepMs, charged: true };
}

/** 지금 칼에 담긴 힘 (없거나 시간이 지났으면 undefined) */
export function activeAbsorb(state: AbsorbState, now: number): AbsorbState | undefined {
  return state.tier > 0 && now < state.until ? state : undefined;
}

/** 다음 명중에 속성이 실리는지: 3단(maxTier)이고 정밀 패링 뒤 아직 속성을 쓰지 않았다 */
export function elementReady(state: AbsorbState | undefined): boolean {
  return !!state && state.charged && state.tier >= ABSORB.maxTier;
}

/** 첫 명중에 속성을 실어 쓴 뒤: 단수와 남은 시간은 그대로, 속성만 비운다 */
export function spendElement(state: AbsorbState): AbsorbState {
  return state.charged ? { ...state, charged: false } : state;
}

/** 단수에 따른 칼질 피해 배율 (0단은 기본 칼질) */
export function absorbDamageScale(tier: number): number {
  const i = Math.max(0, Math.min(ABSORB.maxTier, Math.floor(tier)));
  return ABSORB.damageScale[i];
}

/** 안개를 실은 칼질의 칼끝이 길어지는 배율 (3단이 아니거나 속성을 이미 썼거나 다른 속성이면 1) */
export function absorbReach(state: AbsorbState | undefined): number {
  if (!state || !elementReady(state) || state.element !== 'mist') return 1;
  return ABSORB.mist.reach[Math.max(0, Math.min(ABSORB.maxTier, state.tier))];
}

/** 부식 웅덩이 안에 있는지 (바닥 타원) */
export function insidePool(dx: number, dy: number, rx: number = ABSORB.corrosion.rx, ry: number = ABSORB.corrosion.ry): boolean {
  return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
}
