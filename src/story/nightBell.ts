import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { OpeningStep, Point } from './opening.ts';
import { FERRY_RIVERBANK, FERRY_FOG_PATH, FERRY_SLEEPWALK_PATH } from './chapterTwo.ts';

/**
 * 2장 퀘스트 6 "밤의 종소리"의 두 연출 (docs/story-chapter2.md).
 *  - 여관의 밤(in-ferry-inn, 실내 원화 좌표): 종소리에 시온이 문 쪽으로 끌려가다 핀이 흔들어 깨우고,
 *    잠든 여관 주인이 문 밖으로 걸어 나간다. 끝나면 나루(밤)의 여관 문 앞으로 나간다.
 *  - 물가에서 깨어남(ferry-village): 시온이 여관 주인을 깨우면 발밑의 안개 길이 물로 풀리고,
 *    핀이 달려와 아버지를 끌어안는다.
 * 실행은 scenes/OpeningDirector.ts가 하고, 장면 효과(종소리·안개 길)와 인물의 장면 동작은 cue로 GameScene이 맡는다.
 * 이 파일은 Phaser를 쓰지 않아 tools/night-bell.test.mjs가 직접 불러 검사한다.
 */

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const finn = (text: string): DialogueLine => ({ speaker: '핀', portrait: 'finn', text });
const innkeeper = (text: string): DialogueLine => ({ speaker: '여관 주인', portrait: 'fog-innkeeper', text });

/** 여관의 밤: 시온이 앉아 있던 자리(오른쪽 난로 앞 탁자 아래), 핀이 밤을 새우는 자리, 여관 주인이 잠든 채 나서는 자리 */
export const INN_NIGHT = {
  hero: { x: 1030, y: 730 },
  finn: { x: 1190, y: 690 },
  innkeeper: { x: 560, y: 600 },
  /** 시온이 종소리에 끌려 문 쪽으로 몇 걸음 걷는 길 */
  heroDrift: [{ x: 930, y: 770 }],
  /** 핀이 달려와 시온의 소매를 붙잡는 자리 */
  finnGrab: { x: 1010, y: 790 },
  /** 잠든 여관 주인이 걸어 나가는 길: 깔개를 지나 문턱까지 (sleepwalk 빠르기 INN_SLEEPWALK_SPEED) */
  sleepwalk: [{ x: 700, y: 700 }, { x: 773, y: 840 }],
} as const satisfies Record<string, Point | readonly Point[]>;

/** 여관 안에서 잠든 걸음의 빠르기(NPC 걷기 빠르기 배율). 바깥의 긴 길(0.45)보다 빠르게 문까지 간다. */
export const INN_SLEEPWALK_SPEED = 0.9;
/** 연출 속 시온의 걸음 배율 (오프닝과 같다) */
export const NIGHT_BELL_WALK_SCALE = 0.5;

export const NIGHT_BELL_INN: OpeningStep[] = [
  { type: 'placeHero', at: INN_NIGHT.hero },
  { type: 'place', id: 'finn', at: INN_NIGHT.finn },
  { type: 'place', id: 'fog-innkeeper', at: INN_NIGHT.innkeeper },
  { type: 'cue', cue: 'finn-watch' },
  { type: 'caption', text: '그날 밤\n물안개 나루 여관', ms: 2600 },
  { type: 'wait', ms: 700 },
  { type: 'cue', cue: 'bell' },
  { type: 'wait', ms: 900 },
  { type: 'say', lines: [
    { speaker: '강 건너', text: '…댕—. 강 위에서 맑은 종소리가 울린다. 솜을 낀 귀 속까지 스며든다.' },
    hero('…종소리? 솜을 꼈는데도 들려…'),
    hero('(머리가 멍해. 누가 부르는 것 같아. 저 문 밖에서… 시아 목소리…?)'),
  ] },
  { type: 'hero', path: [...INN_NIGHT.heroDrift] },
  // 핀이 쪼그려 앉아 버티던 자세에서 일어나 달려온다(장면 동작을 풀어야 걷는다).
  { type: 'cue', cue: 'finn-up' },
  { type: 'npc', id: 'finn', path: [INN_NIGHT.finnGrab], wait: true, speed: 1.6 },
  { type: 'cue', cue: 'finn-wake' },
  { type: 'face', id: 'finn', to: 'hero' },
  { type: 'say', lines: [
    finn('형! 정신 차려! 졸면 끌려가!'),
    hero('…핀? 나, 방금 문 쪽으로…'),
    finn('솜으로는 소리가 작아질 뿐이야. 자면 그래도 끌려가. 그래서 난 밤에 안 자.'),
    finn('아빠를 지켜야 하니까.'),
  ] },
  { type: 'cue', cue: 'sleepwalk' },
  { type: 'wait', ms: 2200 },
  { type: 'cue', cue: 'finn-warn' },
  { type: 'say', lines: [
    finn('형… 아빠가, 아빠가 나가!'),
    hero('아저씨! …안 들리나 봐. 눈을 감은 채 걷고 있어.'),
  ] },
  { type: 'wait', ms: 1800 },
  { type: 'cue', cue: 'innkeeper-out' },
  { type: 'say', lines: [
    hero('핀, 여기 있어. 내가 따라갈게. (솜을 더 단단히 끼우자. 저 발걸음, 강 쪽이야.)'),
  ] },
  { type: 'outro', text: '잠든 여관 주인이 안개 속으로 걸어 나갔다.', ms: 2200 },
];

