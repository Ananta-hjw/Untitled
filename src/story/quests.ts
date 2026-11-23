import type { MonsterKind } from '../combat/monsterTypes.ts';
import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { NpcId, NamedNpcId } from '../world/npcs.ts';
import type { MapId } from '../world/maps.ts';
import type { ItemId } from '../items/inventory.ts';
import type { GearId } from '../items/equipment.ts';
import type { SkillId } from '../entities/skills.ts';

/**
 * 퀘스트 (docs/story-chapter1.md).
 *
 * 마을 사람에게 말을 걸면 퀘스트를 받고(!), 목표를 채운 뒤 다시 말을 걸면 완료한다(?).
 * 목표는 게임에서 일어나는 일(QuestEvent)을 센다. 다단계 목표와 조사·습격 이벤트는 chapterOne.ts 및 GameScene이 연결한다.
 * 보상은 경험치와 골드, 아이템이다. 장신구·무기 강화처럼 아직 없는 기능의 보상은 골드로 대신한다.
 * 이 파일은 Phaser를 쓰지 않아 tools/quests.test.mjs가 직접 불러 검사한다.
 */

export type QuestId = 'ruan-training' | 'ruan-dodge' | 'ruan-parry' | 'ruan-field' | 'eila-potion' | 'vernel-resonance'
  | 'ruan-forest' | 'doran-gel' | 'teon-lunch'
  | 'watch-report' | 'festival-supplies' | 'sia-knot' | 'harvest-help' | 'evening-patrol' | 'moth-trail'
  | 'festival-eve' | 'village-raid' | 'missing-sia' | 'sealed-letter' | 'first-sword'
  // 2장 (docs/story-chapter2.md, story/chapterTwo.ts)
  | 'fern-cart' | 'farewell';

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
export type InspectSpot = 'south-watch' | 'home-search' | 'moth-nest' | 'north-alley';

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
  /** 이 단계를 마치면 배우는 기술 (예: 떠날 채비에서 루안에게 배우는 회전 베기) */
  rewardSkill?: SkillId;
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
  /**
   * 초반 전투 수련(story/tutorial.ts). 예전 저장이 이미 이보다 뒤의 메인 퀘스트를 하고 있으면
   * 끝낸 것으로 친다(parseQuests). 다시 돌아가 배우게 하지 않는다.
   */
  tutorial?: boolean;
  confirm?: boolean;
  rewardXp: number;
  rewardGold?: number;
  rewardItems?: Array<{ id: ItemId; count: number }>;
  /** 보상 장비 (가방에 들어간다) */
  rewardGear?: GearId[];
  /** 보상 기술 (entities/skills.ts). 비어 있는 첫 기술 칸에 들어간다. */
  rewardSkill?: SkillId;
  offer: DialogueLine[];
  /** 진행 중에 퀘스트를 준 사람에게 말을 걸면 */
  reminder: DialogueLine[];
  /** 의뢰인과 보고 대상이 다를 때, 대화 상대 자신의 진행 안내. */
  remindersByNpc?: Partial<Record<NpcId, DialogueLine[]>>;
  /** talk 목표: 그 사람에게 말을 걸었을 때 */
  target?: DialogueLine[];
  done: DialogueLine[];
}

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const line = (npc: NamedNpcId, speaker: string, text: string): DialogueLine => ({ speaker, portrait: npc, text });
const ruan = (text: string) => line('ruan', '루안', text);
const fern = (text: string) => line('fern', '페른', text);

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
    done: [ruan('다치지 않고 돌아왔구나. 잘했다.')],
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
    done: [line('eila', '에일라', '잘했어. 한 병 더 챙겨 줄게. 물약은 아끼다 쓰러지면 소용없단다.')],
  },
  {
    id: 'vernel-resonance', title: '칼끝의 울림', giver: 'eila', main: true, requires: 'eila-potion', tutorial: true,
    turnIn: 'ruan',
    objective: { label: '광장의 베르넬에게 이야기 듣기', need: 1, event: 'talk', npc: 'vernel' },
    steps: [
      { label: '광장의 베르넬에게 이야기 듣기', need: 1, event: 'talk', npc: 'vernel', lines: [
        line('vernel', '베르넬', '루안에게 들었어. 칼로 공격을 받아낼 때 칼끝이 울린다고.'),
        line('vernel', '베르넬', '옛 기록에 그런 울림을 모아 몸에 두르는 검사들 얘기가 있어. 울림이 다섯 번 가득 차면, 잠깐 동안 더 세게 베고 덜 다친대.'),
        hero('그게 정말 돼요?'),
        line('vernel', '베르넬', '해 보면 알겠지. 마침 네 칼끝에 울림이 가득해 보이는데? 한번 끌어내 봐.'),
      ] },
      { label: '공명 써 보기', need: 1, event: 'resonance' },
    ],
    rewardXp: 20,
    offer: [line('eila', '에일라', '그러고 보니 베르넬이 너를 찾더구나. 칼끝의 울림이 어쩌고 하던데. 광장에 있을 거야.')],
    reminder: [line('eila', '에일라', '베르넬은 광장에 있을 거야.')],
    remindersByNpc: { vernel: [line('vernel', '베르넬', '울림을 끌어내 봐. 공명이라고 부르면 되겠군.')] },
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
    offer: [line('herman', '헤르만', '마침 잘 왔네. 일손이 필요하던 참이야.')],
    reminder: [line('herman', '헤르만', '도란에게 걸쇠를, 메리나에게 초를 받아 오게.')],
    done: [line('herman', '헤르만', '그런데 테온이 입구 쪽이 어수선하다더군. 해 지기 전에 한 번만 살펴봐 주겠나? 그다음엔 여관의 로제타에게 가 보게. 잔치 상을 차리고 있을 걸세.')],
  },
  {
    id: 'evening-patrol', title: '해 질 무렵의 순찰', giver: 'herman', main: true, requires: 'harvest-help', turnIn: 'teon',
    objective: { label: '마을 남쪽 입구의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'south-watch', map: 'village' },
    rewardXp: 20, rewardItems: [{ id: 'potion', count: 2 }],
    offer: [hero('남쪽 입구를 살펴보고 테온에게 알려 주자.')],
    reminder: [line('herman', '헤르만', '입구를 살핀 뒤 테온에게 알려 주게. 너무 늦진 말고.')],
    remindersByNpc: { teon: [line('teon', '테온', '남쪽 입구에 모인 나방 봤어? 먼저 흔적을 살펴보고 와 줘. 여기서 기다릴게.')] },
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
        line('teon', '테온', '북쪽으로 피하던 사람들이 아직 그 골목에 남아 있어. 시온, 그쪽을 막아 줘!'),
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
    reminder: [line('rosetta', '로제타', '길을 막는 권속부터 물리쳐 줘. 광장엔 아직 세레나와 에일라가 남아 있어!')],
    done: [ruan('더는 따라오지 않는구나… 사람들은 무사하니?'), hero('네. 하지만 시아가 안 보여요. 리네아도 다쳤고요.'), ruan('나는 조금 쉬어야겠다. 가족부터 찾아보렴. 혼자 너무 멀리 나가지는 말고.')],
  },
  {
    id: 'missing-sia', title: '돌아오지 않은 동생', giver: 'ruan', main: true, requires: 'village-raid',
    turnIn: 'eila', completeOnTarget: true,
    objective: { label: '마을 북쪽의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena' },
    steps: [
      { label: '마을 북쪽의 세레나에게 시아의 행방 묻기', need: 1, event: 'talk', npc: 'serena', lines: [line('serena', '세레나', '아직 돌아오지 않았어. 집에도 없더구나. 혹시 모르니 너도 한 번 봐 주겠니?')] },
      { label: '마을 북쪽 시온의 집 앞에서 시아의 흔적 살펴보기', need: 1, event: 'inspect', spot: 'home-search', map: 'village-north' },
      { label: '에일라에게 리네아의 상태 확인하기', need: 1, event: 'talk', npc: 'eila', lines: [line('eila', '에일라', '리네아가 눈은 떴지만, 몸속을 갉아먹는 기운이 남아 있어. 평범한 독도 아니고… 어떤 권능의 흔적 같구나. 상처를 치료해도 그 기운은 사라지지 않아.'), hero('그럼 고칠 방법을 찾아야겠네요. 시아도… 꼭 데려올 거예요.')] },
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
    done: [line('vernel', '베르넬', '가능성은 있어. 다만 무너진 길부터 조사해야 해. 내가 유적에 들어갈 준비를 알아볼게.'), hero('기다릴게요. 그동안 리네아와 마을 사람들을 돌봐야겠어요.'),
      line('vernel', '베르넬', '그러고 보니 도란이 너를 찾더군. 대장간 불이 밤새 꺼지지 않았어.')],
  },
  {
    id: 'first-sword', title: '도란의 검', giver: 'vernel', main: true, requires: 'sealed-letter',
    turnIn: 'doran', completeOnTarget: true,
    objective: { label: '대장간의 도란 찾아가기', need: 1, event: 'talk', npc: 'doran' },
    rewardXp: 20, rewardGear: ['iron-sword'],
    offer: [line('vernel', '베르넬', '대장간에 들러 보게. 도란은 말보다 망치가 먼저인 사람이니까.')],
    reminder: [line('vernel', '베르넬', '도란이 대장간에서 기다리고 있을 걸세.')],
    target: [
      line('doran', '도란', '왔냐. …앉아라, 아니 서 있어도 되고.'),
      line('doran', '도란', '앞으로도 그런 밤을 견디려면, 네 손에 맞는 검이 있어야지. 밤새 두들겼다. 받아라.'),
      hero('이걸… 저한테요?'),
      line('doran', '도란', '언젠가 네 검 한 자루 두들겨 주겠다고 했잖냐. 생각보다 일찍 오긴 했다만.'),
      line('doran', '도란', '시아 데려와라. 리네아도 고칠 방법 찾고. 날이 무뎌지면 언제든 돌아와서 맡겨.'),
    ],
    done: [line('doran', '도란', '장비 창에서 무기 칸에 끼워라. 손에 익을 때까지 휘둘러 보고.')],
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
        fern('…그리고 올라오다 검은 짐승 무리를 봤어. 누굴 호위하듯 줄을 맞춰 동쪽으로 가더라.'),
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
      { label: '광장의 루안에게 떠난다고 말하기', need: 1, event: 'talk', npc: 'ruan', rewardSkill: 'spin', lines: [
        hero('루안 선생님, 동쪽으로 가 보려고요. 시아를 데려간 그 무리가 그쪽으로 갔대요.'),
        ruan('…그럴 줄 알았다. 앉은 채로라 미안하다만, 하나만 가르쳐 주마.'),
        ruan('둘러싸였을 때 몸을 돌려 둘레를 한 번에 베는 법이다. 발을 디딘 채 허리로 돌아라.'),
        ruan('혼자 짊어지지 마라. 길에서 만나는 사람들에게 기대는 것도 실력이다.')] },
      { label: '마을 북쪽의 세레나에게 인사하기', need: 1, event: 'talk', npc: 'serena', lines: [
        line('serena', '세레나', '…가는구나. 말려도 소용없다는 거, 엄마가 제일 잘 알지.'),
        line('serena', '세레나', '시아를 데려와. 너도 꼭 돌아오고.')] },
      { label: '리네아에게 인사하기', need: 1, event: 'talk', npc: 'linea', lines: [
        line('linea', '리네아', '오늘부터 일지를 쓰려고. 에일라 선생님이 보기 편하게.'),
        line('linea', '리네아', '…다녀와. 시아한테, 언니가 기다린다고 전해 줘.')] },
      { label: '에일라에게 인사하기', need: 1, event: 'talk', npc: 'eila', lines: [
        line('eila', '에일라', '창조의 권능을 가진 치유사라면 리네아의 시간을 늦출 수 있을지 몰라. 교단에 그런 사람들이 있어.'),
        line('eila', '에일라', '…하지만 네 몸에서 힘을 꺼내 보겠다는 검사에는 절대 응하지 마. 약속해.'),
        hero('약속할게요. 리네아를 부탁드려요.')] },
      { label: '촌장 헤르만에게 인사하기', need: 1, event: 'talk', npc: 'herman', lines: [
        line('herman', '헤르만', '동쪽으로 간다고? 동문으로 나가 개울을 따라가면 고갯길이 나온다. 고개를 넘으면 큰 강가의 나루지.'),
        line('herman', '헤르만', '빈손으로 보낼 수야 없지. 마을 사람들이 조금씩 모은 여비다. 받아 두게.')] },
    ],
    rewardXp: 40, rewardGold: 100, rewardItems: [{ id: 'potion', count: 3 }],
    offer: [hero('…떠나기 전에, 다들에게 인사부터 해야겠어. 루안 선생님부터.')],
    reminder: [ruan('인사는 다 했느냐? 북쪽 사람들도 네 얼굴을 보고 싶어 할 거다.')],
    done: [line('herman', '헤르만', '로웬은 우리가 지키마. 너는 네 길을 가거라. 시아를 꼭 찾고.'), hero('다녀오겠습니다.')],
  },
  {
    id: 'doran-gel', title: '담금질 재료', giver: 'doran',
    objective: { label: '슬라임 처치 (점액 모으기)', need: 5, event: 'kill', monster: 'slime' },
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
    if (target.completeOnTarget && next[target.id]?.status === 'ready') return { ...finish(next, target, lines), stepDone: objective };
    return { lines, state: next, progressed: target, stepDone: objective };
  }
  const offer = ordered.find(q => q.giver === npc && canStart(q, state));
  if (offer) return { lines: offer.offer, state: { ...state, [offer.id]: { status: 'active', count: 0 } }, accepted: offer };
  const active = ordered.find(q => (q.giver === npc || reportTo(q) === npc) && state[q.id]?.status === 'active');
  if (active) {
    const lines = active.remindersByNpc?.[npc] ?? (active.giver === npc ? active.reminder : undefined);
    if (lines) return { lines, state };
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
