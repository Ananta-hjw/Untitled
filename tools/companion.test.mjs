import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANION, COMPANIONS, canEngage, companionDamage, companionNpcDef, followPlan, followSpot, parseCompanion } from '../src/entities/companion.ts';
import { isFighterSkin } from '../src/entities/npcCombat.ts';
import { npcSkin } from '../src/world/npcs.ts';

test('동료는 가까우면 서 있고, 멀면 걷거나 뛰어 다가오며, 너무 멀면 주인공 곁으로 옮겨 온다', () => {
  const hero = { x: 1000, y: 1000 };
  assert.deepEqual(followPlan({ x: 1000 + COMPANION.followDistance - 1, y: 1000 }, hero), { kind: 'stay' });
  const walk = followPlan({ x: 1000 + COMPANION.followDistance + 50, y: 1000 }, hero);
  assert.equal(walk.kind, 'move');
  assert.equal(walk.scale, COMPANION.walkScale);
  assert.ok(Math.abs(walk.x + 1) < 1e-9 && Math.abs(walk.y) < 1e-9, '주인공 쪽으로');
  assert.equal(followPlan({ x: 1000 + COMPANION.runDistance, y: 1000 }, hero).scale, COMPANION.runScale);
  assert.deepEqual(followPlan({ x: 1000 + COMPANION.warpDistance, y: 1000 }, hero), { kind: 'warp' });
  assert.ok(COMPANION.runScale > 1 && COMPANION.walkScale < 1, '멀면 주인공보다 빨라 따라잡고, 가까우면 조금 느리다');
});

test('동료가 서는 자리는 주인공이 바라보는 반대쪽 뒤이고, 세로로는 바닥 원근만큼 짧다', () => {
  const back = followSpot({ x: 500, y: 500 }, { x: 1, y: 0 });
  assert.deepEqual(back, { x: 500 - COMPANION.followDistance, y: 500 });
  const below = followSpot({ x: 500, y: 500 }, { x: 0, y: -1 });
  assert.equal(below.x, 500);
  assert.equal(below.y, 500 + COMPANION.followDistance * 0.6);
});

test('동료는 주인공 가까이의 살아 있는 일반 적만 노리고, 보스와 멀리 떨어진 적은 노리지 않는다', () => {
  const hero = { x: 0, y: 0 };
  assert.equal(canEngage({ x: 100, y: 0, alive: true, boss: false }, hero), true);
  assert.equal(canEngage({ x: 100, y: 0, alive: false, boss: false }, hero), false);
  assert.equal(canEngage({ x: 100, y: 0, alive: true, boss: true }, hero), false, '보스는 주인공이 직접');
  assert.equal(canEngage({ x: COMPANION.leash + 1, y: 0, alive: true, boss: false }, hero), false, '혼자 멀리 쫓아가지 않는다');
});

test('동료의 피해는 주인공보다 작고, 패링·저스트 회피로 휘청이는 적에게는 더 크다', () => {
  const normal = companionDamage(10, 14, false);
  const staggered = companionDamage(10, 14, true);
  assert.ok(normal < 10, `${normal}`);
  assert.ok(staggered > normal);
  assert.equal(companionDamage(0, 0, false), 1, '최소 1');
});

test('동료 저장은 아는 동료만 읽고, 동료의 NPC 정의는 전투 그림이 있는 그림을 쓴다', () => {
  assert.equal(parseCompanion('joan'), 'joan');
  assert.equal(parseCompanion('nope'), undefined);
  assert.equal(parseCompanion(null), undefined);
  for (const def of Object.values(COMPANIONS)) {
    assert.ok(isFighterSkin(def.skin), `${def.id}: 수비대 전투 그림이 있어야 싸울 수 있다`);
    const npc = companionNpcDef(def.id, { x: 10, y: 20 });
    assert.equal(npc.id, `companion-${def.id}`);
    assert.equal(npc.name, def.name);
    assert.equal(npcSkin(npc), 'joan', '전투 프로필을 재사용해도 외형은 조안');
    assert.equal(npc.dialogue, 'npc-joan');
    assert.deepEqual([npc.x, npc.y, npc.wander, npc.shop], [10, 20, undefined, undefined]);
  }
});
