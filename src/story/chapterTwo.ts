import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { MapId } from '../world/maps.ts';
import type { NpcDef, NpcId } from '../world/npcs.ts';
import type { DialogueLine } from './dialogues.ts';
import type { Obstacle } from '../world/obstacles.ts';
import { currentObjective, questDef, type QuestState } from './quests.ts';
import type { Interactable } from '../world/interactables.ts';

/**
 * 2장 "물안개 나루의 종소리"의 로웬 쪽 진행 (docs/story-chapter2.md).
 * 이 파일은 Phaser를 쓰지 않아 tools/chapter-two.test.mjs가 직접 불러 검사한다.
 *
 * - 2장은 1장 마지막 메인 퀘스트 "도란의 검"을 끝낸 다음 날 아침이다. 그때부터 떠돌이 행상인 페른이
 *   광장의 남문 안쪽에 수레를 세워 둔다.
 * - 퀘스트 1 "남문의 수레": 페른을 만나고, 수레를 덮쳤던 잿빛 나방(남쪽 들판에 남은 넷)을 쫓고, 다시 페른에게 간다.
 *   끝나면 페른의 수레(상점, items/inventory.ts의 SHOP_STOCK.fern)가 열린다.
 * - 수레는 나방에 차양이 삭은 그림(damaged)이다. 덮개를 갈아 주는 서브 퀘스트("행상인의 짐")가 생기면 고친 그림으로 바꾼다.
 */

/** 2장이 시작됐는지 (1장의 마지막 메인 퀘스트를 끝냈다) */
export function chapterTwoStarted(state: QuestState): boolean {
  return state['first-sword']?.status === 'done';
}

/** 페른의 수레: 광장의 남문 안쪽, 남문 오른쪽 기둥 위(북동쪽)의 빈 풀밭. 발 위치(아래 가운데)와 화면 너비. */
export const FERN_CART = { ...mapPoint({ x: 1470, y: 1420 }), width: mapLength(220) };

/** 수레 바퀴와 짐칸이 땅에 닿는 자리. 지나갈 수 없다. */
export const FERN_CART_FOOTPRINT: Obstacle = { x: FERN_CART.x, y: FERN_CART.y - mapLength(28), rx: mapLength(90), ry: mapLength(30), shape: 'rect' };

/** 페른은 수레 앞(남쪽)에 서서 손님을 맞는다. 걷지 않는다. */
export const FERN: NpcDef = {
  id: 'fern', name: '페른', role: '떠돌이 행상인', area: 'village', ...mapPoint({ x: 1470, y: 1490 }),
  height: 150, dialogue: 'npc-fern', facing: 'down',
};

/** 2장의 로웬에 더하는 사람들 (지금은 페른뿐) */
export function chapterTwoNpcs(state: QuestState, map: MapId): NpcDef[] {
  return chapterTwoStarted(state) && map === 'village' ? [{ ...FERN }] : [];
}

/** 수레가 광장에 있는지 */
export function fernCartVisible(state: QuestState, map: MapId): boolean {
  return chapterTwoStarted(state) && map === 'village';
}

/** 수레 그림 상태 (덮개 수리 서브 퀘스트가 생기기 전까지는 늘 삭은 덮개) */
export function fernCartState(_state: QuestState): 'damaged' | 'repaired' {
  return 'damaged';
}

/** 페른의 수레(상점)가 열렸는지: 퀘스트 1 "남문의 수레"를 끝냈다 */
export function fernShopOpen(state: QuestState): boolean {
  return state['fern-cart']?.status === 'done';
}

/**
 * 2장의 로웬에서 바뀌는 평소 대사. 퀘스트와 상관없이 말을 걸 때 나온다(1장 습격 뒤 대사보다 먼저).
 * 퀘스트 2 "떠날 채비"의 필수 인사(루안·세레나·리네아·에일라·헤르만)는 퀘스트 대사가 맡고, 여기는 덤으로 들르는 사람들이다.
 */
export function chapterTwoDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  if (!chapterTwoStarted(state)) return undefined;
  const lines: Partial<Record<NpcId, DialogueLine[]>> = {
    vernel: [{ speaker: '베르넬', portrait: 'vernel', text: '유적 길을 다 치우려면 한참 걸려. 네가 돌아올 때쯤엔 들어갈 수 있게 해 둘게.' }],
    teon: [{ speaker: '테온', portrait: 'teon', text: '이번엔 여기 남을게. 남은 사람들은 내가 지킨다. …그러니까 너는 뒤돌아보지 말고 가.' }],
  };
  return lines[npc];
}

/** 퀘스트 1의 나방 쫓기 단계인지 (남쪽 들판에 잿빛 나방 넷이 남아 있다) */
export function fernMothHunt(state: QuestState): boolean {
  const progress = state['fern-cart'];
  if (progress?.status !== 'active') return false;
  return currentObjective(questDef('fern-cart'), progress).monster === 'ashen-moth';
}

/**
 * 퀘스트 4 "고개의 쉼터"의 살펴보기 자리: 고갯길이 동쪽 절벽 모서리 아래로 사라지는 곳(고개 꼭대기).
 * 그 단계일 때만 동쪽 고갯길에 나타난다.
 */
const SUMMIT: Interactable = { id: 'story-pass-summit', x: 4560, y: 990, radius: 110, markerHeight: 55 };

export function chapterTwoSpots(state: QuestState, map: MapId): Interactable[] {
  const progress = state['pass-shelter'];
  if (map !== 'east-pass' || progress?.status !== 'active') return [];
  return currentObjective(questDef('pass-shelter'), progress).spot === 'pass-summit' ? [SUMMIT] : [];
}

export const CHAPTER_TWO_INSPECTIONS: Record<string, DialogueLine[]> = {
  'story-pass-summit': [
    { speaker: '고개 꼭대기', text: '아침 해가 등 뒤에서 떠올랐다. 고개 너머로 넓은 강이 굽이쳐 흐른다.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '저 아래 지붕들… 저게 물안개 나루구나. 그런데 해가 떴는데도 강 위에 안개가 걸려 있어.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '배들이 전부 물가에 묶여 있어. 강에 떠 있는 배가 하나도 없네.' },
  ],
};

/** 고개 쉼터에서 쉬어 갈 수 있는지: "고개의 쉼터"를 끝낸 뒤 도르에게 말하면 묻는다 */
export function shelterRestOpen(state: QuestState): boolean {
  return state['pass-shelter']?.status === 'done';
}
