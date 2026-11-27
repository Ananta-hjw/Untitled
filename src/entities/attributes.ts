import { ATTRIBUTES, HIT_FEEL } from '../config.ts';
import { maxManaForLevel } from '../combat/mana.ts';
import { statsForLevel } from './progression.ts';

/**
 * 상태창의 네 가지 능력치(힘·체력·방어력·민첩)와, 그로부터 나오는 전투 수치.
 * Phaser를 쓰지 않아 tools/attributes.test.mjs가 직접 불러 검사한다. 수치는 config.ts의 ATTRIBUTES.
 */

export type StatId = 'str' | 'vit' | 'def' | 'dex';
export const STAT_IDS: StatId[] = ['str', 'vit', 'def', 'dex'];
export type StatBlock = Record<StatId, number>;

export const STAT_INFO: Record<StatId, { name: string; short: string; description: string }> = {
  str: { name: '힘', short: 'STR', description: '공격력이 오른다.' },
  vit: { name: '체력', short: 'VIT', description: '최대 체력이 오른다.' },
  def: { name: '방어력', short: 'DEF', description: '받는 피해가 줄어든다.' },
  dex: { name: '민첩', short: 'DEX', description: '치명타 확률·치명타 피해·회피 확률이 오르고 회피를 더 빨리 쓴다.' },
};

export function zeroStats(): StatBlock {
  return { str: 0, vit: 0, def: 0, dex: 0 };
}

/** 이 레벨까지 받은 포인트 */
export function pointsEarned(level: number): number {
  return ATTRIBUTES.pointsPerLevel * (Math.max(1, level) - 1);
}

export function pointsSpent(alloc: StatBlock): number {
  return STAT_IDS.reduce((sum, id) => sum + alloc[id], 0);
}

export function pointsLeft(level: number, alloc: StatBlock): number {
  return pointsEarned(level) - pointsSpent(alloc);
}

/** 포인트 하나를 stat에 쓴다. 남은 포인트가 없으면 null */
export function allocate(alloc: StatBlock, stat: StatId, level: number): StatBlock | null {
  if (pointsLeft(level, alloc) <= 0) return null;
  return { ...alloc, [stat]: alloc[stat] + 1 };
}

/** 최종 능력치 = 기본 + 분배 + 장비 */
export function totalStats(alloc: StatBlock, bonus: Partial<StatBlock> = {}): StatBlock {
  const out = zeroStats();
  for (const id of STAT_IDS) out[id] = ATTRIBUTES.base + alloc[id] + (bonus[id] ?? 0);
  return out;
}

export interface DerivedStats {
  maxHp: number;
  damageMin: number;
  damageMax: number;
  maxMp: number;
  /** 받는 피해에 곱한다 (1 이하) */
  damageTaken: number;
  /** 적의 공격을 그냥 피할 확률 (0~maxEvade) */
  evadeChance: number;
  /** 회피 재사용 대기에 곱한다 (1 이하, 최소 minDodgeScale) */
  dodgeCooldown: number;
  /** 치명타 확률 (0~1, 기본 10% + 민첩 보너스) */
  critChance: number;
  /** 치명타 피해 배율 (기본 1.6배 + 민첩 보너스) */
  critDamage: number;
}

/** 레벨(기본 성장)과 최종 능력치로 전투 수치를 만든다. */
export function deriveStats(level: number, stats: StatBlock): DerivedStats {
  const over = (id: StatId) => stats[id] - ATTRIBUTES.base;
  const base = statsForLevel(level);
  const strBonus = Math.round(ATTRIBUTES.damagePerStr * over('str'));
  const dexOver = Math.max(0, over('dex'));
  return {
    maxHp: Math.max(1, base.maxHp + ATTRIBUTES.hpPerVit * over('vit')),
    damageMin: Math.max(1, base.damageMin + strBonus),
    damageMax: Math.max(1, base.damageMax + strBonus),
    maxMp: Math.max(1, maxManaForLevel(level)),
    damageTaken: 100 / (100 + Math.max(0, ATTRIBUTES.defensePerDef * over('def'))),
    evadeChance: Math.min(ATTRIBUTES.maxEvade, ATTRIBUTES.evadePerDex * dexOver),
    dodgeCooldown: Math.max(ATTRIBUTES.minDodgeScale, 1 - ATTRIBUTES.dodgePerDex * dexOver),
    critChance: Math.min(1, HIT_FEEL.critChance + ATTRIBUTES.critPerDex * dexOver),
    critDamage: HIT_FEEL.critDamage + ATTRIBUTES.critDamagePerDex * dexOver,
  };
}

/** 받는 피해: 방어력을 반영한다. 최소 1 (패링한 공격은 아예 피해가 없다) */
export function mitigate(damage: number, derived: DerivedStats): number {
  return Math.max(1, Math.round(damage * derived.damageTaken));
}

/**
 * 능력치를 하나 올리면 무엇이 얼마나 바뀌는지 (상태창 안내). 실제 계산(deriveStats)으로 앞뒤를 비교한다.
 */
export function statGain(level: number, stats: StatBlock, stat: StatId): string {
  const now = deriveStats(level, stats);
  const next = deriveStats(level, { ...stats, [stat]: stats[stat] + 1 });
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const pct1 = (v: number) => `${(Math.round(v * 1000) / 10).toString()}%`;
  switch (stat) {
    case 'str': return `공격력 ${now.damageMin}~${now.damageMax} → ${next.damageMin}~${next.damageMax} (포인트당 +${ATTRIBUTES.damagePerStr})`;
    case 'vit': return `최대 체력 ${now.maxHp} → ${next.maxHp} (+${ATTRIBUTES.hpPerVit})`;
    case 'def': return `받는 피해 ${pct1(now.damageTaken)} → ${pct1(next.damageTaken)}`;
    case 'dex': {
      const crit = now.critChance >= 1
        ? `치명타 이미 최대(100%), 배율 ${pct(now.critDamage)} → ${pct(next.critDamage)}`
        : `치명타 ${pct1(now.critChance)} → ${pct1(next.critChance)}, 배율 ${pct(now.critDamage)} → ${pct(next.critDamage)}`;
      const evade = now.evadeChance >= ATTRIBUTES.maxEvade ? '회피 최대(30%)' : `회피 ${pct1(now.evadeChance)} → ${pct1(next.evadeChance)}`;
      const dodge = now.dodgeCooldown <= ATTRIBUTES.minDodgeScale ? '대기 최대(−30%)' : `대기 ${pct1(now.dodgeCooldown)} → ${pct1(next.dodgeCooldown)}`;
      return `${crit}\n${evade}, ${dodge}`;
    }
  }
}
