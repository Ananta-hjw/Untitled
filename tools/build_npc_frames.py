"""Measure NPC walk sheets without changing any source image pixels."""
import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'src/assets'
ROOT = ASSETS / 'characters'
COMMANDERS = ['noctur', 'orwen', 'lumiera', 'kantor']
SHEETS = {
    'walk_cardinal.png': ['down', 'left', 'right', 'up'],
    'walk_diagonal.png': ['down-left', 'down-right', 'up-left', 'up-right'],
}
CHARACTERS = [
    'linea', 'sia', 'ruan', 'serena', 'doran', 'merina',
    'herman', 'eila', 'teon', 'rosetta', 'vernel', 'fern',
    'bram', 'mirel', 'kairen', 'velka', 'razen', 'soldier', 'evan', 'joan', 'finn', 'morgan', 'marta',
]


def build(character, root=ROOT):
    frames = []
    sheets = {}
    for filename, directions in SHEETS.items():
        with Image.open(root / character / filename) as image:
            assert image.mode == 'RGBA', filename
            alpha = image.getchannel('A')
            assert alpha.histogram()[0] > image.width * image.height * .25
            sheets[filename] = {'width': image.width, 'height': image.height}
            for row, direction in enumerate(directions):
                for col in range(4):
                    left, top = round(col * image.width / 4), round(row * image.height / 4)
                    right, bottom = round((col + 1) * image.width / 4), round((row + 1) * image.height / 4)
                    mask = alpha.crop((left, top, right, bottom)).point(lambda a: 255 if a >= 128 else 0)
                    bounds = mask.getbbox()
                    assert bounds, (character, direction, col)
                    x0, y0, x1, y1 = bounds
                    assert x0 > 0 and y0 > 0 and x1 < mask.width and y1 < mask.height, (
                        'Visible art reaches a cell boundary; revise the source sheet', character, direction, col)
                    # Hair/head center avoids a swinging arm or scabbard moving the pivot.
                    head = mask.crop((0, y0, mask.width, y0 + round((y1 - y0) * .35))).getbbox()
                    foot_x = (head[0] + head[2]) / 2
                    # Include antialiased silhouette edges, while respecting the cell.
                    x, y = max(0, x0 - 3), max(0, y0 - 3)
                    width, height = min(mask.width, x1 + 3) - x, min(mask.height, y1 + 3) - y
                    frames.append({
                        'name': f'{direction}-{col}', 'sheet': filename,
                        'direction': direction, 'pose': col,
                        'x': left + x, 'y': top + y, 'w': width, 'h': height,
                        'originX': (foot_x - x) / width, 'originY': (y1 - y) / height,
                        'bodyHeight': y1 - y0,
                    })
    reference_height = median(f['bodyHeight'] for f in frames if f['pose'] == 0 and f['sheet'] == 'walk_cardinal.png')
    for direction in [d for values in SHEETS.values() for d in values]:
        idle = next(f for f in frames if f['direction'] == direction and f['pose'] == 0)
        for frame in frames:
            if frame['direction'] == direction:
                frame['scale'] = round(reference_height / idle['bodyHeight'], 6)
    data = {
        'character': character, 'fps': 8, 'idlePose': 0, 'walkPoses': [1, 2, 3, 2],
        'referenceHeight': reference_height, 'sheets': sheets, 'frames': frames,
        'anchorNote': 'Measured head center projected to the boot baseline; verify in-game before integration.',
    }
    (root / character / 'walk_frames.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{character}: {len(frames)} frames, 8 directions, reference height {reference_height}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--asset-group', choices=['characters', 'commanders'], default='characters')
    parser.add_argument('--characters', nargs='+', choices=CHARACTERS + COMMANDERS,
                        help='Measure only the named characters; defaults to all walk sheets.')
    args = parser.parse_args()
    available = COMMANDERS if args.asset_group == 'commanders' else CHARACTERS
    for name in args.characters or available:
        if name not in available:
            parser.error(f'{name} does not belong to {args.asset_group}')
        build(name, ASSETS / args.asset_group)
