import type { DialogueId } from '../story/dialogues.ts';

/**
 * 로웬 마을 사람들 (docs/story.md 마을 사람들, docs/rowen-village.md 배치).
 *
 * 모두 8방향 걷기 그림(walk_cardinal/walk_diagonal 시트)으로 그린다.
 * 장사를 하는 사람(도란, 메리나, 로제타)은 가게 앞에 서서 시온 쪽을 돌아볼 뿐 걷지 않는다.
 * 나머지는 자기 자리 주변을 천천히 돌아다닌다.
 * 페른은 습격 다음 날 도착하므로(docs/story-chapter1.md) 첫날에는 없다.
 * 이 파일은 Phaser를 쓰지 않아 tools/npcs.test.mjs가 직접 불러 검사한다.
 */

export type NpcId =
  | 'serena' | 'sia' | 'linea' | 'ruan' | 'herman' | 'eila'
  | 'merina' | 'doran' | 'rosetta' | 'vernel' | 'teon';

export interface NpcDef {
  id: NpcId;
  /** 머리 위 이름표와 대화창에 나오는 이름 */
  name: string;
  /** 하는 일 (문서용, 화면에는 아직 쓰지 않는다) */
  role: string;
  /** 처음 서 있는 자리 (발 위치) */
  x: number;
  y: number;
  /** 화면에 그리는 키 (발에서 머리끝까지) */
  height: number;
  dialogue: DialogueId;
  /** 가게를 지키는 사람. 돌아다니지 않는다. */
  shop?: boolean;
  /** 돌아다니는 범위 (처음 자리에서의 반지름). 장사하는 사람은 없다(서 있는다). */
  wander?: number;
}

export const NPCS: NpcDef[] = [
  { id: 'serena', name: '세레나', role: '시온의 어머니', x: 700, y: 600, height: 148, dialogue: 'npc-serena', wander: 110 },
  { id: 'sia', name: '시아', role: '시온의 여동생', x: 290, y: 680, height: 132, dialogue: 'npc-sia', wander: 150 },
  { id: 'linea', name: '리네아', role: '시온의 친한 친구', x: 1040, y: 1000, height: 142, dialogue: 'npc-linea', wander: 170 },
  { id: 'ruan', name: '루안', role: '첫 스승', x: 590, y: 1090, height: 156, dialogue: 'npc-ruan', wander: 120 },
  { id: 'herman', name: '헤르만', role: '촌장', x: 1290, y: 525, height: 150, dialogue: 'npc-herman', wander: 100 },
  { id: 'eila', name: '에일라', role: '치유사', x: 2070, y: 550, height: 146, dialogue: 'npc-eila', wander: 110 },
  { id: 'merina', name: '메리나', role: '잡화점 주인', x: 2090, y: 950, height: 144, dialogue: 'npc-merina', shop: true },
  { id: 'doran', name: '도란', role: '대장장이', x: 590, y: 1505, height: 156, dialogue: 'npc-doran', shop: true },
  { id: 'rosetta', name: '로제타', role: '여관 주인', x: 1990, y: 1505, height: 146, dialogue: 'npc-rosetta', shop: true },
  { id: 'vernel', name: '베르넬', role: '유적 연구자', x: 1580, y: 1250, height: 150, dialogue: 'npc-vernel', wander: 120 },
  { id: 'teon', name: '테온', role: '경비대원', x: 1330, y: 1290, height: 150, dialogue: 'npc-teon', wander: 100 },
];

/** 마을 사람이 플레이어를 보고 멈춰서 돌아보는 거리 */
export const NPC_NOTICE_RADIUS = 150;
export const NPC_WALK_SPEED = 62;

export type Direction8 = 'down' | 'down-right' | 'right' | 'up-right' | 'up' | 'up-left' | 'left' | 'down-left';

const DIRECTIONS: Direction8[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

/** 이동 방향(화면 좌표, y는 아래로 +)에 가장 가까운 8방향 */
export function direction8(dx: number, dy: number, fallback: Direction8 = 'down'): Direction8 {
  if (dx === 0 && dy === 0) return fallback;
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return DIRECTIONS[(index + 8) % 8];
}

/**
 * 다음에 걸어갈 곳. 처음 자리를 중심으로 반지름 안에서 고르고, 걸을 수 없거나 곧게 갈 수 없으면 다시 고른다.
 * 마땅한 곳이 없으면 처음 자리로 돌아간다. rand는 0 이상 1 미만의 수를 돌려준다.
 */
export function pickWanderTarget(
  home: { x: number; y: number }, radius: number, rand: () => number,
  canGo: (x: number, y: number) => boolean,
): { x: number; y: number } {
  for (let i = 0; i < 10; i++) {
    const angle = rand() * Math.PI * 2;
    const distance = radius * (0.35 + 0.65 * rand());
    const x = home.x + Math.cos(angle) * distance;
    const y = home.y + Math.sin(angle) * distance * 0.6;
    if (canGo(x, y)) return { x, y };
  }
  return { x: home.x, y: home.y };
}

/** 한 곳에 도착한 뒤 쉬는 시간 (ms) */
export function wanderPauseMs(rand: () => number): number {
  return 1500 + rand() * 2500;
}
