"""Export Fern's item icons and aligned cart states; preserve the generated PNG art."""
import json
from pathlib import Path

from PIL import Image

from build_item_icons import main as build_icons

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'
ITEMS = ['travel-biscuit', 'blue-dew', 'antidote-herb', 'travel-cloak']


def main():
    build_icons()
    for item in ITEMS:
        target = ROOT / 'icons/items' / f'{item}.webp'
        with Image.open(ROOT / 'items' / f'{item}.png') as icon:
            assert icon.size == (256, 256) and icon.mode == 'RGBA'
            icon.save(target, quality=92, method=6)

    frames = []
    size = None
    for state in ['damaged', 'repaired']:
        source = ROOT / 'village/rowen' / f'fern-cart-{state}.png'
        with Image.open(source) as cart:
            assert cart.mode == 'RGBA'
            if size is None:
                size = cart.size
            assert cart.size == size, 'Cart states must share the same canvas'
            # Do not crop each state separately: preserve their common placement and scale.
            target_size = (768, round(cart.height * 768 / cart.width))
            cart.resize(target_size, Image.Resampling.LANCZOS).save(
                source.with_suffix('.webp'), quality=92, method=6)
            frames.append(dict(state=state, file=source.with_suffix('.webp').name,
                               width=target_size[0], height=target_size[1], originX=.5, originY=1))
    (ROOT / 'village/rowen/fern-cart.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print('Fern: four 256px icons, item atlas, two aligned cart states ready')


if __name__ == '__main__':
    main()
