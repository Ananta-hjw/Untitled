"""Pack straight and perspective weapon layers from the hero and item source art."""

import json
import math
import sys
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'src/assets'
WEAPONS = ASSETS / 'hero/weapons'
RESAMPLE = Image.Resampling.LANCZOS
GUARD_X = 118
BLADE_LENGTH = 390
ICON_POINTS = {
    'short-sword': ((103, 154), (230, 12)),
    'long-sword': ((81, 172), (238, 14)),
}
# Original atlas rectangles, normalized guard origins, tip distance, and grip cut.
PERSPECTIVE_SOURCE = [
    ('iron-sword-down', 4, 82, .4943, .2388, 167, 46),
    ('iron-sword-up', 90, 86, .4973, .629, 138, 147),
    ('wooden-sword-down', 180, 79, .4911, .2175, 172, 41),
    ('wooden-sword-up', 263, 87, .4973, .6111, 134, 146),
]


def from_icon(name, guard, tip):
    """Rotate the shared inventory art and register it at the standard guard and tip."""
    icon = Image.open(ASSETS / 'icons/items' / f'{name}.webp').convert('RGBA')
    dx, dy = tip[0] - guard[0], tip[1] - guard[1]
    length = math.hypot(dx, dy)
    u, v = dx / length, dy / length
    aligned = icon.transform(
        (390, 160), Image.Transform.AFFINE,
        (u, -v, guard[0] - 120 * u + 80 * v,
         v, u, guard[1] - 120 * v - 80 * u),
        Image.Resampling.BICUBIC,
    )
    row = Image.new('RGBA', (512, 96))
    row.paste(aligned.crop((0, 28, 120, 132)).resize((GUARD_X, 96), RESAMPLE))
    # Leave room beyond the pointed tip for its antialiased edge.
    blade = aligned.crop((120, 28, 120 + round(length) + 2, 132))
    row.paste(blade.resize((512 - GUARD_X, 96), RESAMPLE), (GUARD_X, 0))
    return row


def save_metadata(name, data):
    (WEAPONS / name).write_text(json.dumps(data, indent=2) + '\n')


def pack_straight(rows):
    atlas = Image.new('RGBA', (512, len(rows) * 96))
    frames = []
    for i, (name, row, axis) in enumerate(rows):
        y = i * 96
        atlas.paste(row, (0, y))
        for part, x, width in [('blade', 108, 404), ('grip', 0, 108), ('hilt', 0, 134)]:
            frames.append(dict(name=f'{name}-{part}', x=x, y=y, w=width, h=96,
                               originX=(GUARD_X - x) / width, originY=axis / 96))
    atlas.save(WEAPONS / 'weapons.webp', lossless=True, method=6)
    save_metadata('atlas.json', dict(guardX=GUARD_X, bladeLength=BLADE_LENGTH, frames=frames))


def pack_perspective(variants):
    atlas_source = Image.open(WEAPONS / 'perspective-source.png').convert('RGBA')
    entries = [(name, atlas_source.crop((x, 4, x + width, 224)), ox, oy, length, cut)
               for name, x, width, ox, oy, length, cut in PERSPECTIVE_SOURCE]
    height = 220
    for name, row in variants.items():
        for direction, rotation in [('down', Image.Transpose.ROTATE_270), ('up', Image.Transpose.ROTATE_90)]:
            image = row.transpose(rotation).resize((96, height), RESAMPLE)
            down = direction == 'down'
            origin = GUARD_X / 512
            cut = round(108 * height / 512)
            entries.append((f'{name}-{direction}', image, .5, origin if down else 1 - origin,
                            BLADE_LENGTH * height / 512, cut if down else height - cut))

    atlas = Image.new('RGBA', (4 + sum(image.width + 4 for _, image, *_ in entries), 452))
    frames = []
    x = 4
    for name, image, ox, oy, length, cut in entries:
        w, h = image.size
        upper, lower = (0, 0, w, cut), (0, cut, w, h)
        blade, grip = (lower, upper) if name.endswith('-down') else (upper, lower)
        # Both layers use the same origin and canvas so their seams and rotations coincide.
        atlas.paste(image.crop(blade), (x, 4 + blade[1]))
        atlas.paste(image.crop(grip), (x, 228 + grip[1]))
        frame = dict(name=name, x=x, y=4, w=w, h=h, originX=ox, originY=oy, bladeLength=length)
        frames.extend([frame, {**frame, 'name': f'{name}-grip', 'y': 228}])
        x += w + 4
    atlas.save(WEAPONS / 'perspective.png')
    save_metadata('perspective_atlas.json', dict(frames=frames))


if __name__ == '__main__':
    with Image.open(sys.argv[1]) as base:
        rows = [('iron-sword', base.crop((0, 0, 512, 96)), 48),
                ('wooden-sword', base.crop((0, 96, 512, 192)), 50)]
    variants = {name: from_icon(name, *points) for name, points in ICON_POINTS.items()}
    pack_straight(rows + [(name, row, 48) for name, row in variants.items()])
    pack_perspective(variants)
