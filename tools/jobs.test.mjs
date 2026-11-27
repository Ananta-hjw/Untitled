import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOBS, JOB_IDS, BASE_JOBS, JOB_ADVANCE, HERO_JOB_ROOT, COMPANION_JOBS,
  jobPath, jobRoot, nextJobs, jobStatBonus, advanceBlock, parseHeroJob, advanceLevel,
} from '../src/entities/jobs.ts';
import { COMPANIONS } from '../src/entities/companion.ts';
import { STAT_IDS } from '../src/entities/attributes.ts';
import { PROGRESSION } from '../src/config.ts';

test('기본 직업은 여덟 개이고, 요청한 여섯 직업이 모두 있다', () => {
  assert.deepEqual(BASE_JOBS.map(id => JOBS[id].name),
    ['검사', '기사', '궁수', '법사', '도적', '클레릭', '창술사', '음유시인']);
});

test('전직 나무: 기본 직업마다 1차 두 갈래, 갈래마다 2차 하나', () => {
  for (const base of BASE_JOBS) {
    const first = nextJobs(base);
    assert.equal(first.length, 2, base);
    for (const branch of first) {
      assert.equal(JOBS[branch].tier, 2);
      const second = nextJobs(branch);
      assert.equal(second.length, 1, branch);
      assert.equal(JOBS[second[0]].tier, 3);
      assert.equal(nextJobs(second[0]).length, 0);
    }
  }
  assert.equal(JOB_IDS.length, 8 * 5);
});

test('직업 정의는 서로 맞는다: id·단계·이름이 겹치지 않고, 전직 직업은 시험 퀘스트가 있다', () => {
  const names = new Set();
  for (const id of JOB_IDS) {
    const job = JOBS[id];
    assert.equal(job.id, id);
    assert.ok(!names.has(job.name), `이름 겹침 ${job.name}`);
    names.add(job.name);
    if (job.tier === 1) { assert.equal(job.from, undefined); assert.equal(job.trial, undefined); }
    else { assert.equal(JOBS[job.from].tier, job.tier - 1); assert.ok(job.trial); }
    for (const stat of Object.keys(job.stats)) assert.ok(STAT_IDS.includes(stat), stat);
  }
});

test('전직 레벨은 최고 레벨 안에 있다', () => {
  assert.ok(JOB_ADVANCE.firstAdvanceLevel < JOB_ADVANCE.secondAdvanceLevel);
  assert.ok(JOB_ADVANCE.secondAdvanceLevel <= PROGRESSION.maxLevel);
  assert.equal(advanceLevel(1), 1);
});

test('경로와 능력치 보너스는 거쳐 온 단계를 모두 더한다', () => {
  assert.deepEqual(jobPath('twilight-blade'), ['swordsman', 'spellblade', 'twilight-blade']);
  assert.equal(jobRoot('twilight-blade'), 'swordsman');
  const sum = (bonus) => Object.values(bonus).reduce((a, b) => a + b, 0);
  assert.deepEqual(jobStatBonus('swordsman'), { str: 2, dex: 1, vit: 1 });
  assert.deepEqual(jobStatBonus('spellblade'), { str: 7, dex: 3, vit: 2 });
  for (const id of JOB_IDS) {
    // 단계별 총량: 기본 4, 1차 +8, 2차 +12 (계열끼리 공평하게)
    assert.equal(sum(jobStatBonus(id)), [0, 4, 12, 24][JOBS[id].tier], id);
  }
});

test('전직 조건: 다음 단계여야 하고, 레벨과 시험 퀘스트가 필요하다', () => {
  const none = new Set();
  const done = new Set(['trial-spellblade', 'trial-twilight-blade']);
  const first = JOB_ADVANCE.firstAdvanceLevel, second = JOB_ADVANCE.secondAdvanceLevel;
  assert.equal(advanceBlock('swordsman', 'twilight-blade', 30, done), 'not-next', '건너뛸 수 없다');
  assert.equal(advanceBlock('swordsman', 'spellblade', first - 1, done), 'level');
  assert.equal(advanceBlock('swordsman', 'spellblade', first, none), 'trial');
  assert.equal(advanceBlock('swordsman', 'spellblade', first, done), undefined);
  assert.equal(advanceBlock('spellblade', 'twilight-blade', second - 1, done), 'level');
  assert.equal(advanceBlock('spellblade', 'twilight-blade', second, done), undefined);
  assert.equal(advanceBlock('blademaster', 'twilight-blade', 30, done), 'not-next', '다른 갈래의 끝으로는 못 간다');
});

test('시온은 검사 계열만 간다', () => {
  assert.equal(HERO_JOB_ROOT, 'swordsman');
  assert.equal(advanceBlock('knight', 'guardian', 30, new Set(['trial-guardian']), true), 'hero-line');
  assert.equal(advanceBlock('knight', 'guardian', 30, new Set(['trial-guardian'])), undefined, '동료는 된다');
});

test('주인공 직업 저장: 모르는 값·다른 계열은 검사, 레벨이 모자란 단계는 내린다', () => {
  assert.equal(parseHeroJob(null, 5), 'swordsman');
  assert.equal(parseHeroJob('nope', 5), 'swordsman');
  assert.equal(parseHeroJob('archmage', 30), 'swordsman');
  assert.equal(parseHeroJob('blademaster', JOB_ADVANCE.firstAdvanceLevel), 'blademaster');
  assert.equal(parseHeroJob('sword-saint', JOB_ADVANCE.firstAdvanceLevel), 'blademaster');
  assert.equal(parseHeroJob('sword-saint', 1), 'swordsman');
  assert.equal(parseHeroJob('sword-saint', JOB_ADVANCE.secondAdvanceLevel), 'sword-saint');
});

test('동료마다 직업이 있고, 시온의 계열은 아니다', () => {
  for (const id of Object.keys(COMPANIONS)) {
    const job = COMPANION_JOBS[id];
    assert.ok(job, id);
    assert.notEqual(jobRoot(job), HERO_JOB_ROOT);
  }
  assert.equal(COMPANION_JOBS.joan, 'lancer');
});
