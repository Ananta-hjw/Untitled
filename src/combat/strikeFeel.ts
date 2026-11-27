/**
 * 적 공격의 날카로운 느낌 (게임 시계 ms, px).
 *  - 예비 동작이 끝나기 anticipateMs 전부터 몸을 pullBack만큼 뒤로 당겼다가(장전) 단숨에 튀어 나간다.
 *  - 치는 순간 몸이 하얗게 번쩍이고 앞쪽으로 날 선 빛줄기와 짧은 바람 소리가 난다(GameScene.onEnemySwing).
 *  - 돌진하는 동안 ghostEveryMs마다 잔상이 남아 ghostLifeMs 동안 사라진다.
 * 타격 판정과 타이밍은 바꾸지 않는다(보이는 것과 소리만).
 * Phaser를 쓰지 않아 tools/strike-feel.test.mjs가 직접 검사한다.
 */
export const STRIKE_FEEL = {
  anticipateMs: 90,
  pullBack: 10,
  ghostEveryMs: 40,
  ghostLifeMs: 170,
  ghostAlpha: 0.42,
  ghostMax: 6,
} as const;

/** 장전 정도(0~1): 예비 동작 마지막 anticipateMs 동안 0에서 1로 차오르고, 그 밖에는 0 */
export function strikeAnticipation(elapsed: number, windupMs: number, anticipateMs: number = STRIKE_FEEL.anticipateMs): number {
  if (windupMs <= 0 || elapsed >= windupMs || elapsed < 0) return 0;
  const left = windupMs - elapsed;
  if (left >= anticipateMs) return 0;
  const t = 1 - left / anticipateMs;
  return t * t;
}
