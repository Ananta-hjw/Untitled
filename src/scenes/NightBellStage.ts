import Phaser from 'phaser';
import { DEPTH_LIGHTING, VIEW_HEIGHT } from '../config';
import { FERRY_FOG_PATH } from '../story/chapterTwo';
import { FOG_TEXTURE, ensureFogTexture } from '../world/ferryVillageArt';

/** 종소리 한 번이 화면을 흐리는 시간(ms, 게임 시계) */
const BELL_MS = 5200;
/** 안개 길이 물로 풀리는 시간 */
const DISSOLVE_MS = 1800;
const FOG_PUFFS = 8;

/**
 * 퀘스트 6 "밤의 종소리"의 장면 효과 (story/nightBell.ts의 cue).
 *  - 종소리(bell): 화면 가운데에서 퍼지는 맑은 소리의 물결과, 시야가 하얗게 흐려졌다 돌아오는 맥박.
 *  - 안개 길(fogPath): 물가 강둑 끝에서 강 위로 낮게 깔린 하얀 길. 잠든 사람만 디딜 수 있다(그림일 뿐 걸을 수 없다).
 *    여관 주인이 깨어나면(dissolve) 물로 풀려 가라앉는다.
 * 모두 장면의 게임 시계로 움직여 대화 중에는 멈춘다. 장면이 다시 시작하면 함께 사라진다.
 */
export class NightBellStage {
  private readonly scene: Phaser.Scene;
  private readonly haze: Phaser.GameObjects.Graphics;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly fog: Array<{ image: Phaser.GameObjects.Image; x: number; alpha: number; phase: number }> = [];
  private width = 0;
  private now = 0;
  private bellAt = -Infinity;
  private dissolveAt = Infinity;

  constructor(scene: Phaser.Scene, options: { fogPath?: boolean } = {}) {
    this.scene = scene;
    this.haze = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_LIGHTING + 1);
    this.rings = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_LIGHTING + 2);
    if (options.fogPath) this.showFogPath();
  }

  layout(width: number): void { this.width = width; }

  /** 종소리: 작은 흔들림(보이는 연출만이라 실시간 카메라 효과를 쓴다)과 흐려짐 */
  bell(): void {
    this.bellAt = this.now;
    this.scene.cameras.main.shake(500, 0.0025);
  }

  /** 강둑 끝에서 강 위로 깔린 안개 길 */
  showFogPath(): void {
    if (this.fog.length) return;
    ensureFogTexture(this.scene);
    const { x, y, length } = FERRY_FOG_PATH;
    for (let i = 0; i < FOG_PUFFS; i++) {
      const t = i / (FOG_PUFFS - 1);
      // 강둑 쪽은 짙고 좁게, 강 가운데로 갈수록 넓고 엷게 퍼진다.
      const alpha = 0.92 - t * 0.4;
      const image = this.scene.add.image(x + t * length, y, FOG_TEXTURE)
        .setDisplaySize(230 + t * 160, 74 + t * 40).setAlpha(alpha).setDepth(y - 2).setName('night-fog-path');
      this.fog.push({ image, x: x + t * length, alpha, phase: i * 0.9 });
    }
  }

  /** 여관 주인이 깨어나 안개 길이 물로 풀린다 */
  dissolve(): void { this.dissolveAt = this.now; }

  update(now: number): void {
    this.now = now;
    this.drawBell(now - this.bellAt);
    const fade = Math.min(1, Math.max(0, (now - this.dissolveAt) / DISSOLVE_MS));
    const t = now / 1000;
    for (const p of this.fog) {
      p.image.setPosition(p.x + Math.sin(t * 0.8 + p.phase) * 10, FERRY_FOG_PATH.y + fade * 26)
        .setAlpha(p.alpha * (1 - fade) * (0.86 + 0.14 * Math.sin(t * 1.3 + p.phase)));
    }
  }

  private drawBell(elapsed: number): void {
    this.haze.clear();
    this.rings.clear();
    if (elapsed < 0 || elapsed > BELL_MS) return;
    const w = this.width || this.scene.scale.gameSize.width, h = VIEW_HEIGHT;
    const k = elapsed / BELL_MS;
    // 세 번 숨 쉬듯 하얗게 흐려지고, 점점 잦아든다.
    const pulse = Math.max(0, Math.sin(k * Math.PI * 3)) * (1 - k) * 0.32;
    this.haze.fillStyle(0xe8eef2, pulse).fillRect(0, 0, w, h);
    // 가장자리는 어둡게 조여 시야가 좁아진다.
    this.haze.fillStyle(0x0a1020, (1 - k) * 0.28);
    this.haze.fillRect(0, 0, w, h * 0.12).fillRect(0, h * 0.88, w, h * 0.12);
    // 소리의 물결: 가운데에서 둥글게 퍼진다.
    for (let i = 0; i < 3; i++) {
      const r = ((elapsed + i * 650) % 1950) / 1950;
      this.rings.lineStyle(3, 0xf4f8ff, (1 - r) * 0.45 * (1 - k)).strokeEllipse(w / 2, h * 0.42, 160 + r * w * 0.9, 70 + r * h * 0.55);
    }
  }
}
