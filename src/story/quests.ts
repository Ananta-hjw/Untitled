import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { NpcId } from '../world/npcs.ts';
import type { MapId } from '../world/maps.ts';
import type { ItemId } from '../items/inventory.ts';

/**
 * 퀘스트 (docs/story-chapter1.md).
 *
 * 마을 사람에게 말을 걸면 퀘스트를 받고(!), 목표를 채운 뒤 다시 말을 걸면 완료한다(?).
 * 목표는 게임에서 일어나는 일(QuestEvent)을 센다. 다단계 목표와 조사·습격 이벤트는 chapterOne.ts 및 GameScene이 연결한다.
 * 보상은 경험치와 골드, 아이템이다. 장신구·무기 강화처럼 아직 없는 기능의 보상은 골드로 대신한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/quests.test.mjs가 직접 불러 검사한다.
 */

export type QuestId = 'ruan-training' | 'ruan-field' | 'ruan-forest' | 'doran-gel' | 'teon-lunch'
  | 'watch-report' | 'festival-supplies' | 'sia-knot' | 'evening-patrol'
  | 'festival-eve' | 'village-raid' | 'missing-sia' | 'sealed-letter';

/** 게임에서 일어나서 퀘스트 목표를 채우는 일 */
export type QuestEvent =
  | { type: 'kill'; map: MapId; encounter?: 'village-raid' }
  | { type: 'finisher' }
  | { type: 'talk'; npc: NpcId }
  | { type: 'inspect'; spot: 'south-watch' | 'home-search'; map: MapId };

export interface QuestObjective {
  /** 추적 표시에 나오는 글 (예: "남쪽 들판의 슬라임") */
  label: string;
  need: number;
  event: QuestEvent['type'];
  /** kill: 이 맵에서만 센다. 없으면 어디서든 */
  map?: MapId;
  /** talk: 이 사람에게 말을 걸어야 한다 */
  npc?: NpcId;
  spot?: string;
  encounter?: 'village-raid';
  lines?: DialogueLine[];
}

