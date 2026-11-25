import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { swingTrailArc, swingTrailEdge } from '../src/entities/attackMotion.ts';
import { PLAYER, VERTICAL_SPEED_RATIO } from '../src/config.ts';
import { attackFacingFor, attackVector, heroFrame, insideAttackLane, insideFrontReach, strikePoseStart } from '../src/entities/heroFrames.ts';

const EIGHT_DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const correctionData = JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-corrections_frames.json', import.meta.url)));
const corrected = (data) => ({ frames: data.frames.map(f => correctionData.frames.find(c => c.name === f.name) ?? f) });
const frontData = corrected(JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-front_frames.json', import.meta.url))));
const downDiagData = corrected(JSON.parse(readFileSync(new URL('../src/assets/hero/academy/combo-proto/attack-down-diag_frames.json', import.meta.url))));
const perspData = JSON.parse(readFileSync(new URL('../src/assets/hero/weapons/perspective_atlas.json', import.meta.url)));
const backSix = (stage) => JSON.parse(readFileSync(new URL(`../src/assets/hero/academy/attack-six/attack${stage}-back_frames.json`, import.meta.url))).frames;
const frontSix = (stage) => JSON.parse(readFileSync(new URL(`../src/assets/hero/academy/attack-six/attack${stage}-front_frames.json`, import.meta.url))).frames;
const downDiagSix = (stage) => JSON.parse(readFileSync(new URL(`../src/assets/hero/academy/attack-six/attack${stage}-down-diag_frames.json`, import.meta.url))).frames;

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
    // 정면은 6자세 원화(attack-front6, attack2-front6, attack3-front6)의 타격 자세(3번)
    assert.equal(heroFrame(`attack${stage + 1}`, 'down', t), `attack${stage ? stage + 1 : ''}-front6-3`);
    const diagonalFrame = `attack${stage ? stage + 1 : ''}-down-diag6-3`;
    assert.equal(heroFrame(`attack${stage + 1}`, 'down-right', t), diagonalFrame);
    assert.equal(heroFrame(`attack${stage + 1}`, 'down-left', t), diagonalFrame);
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
  // 위쪽(뒷모습)은 6자세 원화(attack-back6 등)의 타격 자세(3번). 칼끝이 머리 위, 먼 곳(화면 위)을 향한다.
  for (const stage of [0, 1, 2]) {
    const name = `attack${stage ? stage + 1 : ''}-back6-3`;
    assert.equal(heroFrame(`attack${stage + 1}`, 'up', PLAYER.combo[stage].hitDelayMs + 10), name);
    const f = backSix(stage + 1).find(frame => frame.name === name);
    assert.ok(f.blade.tip.y < f.blade.base.y - 60, `${name} 칼끝이 위를 향한다`);
  }
  assert.ok(backSix(3).slice(1, 5).every(f => f.weaponPerspective === 'up'), '위쪽 3타 찌르기는 먼 곳을 겨눈 원근 검');
});

test('정면 콤보에서 이전 공격의 끝과 다음 공격의 시작이 같은 검 위치를 쓴다', () => {
  const firstEnd = frontSix(1).at(-1);
  const secondStart = frontSix(2)[0];
  const relativeBlade = (frame) => [frame.blade.base, frame.blade.tip]
    .flatMap(p => [p.x - frame.originX * frame.w, p.y - frame.originY * frame.h]);
  relativeBlade(firstEnd).forEach((value, i) => {
    assert.ok(Math.abs(value - relativeBlade(secondStart)[i]) < .02);
  });
  assert.ok(firstEnd.blade.tip.x > firstEnd.blade.base.x);
  assert.ok(firstEnd.blade.tip.y > firstEnd.blade.base.y);
  const end = frontSix(2).at(-1);
  const start = frontSix(3)[0];
  assert.deepEqual(end.blade, start.blade);
  assert.deepEqual([end.originX, end.originY], [start.originX, start.originY]);
  assert.equal(end.blade.tip.x, end.blade.base.x);
  assert.ok(end.blade.tip.y > end.blade.base.y);
  assert.equal(end.weaponPerspective, 'down');
  assert.equal(start.weaponPerspective, 'down');
});

