import Phaser from 'phaser';
import { ferryTexture } from './ferryVillage';
import type { FerryObjectId } from './villageLayout';

const urls = import.meta.glob<string>('../assets/maps/ferry-village/objects/*.webp', { eager: true, query: '?url', import: 'default' });

/** 물안개 나루의 건물·소품을 하나씩 따로 불러온다(각 그림이 하나의 텍스처, 프레임은 '__BASE'). */
export function preloadFerryVillage(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(urls)) {
    const id = path.slice(path.lastIndexOf('/') + 1, -'.webp'.length) as FerryObjectId;
    const key = ferryTexture(id);
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/** 강 위 안개 한 덩이: 강의 가로 범위(x) 안에서 천천히 오르내리며 흘러간다. */
interface FogPuff { image: Phaser.GameObjects.Image; x: number; y: number; drift: number; phase: number; alpha: number }

const FOG_TEXTURE = 'ferry-river-fog';
/** 강물이 시작되는 x (걸을 수 있는 강둑의 동쪽 끝 너머) */
const RIVER_LEFT = 3150;
const RIVER_RIGHT = 4800;
/** 사람·건물(깊이 = 발 y, 최대 3200)보다 위, 조명과 화면 효과(5000)보다 아래 */
const DEPTH_FOG = 3400;

/**
 * 물안개 나루의 강 위 안개. 낮에도 강 위에만 엷게 걸려 있다(docs/story-chapter2.md: "해가 떴는데도 강 위에 안개가 걸려 있어").
 * 부드러운 안개 덩이 몇 개를 처음에 만들어 두고 게임 시계로 움직이므로, 일시정지·대화 중에는 멈춘다.
 */
export class FerryScenery {
  private readonly puffs: FogPuff[] = [];

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(FOG_TEXTURE)) {
      const size = 256, texture = scene.textures.createCanvas(FOG_TEXTURE, size, size)!, ctx = texture.context;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [stop, alpha] of [[0, 1], [0.35, 0.7], [0.7, 0.22], [1, 0]]) gradient.addColorStop(stop, `rgba(235, 242, 245, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      texture.refresh();
    }
    // 강을 따라 위에서 아래로 줄지어 둔다. 크기·짙기·흐름을 조금씩 다르게.
    for (let i = 0; i < 14; i++) {
      // 강둑 가까이(잔교·배가 보이는 곳)에 더 많이 걸리게, 강 서쪽 2/3 안에 둔다.
      const x = RIVER_LEFT + 150 + ((i * 577) % 1100);
      const y = 120 + i * 225;
      const alpha = 0.32 + (i % 3) * 0.07;
      const image = scene.add.image(x, y, FOG_TEXTURE).setDisplaySize(1100 + (i % 4) * 180, 420 + (i % 3) * 70)
        .setAlpha(alpha).setDepth(DEPTH_FOG).setName('ferry-river-fog');
      this.puffs.push({ image, x, y, drift: 18 + (i % 5) * 7, phase: i * 1.7, alpha });
    }
  }

  update(time: number): void {
    const t = time / 1000;
    for (const p of this.puffs) {
      // 강물 따라 아래로 아주 천천히 흐르고, 좌우로 숨 쉬듯 흔들린다.
      const y = ((p.y + t * p.drift) % 3400) - 100;
      p.image.setPosition(p.x + Math.sin(t / 7 + p.phase) * 60, y)
        .setAlpha(p.alpha * (0.85 + 0.15 * Math.sin(t / 5 + p.phase)));
    }
  }
}

