import type { QuestId, QuestState } from './quests.ts';

/**
 * 초반 전투 가이드. 스승 루안과 마을 사람들에게 하나씩 배우는 수련 퀘스트(story/quests.ts의 tutorial)마다
 * 연습을 시작하는 순간 시스템 안내 창을 한 번 띄우고, 연습하는 동안 해당 버튼을 반짝여 알려 준다.
 *   공격(루안, 마지막 수련) → 회피(루안) → 막기·패링(루안, 들판의 슬라임) → 물약(에일라) → 공명(베르넬)
 * 본 안내는 기기에 따로 적어 두어(GUIDE_SAVE_KEY) 다시 띄우지 않는다.
 * 이 파일은 Phaser를 쓰지 않아 tools/tutorial.test.mjs가 직접 불러 검사한다.
 */

export type LessonId = 'attack' | 'dodge' | 'parry' | 'potion' | 'resonance';
/** 반짝여 알려 줄 버튼 */
export type GuideButton = 'attack' | 'dodge' | 'block' | 'item' | 'resonance';

export interface Lesson {
  id: LessonId;
  /** 이 수련 퀘스트의 이 단계가 진행 중일 때가 연습 시간이다. */
  quest: QuestId;
  step: number;
  /** 가르쳐 준 사람 (창 머리에 보인다) */
  teacher: string;
  title: string;
  /** 시스템 안내 (한 줄씩) */
  lines: string[];
  button: GuideButton;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'attack', quest: 'ruan-training', step: 0, teacher: '루안', title: '공격', button: 'attack',
    lines: [
      '오른쪽 아래 공격 버튼(키보드 Space·J)을 누르면 칼을 휘두릅니다.',
      '이어서 누르면 3단 콤보가 되고, 세 번째 일격(마무리)이 가장 강합니다. 누르고 있어도 이어집니다.',
      '가까운 적 쪽으로 저절로 돌아서고, 칼날에 닿은 적만 맞습니다.',
    ],
  },
  {
    id: 'dodge', quest: 'ruan-dodge', step: 0, teacher: '루안', title: '회피', button: 'dodge',
    lines: [
      '오른쪽 아래 모서리의 회피 버튼(Shift·K)을 누르면 조이스틱 방향으로 빠르게 몸을 뺍니다. 빠지는 동안에는 맞지 않습니다.',
      '적이 덤벼드는 순간 피하면 저스트 회피: 잠깐 느려지며 회피 대기 시간이 30% 줄고, 다음 공격은 반격 일섬(2배)이 됩니다.',
      '한 번 쓰면 다시 쓰기까지 시간이 걸립니다(버튼의 원형 표시).',
    ],
  },
  {
    id: 'parry', quest: 'ruan-parry', step: 0, teacher: '루안', title: '막기 · 패링', button: 'block',
    lines: [
      '막기(L)를 누르면 0.3초간 바라보는 8방향에서 오는 공격을 막습니다. 길게 모아 떼면 강력한 차지 패링이 나갑니다.',
      '정확한 순간은 정밀 패링(무피해·적의 힘 흡수·공명 충전·회피 1초 단축)이며, 원거리 공격은 온 방향으로 되돌려 보냅니다.',
      '조금 늦으면 불완전 막기(회복 가능한 내상)입니다. 헛막기 뒤엔 0.45초간 다시 막을 수 없고, 다른 방향 공격은 못 막습니다.',
    ],
  },
  {
    id: 'potion', quest: 'eila-potion', step: 1, teacher: '에일라', title: '물약', button: 'item',
    lines: [
      '아래쪽 물약 칸(Q·R)을 누르면 가진 회복 아이템 중 하나를 골라 등록합니다.',
      '등록한 칸을 누르면 바로 마십니다. 체력이 가득 차 있으면 마실 수 없고, 한 번 쓰면 20초 뒤에 다시 쓸 수 있습니다.',
      '등록을 바꾸려면 칸을 길게 누르세요. 가방에서도 쓸 수 있습니다.',
    ],
  },
  {
    id: 'resonance', quest: 'vernel-resonance', step: 1, teacher: '베르넬', title: '공명', button: 'resonance',
    lines: [
      '패링에 성공할 때마다 체력 막대 옆 구슬이 1/3씩 찹니다. 다섯 개가 다 차야 쓸 수 있습니다.',
      '공명 버튼(F)을 누르면 10초 동안 공격력·이동 속도 1.2배, 받는 피해 80%가 됩니다.',
      '이번 한 번은 연습할 수 있게 구슬을 가득 채워 두었습니다. 공명을 써 보세요.',
    ],
  },
];

export const GUIDE_SAVE_KEY = 'untitled-rpg.guide';

/** 지금 연습 중인 수련 (그 퀘스트의 그 단계가 진행 중일 때) */
export function activeLesson(state: QuestState): Lesson | undefined {
  return LESSONS.find((l) => state[l.quest]?.status === 'active' && (state[l.quest]!.step ?? 0) === l.step);
}

/** 이번에 안내 창을 띄울 수련: 연습 중이고 아직 안내를 본 적이 없을 때 */
export function lessonToShow(state: QuestState, seen: ReadonlySet<LessonId>): Lesson | undefined {
  const lesson = activeLesson(state);
  return lesson && !seen.has(lesson.id) ? lesson : undefined;
}

/** 본 안내 목록을 읽는다. 깨졌거나 모르는 값은 버린다. */
export function parseSeenLessons(raw: string | null): Set<LessonId> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    const ids = new Set(LESSONS.map((l) => l.id));
    return new Set(Array.isArray(data) ? data.filter((id): id is LessonId => ids.has(id as LessonId)) : []);
  } catch {
    return new Set();
  }
}

export function serializeSeenLessons(seen: ReadonlySet<LessonId>): string {
  return JSON.stringify([...seen]);
}
