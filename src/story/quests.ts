import type { MonsterKind } from '../combat/monsterTypes.ts';
import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { NpcId, NamedNpcId } from '../world/npcs.ts';
import type { MapId } from '../world/maps.ts';
import type { ItemId } from '../items/inventory.ts';
import type { EnhanceSlotId, GearId } from '../items/equipment.ts';
import type { SkillId } from '../entities/skills.ts';

/**
 * 퀘스트 (docs/story-chapter1.md).
 *
 * 마을 사람에게 말을 걸면 퀘스트를 받고(!), 목표를 채운 뒤 다시 말을 걸면 완료한다(?).
 * 목표는 게임에서 일어나는 일(QuestEvent)을 센다. 다단계 목표와 조사·습격 이벤트는 chapterOne.ts 및 GameScene이 연결한다.
 * 보상은 경험치, 골드, 아이템, 장신구, 기술, 장비 칸의 무료 강화·승급이다.
 * 앞서 끝낸 다른 퀘스트에 따라 대사가 달라질 수 있다(LineVariant: 서브 퀘스트를 했으면 메인 대사가 그 일을 기억한다).
 * 이 파일은 Phaser를 쓰지 않아 tools/quests.test.mjs가 직접 불러 검사한다.
 */

export type QuestId = 'ruan-training' | 'ruan-dodge' | 'ruan-parry' | 'ruan-field' | 'eila-potion' | 'vernel-resonance'
  | 'ruan-forest' | 'doran-gel' | 'teon-lunch'
  | 'linea-flowers' | 'sia-pebble' | 'vernel-tablet' | 'eila-herbs' | 'serena-water'
  | 'watch-report' | 'festival-supplies' | 'sia-knot' | 'harvest-help' | 'evening-patrol' | 'moth-trail'
  | 'festival-eve' | 'village-raid' | 'missing-sia' | 'sealed-letter' | 'first-sword'
  // 2장 (docs/story-chapter2.md, story/chapterTwo.ts)
  | 'fern-cart' | 'farewell' | 'mountain-pass' | 'pass-shelter' | 'still-ferry' | 'night-bell'
  // 2장 서브 퀘스트 1~3 (docs/story-chapter2.md "서브 퀘스트 초안")
  | 'linea-ink' | 'fern-cover' | 'dor-herbs'
  // 2장 메인 7, 서브 4·5
  | 'missing-five' | 'leaky-roof' | 'tangled-nets';

/** 게임에서 일어나서 퀘스트 목표를 채우는 일 */
export type QuestEvent =
  | { type: 'kill'; map: MapId; monster?: MonsterKind; encounter?: 'village-raid' }
  | { type: 'finisher' }
  // 초반 전투 수련(story/tutorial.ts): 회피, 패링 성공, 회복 아이템 사용, 공명 사용
  | { type: 'dodge' }
  | { type: 'parry' }
  | { type: 'item' }
  | { type: 'resonance' }
  | { type: 'talk'; npc: NpcId }
  | { type: 'inspect'; spot: InspectSpot; map: MapId };

/** 살펴보기 지점 (story/chapterOne.ts의 SPOTS) */
export type InspectSpot =
  | 'south-watch' | 'home-search' | 'moth-nest' | 'north-alley' | 'pass-summit' | 'ferry-forge' | 'reed-kite'
  | 'wildflower' | 'stream-pebble' | 'ancient-tablet' | 'silver-herb-1' | 'silver-herb-2' | 'silver-herb-3' | 'clear-water'
  | 'pass-herb-1' | 'pass-herb-2' | 'pass-herb-3' | 'pass-herb-4' | 'pass-herb-5'
  | 'reed-bundle-1' | 'reed-bundle-2' | 'reed-bundle-3' | 'tangled-net-1' | 'tangled-net-2' | 'tangled-net-3';

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
  monster?: MonsterKind;
  lines?: DialogueLine[];
  /** 이 단계를 마치면 배우는 기술 */
  rewardSkill?: SkillId;
  /** 이 단계를 마친 대화 뒤 그 자리에서 하룻밤을 보낸다 (고개의 쉼터: 화면이 어두워졌다 밝아지고, 고개 쉼터가 다시 시작할 자리가 된다) */
  night?: boolean;
  /** 이 단계를 마친 대화 뒤에 그 자리에서 보는 연출 (퀘스트 6: 여관의 밤, 물가에서 깨어남) */
  cutscene?: 'night-bell' | 'river-wake';
  /** ifDone 퀘스트를 끝냈으면 lines 대신 쓰는 대사 */
  linesIf?: LineVariant[];
}

/** 앞서 ifDone 퀘스트를 끝냈으면 기본 대사 대신 쓰는 대사 (앞의 것이 먼저) */
export interface LineVariant { ifDone: QuestId; lines: DialogueLine[] }

/** variants 중 조건(끝낸 퀘스트)이 맞는 첫 대사, 없으면 기본 대사 */
export function pickLines(base: DialogueLine[], variants: LineVariant[] | undefined, state: QuestState): DialogueLine[] {
  return variants?.find(v => state[v.ifDone]?.status === 'done')?.lines ?? base;
}

