"""Build frame rectangles and foot/blade anchors; never modify the source sheets."""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy'

# Combat anchors measured in each source cell: feet, guard, blade tip.
ANCHORS = [
    ((144, 297), (157, 235), (260, 280)),
    ((133, 297), (131, 109), (231, 26)),
    ((134, 297), (196, 233), (292, 280)),
    ((132, 296), (152, 233), (241, 279)),
    ((144, 295), (157, 234), (259, 279)),
    ((139, 295), (177, 254), (275, 281)),
    ((129, 296), (208, 153), (297, 106)),
    ((126, 295), (218, 127), (291, 50)),
    ((144, 295), (157, 235), (260, 280)),
    ((136, 295), (127, 212), (241, 211)),
    ((134, 296), (222, 203), (320, 204)),
    ((134, 295), (160, 204), (271, 204)),
    ((139, 296), (151, 261), (249, 290)),
    ((139, 295), (140, 253), (234, 290)),
    ((134, 295), (191, 253), (274, 290)),
    ((134, 296), (164, 238), (248, 283)),
]

# Guard and tip in each 362px source cell. Feet are measured from the boot soles.
DIAGONAL_ATTACK_ANCHORS = {
    'down': [
        ((171, 261), (278, 319)), ((124, 105), (250, 17)),
        ((219, 275), (322, 347)), ((166, 263), (272, 328)),
        ((171, 261), (279, 322)), ((200, 291), (309, 322)),
        ((218, 238), (331, 319)), ((246, 134), (327, 51)),
        ((171, 264), (279, 322)), ((106, 239), (238, 247)),
        ((211, 266), (325, 340)), ((163, 248), (284, 261)),
    ],
    'up': [
        ((239, 251), (302, 285)), ((236, 93), (290, 3)),
        ((256, 167), (328, 101)), ((232, 252), (301, 299)),
        ((240, 254), (302, 289)), ((232, 276), (308, 311)),
        ((262, 151), (336, 92)), ((250, 98), (320, 17)),
        ((239, 252), (303, 289)), ((201, 226), (282, 224)),
        ((271, 171), (346, 144)), ((230, 247), (307, 269)),
    ],
}


def main():
    atlas_path = ROOT / 'player_walk_atlas.json'
    atlas = json.loads(atlas_path.read_text())
    if '--measure-walk' in sys.argv:
        # Clothing changes the silhouette, not the source-cell position of the feet.
        # Retain horizontal pivots across repeated measurements and widen crops as needed.
        with Image.open(ROOT / 'player_walk.png') as sheet:
            assert sheet.size == (atlas['width'], atlas['height'])
            for i, frame in enumerate(atlas['frames']):
                col, row = i % 4, i // 4
                left, top = round(col * sheet.width / 4), round(row * sheet.height / 4)
                right, bottom = round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / 4)
                bounds = sheet.crop((left, top, right, bottom)).getchannel('A').point(
                    lambda a: 255 if a >= 128 else 0).getbbox()
                assert bounds is not None
                foot_x = frame.get('footX', frame['x'] + frame['width'] / 2)
                frame.update(x=left + bounds[0], y=sheet.height - top - bounds[3],
                             width=bounds[2] - bounds[0], height=bounds[3] - bounds[1], footX=foot_x)
        atlas_path.write_text(json.dumps(atlas, indent=2) + '\n')
    frames = []
    for i, frame in enumerate(atlas['frames']):
        # Unity metadata uses bottom-left coordinates, Phaser uses top-left.
        frames.append(dict(name=f'walk-{i}', texture='hero-academy-walk',
                           x=frame['x'], y=atlas['height'] - frame['y'] - frame['height'],
                           w=frame['width'], h=frame['height'],
                           originX=(frame.get('footX', frame['x'] + frame['width'] / 2) - frame['x']) / frame['width'], originY=1,
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
    with Image.open(ROOT / 'player_walk_diagonal.png') as sheet:
        # Same four-pose cycle, with independently drawn front/back diagonal views.
        for row in range(4):
            top, bottom = round(row * sheet.height / 4), round((row + 1) * sheet.height / 4)
            idle = sheet.crop((0, top, round(sheet.width / 4), bottom)).getchannel('A').point(
                lambda a: 255 if a >= 128 else 0)
            idle_bounds = idle.getbbox()
            assert idle_bounds is not None
            soles = idle.crop((0, idle_bounds[3] - 12, idle.width, idle_bounds[3])).getbbox()
            assert soles is not None
            # All four poses share the idle stance's horizontal foot origin.
            foot_x = (soles[0] + soles[2]) / 2
            for col in range(4):
                left, right = round(col * sheet.width / 4), round((col + 1) * sheet.width / 4)
                bounds = sheet.crop((left, top, right, bottom)).getchannel('A').point(
                    lambda a: 255 if a >= 128 else 0).getbbox()
                assert bounds is not None
                x, y = left + bounds[0], top + bounds[1]
                w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
                frames.append(dict(name=f'diagonal-{row * 4 + col}', texture='hero-academy-diagonal',
                                   x=x, y=y, w=w, h=h, originX=(foot_x - bounds[0]) / w,
                                   originY=1, scale=1, blade=None))
    for direction, anchors in DIAGONAL_ATTACK_ANCHORS.items():
        with Image.open(ROOT / f'player_attack_{direction}.png') as sheet:
            assert sheet.size == (1448, 1086), 'Re-measure diagonal attack anchors when replacing art'
            for i, (guard, tip) in enumerate(anchors):
                col, row = i % 4, i // 4
                left, top = col * 362, row * 362
                mask = sheet.crop((left, top, left + 362, top + 362)).getchannel('A').point(
                    lambda a: 255 if a >= 128 else 0)
                bounds = mask.getbbox()
                assert bounds is not None
                # The blade can finish below the soles at the far right. Measure
                # feet only in the body region, excluding the extended weapon.
                body = mask.crop((0, 0, 230, 362))
                body_bounds = body.getbbox()
                assert body_bounds is not None
                foot_y = body_bounds[3]
                soles = body.crop((0, foot_y - 24, 230, foot_y)).getbbox()
                assert soles is not None
                foot_x = (soles[0] + soles[2]) / 2
                x, y = bounds[0], bounds[1]
                w, h = bounds[2] - x, bounds[3] - y
                point = lambda p: dict(x=p[0] - x, y=p[1] - y)
                frames.append(dict(name=f'attack-{direction}-{i}', texture=f'hero-academy-attack-{direction}',
                                   x=left + x, y=top + y, w=w, h=h,
                                   originX=(foot_x - x) / w, originY=(foot_y - y) / h, scale=.9375,
                                   blade=dict(base=point(guard), tip=point(tip))))
    height = max(304, max(f['h'] for f in frames if f['blade'] is None))
    (ROOT / 'frames.json').write_text(json.dumps(dict(height=height, frames=frames), indent=2) + '\n')
    print(f'{len(frames)} frames: eight-direction walk, horizontal/diagonal combos, dodge')


if __name__ == '__main__':
    main()
