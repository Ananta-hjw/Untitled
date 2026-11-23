"""Crop and pack generated recovery poses; retain the original PNG artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/linea'


def build():
    atlas = Image.new('RGBA', (1536, 768))
    frames = []
    for i, name in enumerate(['unconscious', 'awake', 'journal']):
        with Image.open(ROOT / ('clinic-rest-source.png' if i < 2 else 'home-rest-source.png')) as source:
            body = source.crop((0, i * source.height // 2, source.width, (i + 1) * source.height // 2)) if i < 2 else source.copy()
            bounds = body.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
            assert bounds
            body = body.crop(bounds)
            ratio = (512 / body.width) if i < 2 else (640 / body.height)
            body = body.resize((round(body.width * ratio), round(body.height * ratio)), Image.Resampling.LANCZOS)
            x, y = i * 512 + (512 - body.width) // 2, 4
            atlas.paste(body, (x, y))
            frames.append(dict(name=name, x=x, y=y, w=body.width, h=body.height,
                               originX=.5, originY=.5 if i < 2 else 1))
    atlas.save(ROOT / 'recovery.webp', quality=94, method=6)
    (ROOT / 'recovery-frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')


if __name__ == '__main__':
    build()
