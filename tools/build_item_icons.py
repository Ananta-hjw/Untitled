"""Crop the three illustrated items, export individual icons and a compact runtime atlas."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/items'
# The lunch linen extends slightly over an equal third of the source; use the empty gutters.
REGIONS = [('potion', 0, .30), ('lunch', .30, .67), ('slime-gel', .67, 1)]


def main():
    source = Image.open(ROOT / 'icons-source.png').convert('RGBA')
    atlas = Image.new('RGBA', (400, 136))
    frames = []
    for i, (name, left, right) in enumerate(REGIONS):
        cell = source.crop((round(source.width * left), 0, round(source.width * right), source.height))
        box = cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        assert box, name
        l, t, r, b = box
        art = cell.crop((max(0, l - 2), max(0, t - 2), min(cell.width, r + 2), min(cell.height, b + 2)))
        art.thumbnail((232, 232), Image.Resampling.LANCZOS)
        icon = Image.new('RGBA', (256, 256))
        icon.paste(art, ((256 - art.width) // 2, (256 - art.height) // 2))
        icon.save(ROOT / f'{name}.png')
        tile = icon.resize((128, 128), Image.Resampling.LANCZOS)
        x = 4 + i * 132
        atlas.paste(tile, (x, 4))
        frames.append(dict(name=name, x=x, y=4, w=128, h=128))
    atlas.save(ROOT / 'icons.webp', quality=88, method=6)
    (ROOT / 'icons.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print(source.size, atlas.size, (ROOT / 'icons.webp').stat().st_size)


if __name__ == '__main__':
    main()
