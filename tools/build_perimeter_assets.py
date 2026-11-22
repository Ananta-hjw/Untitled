"""Pack the three isolated village-wall sprites into a small runtime atlas."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/village/rowen'
# The wide horizontal wall extends beyond an equal third of the source sheet.
# Repeat the vertical coping strip only: repeating its end face makes stacked towers.
REGIONS = [('wall-horizontal', (0, 0, 950, 724), 448),
           ('wall-vertical', (1132, 150, 1212, 360), 96),
           ('gatepost', (1450, 0, 2172, 724), 160)]


def main():
    source = Image.open(ROOT / 'perimeter.png').convert('RGBA')
    crops = []
    for name, region, width in REGIONS:
        crop = source.crop(region)
        box = crop.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        assert box, name
        l, t, r, b = box
        crop = crop.crop((max(0, l - 2), max(0, t - 2), min(crop.width, r + 2), min(crop.height, b + 2)))
        crop = crop.resize((width, round(crop.height * width / crop.width)), Image.Resampling.LANCZOS)
        crops.append((name, crop))
    atlas = Image.new('RGBA', (sum(im.width + 4 for _, im in crops), max(im.height for _, im in crops) + 4))
    frames, x = [], 2
    for name, image in crops:
        atlas.paste(image, (x, 2))
        frames.append(dict(name=name, x=x, y=2, w=image.width, h=image.height))
        x += image.width + 4
    atlas.save(ROOT / 'perimeter.webp', quality=86, method=6)
    (ROOT / 'perimeter.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print(atlas.size, (ROOT / 'perimeter.webp').stat().st_size)


if __name__ == '__main__':
    main()
