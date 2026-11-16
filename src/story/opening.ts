import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import type { NamedNpcId } from '../world/npcs.ts';
import { LINEA_YARD, PLAYER_SPAWN } from '../world/villageLayout.ts';
import type { QuestState } from './quests.ts';

/**
 * 오프닝: 새 게임을 처음 시작할 때 플레이어가 조작하기 전에 보여 주는 짧은 이야기(약 2분).
 * 수확제 전날 아침, 시온이 집을 나서 어머니 세레나, 촌장 헤르만, 시아와 리네아를 차례로 만나고
 * 루안이 찾는다는 말을 듣는 데서 끝난다. 장소는 마을 북쪽(시작 맵) 하나다.
 * 화면 오른쪽 위의 건너뛰기(또는 Esc·뒤로 가기)로 언제든 넘길 수 있다.
 * 이 파일은 Phaser를 쓰지 않아 tools/opening.test.mjs가 직접 불러 검사한다.
 * 실행은 scenes/OpeningDirector.ts가 한다.
 */

export interface Point { x: number; y: number }

export type OpeningStep =
  /** 화면을 검게 덮고 가운데에 글을 띄운다. 끝나면 화면이 밝아진다. */
  | { type: 'caption'; text: string; ms: number }
  /** 마지막: 화면이 어두워지며 글을 띄우고 연출을 마친다. */
  | { type: 'outro'; text: string; ms: number }
  | { type: 'wait'; ms: number }
  /** 시온이 경로를 따라 걷는다. 끝까지 걸어야 다음으로 넘어간다. */
  | { type: 'hero'; path: Point[] }
  /** 마을 사람을 그 자리로 옮겨 세운다(화면 밖에서 미리 자리 잡기). */
  | { type: 'place'; id: NamedNpcId; at: Point }
  /** 마을 사람이 경로를 따라 걷는다. wait이면 도착할 때까지 기다린다. */
  | { type: 'npc'; id: NamedNpcId; path: Point[]; wait?: boolean }
  /** 마을 사람이 시온 쪽을 본다. */
  | { type: 'face'; id: NamedNpcId }
  | { type: 'say'; lines: DialogueLine[] };

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const line = (id: NamedNpcId, speaker: string, text: string): DialogueLine => ({ speaker, portrait: id, text });

/** 시온이 연출 동안 걷는 빠르기 (평소 이동 속도에 대한 비율). 천천히 둘러보듯 걷는다. */
export const OPENING_WALK_SCALE = 0.5;

// 리네아의 집 지붕에 가리지 않도록 시온의 집 문 바로 앞에서 이야기한다.
const front = { x: PLAYER_SPAWN.x + 30, y: PLAYER_SPAWN.y + 15 };
const byHerman = { x: 1150, y: 640 };
const byLinea = { x: LINEA_YARD.x + 150, y: LINEA_YARD.y + 30 };

export const OPENING: OpeningStep[] = [
  { type: 'place', id: 'sia', at: { x: LINEA_YARD.x + 20, y: LINEA_YARD.y + 70 } },
  { type: 'place', id: 'linea', at: { x: LINEA_YARD.x - 30, y: LINEA_YARD.y + 10 } },
  { type: 'place', id: 'herman', at: { x: 1270, y: 600 } },
  { type: 'place', id: 'serena', at: { x: 720, y: 700 } },
  { type: 'caption', text: '로웬 마을\n수확제 전날 아침', ms: 2600 },
  { type: 'wait', ms: 500 },
  { type: 'hero', path: [front] },
  { type: 'say', lines: [hero('…벌써 해가 저만큼 떴네. 오늘이 축제 전날이었지.')] },
  { type: 'npc', id: 'serena', path: [{ x: front.x + 120, y: front.y + 10 }], wait: true },
  { type: 'face', id: 'serena' },
  { type: 'say', lines: [
    line('serena', '세레나', '시온, 이제 일어났니? 아침은 식탁에 차려 뒀어.'),
    hero('다녀와서 먹을게요. 시아는요?'),
    line('serena', '세레나', '새벽부터 리네아네 갔단다. 등불 장식을 같이 만든다더구나.'),
    line('serena', '세레나', '오늘 저녁은 축제 전야 잔치야. 해 지기 전엔 꼭 들어오렴.'),
    hero('네, 어머니.'),
  ] },
  { type: 'npc', id: 'serena', path: [{ x: 720, y: 700 }] },
  { type: 'hero', path: [{ x: 720, y: 690 }, { x: 1000, y: 700 }, byHerman] },
  { type: 'face', id: 'herman' },
  { type: 'say', lines: [
    line('herman', '헤르만', '오, 시온이구먼. 올해는 수확이 넉넉해서 잔치 상도 푸짐하겠어.'),
    line('herman', '헤르만', '저녁에 여관으로 다들 모이기로 했네. 늦지 말게.'),
    hero('네, 촌장님. 기대할게요.'),
  ] },
  { type: 'hero', path: [{ x: 1000, y: 760 }, { x: 860, y: 900 }, byLinea] },
  { type: 'face', id: 'sia' },
  { type: 'face', id: 'linea' },
  { type: 'say', lines: [
    line('sia', '시아', '오빠! 이제 일어났어? 해가 중천이야!'),
    hero('중천은 무슨. 아직 아침이거든.'),
    line('linea', '리네아', '시아가 새벽부터 와서 등불 종이를 다 오려 놨어. 나보다 더 신났다니까.'),
    line('sia', '시아', '당연하지! 올해는 내가 제일 예쁜 등불 띄울 거야.'),
    line('linea', '리네아', '오늘 밤 잔치 끝나면 셋이서 같이 등불 띄우자. 약속이야.'),
    line('sia', '시아', '약속! 오빠도!'),
    hero('그래, 약속.'),
    line('linea', '리네아', '아, 루안 아저씨가 너 찾으시던데. 광장 수련소에서 기다리신대. 축제 전 마지막 수련이라고.'),
    hero('벌써? …다녀올게.'),
    line('sia', '시아', '늦으면 또 잔소리 들을걸!'),
  ] },
  { type: 'outro', text: '축제 전날, 로웬의 하루가 시작된다.', ms: 2200 },
];

/** 연출이 끝난 뒤 처음 띄우는 안내 */
export const OPENING_HINT = '광장 수련소의 루안을 찾아가 보세요 · 마을 북쪽 아래 길로 광장에 갈 수 있어요';

export const OPENING_SAVE_KEY = 'untitled-rpg.opening';

/**
 * 오프닝을 보여 줄지: 처음 화면에서 새 게임을 시작했고(진행·퀘스트 저장이 없고) 아직 본 적이 없을 때.
 * 이미 하던 저장이 있으면 보여 주지 않는다.
 */
export function shouldPlayOpening(options: { fromTitle: boolean; hasProgress: boolean; quests: QuestState; seen: boolean }): boolean {
  return options.fromTitle && !options.hasProgress && Object.keys(options.quests).length === 0 && !options.seen;
}

/** 대사 줄 수 (테스트와 길이 어림에 쓴다) */
export function openingLineCount(): number {
  return OPENING.reduce((sum, step) => sum + (step.type === 'say' ? step.lines.length : 0), 0);
}
