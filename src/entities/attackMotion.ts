import type { Blade } from '../combat/blade.ts';
import type { AttackFacing } from './heroFrames.ts';

export type SlashFxFrame = 'slash-1' | 'slash-2' | 'thrust-3';

export interface SlashFxPlacement {
  frame: SlashFxFrame;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  flipY: boolean;
  behind: boolean;
}

/** Place the effect on the displayed blade, including weapon scale, lunge and mirrored hands. */
export function slashFxPlacement(stage: number, facing: AttackFacing, previous: Blade, current: Blade): SlashFxPlacement {
  const dx = current.tip.x - current.base.x, dy = current.tip.y - current.base.y;
  const length = Math.hypot(dx, dy);
  const middle = { x: current.base.x + dx * 0.55, y: current.base.y + dy * 0.55 };
  // A slash follows the swept tips; a thrust stays exactly on the current blade axis.
  const trailWeight = stage === 2 ? 0 : 0.15;
  return {
    frame: stage === 2 ? 'thrust-3' : stage === 0 ? 'slash-1' : 'slash-2',
    x: middle.x + (previous.tip.x - current.tip.x) * trailWeight,
    y: middle.y + (previous.tip.y - current.tip.y) * trailWeight,
    rotation: Math.atan2(dy, dx),
    width: length * (stage === 2 ? 1.3 : 1.65),
    height: length * (stage === 2 ? 0.38 : stage === 0 ? 0.8 : 0.5),
    flipY: facing.includes('left'),
    behind: facing.startsWith('up'),
  };
}
