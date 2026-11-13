/** 게임 전역 상수. 화면 높이는 항상 720으로 고정하고 너비만 기기 비율에 맞춰 늘어난다. */
export const VIEW_HEIGHT = 720;
export const MIN_ASPECT = 4 / 3;
export const MAX_ASPECT = 2.4;

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = VIEW_HEIGHT;

/** 벽과 바닥이 만나는 높이 */
export const FLOOR_TOP = 400;

/** 플레이어 이동 속도(px/초). 세로 이동은 원근감을 위해 조금 느리게 한다. */
export const PLAYER_SPEED = 300;
export const VERTICAL_SPEED_RATIO = 0.7;

/** UI는 월드 오브젝트(깊이 = y좌표)보다 항상 위에 그린다. */
export const DEPTH_LIGHTING = 5000;
export const DEPTH_UI = 10000;

// ------------------------------------------------------------------ 전투

export const PLAYER = {
  maxHp: 100,
  damageMin: 9,
  damageMax: 13,
  /**
   * 콤보 단계별 설정. 버튼을 누르고 있거나 연타하면 1 → 2 → 3타로 이어진다.
   *  - intervalMs: 다음 공격이 나갈 수 있을 때까지의 시간
   *  - hitDelayMs: 동작 시작 후 실제로 타격이 들어가는 시점
   *  - damage / knockback / reach: 기본값에 곱하는 배율
   *  - lunge: 공격하며 앞으로 내딛는 속도(px/초)
   */
  combo: [
    { intervalMs: 330, hitDelayMs: 110, damage: 1, knockback: 0.7, reach: 1, lunge: 90 },
    { intervalMs: 330, hitDelayMs: 100, damage: 1.1, knockback: 0.8, reach: 1, lunge: 120 },
    { intervalMs: 560, hitDelayMs: 150, damage: 2, knockback: 1.7, reach: 1.25, lunge: 320 },
  ],
  /** 이 시간 안에 다음 공격을 이어야 콤보가 유지된다 (이전 공격이 끝난 뒤부터) */
  comboWindowMs: 380,
  /** 타격 범위: 바라보는 쪽으로 reach, 뒤로 back, 위아래로 lane */
  attackReach: 155,
  attackBack: 25,
  attackLane: 52,
  /** 공격 중 이동 속도 비율 */
  attackMoveRatio: 0.3,
  /** 입력이 없을 때 이 거리 안의 적 쪽으로 자동으로 돌아선다 */
  autoFaceRange: 230,
  knockback: 340,
  /** 맞은 뒤 무적 시간 */
  invulnerableMs: 700,
  respawnMs: 2200,
};

/** 회피: 짧게 미끄러지듯 이동하며 그동안은 맞지 않는다. */
export const DODGE = {
  distance: 250,
  durationMs: 300,
  cooldownMs: 900,
  /** 회피가 끝난 직후에도 잠깐 더 무적 */
  graceMs: 80,
};

export const ENEMY = {
  maxHp: 32,
  damage: 8,
  chaseSpeed: 125,
  aggroX: 380,
  aggroY: 220,
  attackRangeX: 95,
  attackRangeY: 30,
  /** 돌진이 실제로 닿는 범위 (준비 동작 중에 이 밖으로 피하면 빗나간다) */
  strikeRangeX: 130,
  strikeRangeY: 44,
  windupMs: 480,
  recoverMs: 900,
  staggerMs: 420,
  knockback: 260,
  respawnMs: 6000,
};

/** 밀려나는 속도가 줄어드는 정도(초당) */
export const KNOCKBACK_DAMPING = 7;
