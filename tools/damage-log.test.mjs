import assert from 'node:assert/strict';
import test from 'node:test';
import { deathReport, emptyDamageLog, recordDamage } from '../src/combat/damageLog.ts';

const slime = { name: '슬라임', level: 2 };
const lizard = { name: '쇠비늘 도마뱀', level: 5 };

test('받은 피해는 같은 몬스터(이름·레벨)끼리 횟수와 합으로 묶고, 마지막 일격을 기억한다', () => {
  let log = emptyDamageLog();
  log = recordDamage(log, slime, 6);
  log = recordDamage(log, lizard, 14);
  log = recordDamage(log, slime, 5.6);
  log = recordDamage(log, { name: '슬라임', level: 3 }, 7);
  const report = deathReport(log);
  assert.deepEqual(report.rows, [
    { name: '쇠비늘 도마뱀', level: 5, hits: 1, damage: 14 },
    { name: '슬라임', level: 2, hits: 2, damage: 12 },
    { name: '슬라임', level: 3, hits: 1, damage: 7 },
  ]);
  assert.equal(report.total, 33);
  assert.deepEqual(report.killer, { name: '슬라임', level: 3, damage: 7 });
});

test('기록은 바뀌지 않는 값이고, 빈 기록은 마지막 일격이 없다', () => {
  const empty = emptyDamageLog();
  const next = recordDamage(empty, slime, 3);
  assert.deepEqual(empty, { entries: [] });
  assert.equal(next.entries.length, 1);
  assert.deepEqual(deathReport(empty), { rows: [], total: 0, killer: undefined });
});

test('종류가 많으면 앞의 몇 줄만 보이고 나머지는 "그 밖" 한 줄로 묶어 합계는 그대로다', () => {
  let log = emptyDamageLog();
  for (let i = 1; i <= 7; i++) log = recordDamage(log, { name: `몬스터${i}`, level: 1 }, i * 10);
  const report = deathReport(log, 5);
  assert.equal(report.rows.length, 5);
  assert.equal(report.rows[0].damage, 70);
  assert.deepEqual(report.rows[4], { name: '그 밖 3종', level: 0, hits: 3, damage: 30 + 20 + 10 });
  assert.equal(report.total, 280);
});
