import type { CompanionId } from './companion.ts';
import type { StatBlock } from './attributes.ts';

/**
 * 직업과 전직 (기획 초안, 아직 게임 화면에 연결하지 않았다. docs/jobs.md).
 * Phaser를 쓰지 않아 tools/jobs.test.mjs가 직접 불러 검사한다.
 *
 * - 기본 직업 8개(검사·기사·궁수·법사·도적·클레릭, 추천 창술사·음유시인).
 * - 1차 전직(firstAdvanceLevel)에서 두 갈래 중 하나를 고르고, 2차 전직(secondAdvanceLevel)은 그 갈래의 끝 직업 하나다.
 * - 전직하려면 레벨과 전직 시험 퀘스트(trial)가 모두 필요하다. 시험 퀘스트는 아직 quests.ts에 없다(계획한 id).
 * - 주인공 시온은 검사 계열만 간다(HERO_JOB_ROOT). 다른 계열은 동료의 직업이다(COMPANION_JOBS).
 * - 직업의 능력치 보너스(stats)는 그 직업까지 거쳐 온 단계를 모두 더한다(jobStatBonus). 장비 보너스처럼 totalStats에 더해 쓴다.
 */

export type JobId =
  // 검사 계열 (시온)
  | 'swordsman' | 'blademaster' | 'spellblade' | 'sword-saint' | 'twilight-blade'
  // 기사
  | 'knight' | 'guardian' | 'paladin' | 'bulwark' | 'radiant-knight'
  // 궁수
  | 'archer' | 'sniper' | 'hunter' | 'marksman' | 'warden'
  // 법사
  | 'mage' | 'elementalist' | 'warder' | 'archmage' | 'sealer'
  // 도적
  | 'rogue' | 'assassin' | 'scout' | 'nightblade' | 'raider'
  // 클레릭
  | 'cleric' | 'priest' | 'battle-priest' | 'high-priest' | 'inquisitor'
  // 창술사 (추천)
  | 'lancer' | 'dragoon' | 'vanguard' | 'sky-lancer' | 'lance-lord'
  // 음유시인 (추천)
  | 'bard' | 'minstrel' | 'dancer' | 'virtuoso' | 'blade-dancer';

export type JobTier = 1 | 2 | 3;
/** 동료 전투 AI가 나중에 쓸 역할 */
export type JobRole = 'melee' | 'tank' | 'ranged' | 'caster' | 'healer' | 'support';
export type WeaponKind = 'sword' | 'sword-shield' | 'bow' | 'staff' | 'dagger' | 'mace' | 'spear' | 'instrument';

export interface JobDef {
  id: JobId;
  name: string;
  tier: JobTier;
  /** 전직하기 전 직업 (기본 직업은 없음) */
  from?: JobId;
  role: JobRole;
  weapon: WeaponKind;
  /** 이 단계에서 더해지는 능력치 */
  stats: Partial<StatBlock>;
  /** 전직 시험 퀘스트 id (계획) */
  trial?: string;
  description: string;
}

/** 1차·2차 전직 레벨 (임시값, 최고 레벨 100) */
export const JOB_ADVANCE = { firstAdvanceLevel: 20, secondAdvanceLevel: 50 } as const;

export function advanceLevel(tier: JobTier): number {
  return tier === 1 ? 1 : tier === 2 ? JOB_ADVANCE.firstAdvanceLevel : JOB_ADVANCE.secondAdvanceLevel;
}

const job = (def: JobDef): JobDef => def;

