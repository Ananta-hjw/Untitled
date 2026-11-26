import type { ChapterTwoNpcId, NpcDef, SuccessorNpcId } from './npcs.ts';

/** 2장 배치를 위한 인물 정의. 실제 지역·구출 단계는 2장 맵을 구현할 때 지정한다. */
export const CHAPTER_TWO_CAST: ReadonlyArray<{
  id: ChapterTwoNpcId; name: string; role: string; height: number;
}> = [
  { id: 'evan', name: '에반', role: '나루의 사공', height: 148 },
  { id: 'joan', name: '조안', role: '젊은 사공', height: 142 },
  { id: 'marta', name: '마르타', role: '대장장이', height: 138 },
  { id: 'morgan', name: '모르간', role: '나루의 후원자', height: 150 },
  { id: 'finn', name: '핀', role: '여관의 소년', height: 116 },
  { id: 'dor', name: '도르', role: '고개 쉼터의 약초꾼', height: 144 },
];

/** 개발용 확인 모드. 구출 전의 조안까지 모아 보여 주므로 본편 배치에는 사용하지 않는다. */
export function chapterTwoPreviewNpcs(at: { x: number; y: number }): NpcDef[] {
  return CHAPTER_TWO_CAST.map((npc, i) => ({
    ...npc, dialogue: `npc-${npc.id}`,
    x: at.x + (i % 3 - 1) * 240,
    y: at.y - 240 + Math.floor(i / 3) * 240,
  }));
}

/** Unnamed supporting character; kept out of the story until the ferry village exists. */
export const FOG_INNKEEPER: NpcDef = {
  id: 'fog-innkeeper', name: '여관 주인', role: '핀의 아버지',
  x: 1820, y: 1540, height: 148, dialogue: 'npc-fog-innkeeper', facing: 'down',
};

/** Supporting cast whose ferry village/events have not yet been implemented. */
export const SUPPORTING_CAST: readonly NpcDef[] = [
  FOG_INNKEEPER,
  { id: 'ferry-fisher', name: '나루 어부', role: '나루의 어부', x: 0, y: 0, height: 146, dialogue: 'npc-ferry-fisher' },
  { id: 'innkeeper-wife', name: '핀의 어머니', role: '나루 여관 안주인', x: 0, y: 0, height: 138, dialogue: 'npc-innkeeper-wife' },
  { id: 'toby', name: '토비', role: '마르타의 견습생', x: 0, y: 0, height: 128, dialogue: 'npc-toby' },
  { id: 'bell-ringer', name: '종을 울리던 사내', role: '모르간의 부하', x: 0, y: 0, height: 146, dialogue: 'npc-bell-ringer' },
  { id: 'bell-ringer-mother', name: '사내의 어머니', role: '약값 의뢰의 대상', x: 0, y: 0, height: 118, dialogue: 'npc-bell-ringer-mother' },
  { id: 'mill-apprentice', name: '방앗간 젊은이', role: '방앗간 일꾼', x: 0, y: 0, height: 142, dialogue: 'npc-mill-apprentice' },
  { id: 'fisher-daughter', name: '어부의 딸', role: '실종된 어부의 가족', x: 0, y: 0, height: 130, dialogue: 'npc-fisher-daughter' },
  { id: 'herbalist-elder', name: '약초 가게 할머니', role: '나루의 약초 상인', x: 0, y: 0, height: 124, dialogue: 'npc-herbalist-elder' },
];

/** Future-story appearances are available to the engine, without early story placement. */
export const SUCCESSOR_CAST: ReadonlyArray<{ id: SuccessorNpcId; name: string; role: string; height: number }> = [
  { id: 'bram', name: '브람', role: '피난민의 보호자', height: 158 },
  { id: 'mirel', name: '미렐', role: '치유자', height: 144 },
  { id: 'kairen', name: '카이렌', role: '기사단장', height: 158 },
  { id: 'velka', name: '벨카', role: '여행자', height: 150 },
  { id: 'razen', name: '라젠', role: '정보상', height: 152 },
];
export type CastPreviewGroup = 'chapter2' | 'support' | 'successors' | 'all' | 'innkeeper';
export function isCastPreviewGroup(value: string | null): value is CastPreviewGroup {
  return value !== null && ['chapter2', 'support', 'successors', 'all', 'innkeeper'].includes(value);
}
export function previewCastNpcs(group: CastPreviewGroup, at: { x: number; y: number }): NpcDef[] {
  if (group === 'chapter2') return chapterTwoPreviewNpcs(at);
  if (group === 'innkeeper') return [{ ...FOG_INNKEEPER, ...at }];
  const successors: NpcDef[] = SUCCESSOR_CAST.map(n => ({ ...n, x: 0, y: 0, dialogue: `npc-${n.id}`, wander: 60 }));
  const base = group === 'support' ? SUPPORTING_CAST : group === 'successors' ? successors
    : [...chapterTwoPreviewNpcs(at), ...SUPPORTING_CAST, ...successors];
  const columns = group === 'all' ? 5 : 3;
  return base.map((n, i) => ({ ...n, x: at.x + (i % columns - (columns - 1) / 2) * 290,
    y: at.y - 270 + Math.floor(i / columns) * 270 }));
}
