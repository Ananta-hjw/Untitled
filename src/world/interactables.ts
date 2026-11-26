import type { DialogueId } from '../story/dialogues.ts';
import { PROPS } from './villageLayout.ts';

/**
 * 말을 걸거나 살펴볼 수 있는 대상.
 *
 * 플레이어의 발이 대상 주변의 타원(가로 반지름 radius, 세로는 원근감 때문에 그 0.6배) 안에 들어오면
 * "대화" 버튼이 나타난다. NPC를 추가할 때도 여기에 위치와 대사 id를 적으면 된다.
 * 이 파일은 Phaser를 쓰지 않아 tools/dialogue.test.mjs가 직접 불러 검사한다.
 */

/** 문처럼 벽에 바짝 붙거나 좌우로 조금 비켜 서도 편하게 닿아야 하는 사각 문턱 범위 (기준점 상대 오프셋). */
export interface InteractableReach {
  /** 좌우 반폭 */
  rx: number;
  /** 기준점 위(안쪽·벽 쪽)로 닿는 거리 */
  up: number;
  /** 기준점 아래(바깥·앞마당 쪽)로 닿는 거리 */
  down: number;
}

export interface Interactable {
  id: string;
  /** 바닥 기준 위치 (발이 닿는 곳) */
  x: number;
  y: number;
  radius: number;
  /** 지정하면 기본 타원 대신 모서리가 깎이지 않는 비대칭 문턱 범위로 판정한다. */
  reach?: InteractableReach;
  /** 말풍선을 띄울 높이 (바닥에서 위로) */
  markerHeight: number;
  /** 말을 걸면 나오는 대사 */
  dialogue?: DialogueId;
  /** 건물 문: 누르면 이 맵(실내)의 이 자리로 들어간다. 대화 버튼 대신 "들어가기"가 뜬다. */
  enter?: { to: string; at: { x: number; y: number }; label: string };
}

const SIGN = PROPS.find((p) => p.frame === 'sign')!;

export const INTERACTABLES: Interactable[] = [
  { id: 'village-sign', x: SIGN.x, y: SIGN.y, radius: 105, markerHeight: 150, dialogue: 'village-sign' },
];

const VERTICAL_RATIO = 0.6;

/** (x, y)에서 닿는 대상 중 가장 가까운 것. 없으면 undefined. */
export function findInteractable(x: number, y: number, list: readonly Interactable[] = INTERACTABLES): Interactable | undefined {
  let best: Interactable | undefined;
  let bestDistance = 1;
  for (const item of list) {
    let distance: number;
    if (item.reach) {
      const { rx, up, down } = item.reach;
      const dx = x - item.x;
      const dy = y - item.y;
      if (Math.abs(dx) > rx || dy < -up || dy > down) continue;
      // 문턱 사각형 안에서는 모서리 사각지대 없이 항상 닿고, 문 중심에 가까울수록 우선권을 갖는다.
      const midY = (down - up) / 2;
      const halfH = (up + down) / 2;
      const nx = Math.abs(dx) / rx;
      const ny = Math.abs(dy - midY) / halfH;
      distance = Math.min(1, Math.max(nx, ny) ** 2);
    } else {
      const nx = (x - item.x) / item.radius;
      const ny = (y - item.y) / (item.radius * VERTICAL_RATIO);
      distance = nx * nx + ny * ny;
    }
    if (distance <= bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

/** (x, y)에서 닿는 대상 모두, 가까운 순서로 */
export function interactablesInReach(x: number, y: number, list: readonly Interactable[] = INTERACTABLES): Interactable[] {
  const reach = (item: Interactable) => {
    const nx = (x - item.x) / item.radius, ny = (y - item.y) / (item.radius * VERTICAL_RATIO);
    return nx * nx + ny * ny;
  };
  return list.filter(item => reach(item) <= 1).sort((a, b) => reach(a) - reach(b));
}

/**
 * 대화 버튼을 눌렀을 때 고를 사람들: 가장 가까운 대상이 사람이고 손이 닿는 사람이 둘 이상이면 그 사람들(가까운 순).
 * 문·살펴보기 자리가 가장 가까우면 고르지 않고 그 대상을 쓴다.
 */
export function talkChoices(x: number, y: number, list: readonly Interactable[]): Interactable[] {
  const near = interactablesInReach(x, y, list);
  if (!near[0]?.id.startsWith('npc-')) return [];
  const people = near.filter(item => item.id.startsWith('npc-'));
  return people.length >= 2 ? people : [];
}
