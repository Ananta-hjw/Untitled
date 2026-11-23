/** Shared game-clock tuning; effects never grant invulnerability or create a real enemy. */
export const FOG_CROW = { cooldownMs: 2400, decoyMs: 650, recoverMs: 420, escapeDistance: 150, minPlayerDistance: 100, swoopDistance: 140 };

/** Try bounded escape points away from the attacker; stay put if all are blocked. */
export function fogEscape(from: { x: number; y: number }, threat: { x: number; y: number },
  canReach: (x: number, y: number) => boolean): { x: number; y: number } | undefined {
  const away = Math.atan2(from.y - threat.y, from.x - threat.x);
  for (const distance of [FOG_CROW.escapeDistance, FOG_CROW.escapeDistance * 0.7]) {
    for (const turn of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const x = from.x + Math.cos(away + turn) * distance;
      const y = from.y + Math.sin(away + turn) * distance;
      if (Math.hypot(x - threat.x, y - threat.y) >= FOG_CROW.minPlayerDistance && canReach(x, y)) return { x, y };
    }
  }
  return undefined;
}
