import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK } from '../src/config.ts';
import { COMBO_PATTERNS, ENEMY_COMBO, hasCombos, pickCombo } from '../src/combat/enemyCombo.ts';
import { MONSTERS, isCharger, isEliteKind } from '../src/combat/monsterTypes.ts';
import { bossParryOutcome } from '../src/combat/parry.ts';

test('중급 이상의 적은 연타 묶음을 쓰고, 하급(슬라임·나방·버섯)은 예전처럼 한 번만 친다', () => {
  for (const kind of ['corrosion-tracker', 'reed-stalker', 'mist-phantom', 'frost-beetle', 'iron-scale-lizard']) assert.ok(hasCombos(kind), kind);
  for (const kind of ['slime', 'ashen-moth', 'waterdrop-mushroom', undefined]) assert.equal(hasCombos(kind), false, String(kind));
  assert.equal(pickCombo('slime', 0.5), undefined);
});

test('연타 묶음의 첫 타는 몬스터의 예비 동작과 같고, 이어지는 타의 예비 동작은 막기 창보다 길다', () => {
  for (const [kind, list] of Object.entries(COMBO_PATTERNS)) {
    for (const pattern of list) {
      assert.ok(pattern.length >= 1 && pattern.length <= 4, kind);
      assert.equal(pattern[0], MONSTERS[kind].windupMs, `${kind} 첫 타`);
      // 보고 반응해 막을 수 있어야 한다: 예비 동작 + 쉬는 틈이 막기 창보다 길다.
      for (const w of pattern) assert.ok(w + ENEMY_COMBO.gapMs > BLOCK.windowMs, `${kind} ${w}`);
    }
  }
});

test('연타 묶음 고르기: 굴린 값으로 묶음을 고르고 범위를 벗어나도 안전하다', () => {
  const list = COMBO_PATTERNS['corrosion-tracker'];
  assert.equal(pickCombo('corrosion-tracker', 0), list[0]);
  assert.equal(pickCombo('corrosion-tracker', 0.99), list[list.length - 1]);
  assert.equal(pickCombo('corrosion-tracker', 1.5), list[list.length - 1]);
  assert.equal(pickCombo('corrosion-tracker', -1), list[0]);
});


test('연타 중 패링: 남은 타가 있으면 이어 치고, 마지막 타까지 정밀 패링하면 파훼한다(보스가 아니어도)', () => {
  assert.equal(bossParryOutcome(true, 1, 1, true), 'continueChain');
  assert.equal(bossParryOutcome(true, 0, 2, true), 'chainBreak');
  assert.equal(bossParryOutcome(true, 0, 1, true), 'normalBreak', '한 타짜리 묶음은 일반 경직');
  assert.ok(ENEMY_COMBO.breakStunMs > BLOCK.stunMs);
  assert.ok(ENEMY_COMBO.parryGapMs > ENEMY_COMBO.gapMs, '패링당하면 조금 더 늦게 다음 타가 온다');
  assert.ok(ENEMY_COMBO.followDamageScale < 1);
});

test('정예는 집행자와 늪의 잠복 마물이고, 정예의 돌진은 집행자다', () => {
  assert.equal(isEliteKind('corrosion-executioner'), true);
  assert.equal(isEliteKind('swamp-lurker'), true);
  assert.equal(isEliteKind('iron-scale-lizard'), false);
  assert.equal(isEliteKind(undefined), false);
  assert.ok(isCharger('corrosion-executioner'));
});
