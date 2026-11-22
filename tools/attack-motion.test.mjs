import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { slashFxPlacement } from '../src/entities/attackMotion.ts';
import { PLAYER, VERTICAL_SPEED_RATIO } from '../src/config.ts';
import { attackFacingFor, attackVector, heroFrame, insideAttackLane } from '../src/entities/heroFrames.ts';

const EIGHT_DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const frontData = JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-front_frames.json', import.meta.url)));
const downDiagData = JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-down-diag_frames.json', import.meta.url)));
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
    // 2타: 왼쪽 위(col 0) → 오른쪽 가운데(col 2)
    assert.ok(sheet.frames[4].blade.tip.x < sheet.frames[4].grip.x, `${label} 2타 시작은 왼쪽`);
    assert.ok(sheet.frames[4].blade.tip.y < sheet.frames[4].grip.y, `${label} 2타 시작은 위쪽`);
    assert.ok(sheet.frames[6].blade.tip.x > sheet.frames[6].grip.x + 100, `${label} 2타 끝은 오른쪽 가운데`);
  }
  // 정면 1타 끝은 왼쪽 아래, 3타 찌르기는 전방 원근 검 사용
  assert.ok(frontData.frames[2].blade.tip.x < frontData.frames[2].grip.x, '정면 1타 끝은 왼쪽 아래');
  assert.equal(frontData.frames[10].weaponPerspective, 'down');
  // 앞대각선 3타: 뒤로 당김(col 1) → 크게 앞으로 찌르기(col 2)
  assert.ok(downDiagData.frames[9].grip.x < downDiagData.frames[8].grip.x - 100, '앞대각선 3타는 허리 뒤로 깊게 당긴다');
  assert.ok(downDiagData.frames[10].grip.x > downDiagData.frames[9].grip.x + 180, '앞대각선 3타는 크게 앞으로 찌른다');
});

test('원근 검 4종과 검기 3종 아틀라스가 완비되고 좌우 대각선 이펙트는 정확히 대칭이다', () => {
  assert.deepEqual(perspData.frames.map((f) => f.name), [
    'iron-sword-down', 'iron-sword-up', 'wooden-sword-down', 'wooden-sword-up',
  ]);
  assert.deepEqual(slashFxData.frames.map((f) => f.name), ['slash-1', 'slash-2', 'thrust-3']);
  for (let stage = 0; stage < 3; stage++) {
    const dr = slashFxPlacement(stage, 'down-right');
    const dl = slashFxPlacement(stage, 'down-left');
    assert.equal(dr.offsetX, -dl.offsetX, `down diagonal X 대칭 stage ${stage}`);
    assert.equal(dr.offsetY, dl.offsetY, `down diagonal Y 대칭 stage ${stage}`);
  }
});
