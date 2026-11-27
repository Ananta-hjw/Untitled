import type Phaser from 'phaser';
import atlasUrl from '../assets/items/icons.webp?url';
import atlas from '../assets/items/icons.json';
import { ITEMS, ITEM_IDS, type ItemId } from '../items/inventory';
import { iconKey } from './icons';

export const ITEM_ICON_TEXTURE = 'item-icons';
/** 읽어 온 아틀라스 원본. 실제로 그리는 ITEM_ICON_TEXTURE는 이것에 개별 일러스트·임시 아이콘을 덧붙인 캔버스다. */
const SOURCE_TEXTURE = 'item-icons-source';
const TILE = 128;
const GAP = 4;

/** 아이템·장비 아이콘은 작은 아틀라스 한 장으로 읽고, 창을 다시 열어도 같은 텍스처를 쓴다. */
export function preloadItemIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ITEM_ICON_TEXTURE) && !scene.textures.exists(SOURCE_TEXTURE)) scene.load.image(SOURCE_TEXTURE, atlasUrl);
}

/**
 * 아틀라스의 칸을 등록한다.
 * - src/assets/icons/items/<id>.{png,webp}에 개별 일러스트가 있으면(preloadIcons로 선로딩됨) 그 그림을 우선 합쳐
 *   ItemPanel·QuickSlotPanel·HUD 빠른 버튼과 CharacterPanel이 모두 동일한 아이콘을 표시하게 한다.
 * - 개별 일러스트도 공용 아틀라스에도 없으면 전용 벡터 그림 또는 임시 아이콘을 그려 넣는다.
 */
export function registerItemIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists(ITEM_ICON_TEXTURE) || !scene.textures.exists(SOURCE_TEXTURE)) return;
  const source = scene.textures.get(SOURCE_TEXTURE).getSourceImage() as HTMLImageElement;
  const standalone = ITEM_IDS.filter((id) => scene.textures.exists(iconKey('items', id)));
  const standaloneSet = new Set<string>(standalone);
  const missing: string[] = ITEM_IDS.filter((id) => !standaloneSet.has(id) && !atlas.frames.some((f) => f.name === id));
  const extra: string[] = [...standalone, ...missing];
  const extraTop = source.height + GAP;
  const width = Math.max(source.width, GAP + extra.length * (TILE + GAP));
  const canvas = scene.textures.createCanvas(ITEM_ICON_TEXTURE, width, extraTop + (extra.length ? TILE + GAP : 0));
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.drawImage(source, 0, 0);
  extra.forEach((id, i) => {
    const x = GAP + i * (TILE + GAP), y = extraTop;
    if (standaloneSet.has(id)) {
      const img = scene.textures.get(iconKey('items', id)).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const w = img.width || TILE, h = img.height || TILE;
      const scale = Math.min((TILE - 8) / w, (TILE - 8) / h);
      const dw = w * scale, dh = h * scale;
      ctx.drawImage(img, x + (TILE - dw) / 2, y + (TILE - dh) / 2, dw, dh);
    } else if (!drawCustomIcon(ctx, x, y, id)) {
      drawPlaceholder(ctx, x, y, id as ItemId);
    }
  });
  canvas.refresh();
  for (const f of atlas.frames) {
    if (!standaloneSet.has(f.name)) canvas.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  extra.forEach((id, i) => canvas.add(id, 0, GAP + i * (TILE + GAP), extraTop, TILE, TILE));
}

