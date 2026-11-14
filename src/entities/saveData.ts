import { PROGRESSION } from '../config.ts';
import { xpToNext, type Progress } from './progression.ts';

/**
 * 진행 상황 저장.
 *
 * 브라우저와 안드로이드 앱(WebView) 모두 localStorage에 저장한다. 앱을 지우면 함께 지워진다.
 * 저장소는 인자로 받는다. 게임은 window.localStorage를, 테스트는 가짜 저장소를 넘긴다.
 * 이 파일은 Phaser를 쓰지 않아 tools/save.test.mjs가 직접 불러 검사한다.
 */

export const SAVE_KEY = 'untitled-rpg.save';
/** 저장 형식이 바뀌면 올린다. 다른 버전의 저장은 읽지 않고 새로 시작한다. */
export const SAVE_VERSION = 1;

/** localStorage에서 쓰는 부분만 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SaveFile {
  version: number;
  level: number;
  xp: number;
}

/** 저장된 문자열을 읽는다. 없거나, 깨졌거나, 값이 말이 안 되면 null (새로 시작). */
export function parseSave(raw: string | null): Progress | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { version, level, xp } = data as Partial<SaveFile>;
  if (version !== SAVE_VERSION) return null;
  if (!Number.isInteger(level) || !Number.isInteger(xp)) return null;
  if (level! < 1 || level! > PROGRESSION.maxLevel || xp! < 0) return null;
  // 수치를 조정해서 필요 경험치가 줄었으면 다음 레벨 직전까지만 인정한다.
  const need = xpToNext(level!);
  return { level: level!, xp: need === 0 ? 0 : Math.min(xp!, need - 1) };
}

export function serializeSave(progress: Progress): string {
  const file: SaveFile = { version: SAVE_VERSION, level: progress.level, xp: progress.xp };
  return JSON.stringify(file);
}

/** 저장된 진행 상황. 저장소를 쓸 수 없거나 저장이 없으면 null. */
export function loadProgress(storage: SaveStorage | undefined): Progress | null {
  if (!storage) return null;
  try {
    return parseSave(storage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** 저장한다. 저장소가 가득 찼거나 막혀 있으면 조용히 넘어간다 (게임은 계속된다). 성공하면 true. */
export function saveProgress(storage: SaveStorage | undefined, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serializeSave(progress));
    return true;
  } catch {
    return false;
  }
}

/** 저장을 지운다 (처음부터 다시 하기). */
export function clearProgress(storage: SaveStorage | undefined): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // 지울 수 없으면 그대로 둔다.
  }
}

/** 게임에서 쓸 저장소. 사생활 보호 모드 등으로 막혀 있으면 undefined. */
export function browserStorage(): SaveStorage | undefined {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return undefined;
    const probe = `${SAVE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return undefined;
  }
}
