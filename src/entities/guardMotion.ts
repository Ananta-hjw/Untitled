import { HERO_GUARD_MOTION } from '../config.ts';
import type { Facing } from './heroFrames.ts';

export type GuardMode = 'guard' | 'charging' | 'chargeReady' | 'unboundRelease';

export interface GuardPoseMotion {
  bodyAngle: number;
  swordAngle: number;
  scaleX: number;
  scaleY: number;
  offsetY: number;
}

/**
 * Game-time only: brace on planted feet, then settle; left/right remain mirrored.
 * - recoilElapsed(선택): 패링·막기로 충격을 받아낸 직후 검과 상체가 탄성 있게 튕겼다가 고정되는 반동.
 * - mode(선택): 일반 막기('guard'), 차지 패링 모으기('charging'/'chargeReady'), 차지 패링 방출('unboundRelease') 자세를 구분한다.
 */
export function guardMotion(
  elapsed: number,
  facing: Facing,
  recoilElapsed?: number,
  mode: GuardMode = 'guard',
): GuardPoseMotion {
  const t = Math.max(0, elapsed), motion = HERO_GUARD_MOTION;
  const ready = 1 - Math.exp(-t / motion.readyMs);
  const brace = Math.sin(Math.PI * Math.min(1, t / motion.braceMs));
  const breath = Math.sin(t * Math.PI * 2 / motion.breathMs) * ready;
  const side = facing.includes('left') ? -1 : facing.includes('right') ? 1 : 0;

  let recoilBody = 0;
  let swordKick = 0;
  let recoilSquash = 0;
  if (recoilElapsed !== undefined && recoilElapsed >= 0 && recoilElapsed < 220) {
    const r = recoilElapsed / 220;
    const env = Math.exp(-4.6 * r);
    const wave = env * Math.cos(r * Math.PI * 2.4);
    recoilBody = -0.052 * wave;
    swordKick = -0.32 * wave;
    recoilSquash = 0.065 * env;
  }

  // 막기 시작 순간 무릎을 낮추는 짧은 착지 압축
  const drop = t < 95 ? Math.sin(Math.PI * (t / 95)) : 0;
  const baseBody = side * (motion.braceLean * brace + motion.restLean * ready + motion.breathLean * breath + recoilBody);
  const baseSword = -motion.swordLift * Math.pow(Math.max(0, 1 - t / motion.liftMs), 2) + swordKick;
  const baseScaleX = 1 + 0.055 * drop + recoilSquash;
  const baseScaleY = 1 - 0.06 * drop - recoilSquash;

  if (mode === 'charging' || mode === 'chargeReady') {
    const coil = Math.min(1, t / 140);
    const tremor = mode === 'chargeReady' ? Math.sin(t / 22) * 0.014 : 0;
    return {
      bodyAngle: side * (-0.065 * coil + tremor * 0.4),
      swordAngle: 0.48 * coil + tremor,
      scaleX: 1 + 0.075 * coil,
      scaleY: 1 - 0.085 * coil,
      offsetY: 5 * coil,
    };
  }

  if (mode === 'unboundRelease') {
    const burst = recoilElapsed !== undefined && recoilElapsed >= 0 && recoilElapsed < 220
      ? Math.exp(-4 * (recoilElapsed / 220)) : 0.65;
    return {
      bodyAngle: side * (0.085 * burst + recoilBody),
      swordAngle: -0.44 * burst + swordKick * 0.5,
      scaleX: 1 - 0.05 * burst,
      scaleY: 1 + 0.07 * burst,
      offsetY: -2 * burst,
    };
  }

  return {
    bodyAngle: baseBody,
    swordAngle: baseSword,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    offsetY: 2 * drop,
  };
}
