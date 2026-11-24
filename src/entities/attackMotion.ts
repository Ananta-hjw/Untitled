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
  const side = facing === 'right' || facing === 'left';
  const base = {
    frame: (stage === 2 ? 'thrust-3' : stage === 0 ? 'slash-1' : 'slash-2') as SlashFxFrame,
    rotation: Math.atan2(dy, dx),
    flipY: facing.includes('left'),
    behind: facing.startsWith('up'),
  };
  // 옆 1타(머리 뒤에서 앞으로 내려 베기): 검기 전체를 손(코등이) 앞에 둔다. 이전 칼끝 쪽으로 당기면
  // 초승달의 꼬리가 머리 위에 겹쳐, 밝게 더해지는 검기가 얼굴을 하얗게 덮었다.
  if (side && stage === 0) {
    const width = length * 1.8;
    // 머리 위에서 내려오는 베기라 초승달의 굵은 몸통이 칼날 위쪽(지나온 쪽)에 오도록 위아래를 뒤집는다.
    // 공격 중 앞으로 내딛으므로 코등이보다 칼 길이의 15%만큼 더 앞에서 시작해, 사라지는 동안에도 얼굴에 닿지 않게 한다.
    const start = width / 2 + length * 0.15;
    return { ...base, flipY: !base.flipY, x: current.base.x + dx / length * start, y: current.base.y + dy / length * start, width, height: length * 0.85 };
  }
  // 옆 3타(마무리 찌르기): 코등이에서 칼끝 너머까지 길고 굵게 뻗는다.
  if (side && stage === 2) {
    return { ...base, x: current.base.x + dx * 0.8, y: current.base.y + dy * 0.8, width: length * 1.6, height: length * 0.5 };
  }
  const middle = { x: current.base.x + dx * 0.55, y: current.base.y + dy * 0.55 };
  // A slash follows the swept tips; a thrust stays exactly on the current blade axis.
  const trailWeight = stage === 2 ? 0 : 0.15;
  return {
    ...base,
    x: middle.x + (previous.tip.x - current.tip.x) * trailWeight,
    y: middle.y + (previous.tip.y - current.tip.y) * trailWeight,
    width: length * (stage === 2 ? 1.3 : 1.65),
    height: length * (stage === 2 ? 0.38 : stage === 0 ? 0.8 : 0.5),
  };
}
