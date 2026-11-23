"""Package intact festival source art into a trimmed runtime atlas."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/festival'

def trim(im):
    box = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    return im.crop(box)

frames = []
for name, width in [('feast-table', 768), ('bonfire-base', 384), ('festival-pole', 96), ('hanging-lantern', 96), ('sky-lantern', 96)]:
    im = trim(Image.open(ROOT / f'{name}-source.png').convert('RGBA'))
    scale = min(width / im.width, 512 / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    frames.append((name, im))
im = Image.open(ROOT / 'bonfire-flames-source.png').convert('RGBA')
# Equal cells; retain each pose's proportions and align all four at the base.
poses = [trim(im.crop((round(x * im.width / 2), round(y * im.height / 2), round((x + 1) * im.width / 2), round((y + 1) * im.height / 2)))) for y in range(2) for x in range(2)]
scale = 256 / max(p.height for p in poses)
w = max(round(p.width * scale) for p in poses)
for i, p in enumerate(poses):
    p = p.resize((round(p.width * scale), round(p.height * scale)), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (w, 256))
    cell.alpha_composite(p, ((w - p.width) // 2, 256 - p.height))
    frames.append((f'flame-{i}', cell))
atlas = Image.new('RGBA', (1024, 2048))
metadata = {}; x = y = row_height = 0
for name, im in frames:
    if x + im.width + 4 > atlas.width:
        x = 0; y += row_height + 4; row_height = 0
    if y + im.height > atlas.height:
        raise ValueError('Atlas overflow')
    atlas.alpha_composite(im, (x, y))
    metadata[name] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}}
    x += im.width + 4; row_height = max(row_height, im.height)
atlas = atlas.crop((0, 0, 1024, y + row_height))
atlas.save(ROOT / 'props.webp', quality=92, method=6)
(ROOT / 'props.json').write_text(json.dumps({'frames': metadata, 'meta': {'image': 'props.webp', 'size': {'w': atlas.width, 'h': atlas.height}}}, indent=2) + '\n')
print(atlas.size, len(metadata), 'frames')
