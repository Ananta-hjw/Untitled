import assert from 'node:assert/strict';
import test from 'node:test';
import { JUST_DODGE } from '../src/config.ts';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, SIZES, TIMINGS, justDodgeWindowMs, loadSettings, parseSettings, saveSettings,
  sizeScale, stepOption,
} from '../src/ui/settingsData.ts';

function memoryStorage() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

test('저장한 설정을 그대로 다시 읽고, 없으면 기본값이다', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
  const changed = { buttonSize: 'large', joystickSize: 'small', justDodgeTiming: 'lenient' };
  assert.equal(saveSettings(storage, changed), true);
  assert.deepEqual(loadSettings(storage), changed);
  assert.ok(storage.map.has(SETTINGS_KEY));
});

test('잘못된 값은 그 항목만 기본값으로 돌린다', () => {
  assert.deepEqual(parseSettings('{"buttonSize":"huge","joystickSize":"large","justDodgeTiming":7}'),
    { buttonSize: 'normal', joystickSize: 'large', justDodgeTiming: 'normal' });
  for (const raw of [null, '', 'oops', '[]', '"x"', 'null']) assert.deepEqual(parseSettings(raw), DEFAULT_SETTINGS, String(raw));
});

test('저장소를 쓸 수 없어도 기본값으로 동작한다', () => {
  const broken = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem() {} };
  assert.deepEqual(loadSettings(broken), DEFAULT_SETTINGS);
  assert.equal(saveSettings(broken, DEFAULT_SETTINGS), false);
  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);
});

test('보통 설정은 기존 수치와 같고, 크기·판정은 순서대로 커진다', () => {
  assert.equal(sizeScale('normal'), 1);
  assert.equal(justDodgeWindowMs('normal'), JUST_DODGE.windowMs);
  assert.ok(sizeScale('small') < 1 && sizeScale('large') > 1);
  assert.ok(justDodgeWindowMs('strict') < justDodgeWindowMs('normal') && justDodgeWindowMs('normal') < justDodgeWindowMs('lenient'));
});

test('설정 값은 화살표로 한 칸씩 움직이고 양 끝에서 멈춘다', () => {
  assert.equal(stepOption(SIZES, 'normal', 1), 'large');
  assert.equal(stepOption(SIZES, 'large', 1), 'large');
  assert.equal(stepOption(SIZES, 'small', -1), 'small');
  assert.equal(stepOption(TIMINGS, 'normal', -1), 'strict');
});
