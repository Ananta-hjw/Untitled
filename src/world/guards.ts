import type { Direction8, NpcDef, NpcId } from './npcs.ts';
import { VILLAGE_GATES } from './villagePerimeter.ts';

type Gate = 'west' | 'east' | 'south';
export interface GuardDef extends NpcDef { gate?: Gate }

const sentry = (id: string, gate: Gate, x: number, y: number, facing: Direction8): GuardDef => ({
  id: `guard-${id}`, skin: 'soldier', gate,
  name: { west: '서문 병사', east: '동문 병사', south: '남문 병사' }[gate],
  role: '문지기', area: 'village', x, y, height: 148, facing, dialogue: `guard-${gate}`,
});

/** 세 외부 출입구에 둘씩. 통행 축과 문기둥·건물의 실루엣에서 비켜 선다. */
export const GUARDS: readonly GuardDef[] = [
  sentry('west-north', 'west', 250, VILLAGE_GATES.west.top - 25, 'left'),
  sentry('west-south', 'west', 280, VILLAGE_GATES.west.bottom + 30, 'left'),
  sentry('east-north', 'east', 2170, VILLAGE_GATES.east.top - 25, 'right'),
  sentry('east-south', 'east', 2170, VILLAGE_GATES.east.bottom + 70, 'right'),
  // 남문은 초소·수레 양옆에서 지킨다. 기둥 뒤에 가려지거나 들판 출구에 들어서지 않는다.
  sentry('south-west', 'south', 825, VILLAGE_GATES.south.y - 5, 'down'),
  sentry('south-east', 'south', 1535, VILLAGE_GATES.south.y - 5, 'down'),
  ...([
    ['plaza-west', 'village', 990, 1030], ['plaza-east', 'village', 1550, 930],
    ['homes-west', 'village-north', 980, 740], ['homes-east', 'village-north', 1900, 1160],
  ] as const).map(([id, area, x, y]): GuardDef => ({
    id: `guard-${id}`, skin: 'soldier', name: '순찰 병사', role: '순찰병', area,
    x, y, height: 148, dialogue: 'guard-patrol', wander: 110,
  })),
];

export function guardsForMap(id: string): GuardDef[] { return GUARDS.filter(g => g.area === id); }
export function isGuardId(id: NpcId): id is `guard-${string}` { return id.startsWith('guard-'); }
