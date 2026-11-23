"""Pack measured attack bodies without altering source art or unaffected combo poses."""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/combo-proto'
# Coordinates within each source cell: foot pivot, gripping fist, blade angle in screen degrees.
# The weapon is a separate layer. Its guard sits 10 px ahead of the fist, not at an arbitrary hit point.
SHEETS = [
    ('attack-back', 3, [f'attack-back-{i}' for i in range(12)], [
        ((181, 345), (185, 183), -65), ((181, 345), (181, 70), -100),
        ((181, 345), (181, 165), -90), ((181, 345), (185, 183), -65),
        ((181, 345), (185, 183), -65), ((181, 345), (267, 214), 45),
        ((181, 345), (181, 190), -90), ((181, 345), (240, 59), -110),
        ((181, 345), (185, 184), -65), ((181, 345), (184, 188), -60),
        ((181, 345), (181, 175), -90), ((181, 345), (185, 183), -65),
    ]),
    ('attack-front-second', 1, [f'attack-front-{i}' for i in range(4, 8)], [
        ((294, 695), (314, 376), -140), ((294, 698), (296, 497), 150),
        ((294, 710), (300, 514), 90), ((294, 698), (319, 470), 65),
    ]),
    ('attack-down-diag-second-third', 2, [f'attack-down-diag-{i}' for i in range(4, 12)], [
        ((214, 427), (240, 303), -135), ((214, 424), (163, 267), 155),
        ((214, 424), (319, 322), 35), ((214, 424), (242, 274), 30),
        ((214, 427), (242, 304), 35), ((214, 428), (195, 284), 175),
        ((214, 427), (329, 342), 35), ((214, 428), (240, 295), 35),
    ]),
]


def build():
    cell = 384
    atlas = Image.new('RGBA', (cell * 4, cell * 6))
    frames = []
    for source, rows, names, anchors in SHEETS:
        with Image.open(ROOT / f'{source}-source.png') as sheet:
            for i, (name, (feet, grip, angle)) in enumerate(zip(names, anchors)):
                col, row = i % 4, i // 4
                bounds = (round(col * sheet.width / 4), round(row * sheet.height / rows),
                          round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / rows))
                body = sheet.crop(bounds)
                silhouette = body.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
                assert silhouette is not None
                left, top, right, bottom = silhouette
                # Keep consistent body height; feet and fists undergo the exact same scale as the pixels.
                height = 304
                width = round((right - left) * height / (bottom - top))
                body = body.crop(silhouette).resize((width, height), Image.Resampling.LANCZOS)
                sx, sy = width / (right - left), height / (bottom - top)
                point = lambda p: dict(x=round((p[0] - left) * sx, 2), y=round((p[1] - top) * sy, 2))
                foot, fist = point(feet), point(grip)
                dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
                base = dict(x=round(fist['x'] + dx * 10, 2), y=round(fist['y'] + dy * 10, 2))
                tip = dict(x=round(base['x'] + dx * 145, 2), y=round(base['y'] + dy * 145, 2))
                index = len(frames)
                x, y = index % 4 * cell + 4, index // 4 * cell + 4
                atlas.paste(body, (x, y))
                frames.append(dict(name=name, texture='hero-academy-attack-corrections',
                                   x=x, y=y, w=width, h=height, originX=foot['x'] / width,
                                   originY=foot['y'] / height, scale=1, grip=fist,
                                   blade=dict(base=base, tip=tip),
                                   weaponPerspective='up' if name.startswith('attack-back-') else
                                   'down' if name == 'attack-front-6' else 'side'))
    atlas.save(ROOT / 'attack-corrections.webp', lossless=True)
    (ROOT / 'attack-corrections_frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{len(frames)} measured attack corrections')


if __name__ == '__main__':
    build()
