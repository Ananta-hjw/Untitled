import { HERO_GUARD_MOTION } from '../config.ts';
import type { Facing } from './heroFrames.ts';

/**
 * Game-time only: brace on planted feet, then settle; left/right remain mirrored.
 * recoilElapsed(선택): 패링·막기로 충격을 받아낸 직후 검과 상체가 탄성 있게 튕겼다가 고정되는 반동.
 */
export function guardMotion(elapsed: number, facing: Facing, recoilElapsed?: number): { bodyAngle: number; swordAngle: number } {
  const t = Math.max(0, elapsed), motion = HERO_GUARD_MOTION;
  const ready = 1 - Math.exp(-t / motion.readyMs);
  const brace = Math.sin(Math.PI * Math.min(1, t / motion.braceMs));
  const breath = Math.sin(t * Math.PI * 2 / motion.breathMs) * ready;
  const side = facing.includes('left') ? -1 : facing.includes('right') ? 1 : 0;
  let recoilBody = 0;
  let swordKick = 0;
  if (recoilElapsed !== undefined && recoilElapsed >= 0 && recoilElapsed < 220) {
    const r = recoilElapsed / 220;
    const wave = Math.exp(-4.6 * r) * Math.cos(r * Math.PI * 2.4);
    recoilBody = -0.042 * wave;
    swordKick = -0.22 * wave;
  }
  return {
    bodyAngle: side * (motion.braceLean * brace + motion.restLean * ready + motion.breathLean * breath + recoilBody),
    swordAngle: -motion.swordLift * Math.pow(Math.max(0, 1 - t / motion.liftMs), 2) + swordKick,
  };
}