export const JOBS: Record<JobId, JobDef> = {
  // ── 검사: 한손검. 균형 잡힌 근접. 시온의 계열 ──
  swordsman: job({ id: 'swordsman', name: '검사', tier: 1, role: 'melee', weapon: 'sword', stats: { str: 2, dex: 1, vit: 1 },
    description: '한손검을 다루는 기본 근접 직업. 공격·회피·막기를 고르게 쓴다.' }),
  blademaster: job({ id: 'blademaster', name: '검객', tier: 2, from: 'swordsman', role: 'melee', weapon: 'sword', stats: { str: 3, dex: 5 }, trial: 'trial-blademaster',
    description: '빠른 연속 베기와 치명타. 저스트 회피 뒤 반격이 강해진다.' }),
  spellblade: job({ id: 'spellblade', name: '마검사', tier: 2, from: 'swordsman', role: 'melee', weapon: 'sword', stats: { str: 5, dex: 2, vit: 1 }, trial: 'trial-spellblade',
    description: '검에 힘을 실어 베는 검사. 스킬 피해가 크고 검기가 멀리 나간다.' }),
  'sword-saint': job({ id: 'sword-saint', name: '검성', tier: 3, from: 'blademaster', role: 'melee', weapon: 'sword', stats: { str: 4, dex: 8 }, trial: 'trial-sword-saint',
    description: '검 하나로 극에 이른 사람. 콤보 마지막 타가 주변을 함께 벤다.' }),
  'twilight-blade': job({ id: 'twilight-blade', name: '황혼검사', tier: 3, from: 'spellblade', role: 'melee', weapon: 'sword', stats: { str: 7, dex: 3, vit: 2 }, trial: 'trial-twilight-blade',
    description: '빛과 허무의 경계를 검에 담는다. 공명 중 스킬이 한 단계 강해진다.' }),

  // ── 기사: 검과 방패. 앞에서 버틴다 ──
  knight: job({ id: 'knight', name: '기사', tier: 1, role: 'tank', weapon: 'sword-shield', stats: { vit: 2, def: 2 },
    description: '검과 방패로 앞을 지키는 직업. 막기가 길고 넉넉하다.' }),
  guardian: job({ id: 'guardian', name: '수호기사', tier: 2, from: 'knight', role: 'tank', weapon: 'sword-shield', stats: { vit: 4, def: 4 }, trial: 'trial-guardian',
    description: '적의 시선을 끌고 동료 대신 맞는다. 패링으로 적을 오래 휘청이게 한다.' }),
  paladin: job({ id: 'paladin', name: '성기사', tier: 2, from: 'knight', role: 'tank', weapon: 'sword-shield', stats: { vit: 4, def: 3, str: 1 }, trial: 'trial-paladin',
    description: '방패에 신성을 담는다. 막을 때마다 주변 아군의 체력을 조금 채운다.' }),
  bulwark: job({ id: 'bulwark', name: '불괴기사', tier: 3, from: 'guardian', role: 'tank', weapon: 'sword-shield', stats: { vit: 6, def: 6 }, trial: 'trial-bulwark',
    description: '무너지지 않는 성벽. 큰 공격도 방패로 받아 낸다.' }),
  'radiant-knight': job({ id: 'radiant-knight', name: '성광기사', tier: 3, from: 'paladin', role: 'tank', weapon: 'sword-shield', stats: { vit: 6, def: 4, str: 2 }, trial: 'trial-radiant-knight',
    description: '빛의 방벽으로 아군 전체를 감싼다.' }),

  // ── 궁수: 활. 멀리서 친다 ──
  archer: job({ id: 'archer', name: '궁수', tier: 1, role: 'ranged', weapon: 'bow', stats: { dex: 3, str: 1 },
    description: '활로 멀리서 치는 직업. 가까이 붙으면 물러나며 쏜다.' }),
  sniper: job({ id: 'sniper', name: '저격수', tier: 2, from: 'archer', role: 'ranged', weapon: 'bow', stats: { dex: 6, str: 2 }, trial: 'trial-sniper',
    description: '오래 겨눈 한 발로 큰 피해를 준다. 약점에 치명타가 잘 난다.' }),
  hunter: job({ id: 'hunter', name: '사냥꾼', tier: 2, from: 'archer', role: 'ranged', weapon: 'bow', stats: { dex: 5, vit: 2, str: 1 }, trial: 'trial-hunter',
    description: '빠른 연사와 덫. 발을 묶고 거리를 벌린다.' }),
  marksman: job({ id: 'marksman', name: '명사수', tier: 3, from: 'sniper', role: 'ranged', weapon: 'bow', stats: { dex: 9, str: 3 }, trial: 'trial-marksman',
    description: '한 줄로 늘어선 적을 한 발에 꿰뚫는다.' }),
  warden: job({ id: 'warden', name: '숲의 파수꾼', tier: 3, from: 'hunter', role: 'ranged', weapon: 'bow', stats: { dex: 7, vit: 3, str: 2 }, trial: 'trial-warden',
    description: '지형과 덫을 다루며 넓은 곳을 지킨다.' }),

  // ── 법사: 지팡이. 원소 마법 ──
  mage: job({ id: 'mage', name: '법사', tier: 1, role: 'caster', weapon: 'staff', stats: { str: 3, dex: 1 },
    description: '원소 마법을 쓰는 직업. 몸은 약하지만 넓게 친다.' }),
  elementalist: job({ id: 'elementalist', name: '원소술사', tier: 2, from: 'mage', role: 'caster', weapon: 'staff', stats: { str: 5, dex: 3 }, trial: 'trial-elementalist',
    description: '불·얼음·바람을 바꿔 가며 넓은 범위를 친다.' }),
  warder: job({ id: 'warder', name: '결계술사', tier: 2, from: 'mage', role: 'caster', weapon: 'staff', stats: { str: 4, def: 3, vit: 1 }, trial: 'trial-warder',
    description: '결계로 적을 묶고 아군을 지킨다. 피해보다 제어가 강하다.' }),
  archmage: job({ id: 'archmage', name: '대마법사', tier: 3, from: 'elementalist', role: 'caster', weapon: 'staff', stats: { str: 7, dex: 5 }, trial: 'trial-archmage',
    description: '두 원소를 겹쳐 큰 마법을 쓴다.' }),
  sealer: job({ id: 'sealer', name: '봉인술사', tier: 3, from: 'warder', role: 'caster', weapon: 'staff', stats: { str: 5, def: 5, vit: 2 }, trial: 'trial-sealer',
    description: '권속의 힘을 잠시 봉한다. 보스의 패턴을 끊는다.' }),

  // ── 도적: 단검. 빠르고 교활하다 ──
  rogue: job({ id: 'rogue', name: '도적', tier: 1, role: 'melee', weapon: 'dagger', stats: { dex: 3, str: 1 },
    description: '단검을 쓰는 날랜 직업. 뒤에서 치면 더 아프다.' }),
  assassin: job({ id: 'assassin', name: '암살자', tier: 2, from: 'rogue', role: 'melee', weapon: 'dagger', stats: { dex: 6, str: 2 }, trial: 'trial-assassin',
    description: '모습을 감췄다가 등 뒤에서 일격을 넣는다.' }),
  scout: job({ id: 'scout', name: '척후', tier: 2, from: 'rogue', role: 'melee', weapon: 'dagger', stats: { dex: 6, vit: 2 }, trial: 'trial-scout',
    description: '독과 연막으로 적을 흐트러뜨리고 길을 찾는다.' }),
  nightblade: job({ id: 'nightblade', name: '밤의 칼날', tier: 3, from: 'assassin', role: 'melee', weapon: 'dagger', stats: { dex: 9, str: 3 }, trial: 'trial-nightblade',
    description: '그림자를 건너 적 사이를 옮겨 다니며 벤다.' }),
  raider: job({ id: 'raider', name: '유격대장', tier: 3, from: 'scout', role: 'melee', weapon: 'dagger', stats: { dex: 9, vit: 3 }, trial: 'trial-raider',
    description: '덫과 독을 깔아 싸움터를 자기 편으로 만든다.' }),

  // ── 클레릭: 둔기와 신성. 회복 ──
  cleric: job({ id: 'cleric', name: '클레릭', tier: 1, role: 'healer', weapon: 'mace', stats: { vit: 2, def: 2 },
    description: '신성으로 아군을 치료하는 직업. 둔기로 몸도 지킨다.' }),
  priest: job({ id: 'priest', name: '사제', tier: 2, from: 'cleric', role: 'healer', weapon: 'mace', stats: { vit: 4, def: 3, dex: 1 }, trial: 'trial-priest',
    description: '회복과 정화에 힘을 쏟는다. 둔화·부식 같은 상태를 걷어 낸다.' }),
  'battle-priest': job({ id: 'battle-priest', name: '전투사제', tier: 2, from: 'cleric', role: 'melee', weapon: 'mace', stats: { str: 4, vit: 3, def: 1 }, trial: 'trial-battle-priest',
    description: '앞에서 둔기를 휘두르며, 때릴 때마다 아군을 조금씩 치료한다.' }),
  'high-priest': job({ id: 'high-priest', name: '대사제', tier: 3, from: 'priest', role: 'healer', weapon: 'mace', stats: { vit: 6, def: 4, dex: 2 }, trial: 'trial-high-priest',
    description: '쓰러진 동료를 곧바로 일으킨다.' }),
  inquisitor: job({ id: 'inquisitor', name: '심판관', tier: 3, from: 'battle-priest', role: 'melee', weapon: 'mace', stats: { str: 6, vit: 4, def: 2 }, trial: 'trial-inquisitor',
    description: '권속에게 특히 강한 신성의 일격.' }),

  // ── 창술사 (추천): 긴 창. 사거리와 돌진 ──
  lancer: job({ id: 'lancer', name: '창술사', tier: 1, role: 'melee', weapon: 'spear', stats: { str: 2, dex: 2 },
    description: '긴 창으로 칼보다 멀리 찌르고 휩쓴다. 검사보다 사거리가 길다.' }),
  dragoon: job({ id: 'dragoon', name: '용기병', tier: 2, from: 'lancer', role: 'melee', weapon: 'spear', stats: { str: 4, dex: 4 }, trial: 'trial-dragoon',
    description: '뛰어올라 내리찍고, 먼 적에게 돌진한다.' }),
  vanguard: job({ id: 'vanguard', name: '파진창사', tier: 2, from: 'lancer', role: 'melee', weapon: 'spear', stats: { str: 4, vit: 3, def: 1 }, trial: 'trial-vanguard',
    description: '창을 크게 휘둘러 무리를 밀어낸다.' }),
  'sky-lancer': job({ id: 'sky-lancer', name: '천공창', tier: 3, from: 'dragoon', role: 'melee', weapon: 'spear', stats: { str: 6, dex: 6 }, trial: 'trial-sky-lancer',
    description: '높이 솟았다가 넓은 범위를 꿰뚫는다.' }),
  'lance-lord': job({ id: 'lance-lord', name: '창왕', tier: 3, from: 'vanguard', role: 'melee', weapon: 'spear', stats: { str: 6, vit: 4, def: 2 }, trial: 'trial-lance-lord',
    description: '창 한 자루로 싸움터의 앞줄을 지운다.' }),

  // ── 음유시인 (추천): 악기. 아군 강화·적 약화 ──
  bard: job({ id: 'bard', name: '음유시인', tier: 1, role: 'support', weapon: 'instrument', stats: { dex: 2, vit: 2 },
    description: '노래로 아군을 북돋는 직업. 공명 게이지를 빨리 채운다.' }),
  minstrel: job({ id: 'minstrel', name: '가객', tier: 2, from: 'bard', role: 'support', weapon: 'instrument', stats: { dex: 4, vit: 3, def: 1 }, trial: 'trial-minstrel',
    description: '아군의 공격과 이동을 노래로 올린다.' }),
  dancer: job({ id: 'dancer', name: '무희', tier: 2, from: 'bard', role: 'support', weapon: 'instrument', stats: { dex: 6, vit: 2 }, trial: 'trial-dancer',
    description: '춤으로 적의 눈을 빼앗아 공격을 빗나가게 한다.' }),
  virtuoso: job({ id: 'virtuoso', name: '명창', tier: 3, from: 'minstrel', role: 'support', weapon: 'instrument', stats: { dex: 6, vit: 4, def: 2 }, trial: 'trial-virtuoso',
    description: '한 곡으로 싸움의 흐름을 바꾼다.' }),
  'blade-dancer': job({ id: 'blade-dancer', name: '검무희', tier: 3, from: 'dancer', role: 'melee', weapon: 'instrument', stats: { dex: 9, str: 3 }, trial: 'trial-blade-dancer',
    description: '춤이 곧 칼이 된다. 회피할 때마다 주변을 벤다.' }),
};

