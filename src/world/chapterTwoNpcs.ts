import type { ChapterTwoNpcId, NpcDef } from './npcs.ts';

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
