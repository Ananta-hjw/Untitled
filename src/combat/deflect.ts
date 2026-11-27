/**
 * 흘리기: 정밀 패링하는 순간 조이스틱을 기울인 쪽으로 적의 공격을 흘려보낸다.
 *  - 공격한 적 쪽으로 미는 입력(maxTowardDot 이상 같은 방향)이나 약한 입력은 흘리기가 아니다(그냥 정밀 패링).
 *  - 근접·원거리 공격: 흘린 힘이 그 방향 reach 안, coneDeg 부채꼴의 가장 가까운 다른 적에게 맞는다.
 *    공격한 적도 그 방향으로 밀려나며 몸이 돌아가 옆구리·등을 드러낸다.
 *  - 돌진: 멈추지 않고 흘린 쪽으로 꺾여(chargeBend) 시온을 지나쳐 간다. 끝난 자리에서 경직한다.
 * 좌표는 화면(바닥) 좌표, 세로는 verticalRatio로 나눠 바닥 거리로 잰다.
 * Phaser를 쓰지 않아 tools/deflect.test.mjs가 직접 검사한다.
 */
export const DEFLECT = {
  minInput: 0.5,
  maxTowardDot: 0.6,
  chargeBend: 0.75,
  reach: 200,
  coneDeg: 55,
  damageScale: 1.4,
  pushScale: 1.35,
} as const;

export interface Vec { x: number; y: number }

/** 흘릴 방향(단위 벡터). 입력이 약하거나 공격한 적 쪽이면 undefined */
export function deflectDirection(inputX: number, inputY: number, toAttackerX: number, toAttackerY: number): Vec | undefined {
  const m = Math.hypot(inputX, inputY);
  if (m < DEFLECT.minInput) return undefined;
  const ix = inputX / m, iy = inputY / m;
  const a = Math.hypot(toAttackerX, toAttackerY);
  if (a > 0 && (ix * toAttackerX + iy * toAttackerY) / a >= DEFLECT.maxTowardDot) return undefined;
  return { x: ix, y: iy };
}

/** 돌진 방향을 흘린 쪽으로 amount만큼 꺾은 단위 벡터 */
export function bendCharge(aim: Vec, toward: Vec, amount: number = DEFLECT.chargeBend): Vec {
  const x = aim.x * (1 - amount) + toward.x * amount, y = aim.y * (1 - amount) + toward.y * amount;
  const m = Math.hypot(x, y);
  return m > 1e-6 ? { x: x / m, y: y / m } : { x: toward.x, y: toward.y };
}

/**
 * 흘린 힘이 맞을 적: from에서 dir 쪽 부채꼴(coneDeg) 안, reach 바닥 거리 안에서 가장 가까운 후보의 번호. 없으면 -1.
 */
export function pickDeflectTarget(from: Vec, dir: Vec, candidates: readonly Vec[], verticalRatio: number,
  reach: number = DEFLECT.reach, coneDeg: number = DEFLECT.coneDeg): number {
  const cos = Math.cos(coneDeg * Math.PI / 180);
  const dm = Math.hypot(dir.x, dir.y / verticalRatio) || 1;
  const ux = dir.x / dm, uy = dir.y / verticalRatio / dm;
  let best = -1, bestDistance = reach;
  candidates.forEach((c, i) => {
    const dx = c.x - from.x, dy = (c.y - from.y) / verticalRatio;
    const d = Math.hypot(dx, dy);
    if (d > bestDistance || d === 0) return;
    if ((dx * ux + dy * uy) / d < cos) return;
    best = i;
    bestDistance = d;
  });
  return best;
}
