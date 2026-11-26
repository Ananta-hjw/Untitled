import { mapPoint } from '../world/mapScale.ts';
import { HERO_NAME, type DialogueLine } from './dialogues.ts';
import { direction8, NPCS, type NamedNpcId, type NpcDef } from '../world/npcs.ts';
import { GUARDS } from '../world/guards.ts';
import { RAID_LEVELS } from '../combat/monsterLevel.ts';
import { chapterPhase } from './chapterOne.ts';
import type { QuestState } from './quests.ts';
import type { OpeningStep, Point } from './opening.ts';

/**
 * 1장 수확제 연출 (약 3분, 플레이어는 조작하지 않는다).
 * 로제타에게 잔치 준비가 됐다고 말하면(축제 전야 완료) 광장(village)으로 나가 이 연출을 본다:
 * 모닥불과 등불 줄 아래 잔치 → 헤르만의 건배 → 가족·친구·스승과의 이야기 → 하늘 등불 띄우기 →
 * 차가운 바람 → 남문으로 권속이 들어오고 → 사람들이 북쪽 마을(치유소·촌장의 집)로 피하고(세레나·에일라는 광장에 남아
 * 사람들을 이끌고 다친 사람을 살핀다) → 시온과 루안이 검을 든다. 여관과 대장간은 남쪽 입구에 가까워 피난처로 쓰지 않는다.
 * 끝나거나 건너뛰면 광장을 습격 상태로 다시 열어 첫 무리와 싸운다(꺼져 가는 등불 첫 단계).
 *
 * 연출 실행은 오프닝과 같은 scenes/OpeningDirector.ts, 모닥불·등불·경보 같은 그림은 scenes/FestivalStage.ts.
 * 이 파일은 Phaser를 쓰지 않아 tools/festival.test.mjs가 직접 불러 검사한다.
 */

/** 축제 연출을 아직 보지 않았는지 기기에 적어 두는 키: 'pending'(봐야 함) → 'seen' */
export const FESTIVAL_SAVE_KEY = 'untitled-rpg.festival';
/** 연출 동안 시온이 걷는 빠르기 (평소 이동 속도에 대한 비율) */
export const FESTIVAL_WALK_SCALE = 0.6;

/**
 * 광장에 들어올 때 축제 연출을 보여 줄지: 로제타와의 대화로 'pending'이 적혀 있고,
 * 습격이 막 시작된 상태(첫 무리를 하나도 쓰러뜨리지 않음)일 때만.
 * 앱을 껐다 켜도 아직 보지 않았으면 광장에 처음 들어갈 때 보여 준다.
 */
export function shouldPlayFestival(options: { map: string; quests: QuestState; saved: string | null }): boolean {
  const raid = options.quests['village-raid'];
  return options.map === 'village' && options.saved === 'pending' && chapterPhase(options.quests) === 'raid'
    && raid?.status === 'active' && (raid.step ?? 0) === 0 && raid.count === 0;
}

const P = (x: number, y: number): Point => mapPoint({ x, y });

/** 광장 한가운데 갈림길의 모닥불 (발 위치) */
export const BONFIRE = P(1180, 1180);
/** 잔칫상 두 개: 가운데 아래(앞)를 기준으로 너비·깊이 */
export const FEAST_TABLES: ReadonlyArray<{ x: number; y: number; w: number; d: number }> = [
  { ...P(930, 1120), w: 300, d: 70 },
  { ...P(1430, 1100), w: 300, d: 70 },
];
/** 등불 줄: 장대 사이에 처지게 건다 */
export const LANTERN_STRINGS: ReadonlyArray<readonly [Point, Point]> = [
  [P(780, 1010), P(1580, 1000)],
  [P(800, 1360), P(1560, 1360)],
];

/**
 * 권속이 남문 밖에서 문 사이로 들어와 서는 길. 마지막 자리는 남문 그림(망루·아치·수레)에 가리지 않는 곳이다.
 * 문 밖은 걸을 수 있는 곳이 아니지만 연출 속 그림이라 상관없다.
 */
