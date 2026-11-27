import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { MapId } from '../world/maps.ts';
import type { NpcDef, NpcId } from '../world/npcs.ts';
import type { DialogueLine } from './dialogues.ts';
import type { Obstacle } from '../world/obstacles.ts';
import { currentObjective, questDef, type InspectSpot, type QuestId, type QuestState } from './quests.ts';
import type { Interactable } from '../world/interactables.ts';
import type { ItemId } from '../items/inventory.ts';

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
 * 물안개 나루의 사람들 (퀘스트 5 "멈춘 나루"부터). 바깥 사람들은 제자리에 서서 말을 건다.
 * 에반은 아래 잔교 곁 강가 바위에서 강만 보고, 마르타는 대장간 앞, 모르간은 우물가에서 쌀과 등불을 나눠 준다.
 * 서로의 대화 자리는 대화가 닿는 거리(110px)의 두 배보다 멀리 둔다.
 */
export const FERRY_OUTSIDE_PEOPLE: NpcDef[] = [
  { id: 'evan', name: '에반', role: '나루의 사공', x: 3060, y: 2480, height: 148, dialogue: 'npc-evan', facing: 'right', storyAction: 'riverbank-sit' },
  { id: 'morgan', name: '모르간', role: '나루의 후원자', x: 1720, y: 1660, height: 150, dialogue: 'npc-morgan', facing: 'right' },
  // 서브 퀘스트 "엉킨 그물"의 의뢰인: 어부의 집 앞 그물 건조대 곁 강가
  { id: 'ferry-fisher', name: '나루 어부', role: '나루의 어부', x: 2300, y: 2440, height: 146, dialogue: 'npc-ferry-fisher', facing: 'down-right' },
];
const FISHING_ELDER: NpcDef = {
  id: 'fishing-elder', name: '낚시 노인', role: '강가의 낚시꾼', x: 3080, y: 2845, height: 138,
  dialogue: 'npc-fishing-elder', facing: 'down-right', storyAction: 'fish-idle', talkOffsetX: -42,
};

/**
 * 나루 여관(in-ferry-inn, 실내 원화의 픽셀 좌표) 안의 여관 주인과 아들 핀.
 * 여관 주인은 술병 선반과 카운터 사이에 서서 카운터 앞에서 말을 받고(카운터가 다리를 가린다),
 * 핀은 오른쪽 난로 곁 탁자 옆에 서 있다.
 */
export const FERRY_INN_PEOPLE: NpcDef[] = [
  { id: 'fog-innkeeper', name: '여관 주인', role: '핀의 아버지', x: 300, y: 470, height: 148, dialogue: 'npc-fog-innkeeper', facing: 'down', talkOffset: 110 },
  { id: 'finn', name: '핀', role: '여관의 소년', x: 1200, y: 610, height: 116, dialogue: 'npc-finn', facing: 'down-left' },
  // 핀의 어머니(서브 퀘스트 "새는 지붕"): 안쪽 벽 아래, 비 새는 자리를 올려다본다
  { id: 'innkeeper-wife', name: '핀의 어머니', role: '나루 여관 안주인', x: 760, y: 440, height: 138, dialogue: 'npc-innkeeper-wife', facing: 'down' },
];

/** 마르타의 대장간(in-ferry-marta-smithy) 안: 마르타는 모루 오른쪽에 서서 손님을 맞는다. 화덕은 왼쪽 안쪽이다. */
export const FERRY_SMITHY: MapId = 'in-ferry-marta-smithy';
export const FERRY_SMITHY_PEOPLE: NpcDef[] = [
  { id: 'marta', name: '마르타', role: '대장장이', x: 720, y: 600, height: 138, dialogue: 'npc-marta', facing: 'left' },
];

export const FERRY_WITNESS_POSES: Partial<Record<NpcId, readonly string[]>> = {
  evan: ['riverbank-rise', 'riverbank-point', 'riverbank-warn'],
  'fisher-daughter': ['fidget-twine', 'tell-story', 'lower-gaze'],
  'herbalist-elder': ['add-herb', 'offer-cup', 'reassuring-nod'],
};

/**
 * 퀘스트 7 "사라진 다섯"의 증인들 (실내 원화 좌표): 어부의 딸은 어부의 집 깔개 앞에서 아버지의 찌를 쥐고,
 * 약초 가게 할머니는 카운터 뒤에서 찻잔을 준비하며(카운터 앞에서 말을 받는다), 방앗간 젊은이는 작업대 앞에 서 있다.
 */
