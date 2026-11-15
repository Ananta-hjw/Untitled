import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { NpcId } from '../world/npcs.ts';
import type { MapId } from '../world/maps.ts';
import type { ItemId } from '../items/inventory.ts';

/**
 * 퀘스트 (docs/story-chapter1.md).
 *
 * 마을 사람에게 말을 걸면 퀘스트를 받고(!), 목표를 채운 뒤 다시 말을 걸면 완료한다(?).
 * 목표는 게임에서 일어나는 일(QuestEvent)을 센다. 지금 게임에 있는 것으로 할 수 있는 퀘스트만 넣었다.
 * 보상은 경험치와 골드, 아이템이다. 장신구·무기 강화처럼 아직 없는 기능의 보상은 골드로 대신한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/quests.test.mjs가 직접 불러 검사한다.
 */

export type QuestId = 'ruan-training' | 'ruan-field' | 'ruan-forest' | 'doran-gel' | 'teon-lunch';

/** 게임에서 일어나서 퀘스트 목표를 채우는 일 */
export type QuestEvent =
  | { type: 'kill'; map: MapId }
  | { type: 'finisher' }
  | { type: 'talk'; npc: NpcId };

export interface QuestObjective {
  /** 추적 표시에 나오는 글 (예: "남쪽 들판의 슬라임") */
  label: string;
  need: number;
  event: QuestEvent['type'];
  /** kill: 이 맵에서만 센다. 없으면 어디서든 */
  map?: MapId;
  /** talk: 이 사람에게 말을 걸어야 한다 */
  npc?: NpcId;
}

export interface QuestDef {
  id: QuestId;
  title: string;
  /** 퀘스트를 주고 완료를 받는 사람 */
  giver: NpcId;
  /** 이 퀘스트를 끝내야 받을 수 있다 */
  requires?: QuestId;
  /** 메인 퀘스트(루안의 수련)인지 */
  main?: boolean;
  objective: QuestObjective;
  rewardXp: number;
  rewardGold?: number;
  rewardItems?: Array<{ id: ItemId; count: number }>;
  offer: DialogueLine[];
  /** 진행 중에 퀘스트를 준 사람에게 말을 걸면 */
  reminder: DialogueLine[];
  /** talk 목표: 그 사람에게 말을 걸었을 때 */
  target?: DialogueLine[];
  done: DialogueLine[];
}

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const line = (npc: NpcId, speaker: string, text: string): DialogueLine => ({ speaker, portrait: npc, text });
const ruan = (text: string) => line('ruan', '루안', text);