export const FESTIVAL_RAIDERS: ReadonlyArray<{ key: 'corrosion-tracker'; level: number; path: Point[] }> = [
  { key: 'corrosion-tracker', level: RAID_LEVELS.tracker, path: [P(1170, 1780), P(1181, 1580), P(1185, 1300)] },
  { key: 'corrosion-tracker', level: RAID_LEVELS.tracker, path: [P(1150, 1840), P(1175, 1600), P(1290, 1395)] },
  { key: 'corrosion-tracker', level: RAID_LEVELS.tracker, path: [P(1210, 1900), P(1190, 1620), P(1390, 1380)] },
];
/** 권속이 문 밖에서 자리까지 걸어 들어오는 시간(게임 시계 ms) */
export const RAIDER_ENTRY_MS = 4200;

/** 잔치 자리: 모두 모닥불 쪽을 본다. 테온은 남문을 지킨다. */
const SEATS: Record<Exclude<NamedNpcId, 'fern'>, Point> = {
  herman: P(1180, 1010),
  // 오른쪽 잔칫상과 광장 표지판을 피해 상 뒤쪽에 선다.
  rosetta: P(1390, 1020),
  doran: P(1360, 1160),
  merina: P(1500, 1150),
  serena: P(900, 1170),
  sia: P(980, 1210),
  linea: P(1040, 1180),
  ruan: P(890, 1330),
  eila: P(1330, 1290),
  vernel: P(1260, 1330),
  teon: P(1340, 1450),
};

/** 시온이 연출을 시작하는 자리 (여관에서 나와 광장으로 들어선 곳) */
export const FESTIVAL_HERO_START = P(1460, 960);

/**
 * 연출 동안 광장에 서는 사람들: 마을 사람 열한 명 모두(가게 주인도 나와 있다)와 세 문의 문지기.
 * 순찰병은 잔치에 끼어 따로 그리지 않는다.
 */
export function festivalNpcs(): NpcDef[] {
  const people = NPCS.map((n): NpcDef => {
    const seat = SEATS[n.id as keyof typeof SEATS];
    const facing = n.id === 'teon' ? 'down' : direction8(BONFIRE.x - seat.x, BONFIRE.y - seat.y);
    const def: NpcDef = { ...n, ...seat, area: 'village', facing, wander: undefined };
    delete def.inside;
    delete def.talkOffset;
    delete def.talkOffsetX;
    delete def.shop;
    return def;
  });
  return [...people, ...GUARDS.filter((g) => g.area === 'village' && g.gate)];
}

const hero = (text: string): DialogueLine => ({ speaker: HERO_NAME, portrait: 'hero-neutral', text });
const line = (id: NamedNpcId, speaker: string, text: string): DialogueLine => ({ speaker, portrait: id, text });
const crowd = (text: string): DialogueLine => ({ speaker: '마을 사람들', text });

/** 모닥불 둘레를 한 바퀴 도는 길 (시아와 리네아가 뛰어다닌다) */
function aroundFire(radius: number, start: number, steps = 8): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = start + (i / steps) * Math.PI * 2;
    return P(1180 + Math.cos(a) * radius, 1180 + Math.sin(a) * radius * 0.6);
  });
}

const fire = BONFIRE;
const gate = P(1260, 1390);

