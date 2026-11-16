/**
 * 버튼의 원형 재사용 대기 표시: 남은 비율(0~360도)과 남은 초.
 * 게임 시계는 소수 ms를 더해 가므로(예: 1573.36 + 50 × 100) 남은 시간이 5000.000000000001ms처럼
 * 아주 조금 어긋날 수 있다. 그대로 올림하면 "5초"가 "6초"로 보이므로 먼저 ms 단위로 반올림한다.
 * Phaser를 쓰지 않아 tools/cooldown-display.test.mjs가 직접 불러 검사한다.
 */
export function cooldownDisplay(remaining: number, duration: number): { step: number; seconds: number } {
  const ms = Math.max(0, Math.round(remaining));
  const step = duration > 0 ? Math.ceil(Math.min(1, ms / duration) * 360) : 0;
  return { step, seconds: Math.ceil(ms / 1000) };
}
