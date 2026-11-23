import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { DialogueLine } from './dialogues.ts';
import { currentObjective, questDef, type QuestState } from './quests.ts';
import { GUARDS, isGuardId } from '../world/guards.ts';
import { NPCS, type Direction8, type DutyPoint, type NamedNpcId, type NpcDef, type NpcId } from '../world/npcs.ts';
import { INTERIORS, interiorArtPoint, type InteriorId } from '../world/interiors.ts';
import type { MapId } from '../world/maps.ts';
import type { Interactable } from '../world/interactables.ts';
import { BUILDINGS, LINEA_YARD } from '../world/villageLayout.ts';
import { fieldPoint } from '../world/maps.ts';
import { RAID_LEVELS } from '../combat/monsterLevel.ts';

export type ChapterPhase = 'day' | 'raid' | 'aftermath';

/** 장면과 NPC 상태는 별도 저장 대신 완료한 퀘스트에서 복원한다. */
export function chapterPhase(state: QuestState): ChapterPhase {
  if (state['village-raid']?.status === 'done') return 'aftermath';
  return state['festival-eve']?.status === 'done' ? 'raid' : 'day';
}

/**
 * 습격의 밤에 마을 사람들이 있는 곳. 여관과 대장간은 남쪽 입구에 가까워, 사람들은 북쪽 마을로 피해
 * 치유소와 촌장의 집에 들어가 있다. 밖에도 몇 명 남아 있다: 광장에서는 세레나가 피하는 사람들을 이끌고
 * 에일라가 다친 사람을 살피며(습격 퀘스트의 대화 상대), 북쪽에서는 헤르만이 자기 집 앞, 도란이 치유소 문 앞을 지킨다.
 * 루안과 테온은 광장에서 싸운다. 시아와 리네아는 보이지 않는다(이야기). 실내는 원화 픽셀 좌표(room).
 * 습격이 진행되면 자리를 옮긴다(RAID_MOVES): 시온이 안전을 확인하면 세레나는 북쪽 치유소로 피하고,
 * 북쪽 길의 무리를 막으면 에일라도 다친 사람들(골목에서 업어 온 리네아)과 함께 치유소로 간다.
 */
type RaidPlace = { map: MapId; x: number; y: number; facing?: Direction8 } | { map: MapId; room: InteriorId; x: number; y: number; facing?: Direction8 };
const RAID_PLACES: Partial<Record<NamedNpcId, RaidPlace>> = {
  ruan: { map: 'village', ...mapPoint({ x: 1080, y: 1150 }) },
  teon: { map: 'village', ...mapPoint({ x: 1340, y: 1450 }) },
  serena: { map: 'village', x: mapLength(1500), y: mapLength(1100) },
  eila: { map: 'village', x: mapLength(1540), y: mapLength(1200) },
  herman: { map: 'village-north', ...mapPoint({ x: 1290, y: 600 }), facing: 'down' },
  doran: { map: 'village-north', ...mapPoint({ x: 2090, y: 600 }), facing: 'down' },
  rosetta: { map: 'in-clinic', room: 'clinic', x: 560, y: 640, facing: 'left' },
  merina: { map: 'in-clinic', room: 'clinic', x: 930, y: 650, facing: 'down' },
  vernel: { map: 'in-chief', room: 'chief', x: 860, y: 540, facing: 'down' },
};
/** 습격 단계(village-raid의 step)가 이 값 이상이면 옮겨 간 자리 */
const RAID_MOVES: Partial<Record<NamedNpcId, { fromStep: number; place: RaidPlace }>> = {
  // 세레나 안전 확인(step 3)을 마치면
  serena: { fromStep: 4, place: { map: 'in-clinic', room: 'clinic', x: 600, y: 560, facing: 'left' } },
  // 북쪽 길의 무리와 집행자(step 4)를 막으면
  eila: { fromStep: 5, place: { map: 'in-clinic', room: 'clinic', x: 850, y: 560, facing: 'left' } },
};

function raidPlace(id: NamedNpcId, step: number): RaidPlace | undefined {
  const move = RAID_MOVES[id];
  return move && step >= move.fromStep ? move.place : RAID_PLACES[id];
}