export const FERRY_HOUSE_PEOPLE: Partial<Record<MapId, NpcDef[]>> = {
  'in-ferry-fisherman-house': [
    { id: 'fisher-daughter', name: '어부의 딸', role: '실종된 어부의 가족', x: 700, y: 620, height: 130, dialogue: 'npc-fisher-daughter', facing: 'down', storyAction: 'hold-float' },
  ],
  'in-ferry-herbalist-shop': [
    { id: 'herbalist-elder', name: '약초 가게 할머니', role: '나루의 약초 상인', x: 420, y: 495, height: 124, dialogue: 'npc-herbalist-elder', facing: 'down', talkOffset: 105, storyAction: 'prepare-cup' },
  ],
  'in-ferry-watermill': [
    { id: 'mill-apprentice', name: '방앗간 젊은이', role: '방앗간 일꾼', x: 850, y: 640, height: 142, dialogue: 'npc-mill-apprentice', facing: 'right' },
  ],
};

export const FERRY_PEOPLE: NpcDef[] = [...FERRY_OUTSIDE_PEOPLE, FISHING_ELDER, ...FERRY_INN_PEOPLE, ...FERRY_SMITHY_PEOPLE,
  ...Object.values(FERRY_HOUSE_PEOPLE).flat() as NpcDef[]];
export const FERRY_INN: MapId = 'in-ferry-inn';

/** 마르타의 대장간(장비 상점)이 열렸는지: 퀘스트 5 "멈춘 나루"에서 마르타를 도운 뒤 */
export function martaShopOpen(state: QuestState): boolean {
  return state['still-ferry']?.status === 'done';
}

/** 나루에 도착할 때가 됐는지: 퀘스트 5 "멈춘 나루"를 받았다(고개의 쉼터를 끝냈다) */
export function ferryOpen(state: QuestState): boolean {
  return !!state['still-ferry'];
}

/**
 * 퀘스트 6 "밤의 종소리"의 밤 (여관에서 잠든 뒤부터 핀을 달랠 때까지). 단계 번호를 돌려준다.
 *  1: 잠든 여관 주인이 강으로 걸어가고, 시온이 길을 막는 안개 환영과 싸운다
 *  2: 여관 주인이 물가에서 안개 길에 발을 올리려 한다 (말을 걸어 깨운다)
 *  3: 깨어난 아버지를 핀이 끌어안고 운다 (핀을 달랜다)
 */
export function ferryNightStep(state: QuestState): number | undefined {
  const progress = state['night-bell'];
  if (progress?.status !== 'active' || !progress.step) return undefined;
  return progress.step;
}

export function ferryNight(state: QuestState): boolean {
  return ferryNightStep(state) !== undefined;
}

/** 여관 문 앞(바깥): 여관 주인이 잠든 채 나서는 자리, 핀이 아버지를 부르며 서 있는 자리 */
export const FERRY_INN_DOOR = { x: 2160, y: 1372 };
/**
 * 물가: 방앗간 아래, 아래 잔교 바로 위의 풀밭 강둑 끝. 여관 주인이 멈춰 서고, 그 앞 강 위로 안개가 길처럼 깔린다.
 * 방앗간 그림의 아래 끝(1870)보다 앞이라 지붕에 가려지지 않는다. 잠든 걸음은 벽을 넘지 않으므로 방앗간 서쪽으로 돌아간다.
 */
export const FERRY_RIVERBANK = { x: 3040, y: 1985 };
export const FERRY_SLEEPWALK_PATH = [{ x: 2420, y: 1500 }, { x: 2600, y: 1930 }, FERRY_RIVERBANK];
/** 안개 길: 강둑 끝에서 동쪽 강 위로 뻗는다 (그림 효과, 발 디딜 곳이 아니다) */
export const FERRY_FOG_PATH = { x: FERRY_RIVERBANK.x + 70, y: FERRY_RIVERBANK.y - 8, length: 560 };
/** 길을 막는 안개 환영 셋 (퀘스트 6) */
export const FERRY_NIGHT_PHANTOMS = [{ x: 2470, y: 1690 }, { x: 2700, y: 1960 }, { x: 2880, y: 2000 }];
export const FERRY_NIGHT_LEVEL = 11;

