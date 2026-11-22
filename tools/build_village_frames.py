"""Measure transparent village sprites without altering source pixels."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/village'
NAMES = ['oak', 'pine', 'boulders', 'shrub', 'rock', 'flowers', 'sign', 'stump']


def main():
    frames = []
    with Image.open(ROOT / 'home.png') as image:
        bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        assert bounds is not None
        frames.append(dict(name='home', texture='village-home', x=bounds[0], y=bounds[1],
                           w=bounds[2] - bounds[0], h=bounds[3] - bounds[1]))
    with Image.open(ROOT / 'props.png') as image:
        for i, name in enumerate(NAMES):
            col, row = i % 4, i // 4
            left, top = round(col * image.width / 4), round(row * image.height / 2)
            right, bottom = round((col + 1) * image.width / 4), round((row + 1) * image.height / 2)
            bounds = image.crop((left, top, right, bottom)).getchannel('A').point(
                lambda a: 255 if a >= 128 else 0).getbbox()
            assert bounds is not None
            frames.append(dict(name=name, texture='village-props', x=left + bounds[0], y=top + bounds[1],
                               w=bounds[2] - bounds[0], h=bounds[3] - bounds[1]))
    (ROOT / 'frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{len(frames)} village sprites measured')


if __name__ == '__main__':
    main()
