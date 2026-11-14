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
   *  - intervalMs: 다음 공격으로 연결 가능한 시간(1·2타는 복귀 동작 전)
   *  - hitDelayMs: 동작 시작 후 실제로 타격이 들어가는 시점
   *  - damage / knockback: 기본값에 곱하는 배율
   *  - lungeDistance: 휘두르는 구간에서 전진할 거리(px)
   *  - lungeStartMs / lungeEndMs: 전진 구간(공격 시작 기준)
   */
  combo: [
    { intervalMs: 336, hitDelayMs: 220, damage: 1, knockback: 0.7, lungeDistance: 13, lungeStartMs: 168, lungeEndMs: 265 },
    { intervalMs: 237, hitDelayMs: 105, damage: 1.1, knockback: 0.8, lungeDistance: 17, lungeStartMs: 64, lungeEndMs: 186 },
    { intervalMs: 400, hitDelayMs: 180, damage: 2, knockback: 1.7, lungeDistance: 46, lungeStartMs: 112, lungeEndMs: 200 },
  ],
  /** 이 시간 안에 다음 공격을 이어야 콤보가 유지된다 (이전 공격이 끝난 뒤부터) */
  comboWindowMs: 380,
  /** 다음 공격이 가능해지기 직전의 짧은 입력을 기억할 시간(ms) */
  attackBufferMs: 150,
  /** 타격 자세 이후 검날을 추적할 시간(ms), 검날 두께 보정(px), 위아래 레인(px) */
  hitWindowMs: 55,
  bladeRadius: 6,
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
  strikeMs: 110,
  returnMs: 220,
  recoverMs: 900,
  staggerMs: 420,
  knockback: 260,
  respawnMs: 6000,
  /** 적끼리 이 거리(가로/세로) 안으로 겹치면 separationSpeed(px/초)로 서로 밀어낸다 */
  separationX: 64,
  separationY: 24,
  separationSpeed: 70,
};

/** 밀려나는 속도가 줄어드는 정도(초당) */
export const KNOCKBACK_DAMPING = 7;