export const FESTIVAL: OpeningStep[] = [
  { type: 'placeHero', at: FESTIVAL_HERO_START },
  { type: 'caption', text: '수확제 전야\n로웬 마을 광장', ms: 2800 },
  // 잔치: 모닥불 둘레의 사람들
  { type: 'camera', to: { x: fire.x, y: fire.y - 60 }, ms: 2600 },
  { type: 'emote', who: 'sia', text: '♪' },
  { type: 'emote', who: 'doran', text: '♪' },
  { type: 'face', id: 'doran', to: 'rosetta' },
  { type: 'face', id: 'rosetta', to: 'doran' },
  { type: 'say', lines: [
    line('rosetta', '로제타', '자, 국 식기 전에 한 그릇씩! 오늘은 냄비 바닥이 보일 때까지 끓일 거야.'),
    line('doran', '도란', '로제타, 그 말 작년에도 했지. 결국 내가 냄비 두 개를 더 빌려 왔고.'),
    line('merina', '메리나', '그 냄비, 아직 우리 가게에 있어요. 도란 씨 이름 붙여서 잘 보관 중이에요.'),
    line('doran', '도란', '…그건 내년 잔치 때 쓰자고.'),
  ] },
  { type: 'emote', who: 'merina', text: '…' },
  { type: 'camera', to: 'hero', ms: 1400 },
  // 광장의 표지판 위쪽(그림 꼭대기보다 북쪽)으로 돌아 헤르만에게 간다.
  // 곧장 가면 표지판 받침에 걸리고, 표지판과 오른쪽 잔칫상 사이로 가면 로제타 자리를 가로지른다.
  { type: 'hero', path: [P(1392, 878), P(1250, 880), P(1240, 1030)] },
  // 헤르만의 건배
  { type: 'face', id: 'herman' },
  { type: 'face', id: 'rosetta', to: 'herman' },
  { type: 'face', id: 'doran', to: 'herman' },
  { type: 'say', lines: [
    line('herman', '헤르만', '오, 시온이 왔구먼. 이제 다 모였군. 다들 잔 들게! 짧게 하겠네.'),
    line('herman', '헤르만', '올해는 강물도 넘치지 않았고, 다친 사람 없이 다 거둬들였어. 모두 수고했네.'),
    line('herman', '헤르만', '로웬을 위하여!'),
    crowd('로웬을 위하여!'),
  ] },
  { type: 'emote', who: 'herman', text: '!' },
  { type: 'emote', who: 'doran', text: '♪' },
  { type: 'emote', who: 'sia', text: '♪' },
  { type: 'emote', who: 'rosetta', text: '♪' },
  { type: 'cue', cue: 'cheer' },
  { type: 'wait', ms: 900 },
  { type: 'say', lines: [
    line('doran', '도란', '그리고 바람에도 안 떨어지는 내 걸쇠를 위하여!'),
    line('merina', '메리나', '도란 씨, 작년 얘기 꺼내기 전에 그만 마셔요.'),
    line('herman', '헤르만', '허허, 오늘만큼은 봐주게. 일 년 내내 고생했잖나.'),
  ] },
  // 가족과 리네아
  // 왼쪽 잔칫상 앞쪽으로 내려와 가족에게 간다(상 뒤로 지나가면 상에 가린다).
  { type: 'hero', path: [P(1110, 1080), P(1095, 1140), P(1010, 1140)] },
  { type: 'face', id: 'serena' },
  { type: 'face', id: 'sia' },
  { type: 'face', id: 'linea' },
  { type: 'say', lines: [
    line('serena', '세레나', '시온, 이쪽에 앉으렴. 네 몫은 따로 덜어 놨어.'),
    hero('역시 어머니밖에 없어요.'),
    line('sia', '시아', '오빠 늦었어! 그래도 등불 하나는 오빠 거로 남겨 놨어.'),
    line('linea', '리네아', '시아가 네 등불에는 제일 삐뚤어진 종이를 붙였대.'),
    line('sia', '시아', '아니거든! …조금 삐뚤어진 거야.'),
    hero('삐뚤어진 게 더 높이 날아갈지도 모르지.'),
  ] },
  { type: 'emote', who: 'sia', text: '♪' },
  { type: 'npc', id: 'sia', path: aroundFire(135, Math.PI * 0.75), speed: 1.6 },
  { type: 'npc', id: 'linea', path: [P(1080, 1210), ...aroundFire(155, Math.PI * 0.8)], speed: 1.45 },
  { type: 'wait', ms: 1600 },
  { type: 'face', id: 'serena', to: 'sia' },
  { type: 'say', lines: [
    line('serena', '세레나', '저 녀석, 하루 종일 등불 얘기만 했단다.'),
    hero('리네아까지 같이 뛰네요.'),
    line('serena', '세레나', '둘이 저렇게 웃는 걸 보니 좋구나. 너도 오늘은 검 생각 말고 쉬렴.'),
  ] },
  // 스승 루안
  { type: 'hero', path: [P(1000, 1220), P(960, 1320)] },
  { type: 'face', id: 'ruan' },
  { type: 'say', lines: [
    line('ruan', '루안', '오늘 수련, 끝까지 잘 버텼다. 마지막 베기는 제법이더구나.'),
    hero('스승님이 칭찬을 다 하시네요.'),
    line('ruan', '루안', '칭찬은 오늘만이다. 내일부터는 다시 기본부터지.'),
    line('ruan', '루안', '…시온. 검은 지킬 것이 생길 때 무거워진다. 오늘 이 광장을 잘 봐 두렴.'),
    hero('네. 잊지 않을게요.'),
  ] },
  // 베르넬과 에일라
  { type: 'hero', path: [P(1080, 1360), P(1160, 1330)] },
  { type: 'face', id: 'vernel' },
  { type: 'face', id: 'eila' },
  { type: 'say', lines: [
    line('vernel', '베르넬', '등불을 띄우는 풍습은 아주 오래됐어. 옛 기록엔 길 잃은 사람을 집으로 부르는 신호였다더군.'),
    line('eila', '에일라', '그러니 오늘은 모두 집으로 무사히 돌아가야지. 과식한 사람은 내일 치유소로 오고.'),
    hero('도란 아저씨 얘기죠?'),
    line('eila', '에일라', '이름은 말 안 했어.'),
  ] },
  { type: 'emote', who: 'hero', text: '♪' },
  // 남문의 테온
  { type: 'hero', path: [P(1300, 1300), P(1330, 1360)] },
  { type: 'face', id: 'teon' },
  { type: 'say', lines: [
    hero('테온, 오늘도 문 지키는 거야?'),
    line('teon', '테온', '누군가는 지켜야지. 대신 국은 꼭 남겨 줘.'),
    hero('도란 아저씨보다 먼저 떠 올게.'),
    line('teon', '테온', '하하, 그럼 서둘러야겠는데.'),
  ] },
  // 하늘 등불 (모닥불 남쪽 바깥을 돌아 도착한 뒤 함께 띄운다)
  { type: 'npc', id: 'sia', path: [P(1220, 1285), P(990, 1275)], speed: 1.5 },
  { type: 'npc', id: 'linea', path: [P(1240, 1295), P(1130, 1295)], speed: 1.5, wait: true },
  { type: 'face', id: 'teon', to: P(1181, 1650) },
  { type: 'hero', path: [P(1100, 1250), P(1050, 1320)] },
  { type: 'face', id: 'sia' },
  { type: 'face', id: 'linea' },
  { type: 'say', lines: [
    line('linea', '리네아', '시온, 시아! 이제 띄울 시간이야.'),
    line('sia', '시아', '다 같이! 하나, 둘…'),
  ] },
  { type: 'cue', cue: 'lanterns' },
  { type: 'camera', to: { x: fire.x, y: fire.y - 220 }, ms: 2400 },
  { type: 'wait', ms: 3200 },
  { type: 'say', lines: [
    line('sia', '시아', '어? 내 건 아직 불이 안 붙었어… 다들 먼저 올라가 버렸잖아!'),
    line('linea', '리네아', '괜찮아, 금방 붙을 거야. …내년에도 이렇게 셋이서 띄우자.'),
    hero('그래. 내년에도, 그다음 해에도.'),
  ] },
  { type: 'wait', ms: 1200 },
  // 차가운 바람
  { type: 'cue', cue: 'wind' },
  { type: 'wait', ms: 1600 },
  { type: 'emote', who: 'hero', text: '…?' },
  { type: 'emote', who: 'linea', text: '…' },
  { type: 'say', lines: [
    hero('…방금, 바람이 차가워졌어.'),
    line('linea', '리네아', '등불들이… 한꺼번에 흔들려.'),
  ] },
  // 습격
  { type: 'cue', cue: 'alarm' },
  { type: 'camera', to: { x: gate.x, y: gate.y - 40 }, ms: 1300 },
  { type: 'cue', cue: 'raiders' },
  { type: 'npc', id: 'teon', path: [P(1290, 1300), P(1270, 1250)], speed: 1.3 },
  { type: 'wait', ms: 3600 },
  { type: 'emote', who: 'teon', text: '!' },
  { type: 'say', lines: [
    line('teon', '테온', '남쪽 입구다! 권속이야! 모두 북쪽으로 물러서!'),
  ] },
  { type: 'camera', to: 'hero', ms: 1100 },
  { type: 'say', lines: [
    line('herman', '헤르만', '북쪽 마을로! 내 집과 치유소 문을 열어 두겠네. 아이들과 노인부터!'),
    line('rosetta', '로제타', '여관은 입구랑 너무 가까워! 다들 북쪽 길로, 어서!'),
    line('eila', '에일라', '다친 사람은 나한테! 걸을 수 있으면 치유소로 가!'),
  ] },
  { type: 'npc', id: 'herman', path: [P(1250, 960), P(1220, 760), P(1180, 620), P(1170, 430)], speed: 1.3 },
  // 표지판·오른쪽 잔칫상 바깥을 돌아 북쪽 길로 대피한다.
  { type: 'npc', id: 'rosetta', path: [P(1380, 920), P(1280, 810), P(1200, 620), P(1190, 430)], speed: 1.5 },
  { type: 'npc', id: 'merina', path: [P(1510, 1200), P(1635, 1185), P(1625, 990), P(1380, 850), P(1230, 620), P(1210, 440)], speed: 1.5 },
  { type: 'npc', id: 'vernel', path: [P(1420, 1250), P(1640, 1180), P(1620, 960), P(1300, 760), P(1220, 450)], speed: 1.5 },
  { type: 'npc', id: 'eila', path: [P(1450, 1250), P(1540, 1200)], speed: 1.2 },
  { type: 'npc', id: 'serena', path: [P(1000, 1260), P(1450, 1250), P(1500, 1110)], speed: 1.3 },
  { type: 'face', id: 'sia', to: 'hero' },
  { type: 'say', lines: [
    line('linea', '리네아', '시아는 내가 데리고 갈게! 북쪽 집으로 피할게!'),
    hero('리네아, 시아 부탁해!'),
    line('sia', '시아', '오빠도… 꼭 와야 해!'),
    line('sia', '시아', '내 등불은… 나중에 같이 띄우자.'),
  ] },
  // 중앙 큰 나무 왼쪽으로 돌아 북쪽 길로 대피한다.
  { type: 'npc', id: 'linea', path: [P(1075, 1150), P(1085, 970), P(1095, 810), P(1170, 650), P(1180, 540)], speed: 1.6 },
  { type: 'npc', id: 'sia', path: [P(1055, 1170), P(1065, 980), P(1080, 815), P(1155, 650), P(1170, 540)], speed: 1.6 },
  { type: 'wait', ms: 1400 },
  // 검을 든다
  { type: 'npc', id: 'ruan', path: [P(1030, 1240)], speed: 1.3, wait: true },
  { type: 'face', id: 'ruan' },
  { type: 'face', id: 'doran', to: 'hero' },
  { type: 'say', lines: [
    line('doran', '도란', '대장간은 그냥 둬! 나는 치유소 문을 지키지. 시온, 무리하지 마라!'),
  ] },
  { type: 'npc', id: 'doran', path: [P(1290, 1120), P(1280, 920), P(1220, 720), P(1180, 440)], speed: 1.4 },
  { type: 'say', lines: [
    line('ruan', '루안', '시온, 검을 들어라. 수련한 대로만 하면 된다.'),
    hero('…네.'),
    line('ruan', '루안', '나와 길을 열자! 사람들부터 안전한 곳으로 보내는 거다.'),
    hero('아무도… 다치게 두지 않을 거야.'),
  ] },
  { type: 'cue', cue: 'ready' },
  { type: 'face', id: 'ruan', to: P(1185, 1300) },
  { type: 'face', id: 'teon', to: P(1185, 1300) },
  { type: 'hero', path: [P(1090, 1200), P(1120, 1250)] },
  // 마지막 장면: 검을 든 시온과 루안, 테온 앞으로 다가오는 권속
  { type: 'camera', to: P(1170, 1180), ms: 1300 },
  { type: 'wait', ms: 900 },
  { type: 'outro', text: '꺼져 가는 등불', ms: 2600 },
];

/** 대사 줄 수 (테스트와 길이 어림에 쓴다) */
export function festivalLineCount(): number {
  return FESTIVAL.reduce((sum, step) => sum + (step.type === 'say' ? step.lines.length : 0), 0);
}
