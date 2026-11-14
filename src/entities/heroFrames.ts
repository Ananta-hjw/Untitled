export type Facing = 'down' | 'left' | 'right' | 'up';
export type HeroAction = 'idle' | 'walk' | 'attack1' | 'attack2' | 'attack3' | 'dodge';

export const WALK_FPS = 8;
const WALK_CYCLE = [1, 2, 3, 2];
const DIRECTIONS: Facing[] = ['down', 'left', 'right', 'up'];
export const ACTION_DURATION = { attack1: 420, attack2: 320, attack3: 400, dodge: 300 };
// Put the drawn striking pose inside each configured damage window.
const POSE_STARTS = {
  attack1: [0, 126, 200, 290],
  attack2: [0, 64, 125, 200],
  attack3: [0, 112, 168, 300],
  dodge: [0, 60, 130, 240],
};

/** Phaser world Y grows downward; only actual displacement changes walking direction. */
export function movementFacing(dx: number, dy: number, previous: Facing, moving: boolean): Facing {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) < 0.001) return previous;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  let horizontal = ax > ay;
  if (moving) {
    if ((previous === 'left' || previous === 'right') && ax * 1.25 >= ay) horizontal = true;
    else if ((previous === 'up' || previous === 'down') && ay * 1.25 >= ax) horizontal = false;
  }
  return horizontal ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
}

export function heroFrame(action: HeroAction, facing: Facing, elapsedMs: number): string {
  const time = Math.max(0, elapsedMs);
  if (action === 'idle' || action === 'walk') {
    const column = action === 'walk' ? WALK_CYCLE[Math.floor(time * WALK_FPS / 1000) % 4] : 0;
    return `walk-${DIRECTIONS.indexOf(facing) * 4 + column}`;
  }
  const starts = POSE_STARTS[action];
  let column = 0;
  while (column < 3 && time >= starts[column + 1]) column++;
  const row = action === 'dodge' ? 3 : Number(action.at(-1)) - 1;
  return `combat-${row * 4 + column}`;
}
