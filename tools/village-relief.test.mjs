import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterNpcs } from '../src/story/chapterOne.ts';
import { interiorArtPoint } from '../src/world/interiors.ts';
import { MAPS, walkable } from '../src/world/maps.ts';

const after = { 'village-raid': { status: 'done', count: 0 } };
const aid = { merina: 'supplies', rosetta: 'blankets' };
test('구호 담당 주민은 습격 중 치유소에 한 명씩 있고, 이후 원래 가게에서 준비를 이어 간다', () => {
  for (const step of [0, 4, 5, 6]) {
    const state = { 'festival-eve': { status: 'done', count: 0 }, 'village-raid': { status: 'active', count: 0, step } };
    for (const [id, action] of Object.entries(aid)) {
      const people = Object.entries(MAPS).flatMap(([map, data]) => chapterNpcs(data.npcs, state, map).filter(n => n.id === id).map(n => ({ ...n, map })));
      assert.equal(people.length, 1);assert.equal(people[0].map, 'in-clinic');assert.equal(people[0].storyAction, action);
      assert.equal(people[0].talkOffset, 0);
    }
  }
  for (const [map, id, action] of [['in-store','merina','supplies'],['in-inn','rosetta','blankets'],['in-smithy','doran','hammer']]) {
    const n = chapterNpcs(MAPS[map].npcs, after, map).find(n => n.id === id);
    const original = MAPS[map].npcs.find(n => n.id === id);
    assert.equal(n.storyAction, action);assert.equal(n.shop, true);
    assert.equal(n.x, original.x);
    assert.equal(n.y + (n.talkOffset ?? 0), original.y + (original.talkOffset ?? 0), '기존 대화 위치 유지');
    if (id === 'rosetta') assert.equal(walkable(MAPS[map], n.x, n.y), true, '카운터 앞 바닥에서 담요를 준비한다');
    else assert.deepEqual([n.y,n.talkOffset], [original.y,original.talkOffset]);
    assert.equal(chapterNpcs(MAPS[map].npcs, {}, map).find(n => n.id === id).storyAction, id === 'doran' ? 'hammer' : undefined);
  }
});

test('도란은 대장간 모루 옆에서 망치질하고 습격 중에는 치유소 문을 지킨다', () => {
  const map = MAPS['in-smithy'];
  const doran = chapterNpcs(map.npcs, {}, map.id).find(n => n.id === 'doran');
  assert.equal(doran.storyAction, 'hammer');
  assert.ok(doran.talkOffset > 0);
  assert.ok(walkable(map, doran.x, doran.y));
  const talk = interiorArtPoint(map.interior, 455, 720);
  assert.deepEqual({ x: doran.x + doran.talkOffsetX, y: doran.y + doran.talkOffset }, talk);
  assert.ok(walkable(map, talk.x, talk.y));
  const raid = { 'festival-eve': { status: 'done', count: 0 }, 'village-raid': { status: 'active', count: 0, step: 0 } };
  assert.ok(!chapterNpcs(map.npcs, raid, map.id).some(n => n.id === 'doran'));
  const guard = chapterNpcs(MAPS['village-north'].npcs, raid, 'village-north').find(n => n.id === 'doran');
  assert.ok(guard);
  assert.equal(guard.storyAction, undefined);
  assert.equal(guard.talkOffsetX, undefined);
});

test('헤르만과 베르넬은 현장에서 충분히 기록·조사한 뒤 다음 자리로 이동한다', () => {
  for (const [map,id,action] of [['village-north','herman','record'],['village','vernel','inspect']]) {
    const n = chapterNpcs(MAPS[map].npcs, after, map).find(n => n.id === id);
    assert.equal(n.duty.length,3);
    assert.ok(n.duty.every(p => p.action===action && p.durationMs>=7000));
  }
});