export interface QuestDef {
  id: QuestId;
  title: string;
  /** 퀘스트를 주는 사람. 완료 대상은 turnIn이 없으면 이 사람이다. */
  giver: NpcId;
  /** 이 퀘스트를 끝내야 받을 수 있다 */
  requires?: QuestId;
  /** 진행 중인 특정 퀘스트의 최소 단계(minStep 이상이거나 완료 시 해금) */
  requiresStep?: { quest: QuestId; minStep: number };
  /** 메인 스토리 퀘스트인지 */
  main?: boolean;
  /** 1장 첫날(수확제 시작 전)에만 받고 진행할 수 있는 일상 서브 의뢰인지 */
  dayOnly?: boolean;
  objective: QuestObjective;
  /** 여러 목표를 차례로 수행한다. objective는 첫 목표와 같다. */
  steps?: QuestObjective[];
  /** 보고할 사람. 생략하면 의뢰인. */
  turnIn?: NpcId;
  /** 마지막 대화 대상에게 목표 달성과 보고를 한 번에 처리한다. */
  completeOnTarget?: boolean;
  /**
   * 초반 전투 수련(story/tutorial.ts). 예전 저장이 이미 이보다 뒤의 메인 퀘스트를 하고 있으면
   * 끝낸 것으로 친다(parseQuests). 다시 돌아가 배우게 하지 않는다.
   */
  tutorial?: boolean;
  confirm?: boolean;
  rewardXp: number;
  rewardGold?: number;
  rewardItems?: Array<{ id: ItemId; count: number }>;
  /** 보상 장신구 (가방에 들어간다) */
  rewardGear?: GearId[];
  /** 보상 칸 승급 (1장 완료 '도란의 검' 등 스토리 이벤트 전용: 지정 칸을 최소 targetRank까지 무료 승급) */
  rewardPromote?: Array<{ slot: EnhanceSlotId; targetRank: number }>;
  /** 보상 칸 강화 (무료로 levels만큼 +강화. 1장 서브 '담금질 재료') */
  rewardEnhance?: Array<{ slot: EnhanceSlotId; levels: number }>;
  /** 보상 기술 (entities/skills.ts). 비어 있는 첫 기술 칸에 들어간다. */
  rewardSkill?: SkillId;
  offer: DialogueLine[];
  /** 진행 중에 퀘스트를 준 사람에게 말을 걸면 */
  reminder: DialogueLine[];
  /** 의뢰인과 보고 대상이 다를 때, 대화 상대 자신의 진행 안내. */
  remindersByNpc?: Partial<Record<NpcId, DialogueLine[]>>;
  /** talk 목표: 그 사람에게 말을 걸었을 때 */
  target?: DialogueLine[];
  /** ifDone 퀘스트를 끝냈으면 target 대신 쓰는 대사 */
  targetIf?: LineVariant[];
  done: DialogueLine[];
}

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const line = (npc: NamedNpcId, speaker: string, text: string): DialogueLine => ({ speaker, portrait: npc, text });
const ruan = (text: string) => line('ruan', '루안', text);
const fern = (text: string) => line('fern', '페른', text);
const dor = (text: string): DialogueLine => ({ speaker: '도르', portrait: 'dor', text });
const evan = (text: string): DialogueLine => ({ speaker: '에반', portrait: 'evan', text });
const marta = (text: string): DialogueLine => ({ speaker: '마르타', portrait: 'marta', text });
const finn = (text: string): DialogueLine => ({ speaker: '핀', portrait: 'finn', text });
const daughter = (text: string): DialogueLine => ({ speaker: '어부의 딸', portrait: 'fisher-daughter', text });
const herbalist = (text: string): DialogueLine => ({ speaker: '약초 가게 할머니', portrait: 'herbalist-elder', text });
const miller = (text: string): DialogueLine => ({ speaker: '방앗간 젊은이', portrait: 'mill-apprentice', text });
const innWife = (text: string): DialogueLine => ({ speaker: '핀의 어머니', portrait: 'innkeeper-wife', text });
const fisher = (text: string): DialogueLine => ({ speaker: '나루 어부', portrait: 'ferry-fisher', text });
const innkeeper = (text: string): DialogueLine => ({ speaker: '여관 주인', portrait: 'fog-innkeeper', text });

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
    done: [ruan('좋다. 이제야 칼끝이 제대로 따라오는구나.'), ruan('물약 몇 병 챙겨 둬라. 실전은 다르다.')],
    tutorial: true,
  },
  {
    id: 'ruan-dodge', title: '몸을 빼는 법', giver: 'ruan', main: true, requires: 'ruan-training', tutorial: true,
    objective: { label: '회피 3번', need: 3, event: 'dodge' },
    rewardXp: 10,
    offer: [
      ruan('베는 것만큼 중요한 게 맞지 않는 거다. 칼을 쥔 채로 몸을 빼는 법을 익혀라.'),
      ruan('상대가 몸을 움츠렸다가 덤벼드는 그 순간에 빠지면, 상대는 허공을 베고 넌 틈을 얻는다.'),
      ruan('여기서 세 번, 몸이 기억할 때까지 빠져 봐라.'),
    ],
    reminder: [ruan('발이 먼저다. 세 번 빠져 봐라.')],
    done: [ruan('좋아, 발이 가볍구나. 하지만 매번 피할 수는 없다.')],
  },
  {
    id: 'ruan-parry', title: '칼로 받아내기', giver: 'ruan', main: true, requires: 'ruan-dodge', tutorial: true,
    objective: { label: '적의 공격을 막기로 받아내기 (남쪽 들판의 슬라임)', need: 2, event: 'parry' },
    rewardXp: 20,
    offer: [
      ruan('피할 수 없을 땐 칼로 받아낸다. 덤벼드는 그 순간에 칼을 세우면, 힘은 흘러가고 상대는 무너진다.'),
      ruan('너무 일찍 세우면 팔만 저리지. 이건 혼자서는 못 익힌다. 남쪽 들판의 슬라임을 상대로 두 번 받아내 봐라.'),
    ],
    reminder: [ruan('들판의 슬라임이 덤벼드는 순간, 칼을 세워라. 두 번이다.')],
    done: [ruan('받아냈구나. 칼끝이 울리는 그 느낌, 잊지 마라.')],
  },
  {
    id: 'ruan-field', title: '들판의 슬라임', giver: 'ruan', main: true, requires: 'ruan-parry',
    objective: { label: '남쪽 들판의 슬라임', need: 5, event: 'kill', map: 'south-field', monster: 'slime' },
    rewardXp: 30, rewardGold: 50,
    offer: [
      ruan('실전 감각을 익혀라. 남쪽 입구로 나가면 들판에 슬라임이 있다.'),
      ruan('다섯 마리를 잡고 돌아와. 덤벼들기 전에 몸을 움츠리면 피할 때다.'),
    ],
    reminder: [ruan('들판은 남쪽 입구 너머다. 다섯 마리, 잊지 마라.')],
    done: [ruan('제법 잘 싸우고 돌아왔구나. 잘했다.')],
  },
  {
    id: 'eila-potion', title: '약은 아끼지 말고', giver: 'ruan', main: true, requires: 'ruan-field', tutorial: true,
    turnIn: 'eila',
    objective: { label: '마을 북쪽 치유소의 에일라 찾아가기', need: 1, event: 'talk', npc: 'eila' },
    steps: [
      { label: '마을 북쪽 치유소의 에일라 찾아가기', need: 1, event: 'talk', npc: 'eila', lines: [
        line('eila', '에일라', '루안이 보냈구나. 어디 보자… 들판에서 긁힌 데가 그대로네.'),
        line('eila', '에일라', '싸우다 다치면 참지 말고 물약을 마시렴. 미리 손닿는 곳에 챙겨 두는 게 중요해.'),
        line('eila', '에일라', '지금 한 병 마셔 보렴. 마시고 나면 다시 말 걸고.'),
      ] },
      { label: '물약 마셔 보기', need: 1, event: 'item' },
    ],
    rewardXp: 15, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [ruan('그래도 들판을 돌고 왔으니 에일라에게 가서 상처를 보여라. 약 쓰는 법도 배워 두고. 치유소는 마을 북쪽이다.')],
    reminder: [ruan('치유소의 에일라에게 가 봐라. 마을 북쪽이다.')],
    remindersByNpc: { eila: [line('eila', '에일라', '물약 칸에 물약을 넣어 두고, 한 병 마셔 보렴.')] },
    done: [line('eila', '에일라', '잘했어. 두 병 더 챙겨 줄게. 물약은 아끼다 쓰러지면 소용없단다.')],
  },
  {
    id: 'vernel-resonance', title: '칼끝의 울림', giver: 'eila', main: true, requires: 'eila-potion', tutorial: true,
    turnIn: 'ruan',
    objective: { label: '광장의 베르넬에게 이야기 듣기', need: 1, event: 'talk', npc: 'vernel' },
    steps: [
      { label: '광장의 베르넬에게 이야기 듣기', need: 1, event: 'talk', npc: 'vernel', lines: [
        line('vernel', '베르넬', '루안에게 들었어. 칼로 공격을 받아낼 때 칼끝이 울린다고.'),
        line('vernel', '베르넬', '옛 기록에 그런 울림을 모아 몸에 두르는 검사들 얘기가 있어. 구슬 다섯 개가 가득 차면, 잠깐 동안 더 세게 베고 덜 다친대.'),
        hero('그게 정말 돼요?'),
        line('vernel', '베르넬', '해 보면 알겠지. 마침 네 칼끝에 울림이 가득해 보이는데? 한번 끌어내 보고 루안에게 들려줘.'),
      ] },
      { label: '공명 써 보기', need: 1, event: 'resonance' },
    ],
    rewardXp: 20,
    offer: [line('eila', '에일라', '그러고 보니 베르넬이 너를 찾더구나. 칼끝의 울림이 어쩌고 하던데. 광장에 있을 거야.')],
    reminder: [line('eila', '에일라', '베르넬은 광장에 있을 거야.')],
    remindersByNpc: { vernel: [line('vernel', '베르넬', '울림을 끌어내 봐. 써 보고 나면 루안에게도 들려줘.')] },
    done: [ruan('베르넬이 또 옛 기록 얘기를 했구나. …그래도 그 울림은 나도 안다. 함부로 믿지는 말고, 버릴 필요도 없다.')],
  },
  {
    id: 'ruan-forest', title: '늘어난 마물', giver: 'ruan', main: true, requires: 'vernel-resonance',
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
    target: [hero('테온, 숲에 마물이 평소보다 많았어. 스승님도 신경이 쓰이신대.'), line('teon', '테온', '역시 그랬구나… 내가 들은 것보다 많네. 입구 경계를 더 살필게. 넌 잠깐 축제 준비를 도와줄래?')],
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
      { label: '마을 북쪽의 시아에게 창문 끈 이야기 듣기', need: 1, event: 'talk', npc: 'sia', lines: [line('sia', '시아', '언니 집 창문 끈이 헐거워졌네. 잠깐만, 내가 묶을게.'), { speaker: '로웬 마을', text: '시아는 끈을 두 번 감고, 끝을 안쪽에 숨겨 단단히 묶었다.' }, hero('또 네 방식으로 묶었네.'), line('sia', '시아', '이렇게 해야 바람이 불어도 안 풀리지. 오빠는 맨날 대충 묶잖아.'), line('sia', '시아', '언니, 등불은 나중에 같이 띄우자.')] },
      { label: '리네아와 매듭 이야기 나누기', need: 1, event: 'talk', npc: 'linea', lines: [line('linea', '리네아', '어릴 때부터 시아가 묶어 주면 안 풀리더라. 이젠 누가 묶었는지 보기만 해도 알겠어.'), hero('맞아. 끝을 꼭 안쪽에 숨겨 놓지.')] },
    ],
    rewardXp: 15,
    offer: [line('linea', '리네아', '시아에게 말 좀 걸어 줘. 오빠한테도 자랑하고 싶어 하던데.')],
    reminder: [line('linea', '리네아', '시아가 창문 끈을 어떻게 묶었는지 물어봐.')],
    done: [line('linea', '리네아', '아, 헤르만 촌장님이 등불대를 세울 일손을 찾으시더라. 우린 여기 마무리할 테니 가 볼래?')],
  },
  {
    id: 'harvest-help', title: '수확제 일손', giver: 'herman', main: true, requires: 'sia-knot',
    turnIn: 'herman', completeOnTarget: true,
    objective: { label: '촌장의 집 앞 헤르만에게 일손 돕겠다고 말하기', need: 1, event: 'talk', npc: 'herman' },
    steps: [
      { label: '촌장의 집 앞 헤르만에게 일손 돕겠다고 말하기', need: 1, event: 'talk', npc: 'herman', lines: [
        line('herman', '헤르만', '오, 시온이 왔구먼. 광장에 등불대를 세우는데 걸쇠가 모자라고 초도 다 떨어졌네.'),
        line('herman', '헤르만', '대장간의 도란에게 걸쇠를, 잡화점의 메리나에게 초를 받아다 주겠나? 값은 내가 미리 치러 두었네.'),
        hero('맡겨 주세요, 촌장님.')] },
      { label: '대장간의 도란에게 등불 걸쇠 받기', need: 1, event: 'talk', npc: 'doran', lines: [
        line('doran', '도란', '걸쇠? 벌써 다 두들겨 놨지! 올해는 바람에 떨어지는 등불이 하나도 없을 거다.'),
        line('doran', '도란', '작년엔 내가 사다리에서 떨어졌다는 얘기는 하지 마라. 에일라가 아직도 놀린다고.')] },
      { label: '잡화점의 메리나에게 초 받기', need: 1, event: 'talk', npc: 'merina', lines: [
        line('merina', '메리나', '촌장님 초 말이지? 여기, 오래 타는 걸로 골라 뒀어.'),
        line('merina', '메리나', '등불 띄울 때 리네아랑 시아 옆자리는 비워 둬. 그 둘, 매년 너 기다리잖아.'),
        hero('…알았어요.')] },
      { label: '촌장의 집 앞 헤르만에게 걸쇠와 초 전하기', need: 1, event: 'talk', npc: 'herman', lines: [
        line('herman', '헤르만', '이걸로 등불대는 다 세웠군. 수고했네.'),
        line('herman', '헤르만', '내가 너만 할 때는 이 축제가 일 년 중 제일 기다려졌지. 오늘 밤은 모두 웃을 수 있으면 좋겠구먼.')] },
    ],
    rewardXp: 25, rewardGold: 40,
    offer: [hero('촌장님께 가서 도와드릴 일이 있는지 여쭤보자.')],
    reminder: [line('herman', '헤르만', '도란에게 걸쇠를, 메리나에게 초를 받아 오게.')],
    done: [line('herman', '헤르만', '그런데 테온이 입구 쪽이 어수선하다더군. 해 지기 전에 한 번만 살펴봐 주겠나? 그다음엔 여관의 로제타에게 가 보게. 잔치 상을 차리고 있을 걸세.')],
  },
  {
    id: 'evening-patrol', title: '해 질 무렵의 순찰', giver: 'herman', main: true, requires: 'harvest-help', turnIn: 'teon',
    objective: { label: '마을 남쪽 입구의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'south-watch', map: 'village' },
    rewardXp: 20, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [hero('남쪽 입구를 살펴보고 테온에게 알려 주자.')],
    reminder: [line('herman', '헤르만', '입구를 살핀 뒤 테온에게 알려 주게. 너무 늦진 말고.')],
    remindersByNpc: { teon: [line('teon', '테온', '남쪽 입구 쪽이 좀 어수선해. 먼저 흔적을 살펴보고 와 줘. 여기서 기다릴게.')] },
    done: [hero('입구에 잿빛 나방이 모여 있었어. 이런 나방이 있었나?'), line('teon', '테온', '나도 처음 보네. 들판 쪽에서 계속 날아오는 것 같아.')],
  },
  {
    id: 'moth-trail', title: '잿빛 날갯가루', giver: 'teon', main: true, requires: 'evening-patrol', turnIn: 'teon',
    objective: { label: '남쪽 들판의 잿빛 나방 쫓아내기', need: 4, event: 'kill', map: 'south-field', monster: 'ashen-moth' },
    steps: [
      { label: '남쪽 들판의 잿빛 나방 쫓아내기', need: 4, event: 'kill', map: 'south-field', monster: 'ashen-moth' },
      { label: '들판의 나방이 모여 앉았던 풀숲 살펴보기', need: 1, event: 'inspect', spot: 'moth-nest', map: 'south-field' },
    ],
    rewardXp: 30, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [
      line('teon', '테온', '미안하지만 들판에 모인 놈들 좀 쫓아 줄래? 난 입구를 비울 수가 없어.'),
      line('teon', '테온', '가루를 뒤집어쓰면 몸이 무거워진대. 조심해.'),
    ],
    reminder: [line('teon', '테온', '들판의 나방은 아직이야? 어디서 날아오는지도 봐 줘.')],
    done: [
      hero('나방이 앉았던 풀이 잿빛으로 바스러져 있었어. 불에 탄 것도 아닌데.'),
      line('teon', '테온', '바스러졌다고…? 축제가 끝나면 촌장님께 말씀드리자.'),
      line('teon', '테온', '오늘 밤은 내가 입구를 지킬게. 로제타 아주머니가 기다리셔.'),
    ],
  },
  {
    id: 'festival-eve', title: '축제 전야', giver: 'teon', main: true, requires: 'moth-trail',
    turnIn: 'rosetta', completeOnTarget: true, confirm: true,
    objective: { label: '준비를 마치고 여관의 로제타에게 말하기', need: 1, event: 'talk', npc: 'rosetta' },
    rewardXp: 15,
    offer: [line('teon', '테온', '로제타 아주머니께 준비됐다고 하면 잔치를 시작할 거야. 남은 볼일이 있으면 먼저 보고 와.')],
    reminder: [line('teon', '테온', '여관은 남동쪽이야. 오늘은 내 몫까지 즐겨 줘.')],
    // 잔치 자체는 광장의 수확제 연출(story/festival.ts)에서 보여 준다.
    target: [line('rosetta', '로제타', '왔구나! 다들 광장에 모였어. 상은 다 차려 놨으니 어서 나가자.'), hero('네, 지금 갈게요.')],
    done: [],
  },
  {
    id: 'village-raid', title: '꺼져 가는 등불', giver: 'rosetta', main: true, requires: 'festival-eve', turnIn: 'ruan',
    objective: { label: '남쪽 입구에서 들어온 권속 저지하기', need: 6, event: 'kill', map: 'village', encounter: 'village-raid' },
    steps: [
      { label: '남쪽 입구에서 들어온 권속 저지하기', need: 6, event: 'kill', map: 'village', encounter: 'village-raid' },
      { label: '남쪽 입구의 테온 살피기', need: 1, event: 'talk', npc: 'teon', lines: [
        line('teon', '테온', '윽… 괜찮아, 긁힌 거야. 그보다 몇 놈이 여관 쪽 골목으로 빠졌어!'),
        line('teon', '테온', '대피하다 뒤처진 사람들이 아직 그 골목에 갇혀 있어. 시온, 그쪽을 막아 줘!'),
        hero('알았어. 테온은 여기서 버텨!')] },
      { label: '여관 앞 골목의 권속 저지하기', need: 3, event: 'kill', map: 'village', encounter: 'village-raid' },
      { label: '광장의 세레나 안전 확인하기', need: 1, event: 'talk', npc: 'serena', lines: [line('serena', '세레나', '나는 괜찮아. 다친 사람들은 북쪽 치유소로 보냈어. 시아는… 리네아와 북쪽 집 쪽으로 먼저 갔는데.'), hero('북쪽으로요? 제가 가 볼게요. 어머니도 남은 사람들과 북쪽으로 피하세요.')] },
      // 추적자 넷·잿빛 나방 넷을 막으면 1장 보스 부식의 집행자가 나타난다 (story/chapterOne.ts RAID_WAVES)
      { label: '마을 북쪽 길을 막은 권속과 부식의 집행자 저지하기', need: 9, event: 'kill', map: 'village-north', encounter: 'village-raid' },
      { label: '리네아의 집 옆 골목 살펴보기', need: 1, event: 'inspect', spot: 'north-alley', map: 'village-north' },
      { label: '마을 북쪽 치유소의 에일라에게 부상자 상황 확인하기', need: 1, event: 'talk', npc: 'eila', lines: [line('eila', '에일라', '사람들이 북쪽 골목에서 리네아를 업어 왔어. 큰 외상은 없는데 쓰러져 있었어. 시아는 보이지 않고… 루안도 크게 다쳤으니 먼저 가 보렴.'), hero('리네아는요? 괜찮은 거죠?'), line('eila', '에일라', '내가 곁에 있을게. 지금은 모두 안전하게 옮기는 게 먼저야.')] },
    ],
    rewardXp: 50, rewardItems: [{ id: 'potion', count: 3 }],
    // 습격은 수확제 연출 끝에서 시작한다(연출의 대사가 이 퀘스트를 연다).
    offer: [],
    reminder: [line('rosetta', '로제타', '여관은 입구와 가까워 다들 치유소로 옮겼어. 여긴 괜찮으니 밖을 부탁해!')],
    done: [ruan('더는 따라오지 않는구나… 사람들은 무사하니?'), hero('네. 하지만 시아가 안 보여요. 리네아도 다쳤고요.'), ruan('나는 조금 쉬어야겠다. 가족부터 찾아보렴. 혼자 너무 멀리 나가지는 말고.')],
  },
  {
    id: 'missing-sia', title: '돌아오지 않은 동생', giver: 'ruan', main: true, requires: 'village-raid',
    turnIn: 'linea', completeOnTarget: true,
    objective: { label: '치유소의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena' },
    steps: [
      { label: '치유소의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena', lines: [line('serena', '세레나', '아직 돌아오지 않았어. 집에도 없더구나. 혹시 모르니 너도 한 번 봐 주겠니?')] },
      { label: '마을 북쪽 시온의 집 앞에서 시아의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'home-search', map: 'village-north' },
      { label: '에일라에게 리네아의 상태 확인하기', need: 1, event: 'talk', npc: 'eila', lines: [
        line('eila', '에일라', '리네아가 눈은 떴지만, 몸속을 갉아먹는 기운이 남아 있어. 평범한 독도 아니고… 어떤 권능의 흔적 같구나. 상처를 치료해도 그 기운은 사라지지 않아.'),
        hero('그럼 고칠 방법을 찾아야겠네요. 시아도… 꼭 데려올 거예요.'),
        line('eila', '에일라', '방금 깨어나서 아직 기운이 없지만, 널 찾더구나. 잠깐 이야기 나눠 보렴.'),
      ] },
      { label: '깨어난 리네아와 이야기 나누기', need: 1, event: 'talk', npc: 'linea', lines: [
        line('linea', '리네아', '시온… 왔어?'),
        hero('리네아, 괜찮아? 무리해서 말하지 않아도 돼.'),
        line('linea', '리네아', '…기억이 끊겨. 북쪽 골목에서 권속이 몰려와서 시아를 감싸 안았는데, 갑자기 숨이 막히면서 쓰러졌어.'),
        line('linea', '리네아', '눈을 떠 보니 치유소였고… 시아는 없었어. 내가 끝까지 지켰어야 했는데… 미안해, 시온.'),
        hero('네 잘못이 아니야. 시아도… 네 몸에 남은 기운도, 내가 꼭 해결할게.'),
      ] },
    ],
    rewardXp: 25,
    offer: [ruan('세레나와 이야기하고 집도 살펴봐라. 에일라가 리네아를 돌보고 있을 거다.')],
    reminder: [ruan('혼자 감당하려 하지 마. 마을 사람들에게 물어보렴.')],
    done: [line('eila', '에일라', '…그나저나 시온. 헤르만 촌장님이 오래된 서신을 꺼내셨어. 이번 일과 관계가 있을지 모르겠다며 널 찾으시더구나.')],
  },
  {
    id: 'sealed-letter', title: '봉인된 서신', giver: 'eila', main: true, requires: 'missing-sia',
    turnIn: 'vernel', completeOnTarget: true,
    objective: { label: '헤르만에게 오래된 서신 확인하기', need: 1, event: 'talk', npc: 'herman' },
    steps: [
      { label: '헤르만에게 오래된 서신 확인하기', need: 1, event: 'talk', npc: 'herman', lines: [line('herman', '헤르만', '우리 집안이 대대로 지켜 온 서신이다. 때가 오면 열라고 했지. 이제 열어야겠네.'), hero('뭐라고 쓰여 있나요?'), line('herman', '헤르만', '너무 오래된 글자라 읽을 수가 없구나. 베르넬에게 보여 주겠나?')] },
      { label: '베르넬에게 서신의 표식 보여 주기', need: 1, event: 'talk', npc: 'vernel',
        lines: [
          line('vernel', '베르넬', '글자 전체는 모르겠어. 하지만 이 표식은… 북쪽 유적에서 본 것과 같아.'),
          line('vernel', '베르넬', '그러고 보니 며칠 전 들판에서도 이런 무늬가 새겨진 석판 조각이 나왔다던데. 우연은 아닐지도 몰라.'),
          hero('그곳에 가면 실마리를 찾을 수 있을까요?'),
        ],
        // 첫날 '이상한 돌조각'을 했으면 그때 받은 연구 메모로 같은 표식임을 알아본다.
        linesIf: [{ ifDone: 'vernel-tablet', lines: [
          line('vernel', '베르넬', '글자 전체는 모르겠어. 하지만 이 표식은…'),
          hero('(연구 메모를 꺼낸다) 이거… 그날 들판 석판에서 옮겨 적어 주신 거요.'),
          line('vernel', '베르넬', '…똑같아. 석판은 들판에서, 서신은 촌장님 집안에서 나왔는데 같은 표식이라니.'),
          line('vernel', '베르넬', '둘 다 이 마을을 처음 세운 사람과 이어져 있다는 뜻이겠지. 북쪽 유적 입구에도 같은 무늬가 있었어.'),
          hero('그곳에 가면 실마리를 찾을 수 있을까요?'),
        ] }] },
    ],
    rewardXp: 25,
    offer: [line('eila', '에일라', '우선 촌장님께 가 보렴. 서신은 베르넬이 알아볼 수 있을지도 몰라.')],
    reminder: [line('eila', '에일라', '헤르만 촌장님과 베르넬에게 서신을 확인해 봐.')],
    done: [line('vernel', '베르넬', '가능성은 있어. 다만 무너진 길부터 조사해야 해. 내가 유적에 들어갈 준비를 알아볼게.'), hero('기다릴게요. 그동안 리네아와 마을 사람들을 돌봐야겠어요.'),
      line('vernel', '베르넬', '그러고 보니 도란이 너를 찾더군. 대장간 불이 밤새 꺼지지 않았어.')],
  },
  {
    id: 'first-sword', title: '도란의 검', giver: 'vernel', main: true, requires: 'sealed-letter',
    turnIn: 'doran', completeOnTarget: true,
    objective: { label: '대장간의 도란 찾아가기', need: 1, event: 'talk', npc: 'doran' },
    rewardXp: 20, rewardPromote: [{ slot: 'weapon', targetRank: 1 }],
    offer: [line('vernel', '베르넬', '대장간에 들러 봐. 도란은 말보다 망치가 먼저인 사람이니까.')],
    reminder: [line('vernel', '베르넬', '도란이 대장간에서 기다리고 있을 거야.')],
    target: [
      line('doran', '도란', '왔냐. …앉아라, 아니 서 있어도 되고.'),
      line('doran', '도란', '앞으로도 그런 밤을 견디려면, 네 손에 맞는 검이 있어야지. 밤새 두들겼다. 받아라.'),
      hero('이걸… 저한테요?'),
      line('doran', '도란', '언젠가 네 검 한 자루 두들겨 주겠다고 했잖냐. 생각보다 일찍 오긴 했다만.'),
      line('doran', '도란', '아, 에일라가 전해 달라더라. 리네아가 좀 안정돼서 이제 자기 집에서 쉬게 할 거래. 세레나랑 함께 옮긴다더군.'),
      line('doran', '도란', '시아 데려와라. 리네아도 고칠 방법 찾고. 날이 무뎌지면 언제든 돌아와서 맡겨.'),
    ],
    // 첫날 '담금질 재료'를 했으면 그때 모은 점액이 이 검이 된다.
    targetIf: [{ ifDone: 'doran-gel', lines: [
      line('doran', '도란', '왔냐. …앉아라, 아니 서 있어도 되고.'),
      line('doran', '도란', '앞으로도 그런 밤을 견디려면, 네 손에 맞는 검이 있어야지. 밤새 두들겼다. 받아라.'),
      hero('이걸… 저한테요?'),
      line('doran', '도란', '언젠가 네 검 한 자루 두들겨 주겠다고 했잖냐. 생각보다 일찍 오긴 했다만.'),
      line('doran', '도란', '그리고 네가 모아 온 그 슬라임 점액 말이다. 남은 걸로 이 검을 담금질했다. …정말 효과가 있더라고!'),
      hero('그게 진짜였어요?'),
      line('doran', '도란', '나도 몰랐다. 하하!'),
      line('doran', '도란', '아, 에일라가 전해 달라더라. 리네아가 좀 안정돼서 이제 자기 집에서 쉬게 할 거래. 세레나랑 함께 옮긴다더군.'),
      line('doran', '도란', '시아 데려와라. 리네아도 고칠 방법 찾고. 날이 무뎌지면 언제든 돌아와서 맡겨.'),
    ] }],
    done: [line('doran', '도란', '무기 칸을 1단계 진화(도란의 검)로 승급해 뒀다. 강화나 추가 승급이 필요하면 언제든 대장간으로 와라.')],
  },
  // ---------------------------------------------------------------- 2장: 물안개 나루의 종소리
  {
    id: 'fern-cart', title: '남문의 수레', giver: 'fern', main: true, requires: 'first-sword', completeOnTarget: true,
    objective: { label: '남문 안쪽 수레의 행상인 만나기', need: 1, event: 'talk', npc: 'fern' },
    steps: [
      { label: '남문 안쪽 수레의 행상인 만나기', need: 1, event: 'talk', npc: 'fern', lines: [
        fern('어이, 로웬 사람이지? 수레 좀 봐 주게. 어젯밤 고개를 내려오다 잿빛 나방 떼한테 덮개를 다 뜯겼어.'),
        fern('나는 페른. 이 길 저 길 다니며 물건 파는 행상인이야. …마을 꼴을 보니 여기도 험한 밤이었구먼.'),
        hero('어제 습격이 있었어요. 그 나방들, 아직 남쪽 들판에 남아 있나요?'),
        fern('넷쯤 들판 쪽으로 날아가더군. 저것들이 남아 있으면 또 수레로 몰려와. 쫓아 주면 장사부터 열어 주지.')] },
      { label: '남쪽 들판에 남은 잿빛 나방 쫓기', need: 4, event: 'kill', map: 'south-field', monster: 'ashen-moth' },
      { label: '페른에게 돌아가기', need: 1, event: 'talk', npc: 'fern', lines: [
        fern('벌써? 하, 칼솜씨가 제법이구먼. 덕분에 오늘 밤은 짐 걱정 없이 자겠어.'),
        fern('답례로 소식 하나 주지. 요즘 신의 물건을 물려받았다는 사람들 소문이 돌아. 계승자라던가.'),
        fern('그보다 너, 동쪽으로 갈 거면 큰일이다. 고개 너머 나루가 멈췄어. 밤마다 강에서 종이 울리는데, 그걸 들은 사람이 강으로 걸어 들어간대.'),
        fern('…그리고 고개를 넘어오는 길에 검은 짐승 무리를 봤어. 누굴 호위하듯 줄을 맞춰 동쪽으로 가더라.'),
        hero('동쪽으로요…?'),
        fern('어디로 가든, 빈손으로는 가지 마라. 내 수레에 길 떠나는 사람한테 필요한 건 다 있으니까.')] },
    ],
    turnIn: 'fern',
    rewardXp: 30, rewardGold: 40, rewardItems: [{ id: 'antidote-herb', count: 2 }],
    offer: [line('doran', '도란', '그러고 보니 아침에 남문 쪽이 시끄럽더라. 행상인 수레가 들어왔다던데, 덮개가 다 찢겼다더군. 한번 가 봐라.')],
    reminder: [fern('잿빛 나방은 남쪽 들판에 있어. 넷이야. 그것들만 없어지면 장사를 열지.')],
    target: [],
    done: [fern('자, 이제 장사 시작이다. 물약, 건빵, 푸른 이슬, 해독 약초. 필요한 걸 골라 봐.')],
  },
  {
    id: 'farewell', title: '떠날 채비', giver: 'ruan', main: true, requires: 'fern-cart', turnIn: 'herman', completeOnTarget: true,
    objective: { label: '광장의 루안에게 떠난다고 말하기', need: 1, event: 'talk', npc: 'ruan' },
    steps: [
      { label: '광장의 루안에게 떠난다고 말하기', need: 1, event: 'talk', npc: 'ruan', lines: [
        hero('스승님, 동쪽으로 가 보려고요. 시아를 데려간 그 무리가 그쪽으로 갔대요.'),
        ruan('…그럴 줄 알았다. 몸이 성치 않아 따라가 주지 못해 미안하구나. 네가 익힌 검과 눈을 믿어라.'),
        ruan('혼자 짊어지지 마라. 길에서 만나는 사람들에게 기대는 것도 실력이다.')] },
      { label: '리네아의 집에 있는 세레나에게 인사하기', need: 1, event: 'talk', npc: 'serena', lines: [
        line('serena', '세레나', '…가는구나. 말려도 소용없다는 거, 엄마가 제일 잘 알지.'),
        line('serena', '세레나', '시아를 데려와. 너도 꼭 돌아오고.')] },
      { label: '리네아의 집에서 리네아에게 인사하기', need: 1, event: 'talk', npc: 'linea', lines: [
        line('linea', '리네아', '오늘부터 일지를 쓰려고. 에일라 선생님이 보기 편하게.'),
        line('linea', '리네아', '…다녀와. 시아한테, 언니가 기다린다고 전해 줘.')] },
      { label: '리네아의 집에 있는 에일라에게 인사하기', need: 1, event: 'talk', npc: 'eila', lines: [
        line('eila', '에일라', '창조의 권능을 가진 치유사라면 리네아의 시간을 늦출 수 있을지 몰라. 교단에 그런 사람들이 있어.'),
        line('eila', '에일라', '…하지만 교단 사람들이 사람 몸에서 힘을 꺼내 보겠다는 검사를 권하면 절대 응하지 마. 그걸로 망가진 사람을 내가 봤어. 약속해.'),
        hero('약속할게요. 리네아를 부탁드려요.')] },
      { label: '촌장 헤르만에게 인사하기', need: 1, event: 'talk', npc: 'herman', lines: [
        line('herman', '헤르만', '동쪽으로 간다고? 동문으로 나가 개울을 따라가면 고갯길이 나온다. 고개를 넘으면 큰 강가의 나루지.'),
        line('herman', '헤르만', '빈손으로 보낼 수야 없지. 마을 사람들이 조금씩 모은 여비다. 받아 두게.')] },
    ],
    rewardXp: 40, rewardGold: 100, rewardItems: [{ id: 'potion', count: 3 }],
    offer: [hero('…떠나기 전에, 모두에게 인사부터 해야겠어. 스승님부터.')],
    reminder: [ruan('인사는 다 했느냐? 북쪽 사람들도 네 얼굴을 보고 싶어 할 거다.')],
    done: [line('herman', '헤르만', '로웬은 우리가 지키마. 너는 네 길을 가거라. 시아를 꼭 찾고.'), hero('다녀오겠습니다.')],
  },
  {
    id: 'mountain-pass', title: '동쪽 고갯길', giver: 'herman', main: true, requires: 'farewell', turnIn: 'dor', completeOnTarget: true,
    objective: { label: '고갯길을 막은 서리 딱정벌레 쫓기', need: 3, event: 'kill', map: 'east-pass', monster: 'frost-beetle' },
    steps: [
      { label: '고갯길을 막은 서리 딱정벌레 쫓기', need: 3, event: 'kill', map: 'east-pass', monster: 'frost-beetle' },
      { label: '고개 중턱의 돌 쉼터 찾아가기', need: 1, event: 'talk', npc: 'dor', lines: [
        dor('허, 이 길로 사람이 올라오다니 오랜만이구먼. 딱정벌레들을 쫓은 게 자네였나?'),
        dor('로웬 아이로구먼. 그쪽 하늘이 어젯밤 시뻘겋더니… 고생했겠어.'),
        hero('네. 동쪽 나루로 가는 길이에요. 시아… 동생을 찾고 있어요.'),
        dor('나는 도르. 이 고개에서 약초를 캐며 사네. 앉게, 불 좀 쬐고 가.')] },
    ],
    rewardXp: 45, rewardItems: [{ id: 'travel-biscuit', count: 3 }],
    offer: [hero('동문으로 나가 개울을 따라가면 고갯길이랬지. …가자.')],
    reminder: [line('herman', '헤르만', '동문으로 나가 개울가 오른쪽 끝으로 가면 고갯길이다. 길을 막은 놈들이 있으면 조심하게.')],
    done: [dor('요즘 강 위 안개가 밤마다 짙어져. 사공들이 배를 묶었다더군. …오늘은 여기서 쉬어 가게. 날이 저물면 고개는 위험해.')],
  },
  {
    id: 'pass-shelter', title: '고개의 쉼터', giver: 'dor', main: true, requires: 'mountain-pass', completeOnTarget: true,
    objective: { label: '쉼터를 노리는 안개 까마귀 쫓기', need: 4, event: 'kill', map: 'east-pass', monster: 'fog-crow' },
    steps: [
      { label: '쉼터를 노리는 안개 까마귀 쫓기', need: 4, event: 'kill', map: 'east-pass', monster: 'fog-crow' },
      { label: '도르의 쉼터에서 하룻밤 묵기', need: 1, event: 'talk', npc: 'dor', night: true, lines: [
        dor('까마귀들이 잠잠해졌구먼. 고맙네. 저놈들은 안개를 타고 내려와. 강 위 안개가 짙어질수록 수가 늘지.'),
        dor('자, 불가에 눕게. 산에서는 해가 지면 움직이는 게 아니야.'),
        { speaker: '고개의 쉼터', text: '불가에 누워도 잠이 오지 않았다. 시온은 로웬 쪽 하늘을 오래 바라보았다.' },
        hero('시아… 조금만 기다려. 금방 갈게.')] },
      { label: '고개 꼭대기에서 강 내려다보기', need: 1, event: 'inspect', map: 'east-pass', spot: 'pass-summit' },
      { label: '쉼터의 도르에게 인사하기', need: 1, event: 'talk', npc: 'dor', lines: [
        hero('꼭대기에서 강을 봤어요. 해가 떴는데도 안개가 걸려 있었어요.'),
        dor('그게 요즘 나루 사람들 근심이야. 밤마다 짙어지고, 해가 떠도 다 걷히질 않아.')] },
    ],
    rewardXp: 50, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [dor('…그런데 하나 부탁하세. 해가 기울면 안개 까마귀들이 쉼터 둘레를 맴돌아. 불씨를 노리는 건지, 사람을 노리는 건지. 좀 쫓아 주겠나?')],
    reminder: [dor('까마귀들은 동쪽 바위 쪽에 모여 있어. 날개 치는 소리가 들리면 몸을 낮추게.')],
    done: [dor('나루까지는 내리막으로 반나절이야. 쉼터는 늘 비워 두마. 오가는 길에 쉬어 가게.')],
  },
  {
    // 퀘스트 5 (docs/story-chapter2.md "멈춘 나루"): 배를 얻지 못한 채 나루의 일상과 공포를 겪고, 첫 단서(종 그림, 놋쇠 종)를 줍는다.
    id: 'still-ferry', title: '멈춘 나루', giver: 'evan', main: true, requires: 'pass-shelter', completeOnTarget: true,
    objective: { label: '물안개 나루의 사공 에반에게 배 부탁하기', need: 1, event: 'talk', npc: 'evan' },
    steps: [
      { label: '물안개 나루의 사공 에반에게 배 부탁하기', need: 1, event: 'talk', npc: 'evan', lines: [
        hero('강을 건너야 해요. 배를 띄워 주실 수 있나요?'),
        evan('배는 안 띄워. …밤이 오면 너도 귀를 막고 자라.'),
        hero('누구를 기다리세요?'),
        evan('…딸.'),
        hero('저도 동생을 찾고 있어요. 검은 짐승 무리를 못 보셨어요? 누굴 데려가듯 줄을 맞춰 가는 무리요.'),
        evan('어젯밤 저 위 얕은 여울을 건너가더군. 배도 없이. …한가운데 하나는 등에 짐 같은 걸 지고 유난히 천천히 건너더군.'),
        hero('그 여울로 가면—'),
        evan('사람은 못 건너. 물살이 사람 허리를 꺾지. 그것들은 사람이 아니니 건넌 거다.'),
        evan('…여관에 가 봐. 묵을 데는 거기뿐이야.'),
        { speaker: HERO_NAME, portrait: 'hero-neutral', text: '(강을 건너려면 결국 배가 있어야 해. 일단 여관에 가 보자.)' }] },
      { label: '나루 여관에서 소문 듣기', need: 1, event: 'talk', npc: 'fog-innkeeper', lines: [
        innkeeper('손님이라니, 오랜만이네. 방은 남아돌아. 요즘 누가 이 나루에 오겠어.'),
        { speaker: '구석의 손님', text: '(사당 종에 저주가 내렸대. 옛날엔 안개를 쫓던 종이 이젠 사람을 부른다잖아…)' },
        innkeeper('쉿, 그 얘긴 크게 하지 말게. …밤에 종이 울리면 들은 사람이 강으로 걸어 들어가. 벌써 다섯이야.'),
        innkeeper('모르간 나리가 쌀이며 등불을 나눠 주시니 다들 겨우 버티는 거지. 곧 괜찮아질 거라시더군.'),
        innkeeper('배를 기다릴 거면 마을 일이나 좀 거들어 주게. 대장간 마르타 할멈은 풀무질할 손이 모자라고, 우리 핀 녀석은 연을 잃어버렸다고 난리야.')] },
      { label: '대장간의 마르타 돕기', need: 1, event: 'talk', npc: 'marta', lines: [
        marta('여관에서 보냈느냐? 마침 잘 왔다. 이 늙은 팔로는 풀무를 오래 못 밟아.'),
        marta('화덕 옆 풀무를 좀 밟아 다오. 불이 죽지 않을 만큼만.')] },
      { label: '대장간 화덕의 풀무 밟기', need: 1, event: 'inspect', map: 'in-ferry-marta-smithy', spot: 'ferry-forge' },
      { label: '마르타에게 벽의 종 그림 묻기', need: 1, event: 'talk', npc: 'marta', lines: [
        hero('벽에 걸린 그림, 커다란 종이던데요.'),
        marta('…우리 집안이 예전에 종을 부었지.'),
        marta('옛날 얘기다. 불 봐 줘서 고맙구나. 쇠 다루는 손이 제법이야.')] },
      { label: '여관의 핀 만나기', need: 1, event: 'talk', npc: 'finn', lines: [
        finn('형이 아빠가 말한 그 손님이지? 내 연 좀 찾아 줘! 바람에 날아가서 갈대밭 늪에 걸렸어.'),
        finn('나 혼자는 못 가. 갈대 사이에 뭔가 숨어 있다가 덤벼. 물도 막 쏘고.'),
        hero('늪은 어느 쪽이야?'),
        finn('마을 남서쪽 길로 쭉 내려가면 돼. 갈대가 사람 키만 해.')] },
      { label: '갈대밭 늪의 마물 쫓기', need: 3, event: 'kill', map: 'reed-swamp' },
      { label: '갈대에 걸린 핀의 연 찾기', need: 1, event: 'inspect', map: 'reed-swamp', spot: 'reed-kite' },
      { label: '핀에게 연 돌려주기', need: 1, event: 'talk', npc: 'finn', lines: [
        finn('내 연! 찢어지지도 않았네. 형 최고야!'),
        hero('연 옆 진흙 속에 이런 게 있었어. 작은 놋쇠 종.'),
        finn('…종? 몰라, 처음 봐. 늪에 왜 그런 게 있지?'),
        finn('…형, 오늘 밤엔 여관에서 자. 귀 꼭 막고. 밤엔 절대 밖에 나가면 안 돼.'),
        { speaker: HERO_NAME, portrait: 'hero-neutral', text: '(사당의 종은 강 건너 섬에 있다던데… 늪 진흙 속의 이 종은 뭐지.)' }] },
    ],
    rewardXp: 80, rewardGold: 40, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [dor('내리막으로 반나절이면 나루야. 사공 에반을 찾게. 말수는 없어도 강은 그 사람이 제일 잘 알아.')],
    reminder: [evan('…배는 안 띄운다고 했다. 여관에나 가 봐.')],
    remindersByNpc: {
      'fog-innkeeper': [innkeeper('마르타 할멈과 우리 핀 녀석 일 좀 봐 주게. 밤이 오기 전에.')],
      marta: [marta('풀무는 저 안쪽 화덕 옆이다. 불이 죽지 않게만 밟아 다오.')],
      finn: [finn('연은 갈대밭 늪에 걸렸어. 마을 남서쪽 길로 내려가!')],
    },
    done: [finn('이 연, 조안 누나가 만들어 준 거야. …누나도 곧 돌아올 거야. 그치?')],
  },
  {
    // 퀘스트 6 (docs/story-chapter2.md "밤의 종소리"): 여관에서 밤을 보내다 종소리를 직접 겪는다. 잠든 여관 주인을 물가에서 깨운다.
    id: 'night-bell', title: '밤의 종소리', giver: 'fog-innkeeper', main: true, requires: 'still-ferry', turnIn: 'finn', completeOnTarget: true,
    objective: { label: '여관 주인에게 방 얻기', need: 1, event: 'talk', npc: 'fog-innkeeper' },
    steps: [
      { label: '여관 주인에게 방 얻기', need: 1, event: 'talk', npc: 'fog-innkeeper', cutscene: 'night-bell', lines: [
        hero('오늘 밤 묵어 갈게요. 핀이 밤엔 절대 밖에 나가지 말라던데요.'),
        innkeeper('그 녀석이 또 겁을 줬구먼. …허나 틀린 말은 아니야. 자, 솜이네. 귀를 단단히 막고 자게.'),
        innkeeper('창은 내가 닫아 두지. 강 쪽에서 무슨 소리가 들려도 내다보지 말고.'),
        { speaker: '나루 여관', text: '여관 주인이 창을 하나씩 닫는다. 강에서 밀려온 안개가 창틈에 하얗게 서려 있다.' }] },
      { label: '여관 주인을 가로막는 안개 환영 물리치기', need: 3, event: 'kill', map: 'ferry-village', monster: 'mist-phantom' },
      { label: '물가의 여관 주인 깨우기', need: 1, event: 'talk', npc: 'fog-innkeeper', cutscene: 'river-wake', lines: [
        { speaker: '물가', text: '강 위의 안개가 여관 주인의 발 앞으로 낮게 깔려, 물 위로 하얀 길을 내고 있다.' },
        { speaker: '물가', text: '여관 주인이 한 발을 들어 안개 위에 올린다. …빠지지 않는다.' },
        hero('아저씨! 일어나세요! 거기는 강이에요!')] },
      { label: '아버지를 끌어안은 핀 달래기', need: 1, event: 'talk', npc: 'finn', lines: [
        finn('밤새 안 잤는데… 문 여는 소리를 못 들었어. 형이 없었으면 아빠는…'),
        hero('아저씨는 괜찮아. 네가 깨워 줘서 나도 따라올 수 있었어.'),
        finn('…형. 내가 아는 거, 전부 말해 줄게. 조안 누나 일도.')] },
    ],
    rewardXp: 90, rewardGold: 30, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [hero('(핀 말대로 오늘 밤은 여관에서 묵자. 여관 주인에게 방을 부탁해야지.)')],
    reminder: [innkeeper('방은 언제든 내주지. 밤이 오기 전에 들어오게.')],
    done: [
      innkeeper('…어머니가 강 건너 안개 속에서 부르셨어. 십 년 전에 돌아가셨는데.'),
      { speaker: HERO_NAME, portrait: 'hero-neutral', text: '(잠든 사람만 디딜 수 있는 길이 있다. 깨어 있는 사람에게는 그냥 물이다.)' },
    ],
  },
  {
    // 퀘스트 7 (docs/story-chapter2.md "사라진 다섯"): 사라진 사람들의 가족을 찾아가 모두 그리운 사람의 목소리를 들었다는 것을 안다.
    id: 'missing-five', title: '사라진 다섯', giver: 'fog-innkeeper', main: true, requires: 'night-bell', turnIn: 'marta', completeOnTarget: true,
    objective: { label: '여관 주인에게 어젯밤 이야기 듣기', need: 1, event: 'talk', npc: 'fog-innkeeper' },
    steps: [
      { label: '여관 주인에게 어젯밤 이야기 듣기', need: 1, event: 'talk', npc: 'fog-innkeeper', lines: [
        innkeeper('밤새 고마웠네. …날이 밝으니 이제야 어제 들은 게 또렷해.'),
        innkeeper('어머니 목소리가 꼭 어릴 적 저녁 먹으라고 부르던 그대로였어… 따라가야 할 것 같았지. 강이 마당처럼 보였어.'),
        hero('사라진 사람들도 그런 목소리를 들었을까요?'),
        innkeeper('글쎄… 가족들에게 물어보게. 어부네 딸, 약초 가게 할멈, 방앗간 젊은이, 마르타 할멈. 그리고 에반.')] },
      { label: '어부의 집의 딸 찾아가기', need: 1, event: 'talk', npc: 'fisher-daughter', lines: [
        daughter('…아빠 이야기 들으러 왔어요? 이거, 아빠 찌예요. 아빠가 늘 갖고 다니던 거.'),
        daughter('그날 밤에 아빠가 강에서 잃은 형 이름을 불렀어. 형이 부른다고. 문을 열고 나갔어.'),
        daughter('솜을 꼈는데도 들렸대. 아빠는 형 목소리를 잊은 적이 없으니까.')] },
      { label: '약초 가게 할머니 찾아가기', need: 1, event: 'talk', npc: 'herbalist-elder', lines: [
        herbalist('차 한 잔 들고 가게. 요즘은 손님이 와도 차 끓일 기운이 없어.'),
        herbalist('영감이 먼저 간 딸아이를 찾는다고 문을 열었지. "아가, 거기 있니" 하면서.'),
        herbalist('딸아이는 스무 해 전에 열병으로 갔다네. …그 목소리를 아직 기억하고 있었던 게야.')] },
      { label: '방앗간 젊은이 찾아가기', need: 1, event: 'talk', npc: 'mill-apprentice', lines: [
        miller('형이… 군대에서 돌아오지 못한 친구 이름을 불렀어요.'),
        miller('같이 떠났는데 형만 돌아왔거든요. 그 뒤로 밤마다 잠을 못 잤어요. 그날 밤엔… 대답하듯 웃더라고요.'),
        hero('웃었다고요?'),
        miller('네. 오랜만에 보는 얼굴이었어요. 그래서 붙잡지 못했어요.')] },
      { label: '사공 에반에게 조안 이야기 듣기', need: 1, event: 'talk', npc: 'evan', lines: [
        evan('…그날 밤 나도 그 사람 목소리를 들었어. 조안이 제 엄마 목소리라고 했지.'),
        evan('그런데 그 애가 대신 갔다. 내가 아니라.'),
        evan('섬으로 세 번 저어 나갔어. 세 번 다 이 나루로 돌아오더군. 안개가 배를 돌려보내.'),
        hero('모두 그리워하던 사람의 목소리를 들었어요. 저도… 시아 목소리를 들었고요.'),
        evan('나도 들었는데… 왜 조안만 데려간 거지?'),
        hero('…아직 모르겠어요. 하지만 그 목소리를 따라가면 안 돼요.')] },
      { label: '마르타에게 사위 이야기 듣기', need: 1, event: 'talk', npc: 'marta', lines: [
        marta('우리 집 사위가 갔어. 몇 해 전 잃은 아내, 내 딸 목소리를 들었다더구나.'),
        hero('…저도 시아 목소리를 들었어요. 거기 있을 리가 없는데.')] },
    ],
    rewardXp: 100, rewardGold: 40,
    offer: [hero('(날이 밝으면 여관 주인에게 어젯밤 들은 목소리 이야기를 더 들어 보자.)')],
    reminder: [innkeeper('사라진 사람들 가족에게 가 보게. 어부네, 약초 가게, 방앗간, 마르타 할멈, 그리고 에반.')],
    remindersByNpc: { marta: [marta('다른 집 이야기부터 들어 보거라. 나는 여기 있으마.')] },
    done: [
      marta('그건 그리운 사람의 목소리를 흉내 낼 뿐이야. 진짜가 아니란다.'),
      marta('…그 목소리를 따라가지 마라. 네가 찾는 아이는 강 건너 안개 속에 있지 않아.'),
      { speaker: HERO_NAME, portrait: 'hero-neutral', text: '(모두 그리운 사람의 목소리를 들었다. 그리고 그 목소리를 따라 걸어갔다.)' },
    ],
  },
  // ---------------------------------------------------------------- 2장 서브 퀘스트 1~3
  {
    // 1. 리네아의 첫 잉크: 떠날 채비에서 리네아를 만난 뒤(step 3 이상). 일지를 쓸 잉크와 공책을 메리나에게 받아다 준다.
    id: 'linea-ink', title: '리네아의 첫 잉크', giver: 'linea', requires: 'fern-cart', requiresStep: { quest: 'farewell', minStep: 3 }, completeOnTarget: true,
    objective: { label: '잡화점의 메리나에게 잉크와 공책 받기', need: 1, event: 'talk', npc: 'merina' },
    steps: [
      { label: '잡화점의 메리나에게 잉크와 공책 받기', need: 1, event: 'talk', npc: 'merina', lines: [
        hero('메리나 아주머니, 리네아가 일지를 쓸 잉크와 공책을 부탁했어요.'),
        line('merina', '메리나', '리네아가? 몸도 성치 않은데 기특하기도 하지. 제일 좋은 걸로 줄게.'),
        line('merina', '메리나', '값은 됐어. 다 나으면 가게에 얼굴이나 비추라고 전해 줘.')] },
      { label: '리네아에게 잉크와 공책 건네기', need: 1, event: 'talk', npc: 'linea', lines: [
        line('linea', '리네아', '와, 새 공책이다. 잉크 냄새도 좋다.'),
        line('linea', '리네아', '아픈 동안 매일 어떤지 적어 둘게. 에일라 선생님이 그러면 낫는 걸 빨리 알 수 있대.'),
        line('linea', '리네아', '…그리고 이건 시온 거. 공책 뒤에서 몇 장 떼었어. 가는 곳마다 한 장씩 편지 써 줘.'),
        hero('편지라니. …알았어. 꼭 쓸게.')] },
    ],
    rewardXp: 30, rewardGold: 20, rewardItems: [{ id: 'linea-letter-paper', count: 1 }],
    offer: [
      line('linea', '리네아', '시온, 부탁 하나만 해도 돼? 누워만 있으니까 하루가 어떻게 가는지 모르겠어.'),
      line('linea', '리네아', '일지를 써 보려고. 메리나 아주머니 가게에서 잉크랑 공책 좀 받아다 줄래?'),
      hero('그 정도야 금방이지. 다녀올게.'),
    ],
    reminder: [line('linea', '리네아', '메리나 아주머니 잡화점이야. 잉크는 너무 진하지 않은 걸로!')],
    done: [line('linea', '리네아', '첫 장에는 오늘 날씨부터 적을래. …맑음, 시온이 잉크를 사 옴.')],
  },
  {
    // 2. 행상인의 짐: 남문의 수레 뒤. 나방에 삭은 수레 덮개를 갈 천을 메리나에게 받아 온다. 끝나면 수레가 고쳐지고 물건이 하나 는다.
    id: 'fern-cover', title: '행상인의 짐', giver: 'fern', requires: 'fern-cart', completeOnTarget: true,
    objective: { label: '잡화점의 메리나에게 수레 덮개 천 받기', need: 1, event: 'talk', npc: 'merina' },
    steps: [
      { label: '잡화점의 메리나에게 수레 덮개 천 받기', need: 1, event: 'talk', npc: 'merina', lines: [
        hero('페른 아저씨가 수레 덮개를 갈 천을 찾는데요. 값은 미리 받아 왔어요.'),
        line('merina', '메리나', '수레 덮개라… 비 안 새는 기름 먹인 천이 한 필 있지. 무거우니 조심해서 들고 가.')] },
      { label: '페른에게 덮개 천 가져다주기', need: 1, event: 'talk', npc: 'fern', lines: [
        fern('오, 기름 먹인 천이로군! 이거면 비가 와도 끄떡없겠어.'),
        { speaker: '남문 안쪽', text: '페른과 함께 삭은 덮개를 걷어 내고 새 천을 팽팽하게 씌웠다. 수레가 몰라보게 말끔해졌다.' },
        fern('짐이 다 젖을까 봐 남쪽 장터에서 떼어 온 무화과를 못 풀고 있었거든. 이제 진열해야지.')] },
    ],
    rewardXp: 35, rewardGold: 25,
    offer: [
      fern('나방 놈들이 덮개를 다 갉아 놨어. 이대로 비라도 오면 물건이 다 젖는다니까.'),
      fern('마을 잡화점에 튼튼한 천이 있을까? 값은 내가 줄 테니 한 필만 받아다 주겠나?'),
      hero('메리나 아주머니 가게에 가 볼게요.'),
    ],
    reminder: [fern('잡화점 메리나 씨에게 기름 먹인 천을 물어보게. 비 안 새는 걸로.')],
    done: [fern('고맙네! 덕분에 장사를 제대로 하겠어. 말린 무화과도 팔기 시작했으니 길 떠나기 전에 챙겨 가게.')],
  },
  {
    // 3. 쉼터의 약초: 고개의 쉼터 뒤. 고갯길 곳곳의 약초 다섯 포기를 캐 온다. 도르의 약초 주머니는 회복 물약을 조금 더 세게 만든다.
    id: 'dor-herbs', title: '쉼터의 약초', giver: 'dor', requires: 'pass-shelter',
    objective: { label: '고갯길의 약초 캐기 (1/5)', need: 1, event: 'inspect', spot: 'pass-herb-1', map: 'east-pass' },
    steps: ([1, 2, 3, 4, 5] as const).map(i => ({
      label: `고갯길의 약초 캐기 (${i}/5)`, need: 1, event: 'inspect' as const, spot: `pass-herb-${i}`, map: 'east-pass' as const,
    })),
    rewardXp: 40, rewardItems: [{ id: 'potion', count: 3 }, { id: 'dor-herb-pouch', count: 1 }],
    offer: [
      dor('쉼터에 약초가 다 떨어졌어. 이 늙은 다리로는 고개 구석구석까지 못 다녀.'),
      dor('바위 그늘마다 잎이 톱니 같은 약초가 숨어 있지. 다섯 포기만 캐다 주겠나? 뿌리째 말고, 윗잎만.'),
      hero('윗잎만요. 알겠어요.'),
    ],
    reminder: [dor('바위 그늘, 절벽 밑을 보게. 잎이 톱니 같은 게 그거야. 다섯 포기.')],
    done: [
      dor('허, 잎을 상하지 않게 잘도 땄구먼. 산사람 다 됐어.'),
      dor('이건 자네 몫이야. 말린 약초를 채운 주머니지. 물약 마실 때 한 줌 섞으면 훨씬 잘 듣는다네.'),
    ],
  },
  {
    // 서브 4. 새는 지붕: 멈춘 나루 뒤. 갈대밭 늪에서 지붕 이을 갈대 세 묶음을 모아 핀의 어머니에게 가져간다. 끝나면 여관 지붕이 고쳐진다.
    id: 'leaky-roof', title: '새는 지붕', giver: 'innkeeper-wife', requires: 'still-ferry', completeOnTarget: true,
    objective: { label: '갈대밭 늪의 갈대 묶음 줍기 (1/3)', need: 1, event: 'inspect', spot: 'reed-bundle-1', map: 'reed-swamp' },
    steps: [
      ...([1, 2, 3] as const).map(i => ({
        label: `갈대밭 늪의 갈대 묶음 줍기 (${i}/3)`, need: 1, event: 'inspect' as const, spot: `reed-bundle-${i}`, map: 'reed-swamp' as const,
      })),
      { label: '핀의 어머니에게 갈대 가져다주기', need: 1, event: 'talk', npc: 'innkeeper-wife', lines: [
        innWife('어머나, 이렇게나 많이! 잘 마른 것만 골라 왔네.'),
        { speaker: '나루 여관', text: '여관 주인과 함께 지붕에 올라 새는 자리에 갈대를 촘촘히 얹었다. 처마 끝이 한결 단정해졌다.' },
        innWife('이제 비가 와도 손님 방에 물받이를 안 놔도 되겠어요.')] },
    ],
    rewardXp: 40, rewardGold: 30, rewardItems: [{ id: 'lunch', count: 2 }],
    offer: [
      innWife('손님, 잠깐만요. 비만 오면 여관 지붕이 새요. 위층 방은 아예 못 쓰고 있어요.'),
      innWife('갈대밭 늪에 누가 베어 묶어 둔 갈대가 있을 거예요. 세 묶음만 가져다주시면 남편이랑 지붕을 이을게요.'),
      hero('갈대밭 늪이라면 길을 알아요. 다녀올게요.'),
    ],
    reminder: [innWife('갈대밭 늪이에요. 잘 마른 갈대 묶음 세 개. 마물 조심하시고요.')],
    done: [innWife('고마워요. 도시락 두 개 싸 뒀어요. 핀이 손님 형 얘기를 얼마나 하는지 몰라요.')],
  },
  {
    // 서브 5. 엉킨 그물: 멈춘 나루 뒤. 갈대밭 물가의 마물에 엉킨 그물 셋을 풀어 나루 어부에게 가져간다.
    id: 'tangled-nets', title: '엉킨 그물', giver: 'ferry-fisher', requires: 'still-ferry', completeOnTarget: true,
    objective: { label: '갈대밭 물가의 엉킨 그물 풀기 (1/3)', need: 1, event: 'inspect', spot: 'tangled-net-1', map: 'reed-swamp' },
    steps: [
      ...([1, 2, 3] as const).map(i => ({
        label: `갈대밭 물가의 엉킨 그물 풀기 (${i}/3)`, need: 1, event: 'inspect' as const, spot: `tangled-net-${i}`, map: 'reed-swamp' as const,
      })),
      { label: '나루 어부에게 그물 돌려주기', need: 1, event: 'talk', npc: 'ferry-fisher', lines: [
        fisher('오, 셋 다 건져 왔구먼! 찢어진 데도 별로 없어.'),
        fisher('배를 못 띄우니 그물이라도 손봐 둬야지. 안개가 걷히면 제일 먼저 나갈 거야.')] },
    ],
    rewardXp: 45, rewardGold: 45, rewardItems: [{ id: 'dried-fish', count: 3 }],
    offer: [
      fisher('갈대밭 물가에 그물 세 개가 엉켰어. 마물이 어슬렁거려 손도 못 대고 있지.'),
      fisher('자네 칼 좀 쓰는 것 같던데. 풀어서 가져다주면 섭섭지 않게 해 주지.'),
      hero('그물 셋이요. 가져올게요.'),
    ],
    reminder: [fisher('갈대밭 늪 물가야. 물속에 숨어 있다가 튀어나오는 놈이 있으니 조심하게.')],
    done: [fisher('말린 생선 좀 챙겨 가게. 짭짤해서 길에서 힘이 날 거야.')],
  },
  {
    id: 'doran-gel', title: '담금질 재료', giver: 'doran',
    objective: { label: '슬라임 처치 (점액 모으기)', need: 5, event: 'kill', monster: 'slime' },
    rewardXp: 20, rewardEnhance: [{ slot: 'weapon', levels: 1 }],
    offer: [
      line('doran', '도란', '마침 잘 왔다! 슬라임 점액이 담금질에 그만이거든.'),
      line('doran', '도란', '아무 데서나 다섯 마리만 잡아서 점액 좀 모아 와라.'),
      hero('그거… 정말이에요?'),
      line('doran', '도란', '정말인지는 해 보면 알지! 하하!'),
    ],
    reminder: [line('doran', '도란', '점액은 아직이냐? 다섯 마리 분이다.')],
    done: [
      line('doran', '도란', '오, 이 끈적한 것 좀 봐라. 좋아, 이걸로 네 칼 한번 담금질해 주마. 이번엔 공짜다!'),
      line('doran', '도란', '앞으로는 골드만 가져오면 언제든 날을 세워 주지. 강화라고 하는 거다. 많이 두들길수록 단단해져.'),
    ],
  },
  {
    id: 'teon-lunch', title: '초소 도시락', giver: 'teon', dayOnly: true,
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
  {
    id: 'linea-flowers', title: '축제 장식용 들꽃', giver: 'linea', requires: 'ruan-training', dayOnly: true,
    objective: { label: '남쪽 들판에서 하늘색 들꽃 따기', need: 1, event: 'inspect', spot: 'wildflower', map: 'south-field' },
    rewardXp: 20, rewardGear: ['wildflower-bracelet'],
    offer: [
      line('linea', '리네아', '시온! 마침 잘 왔어. 축제 등불 옆에 꽂을 들꽃이 조금 모자라거든.'),
      line('linea', '리네아', '남쪽 들판에 하늘색 들꽃이 피어 있을 거야. 한 다발만 따다 줄 수 있어?'),
      hero('하늘색 들꽃? 알았어, 금방 다녀올게.'),
    ],
    reminder: [line('linea', '리네아', '남쪽 들판 서쪽 풀밭에 하늘색 꽃이 예쁘게 피어 있었어. 슬라임 조심하고!')],
    done: [
      line('linea', '리네아', '우와, 시들지도 않고 딱 예쁜 것만 골라 왔네! 고마워, 시온.'),
      line('linea', '리네아', '자, 남는 줄기로 팔찌도 하나 엮었어. 축제 동안 손목에 차고 다녀!'),
      hero('…고마워, 리네아. 소중히 찰게.'),
    ],
  },
  {
    id: 'sia-pebble', title: '리네아 언니 생일 선물', giver: 'sia', requires: 'ruan-training', dayOnly: true,
    objective: { label: '동쪽 개울가에서 예쁜 조약돌 줍기', need: 1, event: 'inspect', spot: 'stream-pebble', map: 'east-stream' },
    rewardXp: 20, rewardGold: 15, rewardItems: [{ id: 'sia-pebble', count: 1 }],
    offer: [
      line('sia', '시아', '오빠! 잠깐 이리 와 봐. 비밀인데, 곧 리네아 언니 생일이거든.'),
      line('sia', '시아', '동쪽 개울가에 물결에 깎여서 반짝거리는 예쁜 돌이 있대. 근데 거긴 마물이 있어서 혼자 못 가겠어… 오빠가 하나만 주워 와 줘!'),
      hero('비밀 선물이라니 알았어. 동쪽 개울가에서 제일 예쁜 걸로 찾아올게.'),
    ],
    reminder: [line('sia', '시아', '동쪽 개울가 물가 쪽에 반짝이는 돌이 있을 거야! 언니한테는 비밀이야!')],
    done: [
      line('sia', '시아', '와아, 진짜 매끈하고 예쁘다! 언니가 분명 좋아할 거야!'),
      line('sia', '시아', '참, 이건 아까 내가 먼저 주워 둔 건데 오빠 몫으로 줄게. 비상금도 조금! 고마워, 오빠!'),
      hero('비상금까지 주면 어떡해… 조약돌은 잘 간직할게, 시아.'),
    ],
  },
  {
    id: 'vernel-tablet', title: '이상한 돌조각', giver: 'vernel', requires: 'ruan-training', dayOnly: true,
    objective: { label: '남쪽 들판에서 낡은 석판 조각 찾기', need: 1, event: 'inspect', spot: 'ancient-tablet', map: 'south-field' },
    rewardXp: 25, rewardGold: 30, rewardItems: [{ id: 'vernel-memo', count: 1 }],
    offer: [
      line('vernel', '베르넬', '시온, 혹시 남쪽 들판에 나갈 일 있으면 바위 근처를 한 번만 살펴봐 줄래?'),
      line('vernel', '베르넬', '며칠 전부터 들판 쪽에서 오래된 석판 조각이 나온다는 얘기가 들려서 말이야. 북쪽 유적과 관련이 있을지도 몰라.'),
      hero('특이한 무늬가 있는 돌조각이요? 찾아볼게요.'),
    ],
    reminder: [line('vernel', '베르넬', '남쪽 들판 동쪽 바위 근처야. 평범한 돌이랑 다르게 희미한 선이 새겨져 있을 거야.')],
    done: [
      line('vernel', '베르넬', '이건… 틀림없어! 북쪽 유적 외벽에 새겨진 것과 같은 양식의 표식이야.'),
      line('vernel', '베르넬', '수고비와 함께 표식을 옮겨 적은 연구 메모를 하나 줄게. 언젠가 이 무늬를 또 보게 되면 금방 알아볼 수 있을 거야.'),
    ],
  },
  {
    id: 'eila-herbs', title: '약초 채집', giver: 'eila', requires: 'ruan-training', dayOnly: true,
    objective: { label: '남쪽 들판의 은빛 풀 채집 (1/3)', need: 1, event: 'inspect', spot: 'silver-herb-1', map: 'south-field' },
    steps: [
      { label: '남쪽 들판의 은빛 풀 채집 (1/3)', need: 1, event: 'inspect', spot: 'silver-herb-1', map: 'south-field' },
      { label: '남쪽 들판의 은빛 풀 채집 (2/3)', need: 1, event: 'inspect', spot: 'silver-herb-2', map: 'south-field' },
      { label: '남쪽 들판의 은빛 풀 채집 (3/3)', need: 1, event: 'inspect', spot: 'silver-herb-3', map: 'south-field' },
    ],
    rewardXp: 25, rewardItems: [{ id: 'potion', count: 5 }],
    offer: [
      line('eila', '에일라', '시온, 축제가 다가오니까 다치는 사람이 많아져서 약초가 금방 동이 나네.'),
      line('eila', '에일라', '남쪽 들판에 잎 끝이 은빛으로 반짝이는 풀이 자랄 거야. 세 뿌리만 캐다 줄 수 있겠니?'),
      hero('은빛 풀이요? 다녀올게요, 에일라 선생님.'),
    ],
    reminder: [line('eila', '에일라', '남쪽 들판 풀밭에 은빛 풀이 자랄 거야. 세 뿌리만 조심해서 캐 오렴.')],
    done: [
      line('eila', '에일라', '어머, 뿌리까지 상하지 않게 잘 캐 왔네. 이리 줘 보렴.'),
      { speaker: '치유소', text: '약초를 건네받으며 시온의 손을 잡은 에일라가 잠깐 멈칫했다.' },
      hero('…선생님? 어디 불편하세요?'),
      line('eila', '에일라', '아니야, 네 손이 유난히 따뜻해서… 괜찮아. 고맙구나. 달여 둔 회복 물약 다섯 병 챙겨 가렴. 상처가 나면 아끼지 말고 바로 마셔야 한다?'),
    ],
  },
  {
    id: 'serena-water', title: '텃밭에 줄 물', giver: 'serena', requires: 'ruan-training', dayOnly: true,
    objective: { label: '동쪽 개울가에서 맑은 물 길어 오기', need: 1, event: 'inspect', spot: 'clear-water', map: 'east-stream' },
    rewardXp: 20, rewardItems: [{ id: 'serena-lunch', count: 1 }],
    offer: [
      line('serena', '세레나', '시온, 마침 잘 만났구나. 집 앞 텃밭 흙이 바짝 말랐는데 우물물이 조금 탁해서 말이야.'),
      line('serena', '세레나', '동쪽 개울가에 가서 맑은 물 한 통만 길어다 줄 수 있겠니? 갔다 오면 엄마가 맛있는 도시락 싸 줄게.'),
      hero('좋아요, 금방 길어 올게요!'),
    ],
    reminder: [line('serena', '세레나', '동쪽 개울가 물가에서 맑은 물 한 통만 길어 오렴. 미끄러지지 않게 조심하고.')],
    done: [
      line('serena', '세레나', '아이고, 시원하고 맑네! 고맙구나, 우리 아들.'),
      line('serena', '세레나', '약속한 도시락이야. 수련하다 배고프거나 다치면 꼭 꺼내 먹으렴.'),
      hero('잘 먹을게요, 어머니!'),
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

/** 습격의 밤 동안에는 일상 서브 의뢰를 잠시 숨기고, 첫날 한정 의뢰(dayOnly)는 습격 이후에도 열지 않는다. */
export function isSubPaused(def: QuestDef, state: QuestState): boolean {
  if (def.main) return false;
  if (state['festival-eve']?.status !== 'done') return false;
  return !!def.dayOnly || state['village-raid']?.status !== 'done';
}

function canStart(def: QuestDef, state: QuestState): boolean {
  if (isSubPaused(def, state) || state[def.id]) return false;
  if (def.requires && state[def.requires]?.status !== 'done') return false;
  if (def.requiresStep) {
    const req = state[def.requiresStep.quest];
    if (!req) return false;
    if (req.status !== 'done' && (req.step ?? 0) < def.requiresStep.minStep) return false;
  }
  return true;
}

/** 완료한 메인 다음 의뢰를 자동 수락한다. 첫 수련은 루안에게 직접 받는다. */
export function continueMainQuest(state: QuestState): QuestState {
  if (QUESTS.some(q => q.main && state[q.id] && state[q.id]!.status !== 'done')) return state;
  const next = QUESTS.find(q => q.main && q.requires && canStart(q, state));
  return next ? { ...state, [next.id]: { status: 'active', count: 0 } } : state;
}

export function markerFor(npc: NpcId, state: QuestState): QuestMarker | undefined {
  const ordered = QUESTS.filter(q => !isSubPaused(q, state)).sort((a, b) => Number(!!b.main) - Number(!!a.main));
  const mainReady = ordered.find(q => q.main && reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (mainReady) return 'ready';
  // 메인 진행 대상은 완료 대기 중인 서브 의뢰보다 먼저 안내한다.
  const mainTarget = ordered.find(q => q.main && state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).npc === npc);
  if (mainTarget) return 'target';
  const subReady = ordered.find(q => !q.main && reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (subReady) return 'sub-ready';
  const fresh = ordered.find(q => q.giver === npc && canStart(q, state));
  if (fresh) return questMarker(fresh, 'new');
  const subTarget = ordered.find(q => !q.main && state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).npc === npc);
  if (subTarget) return 'target';
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
  /** 이 대화로 마친 단계 (단계 보상 rewardSkill을 준다) */
  stepDone?: QuestObjective;
}

function finish(state: QuestState, def: QuestDef, lines: DialogueLine[]): TalkResult {
  const objective = currentObjective(def, state[def.id]);
  const done: QuestState = { ...state, [def.id]: { ...state[def.id]!, status: 'done', count: objective.need } };
  const nextState = continueMainQuest(done);
  const next = QUESTS.find(q => !done[q.id] && nextState[q.id]);
  return { lines: [...lines, ...def.done, ...(next?.offer ?? [])], state: nextState, completed: def, next };
}

/** 메인 완료 > 메인 목표 > 서브 완료 > 서브 목표 > 새 의뢰 > 진행 안내 순서. */
export function talkTo(npc: NpcId, state: QuestState): TalkResult | undefined {
  const ordered = QUESTS.filter(q => !isSubPaused(q, state)).sort((a, b) => Number(!!b.main) - Number(!!a.main));
  const talkStep = (def: QuestDef): TalkResult => {
    const objective = currentObjective(def, state[def.id]);
    const next = advance(state, def, 1);
    const lines = objective.lines ? pickLines(objective.lines, objective.linesIf, state) : pickLines(def.target ?? [], def.targetIf, state);
    if (def.completeOnTarget && next[def.id]?.status === 'ready') return { ...finish(next, def, lines), stepDone: objective };
    return { lines, state: next, progressed: def, stepDone: objective };
  };
  const mainReady = ordered.find(q => q.main && reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (mainReady) return finish(state, mainReady, []);
  const mainTarget = ordered.find(q => q.main && state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).event === 'talk' && currentObjective(q, state[q.id]).npc === npc);
  if (mainTarget) return talkStep(mainTarget);
  const subReady = ordered.find(q => !q.main && reportTo(q) === npc && state[q.id]?.status === 'ready');
  if (subReady) return finish(state, subReady, []);
  const subTarget = ordered.find(q => !q.main && state[q.id]?.status === 'active' && currentObjective(q, state[q.id]).event === 'talk' && currentObjective(q, state[q.id]).npc === npc);
  if (subTarget) return talkStep(subTarget);
  const offer = ordered.find(q => q.giver === npc && canStart(q, state));
  if (offer) return { lines: offer.offer, state: { ...state, [offer.id]: { status: 'active', count: 0 } }, accepted: offer };
  const active = ordered.find(q => state[q.id]?.status === 'active'
    && (q.remindersByNpc?.[npc] !== undefined || q.giver === npc || reportTo(q) === npc));
  if (active) {
    const lines = active.remindersByNpc?.[npc] ?? (active.giver === npc ? active.reminder : undefined);
    if (lines?.length) return { lines, state };
  }
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
    if (isSubPaused(q, state)) continue;
    const o = currentObjective(q, state[q.id]);
    if (state[q.id]?.status !== 'active' || o.event !== event.type || event.type === 'talk') continue;
    if ('map' in event && o.map && o.map !== event.map) continue;
    if (event.type === 'kill' && (o.encounter !== event.encounter || (o.monster && o.monster !== event.monster))) continue;
    if (event.type === 'inspect' && o.spot !== event.spot) continue;
    next = advance(next, q, 1);
    updates.push({ quest: q, count: Math.min(o.need, state[q.id]!.count + 1), need: o.need, ready: next[q.id]!.status === 'ready' });
  }
  return { state: next, updates };
}

export function trackedQuests(state: QuestState): Array<{ quest: QuestDef; progress: QuestProgress }> {
  return QUESTS.filter(q => state[q.id] && state[q.id]!.status !== 'done' && !isSubPaused(q, state))
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
    // 목표 수를 바꿨을 때도 말이 되게 상태를 다시 맞춘다(다단계 중간 완료는 다음 단계로 넘긴다).
    if (status !== 'done' && clamped >= objective.need && def.steps && (step ?? 0) + 1 < def.steps.length) {
      state[def.id] = { status: 'active', count: 0, step: (step ?? 0) + 1 };
    } else {
      state[def.id] = { status: status === 'done' ? 'done' : clamped >= objective.need ? 'ready' : 'active', count: clamped, ...(step !== undefined ? { step } : {}) };
    }
  }
  return continueMainQuest(skipPassedTutorials(state));
}

/**
 * 전투 수련 퀘스트를 넣기 전의 저장: 이미 그보다 뒤의 메인 퀘스트를 받았으면 수련은 끝낸 것으로 친다.
 * (그러지 않으면 한창 진행 중인 사람에게 처음 수련이 다시 끼어든다.)
 */
export function skipPassedTutorials(state: QuestState): QuestState {
  const mains = QUESTS.filter((q) => q.main);
  let next = state;
  mains.forEach((q, i) => {
    if (!q.tutorial || next[q.id]?.status === 'done') return;
    if (!mains.slice(i + 1).some((later) => !later.tutorial && next[later.id])) return;
    const last = q.steps?.at(-1) ?? q.objective;
    next = { ...next, [q.id]: { status: 'done', count: last.need, ...(q.steps ? { step: q.steps.length - 1 } : {}) } };
  });
  return next;
}

export function serializeQuests(state: QuestState): string {
  return JSON.stringify({ version: QUEST_SAVE_VERSION, quests: state });
}
