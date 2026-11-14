import type { DialogueId } from '../story/dialogues.ts';
import { HOME, PROPS } from './villageLayout.ts';

/**
 * 말을 걸거나 살펴볼 수 있는 대상.
 *
 * 플레이어의 발이 대상 주변의 타원(가로 반지름 radius, 세로는 원근감 때문에 그 0.6배) 안에 들어오면
 * "대화" 버튼이 나타난다. NPC를 추가할 때도 여기에 위치와 대사 id를 적으면 된다.
 * 이 파일은 Phaser를 쓰지 않아 tools/dialogue.test.mjs가 직접 불러 검사한다.
 */

export interface Interactable {
  id: string;
  /** 바닥 기준 위치 (발이 닿는 곳) */
  x: number;
  y: number;
  radius: number;
  /** 말풍선을 띄울 높이 (바닥에서 위로) */
  markerHeight: number;
  dialogue: DialogueId;
}

const SIGN = PROPS.find((p) => p.frame === 'sign')!;

export const INTERACTABLES: Interactable[] = [
  { id: 'home-door', x: HOME.entrance.x, y: HOME.entrance.y, radius: 95, markerHeight: 190, dialogue: 'home-door' },
  { id: 'village-sign', x: SIGN.x, y: SIGN.y, radius: 105, markerHeight: 150, dialogue: 'village-sign' },
];

const VERTICAL_RATIO = 0.6;

/** (x, y)에서 닿는 대상 중 가장 가까운 것. 없으면 undefined. */
export function findInteractable(x: number, y: number, list: readonly Interactable[] = INTERACTABLES): Interactable | undefined {
  let best: Interactable | undefined;
  let bestDistance = 1;
  for (const item of list) {
    const nx = (x - item.x) / item.radius;
    const ny = (y - item.y) / (item.radius * VERTICAL_RATIO);
    const distance = nx * nx + ny * ny;
    if (distance <= bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}
