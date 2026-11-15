import Phaser from 'phaser';
import { DEPTH_UI } from '../config';
import type { GameMap } from '../world/maps';
import type { QuestMarker } from '../story/quests';
import { MARKER_STYLE } from '../entities/Npc';
import { furnitureObstacles } from '../world/interiors';

/** 화면에 그리는 지름(px)과 캔버스 배율 (선명하게 두 배로 그린다) */
const SIZE = 150;
const RES = 2;
/** 미니맵 반지름에 담기는 월드 거리 */
const VIEW_RADIUS = 720;
/** 다시 그리는 간격(실제 시간 ms). 매 프레임 그리지 않아 휴대폰 부담을 줄인다. */
const REDRAW_MS = 100;
const KEY = 'minimap-canvas';

export interface MinimapDot { x: number; y: number; marker?: QuestMarker }

/**
 * 오른쪽 위의 둥근 미니맵. 플레이어를 가운데 두고 주변 지형, 건물, 나무, 출구, 마을 사람, 몬스터를 보여 준다.
 * 퀘스트 표시(!, ?)가 있는 사람은 미니맵 밖에 있어도 가장자리에 방향을 알려 준다.
 * 캔버스(2D)에 그린 뒤 텍스처로 올린다. 0.1초마다 다시 그린다.
 */
export class Minimap {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private elapsed = REDRAW_MS;
  private readonly scale = (SIZE / 2) / VIEW_RADIUS;

