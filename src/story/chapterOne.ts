import { mapLength, mapPoint } from '../world/mapScale.ts';
import type { DialogueLine } from './dialogues.ts';
import { currentObjective, isSubPaused, questDef, type QuestId, type QuestState } from './quests.ts';
import { GUARDS, isGuardId } from '../world/guards.ts';
import { NPCS, type Direction8, type DutyPoint, type NamedNpcId, type NpcDef, type NpcId } from '../world/npcs.ts';
import { INTERIORS, interiorArtPoint, type InteriorId } from '../world/interiors.ts';
import type { MapId } from '../world/maps.ts';
import type { Interactable } from '../world/interactables.ts';
import { BUILDINGS, LINEA_HOME, LINEA_YARD } from '../world/villageLayout.ts';
import { RAID_LEVELS } from '../combat/monsterLevel.ts';

/** 1장 "풀리지 않는 매듭" 진행 중 시아가 리네아의 집 창문 앞에서 끈을 묶는 자리. */
export const SIA_KNOT_SPOT = { x: LINEA_HOME.door.x - mapLength(145), y: LINEA_HOME.door.y + mapLength(10) };

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
 * 루안과 테온은 광장에서 싸운다. 시아는 보이지 않으며, 리네아는 북쪽 길 전투 이후 치유소 병상에 나타난다. 실내는 원화 픽셀 좌표(room).
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
  rosetta: { map: 'in-clinic', room: 'clinic', x: 680, y: 560, facing: 'left' },
  merina: { map: 'in-clinic', room: 'clinic', x: 930, y: 650, facing: 'down' },
  vernel: { map: 'in-chief', room: 'chief', x: 860, y: 450, facing: 'down' },
};
/** 습격 단계(village-raid의 step)가 이 값 이상이면 옮겨 간 자리 */
const RAID_MOVES: Partial<Record<NamedNpcId, { fromStep: number; place: RaidPlace }>> = {
  // 세레나 안전 확인(step 3)을 마치면
  serena: { fromStep: 4, place: { map: 'in-clinic', room: 'clinic', x: 600, y: 560, facing: 'left' } },
  // 북쪽 길의 무리와 집행자(step 4)를 막으면
  eila: { fromStep: 5, place: { map: 'in-clinic', room: 'clinic', x: 850, y: 560, facing: 'left' } },
};

export type LineaRecovery = 'unconscious' | 'awake' | 'journal';

/** Recovery follows story progress, so reloads cannot make a patient stand up or appear twice. */
export function lineaRecovery(state: QuestState): LineaRecovery | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day' || (phase === 'raid' && (state['village-raid']?.step ?? 0) < 5)) return undefined;
  if (state['first-sword']?.status === 'done') return 'journal';
  const search = state['missing-sia'];
  return search && (search.status === 'done' || (search.step ?? 0) >= 2) ? 'awake' : 'unconscious';
}

export function chapterCanTalk(npc: NpcId, state: QuestState): boolean {
  return npc !== 'linea' || lineaRecovery(state) !== 'unconscious';
}

