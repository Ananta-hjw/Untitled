import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { NPCS } from '../src/world/npcs.ts';
import { FERN } from '../src/story/chapterTwo.ts';
import { CHAPTER_TWO_CAST, SUPPORTING_CAST, SUCCESSOR_CAST, previewCastNpcs } from '../src/world/chapterTwoNpcs.ts';
import { DIALOGUES } from '../src/story/dialogues.ts';

test('초상화와 기본 SD가 있는 모든 인물은 캐릭터 데이터에 등록되어 있다', () => {
  const registered = new Set([...NPCS, FERN, ...CHAPTER_TWO_CAST, ...SUPPORTING_CAST, ...SUCCESSOR_CAST].map(n=>n.id));
  registered.add('soldier');
  const root=new URL('../src/assets/characters/',import.meta.url);
  for(const dir of readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory())) {
    const folder=new URL(dir.name+'/',root);
    if(!existsSync(new URL('dialogue.png',folder))||!existsSync(new URL('sd_idle.png',folder))) continue;
    assert.ok(registered.has(dir.name),dir.name);
    assert.ok(existsSync(new URL('dialogue-768.webp',folder)),dir.name+' portrait runtime');
    assert.ok(existsSync(new URL('sd_idle-256.webp',folder))||existsSync(new URL('walk_cardinal-60.webp',folder)),dir.name+' figure runtime');
  }
});

test('추가 조연과 계승자의 기본 대화는 자기 초상화를 쓰며 원본 걷기 좌표를 유지한다', () => {
  for(const n of [...SUPPORTING_CAST,...SUCCESSOR_CAST]) {
    const lines=DIALOGUES['npc-'+n.id];assert.ok(lines?.some(l=>l.portrait===n.id),n.id);
  }
  const all=previewCastNpcs('all',{x:1820,y:1625});
  assert.equal(all.length,18);assert.equal(new Set(all.map(n=>n.id)).size,all.length);
  assert.equal(new Set(all.map(n=>n.x+','+n.y)).size,all.length);
  assert.equal(previewCastNpcs('chapter2',{x:0,y:0}).length,6);
  for(const n of SUCCESSOR_CAST) {
    const data=JSON.parse(readFileSync(new URL('../src/assets/characters/'+n.id+'/walk_frames.json',import.meta.url)));
    assert.equal(new Set(data.frames.map(f=>f.direction)).size,8,n.id);
  }
});
