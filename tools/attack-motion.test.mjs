import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { slashFxPlacement } from '../src/entities/attackMotion.ts';
import { PLAYER, VERTICAL_SPEED_RATIO } from '../src/config.ts';
import { attackFacingFor, attackVector, heroFrame, insideAttackLane, strikePoseStart } from '../src/entities/heroFrames.ts';

const EIGHT_DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const correctionData = JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-corrections_frames.json', import.meta.url)));
const corrected = (data) => ({ frames: data.frames.map(f => correctionData.frames.find(c => c.name === f.name) ?? f) });
const frontData = corrected(JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-front_frames.json', import.meta.url))));
const downDiagData = corrected(JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-down-diag_frames.json', import.meta.url))));
const perspData = JSON.parse(readFileSync(new URL('../src/assets/hero/weapons/perspective_atlas.json', import.meta.url)));
const slashFxData = JSON.parse(readFileSync(new URL('../src/assets/effects/slash_fx_atlas.json', import.meta.url)));

test('공격은 8방향 모두 그대로 유지하고 정면·앞대각선은 신규 시트를 선택한다', () => {
  for (const facing of EIGHT_DIRS) {
    assert.equal(attackFacingFor(facing, 1), facing);
    const dir = attackVector(facing);
    assert.ok(Math.abs(Math.hypot(dir.x, dir.y) - 1) < 1e-9, facing);
    const x = dir.x * 100, y = dir.y * 100 * VERTICAL_SPEED_RATIO;
    assert.equal(insideAttackLane(x, y, dir, PLAYER.attackLane, VERTICAL_SPEED_RATIO), true, facing);
    assert.equal(insideAttackLane(-x, -y, dir, PLAYER.attackLane, VERTICAL_SPEED_RATIO), false, facing);
  }
  for (let stage = 0; stage < 3; stage++) {
    const t = PLAYER.combo[stage].hitDelayMs + 20;
    assert.equal(heroFrame(`attack${stage + 1}`, 'down', t), `attack-front-${stage * 4 + 2}`);
    assert.equal(heroFrame(`attack${stage + 1}`, 'down-right', t), `attack-down-diag-${stage * 4 + 2}`);
    assert.equal(heroFrame(`attack${stage + 1}`, 'down-left', t), `attack-down-diag-${stage * 4 + 2}`);
  }
});

test('신규 정면·앞대각선 시트는 모든 프레임에서 검이 주먹에 밀착되고 1·2·3타 궤적을 따른다', () => {
  for (const [label, sheet] of [['front', frontData], ['down-diag', downDiagData]]) {
    assert.equal(sheet.frames.length, 12, label);
    for (const f of sheet.frames) {
      assert.ok(f.grip && f.blade, f.name);
      // 검 시작점(가드)이 실제 주먹 좌표에서 15px 이내로 밀착되어야 공중에 뜨지 않는다.
      assert.ok(Math.hypot(f.blade.base.x - f.grip.x, f.blade.base.y - f.grip.y) <= 15, `${f.name} 주먹 밀착`);
      assert.ok(Math.hypot(f.blade.tip.x - f.blade.base.x, f.blade.tip.y - f.blade.base.y) >= 110, `${f.name} 칼날 길이`);
    }
    // 1타: 오른쪽 위(col 0) → 아래(col 2)
    assert.ok(sheet.frames[0].blade.tip.y < sheet.frames[0].grip.y, `${label} 1타 시작은 위쪽`);
    assert.ok(sheet.frames[0].blade.tip.x > sheet.frames[0].grip.x, `${label} 1타 시작은 오른쪽`);
    assert.ok(sheet.frames[2].blade.tip.y > sheet.frames[2].grip.y + 40, `${label} 1타 끝은 아래쪽`);
    // Rising slashes must reach ahead on the ground instead of ending across the chest.
    assert.ok(sheet.frames[6].blade.tip.y > sheet.frames[6].grip.y + 70, `${label} 2타 전방 도달`);
  }
  // 정면 1타 끝은 왼쪽 아래, 3타 찌르기는 전방 원근 검 사용
  assert.ok(frontData.frames[2].blade.tip.x < frontData.frames[2].grip.x, '정면 1타 끝은 왼쪽 아래');
  assert.equal(frontData.frames[10].weaponPerspective, 'down');
  for (const index of [6, 10]) {
    const { base, tip } = downDiagData.frames[index].blade;
    assert.ok(tip.x > base.x + 100);
    assert.ok((tip.y - base.y) / (tip.x - base.x) > .65, '대각선 칼끝이 전방 바닥을 향한다');
  }
  for (const stage of [0, 1, 2]) {
    const f = correctionData.frames.find(f => f.name === `attack-back-${stage * 4 + 2}`);
    assert.equal(heroFrame(`attack${stage + 1}`, 'up', PLAYER.combo[stage].hitDelayMs + 10), f.name);
    assert.equal(f.blade.base.x, f.blade.tip.x, '위 정면의 검은 옆으로 빗나가지 않는다');
    assert.ok(f.blade.tip.y < f.blade.base.y - 140);
  }
});

test('모든 방향에서 검기는 실제 칼날의 위치·각도·크기를 따르고 좌우 반전에 대응한다', () => {
  assert.deepEqual(perspData.frames.map((f) => f.name), [
    'iron-sword-down', 'iron-sword-up', 'wooden-sword-down', 'wooden-sword-up',
  ]);
  assert.deepEqual(slashFxData.frames.map((f) => f.name), ['slash-1', 'slash-2', 'thrust-3']);
  const previous = { base: { x: 12, y: 80 }, tip: { x: 90, y: 35 } };
  const current = { base: { x: 20, y: 90 }, tip: { x: 100, y: 150 } };
  const mirror = b => ({ base: { x: -b.base.x, y: b.base.y }, tip: { x: -b.tip.x, y: b.tip.y } });
  for (const stage of [0, 1, 2]) {
    const right = slashFxPlacement(stage, 'down-right', previous, current);
    const left = slashFxPlacement(stage, 'down-left', mirror(previous), mirror(current));
    assert.equal(right.x, -left.x);
    assert.equal(right.y, left.y);
    assert.equal(right.width, left.width);
    assert.equal(right.flipY, false);
    assert.equal(left.flipY, true);
    assert.ok(Math.abs(right.rotation - Math.atan2(60, 80)) < 1e-9);
    const move = b => ({ base: { x: b.base.x + 17, y: b.base.y - 31 }, tip: { x: b.tip.x + 17, y: b.tip.y - 31 } });
    const moved = slashFxPlacement(stage, 'down-right', move(previous), move(current));
    assert.equal(moved.x, right.x + 17);
    assert.equal(moved.y, right.y - 31);
    assert.equal(moved.rotation, right.rotation);
    if (stage === 2) {
      assert.equal(right.x, 64);
      assert.equal(right.y, 123);
    }
  }
});

test('검기 시작 시각에 해당 방향의 타격 자세가 처음 표시된다', () => {
  for (const facing of EIGHT_DIRS) for (const stage of [0, 1, 2]) {
    const action = `attack${stage + 1}`, at = strikePoseStart(stage, facing);
    const index = frame => Number(frame.slice(frame.lastIndexOf('-') + 1));
    // 옆 1타는 6자세(attack-side6-0..5): 최대 들어 올림(2) 다음이 타격(3)
    const six = heroFrame(action, facing, at).startsWith('attack-side6-');
    assert.equal(six ? index(heroFrame(action, facing, at - .001)) : index(heroFrame(action, facing, at - .001)) % 4, six ? 2 : 1, `${facing} ${stage}`);
    assert.equal(six ? index(heroFrame(action, facing, at)) : index(heroFrame(action, facing, at)) % 4, six ? 3 : 2, `${facing} ${stage}`);
  }
});
