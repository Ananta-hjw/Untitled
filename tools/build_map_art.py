"""Encode runtime map backgrounds; preserve every source PNG and its composition.

Requires Pillow (pip install Pillow). Layout coordinates stay in source pixels.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'
SOURCES = [*(ROOT / 'village/rowen/interiors').glob('*.png'), ROOT / 'maps/south-field/overview.png', ROOT / 'maps/south-field/ground.png']

for source in sorted(SOURCES):
    with Image.open(source) as image:
        image = image.convert('RGB')
        image.thumbnail((1536, 1024), Image.Resampling.LANCZOS)
        target = source.with_suffix('.webp')
        image.save(target, 'WEBP', quality=84, method=6)
        print(f'{target.relative_to(ROOT)}: {image.width}×{image.height}, {target.stat().st_size / 1024:.0f} KiB')
