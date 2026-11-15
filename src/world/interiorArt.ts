import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { doorOf, furnitureAt, roomRect, WALKABLE_FURNITURE, type Furniture, type Interior } from './interiors';

/**
 * 실내를 코드로 그린다: 나무 바닥, 창문이 있는 뒤쪽 벽, 옆벽, 문이 뚫린 앞쪽 문턱, 가구.
 * 실내 그림이 생기면 이 파일만 바꾸면 된다(좌표와 충돌은 world/interiors.ts).
 * 가구는 바닥에 닿는 앞쪽 y를 깊이로 써서 캐릭터와 앞뒤가 맞게 겹친다.
 */

const WALL_HEIGHT = 230;

const shade = (color: number, amount: number): number => {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * amount)));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
};

export function drawInterior(scene: Phaser.Scene, interior: Interior): void {
  const room = roomRect(interior);
  const door = doorOf(interior);
  const w = room.right - room.left, d = room.bottom - room.top;

  // 방 바깥은 어둡게
  scene.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x0d0906).setOrigin(0).setDepth(-120);

  const g = scene.add.graphics().setDepth(-110);
  // 바닥: 널빤지
  g.fillStyle(interior.floor).fillRect(room.left, room.top, w, d);
  const plank = 46;
  for (let y = room.top, row = 0; y < room.bottom; y += plank, row++) {
    g.lineStyle(2, shade(interior.floor, 0.72), 0.8).lineBetween(room.left, y, room.right, y);
    for (let x = room.left + (row % 2) * 90; x < room.right; x += 180) {
      g.lineStyle(2, shade(interior.floor, 0.78), 0.6).lineBetween(x, y, x, Math.min(room.bottom, y + plank));
    }
  }
  // 바닥 가장자리 그림자
  g.fillStyle(0x000000, 0.18).fillRect(room.left, room.top, w, 26);

  // 뒤쪽 벽: 벽면, 위쪽 들보, 아래 걸레받이, 창문
  const wallTop = room.top - WALL_HEIGHT;
  g.fillStyle(interior.wall).fillRect(room.left - 40, wallTop, w + 80, WALL_HEIGHT);
  g.fillStyle(shade(interior.wall, 0.55)).fillRect(room.left - 40, wallTop, w + 80, 26);
  for (let x = room.left; x <= room.right; x += 220) g.fillStyle(shade(interior.wall, 0.62)).fillRect(x - 9, wallTop, 18, WALL_HEIGHT);
  g.fillStyle(shade(interior.wall, 0.5)).fillRect(room.left - 40, room.top - 22, w + 80, 22);
  const windows = Math.max(2, Math.round(w / 420));
  for (let i = 0; i < windows; i++) {
    const cx = room.left + (w / windows) * (i + 0.5);
    const wx = cx - 55, wy = wallTop + 58;
    g.fillStyle(0x4a3220).fillRoundedRect(wx - 8, wy - 8, 126, 106, 8);
    g.fillStyle(0xbfe3f2).fillRect(wx, wy, 110, 90);
    g.fillStyle(0xffffff, 0.35).fillTriangle(wx, wy, wx + 60, wy, wx, wy + 60);
    g.lineStyle(6, 0x4a3220).lineBetween(wx + 55, wy, wx + 55, wy + 90).lineBetween(wx, wy + 45, wx + 110, wy + 45);
  }
  // 옆벽 (원근감을 주는 어두운 띠)
  g.fillStyle(shade(interior.wall, 0.45)).fillRect(room.left - 40, wallTop, 40, WALL_HEIGHT + d + 30);
  g.fillStyle(shade(interior.wall, 0.45)).fillRect(room.right, wallTop, 40, WALL_HEIGHT + d + 30);

  // 앞쪽 문턱: 캐릭터보다 앞에 그려서 방의 아래 끝을 닫는다. 가운데에 문이 뚫려 있다.
  const front = scene.add.graphics().setDepth(room.bottom + 40);
  const sill = shade(interior.wall, 0.4);
  front.fillStyle(sill).fillRect(room.left - 40, room.bottom + 6, door.x - 80 - (room.left - 40), 40);
  front.fillStyle(sill).fillRect(door.x + 80, room.bottom + 6, room.right + 40 - (door.x + 80), 40);
  front.fillStyle(0x3a2616).fillRect(door.x - 80, room.bottom + 6, 14, 40).fillRect(door.x + 66, room.bottom + 6, 14, 40);
  // 문 앞 깔개
  g.fillStyle(0x6b4a2a).fillRoundedRect(door.x - 60, room.bottom - 40, 120, 46, 10);
  g.lineStyle(3, 0x3a2616, 0.8).strokeRoundedRect(door.x - 60, room.bottom - 40, 120, 46, 10);

  for (const f of interior.furniture) drawFurniture(scene, interior, f);
}

