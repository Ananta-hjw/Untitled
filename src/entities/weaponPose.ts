import type { Blade } from '../combat/blade.ts';
import type { GearId } from '../items/equipment.ts';

export type WeaponId = Extract<GearId, 'wooden-sword' | 'iron-sword'>;
export function weaponId(id: GearId | undefined): WeaponId | null {
  return id === 'wooden-sword' || id === 'iron-sword' ? id : null;
}

// Empty scabbard mouths measured in the original 313.5px cells, in row/pose order.
const WALK = [
  [124, 150], [125, 151], [124, 150], [125, 152],
  [194, 132], [194, 132], [194, 132], [194, 132],
  [115, 130], [123, 135], [117, 130], [123, 136],
  [201, 136], [202, 136], [201, 136], [202, 136],
];
const DIAGONAL = [
  [200, 143], [201, 143], [200, 143], [201, 143],
  [137, 135], [137, 135], [137, 135], [137, 135],
  [142, 147], [144, 148], [142, 147], [144, 148],
  [178, 157], [178, 157], [178, 157], [178, 157],
];
interface PoseFrame { name: string; x: number; y: number; blade: Blade | null }
/** Held weapons retain the combat anchors; walking exposes only the hilt above the empty scabbard. */
export function weaponPose(frame: PoseFrame): { blade: Blade; sheathed: boolean } {
  if (frame.blade) return { blade: frame.blade, sheathed: false };
  const diagonal = frame.name.startsWith('diagonal-');
  const index = Number(frame.name.slice(frame.name.lastIndexOf('-') + 1));
  const row = Math.floor(index / 4), col = index % 4;
  const [x, y] = (diagonal ? DIAGONAL : WALK)[index];
  const [offsetX, offsetY] = (diagonal ? [[3, 13], [0, 8], [19, 11], [2, 1]] : [[4, 6], [0, 2], [14, 6], [0, 3]])[row];
  const base = { x: Math.round(col * 313.5) + x + offsetX - frame.x, y: Math.round(row * 313.5) + y + offsetY - frame.y };
  const pointsRight = diagonal ? row === 1 || row === 2 : row === 0 || row === 2;
  return { blade: { base, tip: { x: base.x + (pointsRight ? 60 : -60), y: base.y + 80 } }, sheathed: true };
}