function lineaCareNpcs(state: QuestState): NpcDef[] {
  const action = lineaRecovery(state);
  if (!action) return [];
  const inside: InteriorId = action === 'journal' ? 'linea' : 'clinic';
  const clinic = inside === 'clinic';
  const room = INTERIORS.find(i => i.id === inside)!;
  const at = ([x, y]: readonly [number, number]) => interiorArtPoint(room, x, y);
  // 침대 곁에는 세레나 한 사람만 오래 머물고, 에일라는 약을 준비하다 짧게 치료하러 다녀간다.
  // 리네아와 대화하는 자리는 세레나의 반대쪽(치유소는 침대 발치, 집은 침대 앞)에 두어 세 사람의 대화 자리가 겹치지 않는다.
  const body = at(clinic ? [340, 432] : [1340, 650]);
  const bedside = at(clinic ? [545, 490] : [1150, 830]);
  const patient: NpcDef = {
    ...NPCS.find(n => n.id === 'linea')!, ...body, inside, wander: undefined,
    storyAction: action, shadow: false, labelOffset: clinic ? 75 : 200,
    depthOffset: clinic ? at([340, 515]).y - body.y : 0,
    talkOffsetX: bedside.x - body.x, talkOffset: bedside.y - body.y,
  };
  const serenaDuty: DutyPoint[] = clinic ? [
    { ...at([430, 530]), label: '리네아 간호 중', action: 'nurse-left', facing: 'up-left', durationMs: 30000 },
    { ...at([520, 528]), label: '물수건 챙기는 중', durationMs: 0 },
    { ...at([650, 660]), label: '물수건 준비 중', action: 'wring-cloth', durationMs: 5000 },
    { ...at([520, 528]), label: '병상으로 돌아가는 중', durationMs: 0 },
  ] : [
    { ...at([1190, 610]), label: '리네아 간호 중', action: 'nurse-right', facing: 'up-right', durationMs: 30000 },
    { ...at([930, 680]), label: '물수건 준비 중', action: 'wring-cloth', durationMs: 5000 },
  ];
  const eilaDuty: DutyPoint[] = [
    { ...at(clinic ? [850, 540] : [600, 505]), label: '약초와 붕대 준비 중', facing: 'up-left', action: 'mix-herbs', durationMs: 20000 },
    { ...at(clinic ? [520, 600] : [1120, 700]), label: '리네아 치료 중', facing: clinic ? 'up-left' : 'right',
      action: clinic ? 'treat-left' : 'treat-right', durationMs: 6000 },
  ];
  const carers = (['eila', 'serena'] as const).map(id => {
    const duty = id === 'eila' ? eilaDuty : serenaDuty;
    return {
      ...NPCS.find(n => n.id === id)!, inside, wander: undefined,
      facing: duty[0].facing ?? 'down', x: duty[0].x, y: duty[0].y, talkOffset: 0, duty,
    };
  });
  return [patient, ...carers];
}

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
    const def: NpcDef = { ...n, x: place.x, y: place.y, wander: undefined, ...(place.facing ? { facing: place.facing } : {}),
      ...(n.id === 'eila' ? { storyAction: 'mix-herbs' } : {}),
      ...(n.id === 'serena' && 'room' in place ? { storyAction: 'wring-cloth' } : {}) };
    if (n.id === 'merina') def.storyAction = 'supplies';
    if (n.id === 'rosetta') def.storyAction = 'blankets';
    if ('room' in place) {
      const at = interiorArtPoint(INTERIORS.find((i) => i.id === place.room)!, place.x, place.y);
      return [{ ...def, ...at, inside: place.room, talkOffsetX: 0, talkOffset: 0 }];
    }
    delete def.inside;
    delete def.talkOffset;
    delete def.talkOffsetX;
    return [{ ...def, area: map === 'village-north' ? 'village-north' : 'village' }];
  });
  return [...guards, ...people];
}

/**
 * 습격 뒤 마을 사람들이 맡은 일: 복구·치료·경계. 자리들을 차례로 오가며 멈춘 동안 머리 위에 하는 일을 띄운다(NpcDef.duty).
 * 루안은 부상 자세로 쉬고, 리네아와 간호자는 병실에 있으며, 가게 주인들은 가게를 다시 연다. 좌표는 옛 배치 기준(mapPoint).
 */
const duty = (label: string, ...points: Array<[number, number]>): DutyPoint[] =>
  points.map(([x, y]) => ({ ...mapPoint({ x, y }), label }));
export const AFTERMATH_DUTIES: Partial<Record<NpcId, DutyPoint[]>> = {
  herman: [...duty('피해 상황 기록 중', [1290, 600]), ...duty('복구 물자 기록 중', [1150, 1080]), ...duty('대피 주민 확인 중', [1450, 1180])]
    .map(p => ({ ...p, action: 'record', durationMs: 7000 })),
  'guard-homes-west': duty('경계 중', [980, 760], [900, 1200], [1350, 1250]),
  'guard-homes-east': duty('경계 중', [1900, 1160], [2300, 1100], [2250, 800], [1800, 800]),
  // 2장부터 남문 오른쪽 위에 페른의 수레가 서므로(story/chapterTwo.ts) 그 자리를 비켜 다닌다.
  teon: duty('남문 경계 중', [1340, 1450], [1050, 1420], [1300, 1300]),
  vernel: duty('권속 흔적 조사 중', [1200, 1330], [1350, 1250], [1140, 1410])
    .map(p => ({ ...p, action: 'inspect', facing: 'down-left', durationMs: 8000 })),
  'guard-plaza-west': duty('목재 수리 중', [900, 1180], [1120, 1280])
    .map(p => ({ ...p, action: 'repair', facing: 'up-left', durationMs: 6000 })),
  'guard-plaza-east': duty('경계 중', [1550, 930], [1700, 1250], [1250, 1250], [1250, 950]),
};

