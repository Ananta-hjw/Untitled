import assert from 'node:assert/strict';
import test from 'node:test';
import { BONFIRE, FESTIVAL, FESTIVAL_HERO_START, FESTIVAL_RAIDERS, festivalLineCount, festivalNpcs, shouldPlayFestival } from '../src/story/festival.ts';
import { MAPS, walkable } from '../src/world/maps.ts';
import { NPCS } from '../src/world/npcs.ts';

const raid = (count = 0, step = 0) => ({ 'festival-eve': { status: 'done', count: 1 }, 'village-raid': { status: 'active', count, step } });

test('수확제 연출은 잔치를 시작한 뒤 광장에 처음 들어갈 때, 습격이 막 시작된 상태에서만 보여 준다', () => {
  const base = { map: 'village', quests: raid(), saved: 'pending' };
  assert.equal(shouldPlayFestival(base), true);
  assert.equal(shouldPlayFestival({ ...base, saved: null }), false, '로제타와 잔치를 시작하지 않았다(예전 저장)');
  assert.equal(shouldPlayFestival({ ...base, saved: 'seen' }), false, '한 번 보거나 건너뛰면 다시 없다');
  assert.equal(shouldPlayFestival({ ...base, map: 'in-inn' }), false, '광장에서만');
  assert.equal(shouldPlayFestival({ ...base, quests: raid(1) }), false, '이미 싸우기 시작했다');
  assert.equal(shouldPlayFestival({ ...base, quests: raid(0, 2) }), false);
  assert.equal(shouldPlayFestival({ ...base, quests: { 'festival-eve': { status: 'active', count: 0 } } }), false, '잔치 전');
});

test('연출은 자막으로 시작해 "꺼져 가는 등불"로 끝나고, 3분 남짓 분량이며 걷는 자리는 모두 광장의 걸을 수 있는 곳이다', () => {
  assert.equal(FESTIVAL.find((s) => s.type !== 'placeHero')?.type, 'caption');
  const last = FESTIVAL.at(-1);
  assert.equal(last.type, 'outro');
  assert.ok(last.text.includes('꺼져 가는 등불'));
  const lines = festivalLineCount();
  assert.ok(lines >= 40 && lines <= 70, `${lines}줄`);
  const map = MAPS.village;
  const people = new Set(festivalNpcs().map((n) => n.id));
  for (const step of FESTIVAL) {
    const points = step.type === 'placeHero' ? [step.at] : step.type === 'place' ? [step.at] : step.type === 'hero' || step.type === 'npc' ? step.path : [];
    for (const p of points) assert.equal(walkable(map, p.x, p.y), true, `${step.type} ${JSON.stringify(p)}`);
    if ('id' in step) assert.ok(people.has(step.id), step.id);
    if (step.type === 'emote' && step.who !== 'hero') assert.ok(people.has(step.who), step.who);
    if (step.type === 'cue') assert.ok(['cheer', 'lanterns', 'wind', 'alarm', 'raiders', 'ready'].includes(step.cue), step.cue);
    if (step.type === 'say') for (const l of step.lines) assert.ok(l.text.length <= 90, l.text);
  }
  // 즐거운 잔치 → 하늘 등불 → 바람 → 경보 → 권속 순서
  const cues = FESTIVAL.filter((s) => s.type === 'cue').map((s) => s.cue);
  assert.deepEqual(cues.filter((c) => c !== 'cheer' && c !== 'ready'), ['lanterns', 'wind', 'alarm', 'raiders']);
  assert.ok(walkable(map, FESTIVAL_HERO_START.x, FESTIVAL_HERO_START.y));
});

test('잔치에는 마을 사람 열한 명이 모두 광장에 나와 모닥불 쪽을 보고, 권속은 남문 밖에서 걸어 들어온다', () => {
  const defs = festivalNpcs();
  const map = MAPS.village;
  for (const n of NPCS) {
    const d = defs.find((x) => x.id === n.id);
    assert.ok(d, n.id);
    assert.equal(d.inside, undefined, `${n.id}: 가게 안이 아니라 광장`);
    assert.equal(d.wander, undefined, `${n.id}: 연출 동안 제자리`);
    assert.equal(walkable(map, d.x, d.y), true, n.id);
    assert.ok(Math.hypot(d.x - BONFIRE.x, d.y - BONFIRE.y) < 500 || n.id === 'teon', n.id);
  }
  assert.ok(defs.filter((d) => d.id.startsWith('guard-')).every((d) => d.id.match(/west|east|south/)), '순찰병은 잔치에 끼어 없다');
  for (const r of FESTIVAL_RAIDERS) {
    const from = r.path[0], to = r.path.at(-1);
    assert.ok(from.y > to.y, '문 밖(아래)에서 안으로');
    assert.equal(walkable(map, to.x, to.y), true);
  }
});
