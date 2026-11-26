import assert from 'node:assert/strict';
import test from 'node:test';
import { INN_NIGHT, NIGHT_BELL_INN, RIVER_WAKE, RIVER_WAKE_STEPS } from '../src/story/nightBell.ts';
import { FERRY_RIVERBANK } from '../src/story/chapterTwo.ts';
import { MAPS, walkable } from '../src/world/maps.ts';
import { propObstacles } from '../src/world/villageLayout.ts';
import { insideObstacle } from '../src/world/obstacles.ts';

/** GameScene이 처리하는 연출 신호 (startNightBell, startRiverWake) */
const INN_CUES = ['finn-watch', 'bell', 'finn-up', 'finn-wake', 'sleepwalk', 'finn-warn', 'innkeeper-out'];
const RIVER_CUES = ['fog-dissolve', 'inn-step-back', 'inn-steady', 'finn-run', 'hug'];

const clear = (map, p) => walkable(map, p.x, p.y) && ![...(map.obstacles ?? []), ...propObstacles(map.props)].some(o => insideObstacle(o, p.x, p.y));

test('여관의 밤: 시온·핀·여관 주인이 서고 걷는 자리는 여관 바닥의 빈 곳이고, 모든 신호를 장면이 안다', () => {
  const inn = MAPS['in-ferry-inn'];
  for (const p of [INN_NIGHT.hero, INN_NIGHT.finn, INN_NIGHT.innkeeper, INN_NIGHT.finnGrab, ...INN_NIGHT.heroDrift, ...INN_NIGHT.sleepwalk]) {
    assert.ok(clear(inn, p), JSON.stringify(p));
  }
  const cues = NIGHT_BELL_INN.filter(s => s.type === 'cue').map(s => s.cue);
  assert.deepEqual(cues.filter(c => !INN_CUES.includes(c)), []);
  // 종이 먼저 울리고, 핀이 시온을 깨운 뒤에 여관 주인이 나간다
  assert.ok(cues.indexOf('bell') < cues.indexOf('finn-wake') && cues.indexOf('finn-wake') < cues.indexOf('sleepwalk'));
  // 핀은 걷기 전에 장면 동작을 푼다(동작 중인 사람은 걷지 않는다)
  const walk = NIGHT_BELL_INN.findIndex(s => s.type === 'npc' && s.id === 'finn');
  assert.ok(NIGHT_BELL_INN.findIndex(s => s.type === 'cue' && s.cue === 'finn-up') < walk);
  assert.equal(NIGHT_BELL_INN.at(-1).type, 'outro');
});

test('물가 장면: 자막으로 시작해 검은 막이 걷히고, 핀은 물가까지 달려와 아버지를 끌어안는다', () => {
  const ferry = MAPS['ferry-village'];
  assert.equal(RIVER_WAKE_STEPS[1].type, 'caption');
  assert.ok(clear(ferry, RIVER_WAKE.hero));
  for (const p of RIVER_WAKE.finnRun) assert.ok(clear(ferry, p), JSON.stringify(p));
  assert.ok(Math.hypot(RIVER_WAKE.finnRun.at(-1).x - FERRY_RIVERBANK.x, RIVER_WAKE.finnRun.at(-1).y - FERRY_RIVERBANK.y) < 110);
  const cues = RIVER_WAKE_STEPS.filter(s => s.type === 'cue').map(s => s.cue);
  assert.deepEqual(cues.filter(c => !RIVER_CUES.includes(c)), []);
  assert.ok(cues.indexOf('finn-run') < cues.indexOf('hug'));
  // 카메라는 강을 보았다가 시온에게 돌아온다
  assert.equal(RIVER_WAKE_STEPS.at(-1).type, 'camera');
});