/** 2장에 더하는 사람들: 로웬 광장의 페른, 물안개 나루 사람들 (밤에는 여관 주인과 핀만 밖에 있다) */
export function chapterTwoNpcs(state: QuestState, map: MapId): NpcDef[] {
  if (!chapterTwoStarted(state)) return [];
  if (map === 'village') return [{ ...FERN }];
  if (!ferryOpen(state)) return [];
  const night = ferryNightStep(state);
  if (night !== undefined) {
    if (map !== 'ferry-village') return [];
    const [innkeeper, finn] = FERRY_INN_PEOPLE;
    // 핀은 여관 문 앞에서 아버지를 부르다가, 아버지가 깨어나면 물가로 달려와 끌어안는다(그림에 아버지도 함께 있다).
    if (night === 3) return [{ ...finn, ...FERRY_RIVERBANK, facing: 'down', storyAction: 'hug-father', role: '여관의 소년' }];
    return [
      { ...innkeeper, ...(night === 1 ? FERRY_INN_DOOR : FERRY_RIVERBANK), facing: 'right', talkOffset: 0 },
      { ...finn, x: FERRY_INN_DOOR.x - 150, y: FERRY_INN_DOOR.y + 20, facing: 'right', storyAction: 'warn-father' },
    ];
  }
  if (map === 'ferry-village') {
    const people = state['still-ferry']?.status === 'done' ? [...FERRY_OUTSIDE_PEOPLE, FISHING_ELDER] : FERRY_OUTSIDE_PEOPLE;
    return people.map(n => ({ ...n }));
  }
  if (map === FERRY_INN) return FERRY_INN_PEOPLE.map(n => ({ ...n }));
  if (map === FERRY_SMITHY) return FERRY_SMITHY_PEOPLE.map(n => ({ ...n }));
  const house = FERRY_HOUSE_PEOPLE[map];
  if (house) return house.map(n => ({ ...n }));
  return [];
}

/** 퀘스트 6의 밤에 나루에 나오는 안개 환영 (여관 주인을 쫓는 동안만) */
export function ferryNightSpawns(state: QuestState, map: MapId): Array<{ key: 'mist-phantom'; x: number; y: number }> {
  if (map !== 'ferry-village' || ferryNightStep(state) !== 1) return [];
  return FERRY_NIGHT_PHANTOMS.map(p => ({ key: 'mist-phantom', ...p }));
}

/** 서브 퀘스트 "새는 지붕"으로 여관 지붕을 고쳤는지 (나루 여관 그림을 고친 그림으로 바꾼다) */
export function ferryInnRepaired(state: QuestState): boolean {
  return state['leaky-roof']?.status === 'done';
}

/** 나루 여관에서 쉬어 갈 수 있는지: 나루에 온 뒤 여관 주인에게 말하면 묻는다 (종소리의 밤은 빼고) */
export function ferryInnRestOpen(state: QuestState): boolean {
  return ferryOpen(state) && !ferryNight(state);
}

/** 수레가 광장에 있는지 */
export function fernCartVisible(state: QuestState, map: MapId): boolean {
  return chapterTwoStarted(state) && map === 'village';
}

/** 수레 그림 상태: 서브 퀘스트 "행상인의 짐"으로 덮개를 갈면 고친 수레 */
export function fernCartState(state: QuestState): 'damaged' | 'repaired' {
  return state['fern-cover']?.status === 'done' ? 'repaired' : 'damaged';
}

/** 이야기로 늘어난 페른의 물건: "행상인의 짐" 뒤 말린 무화과 */
export function fernExtraStock(state: QuestState): ItemId[] {
  return state['fern-cover']?.status === 'done' ? ['dried-fig'] : [];
}

/** 페른의 수레(상점)가 열렸는지: 퀘스트 1 "남문의 수레"를 끝냈다 */
export function fernShopOpen(state: QuestState): boolean {
  return state['fern-cart']?.status === 'done';
}

/** 1장 완료 전(도란의 검 받기 전)에는 동쪽 개울가에서 동쪽 고갯길로 넘어가지 못한다. */
export function eastPassOpen(state: QuestState): boolean {
  return chapterTwoStarted(state);
}

/** 1장 완료 전 동쪽 고갯길 통로에 닿았을 때 시온이 자연스럽게 되돌아서는 대사. */
export function eastPassBlockedDialogue(state: QuestState): DialogueLine[] {
  const text = state['village-raid']?.status === 'done'
    ? '아직 고개 너머로 떠날 준비가 안 됐어. 마을 사람들과 대장간에 먼저 들러 보자.'
    : state['festival-eve']?.status === 'done'
      ? '지금은 고개 너머로 갈 때가 아니야! 어서 마을로 돌아가야 해.'
      : '여기는 아니야. 지금 고개 너머까지 갈 일은 없어. 마을로 돌아가자.';
  return [{ speaker: '시온', portrait: 'hero-neutral', text }];
}

/**
 * 2장 "떠날 채비" 이후 로웬에서 바뀌는 평소 대사. 퀘스트와 상관없이 말을 걸 때 나온다(1장 습격 뒤 대사보다 먼저).
 * 페른에게 동쪽 소식을 듣기 전(남문의 수레 진행 중)에는 1장 회복 대사를 그대로 유지한다.
 */