  constructor(private readonly scene: Phaser.Scene, private readonly map: GameMap) {
    const existing = scene.textures.exists(KEY) ? scene.textures.get(KEY) : undefined;
    this.texture = (existing as Phaser.Textures.CanvasTexture | undefined) ?? scene.textures.createCanvas(KEY, SIZE * RES, SIZE * RES)!;
    this.image = scene.add.image(0, 0, KEY).setDisplaySize(SIZE, SIZE).setScrollFactor(0).setDepth(DEPTH_UI + 4);
    this.title = scene.add.text(0, 0, map.name, {
      fontFamily: 'system-ui, "Noto Sans KR", sans-serif', fontSize: '15px', fontStyle: 'bold',
      color: '#f5ead2', stroke: '#1a1008', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH_UI + 5).setResolution(2);
  }

  /** 미니맵 가운데 위치(화면 좌표) */
  layout(cx: number, cy: number): void {
    this.image.setPosition(cx, cy);
    this.title.setPosition(cx, cy + SIZE / 2 + 2);
  }

  /** 미니맵 아래 끝(화면 좌표). 퀘스트 목록을 그 아래에 둔다. */
  get bottom(): number {
    return this.title.y + 20;
  }

  /** collect는 다시 그릴 때만 부른다 (매 프레임 배열을 만들지 않게). */
  update(realDelta: number, player: { x: number; y: number }, collect: () => { npcs: MinimapDot[]; enemies: MinimapDot[] }): void {
    this.elapsed += realDelta;
    if (this.elapsed < REDRAW_MS) return;
    this.elapsed = 0;
    const { npcs, enemies } = collect();
    this.draw(player, npcs, enemies);
  }

  private draw(player: { x: number; y: number }, npcs: MinimapDot[], enemies: MinimapDot[]): void {
    const ctx = this.texture.context;
    const size = SIZE * RES, r = size / 2, k = this.scale * RES;
    const toX = (x: number) => r + (x - player.x) * k;
    const toY = (y: number) => r + (y - player.y) * k;
    const textures = this.scene.textures;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2c3a22';
    ctx.fillRect(0, 0, size, size);

    const b = this.map.bounds;
    if (this.map.interior) {
      // 실내: 방 바닥과 가구 자리만 간단히 그린다.
      ctx.fillStyle = '#0d0906';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = `#${this.map.interior.floor.toString(16).padStart(6, '0')}`;
      ctx.fillRect(toX(b.left), toY(b.top), (b.right - b.left) * k, (b.bottom - b.top) * k);
      ctx.fillStyle = 'rgba(40,24,12,0.85)';
      for (const o of furnitureObstacles(this.map.interior)) ctx.fillRect(toX(o.x - o.rx), toY(o.y - o.ry), o.rx * 2 * k, o.ry * 2 * k);
    } else {
      // 지면 (맵 전체 그림을 줄여서 옮긴다) + 맵 색조
      const ground = textures.get('village-ground').getSourceImage() as CanvasImageSource;
      const left = toX(0), top = toY(0), w = 2400 * k, h = 1600 * k;
      ctx.drawImage(ground, left, top, w, h);
      if (this.map.groundTint !== undefined) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `#${this.map.groundTint.toString(16).padStart(6, '0')}`;
        ctx.fillRect(left, top, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (this.map.water) {
        ctx.fillStyle = '#4f9fc4';
        ctx.fillRect(left, toY(this.map.water.top), w, (this.map.water.bottom - this.map.water.top) * k);
      }
      // 걸을 수 없는 바깥은 어둡게
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(left, top, w, toY(b.top) - top);
      ctx.fillRect(left, toY(b.bottom), w, top + h - toY(b.bottom));

      // 나무·바위와 건물: 게임과 같은 그림을 작게 그린다.
      const props = textures.get('village-props');
      for (const p of this.map.props) {
        if (p.frame === 'flowers' || p.frame === 'rock') continue;
        this.drawFrame(ctx, props, p.frame, toX(p.x), toY(p.y), p.width * k);
      }
      const buildings = textures.get('village-buildings');
      for (const bd of this.map.buildings) this.drawFrame(ctx, buildings, bd.frame, toX(bd.x), toY(bd.y), bd.width * k);
    }

    // 출구: 노란 화살표
    for (const exit of this.map.exits) {
      const x = toX((exit.zone.left + exit.zone.right) / 2), y = toY((Math.max(exit.zone.top, b.top) + Math.min(exit.zone.bottom, b.bottom)) / 2);
      const angle = Math.atan2(y - r, x - r);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#1a1008';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }

    // 몬스터와 마을 사람
    for (const e of enemies) this.dot(ctx, toX(e.x), toY(e.y), 7, '#ff5a4a');
    for (const n of npcs) this.dot(ctx, toX(n.x), toY(n.y), 6, '#f5ead2');
    // 퀘스트 표시: 미니맵 밖이면 가장자리에 붙인다.
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of npcs) {
      if (!n.marker) continue;
      let x = toX(n.x), y = toY(n.y) - 18;
      const dx = x - r, dy = y - r, d = Math.hypot(dx, dy), edge = r - 22;
      if (d > edge) { x = r + (dx / d) * edge; y = r + (dy / d) * edge; }
      const style = MARKER_STYLE[n.marker];
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1a1008';
      ctx.strokeText(style.text, x, y);
      ctx.fillStyle = style.color;
      ctx.fillText(style.text, x, y);
    }

    // 플레이어 (가운데)
    this.dot(ctx, r, r, 10, '#5ec8ff', '#ffffff', 4);
    ctx.restore();

    // 테두리
    ctx.beginPath();
    ctx.arc(r, r, r - 4, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#e8c37a';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1008';
    ctx.stroke();
    this.texture.refresh();
  }

  /** 아틀라스 프레임을 바닥 가운데 기준으로 그린다. */
  private drawFrame(ctx: CanvasRenderingContext2D, texture: Phaser.Textures.Texture, name: string, x: number, y: number, width: number): void {
    if (!texture.has(name)) return;
    const f = texture.get(name);
    const height = width * f.cutHeight / f.cutWidth;
    ctx.drawImage(texture.getSourceImage() as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x - width / 2, y - height, width, height);
  }

  private dot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string, stroke = '#1a1008', line = 3): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
