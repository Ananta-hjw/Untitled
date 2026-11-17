/**
 * 시온이 받은 피해 기록. 쓰러졌을 때 "누구에게 얼마나 맞았는지" 보여 주는 데 쓴다.
 * 맵에 들어오거나 다시 일어날 때 새로 시작한다(그 사이에 받은 피해만 센다).
 * 이 파일은 Phaser를 쓰지 않아 tools/damage-log.test.mjs가 직접 불러 검사한다.
 */

export interface DamageSource {
  /** 몬스터 이름 (예: 슬라임) */
  name: string;
  level: number;
}

export interface DamageEntry extends DamageSource {
  /** 맞은 횟수 */
  hits: number;
  /** 받은 피해 합 */
  damage: number;
}

export interface DamageLog {
  entries: DamageEntry[];
  /** 마지막으로 피해를 준 쪽 */
  last?: DamageSource & { damage: number };
}

export function emptyDamageLog(): DamageLog {
  return { entries: [] };
}

/** 피해 한 번을 기록한다. 같은 이름·레벨끼리 묶는다. 원래 기록은 바꾸지 않는다. */
export function recordDamage(log: DamageLog, source: DamageSource, amount: number): DamageLog {
  const damage = Math.max(0, Math.round(amount));
  const found = log.entries.find((e) => e.name === source.name && e.level === source.level);
  const entries = found
    ? log.entries.map((e) => (e === found ? { ...e, hits: e.hits + 1, damage: e.damage + damage } : e))
    : [...log.entries, { name: source.name, level: source.level, hits: 1, damage }];
  return { entries, last: { name: source.name, level: source.level, damage } };
}

export interface DeathReport {
  /** 피해가 큰 순서 (같으면 많이 맞은 순, 그다음 이름 순) */
  rows: DamageEntry[];
  total: number;
  /** 마지막 일격 */
  killer?: DamageSource & { damage: number };
}

/** 쓰러졌을 때 보여 줄 정리. 화면에는 앞의 maxRows줄만 보이고 나머지는 "그 밖" 한 줄로 묶는다. */
export function deathReport(log: DamageLog, maxRows = 5): DeathReport {
  const sorted = [...log.entries].sort((a, b) => b.damage - a.damage || b.hits - a.hits || a.name.localeCompare(b.name) || a.level - b.level);
  const total = sorted.reduce((sum, e) => sum + e.damage, 0);
  let rows = sorted;
  if (sorted.length > maxRows) {
    const rest = sorted.slice(maxRows - 1);
    rows = [...sorted.slice(0, maxRows - 1), {
      name: `그 밖 ${rest.length}종`, level: 0,
      hits: rest.reduce((n, e) => n + e.hits, 0), damage: rest.reduce((n, e) => n + e.damage, 0),
    }];
  }
  return { rows, total, killer: log.last };
}
