import Phaser from 'phaser';
import { ITEM_ICON_TEXTURE } from './itemIcons';

/**
 * 아이콘 그림. src/assets/icons/<group>/<id>.png(또는 .webp)를 넣으면 자동으로 읽어 쓴다.
 *  - items/<아이템·장비 id>   예: items/potion.png, items/iron-sword.png
 *  - stats/<능력치 id>        예: stats/str.png
 *  - slots/<장비 칸 id>       빈 칸에 흐리게 보이는 그림. 예: slots/weapon.png
 * 아이템 공용 아틀라스도 재사용하며, 둘 다 없으면 색 상자와 글자로 임시 아이콘을 그린다(src/assets/icons/README.md).
 */

export type IconGroup = 'items' | 'stats' | 'slots';

const URLS = import.meta.glob<string>([
  '../assets/icons/*/*.{png,webp}',
  '!../assets/icons/items/{short-sword.webp,bronze-helm.png,bronze-bracers.png,scale-armor.png,heron-feather-boots.png}',
  '!../assets/icons/stats/{int.png,luk.png}',
], { eager: true, query: '?url', import: 'default' });

export function iconKey(group: IconGroup, id: string): string {
  return `icon:${group}/${id}`;
}

export function preloadIcons(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(URLS)) {
    const match = /icons\/([^/]+)\/([^/]+)\.(png|webp)$/.exec(path);
    if (!match) continue;
    const key = `icon:${match[1]}/${match[2]}`;
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

export interface IconFallback {
  glyph: string;
  color: number;
}

/** 아이콘 한 칸: 테두리 상자, 그림(있으면) 또는 임시 글자, 개수, 누르는 영역. */
export class IconView {
  private readonly scene: Phaser.Scene;
  readonly size: number;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image;
  private readonly glyph: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private x = 0;
  private y = 0;
  private color = 0x2a4236;
  private selected = false;
  private dim = false;
  private shown = false;

  constructor(scene: Phaser.Scene, size: number, depth: number, onTap?: () => void) {
    this.scene = scene;
    this.size = size;
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    this.image = scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(depth + 1);
    this.glyph = scene.add.text(0, 0, '', {
      fontFamily: 'system-ui, "Noto Sans KR", sans-serif', fontSize: `${Math.round(size * 0.3)}px`, fontStyle: 'bold', color: '#f6ecd4',
      stroke: '#10221a', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1).setResolution(2);
    this.count = scene.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: `${Math.max(14, Math.round(size * 0.24))}px`, fontStyle: 'bold', color: '#fff3d0',
      stroke: '#0c1712', strokeThickness: 4,
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(depth + 2).setResolution(2);
    this.hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0.001).setScrollFactor(0).setDepth(depth + 3);
    if (onTap) this.hit.setInteractive({ useHandCursor: true }).on('pointerup', onTap);
    this.setVisible(false);
  }

  /** 그림을 정한다. 그림 파일이 없으면 fallback 글자를 쓴다. */
  set(group: IconGroup, id: string, fallback: IconFallback, count?: number, dim = false): this {
    const key = iconKey(group, id);
    const standalone = this.scene.textures.exists(key);
    const inAtlas = group === 'items' && this.scene.textures.exists(ITEM_ICON_TEXTURE)
      && this.scene.textures.get(ITEM_ICON_TEXTURE).has(id);
    const has = standalone || inAtlas;
    this.color = fallback.color;
    this.dim = dim;
    if (has) {
      this.image.setTexture(standalone ? key : ITEM_ICON_TEXTURE, standalone ? undefined : id);
      const frame = this.image.frame;
      const scale = (this.size * 0.82) / Math.max(frame.width, frame.height);
      this.image.setScale(scale);
    }
    this.image.setData('has', has);
    this.glyph.setText(has ? '' : fallback.glyph);
    this.count.setText(count !== undefined && count > 1 ? String(count) : '');
    this.draw();
    return this;
  }

  setSelected(selected: boolean): this {
    this.selected = selected;
    this.draw();
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.image.setPosition(x, y);
    this.glyph.setPosition(x, y);
    this.count.setPosition(x + this.size / 2 - 5, y + this.size / 2 - 2);
    this.hit.setPosition(x, y);
    this.draw();
    return this;
  }

  setVisible(visible: boolean): this {
    this.shown = visible;
    this.frame.setVisible(visible);
    this.image.setVisible(visible && !!this.image.getData('has'));
    this.glyph.setVisible(visible);
    this.count.setVisible(visible);
    this.hit.setVisible(visible);
    if (this.hit.input) this.hit.input.enabled = visible;
    return this;
  }

  private draw(): void {
    const s = this.size, g = this.frame.clear();
    g.fillStyle(this.dim ? 0x16241d : this.color, this.dim ? 0.6 : 0.95).fillRoundedRect(this.x - s / 2, this.y - s / 2, s, s, 10);
    g.lineStyle(this.selected ? 4 : 2, this.selected ? 0xffd77a : 0x8fa688, this.selected ? 1 : 0.7)
      .strokeRoundedRect(this.x - s / 2, this.y - s / 2, s, s, 10);
    this.image.setAlpha(this.dim ? 0.35 : 1);
    this.glyph.setAlpha(this.dim ? 0.45 : 1);
    if (this.shown) this.image.setVisible(!!this.image.getData('has'));
  }
}
