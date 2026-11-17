import assert from 'node:assert/strict';
import test from 'node:test';
import { BUTTON_RADIUS, SKILL_SLOT_COUNT, TOUCH_RATIO, combatButtonLayout } from '../src/ui/buttonLayout.ts';
import { MAX_ASPECT, MIN_ASPECT, VIEW_HEIGHT } from '../src/config.ts';

const SCALES = [0.85, 1, 1.18];
const circles = (layout, scale) => [
  ['attack', layout.attack, BUTTON_RADIUS.attack], ['dodge', layout.dodge, BUTTON_RADIUS.dodge],
  ['block', layout.block, BUTTON_RADIUS.block], ['talk', layout.talk, BUTTON_RADIUS.talk],
  ['resonance', layout.resonance, BUTTON_RADIUS.resonance],
  ...layout.items.map((p, i) => [`item${i}`, p, BUTTON_RADIUS.item]),
  ...layout.skills.map((p, i) => [`skill${i}`, p, BUTTON_RADIUS.skill]),
].map(([name, p, r]) => ({ name, ...p, r: r * scale }));

test('전투 버튼(공격·회피·막기·아이템 둘·공명·기술 다섯·대화)의 터치 범위는 어느 화면 비율·버튼 크기에서도 겹치지 않는다', () => {
  for (const aspect of [MIN_ASPECT, 16 / 9, 2, MAX_ASPECT]) {
    const width = Math.round(VIEW_HEIGHT * aspect);
    for (const scale of SCALES) {
      const all = circles(combatButtonLayout(width, VIEW_HEIGHT, scale), scale);
      assert.equal(all.filter(c => c.name.startsWith('skill')).length, SKILL_SLOT_COUNT);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.r + b.r) * TOUCH_RATIO;
          assert.ok(gap >= 4, `${a.name}·${b.name} ${gap.toFixed(1)} (${width}, ×${scale})`);
        }
      }
      // 그린 원은 화면 안에 다 들어온다.
      for (const c of all) assert.ok(c.x - c.r >= 0 && c.x + c.r <= width && c.y - c.r >= 0 && c.y + c.r <= VIEW_HEIGHT, `${c.name} (${width}, ×${scale})`);
    }
  }
});

// 물약 칸이 맨 아래에 가로로 놓여서, 4:3 화면(태블릿)에서 버튼을 '크게'로 하면 조이스틱 자리가 좁아진다.
// 그 한 경우만 빼고(태블릿은 화면이 커서 손가락 자리가 남는다) 모두 검사한다.
const roomy = (aspect, scale) => !(aspect === MIN_ASPECT && scale > 1);

test('가장 왼쪽 버튼도 조이스틱(큰 크기)과 떨어져 있다', () => {
  for (const aspect of [MIN_ASPECT, 16 / 9, 2, MAX_ASPECT]) {
    const width = Math.round(VIEW_HEIGHT * aspect);
    for (const scale of SCALES.filter(scale => roomy(aspect, scale))) {
      const left = Math.min(...circles(combatButtonLayout(width, VIEW_HEIGHT, scale), scale).map(c => c.x - c.r * TOUCH_RATIO));
      assert.ok(left > 190 + 95 * 1.18 * 1.35, `${width}, ×${scale}: ${left}`);
    }
  }
});

test('회피는 오른쪽 아래 모서리, 막기는 공격 버튼 왼쪽 아래, 물약 칸은 막기 왼쪽 맨 아래에 가로로, 공명은 그 위에 있다', () => {
  const l = combatButtonLayout(1600, VIEW_HEIGHT, 1);
  assert.ok(l.dodge.x > l.attack.x && l.dodge.y > l.attack.y);
  assert.ok(l.block.x < l.attack.x && l.block.y > l.attack.y);
  assert.ok(l.items[0].x < l.block.x && l.items[1].x < l.items[0].x && l.items[0].y === l.items[1].y);
  assert.ok(l.items[0].y > l.block.y, '물약 칸이 가장 아래');
  assert.ok(l.resonance.y < l.items[0].y && l.resonance.x > l.items[1].x && l.resonance.x < l.block.x);
});

test('조이스틱 영역은 왼쪽 아래에서 예전 고정 패드보다 넓고, 어떤 전투 버튼과도 겹치지 않는다', async () => {
  const { JOYSTICK_REST, joystickZone, joystickCenter } = await import('../src/ui/buttonLayout.ts');
  for (const aspect of [MIN_ASPECT, 16 / 9, 2, MAX_ASPECT]) {
    const width = Math.round(VIEW_HEIGHT * aspect);
    for (const scale of SCALES) {
      const zone = joystickZone(width, VIEW_HEIGHT, scale);
      // 예전 패드(중심 190, 잡는 반경 95×1.35)보다 넓다.
      const rest = { x: JOYSTICK_REST.x, y: VIEW_HEIGHT - JOYSTICK_REST.y };
      if (roomy(aspect, scale)) assert.ok(zone.left <= rest.x - 128 && zone.right >= rest.x + 128 && zone.top <= rest.y - 128 && zone.bottom >= VIEW_HEIGHT);
      assert.ok(zone.right <= width / 2);
      for (const c of circles(combatButtonLayout(width, VIEW_HEIGHT, scale), scale)) {
        assert.ok(c.x - c.r * TOUCH_RATIO > zone.right, `${c.name} (${width}, ×${scale})`);
      }
    }
  }
  // 화면 가장자리를 눌러도 패드는 화면 안에 있다.
  assert.deepEqual(joystickCenter(10, 715, 95, 1600, 720), { x: 95, y: 625 });
  assert.deepEqual(joystickCenter(400, 500, 95, 1600, 720), { x: 400, y: 500 });
});
