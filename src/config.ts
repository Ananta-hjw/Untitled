/** 게임 전역 상수. 화면 높이는 항상 720으로 고정하고 너비만 기기 비율에 맞춰 늘어난다. */
export const VIEW_HEIGHT = 720;
export const MIN_ASPECT = 4 / 3;
export const MAX_ASPECT = 2.4;

/** 직전 배치에서 가로·세로를 각각 30% 확장한다. 캐릭터 크기와 이동 속도는 유지한다. */
export const MAP_EXPANSION_SCALE = 1.3;
export const MAP_SIZE_SCALE = Math.round(1.1 * MAP_EXPANSION_SCALE * 100) / 100;
export const WORLD_WIDTH = Math.round(2400 * MAP_SIZE_SCALE);
export const WORLD_HEIGHT = Math.round(1600 * MAP_SIZE_SCALE);

/** 벽과 바닥이 만나는 높이 */
export const FLOOR_TOP = 400;

/** 플레이어 이동 속도(px/초). 세로 이동은 원근감을 위해 조금 느리게 한다. */
export const PLAYER_SPEED = 300;
/**
 * 주인공 걷기 그림을 기본 속도(초당 8장)로 넘길 때 발이 바닥에 맞는 이동 속도(px/초).
 * 걷기 그림은 실제 이동 속도 ÷ 이 값의 배율로 넘긴다. 전속력(300)에서 약 1.4배(초당 11장)로, 팔다리가 너무 바쁘게 움직이지 않게 보폭을 넉넉히 잡았다.
 */
export const HERO_WALK_NATURAL_SPEED = 220;
/** 검을 뽑았을 때 길이·손 위치는 유지하고 칼날 폭만 넓힌다. */
export const HERO_BLADE_WIDTH_SCALE = 1.35;
/** 막기 시작 시 발을 축으로 버티고 검을 세운 뒤 작은 호흡으로 안정된다. 각도는 라디안. */
export const HERO_GUARD_MOTION = {
  readyMs: 55, braceMs: 180, breathMs: 1100,
  braceLean: 0.018, restLean: 0.006, breathLean: 0.003,
  swordLift: 0.13, liftMs: 110,
};
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
   *  - followPauseAtMs / followPauseMs: 타격 후 자세를 유지하는 시작 시각·길이
   *  - hitDelayMs: 동작 시작 후 실제로 타격이 들어가는 시점
   *  - damage / knockback: 기본값에 곱하는 배율
   *  - lungeDistance: 휘두르는 구간에서 전진할 거리(px)
   *  - lungeStartMs / lungeEndMs: 전진 구간(공격 시작 기준)
   */
  combo: [
    { intervalMs: 426, followPauseAtMs: 300, followPauseMs: 90, hitDelayMs: 220, damage: 1, knockback: 0.7, lungeDistance: 13, lungeStartMs: 168, lungeEndMs: 265 },
    { intervalMs: 327, followPauseAtMs: 200, followPauseMs: 90, hitDelayMs: 105, damage: 1.1, knockback: 0.8, lungeDistance: 17, lungeStartMs: 64, lungeEndMs: 186 },
    { intervalMs: 520, followPauseAtMs: 260, followPauseMs: 120, hitDelayMs: 180, damage: 2, knockback: 1.7, lungeDistance: 46, lungeStartMs: 112, lungeEndMs: 200 },
  ],
  /** 이 시간 안에 다음 공격을 이어야 콤보가 유지된다 (이전 공격이 끝난 뒤부터) */
  comboWindowMs: 380,
  /** 다음 공격이 가능해지기 직전의 짧은 입력을 기억할 시간(ms) */
  attackBufferMs: 150,
  /** 타격 자세 이후 검날 추적 시간(ms), 검날 두께(px), 공격 방향을 기준으로 한 레인 반폭(px) */
  hitWindowMs: 55,
  bladeRadius: 6,
  attackLane: 52,
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
  cooldownMs: 10000,
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

