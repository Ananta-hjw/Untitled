/**
 * 1장 보스 부식의 집행자의 패턴 값과 판정 (Phaser를 쓰지 않아 tools/boss.test.mjs가 직접 불러 검사한다).
 *
 *  1페이즈: 기존 돌진을 두 번 잇달아 한다(chain). 두 돌진 사이에 chainGapMs 쉰다.
 *  체력이 phaseTwoAt 이하로 떨어지면: 주인공과 보스가 모두 멈추고 보스가 roarMs 동안 포효한다(그동안 맞지 않는다).
 *    그다음 retreatDistance까지(또는 retreatMaxMs 동안) 주인공에게서 물러나며 2페이즈를 시작한다.
 *  2페이즈: 네이룬의 부원소인 부식(독)을 쓴다.
 *    - 부식 웅덩이(pool): 돌진이 끝난 자리에 웅덩이가 남는다. 밟고 있으면 tickMs마다 작은 피해와 짧은 둔화.
 *    - 부식 산탄(shot): 주인공이 minDistance보다 멀면(쿨다운마다) 웅크렸다가 부식 덩어리 count발을 부채꼴로 뿌린다.
 *      맞으면 피해(패링·저스트 회피 가능), 빗나가 떨어진 곳에는 작은 웅덩이가 생긴다.
 *    - 부식의 장막(veil): 체력이 veil.at 아래로 처음 떨어지면 한 번, telegraphMs 동안 바닥에 범위를 그린 뒤 터진다.
 *      그때 범위 안에 있으면 큰 피해. 회피 무적으로 피하거나 범위 밖으로 나가면 된다(패링으로는 막지 못한다).
 *  보통 공격에는 움찔하지 않고(슈퍼아머) 덜 밀려난다. 패링·저스트 회피의 경직은 그대로 받는다.
 *  나타나기 전 화면에 warningMs 동안 "보스 등장" 경고를 띄운다.
 */
export const BOSS = {
  chain: 2,
  /** 2페이즈에서는 3연속 돌진으로 더 쫀득한 연속 패링 리듬을 만든다. */
  phaseTwoChain: 3,
  chainGapMs: 1000,
  /** 보스 연타 중 앞 타를 패링했을 때 다음 타가 이어지는 리듬 간격(ms) */
  parryChainGapMs: 360,
  /** 보스 연타의 마지막 타까지 연속 패링으로 파훼했을 때의 대경직 시간(ms) */
  parryChainStunMs: 2000,
  /** 차지 패링(무량반격)으로 보스 강공격·장막을 파훼했을 때의 초대형 경직(ms)과 반사 피해 배율 */
  unboundStunMs: 2400,
  unboundCounterScale: 1.6,
  phaseTwoAt: 0.5,
  roarMs: 1700,
  retreatDistance: 520,
  retreatSpeed: 440,
  retreatMaxMs: 1400,
  warningMs: 2800,
  /** 보통 공격에 밀려나는 정도 (보통 몬스터 대비) */
  knockbackScale: 0.15,
  pool: { durationMs: 3800, rx: 95, ry: 52, tickMs: 600, damageScale: 0.15, slowMs: 900 },
  shot: {
    count: 3, spreadDeg: 18, speed: 430, range: 600, windupMs: 700, recoverMs: 900, cooldownMs: 4500,
    minDistance: 320, damageScale: 0.45, radiusX: 26, radiusY: 30,
    /** 떨어진 자리의 웅덩이 크기 (pool 대비) */
    poolScale: 0.6,
  },
  veil: { at: 0.25, telegraphMs: 2000, rx: 300, ry: 165, damageScale: 1.6, recoverMs: 1300 },
} as const;

export type BossPhase = 1 | 2;

/** 이번 피해로 2페이즈(포효)에 들어가야 하는지: 1페이즈에서 체력이 절반 이하가 되었을 때 한 번 */
export function entersPhaseTwo(phase: BossPhase, hp: number, maxHp: number): boolean {
  return phase === 1 && hp > 0 && hp <= maxHp * BOSS.phaseTwoAt;
}

/** 물러나기를 끝낼지: 충분히 멀어졌거나, 시간이 다 됐거나, 막혀서 더 못 갈 때 */
export function retreatDone(distance: number, elapsedMs: number, blocked: boolean): boolean {
  return distance >= BOSS.retreatDistance || elapsedMs >= BOSS.retreatMaxMs || blocked;
}

/** 바닥의 타원(rx, ry) 안인지 (dx, dy: 타원 가운데에서) */
export function insideEllipse(dx: number, dy: number, rx: number, ry: number): boolean {
  return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
}

/** 겨눈 방향을 가운데로 spreadDeg 간격의 부채꼴 방향 count개 (단위 벡터) */
export function fanDirections(aimX: number, aimY: number, count: number, spreadDeg: number): Array<{ x: number; y: number }> {
  const base = Math.atan2(aimY, aimX), step = (spreadDeg * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const a = base + (i - (count - 1) / 2) * step;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

/** 부식의 장막을 쓸 때인지: 2페이즈에서 체력이 veil.at 아래로 처음 떨어졌을 때 한 번 */
export function shouldVeil(phase: BossPhase, hp: number, maxHp: number, used: boolean): boolean {
  return phase === 2 && !used && hp > 0 && hp <= maxHp * BOSS.veil.at;
}

/** 부식 산탄을 쏠 때인지: 2페이즈이고, 주인공이 충분히 멀고, 쿨다운이 지났을 때 */
export function wantsVolley(phase: BossPhase, distance: number, now: number, readyAt: number): boolean {
  return phase === 2 && distance >= BOSS.shot.minDistance && now >= readyAt;
}
