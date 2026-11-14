import { JUST_DODGE } from '../config.ts';
import type { SaveStorage } from '../entities/saveData.ts';

/**
 * 조작 설정과 그 저장.
 *
 * 진행 상황 저장(untitled-rpg.save)과는 따로 저장한다. 값 하나가 잘못돼 있어도 그 값만 기본값으로 돌린다.
 * Phaser를 쓰지 않는 순수 모듈이라 tools/settings.test.mjs가 직접 불러 검사한다.
 */

export const SETTINGS_KEY = 'untitled-rpg.settings';

export type Size = 'small' | 'normal' | 'large';
export type Timing = 'strict' | 'normal' | 'lenient';

export interface Settings {
  /** 공격·회피·대화 버튼 크기 */
  buttonSize: Size;
  joystickSize: Size;
  /** 저스트 회피 판정의 여유 */
  justDodgeTiming: Timing;
}

export const DEFAULT_SETTINGS: Settings = { buttonSize: 'normal', joystickSize: 'normal', justDodgeTiming: 'normal' };

export const SIZES: readonly Size[] = ['small', 'normal', 'large'];
export const TIMINGS: readonly Timing[] = ['strict', 'normal', 'lenient'];

export const SIZE_LABEL: Record<Size, string> = { small: '작게', normal: '보통', large: '크게' };
export const TIMING_LABEL: Record<Timing, string> = { strict: '엄격', normal: '보통', lenient: '여유' };

const SIZE_SCALE: Record<Size, number> = { small: 0.85, normal: 1, large: 1.18 };
const TIMING_SCALE: Record<Timing, number> = { strict: 0.7, normal: 1, lenient: 1.3 };

export function sizeScale(size: Size): number {
  return SIZE_SCALE[size];
}

/** 저스트 회피로 인정하는 시간(ms) */
export function justDodgeWindowMs(timing: Timing): number {
  return Math.round(JUST_DODGE.windowMs * TIMING_SCALE[timing]);
}

/** 목록에서 한 칸 앞(+1)이나 뒤(-1)의 값. 끝에서 멈춘다. */
export function stepOption<T>(options: readonly T[], current: T, direction: 1 | -1): T {
  const index = Math.max(0, options.indexOf(current));
  return options[Math.min(options.length - 1, Math.max(0, index + direction))];
}

export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // 깨진 설정은 모두 기본값으로
  }
  const pick = <T>(options: readonly T[], value: unknown, fallback: T): T =>
    options.includes(value as T) ? (value as T) : fallback;
  return {
    buttonSize: pick(SIZES, data.buttonSize, DEFAULT_SETTINGS.buttonSize),
    joystickSize: pick(SIZES, data.joystickSize, DEFAULT_SETTINGS.joystickSize),
    justDodgeTiming: pick(TIMINGS, data.justDodgeTiming, DEFAULT_SETTINGS.justDodgeTiming),
  };
}

export function loadSettings(storage: SaveStorage | undefined): Settings {
  try {
    return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: SaveStorage | undefined, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