/**
 * 저스트 회피: 적의 공격이 닿기 직전에 회피하면 성공한다.
 *  - windowMs: 공격이 닿는 순간보다 이만큼 먼저 회피를 시작했어도 인정한다 (그보다 이르면 일반 회피)
 *  - slowScale / slowMs / rampMs: 성공하면 게임 시간이 slowScale배로 느려진다.
 *    slowMs는 실제 시간(ms)이고, 마지막 rampMs 동안 원래 속도로 돌아온다.
 *  - counterMs / counterDamage: 그 뒤 counterMs(게임 시간) 안에 시작한 공격 한 번은 피해가 counterDamage배
 *  - stunMs: 피한 적은 이 시간 동안 멈칫한다
 * 성공하면 회피 재사용 대기 시간도 바로 끝난다.
 */
export const JUST_DODGE = {
  windowMs: 200,
  slowScale: 0.3,
  slowMs: 650,
  rampMs: 250,
  counterMs: 1500,
  counterDamage: 2,
  stunMs: 1300,
};

/**
 * 타격감.
 *  - *HitStopMs: 칼이 닿거나 맞은 순간 게임 시간을 멈추는 길이(실제 시간 ms)
 *  - squashMs / squash: 맞은 적이 납작해졌다가 출렁이며 돌아오는 시간과 정도
 */
export const HIT_FEEL = {
  // 연타 중에 툭툭 끊겨 보이지 않도록 짧게 멈춘다(예전 55·85·105·130·80ms의 절반 남짓).
  hitStopMs: 30,
  /** 치명타: 일반 타격보다 길고 마무리 일격보다 짧게 멈춘다 */
  critHitStopMs: 50,
  finisherHitStopMs: 65,
  counterHitStopMs: 80,
  hurtHitStopMs: 60,
  /** 치명타 확률과 피해 배율 (반격에는 치명타가 붙지 않는다. 반격 자체가 강하다) */
  critChance: 0.15,
  critDamage: 1.6,
  /** 화면 흔들림: [길이(ms), 세기]. 묵직하게, 하지만 화면이 어지럽지 않게 짧게 */
  shake: {
    normal: [60, 0.004],
    crit: [90, 0.008],
    finisher: [120, 0.011],
    counter: [140, 0.012],
    hurt: [120, 0.01],
    kill: [90, 0.006],
  } as Record<'normal' | 'crit' | 'finisher' | 'counter' | 'hurt' | 'kill', readonly [number, number]>,
  /** 마무리 일격·치명타의 넉백 배율 */
  heavyKnockback: 1.35,
  squashMs: 280,
  squash: 0.32,
};

/** 밀려나는 속도가 줄어드는 정도(초당) */
export const KNOCKBACK_DAMPING = 7;

// ------------------------------------------------------------------ 성장

/**
 * 경험치와 레벨.
 *  - 다음 레벨까지 필요한 경험치 = xpBase + xpStep × (현재 레벨 - 1)  →  36, 60, 84, 108 …
 *    (예전 30, 50, 70 …보다 레벨마다 20% 더 필요하다. 천천히 오르도록)
 *  - 레벨이 오를 때마다 최대 체력 +hpPerLevel, 공격력(최소·최대 모두) +damagePerLevel (소수점은 반올림)
 *    레벨만으로 오르는 기본 성장이다. 나머지는 레벨업 포인트로 올리는 능력치(ATTRIBUTES)와 장비가 더한다.
 * 레벨 1의 체력·공격력은 위의 PLAYER.maxHp, damageMin, damageMax다.
 */
export const PROGRESSION = {
  /** 슬라임 한 마리를 잡으면 얻는 경험치 */
  slimeXp: 10,
  xpBase: 36,
  xpStep: 24,
  maxLevel: 30,
  hpPerLevel: 4,
  damagePerLevel: 0.5,
};

