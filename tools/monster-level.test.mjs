import assert from 'node:assert/strict';
import test from 'node:test';
import { AREA_LEVELS, levelHint, scaleMonster, spawnLevel, xpForKill } from '../src/combat/monsterLevel.ts';
import { MAPS } from '../src/world/maps.ts';

test('사냥터는 들판 → 숲 → 개울 순으로 권장 레벨이 오르고, 몬스터는 범위 안의 레벨을 받는다', () => {
  assert.ok(AREA_LEVELS['south-field'].max < AREA_LEVELS['west-forest'].min);
  assert.ok(AREA_LEVELS['west-forest'].max < AREA_LEVELS['east-stream'].min);
  for (const [map, range] of Object.entries(AREA_LEVELS)) {
    MAPS[map].enemies.forEach((_, i) => {
      const level = spawnLevel(map, i);
      assert.ok(level >= range.min && level <= range.max, `${map} ${i} ${level}`);
    });
  }
  assert.equal(spawnLevel('village', 0), 1);
  assert.equal(levelHint('south-field'), ' · 권장 Lv. 1~3');
  assert.equal(levelHint('village'), '');
});

test('레벨 1은 원래 능력치이고, 레벨이 오르면 체력·공격력·경험치가 오른다', () => {
  const base = { name: '슬라임', hp: 32, damage: 8, xp: 10 };
  assert.deepEqual(scaleMonster(base, 1), base);
  const strong = scaleMonster(base, 5);
  assert.equal(strong.name, '슬라임');
  assert.equal(strong.hp, 64);
  assert.equal(strong.damage, 13);
  assert.equal(strong.xp, 20);
});

test('주인공이 몬스터보다 3레벨 이상 높으면 경험치가 줄고, 최소 1은 받는다', () => {
  assert.equal(xpForKill(20, 5, 7), 20, '2레벨 차이까지는 그대로');
  assert.equal(xpForKill(20, 5, 8), 16);
  assert.equal(xpForKill(20, 5, 10), 8);
  assert.equal(xpForKill(20, 1, 30), 2, '아무리 높아도 10%');
  assert.equal(xpForKill(3, 1, 30), 1);
  assert.equal(xpForKill(20, 9, 3), 20, '높은 레벨 몬스터는 그대로');
});
