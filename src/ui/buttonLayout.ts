/**
 * 오른쪽 아래 전투 버튼 배치. 공격 버튼을 중심으로
 * - 회피: 오른쪽 아래 모서리
 * - 막기: 공격 버튼 왼쪽 아래
 * - 아이템 바로가기 두 칸: 막기 왼쪽, 화면 맨 아래에 가로로
 * - 공명: 아이템 칸 위, 막기 쪽으로 붙여서
 * - 기술 칸 다섯: 공격 버튼 둘레의 호(왼쪽에서 위를 지나 오른쪽 위까지)
 * - 대화: 기술 칸 호의 왼쪽 위 바깥 (NPC 근처에서만 보인다)
 * 모든 거리는 화면 오른쪽 아래 모서리에서 잰 값에 버튼 크기 설정(scale)을 곱하므로,
 * 버튼이 커져도 서로의 간격이 같은 비율로 벌어져 겹치지 않는다.
 * Phaser를 쓰지 않아 tools/button-layout.test.mjs가 직접 불러 검사한다.
 */

export const BUTTON_RADIUS = { attack: 78, dodge: 52, block: 54, item: 42, skill: 34, talk: 56, resonance: 40 } as const;
/** ActionButton의 실제 터치 반경은 그린 원의 1.2배다. */
export const TOUCH_RATIO = 1.2;
export const SKILL_SLOT_COUNT = 5;

export interface Point { x: number; y: number }
export interface CombatButtonLayout {
  attack: Point; dodge: Point; block: Point; items: [Point, Point]; resonance: Point; skills: Point[]; talk: Point;
}

/** 공격 버튼 중심(모서리에서 잰 거리)과 기술 칸 호의 반지름·각도(도, 화면 기준: 0=오른쪽, 270=위) */
const ATTACK = { x: 170, y: 185 };
const SKILL_ARC = { radius: 165, from: 191, step: 32 };

export function combatButtonLayout(width: number, height: number, scale: number): CombatButtonLayout {
  const at = (dx: number, dy: number): Point => ({ x: width - dx * scale, y: height - dy * scale });
  const attack = at(ATTACK.x, ATTACK.y);
  const skills = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => {
    const angle = (SKILL_ARC.from + SKILL_ARC.step * i) * Math.PI / 180;
    return at(ATTACK.x - Math.cos(angle) * SKILL_ARC.radius, ATTACK.y - Math.sin(angle) * SKILL_ARC.radius);
  });
  const corner = BUTTON_RADIUS.dodge + 12;
  return {
    attack,
    dodge: at(corner, corner),
    block: at(330, 105),
    items: [at(446, 58), at(558, 58)],
    resonance: at(435, 170),
    skills,
    talk: at(420, 380),
  };
}

export interface Rect { left: number; top: number; right: number; bottom: number }

/** 조이스틱이 쉬는 자리(손을 뗐을 때 돌아가는 곳) */
export const JOYSTICK_REST = { x: 190, y: 170 } as const;
/** 조이스틱을 잡는 영역의 위쪽 끝 (화면 위의 체력·마나 표시와 안내 글은 피한다) */
const JOYSTICK_ZONE_TOP = 220;

/**
 * 조이스틱을 잡을 수 있는 왼쪽 아래 영역. 이 안 어디를 눌러도 그 자리가 조이스틱의 중심이 된다.
 * 오른쪽 끝은 화면의 절반과, 가장 왼쪽 전투 버튼의 터치 범위에서 24px 떨어진 곳 중 더 왼쪽이다.
 */
export function joystickZone(width: number, height: number, buttonScale: number): Rect {
  const layout = combatButtonLayout(width, height, buttonScale);
  const r = (radius: number) => radius * buttonScale * TOUCH_RATIO;
  const edges = [
    layout.attack.x - r(BUTTON_RADIUS.attack), layout.dodge.x - r(BUTTON_RADIUS.dodge),
    layout.block.x - r(BUTTON_RADIUS.block), layout.talk.x - r(BUTTON_RADIUS.talk),
    ...layout.items.map(p => p.x - r(BUTTON_RADIUS.item)), layout.resonance.x - r(BUTTON_RADIUS.resonance), ...layout.skills.map(p => p.x - r(BUTTON_RADIUS.skill)),
  ];
  return { left: 0, top: JOYSTICK_ZONE_TOP, right: Math.min(width / 2, Math.min(...edges) - 24), bottom: height };
}

/** 누른 자리를 중심으로 하되, 패드가 화면 밖으로 나가지 않게 안쪽으로 당긴다. */
export function joystickCenter(x: number, y: number, radius: number, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(x, radius), width - radius),
    y: Math.min(Math.max(y, radius), height - radius),
  };
}
