import type { DialogueId } from '../story/dialogues.ts';
import { interiorShop, type InteriorId } from './interiors.ts';
import { LINEA_YARD, type VillageArea } from './villageLayout.ts';

/**
 * 로웬 마을 사람들 (docs/story.md 마을 사람들, docs/rowen-village.md 배치).
 *
 * 모두 8방향 걷기 그림(walk_cardinal/walk_diagonal 시트)으로 그린다.
 * 장사를 하는 사람(도란, 메리나, 로제타)은 가게 안(실내 맵)에 서서 시온 쪽을 돌아볼 뿐 걷지 않는다.
 * 치유사 에일라는 낮에는 치유소 안에서 지낸다(가게 주인은 아니라 조금씩 오간다).
 * 나머지는 자기 자리 주변을 천천히 돌아다닌다.
 * 페른은 습격 다음 날 도착하므로(docs/story-chapter1.md) 첫날에는 없다.
 * 이 파일은 Phaser를 쓰지 않아 tools/npcs.test.mjs가 직접 불러 검사한다.
 */

export type NamedNpcId =
  | 'serena' | 'sia' | 'linea' | 'ruan' | 'herman' | 'eila'
  | 'merina' | 'doran' | 'rosetta' | 'vernel' | 'teon';

export type NpcSkin = NamedNpcId | 'soldier';
export type NpcId = NamedNpcId | `guard-${string}`;

export interface NpcDef {
  id: NpcId;
  /** 여러 일반 병사는 위치·대화만 다르고 하나의 그래픽을 공유한다. */
  skin?: NpcSkin;
  facing?: Direction8;
  /** 머리 위 이름표와 대화창에 나오는 이름 */
  name: string;
  /** 하는 일 (문서용, 화면에는 아직 쓰지 않는다) */
  role: string;
  /** 처음 서 있는 자리 (발 위치) */
  x: number;
  y: number;
  /** 화면에 그리는 키 (발에서 머리끝까지) */
  height: number;
  dialogue: DialogueId;
  /** 가게를 지키는 사람. 돌아다니지 않는다. */
  shop?: boolean;
  /** 돌아다니는 범위 (처음 자리에서의 반지름). 장사하는 사람은 없다(서 있는다). */
  wander?: number;
  /** 건물 안에 있으면 그 실내. 없으면 바깥(area)에 있다. */
  inside?: InteriorId;
  /** 바깥에 있을 때 어느 마을 맵인지. 없으면 광장(village) */
  area?: VillageArea;
  /** 카운터 뒤처럼 바로 다가갈 수 없는 자리면, 말을 거는 자리를 이만큼 앞(아래)으로 옮긴다. */
  talkOffset?: number;
}

export function npcSkin(def: NpcDef): NpcSkin { return def.skin ?? def.id as NamedNpcId; }

export const NPCS: NpcDef[] = [
  // 북쪽 맵: 집들 앞
  { id: 'serena', name: '세레나', role: '시온의 어머니', area: 'village-north', x: 700, y: 600, height: 148, dialogue: 'npc-serena', wander: 110 },
  { id: 'sia', name: '시아', role: '시온의 여동생', area: 'village-north', x: 290, y: 680, height: 132, dialogue: 'npc-sia', wander: 150 },
  { id: 'linea', name: '리네아', role: '시온의 친한 친구', area: 'village-north', ...LINEA_YARD, height: 142, dialogue: 'npc-linea', wander: 100 },
  { id: 'herman', name: '헤르만', role: '촌장', area: 'village-north', x: 1290, y: 525, height: 150, dialogue: 'npc-herman', wander: 100 },
  // 광장
  { id: 'ruan', name: '루안', role: '첫 스승', x: 780, y: 900, height: 156, dialogue: 'npc-ruan', wander: 120 },
  // 장사하는 사람은 가게 안: 메리나와 로제타는 카운터 뒤, 도란은 모루 옆
  { id: 'merina', name: '메리나', role: '잡화점 주인', ...interiorShop('store'), height: 144, dialogue: 'npc-merina', shop: true },
  { id: 'doran', name: '도란', role: '대장장이', ...interiorShop('smithy'), height: 156, dialogue: 'npc-doran', shop: true },
  { id: 'rosetta', name: '로제타', role: '여관 주인', ...interiorShop('inn'), height: 146, dialogue: 'npc-rosetta', shop: true },
  // 치유사 에일라는 낮에는 치유소 안에서 조금씩 오간다. 습격 뒤 자리는 story/chapterOne.ts가 정한다.
  { id: 'eila', name: '에일라', role: '치유사', ...interiorShop('clinic'), talkOffset: 0, height: 146, dialogue: 'npc-eila', wander: 70 },
  { id: 'vernel', name: '베르넬', role: '유적 연구자', x: 1660, y: 1610, height: 150, dialogue: 'npc-vernel', wander: 70 },
  { id: 'teon', name: '테온', role: '경비대원', x: 1340, y: 1450, height: 150, dialogue: 'npc-teon', wander: 100 },
];

/**
 * 마을 사람은 맵 안을 넓게 돌아다닌다: 지금 자리에서 이 거리 안의 아무 곳이나 다음 목적지로 고른다.
 * 처음 자리에 묶이지 않으므로 시간이 지나면 맵 곳곳으로 퍼진다. 순찰 병사만 자기 자리 주변(wander)을 돈다.
 */
