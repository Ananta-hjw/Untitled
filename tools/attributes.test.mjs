import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRIBUTES, HIT_FEEL, PLAYER } from '../src/config.ts';
import { STAT_IDS, allocate, deriveStats, mitigate, pointsEarned, pointsLeft, statGain, totalStats, zeroStats } from '../src/entities/attributes.ts';

test('능력치는 네 가지(힘·체력·방어력·민첩)이고, 레벨마다 포인트를 받아 하나씩 올린다', () => {
  assert.deepEqual(STAT_IDS, ['str', 'vit', 'def', 'dex']);
  assert.equal(ATTRIBUTES.damagePerStr, 1.05);
  assert.equal(ATTRIBUTES.hpPerVit, 5);
  assert.equal(HIT_FEEL.critChance, 0.1);
  assert.equal(pointsEarned(1), 0);
  assert.equal(pointsEarned(3), 2 * ATTRIBUTES.pointsPerLevel);
  assert.equal(allocate(zeroStats(), 'str', 1), null, '레벨 1에는 포인트가 없다');
  let alloc = zeroStats();
  for (let i = 0; i < ATTRIBUTES.pointsPerLevel; i++) alloc = allocate(alloc, 'vit', 2);
  assert.equal(alloc.vit, ATTRIBUTES.pointsPerLevel);
  assert.equal(pointsLeft(2, alloc), 0);
  assert.equal(allocate(alloc, 'vit', 2), null);
});

test('기본 능력치에서는 원래 수치(치명타 10%·배율 1.6배)와 같고, 올리면 해당 수치만 좋아진다', () => {
  const base = deriveStats(1, totalStats(zeroStats()));
  assert.equal(base.maxHp, PLAYER.maxHp);
  assert.equal(base.damageMin, PLAYER.damageMin);
  assert.equal(base.damageTaken, 1);
  assert.equal(base.dodgeCooldown, 1);
  assert.equal(base.critChance, 0.1);
  assert.equal(base.critDamage, HIT_FEEL.critDamage);
  assert.equal(base.evadeChance, 0);
  const up = (stat, n = 5) => deriveStats(1, totalStats(zeroStats(), { [stat]: n }));
  assert.equal(up('str', 20).damageMin, base.damageMin + Math.round(20 * 1.05));
  assert.equal(up('str').maxHp, base.maxHp);
  assert.equal(up('vit').maxHp, base.maxHp + 5 * 5);
  assert.ok(up('def').damageTaken < 1);
  const dexUp = up('dex', 5);
  assert.ok(dexUp.dodgeCooldown < 1 && dexUp.evadeChance > 0);
  assert.ok(Math.abs(dexUp.critChance - (0.1 + 5 * ATTRIBUTES.critPerDex)) < 1e-9);
  assert.ok(Math.abs(dexUp.critDamage - (HIT_FEEL.critDamage + 5 * ATTRIBUTES.critDamagePerDex)) < 1e-9);
});

test('방어력이 높아도 피해는 최소 1이고, 민첩은 회피 확률 30%·회피 대기 30% 감소·치명타 100%가 최대며 치명타 배율은 계속 오른다', () => {
  const tank = deriveStats(1, totalStats(zeroStats(), { def: 500, dex: 500 }));
  assert.equal(mitigate(3, tank), 1);
  assert.equal(tank.dodgeCooldown, 0.7);
  assert.equal(tank.evadeChance, 0.3);
  assert.equal(tank.critChance, 1);
  assert.ok(tank.critDamage > HIT_FEEL.critDamage);
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
  assert.equal(ATTRIBUTES.critPerDex, 0.005);
  assert.equal(ATTRIBUTES.critDamagePerDex, 0.01);
  assert.equal(statGain(1, stats, 'str'), `공격력 ${PLAYER.damageMin}~${PLAYER.damageMax} → ${PLAYER.damageMin + 1}~${PLAYER.damageMax + 1} (포인트당 +1.05)`);
  assert.equal(statGain(1, stats, 'vit'), `최대 체력 ${PLAYER.maxHp} → ${PLAYER.maxHp + 5} (+5)`);
  assert.equal(statGain(1, stats, 'dex'), '치명타 10% → 10.5%, 배율 160% → 161%\n회피 0% → 0.2%, 대기 100% → 99.5%');
  assert.match(statGain(1, totalStats(zeroStats(), { dex: 180 }), 'dex'), /치명타 이미 최대\(100%\), 배율 340% → 341%\n회피 최대\(30%\), 대기 최대\(−30%\)/);
  assert.match(statGain(1, totalStats(zeroStats(), { dex: 100 }), 'dex'), /치명타 60% → 60\.5%, 배율 260% → 261%\n회피 20% → 20\.2%, 대기 최대\(−30%\)/);
});