/**
 * 마나와 회전 베기.
 *  - 최대 마나 = base + perLevel × (레벨 - 1) + 지능(INT)의 몫. 레벨이 오르면 가득 찬다.
 *  - 게임 시계로 초당 regenPerSecond씩 저절로 차고, 검으로 적을 벨 때마다 perHit씩 찬다.
 *  - 집·여관에서 쉬거나 치유소에서 치료받으면 가득 찬다.
 */
export const MANA = {
  base: 30,
  perLevel: 1,
  regenPerSecond: 0.5,
  perHit: 2,
};

/**
 * 회전 베기(스킬 버튼, 키 K): 마나를 써서 주인공 둘레(지면 타원, 반지름 radius)의 적을 한꺼번에 벤다.
 * 세 번째 콤보 자세를 쓰고, hitDelayMs 뒤에 한 번 맞힌다. 피해 = 공격력 × damage.
 */
export const SPIN_SLASH = {
  cost: 15,
  radius: 230,
  damage: 1.5,
  knockback: 1.8,
  hitDelayMs: 180,
  cooldownMs: 900,
};

/**
 * 능력치(상태창). 모두 base에서 시작하고, 레벨이 오를 때마다 pointsPerLevel 포인트를 받아 직접 올린다.
 * 장비도 능력치를 더한다. 각 능력치가 base보다 1 높을 때마다:
 *  - 힘(STR): 공격력 +damagePerStr
 *  - 체력(VIT): 최대 체력 +hpPerVit
 *  - 방어력(DEF): 받는 피해 = 100 / (100 + defensePerDef × 초과분) 배 (최소 1)
 *  - 민첩(DEX): 적의 공격을 그냥 피할 확률 +evadePerDex (최대 maxEvade),
 *               회피 재사용 대기 −dodgePerDex (1 − dodgePerDex × 초과분 배, 최소 minDodgeScale, 즉 최대 30% 감소)
 *  - 지능(INT): 최대 마나 +mpPerInt, 스킬·마법 피해 +skillPerInt
 *  - 행운(LUK): 치명타 확률 +critPerLuk, 골드 +goldPerLuk
 */
export const ATTRIBUTES = {
  base: 5,
  pointsPerLevel: 3,
  damagePerStr: 1.2,
  hpPerVit: 10,
  defensePerDef: 5,
  evadePerDex: 0.002,
  maxEvade: 0.3,
  dodgePerDex: 0.005,
  minDodgeScale: 0.7,
  mpPerInt: 3,
  skillPerInt: 0.03,
  critPerLuk: 0.005,
  goldPerLuk: 0.02,
};

/**
 * 공명: 패링에 성공할 때마다 체력 옆의 구슬이 1/3씩 찬다(orbs개, 칸 하나는 parts조각).
 * 구슬 cost조각(=다섯 개 전부)을 쓰면 durationMs(게임 시간) 동안 주는 피해가 damageScale배, 받는 피해가 takenScale배가 된다.
 * 이야기를 진행하며 perParry·durationMs·damageScale·takenScale을 하나씩 늘려 줄 예정이다.
 */
export const RESONANCE = {
  orbs: 5,
  parts: 3,
  perParry: 1,
  cost: 15,
  durationMs: 10000,
  damageScale: 1.2,
  takenScale: 0.8,
};

/**
 * 막기(패링, 막기 버튼·키 L): 누르는 순간부터 windowMs 동안만 막는다(누르고 있어도 길어지지 않는다).
 * 그 사이 앞쪽(바라보는 쪽)에서 온 공격을 막으면 패링: 피해가 전혀 없고 밀리지도 않으며,
 * 그 적은 stunMs 동안 휘청이고, 다음 공격은 저스트 회피처럼 반격(JUST_DODGE.counterMs 안)이 된다.
 * 헛막으면 cooldownMs 동안 다시 막을 수 없다(패링에 성공하면 바로 다시 막을 수 있다).
 * 막는 동안에는 moveScale배로 천천히 움직인다.
 */
export const BLOCK = {
  windowMs: 250,
  cooldownMs: 1000,
  stunMs: 1200,
  moveScale: 0.4,
};