export const QUESTS: QuestDef[] = [
  {
    id: 'ruan-training', title: '마지막 수련', giver: 'ruan', main: true,
    objective: { label: '3단 콤보 마무리', need: 3, event: 'finisher' },
    rewardXp: 20, rewardItems: [{ id: 'potion', count: 3 }],
    offer: [
      ruan('왔구나. 축제 전 마지막 수련이다.'),
      ruan('공격을 이어서 세 번째 일격까지 끝까지 휘둘러 봐라. 세 번이다.'),
      hero('네, 스승님.'),
    ],
    reminder: [ruan('세 번째 일격까지 멈추지 말고 이어라. 손목이 아니라 허리로 베는 거다.')],
    done: [ruan('좋다. 이제야 칼끝이 제대로 따라오는구나.'), ruan('물약 몇 병 챙겨 둬라. 실전은 다르다. 다음은 들판이다.')],
  },
  {
    id: 'ruan-field', title: '들판의 슬라임', giver: 'ruan', main: true, requires: 'ruan-training',
    objective: { label: '남쪽 들판의 슬라임', need: 5, event: 'kill', map: 'south-field' },
    rewardXp: 30, rewardGold: 50,
    offer: [
      ruan('실전 감각을 익혀라. 남쪽 입구로 나가면 들판에 슬라임이 있다.'),
      ruan('다섯 마리를 잡고 돌아와. 덤벼들기 전에 몸을 움츠리면 피할 때다.'),
    ],
    reminder: [ruan('들판은 남쪽 입구 너머다. 다섯 마리, 잊지 마라.')],
    done: [ruan('다치지 않고 돌아왔구나. 잘했다.')],
  },
  {
    id: 'ruan-forest', title: '늘어난 마물', giver: 'ruan', main: true, requires: 'ruan-field',
    objective: { label: '서쪽 숲길의 마물', need: 5, event: 'kill', map: 'west-forest' },
    rewardXp: 40, rewardGold: 80,
    offer: [
      ruan('테온이 그러던데, 요즘 서쪽 숲길에 마물이 늘었다더라.'),
      ruan('축제 전에 한번 정리해 두자. 다섯 마리면 된다.'),
    ],
    reminder: [ruan('숲길은 마을 서쪽이다. 나무 사이에서 뒤를 조심해라.')],
    done: [ruan('…정말 많았나 보구나. 이맘때 이렇게 늘어난 적은 없었는데.'), ruan('수고했다. 오늘 밤엔 축제를 즐겨라.')],
  },
  {
    id: 'doran-gel', title: '담금질 재료', giver: 'doran',
    objective: { label: '슬라임 처치 (점액 모으기)', need: 5, event: 'kill' },
    rewardXp: 20, rewardGold: 30,
    offer: [
      line('doran', '도란', '마침 잘 왔다! 슬라임 점액이 담금질에 그만이거든.'),
      line('doran', '도란', '아무 데서나 다섯 마리만 잡아서 점액 좀 모아 와라.'),
      hero('그거… 정말이에요?'),
      line('doran', '도란', '정말인지는 해 보면 알지! 하하!'),
    ],
    reminder: [line('doran', '도란', '점액은 아직이냐? 다섯 마리 분이다.')],
    done: [line('doran', '도란', '오, 이 끈적한 것 좀 봐라. 좋아, 이걸로 한번 두들겨 보자고!')],
  },
  {
    id: 'teon-lunch', title: '초소 도시락', giver: 'teon',
    objective: { label: '로제타에게 도시락 받기', need: 1, event: 'talk', npc: 'rosetta' },
    rewardXp: 15, rewardGold: 20, rewardItems: [{ id: 'lunch', count: 1 }],
    offer: [
      line('teon', '테온', '시온, 부탁 하나만! 오늘 초소를 비울 수가 없어서 밥을 못 먹었어.'),
      line('teon', '테온', '여관의 로제타 아주머니께 도시락 좀 받아다 줄래?'),
    ],
    reminder: [line('teon', '테온', '로제타 아주머니는 남동쪽 여관에 계셔. 배고파…')],
    target: [
      line('rosetta', '로제타', '테온 도시락? 그 녀석, 또 끼니를 거르는구나.'),
      line('rosetta', '로제타', '자, 따뜻할 때 갖다줘. 너도 하나 먹고 가고!'),
    ],
    done: [
      line('teon', '테온', '살았다! 로제타 아주머니 국은 언제 먹어도 최고야. 고마워, 시온!'),
      line('teon', '테온', '아주머니가 네 몫도 싸 주셨네. 이건 너 가져.'),
    ],
  },
];

const BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export function questDef(id: QuestId): QuestDef {
  return BY_ID.get(id)!;
}

export type QuestStatus = 'active' | 'ready' | 'done';
export interface QuestProgress { status: QuestStatus; count: number }
/** 받은 퀘스트만 들어 있다. 없는 퀘스트는 아직 받지 않은 것이다. */
export type QuestState = Partial<Record<QuestId, QuestProgress>>;

/** 머리 위와 미니맵에 띄우는 표시 */
export type QuestMarker = 'new' | 'ready' | 'progress' | 'target';

function canStart(def: QuestDef, state: QuestState): boolean {
  return !state[def.id] && (!def.requires || state[def.requires]?.status === 'done');
}

/** 이 사람 위에 띄울 표시. 완료할 것 > 새 퀘스트 > 말 걸 대상 > 진행 중 순서로 하나만. */
export function markerFor(npc: NpcId, state: QuestState): QuestMarker | undefined {
  const mine = QUESTS.filter((q) => q.giver === npc);
  if (mine.some((q) => state[q.id]?.status === 'ready')) return 'ready';
  if (mine.some((q) => canStart(q, state))) return 'new';
  if (QUESTS.some((q) => q.objective.event === 'talk' && q.objective.npc === npc && state[q.id]?.status === 'active')) return 'target';
  if (mine.some((q) => state[q.id]?.status === 'active')) return 'progress';
  return undefined;
}

export interface TalkResult {
  lines: DialogueLine[];
  state: QuestState;
  accepted?: QuestDef;
  completed?: QuestDef;
  /** talk 목표를 채웠을 때 */
  progressed?: QuestDef;
}

