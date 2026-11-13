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