/** 1장 서브 퀘스트 보상(들꽃 팔찌·세레나의 도시락·시아의 조약돌·베르넬의 연구 메모)의 전용 아이콘 */
function drawCustomIcon(ctx: CanvasRenderingContext2D, x: number, y: number, id: string): boolean {
  const cx = x + TILE / 2, cy = y + TILE / 2;
  ctx.save();
  if (id === 'wildflower-bracelet') {
    // 엮은 초록 줄기 고리 + 하늘색 들꽃 세 송이
    ctx.strokeStyle = '#538a4a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#7ec46b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 34, 0, Math.PI * 2);
    ctx.stroke();
    const blooms = [[cx, cy - 28], [cx - 28, cy + 16], [cx + 28, cy + 16]] as const;
    for (const [bx, by] of blooms) {
      ctx.fillStyle = '#8ad4ff';
      for (let a = 0; a < 5; a++) {
        const ang = (a * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(ang) * 9, by + Math.sin(ang) * 9, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe985';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }
  if (id === 'serena-lunch') {
    // 따뜻한 붉은 체크 보자기에 싼 2단 도시락
    ctx.fillStyle = '#c85b48';
    ctx.strokeStyle = '#4a1f16';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 38, cy - 16, 76, 54, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e79563';
    ctx.fillRect(cx - 34, cy + 4, 68, 12);
    // 보자기 매듭 귀
    ctx.fillStyle = '#d96c57';
    ctx.beginPath();
    ctx.ellipse(cx - 14, cy - 24, 16, 10, -0.45, 0, Math.PI * 2);
    ctx.ellipse(cx + 14, cy - 24, 16, 10, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8e6bd';
    ctx.beginPath();
    ctx.arc(cx, cy - 16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return true;
  }
  if (id === 'sia-pebble') {
    // 물결에 깎여 매끈하게 빛나는 푸른빛 조약돌
    const grad = ctx.createRadialGradient(cx - 12, cy - 12, 6, cx, cy, 42);
    grad.addColorStop(0, '#eef7ff');
    grad.addColorStop(0.45, '#9ec3d8');
    grad.addColorStop(1, '#4c6d82');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#243a49';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 38, 28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - 8, 11, 5, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true;
  }
  if (id === 'vernel-memo') {
    // 양피지 쪽지 위에 유적 표식과 기록
    ctx.fillStyle = '#ecdab2';
    ctx.strokeStyle = '#5c4628';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 32, cy - 40, 64, 80, 6);
    ctx.fill();
    ctx.stroke();
    // 유적 다이아몬드 표식
    ctx.strokeStyle = '#4e5d8f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx + 15, cy - 8);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx - 15, cy - 8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4e5d8f';
    ctx.fill();
    // 메모 줄
    ctx.strokeStyle = '#6f5839';
    ctx.lineWidth = 3;
    for (const ly of [cy + 20, cy + 29]) {
      ctx.beginPath();
      ctx.moveTo(cx - 20, ly);
      ctx.lineTo(cx + 20, ly);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }
  if (id === 'iron-shard') {
    // 깎인 철광석 결정 조각
    ctx.fillStyle = '#7c8796';
    ctx.strokeStyle = '#252c36';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 38);
    ctx.lineTo(cx + 28, cy - 16);
    ctx.lineTo(cx + 34, cy + 20);
    ctx.lineTo(cx - 4, cy + 36);
    ctx.lineTo(cx - 34, cy + 12);
    ctx.lineTo(cx - 28, cy - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bcc7d6';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 30);
    ctx.lineTo(cx + 18, cy - 14);
    ctx.lineTo(cx - 2, cy + 4);
    ctx.lineTo(cx - 22, cy - 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return true;
  }
  if (id === 'bronze-ingot') {
    // 사다리꼴 청동 주괴
    ctx.fillStyle = '#b98348';
    ctx.strokeStyle = '#3f2612';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy + 22);
    ctx.lineTo(cx - 18, cy - 22);
    ctx.lineTo(cx + 26, cy - 22);
    ctx.lineTo(cx + 38, cy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e5b878';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 16);
    ctx.lineTo(cx + 20, cy - 16);
    ctx.lineTo(cx + 26, cy + 2);
    ctx.lineTo(cx - 22, cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return true;
  }
  if (id === 'resonance-ore') {
    // 금청빛으로 울리는 공명 결정 광석
    const grad = ctx.createRadialGradient(cx, cy - 6, 4, cx, cy, 38);
    grad.addColorStop(0, '#fff7cf');
    grad.addColorStop(0.5, '#6ec5e8');
    grad.addColorStop(1, '#315282');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#1b2b4a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 40);
    ctx.lineTo(cx + 28, cy - 6);
    ctx.lineTo(cx + 16, cy + 34);
    ctx.lineTo(cx - 18, cy + 34);
    ctx.lineTo(cx - 28, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffe596';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  }
  ctx.restore();
  return false;
}

/** 그림이 없는 물건의 임시 아이콘: 효과에 맞는 색 원과 이름 두 글자 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, id: ItemId): void {
  const def = ITEMS[id];
  const color = def.mana ? '#3c6fa8' : def.cures ? '#4f8a47' : def.heal ? '#a8643a' : def.kind === 'keepsake' ? '#7a6334' : '#6a6a5a';
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#f1dfae';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6dc';
  ctx.font = 'bold 40px system-ui, "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.name.replace(/\s/g, '').slice(0, 2), x + TILE / 2, y + TILE / 2 + 2);
  ctx.restore();
}

export function itemIcon(scene: Phaser.Scene, id: ItemId): Phaser.GameObjects.Image {
  registerItemIcons(scene);
  return scene.add.image(0, 0, ITEM_ICON_TEXTURE, id).setDisplaySize(88, 88).setScrollFactor(0);
}
