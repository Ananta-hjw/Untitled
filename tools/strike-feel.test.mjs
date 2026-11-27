import assert from 'node:assert/strict';
import test from 'node:test';
import { STRIKE_FEEL, strikeAnticipation } from '../src/combat/strikeFeel.ts';
import { MONSTERS, WATER_SHOT } from '../src/combat/monsterTypes.ts';
import { BOSS } from '../src/combat/bossPattern.ts';
import { BLOCK } from '../src/config.ts';

test('장전: 예비 동작 마지막 순간에만 0에서 1로 차오르고, 치는 순간과 그 밖에는 0이다', () => {
  const w = 400, a = STRIKE_FEEL.anticipateMs;
  assert.equal(strikeAnticipation(0, w), 0);
  assert.equal(strikeAnticipation(w - a - 1, w), 0);
  assert.ok(strikeAnticipation(w - a / 2, w) > 0 && strikeAnticipation(w - a / 2, w) < 1);
  assert.ok(strikeAnticipation(w - 1, w) > strikeAnticipation(w - a / 2, w), '끝에 가까울수록 더 당긴다');
  assert.equal(strikeAnticipation(w, w), 0, '치는 순간 튀어 나간다');
  assert.equal(strikeAnticipation(10, 0), 0);
});

test('날카로운 공격: 장전은 안광보다 짧고, 실제로 치는 구간은 짧으며, 투사체는 빠르다', () => {
  assert.ok(STRIKE_FEEL.anticipateMs < BLOCK.glintLeadMs, '안광을 본 뒤에 장전이 보인다');
  for (const [kind, m] of Object.entries(MONSTERS)) {
    if (kind === 'mist-weaver' || kind === 'swamp-lurker') continue;
    assert.ok(m.strikeMs <= 240, `${kind} strikeMs ${m.strikeMs}`);
  }
  assert.ok(WATER_SHOT.speed >= 500);
  assert.ok(BOSS.shot.speed >= 600);
});