export const JOB_IDS = Object.keys(JOBS) as JobId[];
export const BASE_JOBS: JobId[] = JOB_IDS.filter(id => JOBS[id].tier === 1);

/** 주인공 시온의 계열 */
export const HERO_JOB_ROOT: JobId = 'swordsman';

/** 동료의 직업. 조안은 삿대를 다루던 사공이라 창술사 */
export const COMPANION_JOBS: Record<CompanionId, JobId> = { joan: 'lancer' };

export function isJobId(id: unknown): id is JobId {
  return typeof id === 'string' && Object.hasOwn(JOBS, id);
}

/** 기본 직업부터 이 직업까지의 경로 */
export function jobPath(id: JobId): JobId[] {
  const path: JobId[] = [];
  for (let cur: JobId | undefined = id; cur; cur = JOBS[cur].from) path.unshift(cur);
  return path;
}

/** 이 직업이 속한 계열의 기본 직업 */
export function jobRoot(id: JobId): JobId {
  return jobPath(id)[0];
}

/** 이 직업에서 전직할 수 있는 다음 직업들 */
export function nextJobs(id: JobId): JobId[] {
  return JOB_IDS.filter(next => JOBS[next].from === id);
}

/** 거쳐 온 단계의 능력치 보너스를 모두 더한다 */
export function jobStatBonus(id: JobId): Partial<StatBlock> {
  const out: Partial<StatBlock> = {};
  for (const step of jobPath(id)) {
    for (const [stat, value] of Object.entries(JOBS[step].stats) as [keyof StatBlock, number][]) {
      out[stat] = (out[stat] ?? 0) + value;
    }
  }
  return out;
}

