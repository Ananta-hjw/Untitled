"""Build runtime portraits and SD idle copies without changing chapter two source art."""
import json

from PIL import Image

from build_rowen_assets import CHARACTERS, bbox, fit_height

# Body/boot centre in the source canvas, independent of off-centre props and baskets.
FOOT_X = {'evan': 640, 'joan': 643, 'marta': 618, 'morgan': 646, 'finn': 651, 'dor': 595}


def main():
    for npc, foot_x in FOOT_X.items():
        folder = CHARACTERS / npc
        fit_height(folder / 'dialogue.png', folder / 'dialogue-768.webp', 768)
        fit_height(folder / 'sd_idle.png', folder / 'sd_idle-256.webp', 256)
        with Image.open(folder / 'sd_idle.png') as image:
            x0, y0, x1, y1 = bbox(image)
            left, top = max(0, x0 - 2), max(0, y0 - 2)
            right, bottom = min(image.width, x1 + 2), min(image.height, y1 + 2)
        with Image.open(folder / 'sd_idle-256.webp') as runtime:
            data = dict(width=runtime.width, height=runtime.height,
                        originX=round((foot_x - left) / (right - left), 6),
                        originY=round((y1 - top) / (bottom - top), 6))
        (folder / 'sd_idle.json').write_text(json.dumps(data, indent=2) + '\n')
        print(f'{npc}: dialogue-768.webp, sd_idle-256.webp, sd_idle.json')


if __name__ == '__main__':
    main()
