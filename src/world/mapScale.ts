import { MAP_EXPANSION_SCALE } from '../config.ts';

/** 기존(2640×1760) 배치 좌표를 확장된 월드로 옮긴다. 원화 픽셀 좌표에는 적용하지 않는다. */
export const mapLength = (value: number): number => Math.round(value * MAP_EXPANSION_SCALE * 1000) / 1000;
export function mapPoint<T extends { x: number; y: number }>(point: T): T {
  return { ...point, x: mapLength(point.x), y: mapLength(point.y) };
}
export function mapRect<T extends { left: number; top: number; right: number; bottom: number }>(rect: T): T {
  return { ...rect, left: mapLength(rect.left), top: mapLength(rect.top), right: mapLength(rect.right), bottom: mapLength(rect.bottom) };
}
export function mapObstacle<T extends { x: number; y: number; rx: number; ry: number }>(obstacle: T): T {
  return { ...mapPoint(obstacle), rx: mapLength(obstacle.rx), ry: mapLength(obstacle.ry) };
}
export function mapProp<T extends { x: number; y: number; width: number; footprint?: { rx: number; ry: number } }>(prop: T): T {
  return { ...mapPoint(prop), width: mapLength(prop.width),
    ...(prop.footprint ? { footprint: { rx: mapLength(prop.footprint.rx), ry: mapLength(prop.footprint.ry) } } : {}) };
}
