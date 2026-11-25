/** 로웬과 인접 지역의 기존 배치 데이터를 현재 월드 픽셀 좌표로 변환한다. */
export const mapLength = (value: number): number => Math.round(value * 1300) / 1000;
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
