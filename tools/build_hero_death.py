"""Pack Sion's six collapse poses into a compact runtime atlas."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/death'
CELL = 512
TILE_WIDTH, TILE_HEIGHT = 340, 320
SCALE = .88
# First pose is anchored between the boots. Later poses keep contact on the
# same world line as the supporting hand, shoulder and side reach the floor.
PIVOT_X = [246, 245, 246, 246, 246, 246]


def main():
    sheet = Image.open(ROOT / 'source.png')
    assert sheet.size == (1536, 1024) and sheet.mode == 'RGBA'
    atlas = Image.new('RGBA', (TILE_WIDTH * 3, TILE_HEIGHT * 2))
    frames = []
    for index, pivot in enumerate(PIVOT_X):
        col, row = index % 3, index // 3
        left, top = col * CELL, row * CELL
        cell = sheet.crop((left, top, left + CELL, top + CELL))
        alpha = cell.getchannel('A').point(lambda a: a if a >= 24 else 0)
        box = alpha.getbbox()
        assert box and min(box[:2]) > 0 and max(box[2:]) < CELL
        x0, y0, x1, y1 = box
        cell.putalpha(alpha)
        art = cell.crop(box).resize((round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)), Image.Resampling.LANCZOS)
        assert art.width + 4 <= TILE_WIDTH and art.height + 4 <= TILE_HEIGHT
        x, y = col * TILE_WIDTH + 2, row * TILE_HEIGHT + 2
        atlas.paste(art, (x, y))
        frames.append({
            'name': f'death-{index}', 'texture': 'hero-academy-death',
            'x': x, 'y': y, 'w': art.width, 'h': art.height,
            'originX': round((pivot - x0) / (x1 - x0), 6), 'originY': 1,
            'scale': 1, 'blade': None,
        })
    atlas.save(ROOT / 'collapse.webp', lossless=True, method=6)
    (ROOT / 'frames.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')


if __name__ == '__main__':
    main()
