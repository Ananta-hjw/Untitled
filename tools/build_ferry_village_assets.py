"""물안개 나루(2장) 건물·소품 원화를 게임용 WebP로 나눈다. 원화는 고치지 않는다.

원본: src/assets/maps/ferry-village/buildings/<이름>.png (1536×1024 투명, 건물 하나씩)
      src/assets/maps/ferry-village/props.png (1536×768 투명, 384px 칸 4열×2행)
출력: src/assets/maps/ferry-village/objects/<이름>.webp, objects.json (크기와 원본에서 잘라 낸 영역)

그림마다 거의 투명한 번짐을 빼고 실제 그림 영역만 잘라(가장자리 4px 여유) 긴 변을 줄인다.
게임에서의 표시 크기·발 위치·충돌은 src/world/ferryVillage.ts가 정한다.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/maps/ferry-village'
OUT = ROOT / 'objects'
BUILDINGS = ['inn', 'marta-smithy', 'morgan-warehouse', 'watchtower', 'evan-cottage', 'watermill',
             'fisherman-house', 'herbalist-shop', 'village-house-a', 'village-house-b']
# props.png 칸 순서(왼쪽 위부터): 작은 배, 나룻배, 상자와 통, 그물 건조대 / 갈대, 계류 기둥, 등불 기둥, 우물
PROPS = ['rowboat', 'ferry-boat', 'crates', 'net-rack', 'reeds', 'mooring-post', 'lamp-post', 'well']
PROP_CELL = 384
BUILDING_LIMIT = 1024
PROP_LIMIT = 320
ALPHA_FLOOR = 24
PAD = 4


def trim(image: Image.Image, limit: int, name: str):
    alpha = image.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a)
    image.putalpha(alpha)
    box = alpha.getbbox()
    assert box is not None, name
    l, t, r, b = box
    assert l > 0 and t > 0 and r < image.width and b < image.height, f'{name}: 그림이 칸 가장자리에 닿았다'
    crop = (max(0, l - PAD), max(0, t - PAD), min(image.width, r + PAD), min(image.height, b + PAD))
    out = image.crop(crop)
    out.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    return out, crop


def main():
    OUT.mkdir(exist_ok=True)
    objects = {}
    for name in BUILDINGS:
        with Image.open(ROOT / 'buildings' / f'{name}.png') as source:
            image, crop = trim(source.convert('RGBA'), BUILDING_LIMIT, name)
        image.save(OUT / f'{name}.webp', quality=90, method=6)
        objects[name] = {'file': f'objects/{name}.webp', 'width': image.width, 'height': image.height, 'sourceCrop': list(crop)}
    with Image.open(ROOT / 'props.png') as source:
        sheet = source.convert('RGBA')
    for i, name in enumerate(PROPS):
        col, row = i % 4, i // 4
        cell = sheet.crop((col * PROP_CELL, row * PROP_CELL, (col + 1) * PROP_CELL, (row + 1) * PROP_CELL))
        image, crop = trim(cell, PROP_LIMIT, name)
        image.save(OUT / f'{name}.webp', quality=90, method=6)
        objects[name] = {'file': f'objects/{name}.webp', 'width': image.width, 'height': image.height,
                         'sourceCrop': [crop[0] + col * PROP_CELL, crop[1] + row * PROP_CELL,
                                        crop[2] + col * PROP_CELL, crop[3] + row * PROP_CELL]}
    (ROOT / 'objects.json').write_text(json.dumps(objects, indent=2) + '\n')
    print(f'물안개 나루: 건물 {len(BUILDINGS)}개, 소품 {len(PROPS)}개')


if __name__ == '__main__':
    main()
