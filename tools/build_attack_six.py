"""오른쪽 측면 1·2·3타 6프레임 원화를 게임용 아틀라스로 포장한다. 원화는 고치지 않는다.

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

# 칸마다 (앞발 발끝 x, 발바닥 y, 코등이 (x, y), 칼끝 (x, y)) — 칼이 그려진 원본의 칸 안 픽셀 좌표
SHEETS = [
    dict(prefix='attack', name='attack-side6', shift=[0] * 6, frames=[
        (331, 466, (290, 383), (405, 441)),  # 0 준비: 칼 4시
        (334, 466, (212, 253), (212, 115)),  # 1 예비: 칼 12시
        (319, 466, (217, 220), (133, 121)),  # 2 최대 들어 올림: 칼 11시
        (336, 406, (345, 251), (480, 251)),  # 3 타격: 칼 3시
        (317, 407, (283, 337), (360, 420)),  # 4 내려 베기 마무리: 칼 5시
        (307, 406, (267, 321), (380, 390)),  # 5 복귀
    ]),
    # 2타 상승 베기. 칼을 지운 편집본은 0·2·3·5번 칸의 몸이 원본보다 옆으로 3px 밀려 있어(shift),
    # 원본에서 잰 좌표를 그만큼 옮겨 편집본의 몸에 맞춘다(양수 = 편집본이 원본보다 왼쪽).
    dict(prefix='attack2', name='attack2-side6', shift=[3, 0, -3, 3, 0, -3], frames=[
        (329, 466, (287, 379), (405, 441)),  # 0 시작(1타의 끝): 칼 4시
        (337, 466, (173, 365), (61, 435)),   # 1 낮게 뒤로 당김: 칼 8시
        (335, 466, (333, 375), (450, 447)),  # 2 휘두르기 시작: 칼 4시
        (331, 406, (365, 232), (471, 132)),  # 3 타격(올려 베기): 칼 2시
        (317, 406, (350, 172), (300, 40)),   # 4 마무리: 칼 12시
        (310, 406, (310, 283), (412, 185)),  # 5 자세 정리(3타 시작): 칼 2시
    ]),
    # 3타 찌르기(마무리 일격). 편집본의 밀림은 2타와 같은 칸에 같은 크기다.
    # 앞발이 거의 제자리이고 뒷발이 뒤로 벌어지며 찌른다(게임이 캐릭터를 앞으로 46px 내딛게 한다).
    dict(prefix='attack3', name='attack3-side6', shift=[3, 0, -3, 3, 0, -3], frames=[
        (340, 466, (347, 353), (440, 248)),  # 0 시작(2타의 끝): 칼 2시
        (337, 466, (279, 325), (417, 325)),  # 1 당김: 칼 3시, 빈손은 앞으로 겨눔
        (330, 466, (293, 327), (433, 327)),  # 2 깊이 웅크림: 칼 3시(얼굴 높이)
        (327, 406, (375, 255), (510, 253)),  # 3 찌르기(타격): 칼 3시, 팔을 쭉 뻗음
        (325, 406, (369, 255), (507, 255)),  # 4 유지
        (310, 406, (267, 321), (383, 389)),  # 5 복귀(1타의 시작): 칼 4시
    ]),
]


def build_sheet(sheet_def):
    scale = BODY / SOURCE_BODY
    frames, bodies = [], []
    prefix, name = sheet_def['prefix'], sheet_def['name']
    with Image.open(ROOT / f'{prefix}-side-sword-removed.png') as sheet:
        sheet = sheet.convert('RGBA')
        alpha = sheet.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a)
        sheet.putalpha(alpha)
        for i, ((toe, sole, guard, tip), dx) in enumerate(zip(sheet_def['frames'], sheet_def['shift'])):
            col, row = i % 3, i // 3
            cell = sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            left, top, right, bottom = cell.getchannel('A').getbbox()
            body = cell.crop((left, top, right, bottom))
            w, h = round((right - left) * scale), round((bottom - top) * scale)
            body = body.resize((w, h), Image.Resampling.LANCZOS)
            point = lambda p: dict(x=round((p[0] - dx - left) * scale, 2), y=round((p[1] - top) * scale, 2))
            foot = point((toe - FOOT_BACK, sole))
            bodies.append(body)
            frames.append(dict(name=f'{name}-{i}', texture=f'hero-academy-{name}', w=w, h=h,
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
    atlas.save(ROOT / f'{prefix}-side.webp', quality=92, method=6)
    (ROOT / f'{prefix}-side_frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{name}: {len(frames)} frames, atlas {width}x{height}')


def build():
    for sheet_def in SHEETS:
        build_sheet(sheet_def)


if __name__ == '__main__':
    build()
