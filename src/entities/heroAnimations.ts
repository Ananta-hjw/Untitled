/**
 * 주인공 뼈대의 동작 정의.
 *
 * 각 동작은 "진행도(0~1)를 받아 뼈마다 회전값(도)을 돌려주는 함수"다.
 * 회전은 화면에서 시계 방향이 +이고, 캐릭터는 오른쪽을 보고 있다.
 *   - 아래로 늘어진 팔다리: +는 뒤로(왼쪽), -는 앞으로(오른쪽)
 *   - 위로 선 몸통·머리:   +는 앞으로 숙임, -는 뒤로 젖힘
 *   - 팔꿈치(forearm):    -가 접는 방향. +로 주면 반대로 꺾여 보인다.
 *   - 무릎(shin):         +가 접는 방향
 *
 * 검 든 팔의 각도를 잡는 법 (아래로 늘어뜨린 방향이 0, 앞 수평이 -90, 머리 위가 -180):
 *   위팔 방향   = 19 + upper_arm_r
 *   아래팔 방향 = 19 + upper_arm_r + forearm_r
 *   검날 방향   =  5 + upper_arm_r + forearm_r + hand_r
 * 예) 기본 자세(5, -55, 0): 아래팔 -31, 검날 -45 → 검끝이 앞쪽 아래를 향한다.
 * x, y는 골반 전체를 옮기는 값(리그 좌표, y는 아래가 +)이다.
 *
 * 숫자를 바꾸면 바로 움직임이 달라진다. 뼈 이름은 src/assets/hero/rig.json 참고.
 */

export interface Pose {
  x?: number;
  y?: number;
  hip?: number;
  chest?: number;
  head?: number;
  hair_back?: number;
  ponytail?: number;
  upper_arm_r?: number;
  forearm_r?: number;
  hand_r?: number;
  sword?: number;
  upper_arm_l?: number;
  forearm_l?: number;
  hand_l?: number;
  thigh_r?: number;
  shin_r?: number;
  foot_r?: number;
  thigh_l?: number;
  shin_l?: number;
  foot_l?: number;
  sash?: number;
  scabbard?: number;
}

export interface RigAnimation {
  /** 한 번 재생하는 데 걸리는 시간(초) */
  duration: number;
  loop: boolean;
  /** 목표 자세를 따라가는 빠르기. 클수록 즉각적이고 작을수록 부드럽다. */
  follow: number;
  pose: (phase: number) => Pose;
}

const TAU = Math.PI * 2;

/**
 * 동작이 값을 주지 않은 뼈가 돌아갈 기본 자세.
 * 검 든 팔은 팔꿈치를 굽혀 검끝이 앞쪽 아래를 향하게 든다.
 */
export const REST: Pose = { upper_arm_r: 5, forearm_r: -55 };

/** [진행도, 자세] 목록 사이를 부드럽게 이어 주는 함수를 만든다. */
function keyframes(frames: Array<[number, Pose]>): (phase: number) => Pose {
  const names = new Set<keyof Pose>();
  for (const [, pose] of frames) for (const name of Object.keys(pose)) names.add(name as keyof Pose);

  return (phase) => {
    let i = 0;
    while (i < frames.length - 2 && phase > frames[i + 1][0]) i++;
    const [t0, a] = frames[i];
    const [t1, b] = frames[i + 1];
    let t = Math.min(1, Math.max(0, (phase - t0) / (t1 - t0)));
    t = t * t * (3 - 2 * t); // 가속했다가 감속
    const out: Pose = {};
    for (const name of names) {
      const from = a[name] ?? REST[name] ?? 0;
      const to = b[name] ?? REST[name] ?? 0;
      out[name] = from + (to - from) * t;
    }
    return out;
  };
}

const idle: RigAnimation = {
  duration: 2.6,
  loop: true,
  follow: 10,
  pose: (p) => {
    const s = Math.sin(p * TAU);
    const late = Math.sin(p * TAU - 0.9);
    return {
      y: 1.5 + s * 1.5,
      chest: s * 1.2,
      head: -s * 1.2,
      upper_arm_r: 5 + s * 1.5,
      forearm_r: -55 - s * 2.5,
      upper_arm_l: -2 - s * 1.5,
      forearm_l: -6,
      hair_back: late * 2.5,
      ponytail: late * 3.5,
      sash: late * 3,
      thigh_r: -s * 0.8,
      thigh_l: -s * 0.8,
      shin_r: s * 1.6,
      shin_l: s * 1.6,
    };
  },
};