test('원근 검은 장착 무기마다 칼날과 손잡이의 기준점이 같다', () => {
  for (const id of ['wooden-sword', 'iron-sword', 'short-sword', 'long-sword']) {
    for (const angle of ['down', 'up']) {
      const name = `${id}-${angle}`;
      const blade = perspData.frames.find(f => f.name === name);
      const grip = perspData.frames.find(f => f.name === `${name}-grip`);
      assert.ok(blade && grip, name);
      for (const key of ['w', 'h', 'originX', 'originY', 'bladeLength']) assert.equal(grip[key], blade[key]);
      assert.ok(Math.abs(grip.y - blade.y) >= blade.h);
    }
  }
});

test('베기 궤적은 움직이는 손과 검의 각도를 보간하고 양 끝이 실물 칼끝에 닿는다', () => {
  const from = { base: { x: 12, y: 80 }, tip: { x: 12, y: 0 } };
  const to = { base: { x: 20, y: 90 }, tip: { x: 140, y: 90 } };
  const arc = swingTrailArc(from, to);
  assert.deepEqual(arc[0], from);
  assert.deepEqual(arc.at(-1), to);
  const middle = arc[Math.floor(arc.length / 2)];
  assert.deepEqual(middle.base, { x: 16, y: 85 });
  assert.ok(Math.abs(middle.tip.x - (16 + Math.SQRT1_2 * 100)) < 1e-9);
  assert.ok(Math.abs(middle.tip.y - (85 - Math.SQRT1_2 * 100)) < 1e-9);
  const mirror = b => ({ base: { x: -b.base.x, y: b.base.y }, tip: { x: -b.tip.x, y: b.tip.y } });
  const left = swingTrailArc(mirror(from), mirror(to));
  for (const [i, blade] of arc.entries()) {
    assert.deepEqual(left[i].base, mirror(blade).base);
    assert.ok(Math.abs(left[i].tip.x + blade.tip.x) < 1e-9);
    assert.ok(Math.abs(left[i].tip.y - blade.tip.y) < 1e-9);
  }
});

test('칼이 검기 진행 방향과 나란하거나 반대로 돌아도 베기 띠가 접히지 않는다', () => {
  const edge = swingTrailEdge([
    { base: { x: 0, y: 20 }, tip: { x: 0, y: 0 } },
    { base: { x: -10, y: 0 }, tip: { x: 10, y: 0 } },
    { base: { x: 20, y: -20 }, tip: { x: 20, y: 0 } },
    { base: { x: 30, y: 20 }, tip: { x: 30, y: 0 } },
  ]);
  assert.equal(edge.length, 4);
  for (const { offset } of edge.slice(1)) {
    assert.equal(Math.abs(offset.x), 0);
    assert.ok(offset.y > 0);
  }
  assert.deepEqual(edge.at(-1).tip, { x: 30, y: 0 });
});

test('검기 시작 시각에 해당 방향의 타격 자세가 처음 표시된다', () => {
  for (const facing of EIGHT_DIRS) for (const stage of [0, 1, 2]) {
    const action = `attack${stage + 1}`, at = strikePoseStart(stage, facing);
    const index = frame => Number(frame.slice(frame.lastIndexOf('-') + 1));
    // 6자세 시트는 2번 다음이 타격(3)
    const six = /6-\d$/.test(heroFrame(action, facing, at));
    assert.equal(six ? index(heroFrame(action, facing, at - .001)) : index(heroFrame(action, facing, at - .001)) % 4, six ? 2 : 1, `${facing} ${stage}`);
    assert.equal(six ? index(heroFrame(action, facing, at)) : index(heroFrame(action, facing, at)) % 4, six ? 3 : 2, `${facing} ${stage}`);
  }
});

