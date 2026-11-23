import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { MapId } from '../world/maps.ts';
import type { NpcDef } from '../world/npcs.ts';
import type { Obstacle } from '../world/obstacles.ts';
import { currentObjective, questDef, type QuestState } from './quests.ts';

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

/** 퀘스트 1의 나방 쫓기 단계인지 (남쪽 들판에 잿빛 나방 넷이 남아 있다) */
export function fernMothHunt(state: QuestState): boolean {
  const progress = state['fern-cart'];
  if (progress?.status !== 'active') return false;
  return currentObjective(questDef('fern-cart'), progress).monster === 'ashen-moth';
}