/** 맡은 일이 있으면 그 첫 자리에서 시작해 자리들을 오간다. */
function withDuty(n: NpcDef): NpcDef {
  const points = AFTERMATH_DUTIES[n.id];
  return points ? { ...n, x: points[0].x, y: points[0].y, wander: undefined, duty: points } : n;
}

export function chapterNpcs(base: readonly NpcDef[], state: QuestState, map?: MapId): NpcDef[] {
  const phase = chapterPhase(state);
  if (phase === 'raid') {
    if (map === undefined) return base.filter(n => n.id !== 'sia' && n.id !== 'linea').map(n => ({ ...n, wander: undefined }));
    const placed = raidNpcs(base, map, state['village-raid']?.step ?? 0);
    // Her rescue happens after the north-road fight. Eila starts bedside care as soon as the patient arrives.
    const care = lineaCareNpcs(state);
    return map === 'in-clinic' && care.length
      ? [...placed.filter(n => !care.some(c => c.id === n.id)), ...care] : placed;
  }
  const people = base.map(n => n.id === 'doran' && n.inside === 'smithy' ? { ...n, storyAction: 'hammer' } : n);
  if (phase === 'day') {
    const knotStep0 = state['sia-knot']?.status === 'active' && (state['sia-knot'].step ?? 0) === 0;
    if (!knotStep0) return people;
    return people.map(n => n.id === 'sia'
      ? { ...n, x: SIA_KNOT_SPOT.x, y: SIA_KNOT_SPOT.y, wander: undefined, facing: 'up' as const }
      : n);
  }
  const placed = people.filter(n => !['sia', 'linea', 'eila', 'serena'].includes(n.id)).map(n => {
    if (n.id === 'ruan') return { ...n, ...mapPoint({ x: 1080, y: 1150 }), wander: undefined };
    if (n.id === 'merina') return { ...n, wander: undefined, storyAction: 'supplies' };
    // Fold blankets on the guest side: the tall counter would hide both hands and the blanket.
    // Her feet now occupy the original conversation point, so the reachable talk spot stays unchanged.
    if (n.id === 'rosetta') return { ...n, y: n.y + (n.talkOffset ?? 0), talkOffset: 0, wander: undefined, storyAction: 'blankets' };
    return { ...n, wander: undefined };
  }).map(withDuty);
  const care = lineaCareNpcs(state).filter(n => map === undefined || map === `in-${n.inside}`);
  return [...placed, ...care];
}

const SPOTS = {
  'south-watch': { id: 'story-south-watch', ...mapPoint({ x: 1180, y: 1340 }), radius: 95, markerHeight: 55 },
  'home-search': { id: 'story-home-search', ...mapPoint({ x: 415, y: 640 }), radius: 85, markerHeight: 55 },
  // 해 질 무렵 남쪽 들판: 나방이 모여 앉았던 풀숲
  'moth-nest': { id: 'story-moth-nest', x: 1787.5, y: 1229.8, radius: 95, markerHeight: 55 },
  // 습격 중 마을 북쪽: 리네아의 집 옆 골목
  'north-alley': { id: 'story-north-alley', x: LINEA_YARD.x + mapLength(120), y: LINEA_YARD.y + mapLength(70), radius: 95, markerHeight: 55 },
  // 1장 첫날 서브 퀘스트 채집·조사 지점
  wildflower: { id: 'story-wildflower', x: 1120, y: 880, radius: 95, markerHeight: 55 },
  'ancient-tablet': { id: 'story-ancient-tablet', x: 2640, y: 760, radius: 95, markerHeight: 55 },
  'silver-herb-1': { id: 'story-silver-herb-1', x: 640, y: 1320, radius: 95, markerHeight: 55 },
  'silver-herb-2': { id: 'story-silver-herb-2', x: 1580, y: 1720, radius: 95, markerHeight: 55 },
  'silver-herb-3': { id: 'story-silver-herb-3', x: 2060, y: 1120, radius: 95, markerHeight: 55 },
  'stream-pebble': { id: 'story-stream-pebble', ...mapPoint({ x: 960, y: 470 }), radius: 95, markerHeight: 55 },
  'clear-water': { id: 'story-clear-water', ...mapPoint({ x: 1760, y: 470 }), radius: 95, markerHeight: 55 },
} satisfies Record<string, Interactable>;