/** 습격 중 이 맵에 있을 사람: 그 맵의 병사들과 RAID_PLACES에서 이 맵에 있는 마을 사람들 */
function raidNpcs(base: readonly NpcDef[], map: MapId, step: number): NpcDef[] {
  const guards = base.filter((n) => isGuardId(n.id)).map((n) => ({ ...n, wander: undefined }));
  const people = NPCS.flatMap((n): NpcDef[] => {
    const place = raidPlace(n.id as NamedNpcId, step);
    if (!place || place.map !== map) return [];
    const def: NpcDef = { ...n, x: place.x, y: place.y, wander: undefined, ...(place.facing ? { facing: place.facing } : {}) };
    if ('room' in place) {
      const at = interiorArtPoint(INTERIORS.find((i) => i.id === place.room)!, place.x, place.y);
      return [{ ...def, ...at, inside: place.room, talkOffset: 0 }];
    }
    delete def.inside;
    delete def.talkOffset;
    return [{ ...def, area: map === 'village-north' ? 'village-north' : 'village' }];
  });
  return [...guards, ...people];
}

/**
 * 습격 뒤 마을 사람들이 맡은 일: 복구·치료·경계. 자리들을 차례로 오가며 멈춘 동안 머리 위에 하는 일을 띄운다(NpcDef.duty).
 * 다친 루안과 기운이 없는 리네아는 제자리에 있고, 가게 주인들은 가게를 다시 연다. 좌표는 옛 배치 기준(mapPoint).
 */
const duty = (label: string, ...points: Array<[number, number]>): DutyPoint[] =>
  points.map(([x, y]) => ({ ...mapPoint({ x, y }), label }));
export const AFTERMATH_DUTIES: Partial<Record<NpcId, DutyPoint[]>> = {
  herman: [...duty('마을 살피는 중', [1290, 600]), ...duty('부서진 곳 살피는 중', [1150, 1080]), ...duty('사람들 다독이는 중', [1450, 1180])],
  serena: [...duty('리네아 간호 중', [764, 1020]), ...duty('물 길어 오는 중', [740, 680]), ...duty('집 정리하는 중', [480, 650]), ...duty('널어 둔 이불 걷는 중', [700, 640])],
  eila: [...duty('리네아 치료 중', [754, 930]), ...duty('다친 사람 살피는 중', [1300, 1000]), ...duty('약초 챙기는 중', [1930, 600])],
  'guard-homes-west': duty('경계 중', [980, 760], [900, 1200], [1350, 1250]),
  'guard-homes-east': duty('경계 중', [1900, 1160], [2300, 1100], [2250, 800], [1800, 800]),
  // 2장부터 남문 오른쪽 위에 페른의 수레가 서므로(story/chapterTwo.ts) 그 자리를 비켜 다닌다.
  teon: duty('남문 경계 중', [1340, 1450], [1050, 1420], [1300, 1300]),
  vernel: duty('권속 흔적 조사 중', [1200, 1330], [1350, 1250], [1300, 1450]),
  'guard-plaza-west': duty('울타리 고치는 중', [950, 1400], [1300, 1360]),
  'guard-plaza-east': duty('경계 중', [1550, 930], [1700, 1250], [1250, 1250], [1250, 950]),
};

/** 맡은 일이 있으면 그 첫 자리에서 시작해 자리들을 오간다. */
function withDuty(n: NpcDef): NpcDef {
  const points = AFTERMATH_DUTIES[n.id];
  return points ? { ...n, x: points[0].x, y: points[0].y, wander: undefined, duty: points } : n;
}

