import { PLAYER } from '../config.ts';
import { attackPoseTime } from './attackTiming.ts';

export type Facing = 'down' | 'left' | 'right' | 'up' | 'down-left' | 'down-right' | 'up-left' | 'up-right';
export type AttackFacing = Facing;
export type HeroAction = 'idle' | 'walk' | 'attack1' | 'attack2' | 'attack3' | 'dodge' | 'death';

export const WALK_FPS = 8;
const WALK_CYCLE = [1, 2, 3, 2];
const DIRECTIONS: Facing[] = ['down', 'left', 'right', 'up'];
const DIAGONALS: Facing[] = ['down-left', 'down-right', 'up-left', 'up-right'];
const COMPASS: Facing[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
export const ACTION_DURATION = { attack1: 350 + PLAYER.combo[0].followPauseMs, attack2: 300 + PLAYER.combo[1].followPauseMs, attack3: 380 + PLAYER.combo[2].followPauseMs, dodge: 300, death: 600 };
const DEATH_POSE_STARTS = [0, 80, 170, 270, 390, 520];

/**
 * 공격 캐릭터 포즈는 고퀄리티 4방향(상·하·좌·우)으로 통일한다(A안).
 * 대각선 공격 입력은 좌/우(side) 고해상도 포즈를 쓰고, 전진 방향·타격 판정·검기는 8방향 그대로 유지한다.
 */
export function cardinalPoseFacing(facing: Facing): 'right' | 'left' | 'down' | 'up' {
  if (facing === 'down') return 'down';
  if (facing === 'up') return 'up';
  return facing.includes('left') ? 'left' : 'right';
}

/**
 * 막기는 8방향 판정과 맞춰 8방향 전용 자세를 사용한다(좌측 측면·대각선은 좌우 반전).
 * - right / left: guard-side
 * - down-right / down-left: guard-down
 * - up-right / up-left: guard-up-back
 * - down: guard-front
 * - up: guard-back
 */
export function guardFrame(facing: Facing): string {
  if (facing === 'down') return 'guard-front';
  if (facing === 'up') return 'guard-back';
  if (facing === 'down-left' || facing === 'down-right') return 'guard-down';
  if (facing === 'up-left' || facing === 'up-right') return 'guard-up-back';
  return 'guard-side';
}
// Put the drawn striking pose inside each configured damage window.
const POSE_STARTS = {
  attack1: [0, 35, 140, 225],
  attack2: [0, 30, 106, 190],
  attack3: [0, 45, 168, 258],
  dodge: [0, 60, 130, 240],
};

/**
 * 4방향(옆·정면·뒷면) 1·2·3타 6자세 원화 + 나인솔즈·세키로 스타일 비선형 완급 타이밍:
 * - 예비(1→2)는 힘을 모으는 리듬을 살리고,
 * - 스윙 진입→타격(2→3)은 38~44ms 만에 홱 넘어가 칼날 스미어와 함께 날카롭게 꽂히며,
 * - 타격 후 잔심(4)은 followPause로 딱 멈춰 실루엣을 각인시킨다.
 */
const SIDE_SIX = {
  attack1: { frame: 'attack-side6', starts: [0, 24, 96, 140, 212, 290] },
  attack2: { frame: 'attack2-side6', starts: [0, 20, 68, 106, 176, 250] },
  attack3: { frame: 'attack3-side6', starts: [0, 32, 92, 168, 252, 336] },
} as const;

/** 정면 6자세: 같은 완급 타이밍을 공유한다. */
const FRONT_SIX = {
  attack1: { frame: 'attack-front6', starts: SIDE_SIX.attack1.starts },
  attack2: { frame: 'attack2-front6', starts: SIDE_SIX.attack2.starts },
  attack3: { frame: 'attack3-front6', starts: SIDE_SIX.attack3.starts },
} as const;

/** 위쪽(뒷모습) 6자세: 같은 완급 타이밍을 공유한다. */
const BACK_SIX = {
  attack1: { frame: 'attack-back6', starts: SIDE_SIX.attack1.starts },
  attack2: { frame: 'attack2-back6', starts: SIDE_SIX.attack2.starts },
  attack3: { frame: 'attack3-back6', starts: SIDE_SIX.attack3.starts },
} as const;

function sixPoseAttack(action: HeroAction, facing: Facing) {
  if (action === 'idle' || action === 'walk' || action === 'dodge' || action === 'death') return undefined;
  const dir = cardinalPoseFacing(facing);
  if (dir === 'up') return BACK_SIX[action];
  if (dir === 'down') return FRONT_SIX[action];
  return SIDE_SIX[action];
}

/** 콤보 단계(0~2)와 방향에 맞는 타격 자세가 나타나는 시각(ms). */
export function strikePoseStart(stage: number, facing: Facing = 'right'): number {
  const six = sixPoseAttack(`attack${stage + 1}` as HeroAction, facing);
  if (six) return six.starts[3];
  return POSE_STARTS[`attack${stage + 1}` as 'attack1' | 'attack2' | 'attack3'][2];
}

/** Phaser world Y grows downward; only actual displacement changes walking direction. */
export function movementFacing(dx: number, dy: number, previous: Facing, moving: boolean): Facing {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) < 0.001) return previous;
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  // Eight 45-degree sectors. A 7.5-degree margin prevents analogue input jitter
  // from restarting the walk cycle when it straddles a sector boundary.
  if (moving) {
    const previousAngle = COMPASS.indexOf(previous) * 45;
    const difference = Math.abs((angle - previousAngle + 540) % 360 - 180);
    if (difference <= 30) return previous;
  }
  return COMPASS[Math.round(angle / 45) % 8];
}

