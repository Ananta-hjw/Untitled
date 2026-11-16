import type { DialogueLine } from './dialogues.ts';
import { currentObjective, questDef, type QuestState } from './quests.ts';
import { GUARDS, isGuardId } from '../world/guards.ts';
import { NPCS, type NpcDef, type NpcId } from '../world/npcs.ts';
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

export function chapterNpcs(base: readonly NpcDef[], state: QuestState, map?: MapId): NpcDef[] {
  const phase = chapterPhase(state);
  if (phase === 'day') return [...base];
  const evacuated = ['serena', 'eila', 'herman'];
  let source = phase === 'raid' && map === 'village'
    ? [...base, ...NPCS.filter(n => evacuated.includes(n.id) && !base.some(b => b.id === n.id))]
    : phase === 'raid' && map === 'village-north' ? base.filter(n => !evacuated.includes(n.id)) : base;
  // 에일라는 낮에는 치유소 안에 있지만, 습격 때는 광장, 습격 뒤에는 리네아 곁(마을 북쪽)에 있다.
  if (map !== undefined) {
    source = source.filter(n => n.id !== 'eila' || (phase === 'raid' && map === 'village'));
    if (phase === 'aftermath' && map === 'village-north') source = [...source, NPCS.find(n => n.id === 'eila')!];
  }
  return source.filter(n => n.id !== 'sia' && !(phase === 'raid' && n.id === 'linea')).map(n => {
    if (n.id === 'eila') {
      const outside: NpcDef = { ...n, area: phase === 'raid' ? 'village' : 'village-north', x: phase === 'raid' ? 1540 : LINEA_YARD.x + 130, y: phase === 'raid' ? 1200 : LINEA_YARD.y, wander: undefined };
      delete outside.inside;
      delete outside.talkOffset;
      return outside;
    }
    if (n.inside) return { ...n };
    if (n.id === 'ruan') return { ...n, x: 1080, y: 1150, wander: undefined };
    if (n.id === 'serena') return { ...n, x: phase === 'raid' ? 1500 : LINEA_YARD.x + 140, y: phase === 'raid' ? 1100 : LINEA_YARD.y + 90, wander: undefined };
    if (n.id === 'linea') return { ...n, ...LINEA_YARD, wander: undefined };
    return { ...n, wander: undefined };
  });
}