test('앞대각선 1·2·3타는 여섯 자세의 검 방향과 길이를 유지한다', () => {
  // 칸마다 칼끝이 향하는 화면 시계 방향과, 그 자세가 보이는 시각(타격 뒤 멈춤만큼 늦어진 마지막 자세 포함)
  const poses = [
    { hours: [4.5, 12, 10.5, 4, 4.5, 4.5], at: [0, 40, 110, 200, 250, 440] },
    { hours: [4, 7.5, 4.5, 2, 12.5, 2.5], at: [0, 25, 65, 105, 170, 340] },
    { hours: [2.5, 4, 4, 4, 4, 4], at: [0, 40, 100, 170, 245, 450] },
  ];
  for (const [stage, { hours, at }] of poses.entries()) {
    const frames = downDiagSix(stage + 1);
    assert.equal(frames.length, hours.length);
    for (const [i, frame] of frames.entries()) {
      const { base, tip } = frame.blade;
      const dx = tip.x - base.x, dy = tip.y - base.y;
      assert.ok(Math.abs(Math.hypot(dx, dy) - 135 * 304 / 310) < 0.02, frame.name);
      const direction = (hours[i] - 3) * Math.PI / 6;
      assert.ok((dx * Math.cos(direction) + dy * Math.sin(direction)) / Math.hypot(dx, dy) >= Math.cos(Math.PI / 12), frame.name);
      assert.ok(frame.gripCover, `${frame.name} 주먹이 손잡이를 가린다`);
      for (const facing of ['down-right', 'down-left']) {
        assert.equal(heroFrame(`attack${stage + 1}`, facing, at[i]), frame.name);
      }
    }
  }
});

test('앞대각선 콤보는 앞 공격의 끝과 다음 공격의 시작이 같은 검 위치를 쓴다', () => {
  const relative = (frame) => [frame.blade.base, frame.blade.tip]
    .flatMap(p => [Math.round(p.x - frame.originX * frame.w), Math.round(p.y - frame.originY * frame.h)]);
  for (const [from, to] of [[1, 2], [2, 3], [3, 1]]) {
    const end = downDiagSix(from).at(-1), start = downDiagSix(to)[0];
    relative(end).forEach((v, i) => assert.ok(Math.abs(v - relative(start)[i]) <= 3, `${from}타 끝 → ${to}타 시작 ${i}: ${v} vs ${relative(start)[i]}`));
  }
});

test('정면 사거리: 앞(아래)으로 지면 거리 reach 안만 맞고, 뒤(위)나 더 먼 적은 맞지 않는다', () => {
  const [near, , thrust] = PLAYER.frontReach;
  // 화면 세로는 지면 거리 × VERTICAL_SPEED_RATIO로 줄어 보인다
  assert.equal(insideFrontReach(110 * VERTICAL_SPEED_RATIO, near, VERTICAL_SPEED_RATIO), true);
  assert.equal(insideFrontReach(150 * VERTICAL_SPEED_RATIO, near, VERTICAL_SPEED_RATIO), false);
  assert.equal(insideFrontReach(150 * VERTICAL_SPEED_RATIO, thrust, VERTICAL_SPEED_RATIO), true);
  assert.equal(insideFrontReach(-20, near, VERTICAL_SPEED_RATIO), false);
});

test('위쪽(뒷모습) 콤보는 앞 공격의 끝과 다음 공격의 시작이 같은 검 위치를 쓴다', () => {
  const relative = (frame) => [frame.blade.base, frame.blade.tip]
    .flatMap(p => [Math.round(p.x - frame.originX * frame.w), Math.round(p.y - frame.originY * frame.h)]);
  for (const [from, to] of [[1, 2], [2, 3], [3, 1]]) {
    const end = backSix(from).at(-1), start = backSix(to)[0];
    relative(end).forEach((v, i) => assert.ok(Math.abs(v - relative(start)[i]) <= 3, `${from}타 끝 → ${to}타 시작 ${i}: ${v} vs ${relative(start)[i]}`));
  }
});
