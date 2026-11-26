"""Pack Serena's generated nursing and water-cloth cycles, preserving the source artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/characters/serena'


def build():
    atlas = Image.new('RGBA', (1024, 640))
    frames = []
    with Image.open(ROOT / 'nursing-source.png') as source:
        # 두 행 사이의 투명 빈 줄을 찾아 정확히 분할한다 (절반 고정 분할 시 2행 정수리가 1행 바닥에 잘려 붙는 문제 방지).
        full_alpha = source.getchannel('A').point(lambda a: 255 if a >= 8 else 0)
        mid = source.height // 2
        empty_rows = [
            y for y in range(mid - 80, mid + 80)
            if full_alpha.crop((0, y, source.width, y + 1)).getbbox() is None
        ]
        assert empty_rows, '두 행 사이의 빈 간격을 찾지 못했습니다'
        split_y = (empty_rows[0] + empty_rows[-1]) // 2
        row_bounds = [(0, split_y), (split_y, source.height)]
        for i in range(8):
            col, row = i % 4, i // 4
            top_y, bottom_y = row_bounds[row]
            body = source.crop((round(col * source.width / 4), top_y,
                                round((col + 1) * source.width / 4), bottom_y))
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
