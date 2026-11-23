"""Package the bell ringer's mother's original portrait and seated SD."""
import json
from PIL import Image
from build_rowen_assets import CHARACTERS, bbox, fit_height


def main():
    folder = CHARACTERS / 'bell-ringer-mother'
    for name, target, height in [('dialogue.png', 'dialogue-768.webp', 768), ('sd_idle.png', 'sd_idle-256.webp', 256)]:
        with Image.open(folder / name) as source:
            assert source.mode == 'RGBA', name
            l, t, r, b = bbox(source)
            assert min(l, t, source.width - r, source.height - b) > 0, f'{name}: clipped silhouette'
            assert source.getchannel('A').getextrema()[0] == 0, f'{name}: background not transparent'
        fit_height(folder / name, folder / target, height)
    with Image.open(folder / 'sd_idle.png') as source:
        l, t, r, b = bbox(source)
        # The support spans stool legs and shoes; centre their combined ground contact.
        lower = source.crop((0, round(b - (b - t) * 0.12), source.width, b))
        fl, _, fr, _ = bbox(lower)
        support_x = (fl + fr) / 2
        left, top = max(0, l - 2), max(0, t - 2)
        right, bottom = min(source.width, r + 2), min(source.height, b + 2)
    with Image.open(folder / 'sd_idle-256.webp') as runtime:
        data = dict(width=runtime.width, height=runtime.height,
                    originX=round((support_x - left) / (right - left), 6),
                    originY=round((b - top) / (bottom - top), 6))
    (folder / 'sd_idle.json').write_text(json.dumps(data, indent=2) + '\n')
    print('Bell ringer mother: portrait, seated SD and support anchor ready')


if __name__ == '__main__':
    main()
