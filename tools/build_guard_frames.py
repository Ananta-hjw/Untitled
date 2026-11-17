"""Pack consistent, compact guard poses. Pillow measures; ImageMagick writes images."""
import json
import math
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/guard'
HEIGHT = 304
# One generated source row: side, front diagonal, rear diagonal, front, back.
# Rear diagonal source looks left, so mirror the entire pose before registration.
VIEWS = ['side', 'down', 'up-back', 'front', 'back']
# Measured fist positions and support height in trimmed, 304px-high local space.
# Keep the planted stance origin fixed when the rear foot changes position.
FOOT_X = [95, 96.5, 84, 88, 74.5]
ANCHORS = [(141, 200, 160), (116, 201, 164), (108, 201, 164), (88, 201, 165), (90, 201, 165)]


def main():
    source = ROOT / 'poses-source.png'
    art = Image.open(source).convert('RGBA')
    frames, covers, tiles = [], [], []
    x = 4
    ux, uy = math.sin(math.radians(12)), -math.cos(math.radians(12))
    for i, view in enumerate(VIEWS):
        left, right = round(i * art.width / 5), round((i + 1) * art.width / 5)
        cell = art.crop((left, 0, right, art.height))
        l, t, r, b = cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        w = round((r - l) * HEIGHT / (b - t))
        tile = ROOT / f'{view}.png'
        command = ['magick', str(source), '-crop', f'{r-l}x{b-t}+{left+l}+{t}', '+repage']
        if view == 'up-back':
            command += ['-flop']
        command += ['-resize', f'{w}x{HEIGHT}!', str(tile)]
        subprocess.run(command, check=True)
        foot = FOOT_X[i]
        gx, gy, py = ANCHORS[i]
        grip = {'x': gx, 'y': gy}
        palm = {'x': gx + (py - gy) * ux / uy, 'y': py}
        base = {'x': gx + ux * 12, 'y': gy + uy * 12}
        frame = {'name': f'guard-{view}', 'texture': 'hero-academy-guard', 'x': x, 'y': 4,
                 'w': w, 'h': HEIGHT, 'originX': foot / w, 'originY': 1, 'scale': 1,
                 'grip': grip, 'supportGrip': palm, 'supportPalm': palm,
                 'blade': {'base': base, 'tip': {'x': base['x'] + ux * 150, 'y': base['y'] + uy * 150}}}
        # Rear poses already hide their hands; put the complete weapon behind the body.
        if view in ['up-back', 'back']:
            frame['weaponBehind'] = True
        else:
            cw, ch = 30, 40
            cx = max(0, min(w - cw, round(palm['x'] - cw / 2)))
            cy = round(py - ch / 2)
            name = f'guard-{view}-support'
            frame['supportCover'] = {'name': name, 'x': cx, 'y': cy, 'w': cw, 'h': ch}
            covers.append({'name': name, 'texture': 'hero-academy-guard', 'x': x + cx, 'y': 4 + cy, 'w': cw, 'h': ch})
        frames.append(frame)
        tiles.append(tile)
        x += w + 4
    command = ['magick', '-size', f'{x}x{HEIGHT+8}', 'xc:none']
    for frame, tile in zip(frames, tiles):
        command += [str(tile), '-geometry', f"+{frame['x']}+4", '-compose', 'Over', '-composite']
    command += ['-quality', '90', '-define', 'webp:method=6', str(ROOT / 'bodies.webp')]
    subprocess.run(command, check=True)
    (ROOT / 'frames.json').write_text(json.dumps({'frames': frames, 'covers': covers}, indent=2) + '\n')
    print(f'{len(frames)} guard poses, {x}x{HEIGHT+8}')


if __name__ == '__main__':
    main()
