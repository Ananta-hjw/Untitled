import type { MapId } from '../world/maps.ts';
import { INTERIORS, interiorArtPoint, interiorShop } from '../world/interiors.ts';
import { chapterPhase } from './chapterOne.ts';
import { PASS_FIRE } from '../world/eastPass.ts';
import type { QuestState } from './quests.ts';

/**
 * 쉬어 갈 수 있는 곳 (저장 지점).
 *
 * 여관의 로제타나 고개 쉼터의 도르에게 말을 건 뒤 "쉬어 가기"를 고르거나, 시온의 집 침대 앞에서 "쉬기"를 누르면
 * 체력이 다 차고, 다음에 처음 화면에서 시작하기를 누를 때 그 자리에서 시작한다.
 * 레벨·퀘스트·아이템은 원래 바로바로 저장되므로, 여기서 저장하는 것은 "다시 시작할 자리"뿐이다.
 * 습격의 밤에는 쉴 수 없다(여관은 피난처라 쉴 때가 아니다).
 * 이 파일은 Phaser를 쓰지 않아 tools/rest-points.test.mjs가 직접 불러 검사한다.
 */

export type RestPointId = 'inn' | 'home' | 'shelter' | 'ferry-inn';

export interface RestPoint {
  id: RestPointId;
  /** 처음 화면 등에 보여 줄 장소 이름 */
  name: string;
  map: MapId;
  /** 다시 시작할 때 서는 자리 */
  at: { x: number; y: number };
}

const home = INTERIORS.find((i) => i.id === 'home')!;
const rosetta = interiorShop('inn');

export const REST_POINTS: Record<RestPointId, RestPoint> = {
  // 로제타의 카운터 바로 앞
  inn: { id: 'inn', name: '여관', map: 'in-inn', at: { x: rosetta.x, y: rosetta.y + rosetta.talkOffset + 40 } },
  // 시온의 집 침대 앞 (원화 좌표)
  home: { id: 'home', name: '시온의 집', map: 'in-home', at: interiorArtPoint(home, 1000, 530) },
  // 2장: 동쪽 고갯길의 돌 쉼터, 도르의 모닥불 앞 (퀘스트 "고개의 쉼터" 뒤로 도르에게 말해 쉬어 간다)
  shelter: { id: 'shelter', name: '고개 쉼터', map: 'east-pass', at: { x: PASS_FIRE.x - 70, y: PASS_FIRE.y + 80 } },
  // 2장: 물안개 나루 여관 앞, 여관 주인 곁 (퀘스트 "멈춘 나루"를 받은 뒤 여관 주인에게 말해 쉬어 간다). 건물 실내는 아직 없다.
  'ferry-inn': { id: 'ferry-inn', name: '물안개 나루 여관', map: 'ferry-village', at: { x: 2170, y: 1400 } },
};

/** 시온의 집 침대 앞의 "쉬기" 자리 */
export const HOME_BED_SPOT = { id: 'rest-home', ...interiorArtPoint(home, 1000, 520), radius: 95, markerHeight: 150 };

const clinic = INTERIORS.find((i) => i.id === 'clinic')!;

/**
 * 치유소 아래쪽 빈 침대 옆의 "치료받기" 자리 (에일라·리네아 간호 동선과 겹치지 않게 아래쪽 침대 옆에 둔다).
 * 체력을 다 채우고 잿빛 나방의 둔화를 풀지만, 다시 시작할 자리는 저장하지 않는다(저장은 집과 여관).
 * 습격의 밤에도 치료는 받을 수 있다.
 */
export const CLINIC_BED_SPOT = { id: 'heal-clinic', ...interiorArtPoint(clinic, 515, 675), radius: 75, markerHeight: 150 };

/**
 * 약초 기운: 치유소에서 치료받으면 최대 체력이 기본의 HERB_BONUS_RATIO만큼 오르고 그만큼 채워진다.
 * 시간으로 끝나지 않고, 처음으로 체력이 깎일 때(맞을 때) 사라진다. 맵을 옮겨도 이어지고,
 * 쓰러지거나 게임을 다시 켜면 사라진다. 여러 번 치료받아도 겹치지 않는다.
 */
export const HERB_BONUS_RATIO = 0.1;

/** 기본 최대 체력에 붙는 약초 기운의 양 */
export function herbBonus(baseMaxHp: number): number {
  return Math.max(1, Math.round(baseMaxHp * HERB_BONUS_RATIO));
}

/** 지금 쉴 수 있는지. 습격의 밤에는 쉴 수 없다. */
export function canRest(state: QuestState): boolean {
  return chapterPhase(state) !== 'raid';
}

export const REST_SAVE_KEY = 'untitled-rpg.rest';

export function serializeRestPoint(id: RestPointId): string {
  return JSON.stringify({ version: 1, point: id });
}

/** 저장된 값에서 쉰 곳을 읽는다. 모르는 값이나 깨진 값은 버린다(새 게임처럼 시온의 집 앞에서 시작). */
export function parseRestPoint(raw: string | null): RestPoint | undefined {
  if (!raw) return undefined;
  try {
    const data: unknown = JSON.parse(raw);
    const id = (data as { point?: unknown })?.point;
    return typeof id === 'string' && Object.hasOwn(REST_POINTS, id) ? REST_POINTS[id as RestPointId] : undefined;
  } catch {
    return undefined;
  }
}

