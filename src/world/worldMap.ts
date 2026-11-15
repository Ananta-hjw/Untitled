import type { MapId } from './maps.ts';

/**
 * 전체 지도 (미니맵을 누르면 열린다).
 *
 * 지역마다 지도 위의 칸 위치(gx, gy: 로웬 마을이 가운데 0, 0)와 이어진 길을 정한다.
 * 가 본 지역은 이름과 모습을, 안 가 본 지역은 "?"로 보여 준다. 건물 실내는 로웬 마을에 속한다.
 * 북쪽 유적처럼 아직 갈 수 없는 곳(mapId 없음)은 늘 "?"로 남는다.
 * 가 본 지역은 기기에 따로 저장한다(untitled-rpg.visited).
 * 이 파일은 Phaser를 쓰지 않아 tools/world-map.test.mjs가 직접 불러 검사한다.
 */

export type RegionId = 'village' | 'south-field' | 'west-forest' | 'east-stream' | 'north-ruins';

export interface Region {
  id: RegionId;
  name: string;
  /** 갈 수 있는 맵. 없으면 아직 갈 수 없는 곳이다. */
  mapId?: MapId;
  gx: number;
  gy: number;
  /** 지도 칸에 깔 땅의 색조 (맵의 groundTint와 맞춘다) */
  tint?: number;
}

export const REGIONS: Region[] = [
  { id: 'village', name: '로웬 마을', mapId: 'village', gx: 0, gy: 0 },
  { id: 'south-field', name: '남쪽 들판', mapId: 'south-field', gx: 0, gy: 1, tint: 0xf2ecc8 },
  { id: 'west-forest', name: '서쪽 숲길', mapId: 'west-forest', gx: -1, gy: 0, tint: 0xb9cfa4 },
  { id: 'east-stream', name: '동쪽 개울가', mapId: 'east-stream', gx: 1, gy: 0, tint: 0xd6e8da },
  // 헤르만의 서신 뒤에 열리는 베르넬의 유적 (docs/story-chapter1.md). 아직 맵이 없다.
  { id: 'north-ruins', name: '북쪽 유적', gx: 0, gy: -1 },
];

/** 지도에 그리는 길 */
export const ROUTES: Array<[RegionId, RegionId]> = [
  ['village', 'south-field'],
  ['village', 'west-forest'],
  ['village', 'east-stream'],
  ['village', 'north-ruins'],
];

/** 맵이 속한 지역. 건물 실내와 마을 북쪽도 로웬 마을이다. */
export function regionOf(mapId: MapId): RegionId {
  if (mapId.startsWith('in-') || mapId === 'village-north') return 'village';
  return REGIONS.find((r) => r.mapId === mapId)?.id ?? 'village';
}

// ---------------------------------------------------------------- 저장

export const VISITED_SAVE_KEY = 'untitled-rpg.visited';

/** 저장된 문자열에서 가 본 지역을 읽는다. 모르는 값은 버린다. */
export function parseVisited(raw: string | null): Set<RegionId> {
  const set = new Set<RegionId>();
  if (!raw) return set;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return set;
    for (const id of data) if (REGIONS.some((r) => r.id === id && r.mapId)) set.add(id as RegionId);
  } catch {
    // 깨진 저장은 버린다.
  }
  return set;
}

export function serializeVisited(visited: Set<RegionId>): string {
  return JSON.stringify(REGIONS.map((r) => r.id).filter((id) => visited.has(id)));
}
