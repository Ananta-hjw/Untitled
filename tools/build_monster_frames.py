"""Measure monster movement/attack sheets without modifying source image pixels."""
import argparse
import json
from math import sqrt
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/monsters'
MONSTERS = ['slime', 'waterdrop-mushroom', 'iron-scale-lizard', 'frost-beetle']
DIRECTIONS = {
    'cardinal': ['down', 'left', 'right', 'up'],
    'diagonal': ['down-left', 'down-right', 'up-left', 'up-right'],
}


def build(name):
    frames, sheets, rows = [], {}, []
    for animation in ['walk', 'attack']:
        for kind, directions in DIRECTIONS.items():
            filename = f'{animation}_{kind}.png'
            with Image.open(ROOT / name / filename) as image:
                assert image.mode == 'RGBA', (name, filename, 'RGBA required')
                alpha = image.getchannel('A')
                assert sum(alpha.histogram()[:8]) > image.width * image.height * .25, (name, filename, 'Background is not transparent')
                sheets[filename] = {'width': image.width, 'height': image.height}
                for row, direction in enumerate(directions):
                    poses = []
                    for col in range(4):
                        left, top = round(col * image.width / 4), round(row * image.height / 4)
                        right, bottom = round((col + 1) * image.width / 4), round((row + 1) * image.height / 4)
                        mask = alpha.crop((left, top, right, bottom)).point(lambda a: 255 if a >= 128 else 0)
                        bounds = mask.getbbox()
                        assert bounds, (name, filename, row, col, 'Empty frame')
                        x0, y0, x1, y1 = bounds
                        assert x0 > 0 and y0 > 0 and x1 < mask.width and y1 < mask.height, (name, filename, row, col, 'Art touches cell boundary')
                        poses.append((left, top, mask, bounds))
                    idle = poses[0]
                    # Fixed per-row idle pivot preserves squish, forward lean and attack reach.
                    pivot_x = (idle[3][0] + idle[3][2]) / 2
                    baseline = idle[3][3]
                    area = idle[2].histogram()[255]
                    rows.append((filename, animation, direction, area, pivot_x, baseline, poses))
    reference_area = median(r[3] for r in rows if r[0] == 'walk_cardinal.png')
    extents = []
    for filename, animation, direction, area, pivot_x, baseline, poses in rows:
        # Area is more stable than head/height for blobs, long-tailed reptiles and shells.
        # One scale per direction, shared across all its poses: never normalize a squashed pose.
        scale = sqrt(reference_area / area)
        for pose, (left, top, mask, bounds) in enumerate(poses):
            x0, y0, x1, y1 = bounds
            x, y = max(0, x0 - 3), max(0, y0 - 3)
            width = min(mask.width, x1 + 3) - x
            height = min(mask.height, y1 + 3) - y
            frames.append({
                'name': f'{animation}-{direction}-{pose}', 'animation': animation,
                'direction': direction, 'pose': pose, 'sheet': filename,
                'x': left + x, 'y': top + y, 'w': width, 'h': height,
                'originX': round((pivot_x - x) / width, 6),
                'originY': round((baseline - y) / height, 6), 'scale': round(scale, 6),
            })
            extents.append(((x - pivot_x) * scale, (y - baseline) * scale,
                            (x + width - pivot_x) * scale, (y + height - baseline) * scale))
    data = {
        'monster': name, 'referenceArea': reference_area,
        'bounds': {'left': min(e[0] for e in extents), 'top': min(e[1] for e in extents),
                   'right': max(e[2] for e in extents), 'bottom': max(e[3] for e in extents)},
        'animations': {
            'idle': {'fps': 8, 'poses': [0], 'source': 'walk', 'loop': True},
            'walk': {'fps': 8, 'poses': [1, 2, 3, 2], 'source': 'walk', 'loop': True},
            'attack': {'fps': 8, 'poses': [0, 1, 1, 2, 3, 0, 0, 0], 'source': 'attack',
                       'loop': False, 'windupPose': 1, 'strikePose': 2, 'recoveryPose': 3},
        },
        'sheets': sheets, 'frames': frames,
        'anchorNote': 'Fixed idle silhouette center and baseline per direction; scales measured from idle area. Verify contact and projectile origins on game integration.',
    }
    (ROOT / name / 'animation_frames.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{name}: {len(frames)} frames, 8 directions, movement + attack')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--monsters', nargs='+', choices=MONSTERS, default=MONSTERS)
    for monster in parser.parse_args().monsters:
        build(monster)
