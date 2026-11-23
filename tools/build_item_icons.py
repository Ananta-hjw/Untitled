"""Crop the illustrated items and equipment, export individual icons and a compact runtime atlas."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/items'
# The lunch linen extends slightly over an equal third of the source; use the empty gutters.
SOURCES = [
    ('icons-source.png', [('potion', 0, .30), ('lunch', .30, .67), ('slime-gel', .67, 1)]),
    ('gear-source.png', [('iron-sword', 0, .5), ('leather-armor', .5, 1)]),
    ('fern/travel-biscuit-source.png', [('travel-biscuit', 0, 1)]),
    ('fern/blue-dew-source.png', [('blue-dew', 0, 1)]),
    ('fern/antidote-herb-source.png', [('antidote-herb', 0, 1)]),
    ('fern/travel-cloak-source.png', [('travel-cloak', 0, 1)]),
]


def main():
    cells = []
    for filename, regions in SOURCES:
        source = Image.open(ROOT / filename).convert('RGBA')
        for name, left, right in regions:
            cells.append((name, source.crop((round(source.width * left), 0, round(source.width * right), source.height))))
    atlas = Image.new('RGBA', (4 + len(cells) * 132, 136))
    frames = []
    for i, (name, cell) in enumerate(cells):
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
    print(atlas.size, (ROOT / 'icons.webp').stat().st_size)


if __name__ == '__main__':
    main()
