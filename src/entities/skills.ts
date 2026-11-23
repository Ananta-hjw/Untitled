/**
 * 기술 배우기 (Phaser를 쓰지 않아 tools/skills.test.mjs가 직접 불러 검사한다).
 *
 * 기술은 이야기에서 배운다(퀘스트 보상 rewardSkill). 배운 기술은 비어 있는 첫 기술 칸에 저절로 들어간다.
 * 배운 기술과 칸 배치는 untitled-rpg.skills에 저장해 맵을 옮기거나 다시 켜도 이어진다.
 * 첫 기술은 2장 "떠날 채비"에서 루안에게 배우는 회전 베기다(docs/story-chapter2.md).
 */

export type SkillId = 'spin';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** 기술 칸에 쓰는 짧은 이름 */
  label: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  spin: { id: 'spin', name: '회전 베기', label: '회전베기' },
};

export function isSkillId(id: unknown): id is SkillId {
  return typeof id === 'string' && Object.hasOwn(SKILLS, id);
}

export interface SkillState {
  /** 배운 기술 (배운 순서) */
  learned: SkillId[];
  /** 기술 칸. 빈 칸은 null */
  slots: (SkillId | null)[];
}

export function emptySkills(slotCount: number): SkillState {
  return { learned: [], slots: Array<SkillId | null>(slotCount).fill(null) };
}

/** 기술을 배운다. 처음 배우면 비어 있는 첫 칸에 넣는다. 이미 배웠으면 그대로. */
export function learnSkill(state: SkillState, id: SkillId): { state: SkillState; learned: boolean } {
  if (state.learned.includes(id)) return { state, learned: false };
  const slots = [...state.slots];
  const empty = slots.indexOf(null);
  if (empty >= 0 && !slots.includes(id)) slots[empty] = id;
  return { state: { learned: [...state.learned, id], slots }, learned: true };
}

export const SKILL_SAVE_KEY = 'untitled-rpg.skills';
export const SKILL_SAVE_VERSION = 1;

/** 저장을 읽는다. 깨졌거나 모르는 기술, 배우지 않은 기술이 든 칸은 버린다. 칸 수는 지금 화면에 맞춘다. */
export function parseSkills(raw: string | null, slotCount: number): SkillState {
  const empty = emptySkills(slotCount);
  if (!raw) return empty;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return empty; }
  if (typeof data !== 'object' || data === null) return empty;
  const { version, learned, slots } = data as { version?: unknown; learned?: unknown; slots?: unknown };
  if (version !== SKILL_SAVE_VERSION || !Array.isArray(learned)) return empty;
  const known = [...new Set(learned.filter(isSkillId))];
  const placed = Array.isArray(slots) ? slots : [];
  const result: (SkillId | null)[] = [];
  for (let i = 0; i < slotCount; i++) {
    const id = placed[i];
    result.push(isSkillId(id) && known.includes(id) && !result.includes(id) ? id : null);
  }
  return { learned: known, slots: result };
}

export function serializeSkills(state: SkillState): string {
  return JSON.stringify({ version: SKILL_SAVE_VERSION, learned: state.learned, slots: state.slots });
}
