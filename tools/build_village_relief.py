"""Pack the original ten relief-work sprites without repainting the source."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/village-relief'
NAMES = ['herman-record', 'doran-file', 'merina-supplies', 'rosetta-blankets', 'vernel-inspect']
BANDS = [(0, 320), (320, 630), (630, 954), (954, 1288), (1288, 1536)]

with Image.open(ROOT / 'work-source.png') as source:
    atlas = Image.new('RGBA', (768, 1600))
    frames = []
    for row, (name, (top, bottom)) in enumerate(zip(NAMES, BANDS)):
        cells = []
        for col in range(2):
            cell = source.crop((col * 512, top, (col + 1) * 512, bottom))
            alpha = cell.getchannel('A').point(lambda a: 255 if a >= 8 else 0)
            cells.append((cell, alpha, alpha.getbbox()))
        scale = 304 / max(b[3] - b[1] for _, _, b in cells)
        for col, (cell, alpha, bounds) in enumerate(cells):
            l, t, r, b = bounds
            soles = alpha.crop((0, b - 12, cell.width, b)).getbbox()
            foot_x = (soles[0] + soles[2]) / 2
            w, h = round((r - l) * scale), round((b - t) * scale)
            assert w < 376
            body = cell.crop(bounds).resize((w, h), Image.Resampling.LANCZOS)
            x, y = col * 384 + 4, row * 320 + 308 - h
            atlas.paste(body, (x, y))
            frames.append(dict(name=f'{name}-{col}', x=x, y=y, w=w, h=h,
                               originX=(foot_x - l) / (r - l), originY=1))
    atlas.save(ROOT / 'work.webp', quality=94, method=6)
    (ROOT / 'work-frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