const walk: RigAnimation = {
  duration: 0.62,
  loop: true,
  follow: 22,
  pose: (p) => {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    const twice = Math.sin(p * TAU * 2);
    // 다리를 앞으로 내미는 구간에서만 무릎을 굽힌다.
    const bendR = Math.max(0, c);
    const bendL = Math.max(0, -c);
    return {
      y: 2 + Math.abs(c) * 4,
      chest: 4 + twice * 1.5,
      head: -2 - twice,
      thigh_r: -s * 26 - bendR * 8,
      shin_r: bendR * 38 + 4,
      foot_r: -bendR * 10,
      thigh_l: s * 26 - bendL * 8,
      shin_l: bendL * 38 + 4,
      foot_l: -bendL * 10,
      // 검 든 팔은 검을 앞으로 든 채 조금만 흔든다.
      upper_arm_r: 8 + s * 9,
      forearm_r: -58 + s * 6,
      upper_arm_l: -s * 18,
      forearm_l: -14 - Math.max(0, s) * 10,
      hair_back: 9 + twice * 4,
      ponytail: 8 + Math.sin(p * TAU * 2 - 0.8) * 6,
      sash: 12 + Math.sin(p * TAU * 2 - 1.2) * 7,
      scabbard: twice * 2,
    };
  },
};

/**
 * 1타: 위에서 아래로 내려치기.
 *   준비 → 팔꿈치를 굽혀 검을 어깨 위로 → 몸통이 먼저 돌아오고 → 팔꿈치가 펴지며 내려침
 *   → 손이 허리 앞에서 멈춤 → 머리카락·천이 늦게 따라옴 → 자세 회복
 * 타격 시점(진행도 약 0.52)은 config.ts의 combo[0].hitDelayMs와 맞춰 둔다.
 */
const attack1: RigAnimation = {
  duration: 0.42,
  loop: false,
  follow: 40,
  pose: keyframes([
    // 1. 준비: 왼발을 조금 앞에, 무릎을 살짝 굽힌다.
    [0, { y: 3, thigh_l: -8, shin_l: 10, thigh_r: 4, shin_r: 6 }],
    // 2. 들어 올리기: 팔꿈치를 굽혀 검을 어깨 위로. 무게중심은 뒷발로.
    [0.3, {
      upper_arm_r: -188, forearm_r: -80, hand_r: 36,
      chest: -9, head: -3, x: -6, y: 4,
      upper_arm_l: -24, forearm_l: -30,
      thigh_l: -10, shin_l: 8, thigh_r: 8, shin_r: 12,
      hair_back: -8, ponytail: -8, sash: -6,
    }],
    // 3. 내려치기 시작: 몸통이 먼저 앞으로, 어깨와 팔꿈치가 따라오고 검끝은 뒤에 남는다.
    [0.4, {
      upper_arm_r: -168, forearm_r: -92, hand_r: 40,
      chest: 3, head: 0, x: 2, y: 5,
      upper_arm_l: -6, forearm_l: -24,
      thigh_l: -14, shin_l: 16, thigh_r: 10, shin_r: 8,
      hair_back: -12, ponytail: -12, sash: -10,
    }],
    // 4. 내려오는 순간: 팔꿈치가 펴지며 검이 머리 위에서 몸 앞으로.
    [0.52, {
      upper_arm_r: -92, forearm_r: -30, hand_r: 4,
      chest: 10, head: 3, x: 7, y: 7,
      upper_arm_l: 18, forearm_l: -20,
      thigh_l: -18, shin_l: 22, thigh_r: 14, shin_r: 6,
      hair_back: -4, ponytail: -6, sash: -4,
    }],
    // 5. 베기 완료: 손은 허리 앞, 검끝은 앞쪽 아래. 앞무릎이 조금 더 굽는다.
    [0.63, {
      upper_arm_r: -26, forearm_r: -42, hand_r: 0,
      chest: 15, head: 5, x: 9, y: 11,
      upper_arm_l: 30, forearm_l: -18,
      thigh_l: -22, shin_l: 30, thigh_r: 16, shin_r: 6,
      hair_back: 6, ponytail: 4, sash: 8,
    }],
    // 6. 마무리: 팔과 몸통은 멈추고 머리카락과 천이 늦게 따라온다.
    [0.8, {
      upper_arm_r: -22, forearm_r: -44, hand_r: 0,
      chest: 14, head: 4, x: 9, y: 10,
      upper_arm_l: 28, forearm_l: -18,
      thigh_l: -22, shin_l: 30, thigh_r: 16, shin_r: 6,
      hair_back: 20, ponytail: 20, sash: 20,
    }],
    // 7. 자세 회복
    [1, { y: 2, hair_back: 6, ponytail: 6, sash: 6 }],
  ]),
};

