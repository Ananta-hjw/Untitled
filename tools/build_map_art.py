"""Encode runtime map backgrounds; preserve every source PNG and its composition.

Requires Pillow (pip install Pillow). Layout coordinates stay in source pixels.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'
SOURCES = [*(ROOT / 'village/rowen/interiors').glob('*.png'), ROOT / 'village/ground.png',
           ROOT / 'maps/south-field/overview.png', ROOT / 'maps/south-field/ground.png',
           ROOT / 'maps/reed-swamp/ground.png']


def encode_ground_tiles(source):
    tile_size = 1600
    with Image.open(source) as image:
        image = image.convert('RGB')
        tiles = []
        for y in range(0, image.height, tile_size):
            for x in range(0, image.width, tile_size):
                right = min(x + tile_size, image.width)
                bottom = min(y + tile_size, image.height)
                file = f'{source.stem}-{len(tiles)}.webp'
                image.crop((x, y, right, bottom)).save(source.with_name(file), quality=90, method=6)
                tiles.append({'file': file, 'x': x, 'y': y, 'width': right - x, 'height': bottom - y})
        return {'sourceWidth': image.width, 'sourceHeight': image.height, 'tiles': tiles}


def main():
    for source in sorted(SOURCES):
        with Image.open(source) as image:
            image = image.convert('RGB')
            if source.stem == 'overview':
                image.thumbnail((1536, 1024), Image.Resampling.LANCZOS)
            target = source.with_suffix('.webp')
            image.save(target, 'WEBP', quality=84, method=6)
            print(f'{target.relative_to(ROOT)}: {image.width}×{image.height}, {target.stat().st_size / 1024:.0f} KiB')

    ferry = ROOT / 'maps/ferry-village/ground.png'
    ferry.with_suffix('.json').write_text(json.dumps(encode_ground_tiles(ferry), indent=2) + '\n')


if __name__ == '__main__':
    main()