export function chapterTwoDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  if (state['fern-cart']?.status !== 'done') return undefined;
  // 종소리의 밤: 여관 문 앞의 핀은 아버지를 따라가 달라고 한다.
  const night = ferryNightStep(state);
  if (npc === 'finn' && (night === 1 || night === 2)) {
    return [{ speaker: '핀', portrait: 'finn', text: night === 1
      ? '형, 아빠를 따라가 줘! 안개 속에 뭔가 있어. 나는… 다리가 안 움직여.'
      : '아빠가 물가에 서 있어! 형, 빨리 깨워 줘!' }];
  }
  if (npc === 'finn' && state['still-ferry']?.status === 'done' && state['night-bell']?.status === 'active' && !night) {
    return [{ speaker: '핀', portrait: 'finn', text: '형, 아빠한테 방 달라고 해. 그리고 귀 꼭 막아.' }];
  }
  const departed = state.farewell?.status === 'done';
  const lines: Partial<Record<NpcId, DialogueLine[]>> = {
    vernel: [{ speaker: '베르넬', portrait: 'vernel', text: '유적 길을 다 치우려면 한참 걸려. 네가 돌아올 때쯤엔 들어갈 수 있게 해 둘게.' }],
    teon: [{ speaker: '테온', portrait: 'teon', text: '이번엔 여기 남을게. 남은 사람들은 내가 지킨다. …그러니까 너는 뒤돌아보지 말고 가.' }],
    ...(departed ? {
      linea: [{ speaker: '리네아', portrait: 'linea', text: '내 증상은 매일 일지에 적어 둘게. 시온, 무리하지 말고 꼭 돌아와.' }],
      herman: [{ speaker: '헤르만', portrait: 'herman', text: '마을 걱정은 말게. 고개 너머에서도 부디 몸 조심하게나.' }],
    } : {}),
  };
  return lines[npc];
}

/** 퀘스트 1의 나방 쫓기 단계인지 (남쪽 들판에 잿빛 나방 넷이 남아 있다) */
export function fernMothHunt(state: QuestState): boolean {
  const progress = state['fern-cart'];
  if (progress?.status !== 'active') return false;
  return currentObjective(questDef('fern-cart'), progress).monster === 'ashen-moth';
}

/** 갈대밭 늪의 갈대 묶음 셋 (서브 퀘스트 "새는 지붕", 줍는 차례대로) */
export const REED_BUNDLES = [{ x: 560, y: 620 }, { x: 1150, y: 1240 }, { x: 1900, y: 640 }];
/** 갈대밭 늪 물가의 엉킨 그물 셋 (서브 퀘스트 "엉킨 그물", 푸는 차례대로) */
export const TANGLED_NETS = [{ x: 1000, y: 760 }, { x: 1480, y: 980 }, { x: 1620, y: 560 }];

/**
 * 살펴보기 자리에 함께 그리는 소품 그림 (보일 때만). 텍스처 키, 원본 파일, 화면 너비.
 * 갈대 묶음은 src/assets/maps/ferry-village/quest-art/leaking-roof/, 그물은 reed-swamp/quest-art/tangled-nets/.
 */
export const STORY_SPOT_ART: Record<string, { key: string; width: number }> = {
  ...Object.fromEntries(REED_BUNDLES.map((_, i) => [`story-reed-bundle-${i + 1}`, { key: 'quest-reed-bundle', width: 200 }])),
  ...Object.fromEntries(TANGLED_NETS.map((_, i) => [`story-tangled-net-${i + 1}`, { key: `quest-net-${i + 1}`, width: 190 }])),
};

/** 고갯길 약초 다섯 포기 (서브 퀘스트 "쉼터의 약초", 캐는 차례대로) */
export const PASS_HERBS = [{ x: 700, y: 1100 }, { x: 1500, y: 2750 }, { x: 2300, y: 1250 }, { x: 3300, y: 2700 }, { x: 4180, y: 1380 }];

/**
 * 2장의 살펴보기 자리. 그 퀘스트의 그 단계일 때만 그 맵에 나타난다.
 *  - 고개 꼭대기(퀘스트 4): 고갯길이 동쪽 절벽 모서리 아래로 사라지는 곳
 *  - 대장간 화덕(퀘스트 5): 마르타의 대장간 안, 왼쪽 안쪽의 화덕과 풀무 앞
 *  - 핀의 연(퀘스트 5): 갈대밭 늪 동쪽 끝 덤불 곁 진흙
 */
