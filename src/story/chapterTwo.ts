import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { MapId } from '../world/maps.ts';
import type { NpcDef, NpcId } from '../world/npcs.ts';
import type { DialogueLine } from './dialogues.ts';
import type { Obstacle } from '../world/obstacles.ts';
import { currentObjective, questDef, type InspectSpot, type QuestId, type QuestState } from './quests.ts';
import type { Interactable } from '../world/interactables.ts';

/**
 * 2장 "물안개 나루의 종소리"의 로웬 쪽 진행 (docs/story-chapter2.md).
 * 이 파일은 Phaser를 쓰지 않아 tools/chapter-two.test.mjs가 직접 불러 검사한다.
 *
 * - 2장은 1장 마지막 메인 퀘스트 "도란의 검"을 받은 습격 다음 날 아침에서 바로 이어진다. 그날 아침 떠돌이 행상인 페른이
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

/**
 * 물안개 나루의 사람들 (퀘스트 5 "멈춘 나루"부터). 걷기 그림이 없는 사람도 있어 모두 제자리에 서서 말을 건다.
 * 에반은 아래 잔교 곁 강가 바위에서 강만 보고, 마르타는 대장간 앞, 여관 주인과 아들 핀은 여관 앞,
 * 모르간은 우물가에서 쌀과 등불을 나눠 준다. 서로의 대화 자리는 대화가 닿는 거리(110px)의 두 배보다 멀리 둔다.
 */
export const FERRY_PEOPLE: NpcDef[] = [
  { id: 'evan', name: '에반', role: '나루의 사공', x: 3060, y: 2480, height: 148, dialogue: 'npc-evan', facing: 'right' },
  { id: 'marta', name: '마르타', role: '대장장이', x: 1170, y: 1470, height: 138, dialogue: 'npc-marta', facing: 'down' },
  { id: 'fog-innkeeper', name: '여관 주인', role: '핀의 아버지', x: 2050, y: 1310, height: 148, dialogue: 'npc-fog-innkeeper', facing: 'down' },
  { id: 'finn', name: '핀', role: '여관의 소년', x: 2330, y: 1350, height: 116, dialogue: 'npc-finn', facing: 'down-left' },
  { id: 'morgan', name: '모르간', role: '나루의 후원자', x: 1720, y: 1660, height: 150, dialogue: 'npc-morgan', facing: 'right' },
];

/** 나루에 도착할 때가 됐는지: 퀘스트 5 "멈춘 나루"를 받았다(고개의 쉼터를 끝냈다) */
export function ferryOpen(state: QuestState): boolean {
  return !!state['still-ferry'];
}

/** 2장에 더하는 사람들: 로웬 광장의 페른, 물안개 나루 사람들 */
export function chapterTwoNpcs(state: QuestState, map: MapId): NpcDef[] {
  if (!chapterTwoStarted(state)) return [];
  if (map === 'village') return [{ ...FERN }];
  if (map === 'ferry-village' && ferryOpen(state)) return FERRY_PEOPLE.map(n => ({ ...n }));
  return [];
}

/** 나루 여관에서 쉬어 갈 수 있는지: 나루에 온 뒤 여관 주인에게 말하면 묻는다 */
export function ferryInnRestOpen(state: QuestState): boolean {
  return ferryOpen(state);
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
 * 2장의 살펴보기 자리. 그 퀘스트의 그 단계일 때만 그 맵에 나타난다.
 *  - 고개 꼭대기(퀘스트 4): 고갯길이 동쪽 절벽 모서리 아래로 사라지는 곳
 *  - 대장간 화덕(퀘스트 5): 마르타의 대장간 오른쪽, 지붕 아래 화덕과 풀무 앞
 *  - 핀의 연(퀘스트 5): 갈대밭 늪 동쪽 끝 덤불 곁 진흙
 */
const STORY_SPOTS: ReadonlyArray<{ quest: QuestId; map: MapId; spot: InspectSpot; at: Interactable }> = [
  { quest: 'pass-shelter', map: 'east-pass', spot: 'pass-summit', at: { id: 'story-pass-summit', x: 4560, y: 990, radius: 110, markerHeight: 55 } },
  { quest: 'still-ferry', map: 'ferry-village', spot: 'ferry-forge', at: { id: 'story-ferry-forge', x: 1420, y: 1430, radius: 110, markerHeight: 150 } },
  { quest: 'still-ferry', map: 'reed-swamp', spot: 'reed-kite', at: { id: 'story-reed-kite', x: 1780, y: 1250, radius: 110, markerHeight: 90 } },
];

export function chapterTwoSpots(state: QuestState, map: MapId): Interactable[] {
  return STORY_SPOTS.filter(s => {
    const progress = state[s.quest];
    return s.map === map && progress?.status === 'active' && currentObjective(questDef(s.quest), progress).spot === s.spot;
  }).map(s => s.at);
}

export const CHAPTER_TWO_INSPECTIONS: Record<string, DialogueLine[]> = {
  'story-pass-summit': [
    { speaker: '고개 꼭대기', text: '아침 해가 고개 너머에서 떠올랐다. 그 아래로 넓은 강이 굽이쳐 흐른다.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '저 아래 지붕들… 저게 물안개 나루구나. 그런데 해가 떴는데도 강 위에 안개가 걸려 있어.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '배들이 전부 물가에 묶여 있어. 강에 떠 있는 배가 하나도 없네.' },
  ],
  'story-ferry-forge': [
    { speaker: '대장간 화덕', text: '풀무를 밟을 때마다 화덕의 숯이 붉게 살아난다. 열기에 얼굴이 달아오른다.' },
    { speaker: '대장간 화덕', text: '화덕 뒤 벽에 누렇게 바랜 그림이 걸려 있다. 커다란 종이다. 둘레에 알 수 없는 옛 글자가 빙 둘러 새겨져 있다.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '대장간에 웬 종 그림이지. 마르타 할머니께 여쭤봐야겠다.' },
  ],
  'story-reed-kite': [
    { speaker: '갈대밭 진흙', text: '갈대 끝에 빨간 연이 걸려 있다. 살살 풀어 내리자, 발밑 진흙 속에서 무언가가 반짝인다.' },
    { speaker: '갈대밭 진흙', text: '손바닥만 한 놋쇠 종이다. 흔들자 맑은 소리가 난다. 진흙이 묻었을 뿐 녹슬지 않았다.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '버려진 지 얼마 안 된 것 같아. 누가 이런 데에 종을…? 연부터 핀에게 갖다주자.' },
  ],
};

/** 고개 쉼터에서 쉬어 갈 수 있는지: "고개의 쉼터"를 끝낸 뒤 도르에게 말하면 묻는다 */
export function shelterRestOpen(state: QuestState): boolean {
  return state['pass-shelter']?.status === 'done';
}