export function chapterNpcs(base: readonly NpcDef[], state: QuestState, map?: MapId): NpcDef[] {
  const phase = chapterPhase(state);
  if (phase === 'day') return [...base];
  if (phase === 'raid' && map !== undefined) return raidNpcs(base, map, state['village-raid']?.step ?? 0);
  const evacuated = ['serena', 'eila', 'herman'];
  let source = phase === 'raid' && map === 'village'
    ? [...base, ...NPCS.filter(n => evacuated.includes(n.id) && !base.some(b => b.id === n.id))]
    : phase === 'raid' && map === 'village-north' ? base.filter(n => !evacuated.includes(n.id)) : base;
  // 에일라는 낮에는 치유소 안에 있지만, 습격 때는 광장, 습격 뒤에는 리네아 곁(마을 북쪽)에 있다.
  if (map !== undefined) {
    source = source.filter(n => n.id !== 'eila' || (phase === 'raid' && map === 'village'));
    if (phase === 'aftermath' && map === 'village-north') source = [...source, NPCS.find(n => n.id === 'eila')!];
  }
  const placed = source.filter(n => n.id !== 'sia' && !(phase === 'raid' && n.id === 'linea')).map(n => {
    if (n.id === 'eila') {
      const outside: NpcDef = { ...n, area: phase === 'raid' ? 'village' : 'village-north', x: phase === 'raid' ? mapLength(1540) : LINEA_YARD.x + mapLength(130), y: phase === 'raid' ? mapLength(1200) : LINEA_YARD.y, wander: undefined };
      delete outside.inside;
      delete outside.talkOffset;
      return outside;
    }
    if (n.inside) return { ...n };
    if (n.id === 'ruan') return { ...n, ...mapPoint({ x: 1080, y: 1150 }), wander: undefined };
    if (n.id === 'serena') return { ...n, x: phase === 'raid' ? mapLength(1500) : LINEA_YARD.x + mapLength(140), y: phase === 'raid' ? mapLength(1100) : LINEA_YARD.y + mapLength(90), wander: undefined };
    if (n.id === 'linea') return { ...n, ...LINEA_YARD, wander: undefined };
    return { ...n, wander: undefined };
  });
  return phase === 'aftermath' ? placed.map(withDuty) : placed;
}

const SPOTS = {
  'south-watch': { id: 'story-south-watch', ...mapPoint({ x: 1180, y: 1340 }), radius: 95, markerHeight: 55 },
  'home-search': { id: 'story-home-search', ...mapPoint({ x: 415, y: 640 }), radius: 85, markerHeight: 55 },
  // 해 질 무렵 남쪽 들판: 나방이 모여 앉았던 풀숲
  'moth-nest': { id: 'story-moth-nest', ...fieldPoint(1250, 860), radius: 95, markerHeight: 55 },
  // 습격 중 마을 북쪽: 리네아의 집 옆 골목
  'north-alley': { id: 'story-north-alley', x: LINEA_YARD.x + mapLength(120), y: LINEA_YARD.y + mapLength(70), radius: 95, markerHeight: 55 },
} satisfies Record<string, Interactable>;

export function chapterSpots(state: QuestState, map: MapId): Interactable[] {
  return Object.values(SPOTS).filter((spot: Interactable) => Object.entries(state).some(([id, p]) => {
    const objective = currentObjective(questDef(id as Parameters<typeof questDef>[0]), p);
    return p.status === 'active' && objective.event === 'inspect' && objective.map === map && `story-${objective.spot}` === spot.id;
  }));
}

