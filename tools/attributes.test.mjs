import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRIBUTES, HIT_FEEL, PLAYER } from '../src/config.ts';
import { STAT_IDS, allocate, deriveStats, mitigate, pointsEarned, pointsLeft, statGain, totalStats, zeroStats } from '../src/entities/attributes.ts';

test('능력치는 여섯 가지이고, 레벨마다 포인트를 받아 하나씩 올린다', () => {
  assert.deepEqual(STAT_IDS, ['str', 'vit', 'def', 'dex', 'int', 'luk']);
  assert.equal(pointsEarned(1), 0);
  assert.equal(pointsEarned(3), 2 * ATTRIBUTES.pointsPerLevel);
  assert.equal(allocate(zeroStats(), 'str', 1), null, '레벨 1에는 포인트가 없다');
  let alloc = zeroStats();
  for (let i = 0; i < ATTRIBUTES.pointsPerLevel; i++) alloc = allocate(alloc, 'vit', 2);
  assert.equal(alloc.vit, ATTRIBUTES.pointsPerLevel);
  assert.equal(pointsLeft(2, alloc), 0);
  assert.equal(allocate(alloc, 'vit', 2), null);
});

test('기본 능력치에서는 원래 수치와 같고, 올리면 해당 수치만 좋아진다', () => {
  const base = deriveStats(1, totalStats(zeroStats()));
  assert.equal(base.maxHp, PLAYER.maxHp);
  assert.equal(base.damageMin, PLAYER.damageMin);
  assert.equal(base.damageTaken, 1);
  assert.equal(base.dodgeCooldown, 1);
  assert.equal(base.critChance, HIT_FEEL.critChance);
  assert.equal(base.skillDamage, 1);
  assert.equal(base.evadeChance, 0);
  assert.equal(base.goldGain, 1);
  const up = (stat) => deriveStats(1, totalStats(zeroStats(), { [stat]: 5 }));
  assert.ok(up('str').damageMin > base.damageMin);
  assert.equal(up('str').maxHp, base.maxHp);
  assert.equal(up('vit').maxHp, base.maxHp + 5 * ATTRIBUTES.hpPerVit);
  assert.ok(up('def').damageTaken < 1);
  assert.ok(up('dex').dodgeCooldown < 1 && up('dex').evadeChance > 0);
  assert.ok(up('int').maxMp > base.maxMp && up('int').skillDamage > 1);
  assert.ok(up('luk').critChance > base.critChance && up('luk').goldGain > 1);
});

test('방어력이 높아도 피해는 최소 1이고, 민첩은 회피 확률 30%·회피 대기 30% 감소가 최대다', () => {
  const tank = deriveStats(1, totalStats(zeroStats(), { def: 500, dex: 500 }));
  assert.equal(mitigate(3, tank), 1);
  assert.equal(tank.dodgeCooldown, 0.7);
  assert.equal(tank.evadeChance, 0.3);
  assert.equal(mitigate(10, deriveStats(1, totalStats(zeroStats()))), 10);
});

test('방어력이 오를수록 받는 피해가 줄어든다', () => {
  const base = deriveStats(1, totalStats(zeroStats()));
  const sturdy = deriveStats(1, totalStats(zeroStats(), { def: 20 }));
  assert.equal(mitigate(20, sturdy), Math.round(20 * 100 / (100 + 20 * ATTRIBUTES.defensePerDef)));
  assert.ok(mitigate(20, sturdy) < mitigate(20, base));
});

test('상태창은 포인트 하나로 무엇이 얼마나 바뀌는지 보여 준다', () => {
  const stats = totalStats(zeroStats());
  assert.equal(statGain(1, stats, 'vit'), `최대 체력 ${PLAYER.maxHp} → ${PLAYER.maxHp + ATTRIBUTES.hpPerVit} (+${ATTRIBUTES.hpPerVit})`);
  assert.equal(statGain(1, stats, 'dex'), '회피 확률 0% → 0.2%, 회피 대기 100% → 99.5%');
  assert.match(statGain(1, stats, 'int'), /스킬 피해 100% → 103%/);
  assert.equal(statGain(1, totalStats(zeroStats(), { dex: 100 }), 'dex'), '회피 확률 20% → 20.2%, 회피 대기 이미 최대(−30%)');
  assert.equal(statGain(1, totalStats(zeroStats(), { dex: 200 }), 'dex'), '이미 최대 (회피 확률 30%, 대기 −30%)');
});
