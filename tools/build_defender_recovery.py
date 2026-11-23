"""Pack source poses with a shared scale per two-frame animation."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/defender-recovery'

with Image.open(ROOT / 'recovery-source.png') as source:
    atlas = Image.new('RGBA', (768, 1280))
    frames = []
    # Measured empty gaps separate the rows; equal quarters capture neighbouring boots.
    bands = [(0, 358), (358, 732), (732, 1092), (1092, 1448)]
    for row, name in enumerate(['ruan-rest', 'teon-sentry', 'soldier-rest', 'soldier-repair']):
        cells = []
        for col in range(2):
            top, bottom = bands[row]
            cell = source.crop((round(col * source.width / 2), top,
                                round((col + 1) * source.width / 2), bottom))
            alpha = cell.getchannel('A').point(lambda a: 255 if a >= 8 else 0)
            cells.append((cell, alpha, alpha.getbbox()))
        scale = 304 / max(b[3] - b[1] for _, _, b in cells)
        for col, (cell, alpha, bounds) in enumerate(cells):
            l, t, r, b = bounds
            soles = alpha.crop((0, b - 16, cell.width, b)).getbbox()
            foot_x = (soles[0] + soles[2]) / 2
            w, h = round((r - l) * scale), round((b - t) * scale)
            body = cell.crop(bounds).resize((w, h), Image.Resampling.LANCZOS)
            x, y = col * 384 + 4, row * 320 + 308 - h
            assert w < 376 and h <= 304
            atlas.paste(body, (x, y))
            frames.append(dict(name=f'{name}-{col}', x=x, y=y, w=w, h=h,
                               originX=(foot_x - l) / (r - l), originY=1))
    atlas.save(ROOT / 'recovery.webp', quality=94, method=6)
    (ROOT / 'recovery-frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
