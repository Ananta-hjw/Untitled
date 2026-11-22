import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuickSlots, loadQuickSlots, saveQuickSlots, QUICK_SLOTS_KEY } from '../src/items/quickSlots.ts';
import { USE_COOLDOWN_MS } from '../src/items/inventory.ts';

test('바로 사용 슬롯은 비어 있는 상태로 시작하고 소모품만 등록을 복원한다',()=>{
  assert.deepEqual(parseQuickSlots(null),[null,null]);
  for(const bad of ['x','[]','{}','{"version":1,"slots":["potion"]}'])assert.deepEqual(parseQuickSlots(bad),[null,null]);
  assert.deepEqual(parseQuickSlots('{"version":1,"slots":["slime-gel","potion"]}'),[null,'potion']);
  assert.deepEqual(parseQuickSlots('{"version":1,"slots":["lunch","potion"]}'),['lunch','potion']);
  assert.deepEqual(parseQuickSlots('{"version":1,"slots":["constructor",{}]}'),[null,null]);
  assert.equal(USE_COOLDOWN_MS,20000);
});
test('슬롯 등록·교체·해제는 별도로 저장하고 저장소가 막혀도 실패하지 않는다',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  saveQuickSlots(storage,['lunch','potion']);
  assert.ok(values.has(QUICK_SLOTS_KEY));assert.deepEqual(loadQuickSlots(storage),['lunch','potion']);
  saveQuickSlots(storage,[null,'lunch']);assert.deepEqual(loadQuickSlots(storage),[null,'lunch']);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(loadQuickSlots(blocked),[null,null]);assert.doesNotThrow(()=>saveQuickSlots(blocked,['potion',null]));
});
