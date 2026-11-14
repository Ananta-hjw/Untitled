import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rig = JSON.parse(readFileSync(new URL('../src/assets/hero/rig.json', import.meta.url)));

test('검 손잡이의 기준점이 축소된 주먹의 쥐는 지점과 일치한다', () => {
  const grip = rig.swordGrip;
  const hand = rig.slots.find((slot) => slot.part === grip.handPart);
  const sword = rig.slots.find((slot) => slot.part === 'sword');
  const bone = rig.bones.find((bone) => bone.name === sword.bone);
  const frame = rig.frames[hand.part];
  const dx = (grip.handX - hand.originX) * frame.w;
  const dy = (grip.handY - hand.originY) * frame.h;
  const angle = hand.rotation * Math.PI / 180;
  assert.equal(bone.parent, hand.bone);
  assert.equal(sword.originX, grip.swordX);
  assert.equal(sword.originY, grip.swordY);
  assert.ok(Math.abs(bone.x - (dx * Math.cos(angle) - dy * Math.sin(angle))) < 0.01);
  assert.ok(Math.abs(bone.y - (dx * Math.sin(angle) + dy * Math.cos(angle))) < 0.01);
});

test('검날 축이 엄지와 검지 사이의 쥐는 축과 일치한다', () => {
  const hand = rig.slots.find((slot) => slot.part === rig.swordGrip.handPart);
  const sword = rig.slots.find((slot) => slot.part === 'sword');
  assert.equal(sword.rotation, hand.rotation + rig.swordGrip.handAxisDegrees);
});

test('손가락은 검 앞에, 검과 폼멜은 팔 갑옷 앞에 그린다', () => {
  const order = (name) => rig.slots.findIndex((slot) => slot.part === name);
  assert.ok(order('hand_r_grip') > order('sword'));
  assert.ok(order('sword') > order('forearm_r'));
  assert.ok(order('sword') > order('upper_arm_r'));
});
