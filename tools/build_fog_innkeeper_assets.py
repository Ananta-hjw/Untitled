"""Package the fog ferry innkeeper's original art without altering the PNGs."""
import json
from PIL import Image
from build_rowen_assets import CHARACTERS, bbox, fit_height


def main():
    folder = CHARACTERS / 'fog-innkeeper'
    for source, target, height in [
        ('dialogue.png', 'dialogue-768.webp', 768),
        ('sd_idle.png', 'sd_idle-256.webp', 256),
    ]:
        fit_height(folder / source, folder / target, height)
    with Image.open(folder / 'sd_idle.png') as image:
        l, t, r, b = bbox(image)
        left, top = max(0, l - 2), max(0, t - 2)
        right, bottom = min(image.width, r + 2), min(image.height, b + 2)
        foot_x = 554
    with Image.open(folder / 'sd_idle-256.webp') as runtime:
        data = dict(width=runtime.width, height=runtime.height,
                    originX=round((foot_x - left) / (right - left), 6),
                    originY=round((b - top) / (bottom - top), 6))
    (folder / 'sd_idle.json').write_text(json.dumps(data, indent=2) + '\n')

    with Image.open(folder / 'sleepwalk-source.png') as image:
        cells = [image.crop((round(x * image.width / 2), round(y * image.height / 2),
                             round((x + 1) * image.width / 2), round((y + 1) * image.height / 2)))
                 for y in range(2) for x in range(2)]
    bounds = [bbox(cell) for cell in cells]
    feet = []
    for cell, (l, t, r, b) in zip(cells, bounds):
        # Centre on the boots, independently of sleeves, keys and apron sway.
        lower = cell.crop((0, round(b - (b - t) * 0.17), cell.width, b))
        fl, _, fr, _ = bbox(lower)
        feet.append(((fl + fr) / 2, b))
        assert min(l, t, cell.width - r, cell.height - b) > 0, 'Clipped source cell'
    width, height, margin = 256, 320, 12
    reach = max(max(fx - l, r - fx) for (l, t, r, b), (fx, fy) in zip(bounds, feet))
    above = max(fy - t for (l, t, r, b), (fx, fy) in zip(bounds, feet))
    scale = min((width / 2 - margin) / reach, (height - margin * 2) / above)
    atlas = Image.new('RGBA', (width * 4, height))
    frames = []
    for i, (cell, (l, t, r, b), (fx, fy)) in enumerate(zip(cells, bounds, feet)):
        l, t, r, b = max(0, l - 2), max(0, t - 2), min(cell.width, r + 2), min(cell.height, b + 2)
        art = cell.crop((l, t, r, b)).resize((round((r - l) * scale), round((b - t) * scale)), Image.Resampling.LANCZOS)
        x, y = round(width / 2 - (fx - l) * scale), round(height - margin - (fy - t) * scale)
        assert x >= 0 and y >= 0 and x + art.width <= width and y + art.height <= height
        tile = Image.new('RGBA', (width, height))
        tile.alpha_composite(art, (x, y))
        tile.save(folder / f'sleepwalk-{i + 1}.webp', quality=92, method=6)
        atlas.alpha_composite(tile, (i * width, 0))
        frames.append(dict(name=f'sleepwalk-{i + 1}', x=i * width, y=0, w=width, h=height,
                           originX=0.5, originY=round((height - margin) / height, 6)))
    atlas.save(folder / 'sleepwalk.webp', quality=92, method=6)
    (folder / 'sleepwalk-frames.json').write_text(json.dumps(dict(frames=frames, fps=4, loop=[0, 1, 2, 3]), indent=2) + '\n')
    print('Fog innkeeper: portrait, SD idle, four sleepwalking poses and anchors ready')


if __name__ == '__main__':
    main()