export const NPC_ROAM_HOP = 520;
/** 말을 건 뒤 그 자리에 서서 플레이어 쪽을 보고 있는 시간(ms, 게임 시계). 대화 중에는 시계가 멈춘다. */
export const NPC_TALK_PAUSE_MS = 2500;
export const NPC_WALK_SPEED = 78;
/**
 * 한 걸음에 나아가는 거리 (키에 대한 비율). 걷기 시트의 옆모습에서 잰 보폭(키의 약 0.26~0.33)에 맞췄다.
 * 걸음 그림은 시간이 아니라 걸은 거리에 맞춰 넘긴다. 그래야 발이 바닥에서 미끄러지지 않는다.
 */
export const NPC_STEP_RATIO = 0.29;

/**
 * 걸은 거리(px)에 해당하는 걷기 그림. poses는 한 주기(두 걸음)의 그림 순서다(예: [1, 2, 3, 2]).
 * 한 그림이 반 걸음을 맡는다.
 */
export function walkPose(distance: number, height: number, poses: readonly number[]): number {
  const perPose = (NPC_STEP_RATIO * height * 2) / poses.length;
  return poses[Math.floor(Math.max(0, distance) / perPose) % poses.length];
}

export type Direction8 = 'down' | 'down-right' | 'right' | 'up-right' | 'up' | 'up-left' | 'left' | 'down-left';

const DIRECTIONS: Direction8[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

/** 이동 방향(화면 좌표, y는 아래로 +)에 가장 가까운 8방향 */
export function direction8(dx: number, dy: number, fallback: Direction8 = 'down'): Direction8 {
  if (dx === 0 && dy === 0) return fallback;
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return DIRECTIONS[(index + 8) % 8];
}

/**
 * 다음에 걸어갈 곳. 처음 자리를 중심으로 반지름 안에서 고르고, 걸을 수 없거나 곧게 갈 수 없으면 다시 고른다.
 * 마땅한 곳이 없으면 처음 자리로 돌아간다. rand는 0 이상 1 미만의 수를 돌려준다.
 */
export function pickWanderTarget(
  home: { x: number; y: number }, radius: number, rand: () => number,
  canGo: (x: number, y: number) => boolean,
): { x: number; y: number } {
  for (let i = 0; i < 10; i++) {
    const angle = rand() * Math.PI * 2;
    const distance = radius * (0.35 + 0.65 * rand());
    const x = home.x + Math.cos(angle) * distance;
    const y = home.y + Math.sin(angle) * distance * 0.6;
    if (canGo(x, y)) return { x, y };
  }
  return { x: home.x, y: home.y };
}

/** 맵 안을 자유롭게 돌아다니는지 (순찰 병사는 자기 자리 주변만, 장사하는 사람은 서 있다) */
export function roamsFreely(def: NpcDef): boolean {
  return def.wander !== undefined && !def.id.startsWith('guard-');
}

/**
 * 자유롭게 돌아다니는 사람의 다음 목적지: 지금 자리에서 NPC_ROAM_HOP 안의 갈 수 있는 곳.
 * 멀리 있는 곳부터 고르려고 거리의 하한을 둔다. 마땅한 곳이 없으면 없음(undefined) — 잠시 쉬고 다시 고른다.
 */
export function pickRoamTarget(
  from: { x: number; y: number }, rand: () => number, canGo: (x: number, y: number) => boolean,
): { x: number; y: number } | undefined {
  for (let i = 0; i < 16; i++) {
    const angle = rand() * Math.PI * 2;
    const distance = NPC_ROAM_HOP * (i < 8 ? 0.45 + 0.55 * rand() : 0.15 + 0.4 * rand());
    const x = from.x + Math.cos(angle) * distance;
    const y = from.y + Math.sin(angle) * distance * 0.7;
    if (canGo(x, y)) return { x, y };
  }
  return undefined;
}

/** 한 곳에 도착한 뒤 쉬는 시간 (ms) */
export function wanderPauseMs(rand: () => number): number {
  return 1500 + rand() * 2500;
}

/** 성능 테스트에서 고를 수 있는 인원 (0 = 끔). 일시정지 메뉴에서 차례로 바꾼다. */
export const STRESS_STEPS = [0, 50, 100, 200] as const;

export function nextStressCount(current: number): number {
  const i = STRESS_STEPS.indexOf(current as (typeof STRESS_STEPS)[number]);
  return STRESS_STEPS[(i + 1) % STRESS_STEPS.length];
}

/**
 * 성능 테스트용 마을 사람: 기존 사람들의 그림을 돌려 쓰며 count명을 마을 곳곳에 세운다.
 * 모두 돌아다니게 해서 가장 무거운 경우를 잰다. canStand는 서 있을 수 있는 곳인지 판단한다.
 */
export function stressNpcs(
  count: number, base: readonly NpcDef[], rand: () => number,
  bounds: { left: number; top: number; right: number; bottom: number },
  canStand: (x: number, y: number) => boolean,
): NpcDef[] {
  const result: NpcDef[] = [];
  for (let i = 0; i < count; i++) {
    const source = base[i % base.length];
    let x = source.x, y = source.y;
    for (let tries = 0; tries < 30; tries++) {
      const px = bounds.left + rand() * (bounds.right - bounds.left);
      const py = bounds.top + rand() * (bounds.bottom - bounds.top);
      if (canStand(px, py)) {
        x = px; y = py;
        break;
      }
    }
    result.push({ ...source, name: `${source.name} ${i + 1}`, x, y, shop: false, wander: 160 });
  }
  return result;
}
