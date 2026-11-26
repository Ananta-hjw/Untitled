import type Phaser from 'phaser';

export const MENU_COLOR = {
  ink: '#f6eddd',
  muted: '#c3b9a6',
  gold: '#f0cb85',
  faint: '#a39886',
  danger: '#f5afa0',
};
const FONT = 'system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
type ButtonTone = 'quiet' | 'primary' | 'selected' | 'disabled' | 'danger';
const BUTTON_SKINS: Record<ButtonTone, [number, number, string]> = {
  primary: [0xe4be79, 0xf3d69e, '#241a13'],
  selected: [0x4c3a26, 0xd7ae66, MENU_COLOR.gold],
  quiet: [0x312a24, 0x605044, MENU_COLOR.ink],
  disabled: [0x24211e, 0x443b33, MENU_COLOR.faint],
  danger: [0x492b27, 0xb2725b, MENU_COLOR.danger],
};

export function menuText(scene: Phaser.Scene, depth: number, content: string, size: number, color = MENU_COLOR.ink, bold = false) {
  return scene.add.text(0, 0, content, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color,
  }).setDepth(depth).setScrollFactor(0).setResolution(2);
}

export function menuButton(scene: Phaser.Scene, depth: number, label: string, onTap: () => void, size = 21) {
  return menuText(scene, depth, label, size, MENU_COLOR.ink, true).setOrigin(.5).setAlign('center')
    .setInteractive({ useHandCursor: true })
    .on('pointerover', function (this: Phaser.GameObjects.Text) { this.setAlpha(.82); })
    .on('pointerout', function (this: Phaser.GameObjects.Text) { this.setAlpha(1); })
    .on('pointerup', onTap);
}

export function placeMenuButton(g: Phaser.GameObjects.Graphics, button: Phaser.GameObjects.Text,
  x: number, y: number, w: number, h: number, tone: ButtonTone = 'quiet') {
  const [fill, border, color] = BUTTON_SKINS[tone];
  const left = x - w / 2, top = y - h / 2;
  g.fillStyle(fill).fillRoundedRect(left, top, w, h, 8).lineStyle(1, border).strokeRoundedRect(left, top, w, h, 8);
  button.setPadding(0, Math.max(0, Math.floor((h - parseFloat(String(button.style.fontSize)) * 1.25) / 2)), 0, 0);
  button.setFixedSize(w, h).setPosition(x, y).setColor(color).setVisible(true);
  if (tone === 'disabled') button.disableInteractive().setAlpha(1);
  else button.setInteractive({ useHandCursor: true });
  button.input?.hitArea.setSize(w, h);
}

export function drawMenuFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.clear();
  g.fillStyle(0x080606, .43).fillRoundedRect(x - 5, y + 7, w + 10, h + 5, 21);
  g.fillStyle(0x1c1815).fillRoundedRect(x, y, w, h, 16);
  g.lineStyle(1, 0x9d774b).strokeRoundedRect(x, y, w, h, 16);
  g.lineStyle(1, 0x413426).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 12);
}

export function drawMenuCard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, selected = false) {
  g.fillStyle(selected ? 0x342a20 : 0x25211d).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(1, selected ? 0xc59c5c : 0x493d31).strokeRoundedRect(x, y, w, h, 10);
}
