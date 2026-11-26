import { attackPoseTime } from './attackTiming.ts';
import { cardinalPoseFacing, strikePoseStart, type Facing } from './heroFrames.ts';

export interface AttackBodyPose {
  scaleX: number;
  scaleY: number;
  bodyAngle: number;
  offsetY: number;
  /** 고속 스윙 순간 뻣뻣한 일자 칼을 살짝 부드럽게 녹여 스미어 아크와 일체화하는 투명도(0~1). */
  weaponAlpha: number;
}

const NEUTRAL: AttackBodyPose = { scaleX: 1, scaleY: 1, bodyAngle: 0, offsetY: 0, weaponAlpha: 1 };

/**
 * 나인솔즈·세키로 스타일 공격 신체 탄성(Squash & Stretch), 상체 기울기(Lean), 고속 스윙 스미어 블렌드.
 * - 예비(Anticipation): 몸을 살짝 압축·뒤로 젖혀 힘을 모은다(3타는 깊게 웅크림).
 * - 타격 스냅(Snap): 진행 방향으로 순간 신장하며 상체를 앞으로 싣고, 1·2타 고속 베기 중 58ms 동안
 *   일자 무기 레이어를 반투명하게 녹여 초승달 스미어 아크가 칼날을 자연스럽게 감싸게 한다.
 * - 잔심·복귀: 탄성 있게 1.0으로 안착한다.
 */
export function attackBodyMotion(stage: number, elapsedMs: number, facing: Facing): AttackBodyPose {
  if (stage < 0 || stage > 2 || elapsedMs < 0) return NEUTRAL;
  const t = attackPoseTime(stage, elapsedMs);
  const strikeAt = strikePoseStart(stage, facing);
  const dir = cardinalPoseFacing(facing);
  const side = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;

  // 1) 예비 구간: 힘을 모으는 압축과 뒤로 젖힘
  if (t < strikeAt) {
    const p = Math.sin(Math.PI * Math.min(1, t / Math.max(1, strikeAt)) * 0.5);
    if (stage === 2) {
      // 3타 관통 찌르기: 깊게 웅크리는 스프링 압축
      return {
        scaleX: 1 + 0.055 * p,
        scaleY: 1 - 0.075 * p,
        bodyAngle: -side * 0.075 * p,
        offsetY: 5 * p,
        weaponAlpha: 1,
      };
    }
    return {
      scaleX: 1 - 0.035 * p,
      scaleY: 1 + 0.035 * p,
      bodyAngle: -side * 0.055 * p,
      offsetY: 0,
      weaponAlpha: 1,
    };
  }

  // 2) 타격 스냅(0~76ms): 폭발적 신장 + 고속 스윙 스미어 블렌드
  const since = t - strikeAt;
  const snapDur = stage === 2 ? 92 : 74;
  const smearDur = 58;
  const weaponAlpha = stage < 2 && since < smearDur
    ? 1 - 0.64 * Math.sin(Math.PI * (since / smearDur))
    : 1;

  if (since < snapDur) {
    const u = since / snapDur;
    const snap = Math.exp(-3.4 * u) * Math.sin(Math.min(1, u * 3.2) * Math.PI * 0.5);
    if (side !== 0) {
      return {
        scaleX: 1 + (stage === 2 ? 0.115 : 0.088) * snap,
        scaleY: 1 - (stage === 2 ? 0.075 : 0.058) * snap,
        bodyAngle: side * (stage === 2 ? 0.105 : 0.08) * snap,
        offsetY: stage === 2 ? 3 * snap : 0,
        weaponAlpha,
      };
    }
    return {
      scaleX: 1 - (stage === 2 ? 0.065 : 0.048) * snap,
      scaleY: 1 + (stage === 2 ? 0.095 : 0.072) * snap,
      bodyAngle: 0,
      offsetY: 0,
      weaponAlpha,
    };
  }

  // 3) 잔심·복귀: 미세한 전진 여운 후 깔끔히 원복
  const tail = Math.max(0, 1 - (since - snapDur) / 110);
  return {
    scaleX: 1,
    scaleY: 1,
    bodyAngle: side * 0.025 * tail,
    offsetY: 0,
    weaponAlpha: 1,
  };
}