export const INSPECTION_LINES: Record<string, DialogueLine[]> = {
  'story-south-watch': [
    { speaker: '시온', portrait: 'hero-neutral', text: '잿빛 나방이 이렇게 많이 모여 있네. 가까이 가도 날아가지 않아… 테온에게 알려 줘야겠어.' },
  ],
  'story-moth-nest': [
    { speaker: '시온', portrait: 'hero-neutral', text: '나방이 앉아 있던 풀이 잿빛으로 바스러져 있어. 불에 탄 것도 아닌데… 만지기만 해도 가루가 돼.' },
  ],
  'story-north-alley': [
    { speaker: '시온', portrait: 'hero-neutral', text: '리네아의 등불이 깨진 채 떨어져 있어. 그 옆에… 시아의 머리끈.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '둘이 여기 있었던 거야. 다친 사람은 치유소로 옮긴다고 했지. 에일라라면 알 거야.' },
  ],
  'story-home-search': [
    { speaker: '시온', portrait: 'hero-neutral', text: '시아야? …대답이 없어. 집 안이 엉망이야… 시아가 다녀갔는지도 모르겠어.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '리네아라면 마지막으로 시아를 봤을 텐데… 에일라에게 가 보자.' },
  ],
};

/**
 * 해 질 무렵: "해 질 무렵의 순찰"을 받은 뒤부터 축제 전야가 시작되기 전까지
 * 남쪽 들판에 잿빛 나방(소멸의 하급 권속)이 나타난다. 습격 전에 네이룬 계열을 처음 마주하는 복선이다.
 * 좌표는 남쪽 들판 원화 기준(maps.ts의 fieldPoint로 바꾼다). 마을에는 몬스터를 두지 않는다.
 */
export const DUSK_MOTH_POINTS: ReadonlyArray<readonly [number, number]> = [[860, 720], [1500, 760], [1250, 980], [700, 950]];

export function isDusk(state: QuestState): boolean {
  return !!state['evening-patrol'] && chapterPhase(state) === 'day';
}

export interface RaidSpawn {
  x: number; y: number;
  key: 'corrosion-tracker' | 'corrosion-executioner' | 'ashen-moth';
  level: number;
  /** 1장 보스: 경고를 띄운 뒤 나타나고, 화면 위에 체력 막대가 따로 보인다 */
  boss?: true;
}

const inn = BUILDINGS.find((b) => b.frame === 'inn')!.door;
const tracker = (x: number, y: number): RaidSpawn => ({ x, y, key: 'corrosion-tracker', level: RAID_LEVELS.tracker });
const moth = (x: number, y: number): RaidSpawn => ({ x, y, key: 'ashen-moth', level: RAID_LEVELS.moth });
const executioner = (x: number, y: number): RaidSpawn => ({ x, y, key: 'corrosion-executioner', level: RAID_LEVELS.executioner, boss: true });
const yard = (dx: number, dy: number) => ({ x: LINEA_YARD.x + mapLength(dx), y: LINEA_YARD.y + mapLength(dy) });

/**
 * 습격의 세 무리 (꺼져 가는 등불의 전투 단계): 남쪽 입구 → 여관 앞 골목 → 마을 북쪽 길.
 * 한 무리는 차례로 나오는 몇 개의 떼(groups)로 이루어진다. 앞 떼를 다 쓰러뜨려야 다음 떼가 나온다.
 * 북쪽 길은 추적자 넷과 잿빛 나방 넷을 먼저 막고, 그다음 1장 보스 부식의 집행자가 경고와 함께 나타난다.
 */
export const RAID_WAVES: Array<{ step: number; map: MapId; groups: RaidSpawn[][] }> = [
  { step: 0, map: 'village', groups: [[
    tracker(mapLength(1180), mapLength(1320)), tracker(mapLength(1310), mapLength(1220)), tracker(mapLength(1460), mapLength(1130)),
    tracker(mapLength(980), mapLength(1380)), tracker(mapLength(1390), mapLength(1360)), tracker(mapLength(1600), mapLength(1280)),
  ]] },
  { step: 2, map: 'village', groups: [[tracker(inn.x - mapLength(260), inn.y + mapLength(30)), tracker(inn.x + mapLength(180), inn.y + mapLength(40)), tracker(inn.x - mapLength(90), inn.y + mapLength(45))]] },
  { step: 4, map: 'village-north', groups: [
    [tracker(yard(260, 90).x, yard(260, 90).y), tracker(yard(120, 170).x, yard(120, 170).y), tracker(yard(400, 150).x, yard(400, 150).y), tracker(yard(520, 40).x, yard(520, 40).y),
      moth(yard(200, -40).x, yard(200, -40).y), moth(yard(380, -30).x, yard(380, -30).y), moth(yard(60, 110).x, yard(60, 110).y), moth(yard(560, 170).x, yard(560, 170).y)],
    [executioner(yard(380, -20).x, yard(380, -20).y)],
  ] },
];

/** 그 무리에서 쓰러뜨려야 하는 수 (퀘스트 목표 수와 같다) */
export function raidWaveSize(step: number): number {
  return RAID_WAVES.find((w) => w.step === step)?.groups.reduce((n, g) => n + g.length, 0) ?? 0;
}

/** 습격 중 이 맵에 나올 수 있는 모든 권속 (그림을 미리 읽어 두려고 쓴다). */
export function raidSpawnsAnyStep(state: QuestState, map: MapId): RaidSpawn[] {
  if (chapterPhase(state) !== 'raid') return [];
  return RAID_WAVES.filter((w) => w.map === map).flatMap((w) => w.groups.flat());
}

/**
 * 지금 나와 있어야 할 떼에서 아직 쓰러뜨리지 않은 권속. 쓰러뜨린 수(count)로 어느 떼인지 정하므로
 * 재접속해도 남은 수만 다시 배치하고, 앞 떼를 다 잡았으면 다음 떼(보스)가 나온다.
 */
export function raidSpawns(state: QuestState, map: MapId): RaidSpawn[] {
  if (chapterPhase(state) !== 'raid') return [];
  const progress = state['village-raid'];
  if (progress?.status !== 'active') return [];
  const wave = RAID_WAVES.find((w) => w.step === (progress.step ?? 0) && w.map === map);
  if (!wave) return [];
  let left = progress.count;
  for (const group of wave.groups) {
    if (left < group.length) return group.slice(left);
    left -= group.length;
  }
  return [];
}

export function chapterDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day') return undefined;
  // 동료(entities/companion.ts)는 이 대사를 쓰지 않는다.
  if (npc.startsWith('companion-')) return undefined;
  if (isGuardId(npc)) {
    const guard = GUARDS.find(g => g.id === npc);
    if (!guard) return undefined;
    // 남문은 테온이 맡던 자리다. 잔치 날 밤 남문 병사들은 테온의 지휘 아래 있었고, 입구는 뚫렸다.
    const south = guard.gate === 'south';
    const text = phase === 'raid'
      ? south ? '테온 대장님과 막고 있었는데… 놈들이 너무 많습니다! 마을 안쪽을 부탁드립니다!'
        : '주민들이 대피할 길을 확보하고 있습니다. 위험하니 마물 가까이에서는 조심하세요!'
      : south ? '그날 밤 남문은 테온 대장님과 저희가 지켰습니다. …막아 내지 못했어요. 대장님은 혼자 다 짊어지려 하시고요.'
        : '다친 주민들을 살피고 경비를 다시 세우고 있습니다. 도움이 필요하면 말씀하세요.';
    return [{ speaker: guard.name, portrait: 'soldier', text }];
  }
  const texts: Partial<Record<NpcId, string>> = {
    ruan: '조금만 쉬면 괜찮아질 거다. 넌 네가 해야 할 일을 하렴. 다만 혼자 감당하려 들진 말고.',
    linea: '시온… 시아는 찾았어? 그 아이, 혼자 있으면 안 되는데…',
    serena: '나는 리네아 곁에 있을게. 시아를 찾아 줘. 너도 꼭 돌아와야 한다.',
    eila: '보통 상처가 아니야. 내가 곁에서 돌볼 테니, 넌 도울 방법을 찾아보렴.',
    teon: '내가 입구를 지켰어야 했는데… 남아 있는 사람들만큼은 꼭 지킬 거야.',
    herman: '아직 돌아오지 못한 사람이 없는지 확인하고 있네. 마을이 버틸 수 있도록 함께 도와주게.',
    vernel: '마을을 도울 단서가 없는지 옛 기록을 다시 살펴보고 있어.',
    merina: '필요한 물건이 있으면 말해. 아직 물약은 남아 있어.',
    doran: '다친 사람부터 챙겨라. 부러진 건 우리가 다시 만들면 돼.',
    rosetta: '여관은 계속 열어 둘게. 다친 사람도, 집에 돌아가기 힘든 사람도 들어와 쉬면 돼.',
  };
  const raidTexts: Partial<Record<NpcId, string>> = {
    ruan: '시온, 길을 막는 녀석들부터 저지하자. 사람들이 지나갈 길을 열어야 해!',
    serena: '다친 사람들은 북쪽 치유소로 보내고 있어. 시온, 너도 조심하렴.',
    eila: '움직일 수 있는 사람은 북쪽으로! 다친 사람은 여기서 내가 먼저 살펴볼게.',
    teon: '입구에서 밀려들고 있어! 마을 안쪽으로 보내면 안 돼!',
    herman: '내 집과 치유소에 사람들을 들였네. 뒤처진 사람이 없는지 살펴 주게나.',
    merina: '가게에서 물약을 챙겨 왔어. 상처가 나면 바로 써. 필요한 건 여기 있어!',
    doran: '치유소 문은 내가 지킨다. 너는 길을 막는 놈들을 부탁한다!',
    vernel: '무슨 일이 벌어진 거지…? 아이들은 여기서 내가 보고 있겠네.',
    rosetta: '여관은 남쪽 입구와 너무 가까워서 다들 여기로 옮겼어. 담요는 넉넉해!',
  };
  const text = (phase === 'raid' ? raidTexts : texts)[npc];
  const names: Partial<Record<NpcId, string>> = { ruan: '루안', linea: '리네아', serena: '세레나', eila: '에일라', teon: '테온', rosetta: '로제타', herman: '헤르만', vernel: '베르넬', merina: '메리나', doran: '도란' };
  return text ? [{ speaker: names[npc]!, portrait: npc as NamedNpcId, text }] : undefined;
}
