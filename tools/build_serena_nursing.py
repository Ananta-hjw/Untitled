"""Pack Serena's generated nursing and water-cloth cycles, preserving the source artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/serena'


def build():
    atlas = Image.new('RGBA', (1024, 640))
    frames = []
    with Image.open(ROOT / 'nursing-source.png') as source:
        for i in range(8):
            col, row = i % 4, i // 4
            body = source.crop((round(col * source.width / 4), round(row * source.height / 2),
                                round((col + 1) * source.width / 4), round((row + 1) * source.height / 2)))
            alpha = body.getchannel('A').point(lambda a: 255 if a >= 8 else 0)
            bounds = alpha.getbbox()
            assert bounds
            l, t, r, b = bounds
            soles = alpha.crop((0, b - 16, body.width, b)).getbbox()
            assert soles
            foot_x = (soles[0] + soles[2]) / 2
            width = round((r - l) * 304 / (b - t))
            body = body.crop(bounds).resize((width, 304), Image.Resampling.LANCZOS)
            x, y = col * 256 + 4, row * 320 + 4
            atlas.paste(body, (x, y))
            frames.append(dict(name=f"{'nurse' if row == 0 else 'cloth'}-{col}",
                               x=x, y=y, w=width, h=304, originX=(foot_x - l) / (r - l), originY=1))
    atlas.save(ROOT / 'nursing.webp', quality=94, method=6)
    (ROOT / 'nursing-frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')


if __name__ == '__main__':
    build()