export function chapterSpots(state: QuestState, map: MapId): Interactable[] {
  return Object.values(SPOTS).filter((spot: Interactable) => Object.entries(state).some(([id, p]) => {
    const def = questDef(id as QuestId);
    if (isSubPaused(def, state)) return false;
    const objective = currentObjective(def, p);
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
    { speaker: '시온', portrait: 'hero-neutral', text: '시아야? …대답이 없어. 문은 열려 있는데 집은 비어 있어. 시아가 돌아온 흔적은 없어.' },
    { speaker: '시온', portrait: 'hero-neutral', text: '리네아라면 마지막으로 시아를 봤을 텐데… 에일라에게 가 보자.' },
  ],
  'story-wildflower': [
    { speaker: '시온', portrait: 'hero-neutral', text: '하늘색 꽃잎이 햇빛에 반짝이고 있어. 리네아가 좋아할 만한 걸로 한 다발 꺾어 가자.' },
  ],
  'story-ancient-tablet': [
    { speaker: '시온', portrait: 'hero-neutral', text: '풀숲 사이에 반쯤 묻힌 낡은 석판 조각이야. 처음 보는 기하학적인 표식이 새겨져 있네… 베르넬에게 가져다주자.' },
  ],
  'story-silver-herb-1': [
    { speaker: '시온', portrait: 'hero-neutral', text: '잎 끝이 은빛으로 빛나는 약초야. 뿌리가 다치지 않게 조심해서 캐자.' },
  ],
  'story-silver-herb-2': [
    { speaker: '시온', portrait: 'hero-neutral', text: '여기에도 은빛 풀이 자라고 있어. 상쾌한 풀내음이 나네.' },
  ],
  'story-silver-herb-3': [
    { speaker: '시온', portrait: 'hero-neutral', text: '이걸로 세 뿌리째야. 시들기 전에 치유소의 에일라 선생님께 갖다드리자.' },
  ],
  'story-stream-pebble': [
    { speaker: '시온', portrait: 'hero-neutral', text: '맑은 물에 씻겨 동그랗고 윤이 나는 조약돌이야. 시아가 찾던 게 딱 이거겠네.' },
  ],
  'story-clear-water': [
    { speaker: '시온', portrait: 'hero-neutral', text: '바닥 자갈이 훤히 비칠 만큼 맑은 개울물이야. 물통에 가득 담았으니 어머니께 갖다드리자.' },
  ],
};

/**
 * 해 질 무렵: "해 질 무렵의 순찰"을 받은 뒤부터 축제 전야가 시작되기 전까지
 * 남쪽 들판에 잿빛 나방(소멸의 하급 권속)이 나타난다. 습격 전에 네이룬 계열을 처음 마주하는 복선이다.
 * 좌표는 남쪽 들판의 월드 픽셀 기준이다. 마을에는 몬스터를 두지 않는다.
 */
export const DUSK_MOTH_POINTS: ReadonlyArray<readonly [number, number]> = [[1229.8, 1029.6], [2145, 1086.8], [1787.5, 1401.4], [1001, 1358.5]];

export function isDusk(state: QuestState): boolean {
  return !!state['evening-patrol'] && chapterPhase(state) === 'day';
}

/** 해 질 무렵 남쪽 들판에 잿빛 나방이 남아 있는지 (쫓아내기 완료 뒤에는 사라진다). */
export function hasDuskMoths(state: QuestState): boolean {
  return isDusk(state) && state['moth-trail']?.status !== 'done';
}

/** 광장 표지판의 시기별 대사 (습격·수습 중에 첫날 축제 리본 감상이 나오지 않게 한다). */
export function villageSignDialogue(state: QuestState): DialogueLine[] | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day') return undefined;
  const header: DialogueLine = { speaker: '표지판', text: '로웬 마을 광장\n북쪽: 집들 · 남쪽: 들판 · 서쪽: 숲길 · 동쪽: 개울가' };
  const reaction = phase === 'raid'
    ? '수확제 리본이 바람에 흩날리고 있어… 어서 마을을 지키자.'
    : '수확제 리본이 아직 걸려 있네… 리네아와 시아가 무사히 돌아오면 좋겠어.';
  return [header, { speaker: '시온', portrait: 'hero-neutral', text: reaction }];
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

/**
 * 습격 전 첫날, 진행 단계에 맞춰 바뀐 평소 대사. 이미 끝난 일이나 지난 시간대를 다시 말하지 않게 한다.
 */
function dayDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  const done = (id: QuestId) => state[id]?.status === 'done';
  if (npc === 'ruan') {
    if (done('ruan-forest')) return [{ speaker: '루안', portrait: 'ruan', text: '오늘은 충분하다. 저녁에 광장에서 보자.' }];
    if (done('ruan-training')) return [{ speaker: '루안', portrait: 'ruan', text: '아직 수련이 남았다. 서두르지 말고 차근차근 익혀라.' }];
  }
  if (npc === 'linea') {
    if (done('sia-knot') || done('festival-supplies')) return [{ speaker: '리네아', portrait: 'linea', text: '등불 장식은 다 끝냈어! 이제 저녁만 기다리면 돼.' }];
    if (done('ruan-training')) return [{ speaker: '리네아', portrait: 'linea', text: '수련 잘 되고 있어? 장식은 거의 다 됐어. 끝나고 이따 들러!' }];
  }
  if (npc === 'sia' && done('sia-knot')) {
    return [{ speaker: '시아', portrait: 'sia', text: '창문 끈은 단단히 묶어 놨어! 이제 축제 때 같이 등불 띄우는 일만 남았네!' }];
  }
  if (npc === 'serena' && isDusk(state)) {
    return [{ speaker: '세레나', portrait: 'serena', text: '벌써 해가 기울었구나. 곧 광장에서 잔치를 시작할 테니 서둘러 오렴.' }];
  }
  if (npc === 'doran' && isDusk(state)) {
    return [{ speaker: '도란', portrait: 'doran', text: '해가 다 졌군. 오늘은 그만 쉬고 광장 잔치나 즐기자고!' }];
  }
  if (npc === 'teon' && done('watch-report')) return [{ speaker: '테온', portrait: 'teon', text: '숲 얘기 고마워. 입구는 내가 더 단단히 지킬게.' }];
  return undefined;
}

export function chapterDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day') return dayDialogue(npc, state);
  const raidProgress = state['village-raid'];
  const raidStep = raidProgress?.status === 'ready' ? 7 : (raidProgress?.step ?? 0);
  if (npc === 'serena' && phase === 'raid' && raidStep >= 4) return [{
    speaker: '세레나', portrait: 'serena', text: raidStep >= 6
      ? '리네아는 내가 곁에서 볼게. 에일라에게 상태를 물어보고, 너도 조심하렴.'
      : raidStep >= 5
        ? '방금 사람들이 리네아를 업고 들어왔어. 시아는 안 보이던데… 북쪽 골목부터 살펴봐 주겠니?'
        : '여긴 괜찮아. 다친 사람들이 쉴 수 있게 물과 수건을 챙기고 있어. 너도 조심하렴.',
  }];
  if (npc === 'eila' && phase === 'raid' && raidStep >= 5) return [{
    speaker: '에일라', portrait: 'eila', text: raidStep >= 7
      ? '리네아는 내가 곁에서 볼게. 루안도 크게 다쳤으니 광장에 먼저 가 보렴.'
      : '방금 북쪽 골목에서 리네아를 업고 왔어. 큰 외상은 없는데 깨어나질 않아… 골목부터 살펴봐 주렴.',
  }];
  if (npc === 'linea' && !chapterCanTalk(npc, state)) return [{ speaker: '시온', portrait: 'hero-neutral', text: '리네아는 아직 의식을 되찾지 못했어. 숨은 고르게 쉬고 있어… 에일라에게 상태를 물어보자.' }];
  // 동료(entities/companion.ts)는 이 대사를 쓰지 않는다.
  if (npc.startsWith('companion-')) return undefined;
  if (isGuardId(npc)) {
    const guard = GUARDS.find(g => g.id === npc);
    if (!guard) return undefined;
    // 남문은 테온이 맡던 자리다. 잔치 날 밤 남문 병사들은 테온의 지휘 아래 있었고, 입구는 뚫렸다.
    const south = guard.gate === 'south';
    const text = phase === 'raid'
      ? raidStep >= 5 ? '일단 큰 고비는 넘겼습니다. 다친 분들이 괜찮은지 살펴봐 주세요.'
        : south ? '테온 대장님과 막고 있었는데… 놈들이 너무 많습니다! 마을 안쪽을 부탁드립니다!'
          : '주민들이 대피할 길을 확보하고 있습니다. 위험하니 마물 가까이에서는 조심하세요!'
      : south ? '그날 밤 남문은 테온 대장님과 저희가 지켰습니다. …막아 내지 못했어요. 대장님은 혼자 다 짊어지려 하시고요.'
        : '다친 주민들을 살피고 경비를 다시 세우고 있습니다. 도움이 필요하면 말씀하세요.';
    return [{ speaker: guard.name, portrait: 'soldier', text }];
  }
  const texts: Partial<Record<NpcId, string>> = {
    ruan: '조금만 쉬면 괜찮아질 거다. 넌 네가 해야 할 일을 하렴. 다만 혼자 감당하려 들진 말고.',
    linea: state['missing-sia']?.status === 'done'
      ? '시온… 북쪽 골목에서 내가 끝까지 붙잡았어야 했는데… 시아는 꼭 무사할 거야.'
      : '시온… 시아는 찾았어? 그 아이, 혼자 있으면 안 되는데…',
    serena: '나는 리네아 곁에 있을게. 시아를 찾아 줘. 너도 꼭 돌아와야 한다.',
    eila: '보통 상처가 아니야. 내가 곁에서 돌볼 테니, 넌 도울 방법을 찾아보렴.',
    teon: state['first-sword']?.status === 'done'
      ? '상처는 많이 나았어. 순찰도 다시 시작했어. 남아 있는 사람들만큼은 꼭 지킬 거야.'
      : '붕대는 감았어. 에일라가 무리하지 말래서 당분간 여기서 망을 볼 거야. …남아 있는 사람들만큼은 꼭 지킬 거야.',
    herman: '아직 돌아오지 못한 사람이 없는지 확인하고 있네. 마을이 버틸 수 있도록 함께 도와주게.',
    vernel: '권속이 남긴 흔적을 옛 기록과 맞춰 보고 있어. 마을을 도울 단서가 있을지도 몰라.',
    merina: '필요한 물건이 있으면 말해. 아직 물약은 남아 있어.',
    doran: '다친 사람부터 챙겨라. 부러진 건 우리가 다시 만들면 돼.',
    rosetta: '여관은 계속 열어 둘게. 다친 사람도, 집에 돌아가기 힘든 사람도 들어와 쉬면 돼.',
  };
  const raidTexts: Partial<Record<NpcId, string>> = {
    ruan: raidStep >= 5 ? '후우… 권속들은 물러난 모양이구나. 북쪽 골목과 치유소부터 살펴보고 오렴.' : '시온, 길을 막는 녀석들부터 저지하자. 사람들이 지나갈 길을 열어야 해!',
    serena: '다친 사람들은 북쪽 치유소로 보내고 있어. 시온, 너도 조심하렴.',
    eila: '움직일 수 있는 사람은 북쪽으로! 다친 사람은 여기서 내가 먼저 살펴볼게.',
    teon: raidStep >= 2 ? '윽… 남문은 내가 버틸게. 안쪽 사람들을 부탁해!' : '입구에서 밀려들고 있어! 마을 안쪽으로 보내면 안 돼!',
    herman: '내 집과 치유소에 사람들을 들였네. 뒤처진 사람이 없는지 살펴 주게나.',
    merina: '가게에서 물약을 챙겨 왔어. 상처가 나면 바로 써. 필요한 건 여기 있어!',
    doran: raidStep >= 5 ? '권속들은 물러난 모양이군. 치유소 안을 살펴봐라!' : '치유소 문은 내가 지킨다. 너는 길을 막는 놈들을 부탁한다!',
    vernel: '무슨 일이 벌어진 거지…? 아이들은 여기서 내가 보고 있을게.',
    rosetta: '여관은 남쪽 입구와 너무 가까워서 다들 여기로 옮겼어. 담요는 넉넉해!',
  };
  const text = (phase === 'raid' ? raidTexts : texts)[npc];
  const names: Partial<Record<NpcId, string>> = { ruan: '루안', linea: '리네아', serena: '세레나', eila: '에일라', teon: '테온', rosetta: '로제타', herman: '헤르만', vernel: '베르넬', merina: '메리나', doran: '도란' };
  return text ? [{ speaker: names[npc]!, portrait: npc as NamedNpcId, text }] : undefined;
}
