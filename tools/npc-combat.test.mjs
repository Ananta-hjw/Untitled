import assert from 'node:assert/strict';
import test from 'node:test';
import { NPC_COMBAT } from '../src/config.ts';
import { NpcFighter, isFighterSkin } from '../src/entities/npcCombat.ts';

const position = { x: 0, y: 0 };
const target = { id: 1, x: 90, y: 0, alive: true, attacking: false };
const clear = () => true;

test('루안·테온·병사만 전투에 참여하고 공격은 타격 시점에 한 번만 발생한다', () => {
  assert.equal(isFighterSkin('eila'), false);
  for (const skin of ['ruan', 'teon', 'soldier']) {
    assert.equal(isFighterSkin(skin), true);
    const fighter = new NpcFighter(skin);
    assert.equal(fighter.step(0, position, [target], clear).pose, 'attack');
    assert.equal(fighter.step(200, position, [target], clear).strike, undefined);
    assert.equal(fighter.step(210, position, [target], clear).strike, 1);
    assert.equal(fighter.step(230, position, [target], clear).strike, undefined);
    assert.equal(fighter.step(600, position, [target], clear).pose, 'guard');
    assert.equal(fighter.step(NPC_COMBAT.attackCooldownMs, position, [target], clear).pose, 'attack');
  }
});

test('죽거나 사거리 밖으로 벗어나거나 벽 뒤로 간 대상에는 준비한 공격이 닿지 않는다', () => {
  for (const [next, visible] of [[{ ...target, alive: false }, true], [{ ...target, x: 300 }, true], [target, false]]) {
    const fighter = new NpcFighter('ruan');
    fighter.step(0, position, [target], clear);
    assert.equal(fighter.step(210, position, [next], () => visible).strike, undefined);
  }
  const fighter = new NpcFighter('teon');
  assert.equal(fighter.step(0, position, [{ ...target, x: 250 }], () => false).moveX, 0);
  assert.equal(fighter.step(1, position, [{ ...target, x: 250 }], clear).moveX, 1);
});

test('막기 창 안의 정면 공격만 막고 뒤쪽 공격은 피격 자세와 피해를 남긴다', () => {
  for (const behind of [false, true]) {
    const fighter = new NpcFighter('soldier');
    fighter.step(0, position, [{ ...target, attacking: true }], clear);
    const result = fighter.hit(200, position, { x: behind ? -90 : 90, y: 0 }, 20);
    assert.equal(result, behind ? 'hit' : 'blocked');
    assert.equal(fighter.hp, NPC_COMBAT.profiles.soldier.hp - (behind ? 20 : 0));
  }
});

test('피격은 준비한 공격을 취소하고 무적 시간 뒤 큰 피해를 받으면 부상 상태로 멈춘다', () => {
  const fighter = new NpcFighter('teon');
  fighter.step(0, position, [target], clear);
  assert.equal(fighter.hit(100, position, target, 20), 'hit');
  assert.equal(fighter.hit(110, position, target, 20), 'miss');
  assert.equal(fighter.step(220, position, [target], clear).strike, undefined);
  assert.equal(fighter.hit(800, position, target, 999), 'injured');
  assert.equal(fighter.hp, 0);
  const plan = fighter.step(5000, position, [target], clear);
  assert.deepEqual(plan, { pose: 'injured', moveX: 0, moveY: 0 });
});

test('게임 시계가 멈추면 공격 준비와 막기 지속 시간도 진행하지 않는다', () => {
  const fighter = new NpcFighter('ruan');
  fighter.step(0, position, [target], clear);
  for (let i = 0; i < 100; i++) assert.equal(fighter.step(100, position, [target], clear).strike, undefined);
  assert.equal(fighter.step(210, position, [target], clear).strike, 1);
});
