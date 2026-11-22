import { PLAYER } from '../config.ts';

/** Only the hero's pose pauses; enemies, cooldowns and dodge inputs keep running. */
export function isAttackFollowPause(stage: number, elapsed: number): boolean {
  const combo = PLAYER.combo[stage];
  return elapsed >= combo.followPauseAtMs && elapsed < combo.followPauseAtMs + combo.followPauseMs;
}

/** Remove the held interval from the pose clock, without delaying the damage window. */
export function attackPoseTime(stage: number, elapsed: number): number {
  const combo = PLAYER.combo[stage];
  return elapsed - Math.max(0, Math.min(combo.followPauseMs, elapsed - combo.followPauseAtMs));
}