/** 가구 하나. 위쪽 면(밝게)과 앞쪽 면(어둡게)으로 상자를 그리고 종류마다 꾸밈을 더한다. */
function drawFurniture(scene: Phaser.Scene, interior: Interior, f: Furniture): void {
  const p = furnitureAt(interior, f);
  const flat = WALKABLE_FURNITURE.includes(f.kind);
  const g = scene.add.graphics().setDepth(flat ? -100 : p.y);
  const left = p.x - f.w / 2, back = p.y - f.d;
  const box = (h: number, top: number, front: number, inset = 0) => {
    g.fillStyle(0x000000, 0.22).fillEllipse(p.x, p.y + 4, f.w + 16, 22);
    g.fillStyle(top).fillRect(left + inset, back - h, f.w - inset * 2, f.d);
    g.fillStyle(front).fillRect(left + inset, p.y - h, f.w - inset * 2, h);
    g.lineStyle(2, 0x2a1a0e, 0.55).strokeRect(left + inset, back - h, f.w - inset * 2, f.d + h);
  };
  const wood = 0x8a5a34, woodDark = 0x5e3b20, woodLight = 0xa8743f;
  switch (f.kind) {
    case 'rug': {
      g.fillStyle(f.color ?? 0x8a3b3b, 0.92).fillRoundedRect(left, back, f.w, f.d, 18);
      g.lineStyle(5, 0xe8c37a, 0.7).strokeRoundedRect(left + 10, back + 10, f.w - 20, f.d - 20, 12);
      break;
    }
    case 'bed': {
      box(34, woodLight, woodDark);
      g.fillStyle(0xf4efe4).fillRoundedRect(left + 14, back - 30, f.w - 28, 46, 10);
      g.fillStyle(f.color ?? 0x4f6fa8).fillRect(left + 8, back + 26 - 34, f.w - 16, f.d - 30);
      g.fillStyle(shade(f.color ?? 0x4f6fa8, 0.7)).fillRect(left + 8, p.y - 34, f.w - 16, 22);
      break;
    }
    case 'table': {
      g.fillStyle(0x000000, 0.2).fillEllipse(p.x, p.y + 4, f.w + 10, 20);
      g.fillStyle(woodDark).fillRect(left + 10, p.y - 56, 12, 56).fillRect(left + f.w - 22, p.y - 56, 12, 56);
      g.fillStyle(woodLight).fillRect(left, back - 56, f.w, f.d);
      g.fillStyle(wood).fillRect(left, p.y - 56, f.w, 12);
      g.fillStyle(0xf2e6c8, 0.9).fillCircle(p.x - f.w * 0.2, back - 56 + f.d * 0.45, 12);
      break;
    }
    case 'chair':
      box(30, woodLight, woodDark, 4);
      g.fillStyle(wood).fillRect(left + 4, back - 70, f.w - 8, 40);
      break;
    case 'bench':
      box(30, woodLight, woodDark);
      break;
    case 'shelf': case 'books': case 'herbs': case 'weapons': {
      const h = 190;
      box(h, woodDark, wood);
      for (let row = 0; row < 3; row++) {
        const y = p.y - h + 18 + row * 58;
        g.fillStyle(woodDark).fillRect(left + 6, y + 44, f.w - 12, 8);
        for (let x = left + 14; x < left + f.w - 20; x += 22) {
          if (f.kind === 'weapons') {
            g.lineStyle(4, 0xc9ccd2).lineBetween(x + 8, y + 2, x + 8, y + 42);
            g.fillStyle(0x6b4a2a).fillRect(x + 2, y + 30, 12, 6);
          } else if (f.kind === 'herbs') {
            g.fillStyle([0x6fa85a, 0x9cc76a, 0x4f8a4a][(x + row) % 3]).fillCircle(x + 9, y + 32, 10);
          } else {
            const colors = f.kind === 'books' ? [0x7a2e2e, 0x2e4a7a, 0x3b6b3b, 0x8a6a2e] : [0xc9a36a, 0x6f8fb0, 0xb05a4a, 0xe0d3b0];
            g.fillStyle(colors[Math.abs(x * 7 + row * 3) % colors.length]).fillRect(x, y + 10 + (x % 3) * 3, 16, 34 - (x % 3) * 3);
          }
        }
      }
      break;
    }
    case 'counter': {
      box(84, woodLight, woodDark);
      for (let x = left + 20; x < left + f.w - 30; x += 80) g.lineStyle(3, 0x3a2616, 0.5).strokeRect(x, p.y - 70, 60, 56);
      g.fillStyle(0xd8c9a0).fillRect(p.x - 40, back - 84 + 10, 40, 22);
      break;
    }
    case 'barrel': {
      g.fillStyle(0x000000, 0.22).fillEllipse(p.x, p.y + 4, f.w + 14, 20);
      g.fillStyle(wood).fillRoundedRect(left, p.y - 90, f.w, 90, 18);
      g.lineStyle(5, 0x3a3a3a).lineBetween(left + 2, p.y - 70, left + f.w - 2, p.y - 70).lineBetween(left + 2, p.y - 22, left + f.w - 2, p.y - 22);
      g.fillStyle(woodLight).fillEllipse(p.x, p.y - 90, f.w, f.d * 0.7);
      break;
    }
    case 'crate':
      box(60, woodLight, wood);
      g.lineStyle(4, woodDark).lineBetween(left, p.y - 60, left + f.w, p.y).lineBetween(left + f.w, p.y - 60, left, p.y);
      break;
    case 'hearth': case 'forge': {
      const h = f.kind === 'forge' ? 120 : 170;
      box(h, 0x8a8178, 0x6c645c);
      const mouthW = f.w * 0.5, mouthH = h * 0.5;
      g.fillStyle(0x1a1008).fillRoundedRect(p.x - mouthW / 2, p.y - mouthH - 8, mouthW, mouthH, { tl: 30, tr: 30, bl: 0, br: 0 });
      g.fillStyle(0xff8a2a, 0.95).fillTriangle(p.x - 30, p.y - 10, p.x, p.y - mouthH * 0.75, p.x + 30, p.y - 10);
      g.fillStyle(0xffd25a, 0.95).fillTriangle(p.x - 15, p.y - 10, p.x, p.y - mouthH * 0.45, p.x + 15, p.y - 10);
      // 불빛이 바닥에 번진다.
      scene.add.ellipse(p.x, p.y + 30, f.w * 1.6, 90, 0xffa040, 0.16).setDepth(-99).setBlendMode(Phaser.BlendModes.ADD);
      break;
    }
    case 'anvil': {
      g.fillStyle(0x000000, 0.25).fillEllipse(p.x, p.y + 4, f.w + 10, 20);
      g.fillStyle(0x5e3b20).fillRect(p.x - 22, p.y - 40, 44, 40);
      g.fillStyle(0x4a4e55).fillRect(left, p.y - 62, f.w, 24);
      g.fillStyle(0x6b7078).fillRect(left, back - 62, f.w, f.d * 0.5);
      g.fillTriangle(left, p.y - 62, left - 26, p.y - 54, left, p.y - 44);
      break;
    }
    case 'dummy': {
      g.fillStyle(0x000000, 0.22).fillEllipse(p.x, p.y + 4, 60, 16);
      g.fillStyle(woodDark).fillRect(p.x - 6, p.y - 130, 12, 130);
      g.fillStyle(0xd9b66a).fillRoundedRect(p.x - 26, p.y - 112, 52, 60, 14);
      g.fillStyle(0xe6c77e).fillCircle(p.x, p.y - 128, 18);
      g.lineStyle(6, woodDark).lineBetween(p.x - 40, p.y - 96, p.x + 40, p.y - 96);
      break;
    }
    case 'plant': {
      g.fillStyle(0x000000, 0.22).fillEllipse(p.x, p.y + 4, f.w + 10, 16);
      g.fillStyle(0xa0522d).fillRect(left + 6, p.y - 40, f.w - 12, 40);
      g.fillStyle(0x4f8a4a).fillCircle(p.x - 10, p.y - 60, 22).fillCircle(p.x + 12, p.y - 66, 20).fillCircle(p.x, p.y - 82, 18);
      break;
    }
  }
}
