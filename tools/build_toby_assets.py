"""Package Toby's generated source art for game use without changing the originals."""
import json

from PIL import Image

from build_rowen_assets import CHARACTERS, bbox, fit_height


def main():
    folder = CHARACTERS / 'toby'
    for source, target, height in [
        ('dialogue.png', 'dialogue-768.webp', 768),
        ('sd_idle.png', 'sd_idle-256.webp', 256),
        ('cocoon.png', 'cocoon-512.webp', 512),
    ]:
        fit_height(folder / source, folder / target, height)

    with Image.open(folder / 'sd_idle.png') as image:
        x0, y0, x1, y1 = bbox(image)
        left, top = max(0, x0 - 2), max(0, y0 - 2)
        right, bottom = min(image.width, x1 + 2), min(image.height, y1 + 2)
    with Image.open(folder / 'sd_idle-256.webp') as image:
        data = dict(width=image.width, height=image.height,
                    originX=round((650 - left) / (right - left), 6),
                    originY=round((y1 - top) / (bottom - top), 6))
    (folder / 'sd_idle.json').write_text(json.dumps(data, indent=2) + '\n')

    with Image.open(folder / 'bellows-source.png') as image:
        cells = [image.crop((round(i * image.width / 2), 0,
                             round((i + 1) * image.width / 2), image.height)) for i in range(2)]
        bounds = [bbox(cell) for cell in cells]
        # The planted left foot is the support anchor, not the wide bellows apparatus.
        feet = [(210, 865), (232, 865)]
        width, height, margin = 640, 512, 16
        reach = max(max(x - b[0], b[2] - x) for b, (x, y) in zip(bounds, feet))
        above = max(y - b[1] for b, (x, y) in zip(bounds, feet))
        below = max(max(0, b[3] - y) for b, (x, y) in zip(bounds, feet))
        scale = min((width / 2 - margin) / reach, (height - margin * 2) / (above + below))
        anchor_x, anchor_y = width / 2, margin + above * scale
        atlas = Image.new('RGBA', (width * 2, height))
        frames = []
        for i, (name, cell, b, (fx, fy)) in enumerate(zip(
            ['bellows-open', 'bellows-press'], cells, bounds, feet,
        )):
            l, t, r, bottom = b
            assert min(l, t, cell.width - r, cell.height - bottom) > 0, name
            l, t, r, bottom = max(0, l - 2), max(0, t - 2), min(cell.width, r + 2), min(cell.height, bottom + 2)
            art = cell.crop((l, t, r, bottom)).resize(
                (round((r - l) * scale), round((bottom - t) * scale)), Image.Resampling.LANCZOS)
            x, y = round(anchor_x - (fx - l) * scale), round(anchor_y - (fy - t) * scale)
            assert x >= 0 and y >= 0 and x + art.width <= width and y + art.height <= height
            tile = Image.new('RGBA', (width, height))
            tile.alpha_composite(art, (x, y))
            tile.save(folder / f'{name}.webp', quality=92, method=6)
            atlas.alpha_composite(tile, (i * width, 0))
            frames.append(dict(name=name, x=i * width, y=0, w=width, h=height,
                               originX=round(anchor_x / width, 6), originY=round(anchor_y / height, 6)))
        atlas.save(folder / 'bellows.webp', quality=92, method=6)
    (folder / 'bellows-frames.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print('Toby: dialogue, SD idle, cocoon, two bellows poses and frame data ready')


if __name__ == '__main__':
    main()
