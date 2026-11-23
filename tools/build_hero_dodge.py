"""Pack the generated straight-front/back dodge poses; keep the source intact."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/dodge'
# Scabbard mouths measured in the original source cells, before cropping.
MOUTHS = [(322, 316), (322, 310), (327, 323), (326, 316),
          (181, 285), (179, 277), (180, 290), (180, 283)]
with Image.open(ROOT / 'cardinal-source.png') as source:
    cells = []
    for i in range(8):
        col, row = i % 4, i // 4
        cell = source.crop((round(col * source.width / 4), round(row * source.height / 2),
                            round((col + 1) * source.width / 4), round((row + 1) * source.height / 2)))
        alpha = cell.getchannel('A').point(lambda a: 255 if a >= 8 else 0)
        cells.append((cell, alpha, alpha.getbbox()))
    scale = 304 / max(b[3] - b[1] for _, _, b in cells)
    atlas = Image.new('RGBA', (1280, 640))
    frames = []
    for i, (cell, alpha, bounds) in enumerate(cells):
        col, row = i % 4, i // 4
        l, t, r, b = bounds
        soles = alpha.crop((0, b - 14, cell.width, b)).getbbox()
        foot_x = (soles[0] + soles[2]) / 2
        w, h = round((r - l) * scale), round((b - t) * scale)
        sx, sy = w / (r - l), h / (b - t)
        body = cell.crop(bounds).resize((w, h), Image.Resampling.LANCZOS)
        x, y = col * 320 + 4, row * 320 + 308 - h
        atlas.paste(body, (x, y))
        mx, my = MOUTHS[i]
        base = dict(x=(mx - l) * sx, y=(my - t) * sy)
        tip = dict(x=base['x'] + (45 if row == 0 else -45) * sx, y=base['y'] + 75 * sy)
        frames.append(dict(name=f"dodge-{'down' if row == 0 else 'up'}-{col}",
                           texture='hero-academy-dodge-cardinal', x=x, y=y, w=w, h=h,
                           originX=(foot_x - l) / (r - l), originY=1, scale=1,
                           blade=None, sheathedBlade=dict(base=base, tip=tip)))
    atlas.save(ROOT / 'cardinal.webp', quality=94, method=6)
    (ROOT / 'frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
