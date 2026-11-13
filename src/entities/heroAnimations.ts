/**
 * 주인공 뼈대의 동작 정의.
 *
 * 각 동작은 "진행도(0~1)를 받아 뼈마다 회전값(도)을 돌려주는 함수"다.
 * 회전은 화면에서 시계 방향이 +이고, 캐릭터는 오른쪽을 보고 있다.
 *   - 아래로 늘어진 팔다리: +는 뒤로(왼쪽), -는 앞으로(오른쪽)
 *   - 위로 선 몸통·머리:   +는 앞으로 숙임, -는 뒤로 젖힘
 *   - 팔꿈치(forearm):    -가 접는 방향. +로 주면 반대로 꺾여 보인다.
 *   - 무릎(shin):         +가 접는 방향
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
      const from = a[name] ?? 0;
      const to = b[name] ?? 0;
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
      upper_arm_r: 2 + s * 1.5,
      forearm_r: -8 - s * 2,
      upper_arm_l: -2 - s * 1.5,
      forearm_l: -4,
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
      upper_arm_r: s * 16,
      forearm_r: -18 - Math.max(0, -s) * 16,
      upper_arm_l: -s * 18,
      forearm_l: -14 - Math.max(0, s) * 10,
      hair_back: 9 + twice * 4,
      ponytail: 8 + Math.sin(p * TAU * 2 - 0.8) * 6,
      sash: 12 + Math.sin(p * TAU * 2 - 1.2) * 7,
      scabbard: twice * 2,
    };
  },
};

/** 1타: 뒤로 크게 돌려 머리 위에서 앞으로 내려친다. 검 든 팔이 한 바퀴(360도) 돈다. */
const attack1: RigAnimation = {
  duration: 0.3,
  loop: false,
  follow: 38,
  pose: keyframes([
    [0, {}],
    [0.22, { upper_arm_r: 160, forearm_r: -40, hand_r: 25, chest: -8, head: -4, hair_back: -8, thigh_r: -4, x: -3 }],
    [0.42, { upper_arm_r: 250, forearm_r: -35, hand_r: -10, chest: 6, head: 2, upper_arm_l: 20, x: 5, y: 3 }],
    [0.6, { upper_arm_r: 322, forearm_r: -8, hand_r: -14, chest: 13, head: 4, upper_arm_l: 30, hair_back: 14, ponytail: 16, sash: 16, thigh_l: -10, shin_l: 12, x: 8, y: 6 }],
    [1, { upper_arm_r: 360, forearm_r: -8, chest: 3, hair_back: 6, ponytail: 6, sash: 6, y: 2 }],
  ]),
};

/** 2타: 아래에서 위로 올려 벤다. 팔이 1타와 반대 방향으로 돈다. */
const attack2: RigAnimation = {
  duration: 0.3,
  loop: false,
  follow: 38,
  pose: keyframes([
    [0, {}],
    [0.2, { upper_arm_r: 30, forearm_r: -25, chest: 10, head: 4, x: 2, y: 6, thigh_l: -8, shin_l: 12 }],
    [0.42, { upper_arm_r: -80, forearm_r: -30, hand_r: -12, chest: 4, x: 6, y: 3 }],
    [0.6, { upper_arm_r: -160, forearm_r: -60, hand_r: -10, chest: -9, head: -6, upper_arm_l: 24, hair_back: -10, ponytail: -10, sash: -8, x: 6 }],
    [0.8, { upper_arm_r: -250, forearm_r: -70, chest: -4, hair_back: -4 }],
    [1, { upper_arm_r: -360, forearm_r: -8 }],
  ]),
};

/** 3타(마무리): 팔을 뒤로 당겼다가 몸을 던지며 깊게 찌른다. */
const attack3: RigAnimation = {
  duration: 0.4,
  loop: false,
  follow: 34,
  pose: keyframes([
    [0, {}],
    [0.28, { upper_arm_r: 50, forearm_r: -100, hand_r: -8, chest: -10, head: -4, upper_arm_l: -30, forearm_l: -30, x: -8, y: 5, thigh_r: 6, hair_back: -6 }],
    [0.42, { upper_arm_r: -104, forearm_r: -12, hand_r: -22, chest: 18, head: -8, upper_arm_l: 55, forearm_l: -10, x: 20, y: 14, thigh_l: -42, shin_l: 46, foot_l: -6, thigh_r: 26, shin_r: 6, hair_back: 24, ponytail: 26, sash: 26 }],
    [0.72, { upper_arm_r: -100, forearm_r: -10, hand_r: -22, chest: 16, head: -6, upper_arm_l: 50, forearm_l: -10, x: 18, y: 13, thigh_l: -40, shin_l: 44, foot_l: -6, thigh_r: 24, shin_r: 6, hair_back: 12, ponytail: 12, sash: 14 }],
    [1, { y: 2, forearm_r: -8 }],
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
    upper_arm_r: 34,
    forearm_r: -35,
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