/** 물가 장면: 시온이 서는 자리, 핀이 달려오는 길 */
export const RIVER_WAKE = {
  hero: { x: FERRY_RIVERBANK.x - 80, y: FERRY_RIVERBANK.y + 20 },
  finnRun: [...FERRY_SLEEPWALK_PATH.slice(0, -1), { x: FERRY_RIVERBANK.x - 60, y: FERRY_RIVERBANK.y - 30 }],
  river: { x: FERRY_FOG_PATH.x + FERRY_FOG_PATH.length * 0.45, y: FERRY_FOG_PATH.y - 60 },
} as const;

export const RIVER_WAKE_STEPS: OpeningStep[] = [
  { type: 'placeHero', at: RIVER_WAKE.hero },
  // 연출의 검은 막은 자막이 끝날 때 걷힌다(OpeningDirector).
  { type: 'caption', text: '강둑 끝, 안개 길 앞', ms: 1400 },
  { type: 'cue', cue: 'fog-dissolve' },
  { type: 'wait', ms: 500 },
  { type: 'say', lines: [
    { speaker: '물가', text: '시온이 뒤에서 붙잡아 흔들자, 발밑의 안개가 스르르 물로 풀린다. 여관 주인의 발이 강물에 빠진다.' },
  ] },
  { type: 'cue', cue: 'inn-step-back' },
  { type: 'wait', ms: 800 },
  { type: 'cue', cue: 'inn-steady' },
  { type: 'say', lines: [
    innkeeper('…여기가 어디야? 내가 왜 강가에…'),
    hero('잠든 채 여기까지 걸어오셨어요. 안개 위에 발을 올리고 계셨어요.'),
    innkeeper('안개 위에…? 꿈에서 누가 날 불렀어. 강이 꼭 마당처럼 보였지…'),
  ] },
  { type: 'cue', cue: 'finn-run' },
  { type: 'npc', id: 'finn', path: [...RIVER_WAKE.finnRun], wait: true, speed: 2.2 },
  { type: 'cue', cue: 'hug' },
  { type: 'say', lines: [
    finn('아빠! 아빠…!'),
    innkeeper('…핀. 미안하다, 미안해.'),
  ] },
  { type: 'camera', to: RIVER_WAKE.river, ms: 1600 },
  { type: 'say', lines: [
    { speaker: '물가', text: '강 위로 흩어지는 안개를 시온은 오래 바라보았다.' },
    hero('(잠든 사람만 디딜 수 있는 길… 깨어 있는 사람에게는 그냥 물이야.)'),
  ] },
  { type: 'camera', to: 'hero', ms: 1200 },
];

/** 퀘스트 6을 마친 뒤 날이 밝으면 여관에서 다시 시작한다 */
export const NIGHT_BELL_MORNING = { title: '종소리가 울린 다음 날 아침', sub: '물안개 나루 여관' };
