import { HERO_GUARD_MOTION } from '../config.ts';
import type { Facing } from './heroFrames.ts';

/** Game-time only: brace on planted feet, then settle; left/right remain mirrored. */
export function guardMotion(elapsed: number, facing: Facing): { bodyAngle: number; swordAngle: number } {
  const t = Math.max(0, elapsed), motion = HERO_GUARD_MOTION;
  const ready = 1 - Math.exp(-t / motion.readyMs);
  const brace = Math.sin(Math.PI * Math.min(1, t / motion.braceMs));
  const breath = Math.sin(t * Math.PI * 2 / motion.breathMs) * ready;
  const side = facing.includes('left') ? -1 : facing.includes('right') ? 1 : 0;
  return {
    bodyAngle: side * (motion.braceLean * brace + motion.restLean * ready + motion.breathLean * breath),
    swordAngle: -motion.swordLift * Math.pow(Math.max(0, 1 - t / motion.liftMs), 2),
  };
}
