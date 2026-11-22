/** 공격의 준비 구간에는 정지하고, 휘두르는 구간에서만 부드럽게 전진한다. */
export function lungeProgress(elapsedMs: number, startMs: number, endMs: number): number {
  const t = Math.max(0, Math.min(1, (elapsedMs - startMs) / (endMs - startMs)));
  return t * t * (3 - 2 * t);
}

/** 입력 세기가 아닌 충돌 처리 후 실제 이동 속도를 걷기 재생 속도로 사용한다. */
export function locomotionRate(dx: number, dy: number, dt: number, fullSpeed: number): number {
  return dt > 0 ? Math.hypot(dx, dy) / (dt * fullSpeed) : 0;
}

/**
 * 회피의 이동 진행도(0~1). 처음에 빠르고 끝으로 갈수록 느려진다.
 * 속도 곡선 0.4 + 1.2 × (남은 시간 비율)을 적분한 값이라, 프레임마다 진행도의 차이만큼
 * 움직이면 프레임 속도와 관계없이 정확히 같은 거리를 간다.
 */
export function dodgeProgress(elapsedMs: number, durationMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return 1.6 * t - 0.6 * t * t;
}

/** Normalized-time variant shared by the scene and variable-frame regression checks. */
export function dodgeDistanceRatio(progress: number): number {
  return dodgeProgress(progress, 1);
}