/**
 * 이 사람에게 말을 걸었을 때 퀘스트 쪽 대화. 퀘스트와 상관없으면 undefined (평소 대사를 쓴다).
 * 완료 > talk 목표 > 새 퀘스트 > 진행 중 안내 순서로 하나만 처리한다.
 */
export function talkTo(npc: NpcId, state: QuestState): TalkResult | undefined {
  const ready = QUESTS.find((q) => q.giver === npc && state[q.id]?.status === 'ready');
  if (ready) return { lines: ready.done, state: { ...state, [ready.id]: { status: 'done', count: ready.objective.need } }, completed: ready };

  const target = QUESTS.find((q) => q.objective.event === 'talk' && q.objective.npc === npc && state[q.id]?.status === 'active');
  if (target) {
    const next = advance(state, target, 1);
    return { lines: target.target ?? [], state: next, progressed: target };
  }

  const offer = QUESTS.find((q) => q.giver === npc && canStart(q, state));
  if (offer) return { lines: offer.offer, state: { ...state, [offer.id]: { status: 'active', count: 0 } }, accepted: offer };

  const active = QUESTS.find((q) => q.giver === npc && state[q.id]?.status === 'active');
  if (active) return { lines: active.reminder, state };
  return undefined;
}

function advance(state: QuestState, def: QuestDef, by: number): QuestState {
  const current = state[def.id]!;
  const count = Math.min(def.objective.need, current.count + by);
  return { ...state, [def.id]: { status: count >= def.objective.need ? 'ready' : 'active', count } };
}

export interface QuestUpdate { quest: QuestDef; count: number; need: number; ready: boolean }

/** 처치·마무리 일격 같은 일이 일어났을 때. talk 목표는 talkTo가 처리한다. */
export function recordEvent(state: QuestState, event: QuestEvent): { state: QuestState; updates: QuestUpdate[] } {
  let next = state;
  const updates: QuestUpdate[] = [];
  for (const q of QUESTS) {
    const o = q.objective;
    if (state[q.id]?.status !== 'active' || o.event !== event.type || event.type === 'talk') continue;
    if (event.type === 'kill' && o.map && o.map !== event.map) continue;
    next = advance(next, q, 1);
    const p = next[q.id]!;
    updates.push({ quest: q, count: p.count, need: o.need, ready: p.status === 'ready' });
  }
  return { state: next, updates };
}

/** 추적 표시용: 진행 중이거나 완료를 기다리는 퀘스트 (메인 퀘스트가 먼저) */
export function trackedQuests(state: QuestState): Array<{ quest: QuestDef; progress: QuestProgress }> {
  return QUESTS.filter((q) => state[q.id] && state[q.id]!.status !== 'done')
    .sort((a, b) => Number(!!b.main) - Number(!!a.main))
    .map((q) => ({ quest: q, progress: state[q.id]! }));
}

// ---------------------------------------------------------------- 저장

export const QUEST_SAVE_KEY = 'untitled-rpg.quests';
export const QUEST_SAVE_VERSION = 1;

/** 저장된 문자열을 읽는다. 깨졌거나 모르는 값은 버린다 (퀘스트마다 따로). */
export function parseQuests(raw: string | null): QuestState {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null) return {};
  const { version, quests } = data as { version?: unknown; quests?: unknown };
  if (version !== QUEST_SAVE_VERSION || typeof quests !== 'object' || quests === null) return {};
  const state: QuestState = {};
  for (const [id, value] of Object.entries(quests)) {
    const def = BY_ID.get(id as QuestId);
    if (!def || typeof value !== 'object' || value === null) continue;
    const { status, count } = value as Partial<QuestProgress>;
    if (status !== 'active' && status !== 'ready' && status !== 'done') continue;
    if (!Number.isInteger(count) || count! < 0) continue;
    const clamped = Math.min(count!, def.objective.need);
    // 목표 수를 바꿨을 때도 말이 되게 상태를 다시 맞춘다.
    state[def.id] = { status: status === 'done' ? 'done' : clamped >= def.objective.need ? 'ready' : 'active', count: clamped };
  }
  return state;
}

export function serializeQuests(state: QuestState): string {
  return JSON.stringify({ version: QUEST_SAVE_VERSION, quests: state });
}
