"""오른쪽 측면 1타 6프레임 원화를 게임용 아틀라스로 포장한다. 원화는 고치지 않는다.

몸: src/assets/hero/academy/attack-six/attack-side-sword-removed.png (칼을 지운 편집본, 512×512 칸, 3열×2행)
기준: attack-side-source.png (칼이 그려진 원본. 두 그림의 몸 위치는 픽셀 단위로 같다)
출력: attack-side.webp, attack-side_frames.json (같은 폴더)

칼은 장착 무기 레이어로 그린다. 아래에서 칼이 그려진 원본을 보고 칸마다 잰 코등이(base)·칼끝(tip)에
무기 그림을 놓고, 같은 좌표로 명중 판정과 검기를 계산한다.
발 기준점은 디딘 앞발의 발끝에서 일정 거리 뒤(FOOT_BACK)로 잡아, 앞발이 미끄러지지 않고
뒷발만 벌어지는 것처럼 보이게 한다.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/attack-six'
CELL = 512
BODY = 304          # 게임 몸 높이(다른 시트와 같음)
SOURCE_BODY = 310   # 원화의 발바닥~머리끝 높이(6칸 거의 같음)
FOOT_BACK = 68      # 앞발 발끝에서 발 기준점까지 (1번 칸에서 두 발 가운데)
ALPHA_FLOOR = 24    # 생성 도구가 남긴 거의 투명한 번짐은 지운다

# 칸마다 (앞발 발끝 x, 발바닥 y, 코등이 (x, y), 칼끝 (x, y)) — 칸 안 픽셀 좌표
FRAMES = [
    (331, 466, (290, 383), (405, 441)),  # 0 준비: 칼 4시
    (334, 466, (212, 253), (212, 115)),  # 1 예비: 칼 12시
    (319, 466, (217, 220), (133, 121)),  # 2 최대 들어 올림: 칼 11시
    (336, 406, (345, 251), (480, 251)),  # 3 타격: 칼 3시
    (317, 407, (283, 337), (360, 420)),  # 4 내려 베기 마무리: 칼 5시
    (307, 406, (267, 321), (380, 390)),  # 5 복귀
]


def build():
    scale = BODY / SOURCE_BODY
    frames, bodies = [], []
    with Image.open(ROOT / 'attack-side-sword-removed.png') as sheet:
        sheet = sheet.convert('RGBA')
        alpha = sheet.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a)
        sheet.putalpha(alpha)
        for i, (toe, sole, guard, tip) in enumerate(FRAMES):
            col, row = i % 3, i // 3
            cell = sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            left, top, right, bottom = cell.getchannel('A').getbbox()
            body = cell.crop((left, top, right, bottom))
            w, h = round((right - left) * scale), round((bottom - top) * scale)
            body = body.resize((w, h), Image.Resampling.LANCZOS)
            point = lambda p: dict(x=round((p[0] - left) * scale, 2), y=round((p[1] - top) * scale, 2))
            foot = point((toe - FOOT_BACK, sole))
            bodies.append(body)
            frames.append(dict(name=f'attack-side6-{i}', texture='hero-academy-attack-side6', w=w, h=h,
                               originX=round(foot['x'] / w, 5), originY=round(foot['y'] / h, 5), scale=1,
                               blade=dict(base=point(guard), tip=point(tip))))
    pad = 4
    width = sum(b.width + pad for b in bodies) + pad
    height = max(b.height for b in bodies) + pad * 2
    atlas = Image.new('RGBA', (width, height))
    x = pad
    for body, frame in zip(bodies, frames):
        atlas.paste(body, (x, pad))
        frame['x'], frame['y'] = x, pad
        x += body.width + pad
    atlas.save(ROOT / 'attack-side.webp', quality=92, method=6)
    (ROOT / 'attack-side_frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{len(frames)} frames, atlas {width}x{height}')


if __name__ == '__main__':
    build()
