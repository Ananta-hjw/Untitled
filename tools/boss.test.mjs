import assert from 'node:assert/strict';
import test from 'node:test';
import { BOSS, entersPhaseTwo, fanDirections, insideEllipse, retreatDone, shouldVeil, wantsVolley } from '../src/combat/bossPattern.ts';
import { MONSTERS } from '../src/combat/monsterTypes.ts';
import { RAID_LEVELS, scaleMonster } from '../src/combat/monsterLevel.ts';

test('1장 보스는 체력이 절반 이하가 되는 순간 한 번만 2페이즈로 넘어간다', () => {
  assert.equal(entersPhaseTwo(1, 201, 400), false);
  assert.equal(entersPhaseTwo(1, 200, 400), true);
  assert.equal(entersPhaseTwo(1, 1, 400), true);
  assert.equal(entersPhaseTwo(1, 0, 400), false, '쓰러지는 일격이면 포효하지 않는다');
  assert.equal(entersPhaseTwo(2, 100, 400), false, '이미 2페이즈');
});

test('포효 뒤 물러나기는 충분히 멀어지거나 시간이 다 되거나 막히면 끝난다', () => {
  assert.equal(retreatDone(BOSS.retreatDistance - 1, 0, false), false);
  assert.equal(retreatDone(BOSS.retreatDistance, 0, false), true);
  assert.equal(retreatDone(0, BOSS.retreatMaxMs, false), true);
  assert.equal(retreatDone(0, 0, true), true);
});

test('부식의 집행자는 추적자보다 훨씬 단단하고 세다 (레벨 반영)', () => {
  const boss = scaleMonster(MONSTERS['corrosion-executioner'], RAID_LEVELS.executioner);
  const tracker = scaleMonster(MONSTERS['corrosion-tracker'], RAID_LEVELS.tracker);
  assert.ok(boss.hp >= tracker.hp * 8, `${boss.hp} vs ${tracker.hp}`);
  assert.ok(boss.damage >= tracker.damage * 2.5, `${boss.damage} vs ${tracker.damage}`);
  assert.equal(BOSS.chain, 2);
  assert.equal(BOSS.chainGapMs, 1000);
});

test('2페이즈: 부식 산탄은 멀리 있을 때 쿨다운마다, 장막은 체력 1/4 아래에서 한 번만', () => {
  assert.equal(wantsVolley(1, 900, 99999, 0), false, '1페이즈에는 쏘지 않는다');
  assert.equal(wantsVolley(2, BOSS.shot.minDistance - 1, 99999, 0), false, '가까우면 돌진');
  assert.equal(wantsVolley(2, BOSS.shot.minDistance, 1000, 2000), false, '쿨다운 중');
  assert.equal(wantsVolley(2, BOSS.shot.minDistance, 2000, 2000), true);
  assert.equal(shouldVeil(2, 126, 500, false), false);
  assert.equal(shouldVeil(2, 125, 500, false), true);
  assert.equal(shouldVeil(2, 125, 500, true), false, '한 번만');
  assert.equal(shouldVeil(1, 100, 500, false), false, '1페이즈(포효 전)에는 없다');
  assert.equal(shouldVeil(2, 0, 500, false), false);
});

test('부채꼴 산탄은 겨눈 방향을 가운데로 같은 간격이고, 타원 판정은 바닥 원근(세로가 짧다)을 따른다', () => {
  const dirs = fanDirections(1, 0, 3, 18);
  assert.equal(dirs.length, 3);
  assert.ok(Math.abs(dirs[1].x - 1) < 1e-9 && Math.abs(dirs[1].y) < 1e-9, '가운데는 정면');
  assert.ok(Math.abs(dirs[0].y + dirs[2].y) < 1e-9, '좌우 대칭');
  assert.ok(Math.abs(Math.atan2(dirs[2].y, dirs[2].x) - Math.PI / 10) < 1e-9);
  for (const d of dirs) assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9);
  assert.equal(insideEllipse(90, 0, 95, 52), true);
  assert.equal(insideEllipse(0, 60, 95, 52), false, '세로로는 더 좁다');
  assert.equal(insideEllipse(67, 36, 95, 52), true);
  assert.equal(insideEllipse(80, 40, 95, 52), false);
});