const STORY_SPOTS: ReadonlyArray<{ quest: QuestId; map: MapId; spot: InspectSpot; at: Interactable }> = [
  { quest: 'pass-shelter', map: 'east-pass', spot: 'pass-summit', at: { id: 'story-pass-summit', x: 4560, y: 990, radius: 110, markerHeight: 55 } },
  // 대장간 안 왼쪽 안쪽의 화덕과 풀무 앞 (실내 원화 좌표)
  { quest: 'still-ferry', map: 'in-ferry-marta-smithy', spot: 'ferry-forge', at: { id: 'story-ferry-forge', x: 340, y: 590, radius: 110, markerHeight: 150 } },
  { quest: 'still-ferry', map: 'reed-swamp', spot: 'reed-kite', at: { id: 'story-reed-kite', x: 1780, y: 1250, radius: 110, markerHeight: 90 } },
  // 서브 퀘스트 "새는 지붕": 갈대밭 늪의 묶어 둔 갈대 세 묶음, "엉킨 그물": 물가 마물 곁에 엉킨 그물 셋
  ...REED_BUNDLES.map((p, i) => ({
    quest: 'leaky-roof' as const, map: 'reed-swamp' as const, spot: `reed-bundle-${i + 1}` as InspectSpot,
    at: { id: `story-reed-bundle-${i + 1}`, ...p, radius: 100, markerHeight: 70 },
  })),
  ...TANGLED_NETS.map((p, i) => ({
    quest: 'tangled-nets' as const, map: 'reed-swamp' as const, spot: `tangled-net-${i + 1}` as InspectSpot,
    at: { id: `story-tangled-net-${i + 1}`, ...p, radius: 110, markerHeight: 90 },
  })),
  // 서브 퀘스트 "쉼터의 약초": 고갯길의 바위 그늘·절벽 밑 다섯 곳. 지금 캘 차례인 한 포기만 보인다.
  ...PASS_HERBS.map((p, i) => ({
    quest: 'dor-herbs' as const, map: 'east-pass' as const, spot: `pass-herb-${i + 1}` as InspectSpot,
    at: { id: `story-pass-herb-${i + 1}`, ...p, radius: 100, markerHeight: 55 },
  })),
];

export function chapterTwoSpots(state: QuestState, map: MapId): Interactable[] {
  return STORY_SPOTS.filter(s => {
    const progress = state[s.quest];
    return s.map === map && progress?.status === 'active' && currentObjective(questDef(s.quest), progress).spot === s.spot;
  }).map(s => s.at);
}

const HERB_LINES = [
  '바위 그늘에 잎이 톱니 같은 풀이 숨어 있다. 윗잎만 조심스레 땄다.',
  '절벽 밑 물기 젖은 흙에 약초가 두 포기 붙어 자란다. 한 포기만 남기고 땄다.',
  '마른 덤불 사이로 톱니 잎이 고개를 내밀었다. 서리를 맞아 향이 짙다.',
  '바위틈에서 약초를 땄다. 손끝에 쌉싸름한 냄새가 오래 남는다.',
  '고개 동쪽 끝 바위 아래, 마지막 한 포기. 이제 쉼터로 돌아가자.',
];

const REED_LINES = [
  '누군가 베어 묶어 둔 갈대 한 묶음. 잘 말라 가볍다. 어깨에 둘러멨다.',
  '물가 언덕에 갈대 묶음이 기대어 있다. 진흙을 털어 내고 챙겼다.',
  '늪 동쪽 덤불 곁의 마지막 한 묶음. 이만하면 지붕 한쪽은 덮겠다.',
];
const NET_LINES = [
  '갈대 뿌리에 그물이 칭칭 감겨 있다. 찢기지 않게 매듭을 하나씩 풀어 걷었다.',
  '그물 코마다 진흙과 물풀이 엉겨 있다. 마물이 물고 늘어진 자국도 있다. 천천히 풀어 냈다.',
  '마지막 그물은 부표까지 엉켜 있었다. 부표째 풀어 말아 들었다.',
];

export const CHAPTER_TWO_INSPECTIONS: Record<string, DialogueLine[]> = {
  ...Object.fromEntries(REED_LINES.map((text, i) => [`story-reed-bundle-${i + 1}`, [{ speaker: '갈대밭 늪', text }]])),
  ...Object.fromEntries(NET_LINES.map((text, i) => [`story-tangled-net-${i + 1}`, [{ speaker: '갈대밭 물가', text }]])),
  ...Object.fromEntries(HERB_LINES.map((text, i) => [`story-pass-herb-${i + 1}`, [{ speaker: '고갯길 약초', text }]])),
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
