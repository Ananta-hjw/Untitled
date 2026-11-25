import { PLAYER } from '../config.ts';
import { attackPoseTime } from './attackTiming.ts';

export type Facing = 'down' | 'left' | 'right' | 'up' | 'down-left' | 'down-right' | 'up-left' | 'up-right';
export type AttackFacing = Facing;
export type HeroAction = 'idle' | 'walk' | 'attack1' | 'attack2' | 'attack3' | 'dodge';

export const WALK_FPS = 8;
const WALK_CYCLE = [1, 2, 3, 2];
const DIRECTIONS: Facing[] = ['down', 'left', 'right', 'up'];
const DIAGONALS: Facing[] = ['down-left', 'down-right', 'up-left', 'up-right'];
const COMPASS: Facing[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
export const ACTION_DURATION = { attack1: 420 + PLAYER.combo[0].followPauseMs, attack2: 320 + PLAYER.combo[1].followPauseMs, attack3: 400 + PLAYER.combo[2].followPauseMs, dodge: 300 };

export function guardFrame(facing: Facing): string {
  if (facing === 'down') return 'guard-front';
  if (facing === 'up') return 'guard-back';
  if (facing === 'up-left' || facing === 'up-right') return 'guard-up-back';
  return `guard-${facing.startsWith('up') ? 'up' : facing.startsWith('down') ? 'down' : 'side'}`;
}
// Put the drawn striking pose inside each configured damage window.
// 준비 자세(0번)는 짧게 두어 누르자마자 칼을 드는 것이 보이게 하고, 그만큼 들어 올린 자세(1번)를 길게 보여 준다.
// 2타(올려 베기)는 낮은 자세에서 올라가는 궤적으로 맞히므로, 타격 그림이 명중 구간이 열리는 순간(hitDelayMs)에 바뀐다.
// 그래야 맞는 순간 화면에 낮은 준비 자세가 아니라 올려 베는 그림이 보인다.
const POSE_STARTS = {
  attack1: [0, 45, 200, 290],
  attack2: [0, 40, 105, 200],
  attack3: [0, 50, 168, 300],
  dodge: [0, 60, 130, 240],
};
/** 신규 4포즈(예비→스윙/당김→타격/찌르기→잔심) 시트용 전환 시각(ms). */
const PROTO_POSE_STARTS = {
  attack1: [0, 145, 205, 305],
  attack2: [0, 68, 105, 205],
  attack3: [0, 50, 168, 300],
};

/**
 * 옆(좌우)과 정면(아래)의 1·2·3타는 6자세 원화를 쓴다(attack-six/). 각 공격의 타격 자세(3번)가 명중 구간
 * (hitDelayMs ~ +hitWindowMs)을 덮는다.
 * - 1타 내려 베기: 준비→예비→최대 들어 올림(길게, 힘을 모음)→타격→마무리→복귀
 * - 2타 올려 베기: 시작(1타의 끝)→낮게 뒤로 당김→휘두르기 시작→타격→마무리(위로)→자세 정리(3타의 시작)
 *   가장 빠른 공격이라 예비 동작을 짧게 둔다.
 * - 3타 찌르기: 시작(2타의 끝)→당김→깊이 웅크림→찌르기→유지(마무리 멈춤 동안)→복귀(1타의 시작)
 */
const SIDE_SIX = {
  attack1: { frame: 'attack-side6', starts: [0, 40, 110, 200, 280, 350] },
  attack2: { frame: 'attack2-side6', starts: [0, 25, 65, 105, 170, 250] },
  attack3: { frame: 'attack3-side6', starts: [0, 40, 100, 170, 245, 330] },
} as const;

/** 정면 6자세: 같은 공격 구성이라 자세 시각도 옆모습과 같다. */
const FRONT_SIX = {
  attack1: { frame: 'attack-front6', starts: SIDE_SIX.attack1.starts },
  attack2: { frame: 'attack2-front6', starts: SIDE_SIX.attack2.starts },
  attack3: { frame: 'attack3-front6', starts: SIDE_SIX.attack3.starts },
} as const;

/** 위쪽(뒷모습) 6자세: 같은 공격 구성이라 자세 시각도 옆모습과 같다. */
const BACK_SIX = {
  attack1: { frame: 'attack-back6', starts: SIDE_SIX.attack1.starts },
  attack2: { frame: 'attack2-back6', starts: SIDE_SIX.attack2.starts },
  attack3: { frame: 'attack3-back6', starts: SIDE_SIX.attack3.starts },
} as const;

// 앞대각선은 첫 타격 뒤 칼이 더 가파르게 내려오므로 명중 구간 안에 마무리 자세도 넣는다.
const DOWN_DIAG_SIX = { frame: 'attack-down-diag6', starts: [0, 40, 110, 200, 250, 350] } as const;

function sixPoseAttack(action: HeroAction, facing: Facing) {
  if (action === 'idle' || action === 'walk' || action === 'dodge') return undefined;
  if (facing === 'right' || facing === 'left') return SIDE_SIX[action];
  if (facing === 'up') return BACK_SIX[action];
  if (action === 'attack1' && (facing === 'down-right' || facing === 'down-left')) {
    return DOWN_DIAG_SIX;
  }
  return facing === 'down' ? FRONT_SIX[action] : undefined;
}

function usesFrontPoses(facing: Facing): boolean {
  return facing === 'down' || facing === 'down-right' || facing === 'down-left';
}

/** 콤보 단계(0~2)와 방향에 맞는 타격 자세가 나타나는 시각(ms). */
export function strikePoseStart(stage: number, facing: Facing = 'right'): number {
  const six = sixPoseAttack(`attack${stage + 1}` as HeroAction, facing);
  if (six) return six.starts[3];
  const starts = usesFrontPoses(facing) ? PROTO_POSE_STARTS : POSE_STARTS;
  return starts[`attack${stage + 1}` as 'attack1' | 'attack2' | 'attack3'][2];
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
  const useProto = action !== 'dodge' && usesFrontPoses(facing);
  const starts = useProto
    ? PROTO_POSE_STARTS[action as 'attack1' | 'attack2' | 'attack3']
    : POSE_STARTS[action];
  let column = 0;
  // Accumulated 30/60fps deltas can be a fraction below the scene clock at a pose boundary.
  while (column < 3 && time + 1e-6 >= starts[column + 1]) column++;
  const row = action === 'dodge' ? 3 : Number(action.at(-1)) - 1;
  if (action === 'dodge' && (facing === 'up' || facing === 'down')) return `dodge-${facing}-${column}`;
  if (action !== 'dodge') {
    if (facing === 'down') return `attack-front-${row * 4 + column}`;
    if (facing === 'down-right' || facing === 'down-left') {
      // 3타의 복귀와 1타의 준비에 같은 몸과 칼 좌표를 써서 콤보를 잇는다.
      if (action === 'attack3' && column === 3) return `${DOWN_DIAG_SIX.frame}-0`;
      return `attack-down-diag-${row * 4 + column}`;
    }
    if (facing === 'up') return `attack-back-${row * 4 + column}`;
    if (facing.startsWith('up')) return `attack-up-${row * 4 + column}`;
  }
  return `combat-${row * 4 + column}`;
}
