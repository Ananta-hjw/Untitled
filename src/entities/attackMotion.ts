import { attackVector, type AttackFacing } from './heroFrames.ts';

export type SlashFxFrame = 'slash-1' | 'slash-2' | 'thrust-3';

export interface SlashFxPlacement {
  frame: SlashFxFrame;
  /** 발(0,0) 기준 이펙트 중심 오프셋(px). */
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  behind: boolean;
}

/**
 * 8방향·3단 콤보에 맞춘 손그림 검기·찌르기 이펙트 배치.
 *  - 1타(slash-1): 오른쪽 위 → 왼쪽 아래 대각선 베기 (왼쪽 계열은 좌우 대칭 반전)
 *  - 2타(slash-2): 왼쪽 위 → 오른쪽 가운데 가로 베기 (왼쪽 계열은 좌우 대칭 반전)
 *  - 3타(thrust-3): 공격 방향 정면으로 일직선 찌르기 + 충격파 링
 */
export function slashFxPlacement(stage: number, facing: AttackFacing): SlashFxPlacement {
  const dir = attackVector(facing);
  const mirrored = facing.includes('left');
  const angle = Math.atan2(dir.y * 0.78, dir.x);

  if (stage === 2) {
    // 3타: thrust-3 원화는 오른쪽(0 rad)을 향한다.
    const dist = facing === 'down' ? 76 : facing === 'up' ? 88 : 108;
    const baseY = facing === 'down' ? -102 : facing === 'up' ? -156 : -124;
    return {
      frame: 'thrust-3',
      offsetX: dir.x * dist,
      offsetY: baseY + dir.y * dist * 0.72,
      rotation: angle,
      scaleX: facing === 'down' || facing === 'up' ? 0.62 : 0.72,
      scaleY: 0.62,
      behind: facing.startsWith('up'),
    };
  }

  const frame: SlashFxFrame = stage === 0 ? 'slash-1' : 'slash-2';
  // 정면(down): 화면 기준 1타(오른쪽 위→왼쪽 아래), 2타(왼쪽 위→오른쪽 가운데)
  if (facing === 'down') {
    return {
      frame,
      offsetX: stage === 0 ? -8 : 14,
      offsetY: stage === 0 ? -96 : -118,
      rotation: stage === 0 ? 0.22 : 0.08,
      scaleX: 0.68,
      scaleY: 0.64,
      behind: false,
    };
  }
  if (facing === 'up') {
    return {
      frame,
      offsetX: stage === 0 ? -8 : 12,
      offsetY: -178,
      rotation: stage === 0 ? -0.18 : -0.06,
      scaleX: 0.64,
      scaleY: 0.56,
      behind: true,
    };
  }

  // 측면·대각선 6방향: 오른쪽 계열 기준으로 잡고, 왼쪽 계열(left/down-left/up-left)은 X축 대칭 반전.
  const sign = mirrored ? -1 : 1;
  const isDown = facing.startsWith('down');
  const isUp = facing.startsWith('up');
  const offsetX = sign * (isDown ? 56 : isUp ? 52 : 66);
  const offsetY = isDown ? -96 : isUp ? -168 : -124;
  // slash-1 원화는 오른쪽 위→왼쪽 아래로 감아 돌아 오른쪽 아래로 빠지는 호,
  // slash-2 원화는 왼쪽 위→오른쪽 가운데로 뻗는 호.
  const baseRot = stage === 0
    ? (isDown ? 0.32 : isUp ? -0.35 : 0.14)
    : (isDown ? 0.22 : isUp ? -0.32 : 0.0);

  return {
    frame,
    offsetX,
    offsetY,
    rotation: mirrored ? -baseRot : baseRot,
    scaleX: sign * (isUp ? 0.60 : 0.66),
    scaleY: isUp ? 0.56 : 0.62,
    behind: isUp,
  };
}
