"""Package the generated medieval starter gear sheet; ImageMagick writes runtime icons."""
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEETS = [
    ('starter-gear-source.png', ['short-sword', 'long-sword', 'cloth-hood', 'worn-tunic']),
    ('accessory-gear-source.png', ['leather-gloves', 'light-boots', 'clover-charm', 'blue-bead']),
]
OUTPUT = ROOT / 'src/assets/icons/items'


def package(source, names):
    art = Image.open(source).convert('RGBA')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(names):
        col, row = i % 2, i // 2
        x0, y0 = round(art.width * col / 2), round(art.height * row / 2)
        x1, y1 = round(art.width * (col + 1) / 2), round(art.height * (row + 1) / 2)
        cell = art.crop((x0, y0, x1, y1))
        box = cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        assert box, name
        l, t, r, b = box
        # Preserve a little antialiased edge outside the measured opaque silhouette.
        l, t, r, b = max(0, l - 3), max(0, t - 3), min(cell.width, r + 3), min(cell.height, b + 3)
        subprocess.run(['magick', str(source), '-crop', f'{r-l}x{b-t}+{x0+l}+{y0+t}', '+repage',
                        '-resize', '232x232', '-gravity', 'center', '-background', 'none', '-extent', '256x256',
                        '-quality', '92', str(OUTPUT / f'{name}.webp')], check=True)
        print(name)


def main():
    for filename, names in SHEETS:
        package(ROOT / 'src/assets/items' / filename, names)


if __name__ == '__main__':
    main()
