import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK, DODGE, PLAYER_SPEED, VERTICAL_SPEED_RATIO } from '../src/config.ts';
import { MONSTERS, enemyHitReaches, isCharger } from '../src/combat/monsterTypes.ts';
import {
  buildMeleeLungeHit, meleeLungeConfig, plannedMeleeLunge, stepAimTracking, trackLockMs, trackingTurnRate,
} from '../src/combat/enemyTracking.ts';

test('모든 전투 몬스터는 예고 앞쪽에서 지연 추적하고 안광(패링 타이밍) 시점에 조준이 잠긴다', () => {
  for (const [kind, stats] of Object.entries(MONSTERS)) {
    if (stats.windupMs <= 0) continue;
    const immediate = isCharger(kind) || kind === 'swamp-lurker';
    const lock = trackLockMs(stats.windupMs, stats.strikeMs, immediate);
    const impactAt = immediate ? stats.windupMs : stats.windupMs + stats.strikeMs;
    assert.ok(lock > 0 && lock < stats.windupMs, `${kind}: lock(${lock})은 windup(${stats.windupMs}) 안쪽`);
    assert.ok(impactAt - lock >= 180, `${kind}: 조준 잠금 후 타격까지 최소 180ms 이상 패링·회피 여유 확보`);
    assert.ok(lock <= stats.windupMs * 0.72 + 1e-6, `${kind}: 예고 후반 28% 이상은 잠금 상태 유지`);
  }
  // 슬라임(480/110)은 안광(350ms) 직전에 잠겨 패링 시그널과 맞물린다
  const slimeLock = trackLockMs(MONSTERS.slime.windupMs, MONSTERS.slime.strikeMs, false);
  assert.ok(slimeLock <= MONSTERS.slime.windupMs + MONSTERS.slime.strikeMs - BLOCK.glintLeadMs + 1);
  // 안개 까마귀(360/0, 돌진형)도 안광 시점(120ms)에 조준이 잠겨 안광 이후 방향이 틀어지지 않는다
  const crowLock = trackLockMs(MONSTERS['fog-crow'].windupMs, MONSTERS['fog-crow'].strikeMs, true);
  assert.ok(crowLock <= MONSTERS['fog-crow'].windupMs - BLOCK.glintLeadMs + 1, `fog-crow lock=${crowLock}`);
});

test('지연 추적 회전은 360도 부드럽게 플레이어를 따라가고, 서리 딱정벌레는 느린 회전 개성을 유지한다', () => {
  assert.ok(trackingTurnRate('frost-beetle') < trackingTurnRate('slime') * 0.5, '서리 딱정벌레는 느리게 회전');
  assert.ok(trackingTurnRate('swamp-lurker') < trackingTurnRate('corrosion-tracker'));

  // 오른쪽을 보던 슬라임이 위쪽으로 걸어가는 플레이어를 300ms 동안 추적하면 위쪽 대각선으로 방향을 튼다
  let aim = { x: 1, y: 0 };
  for (let i = 0; i < 15; i++) {
    aim = stepAimTracking(aim, 10, -100, 0.02, trackingTurnRate('slime'));
  }
  assert.ok(Math.abs(Math.hypot(aim.x, aim.y) - 1) < 1e-9, '단위 벡터 유지');
  assert.ok(aim.y < -0.9, `추적 뒤 위쪽 조준 (${aim.x.toFixed(2)}, ${aim.y.toFixed(2)})`);

  // dt가 0이거나 목표가 제자리면 조준을 유지한다
  assert.deepEqual(stepAimTracking({ x: 1, y: 0 }, 0, 0, 0.05, 6), { x: 1, y: 0 });
  assert.deepEqual(stepAimTracking({ x: 0, y: 1 }, 100, 0, 0, 6), { x: 0, y: 1 });
});

test('근접 전진 스텝은 제자리 패링 대기자 뒤로 지나치지 않으면서, 걸어서 빠지는 플레이어를 따라잡는다', () => {
  // 1) 정면 90px에서 패링을 기다리는 플레이어: stopGap(42px) 앞에서 멈춰 정면 패링이 안정적으로 성립
  const stationaryStep = plannedMeleeLunge('slime', 90);
  const cfg = meleeLungeConfig('slime');
  assert.ok(stationaryStep <= 90 - cfg.stopGap + 1, '정면 패링 대기자 뒤로 통과하지 않는다');
  assert.ok(stationaryStep >= 34, '최소 전진 스텝 유지');

  // 2) 조준 잠금 직후 240ms 동안 걷기만으로 뒤로·옆으로 빠져도 전진 스텝 타격 캡슐에 걸린다
  const walkBackward = PLAYER_SPEED * 0.24; // 72px
  const walkSideways = PLAYER_SPEED * VERTICAL_SPEED_RATIO * 0.24; // 50.4px
  const hitForward = buildMeleeLungeHit('slime', 0, 0, stationaryStep, 0, { x: 1, y: 0 });
  assert.equal(hitForward.melee, true);
  assert.equal(enemyHitReaches(hitForward, 90 + walkBackward, 0), true, '뒤로 걸어 도망쳐도 전진 스텝에 맞는다');
  assert.equal(enemyHitReaches(hitForward, 90, walkSideways), true, '옆으로 걸어 빠져도 2D 캡슐에 맞는다');

  // 3) 반대로 회피 버튼으로 빠지면(250px) 확실히 피할 수 있다
  assert.equal(enemyHitReaches(hitForward, 90 + DODGE.distance, 0), false, '회피 대시로는 확실히 피할 수 있다');
  assert.equal(enemyHitReaches(hitForward, 90, DODGE.distance * VERTICAL_SPEED_RATIO), false, '회피로 크게 측면 이탈 시 빗나간다');

  // 4) 추적자·환영 같은 빠른 근접 적은 슬라임보다 더 깊게 전진한다
  assert.ok(meleeLungeConfig('corrosion-tracker').distance > meleeLungeConfig('slime').distance);
  assert.ok(meleeLungeConfig('frost-beetle').distance < meleeLungeConfig('slime').distance);
});
