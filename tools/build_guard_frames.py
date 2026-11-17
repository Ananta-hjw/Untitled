"""Measure guard registration dots and pack four clean camera poses with ImageMagick."""
import json
import math
import subprocess
import tempfile
from pathlib import Path
from PIL import Image  # Analysis only. ImageMagick writes all runtime images.

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/guard'
HEIGHT = 304
BLADE_LENGTH = 150
TILT_FROM_VERTICAL_DEG = 12


def markers(art, kind):
    pixels = art.load()
    points = set()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = pixels[x, y]
            match = (r < 100 and g > 170 and b > 170) if kind == 'grip' else ((r > 180 and g < 100 and b > 160) if kind == 'support' else (r > 210 and g > 210 and b < 100))
            if a > 150 and match:
                points.add((x, y))
    groups = []
    while points:
        seed = points.pop()
        group, pending = [seed], [seed]
        while pending:
            x, y = pending.pop()
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                p = (x + dx, y + dy)
                if p in points:
                    points.remove(p)
                    group.append(p)
                    pending.append(p)
        if len(group) >= 4:
            groups.append((len(group), sum(x for x, _ in group) / len(group), sum(y for _, y in group) / len(group)))
    return sorted(groups, reverse=True)


def main():
    clean = Image.open(ROOT / 'source.png').convert('RGBA')
    guide = Image.open(ROOT / 'guide.png').convert('RGBA')
    assert clean.size == guide.size
    back = Image.open(ROOT / 'back-source.png').convert('RGBA')
    back_guide = Image.open(ROOT / 'back-guide.png').convert('RGBA')
    assert back.size == back_guide.size
    frames, covers = [], []
    x = 4
    with tempfile.TemporaryDirectory(prefix='hero-guard-') as directory:
        tiles = []
        for i, view in enumerate(['side', 'down', 'up']):
            left, right = round(i * clean.width / 3), round((i + 1) * clean.width / 3)
            box = (left, 0, right, clean.height)
            art, marked = clean.crop(box), guide.crop(box)
            l, t, r, b = art.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
            _, gx, gy = markers(marked, 'grip')[0]
            _, tx, ty = markers(marked, 'support')[0]
            assert ty < gy, f'{view}: support palm must be above the hilt'
            w = round((r - l) * HEIGHT / (b - t))
            sx, sy = w / (r - l), HEIGHT / (b - t)
            grip = {'x': (gx - l) * sx, 'y': (gy - t) * sy}
            palm = {'x': (tx - l) * sx, 'y': (ty - t) * sy}
            tilt = math.radians(TILT_FROM_VERTICAL_DEG)
            ux, uy = math.sin(tilt), -math.cos(tilt)
            support = {'x': grip['x'] + (palm['y'] - grip['y']) * ux / uy, 'y': palm['y']}
            assert abs(support['x'] - palm['x']) < 14, f'{view}: blade must still touch the palm'
            base = {'x': grip['x'] + ux * 12, 'y': grip['y'] + uy * 12}
            soles = art.getchannel('A').crop((l, b - 10, r, b)).point(lambda a: 255 if a >= 128 else 0).getbbox()
            foot = (soles[0] + soles[2]) / 2 * sx
            frame = {'name': f'guard-{view}', 'texture': 'hero-academy-guard', 'x': x, 'y': 4, 'w': w, 'h': HEIGHT,
                     'originX': foot / w, 'originY': 1, 'scale': 1, 'grip': grip, 'supportGrip': support, 'supportPalm': palm,
                     'blade': {'base': base, 'tip': {'x': base['x'] + ux * BLADE_LENGTH, 'y': base['y'] + uy * BLADE_LENGTH}}}
            cw, ch = 30, 48
            cx = max(0, min(w - cw, round(palm['x'] - cw / 2)))
            cy = max(0, min(HEIGHT - ch, round(palm['y'] - ch / 2)))
            cover_name = f'guard-{view}-support'
            frame['supportCover'] = {'name': cover_name, 'x': cx, 'y': cy, 'w': cw, 'h': ch}
            covers.append({'name': cover_name, 'texture': 'hero-academy-guard', 'x': x + cx, 'y': 4 + cy, 'w': cw, 'h': ch})
            frames.append(frame)
            tile = Path(directory) / f'{view}.png'
            subprocess.run(['magick', str(ROOT / 'source.png'), '-crop', f'{r-l}x{b-t}+{left+l}+{t}',
                            '+repage', '-resize', f'{w}x{HEIGHT}!', str(tile)], check=True)
            tiles.append(tile)
            x += w + 4
        # Rear diagonals use a complete, independently measured low-elbow pose.
        l, t, r, b = back.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        _, gx, gy = markers(back_guide, 'grip')[0]
        _, px, py = markers(back_guide, 'support')[0]
        _, ex, ey = next(p for p in markers(back_guide, 'elbow') if p[2] > gy)
        back_w = round((r - l) * HEIGHT / (b - t))
        sx, sy = back_w / (r - l), HEIGHT / (b - t)
        # The rear marker sits on the outer knuckles. Seat the hilt inside the
        # fist, seven local pixels toward the thumb-side gripping crease.
        grip = {'x': (gx - l) * sx - 7, 'y': (gy - t) * sy}
        palm = {'x': (px - l) * sx, 'y': (py - t) * sy}
        elbow = {'x': (ex - l) * sx, 'y': (ey - t) * sy}
        support = {'x': grip['x'] + (palm['y'] - grip['y']) * ux / uy, 'y': palm['y']}
        assert abs(support['x'] - palm['x']) < 14, 'rear blade must touch the hand'
        base = {'x': grip['x'] + ux * 12, 'y': grip['y'] + uy * 12}
        soles = back.getchannel('A').crop((l, b - 10, r, b)).point(lambda a: 255 if a >= 128 else 0).getbbox()
        foot = (soles[0] + soles[2]) / 2 * sx
        bcw, bch = 60, 64
        bcx = max(0, min(back_w - bcw, round(palm['x'] - 22)))
        bcy = max(0, min(HEIGHT - bch, round(palm['y'] - 30)))
        cover_name = 'guard-up-support-back'
        back_cover = {'name': cover_name, 'x': bcx, 'y': bcy, 'w': bcw, 'h': bch}
        back_frame = {'name': 'guard-up-back', 'texture': 'hero-academy-guard', 'x': x, 'y': 4,
                      'w': back_w, 'h': HEIGHT, 'originX': foot / back_w, 'originY': 1, 'scale': 1,
                      'grip': grip, 'supportGrip': support, 'supportPalm': palm, 'gripElbow': elbow,
                      'blade': {'base': base, 'tip': {'x': base['x'] + ux * BLADE_LENGTH, 'y': base['y'] + uy * BLADE_LENGTH}},
                      'supportCover': back_cover, 'supportBackCover': back_cover}
        covers.append({'name': cover_name, 'texture': 'hero-academy-guard', 'x': x + bcx, 'y': 4 + bcy, 'w': bcw, 'h': bch})
        back_tile = Path(directory) / 'up-back.png'
        subprocess.run(['magick', str(ROOT / 'back-source.png'), '-crop', f'{r-l}x{b-t}+{l}+{t}',
                        '+repage', '-resize', f'{back_w}x{HEIGHT}!', str(back_tile)], check=True)
        frames.append(back_frame)
        tiles.append(back_tile)
        x += back_w + 4
        command = ['magick', '-size', f'{x}x{HEIGHT+8}', 'xc:none']
        for frame, tile in zip(frames, tiles):
            command += [str(tile), '-geometry', f"+{frame['x']}+4", '-compose', 'Over', '-composite']
        command += ['-quality', '90', '-define', 'webp:method=6', str(ROOT / 'bodies.webp')]
        subprocess.run(command, check=True)
    (ROOT / 'frames.json').write_text(json.dumps({'frames': frames, 'covers': covers}, indent=2) + '\n')
    print(f"4 guard poses, {x}x{HEIGHT+8}, {(ROOT / 'bodies.webp').stat().st_size} bytes")


if __name__ == '__main__':
    main()