/** 2타: 낮게 내렸다가 아래에서 위로 올려 벤다. */
const attack2: RigAnimation = {
  duration: 0.32,
  loop: false,
  follow: 40,
  pose: keyframes([
    [0, {}],
    [0.2, { upper_arm_r: 14, forearm_r: -28, hand_r: 12, chest: 12, head: 4, x: 2, y: 9, thigh_l: -14, shin_l: 22, thigh_r: 8, shin_r: 10 }],
    [0.42, { upper_arm_r: -72, forearm_r: -30, hand_r: 0, chest: 5, x: 6, y: 5, upper_arm_l: 14, thigh_l: -14, shin_l: 16, hair_back: 6 }],
    [0.58, { upper_arm_r: -140, forearm_r: -46, hand_r: 0, chest: -7, head: -5, x: 6, y: 1, upper_arm_l: 26, hair_back: -10, ponytail: -10, sash: -8 }],
    [0.74, { upper_arm_r: -152, forearm_r: -72, hand_r: 10, chest: -9, head: -5, x: 4, y: 1, upper_arm_l: 22, hair_back: -16, ponytail: -16, sash: -14 }],
    [1, { hair_back: -4, ponytail: -4 }],
  ]),
};

/** 3타(마무리): 팔꿈치를 뒤로 당겼다가 몸을 던지며 깊게 찌른다. */
const attack3: RigAnimation = {
  duration: 0.4,
  loop: false,
  follow: 36,
  pose: keyframes([
    [0, {}],
    [0.28, { upper_arm_r: 62, forearm_r: -132, hand_r: -34, chest: -10, head: -4, upper_arm_l: -30, forearm_l: -30, x: -8, y: 5, thigh_r: 6, hair_back: -6 }],
    [0.42, { upper_arm_r: -76, forearm_r: -18, hand_r: -10, chest: 18, head: -8, upper_arm_l: 55, forearm_l: -10, x: 20, y: 14, thigh_l: -42, shin_l: 46, foot_l: -6, thigh_r: 26, shin_r: 6, hair_back: 24, ponytail: 26, sash: 26 }],
    [0.72, { upper_arm_r: -74, forearm_r: -18, hand_r: -10, chest: 16, head: -6, upper_arm_l: 50, forearm_l: -10, x: 18, y: 13, thigh_l: -40, shin_l: 44, foot_l: -6, thigh_r: 24, shin_r: 6, hair_back: 12, ponytail: 12, sash: 14 }],
    [1, { y: 2 }],
  ]),
};

/** 회피: 몸을 낮추고 앞으로 쏠린 자세를 유지한다. */
const dodge: RigAnimation = {
  duration: 0.3,
  loop: true,
  follow: 30,
  pose: () => ({
    x: 8,
    y: 24,
    chest: 26,
    head: -14,
    thigh_l: -46,
    shin_l: 58,
    foot_l: -10,
    thigh_r: 22,
    shin_r: 34,
    foot_r: 10,
    upper_arm_r: 40,
    forearm_r: -70,
    upper_arm_l: 30,
    forearm_l: -40,
    hair_back: 34,
    ponytail: 30,
    sash: 36,
    scabbard: 8,
  }),
};

export const HERO_ANIMATIONS: Record<string, RigAnimation> = {
  idle,
  walk,
  attack1,
  attack2,
  attack3,
  dodge,
};
