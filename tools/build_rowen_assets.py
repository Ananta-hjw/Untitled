"""Make small runtime copies of the Rowen village art without changing the source images.

Source sheets and portraits are 1–4 MB each; a phone does not need that much detail at the size
the game draws them. This script writes:

- src/assets/village/rowen/buildings.webp + buildings.json: the eight buildings from
  residential.png and commerce.png, scaled by BUILDING_SCALE and packed in one sheet.
- src/assets/characters/<id>/dialogue-768.webp: the dialogue portrait cropped to its art, 768 px tall.
- src/assets/characters/<id>/walk_*-60.webp: walk sheets scaled by WALK_SCALE (frames come from
  walk_frames.json multiplied by the same factor).
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'
VILLAGE = ROOT / 'village/rowen'
CHARACTERS = ROOT / 'characters'
BUILDING_SCALE = .75
WALK_SCALE = .6
SHEETS = {
    'residential.png': ['family-house', 'training-hall', 'chief-house', 'clinic'],
    'commerce.png': ['smithy', 'general-store', 'inn', 'south-gate'],
}
NPCS = ['ruan', 'serena', 'linea', 'sia', 'herman', 'eila', 'merina', 'doran', 'rosetta', 'vernel', 'teon']


def bbox(image):
    box = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    assert box is not None
    return box


def main_part(image, step=4):
    """Bounds of the largest connected shape. A sheet cell can catch the tip of a neighbour's roof."""
    small = image.getchannel('A').resize((image.width // step, image.height // step), Image.BOX)
    w, h = small.size
    solid = [a >= 96 for a in small.tobytes()]
    seen = [False] * (w * h)
    best = None
    for start in range(w * h):
        if not solid[start] or seen[start]:
            continue
        seen[start], stack, cells = True, [start], []
        while stack:
            i = stack.pop()
            cells.append(i)
            x, y = i % w, i // w
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and solid[j] and not seen[j]:
                        seen[j] = True
                        stack.append(j)
        if best is None or len(cells) > len(best):
            best = cells
    xs, ys = [i % w for i in best], [i // w for i in best]
    x0, y0, x1, y1 = (min(xs) - 1) * step, (min(ys) - 1) * step, (max(xs) + 2) * step, (max(ys) + 2) * step
    # Refine to the exact art inside that region.
    region = (max(0, x0), max(0, y0), min(image.width, x1), min(image.height, y1))
    rx0, ry0, rx1, ry1 = bbox(image.crop(region))
    return region[0] + rx0, region[1] + ry0, region[0] + rx1, region[1] + ry1


def buildings():
    crops = []
    for filename, names in SHEETS.items():
        with Image.open(VILLAGE / filename) as sheet:
            sheet = sheet.convert('RGBA')
            for i, name in enumerate(names):
                col, row = i % 2, i // 2
                cell = (round(col * sheet.width / 2), round(row * sheet.height / 2),
                        round((col + 1) * sheet.width / 2), round((row + 1) * sheet.height / 2))
                art = sheet.crop(cell)
                x0, y0, x1, y1 = main_part(art)
                art = art.crop((max(0, x0 - 2), max(0, y0 - 2), min(art.width, x1 + 2), min(art.height, y1 + 2)))
                size = (round(art.width * BUILDING_SCALE), round(art.height * BUILDING_SCALE))
                crops.append((name, art.resize(size, Image.LANCZOS)))
    # Two rows of four, packed left to right.
    width = max(sum(c.width for _, c in crops[:4]), sum(c.width for _, c in crops[4:])) + 8
    height = max(c.height for _, c in crops[:4]) + max(c.height for _, c in crops[4:]) + 4
    out = Image.new('RGBA', (width, height))
    frames, x, y = [], 0, 0
    for i, (name, crop) in enumerate(crops):
        if i == 4:
            x, y = 0, max(c.height for _, c in crops[:4]) + 4
        out.paste(crop, (x, y))
        frames.append(dict(name=name, x=x, y=y, w=crop.width, h=crop.height))
        x += crop.width + 2
    out.save(VILLAGE / 'buildings.webp', quality=88, method=6)
    (VILLAGE / 'buildings.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'buildings.webp {out.size}, {len(frames)} buildings')


def fit_height(path, target, height):
    with Image.open(path) as image:
        image = image.convert('RGBA')
        x0, y0, x1, y1 = bbox(image)
        art = image.crop((max(0, x0 - 2), max(0, y0 - 2), min(image.width, x1 + 2), min(image.height, y1 + 2)))
        art.resize((round(art.width * height / art.height), height), Image.LANCZOS).save(target, quality=88, method=6)


def characters():
    for npc in NPCS:
        fit_height(CHARACTERS / npc / 'dialogue.png', CHARACTERS / npc / 'dialogue-768.webp', 768)
    for npc in NPCS:
        for name in ['walk_cardinal', 'walk_diagonal']:
            with Image.open(CHARACTERS / npc / f'{name}.png') as image:
                size = (round(image.width * WALK_SCALE), round(image.height * WALK_SCALE))
                image.resize(size, Image.LANCZOS).save(CHARACTERS / npc / f'{name}-60.webp', quality=88, method=6)
    print(f'{len(NPCS)} NPC portraits and walk sets')


if __name__ == '__main__':
    import sys
    if '--characters' not in sys.argv:
        buildings()
    characters()
