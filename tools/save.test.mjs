import assert from 'node:assert/strict';
import test from 'node:test';
import { PROGRESSION } from '../src/config.ts';
import { xpToNext } from '../src/entities/progression.ts';
import {
  SAVE_KEY, SAVE_VERSION, clearProgress, loadProgress, parseSave, saveProgress, serializeSave,
} from '../src/entities/saveData.ts';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

test('저장한 레벨과 경험치를 그대로 다시 읽는다', () => {
  const storage = memoryStorage();
  assert.equal(loadProgress(storage), null);
  assert.equal(saveProgress(storage, { level: 4, xp: 33 }), true);
  assert.deepEqual(loadProgress(storage), { level: 4, xp: 33 });
  assert.deepEqual(JSON.parse(storage.map.get(SAVE_KEY)), { version: SAVE_VERSION, level: 4, xp: 33 });
  clearProgress(storage);
  assert.equal(loadProgress(storage), null);
});

test('깨진 저장이나 말이 안 되는 값은 무시하고 새로 시작한다', () => {
  const bad = [
    'not json', '[]', 'null', '"text"', '{}',
    JSON.stringify({ version: SAVE_VERSION + 1, level: 3, xp: 0 }),
    JSON.stringify({ version: SAVE_VERSION, level: 0, xp: 0 }),
    JSON.stringify({ version: SAVE_VERSION, level: PROGRESSION.maxLevel + 1, xp: 0 }),
    JSON.stringify({ version: SAVE_VERSION, level: 2.5, xp: 0 }),
    JSON.stringify({ version: SAVE_VERSION, level: 2, xp: -1 }),
    JSON.stringify({ version: SAVE_VERSION, level: '3', xp: 0 }),
  ];
  for (const raw of bad) assert.equal(parseSave(raw), null, raw);
  assert.equal(parseSave(null), null);
  assert.equal(parseSave(''), null);
});

test('필요 경험치보다 많이 저장돼 있으면 다음 레벨 직전으로 맞추고, 최고 레벨은 0으로 둔다', () => {
  assert.deepEqual(parseSave(serializeSave({ level: 2, xp: 9999 })), { level: 2, xp: xpToNext(2) - 1 });
  assert.deepEqual(parseSave(serializeSave({ level: PROGRESSION.maxLevel, xp: 40 })), { level: PROGRESSION.maxLevel, xp: 0 });
});

test('저장소를 쓸 수 없어도 게임을 멈추지 않는다', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(loadProgress(broken), null);
  assert.equal(saveProgress(broken, { level: 2, xp: 1 }), false);
  assert.doesNotThrow(() => clearProgress(broken));
  assert.equal(loadProgress(undefined), null);
  assert.equal(saveProgress(undefined, { level: 2, xp: 1 }), false);
});
