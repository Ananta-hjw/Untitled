"""안개 환영의 등장(materialize)·쓰러짐(dissipate) 원화를 게임용 한 장으로 묶는다. 원화는 고치지 않는다.

원본: src/assets/monsters/mist-phantom/materialize-source.png, dissipate-source.png
      (1536×384 투명, 384px 칸 4개. 오른쪽 아래를 보는 몸이 칸마다 같은 자리에 그려져 있다)
출력: src/assets/monsters/mist-phantom/fade.webp (192px 칸 8개: materialize-0..3, dissipate-0..3)
      fade-frames.json (칸 크기, 기준점, 온몸 높이)

기준점은 온몸이 다 보이는 칸(materialize-3)의 그림 아래 가운데이고, 여덟 칸 모두 같은 자리를 쓴다.
게임(combat/MonsterSprite.ts)은 온몸 높이를 걷기 그림의 오른쪽 아래 정지 자세 높이에 맞춰 그린다.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/monsters/mist-phantom'
CELL = 384
SCALE = 0.5
ALPHA_FLOOR = 24
SHEETS = ['materialize', 'dissipate']


def main():
    cells = []
    for name in SHEETS:
        with Image.open(ROOT / f'{name}-source.png') as source:
            sheet = source.convert('RGBA')
        sheet.putalpha(sheet.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a))
        for i in range(4):
            cells.append((f'{name}-{i}', sheet.crop((i * CELL, 0, (i + 1) * CELL, CELL))))
    body = dict(cells)['materialize-3'].getchannel('A').getbbox()
    pivot = ((body[0] + body[2]) / 2, body[3])
    size = round(CELL * SCALE)
    atlas = Image.new('RGBA', (size * len(cells), size))
    for i, (_, cell) in enumerate(cells):
        atlas.paste(cell.resize((size, size), Image.Resampling.LANCZOS), (i * size, 0))
    atlas.save(ROOT / 'fade.webp', quality=90, method=6)
    data = {
        'cell': size,
        'frames': [name for name, _ in cells],
        'originX': round(pivot[0] / CELL, 5),
        'originY': round(pivot[1] / CELL, 5),
        # 온몸이 보이는 칸의 그림 높이(fade.webp 픽셀)
        'bodyHeight': round((body[3] - body[1]) * SCALE, 2),
        # 원화는 오른쪽 아래를 본다. 왼쪽을 볼 때는 뒤집는다.
        'facing': 'down-right',
    }
    (ROOT / 'fade-frames.json').write_text(json.dumps(data, indent=2) + '\n')
    print('안개 환영 등장·쓰러짐:', len(cells), '칸', data)


if __name__ == '__main__':
    main()
