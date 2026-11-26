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


EVAN_SCENES = [
    ('riverbank', [
        ('riverbank-sit', 341, 589), ('riverbank-rise', 281, 589),
        ('riverbank-point', 317, 632), ('riverbank-warn', 288, 632),
    ]),
    ('mooring', [
        ('mooring-ready', 299, 609), ('mooring-loosen', 275, 585),
        ('mooring-release', 278, 612), ('mooring-gather', 299, 609),
    ]),
    ('rowing', [
        ('rowing-reach', 277, 600), ('rowing-catch', 252, 600),
        ('rowing-drive', 303, 597), ('rowing-recover', 303, 597),
    ]),
    ('cocoon-guard', [
        ('cocoon-kneel', 296, 574), ('cocoon-protect', 271, 584),
        ('thread-bound', 291, 612), ('thread-release', 267, 618),
    ]),
    ('reunion', [
        ('reunion-shoulder', 317, 607), ('reunion-embrace', 328, 608),
        ('reunion-smile', 321, 610), ('reunion-support', 319, 610),
    ]),
]


FINN_SCENES = [
    ('night-watch', [
        ('watch-awake', 324, 590), ('wake-sion', 316, 584),
        ('warn-father', 322, 633), ('hug-father', 310, 636),
    ], (0, 605, 1254)),
    ('kite-flight', [
        ('kite-ready', 297, 607), ('kite-feed', 269, 607),
        ('kite-pull', 310, 608), ('kite-hold', 270, 608),
    ], None),
]


MORGAN_MARTA_SCENES = [
    ('morgan', 'pole-row', [
        ('pole-reach', 208, 560), ('pole-probe', 211, 560),
        ('pole-drive', 208, 582), ('pole-recover', 220, 582),
    ]),
    ('morgan', 'confession', [
        ('confession-stand', 317, 623), ('confession-lower', 270, 608),
        ('confession-kneel', 293, 612), ('confession-admit', 281, 612),
    ]),
    ('morgan', 'bell-ring', [
        ('bell-reach', 286, 610), ('bell-grip', 301, 613),
        ('bell-pull', 300, 608), ('bell-release', 298, 608),
    ]),
    ('marta', 'bell-repair', [
        ('clapper-inspect', 409, 620), ('clapper-fit', 385, 620),
        ('clapper-raise-hammer', 410, 621), ('clapper-tap', 385, 621),
    ]),
    ('marta', 'wax-earplugs', [
        ('wax-pinch', 316, 596), ('wax-roll', 296, 596),
        ('wax-shape', 316, 597), ('wax-present', 296, 597),
    ]),
]


INNKEEPER_DOR_SCENES = [
    ('fog-innkeeper', 'river-wake', [
        ('river-awake', 324, 598), ('river-slip', 288, 561),
        ('river-step-back', 290, 591), ('river-steady', 277, 597),
    ]),
    ('dor', 'tend-fire', [
        ('fire-kindling', 242, 561), ('fire-prepare', 242, 561),
        ('fire-strike', 241, 561), ('fire-shield', 242, 561),
    ]),
]


def build(folder, stem, columns, rows, tile_size, poses, alpha_threshold=128,
          *, row_edges=None, individual_poses=True):
    directory = ROOT / folder
    with Image.open(directory / f'{stem}-source.png') as source:
        source = source.convert('RGBA')
        edges = row_edges or [round(row * source.height / rows) for row in range(rows + 1)]
        cells = []
        for i, (name, foot_x, foot_y) in enumerate(poses):
            col, row = i % columns, i // columns
            rect = (round(col * source.width / columns), edges[row],
                    round((col + 1) * source.width / columns), edges[row + 1])
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
            if individual_poses:
                tile.save(directory / f'{name}.webp', quality=92, method=6)
            px, py = i % columns * width, i // columns * height
            atlas.alpha_composite(tile, (px, py))
            frames.append(dict(name=name, x=px, y=py, w=width, h=height,
                               originX=round(anchor_x / width, 6), originY=round(anchor_y / height, 6)))
        atlas.save(directory / f'{stem}.webp', quality=92, method=6)
        (directory / f'{stem}-frames.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
        print(f'{folder}/{stem}: {len(frames)} poses, {atlas.size}')


def build_evan_scenes():
    for stem, poses in EVAN_SCENES:
        # The second row starts slightly above the generated sheet's midpoint.
        row_edges = (0, 610, 1254) if stem == 'riverbank' else None
        build('characters/evan', stem, 2, 2, (512, 384), poses,
              row_edges=row_edges, individual_poses=False)


def build_finn_scenes():
    for stem, poses, row_edges in FINN_SCENES:
        build('characters/finn', stem, 2, 2, (512, 384), poses,
              row_edges=row_edges, individual_poses=False)


def build_morgan_marta_scenes():
    for character, stem, poses in MORGAN_MARTA_SCENES:
        build(f'characters/{character}', stem, 2, 2, (512, 384), poses, individual_poses=False)


def build_innkeeper_dor_scenes():
    for character, stem, poses in INNKEEPER_DOR_SCENES:
        build(f'characters/{character}', stem, 2, 2, (512, 384), poses, individual_poses=False)


def main():
    for args in SETS:
        build(*args)
    build_evan_scenes()
    build_finn_scenes()
    build_morgan_marta_scenes()
    build_innkeeper_dor_scenes()
    with Image.open(ROOT / 'chapter2/shrine-bell.png') as image:
        bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        image = image.crop(bounds)
        image.resize((round(image.width * 512 / image.height), 512), Image.Resampling.LANCZOS).save(
            ROOT / 'chapter2/shrine-bell.webp', quality=92, method=6)


if __name__ == '__main__':
    main()
