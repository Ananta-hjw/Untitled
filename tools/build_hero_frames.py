"""Build frame rectangles and foot/blade anchors; never modify the source sheets."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy'

# Combat anchors measured in each source cell: feet, guard, blade tip.
ANCHORS = [
    ((144, 294), (157, 235), (263, 280)),
    ((133, 294), (131, 109), (231, 26)),
    ((134, 294), (196, 233), (297, 280)),
    ((132, 294), (152, 233), (239, 279)),
    ((144, 294), (157, 234), (263, 279)),
    ((139, 294), (177, 254), (274, 281)),
    ((129, 294), (208, 153), (300, 106)),
    ((126, 294), (218, 127), (292, 50)),
    ((144, 294), (157, 235), (263, 280)),
    ((136, 294), (127, 212), (237, 211)),
    ((134, 294), (222, 203), (320, 204)),
    ((134, 294), (160, 204), (259, 204)),
    ((139, 295), (151, 261), (246, 290)),
    ((139, 295), (140, 253), (233, 290)),
    ((134, 295), (191, 253), (269, 290)),
    ((134, 295), (164, 238), (245, 283)),
]


def main():
    atlas = json.loads((ROOT / 'player_walk_atlas.json').read_text())
    frames = []
    for i, frame in enumerate(atlas['frames']):
        # Unity metadata uses bottom-left coordinates, Phaser uses top-left.
        frames.append(dict(name=f'walk-{i}', texture='hero-academy-walk',
                           x=frame['x'], y=atlas['height'] - frame['y'] - frame['height'],
                           w=frame['width'], h=frame['height'], originX=.5, originY=1,
                           scale=1, blade=None))

    with Image.open(ROOT / 'player_combat.png') as sheet:
        assert sheet.size == (1254, 1254), 'Re-measure anchors when replacing combat art'
        for i, (feet, guard, tip) in enumerate(ANCHORS):
            col, row = i % 4, i // 4
            left, top = round(col * sheet.width / 4), round(row * sheet.height / 4)
            right, bottom = round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / 4)
            # The thrust extends slightly past its nominal cell. Exclude that spill
            # from the next cell, while keeping the whole visible blade in this one.
            if i == 10:
                right += 12
            if i == 11:
                left += 28
            bounds = sheet.crop((left, top, right, bottom)).getchannel('A').point(
                lambda a: 255 if a >= 128 else 0).getbbox()
            assert bounds is not None
            x, y = left + bounds[0], top + bounds[1]
            w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
            cell_x = round(col * sheet.width / 4)
            cell_y = round(row * sheet.height / 4)
            point = lambda p: dict(x=cell_x + p[0] - x, y=cell_y + p[1] - y)
            foot = point(feet)
            frames.append(dict(name=f'combat-{i}', texture='hero-academy-combat',
                               x=x, y=y, w=w, h=h, originX=foot['x'] / w,
                               originY=foot['y'] / h, scale=1.2,
                               blade=dict(base=point(guard), tip=point(tip))))
    (ROOT / 'frames.json').write_text(json.dumps(dict(height=304, frames=frames), indent=2) + '\n')
    print(f'{len(frames)} frames: four-direction walk, three attacks, dodge')


if __name__ == '__main__':
    main()
