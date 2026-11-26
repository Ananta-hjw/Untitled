import type { Blade } from '../combat/blade.ts';
import type { GearId } from '../items/equipment.ts';

const BLADE_LENGTH_SCALE = {
  'wooden-sword': 1,
  'iron-sword': 1,
  'short-sword': 0.82,
  'long-sword': 1.14,
} as const satisfies Partial<Record<GearId, number>>;
export type WeaponId = keyof typeof BLADE_LENGTH_SCALE;

export function weaponId(id: GearId | undefined): WeaponId | null {
  return id && Object.hasOwn(BLADE_LENGTH_SCALE, id) ? id as WeaponId : null;
}

export function weaponLengthScale(id: WeaponId): number {
  return BLADE_LENGTH_SCALE[id];
}

export interface WeaponSmearStyle {
  outer: number;
  mid: number;
  core: number;
  widthScale: number;
}

/** 4종 무기마다 스윙 스미어·검기의 색감과 두께 개성을 부여한다(B안). */
const WEAPON_SMEAR: Record<WeaponId, WeaponSmearStyle> = {
  'wooden-sword': { outer: 0xd9a85b, mid: 0xffe0a3, core: 0xfff8e6, widthScale: 0.96 },
  'short-sword': { outer: 0x7ac5f0, mid: 0xd8f2ff, core: 0xffffff, widthScale: 0.92 },
  'long-sword': { outer: 0xb4c7e4, mid: 0xeef5ff, core: 0xffffff, widthScale: 1.16 },
  'iron-sword': { outer: 0xe8c776, mid: 0xfff2c2, core: 0xffffff, widthScale: 1.1 },
};

export function weaponSmearStyle(id: WeaponId | null | undefined): WeaponSmearStyle {
  return id ? WEAPON_SMEAR[id] : WEAPON_SMEAR['wooden-sword'];
}

// Empty scabbard mouths in the 313.5px cells of the unarmed walk sheet, in row/pose order
// (measured on the armed sheet, then moved with its poses: UNARMED_WALK_SHIFT in tools/build_hero_frames.py).
const WALK = [
  [125, 150], [105, 150], [99, 150], [79, 151],
  [195, 131], [178, 131], [169, 132], [152, 131],
  [117, 130], [105, 134], [98, 130], [88, 134],
  [201, 136], [185, 135], [176, 136], [160, 135],
];
const DIAGONAL = [
  [200, 143], [201, 143], [200, 143], [201, 143],
  [137, 135], [137, 135], [137, 135], [137, 135],
  [142, 147], [144, 148], [142, 147], [144, 148],
  [178, 157], [178, 157], [178, 157], [178, 157],
];
interface PoseFrame { name: string; x: number; y: number; blade: Blade | null; sheathedBlade?: Blade }
/** Held weapons retain the combat anchors; walking exposes only the hilt above the empty scabbard. */
export function weaponPose(frame: PoseFrame): { blade: Blade; sheathed: boolean } {
  if (frame.blade) return { blade: frame.blade, sheathed: false };
  if (frame.sheathedBlade) return { blade: frame.sheathedBlade, sheathed: true };
  const diagonal = frame.name.startsWith('diagonal-');
  const index = Number(frame.name.slice(frame.name.lastIndexOf('-') + 1));
  const row = Math.floor(index / 4), col = index % 4;
  const [x, y] = (diagonal ? DIAGONAL : WALK)[index];
  const [offsetX, offsetY] = (diagonal ? [[3, 13], [0, 8], [19, 11], [2, 1]] : [[4, 6], [0, 2], [14, 6], [0, 3]])[row];
  const base = { x: Math.round(col * 313.5) + x + offsetX - frame.x, y: Math.round(row * 313.5) + y + offsetY - frame.y };
  const pointsRight = diagonal ? row === 1 || row === 2 : row === 0 || row === 2;
  return { blade: { base, tip: { x: base.x + (pointsRight ? 60 : -60), y: base.y + 80 } }, sheathed: true };
}