const SPOTS = {
  'south-watch': { id: 'story-south-watch', x: 1180, y: 1340, radius: 95, markerHeight: 55 },
  'home-search': { id: 'story-home-search', x: 415, y: 640, radius: 85, markerHeight: 55 },
  // 해 질 무렵 남쪽 들판: 나방이 모여 앉았던 풀숲
  'moth-nest': { id: 'story-moth-nest', ...fieldPoint(1250, 860), radius: 95, markerHeight: 55 },
  // 습격 중 마을 북쪽: 리네아의 집 옆 골목
  'north-alley': { id: 'story-north-alley', x: LINEA_YARD.x + 120, y: LINEA_YARD.y + 70, radius: 95, markerHeight: 55 },
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
    { speaker: '시온', portrait: 'hero-neutral', text: '둘이 여기 있었던 거야. 에일라가 다친 사람들을 광장으로 옮기고 있다고 했지. 가 보자.' },
  ],
  'story-home-search': [
    { speaker: '시온', portrait: 'hero-neutral', text: '시아야? …대답이 없어. 집 안에도 돌아온 흔적이 없고. 리네아라면 마지막으로 시아를 봤을 텐데… 에일라에게 가 보자.' },
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

export interface RaidSpawn { x: number; y: number; key: 'corrosion-tracker' | 'corrosion-executioner'; level: number }

const inn = BUILDINGS.find((b) => b.frame === 'inn')!.door;
const tracker = (x: number, y: number): RaidSpawn => ({ x, y, key: 'corrosion-tracker', level: RAID_LEVELS.tracker });
const executioner = (x: number, y: number): RaidSpawn => ({ x, y, key: 'corrosion-executioner', level: RAID_LEVELS.executioner });

/**
 * 습격의 세 무리 (꺼져 가는 등불의 전투 단계): 남쪽 입구 → 여관 앞 골목 → 마을 북쪽 길.
 * 마지막 무리에는 부식의 집행자가 길을 막는다.
 */
export const RAID_WAVES: Array<{ step: number; map: MapId; spawns: RaidSpawn[] }> = [
  { step: 0, map: 'village', spawns: [tracker(1180, 1320), tracker(1310, 1220), tracker(1460, 1130)] },
  { step: 2, map: 'village', spawns: [tracker(inn.x - 260, inn.y + 30), tracker(inn.x + 180, inn.y + 40), tracker(inn.x - 90, inn.y + 45)] },
  { step: 4, map: 'village-north', spawns: [tracker(LINEA_YARD.x + 260, LINEA_YARD.y + 90), executioner(LINEA_YARD.x + 380, LINEA_YARD.y - 20),
    tracker(LINEA_YARD.x + 120, LINEA_YARD.y + 170)] },
];

/** 습격 중 이 맵에 나올 수 있는 모든 권속 (그림을 미리 읽어 두려고 쓴다). */
export function raidSpawnsAnyStep(state: QuestState, map: MapId): RaidSpawn[] {
  if (chapterPhase(state) !== 'raid') return [];
  return RAID_WAVES.filter((w) => w.map === map).flatMap((w) => w.spawns);
}

/** 재접속해도 남은 수만 다시 배치한다. 일반 필드 처치와 구분한다. */
export function raidSpawns(state: QuestState, map: MapId): RaidSpawn[] {
  if (chapterPhase(state) !== 'raid') return [];
  const progress = state['village-raid'];
  if (progress?.status !== 'active') return [];
  const wave = RAID_WAVES.find((w) => w.step === (progress.step ?? 0) && w.map === map);
  return wave ? wave.spawns.slice(progress.count) : [];
}

export function chapterDialogue(npc: NpcId, state: QuestState): DialogueLine[] | undefined {
  const phase = chapterPhase(state);
  if (phase === 'day') return undefined;
  if (isGuardId(npc)) {
    const guard = GUARDS.find(g => g.id === npc);
    return guard ? [{ speaker: guard.name, portrait: 'soldier', text: phase === 'raid'
      ? '주민들이 대피할 길을 확보하고 있습니다. 위험하니 마물 가까이에서는 조심하세요!'
      : '다친 주민들을 살피고 경비를 다시 세우고 있습니다. 도움이 필요하면 말씀하세요.' }] : undefined;
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
    serena: '다친 사람들을 여관으로 데려가야겠어. 시온, 너도 조심하렴.',
    eila: '움직일 수 있는 사람부터 여관으로! 다친 사람은 내가 살펴볼게.',
    teon: '입구에서 밀려들고 있어! 마을 안쪽으로 보내면 안 돼!',
    herman: '여관으로 모이게! 뒤처진 사람이 없는지 살펴 주게나.',
    merina: '상처가 나면 바로 물약을 써. 필요한 건 여기 있어!',
    doran: '이쪽 길은 내가 살필 테니 사람들을 부탁한다!',
    vernel: '무슨 일이 벌어진 거지…? 우선 사람들부터 도와야겠어.',
    rosetta: '여관 문은 열어 뒀어! 안전한 길이 열리면 사람들을 데려와 줘!',
  };
  const text = (phase === 'raid' ? raidTexts : texts)[npc];
  const names: Partial<Record<NpcId, string>> = { ruan: '루안', linea: '리네아', serena: '세레나', eila: '에일라', teon: '테온', rosetta: '로제타', herman: '헤르만', vernel: '베르넬', merina: '메리나', doran: '도란' };
  return text ? [{ speaker: names[npc]!, portrait: npc, text }] : undefined;
}
