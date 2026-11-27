import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER, PROGRESSION } from '../src/config.ts';
import { addXp, statsForLevel, xpToNext } from '../src/entities/progression.ts';

test('레벨 1의 능력치는 기존 플레이어 수치와 같고, 레벨마다 체력과 공격력이 오른다', () => {
  assert.deepEqual(statsForLevel(1), { maxHp: PLAYER.maxHp, damageMin: PLAYER.damageMin, damageMax: PLAYER.damageMax });
  for (let level = 2; level <= PROGRESSION.maxLevel; level++) {
    const before = statsForLevel(level - 1);
    const after = statsForLevel(level);
    assert.equal(after.maxHp - before.maxHp, PROGRESSION.hpPerLevel);
    assert.ok(after.damageMin >= before.damageMin && after.damageMax >= before.damageMax);
    assert.ok(after.damageMax - after.damageMin === PLAYER.damageMax - PLAYER.damageMin);
  }
  assert.deepEqual(statsForLevel(PROGRESSION.maxLevel + 5), statsForLevel(PROGRESSION.maxLevel));
});

test('필요 경험치는 2차 곡선(100 + 60×(L-1) + 30×(L-1)²)으로 가파르게 늘고, 최고 레벨에서는 0이다', () => {
  assert.equal(xpToNext(1), PROGRESSION.xpBase);
  assert.equal(xpToNext(1), 100);
  assert.equal(xpToNext(2), 190);
  assert.equal(xpToNext(5), 820);
  assert.equal(xpToNext(10), 3070);
  for (let level = 2; level < PROGRESSION.maxLevel; level++) assert.ok(xpToNext(level) > xpToNext(level - 1));
  assert.equal(xpToNext(PROGRESSION.maxLevel), 0);
});

test('경험치가 차면 레벨이 오르고 남은 경험치는 다음 레벨로 넘어간다', () => {
  assert.deepEqual(addXp({ level: 1, xp: 0 }, xpToNext(1) - 1), { level: 1, xp: xpToNext(1) - 1, levelsGained: 0 });
  assert.deepEqual(addXp({ level: 1, xp: xpToNext(1) - 1 }, 3), { level: 2, xp: 2, levelsGained: 1 });
  // 한 번에 두 레벨
  assert.deepEqual(addXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2) + 4), { level: 3, xp: 4, levelsGained: 2 });
  // 원래 값은 바뀌지 않는다
  const progress = { level: 1, xp: 5 };
  addXp(progress, 100);
  assert.deepEqual(progress, { level: 1, xp: 5 });
  // 음수는 무시
  assert.deepEqual(addXp({ level: 2, xp: 7 }, -50), { level: 2, xp: 7, levelsGained: 0 });
});

test('최고 레벨을 넘지 않고, 그 뒤로는 경험치가 쌓이지 않는다', () => {
  const max = PROGRESSION.maxLevel;
  const result = addXp({ level: max - 1, xp: 0 }, 1e9);
  assert.deepEqual(result, { level: max, xp: 0, levelsGained: 1 });
  assert.deepEqual(addXp({ level: max, xp: 0 }, 500), { level: max, xp: 0, levelsGained: 0 });
});

test('2차 경험치 곡선에서는 레벨이 오를수록 필요한 사냥 마릿수가 크게 늘어난다', () => {
  // Lv.1 슬라임(10 XP)만 잡으면 Lv.2까지 10마리, Lv.5까지 누적 1,180 XP(118마리)
  let progress = { level: 1, xp: 0 };
  let kills = 0;
  let killsToLv2 = 0;
  while (progress.level < 5) {
    progress = addXp(progress, PROGRESSION.slimeXp);
    kills++;
    if (progress.level === 2 && killsToLv2 === 0) killsToLv2 = kills;
  }
  assert.equal(killsToLv2, Math.ceil(xpToNext(1) / PROGRESSION.slimeXp));
  assert.equal(killsToLv2, 10);
  assert.equal(kills, 118, `레벨 5까지 ${kills}마리`);
});
