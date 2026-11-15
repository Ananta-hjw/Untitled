export type Facing = 'down' | 'left' | 'right' | 'up' | 'down-left' | 'down-right' | 'up-left' | 'up-right';
export type AttackFacing = Exclude<Facing, 'up' | 'down'>;
export type HeroAction = 'idle' | 'walk' | 'attack1' | 'attack2' | 'attack3' | 'dodge';

export const WALK_FPS = 8;
const WALK_CYCLE = [1, 2, 3, 2];
const DIRECTIONS: Facing[] = ['down', 'left', 'right', 'up'];
const DIAGONALS: Facing[] = ['down-left', 'down-right', 'up-left', 'up-right'];
const COMPASS: Facing[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
export const ACTION_DURATION = { attack1: 420, attack2: 320, attack3: 400, dodge: 300 };
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

export function attackFacingFor(facing: Facing, horizontalSide = 1): AttackFacing {
  return facing === 'up' || facing === 'down' ? horizontalSide < 0 ? 'left' : 'right' : facing;
}

/** Unit direction on the ground plane; apply the vertical projection when moving in world space. */
export function attackVector(facing: AttackFacing): { x: number; y: number } {
  const x = facing.includes('left') ? -1 : 1;
  if (facing === 'left' || facing === 'right') return { x, y: 0 };
  return { x: x * Math.SQRT1_2, y: (facing.startsWith('up') ? -1 : 1) * Math.SQRT1_2 };
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
  const time = Math.max(0, elapsedMs);
  if (action === 'idle' || action === 'walk') {
    const column = action === 'walk' ? WALK_CYCLE[Math.floor(time * WALK_FPS / 1000) % 4] : 0;
    const diagonal = DIAGONALS.indexOf(facing);
    return diagonal >= 0 ? `diagonal-${diagonal * 4 + column}` : `walk-${DIRECTIONS.indexOf(facing) * 4 + column}`;
  }
  const starts = POSE_STARTS[action];
  let column = 0;
  while (column < 3 && time >= starts[column + 1]) column++;
  const row = action === 'dodge' ? 3 : Number(action.at(-1)) - 1;
  if (action !== 'dodge' && DIAGONALS.includes(facing)) {
    return `attack-${facing.startsWith('up') ? 'up' : 'down'}-${row * 4 + column}`;
  }
  return `combat-${row * 4 + column}`;
}