export function attackFacingFor(facing: Facing, _horizontalSide = 1): AttackFacing {
  return facing;
}

/** Dodge follows the visible eight-way facing, including a released stick and minor analogue drift. */
export function dodgeFacingFor(dx: number, dy: number, previous: Facing): Facing {
  return Number.isFinite(dx) && Number.isFinite(dy) && dx * dx + dy * dy > 0.04
    ? movementFacing(dx, dy, previous, false) : previous;
}

/** Unit direction on the ground plane; apply the vertical projection when moving in world space. */
export function attackVector(facing: AttackFacing): { x: number; y: number } {
  if (facing === 'up') return { x: 0, y: -1 };
  if (facing === 'down') return { x: 0, y: 1 };
  const x = facing.includes('left') ? -1 : 1;
  if (facing === 'left' || facing === 'right') return { x, y: 0 };
  return { x: x * Math.SQRT1_2, y: (facing.startsWith('up') ? -1 : 1) * Math.SQRT1_2 };
}

/**
 * 정면(아래 방향) 공격의 사거리 판정: 적의 발이 캐릭터 발에서 지면 거리 reach 안쪽 앞에 있는지.
 * 화면 세로는 지면 거리 × verticalRatio로 줄어 보이므로 되돌려 잰다. (옆 범위는 insideAttackLane이 본다)
 */
export function insideFrontReach(dy: number, reach: number, verticalRatio: number): boolean {
  return dy >= 0 && dy / verticalRatio <= reach;
}

/**
 * 아래 대각선 공격의 사거리 판정: 공격 자세가 4방향으로 통일되어 아래 대각선도 옆모습 자세로 그려지므로,
 * 옆으로 휘두르는 칼날이 대각선 앞쪽 아래의 적까지 내려가지 않는다. 정면처럼 판정 띠 안의 지면 거리 reach까지 맞힌다.
 * (옆 범위는 insideAttackLane이 본다)
 */
export function insideDiagonalReach(dx: number, dy: number, reach: number, verticalRatio: number): boolean {
  return dy >= 0 && Math.hypot(dx, dy / verticalRatio) <= reach;
}

/**
 * 위 대각선 3타 찌르기·반격 일섬의 사거리 판정: 수평 찌르기 자세가 위대각선 적의 몸통 아래로 지나쳐
 * 빗나가는 문제를 막기 위해 판정 띠 안의 지면 거리 reach까지 맞힌다.
 */
export function insideUpDiagonalReach(dx: number, dy: number, reach: number, verticalRatio: number): boolean {
  return dy <= 0 && Math.hypot(dx, dy / verticalRatio) <= reach;
}

/** Compare feet on the ground plane, not screen-space character overlap. */
export function insideAttackLane(dx: number, dy: number, direction: { x: number; y: number },
  halfWidth: number, verticalRatio: number): boolean {
  const length = Math.hypot(direction.x, direction.y * verticalRatio);
  if (length === 0) return false;
  const x = direction.x / length, y = direction.y * verticalRatio / length;
  return dx * x + dy * y >= 0 && Math.abs(-dx * y + dy * x) <= halfWidth;
}

export function heroFrame(action: HeroAction, facing: Facing, elapsedMs: number): string {
  const elapsed = Math.max(0, elapsedMs);
  if (action === 'death') {
    let pose = 0;
    while (pose < DEATH_POSE_STARTS.length - 1 && elapsed + 1e-6 >= DEATH_POSE_STARTS[pose + 1]) pose++;
    return `death-${pose}`;
  }
  const time = action.startsWith('attack') ? attackPoseTime(Number(action.at(-1)) - 1, elapsed) : elapsed;
  if (action === 'idle' || action === 'walk') {
    const column = action === 'walk' ? WALK_CYCLE[Math.floor(time * WALK_FPS / 1000) % 4] : 0;
    const diagonal = DIAGONALS.indexOf(facing);
    return diagonal >= 0 ? `diagonal-${diagonal * 4 + column}` : `walk-${DIRECTIONS.indexOf(facing) * 4 + column}`;
  }
  const six = sixPoseAttack(action, facing);
  if (six) {
    let pose = 0;
    while (pose < six.starts.length - 1 && time + 1e-6 >= six.starts[pose + 1]) pose++;
    return `${six.frame}-${pose}`;
  }
  const starts = POSE_STARTS[action];
  let column = 0;
  // Accumulated 30/60fps deltas can be a fraction below the scene clock at a pose boundary.
  while (column < 3 && time + 1e-6 >= starts[column + 1]) column++;
  const row = action === 'dodge' ? 3 : Number(action.at(-1)) - 1;
  if (action === 'dodge' && (facing === 'up' || facing === 'down')) return `dodge-${facing}-${column}`;
  return `combat-${row * 4 + column}`;
}
