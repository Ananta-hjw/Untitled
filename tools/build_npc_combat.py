"""Package village warriors' four combat illustrations without redrawing source art."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

CHARACTERS = Path(__file__).resolve().parents[1] / 'src/assets/characters'
SPLIT_X = {'ruan': .565, 'teon': .5, 'soldier': .5}
NAMES = ['attack', 'guard', 'hit', 'injured']
WIDTH, HEIGHT = 512, 384


def build(character):
    root = CHARACTERS / character
    source = root / 'combat-source.png'
    art = Image.open(source).convert('RGBA')
    # The attacking sword extends past the geometric midpoint; split in the actual empty gap.
    split_x, split_y = round(art.width * SPLIT_X[character]), round(art.height / 2)
    cells = [(0, 0, split_x, split_y), (split_x, 0, art.width, split_y),
             (0, split_y, split_x, art.height), (split_x, split_y, art.width, art.height)]
    bounds = []
    for cell in cells:
        l, t, r, b = art.crop(cell).getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        bounds.append((cell[0] + l, cell[1] + t, cell[0] + r, cell[1] + b))
    # One scale preserves the smaller height of the kneeling injury pose.
    scale = min(464 / max(r-l for l, t, r, b in bounds), 336 / max(b-t for l, t, r, b in bounds))
    frames = []
    with tempfile.TemporaryDirectory(prefix=f'{character}-combat-') as directory:
        tiles = []
        for i, (name, (l, t, r, b)) in enumerate(zip(NAMES, bounds)):
            tile = Path(directory) / f'{name}.png'
            w, h = round((r-l) * scale), round((b-t) * scale)
            subprocess.run(['magick', str(source), '-crop', f'{r-l}x{b-t}+{l}+{t}', '+repage',
                            '-resize', f'{w}x{h}!', '-background', 'none', '-gravity', 'south',
                            '-extent', f'{WIDTH}x{HEIGHT}', str(tile)], check=True)
            subprocess.run(['magick', str(tile), '-quality', '92', str(root / f'{name}.webp')], check=True)
            frames.append({'name': name, 'x': (i % 2) * WIDTH, 'y': (i // 2) * HEIGHT,
                           'w': WIDTH, 'h': HEIGHT, 'originX': .5, 'originY': 1})
            tiles.append(tile)
        command = ['magick', '-size', f'{WIDTH*2}x{HEIGHT*2}', 'xc:none']
        for frame, tile in zip(frames, tiles):
            command += [str(tile), '-geometry', f"+{frame['x']}+{frame['y']}", '-compose', 'Over', '-composite']
        subprocess.run(command + ['-quality', '92', str(root / 'combat.webp')], check=True)
    (root / 'combat-frames.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print(f'{character}: attack, guard, hit and injured; 1024x768 atlas')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--characters', nargs='+', choices=list(SPLIT_X), default=list(SPLIT_X))
    for character in parser.parse_args().characters:
        build(character)
