import Phaser from 'phaser';
import { DEPTH_UI } from '../config';

/**
 * 성능 테스트 표시: FPS(평균·최저), 가장 긴 프레임, 인물 수, 그림이 차지하는 메모리 추정치, JS 메모리.
 * 0.5초마다 실제 시간 기준으로 갱신한다. 그림 메모리는 불러온 텍스처의 가로×세로×4바이트 합이다
 * (글자 텍스처는 포함하지 않는다).
 */
export class PerfOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private elapsed = 0;
  private frames = 0;
  private worst = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly count: () => number) {
    this.text = scene.add.text(16, 96, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '18px', color: '#b8ff9e',
      backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(DEPTH_UI + 30).setResolution(2);
  }

  /** delta는 실제 프레임 간격(ms) */
  update(delta: number): void {
    this.elapsed += delta;
    this.frames++;
    this.worst = Math.max(this.worst, delta);
    if (this.elapsed < 500) return;
    const fps = (this.frames * 1000) / this.elapsed;
    const lowest = 1000 / this.worst;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    this.text.setText([
      `FPS ${fps.toFixed(0)} (최저 ${lowest.toFixed(0)}) · 가장 긴 프레임 ${this.worst.toFixed(0)}ms`,
      `인물 ${this.count()} · 그림 메모리 ${mb(textureBytes(this.scene))}${heap ? ` · JS ${mb(heap)}` : ''}`,
    ]);
    this.elapsed = 0;
    this.frames = 0;
    this.worst = 0;
  }
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(0)}MB`;

function textureBytes(scene: Phaser.Scene): number {
  let total = 0;
  for (const key of scene.textures.getTextureKeys()) {
    for (const source of scene.textures.get(key).source) total += source.width * source.height * 4;
  }
  return total;
}
