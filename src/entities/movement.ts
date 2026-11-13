/** 공격의 준비 구간에는 정지하고, 휘두르는 구간에서만 부드럽게 전진한다. */
export function lungeProgress(elapsedMs: number, startMs: number, endMs: number): number {
  const t = Math.max(0, Math.min(1, (elapsedMs - startMs) / (endMs - startMs)));
  return t * t * (3 - 2 * t);
}

/** 입력 세기가 아닌 충돌 처리 후 실제 이동 속도를 걷기 재생 속도로 사용한다. */
export function locomotionRate(dx: number, dy: number, dt: number, fullSpeed: number): number {
  return dt > 0 ? Math.hypot(dx, dy) / (dt * fullSpeed) : 0;
}
