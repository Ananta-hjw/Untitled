"""Package four illustrated fallen village guards as individual sprites and an atlas."""
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/soldier'
SOURCE = ROOT / 'fallen-source.png'
NAMES = ['fallen-back', 'fallen-side', 'fallen-prone', 'fallen-curled']
WIDTH, HEIGHT = 512, 384


def main():
    source = Image.open(SOURCE).convert('RGBA')
    frames = []
    with tempfile.TemporaryDirectory(prefix='fallen-guards-') as directory:
        tiles = []
        for i, name in enumerate(NAMES):
            col, row = i % 2, i // 2
            x0, y0 = round(source.width * col / 2), round(source.height * row / 2)
            x1, y1 = round(source.width * (col + 1) / 2), round(source.height * (row + 1) / 2)
            cell = source.crop((x0, y0, x1, y1))
            box = cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
            assert box, name
            l, t, r, b = box
            l, t, r, b = max(0, l - 4), max(0, t - 4), min(cell.width, r + 4), min(cell.height, b + 4)
            tile = Path(directory) / f'{name}.png'
            subprocess.run(['magick', str(SOURCE), '-crop', f'{r-l}x{b-t}+{x0+l}+{y0+t}', '+repage',
                            '-resize', '464x336', '-background', 'none', '-gravity', 'center', '-extent', f'{WIDTH}x{HEIGHT}', str(tile)], check=True)
            subprocess.run(['magick', str(tile), '-quality', '92', str(ROOT / f'{name}.webp')], check=True)
            frames.append({'name': name, 'x': col * WIDTH, 'y': row * HEIGHT,
                           'w': WIDTH, 'h': HEIGHT, 'originX': .5, 'originY': .5})
            tiles.append(tile)
        command = ['magick', '-size', f'{WIDTH*2}x{HEIGHT*2}', 'xc:none']
        for frame, tile in zip(frames, tiles):
            command += [str(tile), '-geometry', f"+{frame['x']}+{frame['y']}", '-compose', 'Over', '-composite']
        command += ['-quality', '92', str(ROOT / 'fallen.webp')]
        subprocess.run(command, check=True)
    (ROOT / 'fallen-frames.json').write_text(json.dumps({'displayWidth': 180, 'frames': frames}, indent=2) + '\n')
    print('Four fallen guard sprites and a 1024x768 atlas')


if __name__ == '__main__':
    main()