export type AdvanceBlock = 'not-next' | 'level' | 'trial' | 'hero-line';

/**
 * from에서 to로 전직할 수 있는지. 안 되면 이유를 돌려준다.
 * hero가 true면 검사 계열만 허용한다. trialsDone은 끝낸 퀘스트 id.
 */
export function advanceBlock(from: JobId, to: JobId, level: number, trialsDone: ReadonlySet<string>, hero = false): AdvanceBlock | undefined {
  const target = JOBS[to];
  if (target.from !== from) return 'not-next';
  if (hero && jobRoot(to) !== HERO_JOB_ROOT) return 'hero-line';
  if (level < advanceLevel(target.tier)) return 'level';
  if (target.trial && !trialsDone.has(target.trial)) return 'trial';
  return undefined;
}

export const HERO_JOB_SAVE_KEY = 'untitled-rpg.job';

/**
 * 저장된 주인공 직업을 읽는다. 모르는 값이나 검사 계열이 아니면 검사.
 * 레벨이 모자란 단계(깨진 저장)는 그 레벨에서 가능한 단계까지 내린다.
 */
export function parseHeroJob(raw: string | null, level: number): JobId {
  if (!isJobId(raw) || jobRoot(raw) !== HERO_JOB_ROOT) return HERO_JOB_ROOT;
  let id: JobId = raw;
  while (level < advanceLevel(JOBS[id].tier) && JOBS[id].from) id = JOBS[id].from!;
  return id;
}
