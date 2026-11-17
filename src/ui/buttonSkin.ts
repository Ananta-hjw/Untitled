import type Phaser from 'phaser';

/** Cache a 2× bronze bezel and tinted obsidian face; no per-frame canvas work. */
export function buttonSkin(scene: Phaser.Scene, radius: number, color: number): string {
  const key = `button-metal-${radius}-${color}`;
  if (scene.textures.exists(key)) return key;
  const size = (radius + 8) * 2;
  const texture = scene.textures.createCanvas(key, size * 2, size * 2);
  if (!texture) return '__DEFAULT';
  const ctx = texture.context;
  ctx.scale(2, 2);
  const c = size / 2, r = radius;
  const circle = (rad: number) => { ctx.beginPath(); ctx.arc(c, c, rad, 0, Math.PI * 2); };
  ctx.shadowColor = '#080604'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  const rim = ctx.createLinearGradient(0, c - r, c, c + r);
  rim.addColorStop(0, '#e2c992'); rim.addColorStop(.24, '#aa8551');
  rim.addColorStop(.55, '#5a422b'); rim.addColorStop(1, '#b58b50');
  circle(r); ctx.fillStyle = rim; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  circle(r - 2); ctx.fillStyle = '#211b16'; ctx.fill();
  const face = ctx.createRadialGradient(c - r * .3, c - r * .5, 0, c, c, r);
  face.addColorStop(0, '#37352e'); face.addColorStop(.6, '#1d211f'); face.addColorStop(1, '#101515');
  circle(r - 4); ctx.fillStyle = face; ctx.fill();
  const tint = ctx.createLinearGradient(0, c - r, 0, c + r);
  const red = color >> 16 & 255, green = color >> 8 & 255, blue = color & 255;
  tint.addColorStop(0, `rgba(${red},${green},${blue},0.38)`);
  tint.addColorStop(1, `rgba(${red},${green},${blue},0.08)`);
  circle(r - 4); ctx.fillStyle = tint; ctx.fill();
  circle(r - 6); ctx.strokeStyle = '#b39563'; ctx.lineWidth = .7; ctx.globalAlpha = .65; ctx.stroke();
  circle(r - 11); ctx.strokeStyle = '#e9d4a0'; ctx.lineWidth = .6; ctx.globalAlpha = .12; ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, r - 1, Math.PI * 1.12, Math.PI * 1.85);
  ctx.strokeStyle = '#fff0c5'; ctx.lineWidth = .8; ctx.globalAlpha = .8; ctx.stroke();
  // Four discreet engraved accents, leaving the icon and label clear.
  ctx.globalAlpha = .65; ctx.fillStyle = '#d1b47a';
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = c + Math.cos(angle) * (r - 6), y = c + Math.sin(angle) * (r - 6);
    ctx.beginPath();ctx.moveTo(x, y - 1.5);ctx.lineTo(x + 1.5, y);ctx.lineTo(x, y + 1.5);ctx.lineTo(x - 1.5, y);ctx.closePath();ctx.fill();
  }
  ctx.globalAlpha = 1;
  texture.refresh();
  return key;
}
