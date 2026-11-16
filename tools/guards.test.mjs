import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { GUARDS, guardsForMap } from '../src/world/guards.ts';
import { MAPS, findExit, walkable } from '../src/world/maps.ts';
import { DIALOGUES } from '../src/story/dialogues.ts';
import { chapterDialogue, chapterNpcs } from '../src/story/chapterOne.ts';
import { pickWanderTarget, npcSkin } from '../src/world/npcs.ts';

test('서문·동문·남문에 두 명씩, 광장과 주거지에 순찰병 네 명을 배치한다', () => {
  assert.equal(GUARDS.length,10);
  assert.equal(new Set(GUARDS.map(g=>g.id)).size,10);
  for(const gate of ['west','east','south']) {
    const pair=GUARDS.filter(g=>g.gate===gate);
    assert.equal(pair.length,2);
    assert.ok(pair.every(g=>g.wander===undefined&&g.facing));
    assert.ok(Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)>180);
  }
  assert.equal(GUARDS.filter(g=>g.wander).length,4);
  assert.equal(guardsForMap('village').length,8);
  assert.equal(guardsForMap('village-north').length,2);
  assert.deepEqual(guardsForMap('in-inn'),[]);
  for(const g of GUARDS){
    const map=MAPS[g.area];
    assert.equal(walkable(map,g.x,g.y),true,g.id);
    assert.equal(findExit(map,g.x,g.y),undefined,g.id);
    assert.equal(walkable(map,g.x,g.y+20),true,`${g.id} 대화 자리`);
    const lines=DIALOGUES[g.dialogue];
    assert.equal(lines[0].speaker,g.name);
    assert.equal(lines[0].portrait,'soldier');
    assert.equal(npcSkin(g),'soldier');
  }
});

test('병사들은 일반 순찰 때만 움직이고 습격·사후에는 자리를 지키며 상황에 맞게 말한다',()=>{
  const raid={'festival-eve':{status:'done',count:0}};
  const after={...raid,'village-raid':{status:'done',count:0}};
  let seed=3;
  const rand=()=>((seed=seed*16807%2147483647)/2147483647);
  for(const g of GUARDS.filter(g=>g.wander))for(let i=0;i<30;i++){
    const p=pickWanderTarget(g,g.wander,rand,(x,y)=>walkable(MAPS[g.area],x,y)&&!findExit(MAPS[g.area],x,y));
    assert.equal(walkable(MAPS[g.area],p.x,p.y),true);
    assert.ok(Math.hypot(p.x-g.x,p.y-g.y)<=g.wander+1);
  }
  for(const phase of [raid,after])for(const area of ['village','village-north']){
    const soldiers=chapterNpcs(guardsForMap(area),phase,area).filter(n=>n.skin==='soldier');
    assert.equal(soldiers.length,guardsForMap(area).length);
    assert.ok(soldiers.every(n=>n.wander===undefined));
    for(const n of soldiers)assert.equal(chapterDialogue(n.id,phase)[0].portrait,'soldier');
  }
});

test('병사 그래픽은 대화·SD와 8방향 32개 프레임이며 런타임 압축 시트 두 장을 공유한다',()=>{
  const root=new URL('../src/assets/characters/soldier/',import.meta.url);
  for(const name of ['dialogue.png','dialogue-768.webp','sd_idle.png','walk_cardinal.png','walk_diagonal.png','walk_cardinal-60.webp','walk_diagonal-60.webp'])assert.ok(existsSync(new URL(name,root)),name);
  const data=JSON.parse(readFileSync(new URL('walk_frames.json',root)));
  assert.equal(data.frames.length,32);
  for(const direction of ['down','left','right','up','down-left','down-right','up-left','up-right'])for(let i=0;i<4;i++){
    const f=data.frames.find(f=>f.name===`${direction}-${i}`),s=data.sheets[f.sheet];
    assert.ok(f&&f.w>0&&f.h>0&&f.x>=0&&f.y>=0&&f.x+f.w<=s.width&&f.y+f.h<=s.height);
    assert.ok(f.originX>0&&f.originX<1&&f.originY>0&&f.originY<=1);
  }
});
