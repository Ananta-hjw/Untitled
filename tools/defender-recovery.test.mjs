import assert from 'node:assert/strict';
import test from 'node:test';
import { defenderRecovery, loadDefenderInjuries, saveDefenderInjuries, DEFENDER_SAVE_KEY } from '../src/story/defenderRecovery.ts';

const raid = step => ({ 'festival-eve': { status: 'done', count: 0 }, 'village-raid': { status: 'active', step, count: 0 } });
const after = { 'village-raid': { status: 'done', count: 0 } };
test('부상은 필요한 대화 전에 적용하고, 치료 뒤 테온·경비병만 순찰에 복귀한다', () => {
  const none = new Set(), injured = new Set(['guard-plaza-west']);
  assert.equal(defenderRecovery('teon', raid(0), none), undefined);
  assert.equal(defenderRecovery('teon', raid(1), none), 'injured');
  assert.equal(defenderRecovery('ruan', raid(4), none), undefined);
  assert.equal(defenderRecovery('ruan', raid(5), none), 'injured');
  assert.equal(defenderRecovery('guard-plaza-west', raid(0), injured), 'injured');
  assert.equal(defenderRecovery('ruan', after, none), 'rest');
  assert.equal(defenderRecovery('teon', after, none), 'sentry');
  assert.equal(defenderRecovery('guard-plaza-west', after, injured), 'rest');
  assert.equal(defenderRecovery('guard-plaza-east', after, injured), undefined);
  const healed = { ...after, 'first-sword': { status: 'done', count: 0 } };
  assert.equal(defenderRecovery('teon', healed, injured), undefined);
  assert.equal(defenderRecovery('guard-plaza-west', healed, injured), undefined);
  assert.equal(defenderRecovery('ruan', healed, injured), 'rest');
});

test('경비병 부상 저장은 잘못된 데이터와 동료 ID를 무시하고 새 이야기에서 초기화한다', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  saveDefenderInjuries(storage, new Set(['guard-east-north', 'ruan', 'companion-joan', 'hero']));
  assert.deepEqual([...loadDefenderInjuries(storage, raid(0))], ['guard-east-north', 'ruan']);
  data.set(DEFENDER_SAVE_KEY, '["guard-fake",null,3,"teon"]');
  assert.deepEqual([...loadDefenderInjuries(storage, after)], ['teon']);
  data.set(DEFENDER_SAVE_KEY, '{');
  assert.equal(loadDefenderInjuries(storage, after).size, 0);
  saveDefenderInjuries(storage, new Set(['ruan']));
  assert.equal(loadDefenderInjuries(storage, {}).size, 0);
  assert.equal(data.has(DEFENDER_SAVE_KEY), false);
});
