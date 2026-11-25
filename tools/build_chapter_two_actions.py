"""Package generated chapter two action art; keep the original PNG sheets unchanged."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'
# Feet/support contact points in each original cell, independent of long tools and beams.
SETS = [
    ('characters/joan', 'combat', 2, 2, (512, 384), [
        ('attack', 270, 600), ('guard', 260, 600),
        ('hit', 350, 598), ('injured', 345, 595),
    ]),
    ('characters/joan', 'cocoon-awaken', 4, 2, (384, 384), [
        ('cocoon-asleep', 235, 412), ('cocoon-loosen', 222, 412),
        ('cocoon-open', 222, 417), ('cocoon-release', 203, 416),
        ('cocoon-kneel', 237, 398), ('cocoon-settle', 224, 398),
        ('cocoon-stir', 212, 398), ('cocoon-awake', 230, 398),
    ], 12),
    ('characters/evan', 'defense', 2, 2, (512, 384), [
        ('guard', 320, 586), ('knockback', 340, 593),
        ('hit', 260, 598), ('fatigued', 310, 597),
    ]),
    ('characters/evan', 'rope-pull', 4, 1, (512, 384), [
        ('rope-reach', 256, 459), ('rope-pull-down', 256, 459),
        ('rope-regrip', 256, 459), ('rope-settle', 256, 459),
    ]),
    ('characters/evan', 'oar-swing', 4, 1, (512, 384), [
        ('oar-ready', 256, 459), ('oar-windup', 256, 459),
        ('oar-strike', 256, 459), ('oar-recover', 256, 459),
    ]),
    ('characters/morgan', 'work', 2, 2, (512, 384), [
        ('lift-ready', 265, 595), ('hammer-wedge', 285, 492),
        ('tie-rope', 285, 497), ('work-hit', 325, 497),
    ]),
    ('chapter2', 'bell-carry', 2, 1, (960, 512), [
        ('carry-step-1', 443, 807), ('carry-step-2', 443, 808),
    ]),
]


def build(folder, stem, columns, rows, tile_size, poses, alpha_threshold=128):
    directory = ROOT / folder
    with Image.open(directory / f'{stem}-source.png') as source:
        source = source.convert('RGBA')
        cells = []
        for i, (name, foot_x, foot_y) in enumerate(poses):
            col, row = i % columns, i // columns
            rect = (round(col * source.width / columns), round(row * source.height / rows),
                    round((col + 1) * source.width / columns), round((row + 1) * source.height / rows))
            cell = source.crop(rect)
            bounds = cell.getchannel('A').point(lambda a: 255 if a >= alpha_threshold else 0).getbbox()
            assert bounds is not None, (stem, name)
            left, top, right, bottom = bounds
            assert min(left, top, cell.width - right, cell.height - bottom) > 0, (stem, name, 'clipped art')
            # Preserve a small antialias margin around the opaque silhouette.
            bounds = (max(0, left - 2), max(0, top - 2), min(cell.width, right + 2), min(cell.height, bottom + 2))
            cells.append((name, cell, bounds, foot_x, foot_y))

        width, height = tile_size
        reach = max(max(fx - b[0], b[2] - fx) for _, _, b, fx, _ in cells)
        above = max(fy - b[1] for _, _, b, _, fy in cells)
        below = max(max(0, b[3] - fy) for _, _, b, _, fy in cells)
        # Shared scale and feet position preserve the lower height of kneeling poses.
        scale = min((width / 2 - 16) / reach, (height - 32) / (above + below))
        anchor_x, anchor_y = width / 2, 16 + above * scale
        atlas = Image.new('RGBA', (width * columns, height * rows))
        frames = []
        for i, (name, cell, bounds, foot_x, foot_y) in enumerate(cells):
            left, top, right, bottom = bounds
            art = cell.crop(bounds).resize((round((right - left) * scale), round((bottom - top) * scale)), Image.Resampling.LANCZOS)
            x, y = round(anchor_x - (foot_x - left) * scale), round(anchor_y - (foot_y - top) * scale)
            assert x >= 0 and y >= 0 and x + art.width <= width and y + art.height <= height, (stem, name)
            tile = Image.new('RGBA', (width, height))
            tile.alpha_composite(art, (x, y))
            tile.save(directory / f'{name}.webp', quality=92, method=6)
            px, py = i % columns * width, i // columns * height
            atlas.alpha_composite(tile, (px, py))
            frames.append(dict(name=name, x=px, y=py, w=width, h=height,
                               originX=round(anchor_x / width, 6), originY=round(anchor_y / height, 6)))
        atlas.save(directory / f'{stem}.webp', quality=92, method=6)
        (directory / f'{stem}-frames.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
        print(f'{folder}/{stem}: {len(frames)} poses, {atlas.size}')


def main():
    for args in SETS:
        build(*args)
    with Image.open(ROOT / 'chapter2/shrine-bell.png') as image:
        bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        image = image.crop(bounds)
        image.resize((round(image.width * 512 / image.height), 512), Image.Resampling.LANCZOS).save(
            ROOT / 'chapter2/shrine-bell.webp', quality=92, method=6)


if __name__ == '__main__':
    main()