export interface QuestDef {
  id: QuestId;
  title: string;
  /** 퀘스트를 주는 사람. 완료 대상은 turnIn이 없으면 이 사람이다. */
  giver: NpcId;
  /** 이 퀘스트를 끝내야 받을 수 있다 */
  requires?: QuestId;
  /** 메인 스토리 퀘스트인지 */
  main?: boolean;
  objective: QuestObjective;
  /** 여러 목표를 차례로 수행한다. objective는 첫 목표와 같다. */
  steps?: QuestObjective[];
  /** 보고할 사람. 생략하면 의뢰인. */
  turnIn?: NpcId;
  /** 마지막 대화 대상에게 목표 달성과 보고를 한 번에 처리한다. */
  completeOnTarget?: boolean;
  confirm?: boolean;
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
    done: [ruan('…정말 많았나 보구나. 이맘때 이렇게 늘어난 적은 없었는데.'), ruan('수고했다, 시온. 축제라고 그냥 넘기기엔 마음에 걸리는구나. 네가 숲에서 본 걸 테온에게도 전해 주겠니?')],
  },
  {
    id: 'watch-report', title: '초소에 전할 소식', giver: 'ruan', main: true, requires: 'ruan-forest',
    turnIn: 'teon', completeOnTarget: true,
    objective: { label: '남쪽 입구의 테온에게 숲의 상황 전하기', need: 1, event: 'talk', npc: 'teon' },
    rewardXp: 15,
    offer: [ruan('테온은 남쪽 입구에 있을 거다. 나는 마을 안쪽을 살펴볼게.')],
    reminder: [ruan('네가 직접 본 걸 테온에게 전해 주렴. 괜히 겁을 줄 필요는 없고.')],
    target: [hero('테온, 숲에 마물이 평소보다 많았어. 루안 선생님도 신경이 쓰이신대.'), line('teon', '테온', '알려 줘서 고마워. 입구 경계를 더 살필게. 넌 잠깐 축제 준비를 도와줄래?')],
    done: [line('teon', '테온', '로제타 아주머니가 리네아에게 보낼 등불 재료를 챙겨 두셨어.')],
  },
  {
    id: 'festival-supplies', title: '축제를 밝힐 준비', giver: 'teon', main: true, requires: 'watch-report',
    turnIn: 'linea', completeOnTarget: true,
    objective: { label: '여관의 로제타에게 등불 재료 받기', need: 1, event: 'talk', npc: 'rosetta' },
    steps: [
      { label: '여관의 로제타에게 등불 재료 받기', need: 1, event: 'talk', npc: 'rosetta', lines: [line('rosetta', '로제타', '여기 등불 종이와 끈이야. 리네아한테 가져다주렴. 찢어지지 않게 조심하고!'), hero('네. 잘 전해 드릴게요.')] },
      { label: '마을 북쪽의 리네아에게 등불 재료 전달하기', need: 1, event: 'talk', npc: 'linea', lines: [line('linea', '리네아', '기다리던 재료다! 시온, 고마워. 이것만 달면 장식은 끝이야.')] },
    ],
    rewardXp: 20,
    offer: [line('teon', '테온', '여관에서 재료를 받아 리네아에게 전해 줘. 난 초소를 지키고 있을게.')],
    reminder: [line('teon', '테온', '여관의 로제타 아주머니에게 먼저 들러 봐.')],
    done: [line('linea', '리네아', '시아도 돕겠다고 왔어. 창문 끈을 보더니 또 자기가 묶어 준다네.')],
  },
  {
    id: 'sia-knot', title: '풀리지 않는 매듭', giver: 'linea', main: true, requires: 'festival-supplies',
    completeOnTarget: true,
    objective: { label: '마을 북쪽의 시아에게 창문 끈 이야기 듣기', need: 1, event: 'talk', npc: 'sia' },
    steps: [
      { label: '마을 북쪽의 시아에게 창문 끈 이야기 듣기', need: 1, event: 'talk', npc: 'sia', lines: [line('sia', '시아', '언니 집 창문 끈이 헐거워졌네. 잠깐만, 내가 묶을게.'), { speaker: '로웬 마을', text: '시아는 끈을 두 번 감고, 끝을 안쪽에 숨겨 단단히 묶었다.' }, hero('또 네 방식으로 묶었네.'), line('sia', '시아', '이렇게 해야 바람이 불어도 안 풀리지. 오빠는 맨날 대충 묶잖아.')] },
      { label: '리네아와 매듭 이야기 나누기', need: 1, event: 'talk', npc: 'linea', lines: [line('linea', '리네아', '어릴 때부터 시아가 묶어 주면 안 풀리더라. 이젠 누가 묶었는지 보기만 해도 알겠어.'), hero('맞아. 끝을 꼭 안쪽에 숨겨 놓지.')] },
    ],
    rewardXp: 15,
    offer: [line('linea', '리네아', '시아에게 말 좀 걸어 줘. 오빠한테도 자랑하고 싶어 하던데.')],
    reminder: [line('linea', '리네아', '시아가 창문 끈을 어떻게 묶었는지 물어봐.')],
    done: [line('linea', '리네아', '테온이 해 지기 전에 입구를 한 번 더 봐 달랬어. 다녀오면 여관에서 만나자.')],
  },
  {
    id: 'evening-patrol', title: '해 질 무렵의 순찰', giver: 'linea', main: true, requires: 'sia-knot', turnIn: 'teon',
    objective: { label: '마을 남쪽 입구의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'south-watch', map: 'village' },
    rewardXp: 20, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [hero('남쪽 입구를 살펴보고 테온에게 알려 주자.')],
    reminder: [line('linea', '리네아', '입구를 살핀 뒤 테온에게 알려 줘. 너무 늦진 말고.')],
    done: [hero('입구에 잿빛 나방이 모여 있었어. 이런 나방이 있었나?'), line('teon', '테온', '나도 처음 보네. 기억해 둘게. 밤에는 내가 지킬 테니 넌 여관으로 가.')] ,
  },
  {
    id: 'festival-eve', title: '축제 전야', giver: 'teon', main: true, requires: 'evening-patrol',
    turnIn: 'rosetta', completeOnTarget: true, confirm: true,
    objective: { label: '준비를 마치고 여관의 로제타에게 말하기', need: 1, event: 'talk', npc: 'rosetta' },
    rewardXp: 15,
    offer: [line('teon', '테온', '로제타 아주머니께 준비됐다고 하면 잔치를 시작할 거야. 남은 볼일이 있으면 먼저 보고 와.')],
    reminder: [line('teon', '테온', '여관은 남동쪽이야. 오늘은 내 몫까지 즐겨 줘.')],
    target: [line('rosetta', '로제타', '다들 모였구나! 오늘만큼은 걱정 내려놓고 따뜻하게 먹자.'), line('serena', '세레나', '시아, 너무 서두르지 말고. 시온도 이쪽에 앉으렴.'), line('sia', '시아', '오빠, 등불 띄울 때 내 옆에 있어야 해!'), line('linea', '리네아', '둘 다 조금만 기다려. 나도 같이 갈 거니까.'), ruan('오늘 수고 많았다. 이렇게 웃을 수 있으면 좋은 날이지.'), { speaker: '로웬 마을', text: '잔치가 끝나고, 사람들은 각자의 집으로 돌아가기 시작했다.' }, line('teon', '테온', '남쪽 입구다! 모두 여관 쪽으로 물러서!')],
    done: [ruan('시온, 나와 길을 열자! 사람들부터 안전한 곳으로 보내는 거다.')],
  },
  {
    id: 'village-raid', title: '꺼져 가는 등불', giver: 'rosetta', main: true, requires: 'festival-eve', turnIn: 'ruan',
    objective: { label: '남쪽 입구에서 들어온 권속 저지하기', need: 3, event: 'kill', map: 'village', encounter: 'village-raid' },
    steps: [
      { label: '남쪽 입구에서 들어온 권속 저지하기', need: 3, event: 'kill', map: 'village', encounter: 'village-raid' },
      { label: '광장의 세레나 안전 확인하기', need: 1, event: 'talk', npc: 'serena', lines: [line('serena', '세레나', '나는 괜찮아. 다친 사람들과 여관으로 갈게. 시아는… 리네아와 먼저 나갔는데.'), hero('제가 찾을게요. 어머니는 안으로 들어가세요.')] },
      { label: '광장의 에일라에게 부상자 상황 확인하기', need: 1, event: 'talk', npc: 'eila', lines: [line('eila', '에일라', '북쪽 골목에서 리네아를 찾았어. 큰 외상은 없는데 쓰러져 있었어. 시아는 보이지 않고… 루안도 크게 다쳤으니 먼저 가 보렴.'), hero('리네아는요? 괜찮은 거죠?'), line('eila', '에일라', '내가 곁에 있을게. 지금은 모두 안전하게 옮기는 게 먼저야.')] },
    ],
    rewardXp: 50, rewardItems: [{ id: 'potion', count: 3 }],
    offer: [line('rosetta', '로제타', '여관 문은 열어 둘게! 밖에 남은 사람들을 부탁해!')],
    reminder: [line('rosetta', '로제타', '길을 막는 권속부터 물리쳐 줘. 세레나와 에일라도 밖에 있어!')],
    done: [ruan('더는 따라오지 않는구나… 사람들은 무사하니?'), hero('네. 하지만 시아가 안 보여요. 리네아도 다쳤고요.'), ruan('나는 조금 쉬어야겠다. 가족부터 찾아보렴. 혼자 너무 멀리 나가지는 말고.')],
  },
  {
    id: 'missing-sia', title: '돌아오지 않은 동생', giver: 'ruan', main: true, requires: 'village-raid',
    turnIn: 'eila', completeOnTarget: true,
    objective: { label: '마을 북쪽의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena' },
    steps: [
      { label: '마을 북쪽의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena', lines: [line('serena', '세레나', '아직 돌아오지 않았어. 집에도 없더구나. 혹시 모르니 너도 한 번 봐 주겠니?')] },
      { label: '마을 북쪽 시온의 집 앞에서 시아의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'home-search', map: 'village-north' },
      { label: '에일라에게 리네아의 상태 확인하기', need: 1, event: 'talk', npc: 'eila', lines: [line('eila', '에일라', '리네아가 눈은 떴지만, 평범한 부상은 아니야. 몸에 어떤 권능의 흔적이 남아 있어. 겉으로 보이는 상처를 치료해도 그 흔적은 사라지지 않는구나.'), hero('그럼 고칠 방법을 찾아야겠네요. 시아도… 꼭 데려올 거예요.')] },
    ],
    rewardXp: 25,
    offer: [ruan('세레나와 이야기하고 집도 살펴봐라. 에일라가 리네아를 돌보고 있을 거다.')],
    reminder: [ruan('혼자 감당하려 하지 마. 마을 사람들에게 물어보렴.')],
    done: [line('eila', '에일라', '헤르만 촌장님이 오래된 서신을 꺼내셨어. 이번 일과 관계가 있을지 모르겠다며 널 찾으시더구나.')],
  },
  {
    id: 'sealed-letter', title: '봉인된 서신', giver: 'eila', main: true, requires: 'missing-sia',
    turnIn: 'vernel', completeOnTarget: true,
    objective: { label: '헤르만에게 오래된 서신 확인하기', need: 1, event: 'talk', npc: 'herman' },
    steps: [
      { label: '헤르만에게 오래된 서신 확인하기', need: 1, event: 'talk', npc: 'herman', lines: [line('herman', '헤르만', '우리 집안이 대대로 지켜 온 서신이다. 때가 오면 열라고 했지. 이제 열어야겠더구나.'), hero('뭐라고 쓰여 있나요?'), line('herman', '헤르만', '너무 오래된 글자라 읽을 수가 없구나. 베르넬에게 보여 주겠니?')] },
      { label: '베르넬에게 서신의 표식 보여 주기', need: 1, event: 'talk', npc: 'vernel', lines: [line('vernel', '베르넬', '글자 전체는 모르겠어. 하지만 이 표식은… 북쪽 유적에서 본 것과 같아.'), hero('그곳에 가면 실마리를 찾을 수 있을까요?')] },
    ],
    rewardXp: 25,
    offer: [line('eila', '에일라', '우선 촌장님께 가 보렴. 서신은 베르넬이 알아볼 수 있을지도 몰라.')],
    reminder: [line('eila', '에일라', '헤르만 촌장님과 베르넬에게 서신을 확인해 봐.')],
    done: [line('vernel', '베르넬', '가능성은 있어. 다만 무너진 길부터 조사해야 해. 내가 유적에 들어갈 준비를 알아볼게.'), hero('기다릴게요. 그동안 리네아와 마을 사람들을 돌봐야겠어요.')],
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
export interface QuestProgress { status: QuestStatus; count: number; step?: number }
/** 받은 퀘스트만 들어 있다. 없는 퀘스트는 아직 받지 않은 것이다. */
export type QuestState = Partial<Record<QuestId, QuestProgress>>;

/** 머리 위와 미니맵에 띄우는 표시 */
/**
 * 머리 위 표시. 메인 퀘스트(main)는 노란색, 서브 퀘스트는 초록색(sub-)으로 나눈다.
 * 진행 중(progress)과 말 걸 대상(target)은 메인·서브 구분 없이 하나다.
 */
export type QuestMarker = 'new' | 'ready' | 'sub-new' | 'sub-ready' | 'progress' | 'target';

/** 여러 표시가 겹칠 때 먼저 보여 줄 순서 */
export const MARKER_PRIORITY: QuestMarker[] = ['ready', 'sub-ready', 'new', 'sub-new', 'target', 'progress'];

/** 새 퀘스트나 완료할 퀘스트 표시를 메인/서브에 맞춘다. */
export function questMarker(def: QuestDef, kind: 'new' | 'ready'): QuestMarker {
  return def.main ? kind : `sub-${kind}`;
}

/** 현재 단계의 목표. 기존 단일 목표 저장은 step 없이 그대로 읽는다. */
export function currentObjective(def: QuestDef, progress?: QuestProgress): QuestObjective {
  return def.steps?.[progress?.step ?? 0] ?? def.objective;
}

export function reportTo(def: QuestDef): NpcId { return def.turnIn ?? def.giver; }

function canStart(def: QuestDef, state: QuestState): boolean {
  return !state[def.id] && (!def.requires || state[def.requires]?.status === 'done');
}

/** 완료한 메인 다음 의뢰를 자동 수락한다. 첫 수련은 루안에게 직접 받는다. */
export function continueMainQuest(state: QuestState): QuestState {
  if (QUESTS.some(q => q.main && state[q.id] && state[q.id]!.status !== 'done')) return state;
  const next = QUESTS.find(q => q.main && q.requires && canStart(q, state));
  return next ? { ...state, [next.id]: { status: 'active', count: 0 } } : state;
}

export function markerFor(npc: NpcId, state: QuestState): QuestMarker | undefined {
  const ordered = [...QUESTS].sort((a, b) => Number(!!b.main) - Number(!!a.main));
  const ready = ordered.find(q => reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (ready) return questMarker(ready, 'ready');
  // 다음 메인 목적지를 서브 의뢰보다 먼저 안내한다.
  const target = ordered.find(q => state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).npc === npc);
  if (target?.main) return 'target';
  const fresh = ordered.find(q => q.giver === npc && canStart(q, state));
  if (fresh) return questMarker(fresh, 'new');
  if (target) return 'target';
  if (ordered.some(q => (q.giver === npc || reportTo(q) === npc) && state[q.id]?.status === 'active')) return 'progress';
  return undefined;
}

export interface TalkResult {
  lines: DialogueLine[];
  state: QuestState;
  accepted?: QuestDef;
  completed?: QuestDef;
  progressed?: QuestDef;
  next?: QuestDef;
}

function finish(state: QuestState, def: QuestDef, lines: DialogueLine[]): TalkResult {
  const objective = currentObjective(def, state[def.id]);
  const done: QuestState = { ...state, [def.id]: { ...state[def.id]!, status: 'done', count: objective.need } };
  const nextState = continueMainQuest(done);
  const next = QUESTS.find(q => !done[q.id] && nextState[q.id]);
  return { lines: [...lines, ...def.done, ...(next?.offer ?? [])], state: nextState, completed: def, next };
}

/** 완료 > 현재 메인 목표 > 서브 목표 > 새 의뢰 > 진행 안내 순서. */
export function talkTo(npc: NpcId, state: QuestState): TalkResult | undefined {
  const ordered = [...QUESTS].sort((a, b) => Number(!!b.main) - Number(!!a.main));
  const ready = ordered.find(q => reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (ready) return finish(state, ready, []);
  const target = ordered.find(q => state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).event === 'talk' && currentObjective(q, state[q.id]).npc === npc);
  if (target) {
    const objective = currentObjective(target, state[target.id]);
    const next = advance(state, target, 1);
    const lines = objective.lines ?? target.target ?? [];
    if (target.completeOnTarget && next[target.id]?.status === 'ready') return finish(next, target, lines);
    return { lines, state: next, progressed: target };
  }
  const offer = ordered.find(q => q.giver === npc && canStart(q, state));
  if (offer) return { lines: offer.offer, state: { ...state, [offer.id]: { status: 'active', count: 0 } }, accepted: offer };
  const active = ordered.find(q => (q.giver === npc || reportTo(q) === npc) && state[q.id]?.status === 'active');
  if (active) return { lines: active.reminder, state };
  return undefined;
}

function advance(state: QuestState, def: QuestDef, by: number): QuestState {
  const current = state[def.id]!;
  const objective = currentObjective(def, current);
  const count = Math.min(objective.need, current.count + by);
  if (count === objective.need && def.steps && (current.step ?? 0) + 1 < def.steps.length) {
    return { ...state, [def.id]: { status: 'active', count: 0, step: (current.step ?? 0) + 1 } };
  }
  return { ...state, [def.id]: { ...current, status: count >= objective.need ? 'ready' : 'active', count } };
}

export interface QuestUpdate { quest: QuestDef; count: number; need: number; ready: boolean }

export function recordEvent(state: QuestState, event: QuestEvent): { state: QuestState; updates: QuestUpdate[] } {
  let next = state;
  const updates: QuestUpdate[] = [];
  for (const q of QUESTS) {
    const o = currentObjective(q, state[q.id]);
    if (state[q.id]?.status !== 'active' || o.event !== event.type || event.type === 'talk') continue;
    if ('map' in event && o.map && o.map !== event.map) continue;
    if (event.type === 'kill' && o.encounter !== event.encounter) continue;
    if (event.type === 'inspect' && o.spot !== event.spot) continue;
    next = advance(next, q, 1);
    updates.push({ quest: q, count: Math.min(o.need, state[q.id]!.count + 1), need: o.need, ready: next[q.id]!.status === 'ready' });
  }
  return { state: next, updates };
}

export function trackedQuests(state: QuestState): Array<{ quest: QuestDef; progress: QuestProgress }> {
  return QUESTS.filter(q => state[q.id] && state[q.id]!.status !== 'done')
    .sort((a, b) => Number(!!b.main) - Number(!!a.main))
    .map(q => ({ quest: q, progress: state[q.id]! }));
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
    const { status, count, step } = value as Partial<QuestProgress>;
    if (step !== undefined && (!Number.isInteger(step) || step < 0 || step >= (def.steps?.length ?? 1))) continue;
    const objective = currentObjective(def, { status: 'active', count: 0, step });
    if (status !== 'active' && status !== 'ready' && status !== 'done') continue;
    if (!Number.isInteger(count) || count! < 0) continue;
    const clamped = Math.min(count!, objective.need);
    // 목표 수를 바꿨을 때도 말이 되게 상태를 다시 맞춘다.
    state[def.id] = { status: status === 'done' ? 'done' : clamped >= objective.need ? 'ready' : 'active', count: clamped, ...(step !== undefined ? { step } : {}) };
  }
  return continueMainQuest(state);
}

export function serializeQuests(state: QuestState): string {
  return JSON.stringify({ version: QUEST_SAVE_VERSION, quests: state });
}
