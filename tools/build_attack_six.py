"""오른쪽 측면·정면 1·2·3타 6프레임 원화를 게임용 아틀라스로 포장한다. 원화는 고치지 않는다.

몸: src/assets/hero/academy/attack-six/<공격>-<side|front>-sword-removed.png (칼을 지운 편집본, 512×512 칸, 3열×2행)
기준: <공격>-<side|front>-source.png (칼이 그려진 원본)
출력: <공격>-<side|front>.webp, <공격>-<side|front>_frames.json (같은 폴더)

칼은 장착 무기 레이어로 그린다. 아래에서 칼이 그려진 원본을 보고 칸마다 잰 코등이(base)·칼끝(tip)에
무기 그림을 놓고, 같은 좌표로 명중 판정과 검기를 계산한다.
발 기준점은 디딘 앞발의 발끝에서 일정 거리 뒤(FOOT_BACK)로 잡아, 앞발이 미끄러지지 않고
뒷발만 벌어지는 것처럼 보이게 한다.
"""
import json
import math
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
    # 2타 상승 베기. 칼을 지운 편집본은 0·3·5번 칸의 몸이 원본보다 옆으로 3px 밀려 있어(shift),
    # 원본에서 잰 좌표를 그만큼 옮겨 편집본의 몸에 맞춘다(양수 = 편집본이 원본보다 왼쪽).
    # 2번 칸은 다시 그린 자세(낮게 웅크리고 주먹을 무릎 높이로, 칼 5시)라 편집본도 원본과 같은 자리에 있다.
    dict(prefix='attack2', name='attack2-side6', shift=[3, 0, 0, 3, 0, -3], frames=[
        (329, 466, (287, 379), (405, 441)),  # 0 시작(1타의 끝): 칼 4시
        (337, 466, (173, 365), (61, 435)),   # 1 낮게 뒤로 당김: 칼 8시
        (317, 465, (285, 391), (393, 461)),  # 2 휘두르기 시작: 낮게 웅크리고 칼 4~5시
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

# 정면(아래 방향) 1·2·3타. 원본과 칼 지운 편집본의 몸이 픽셀 단위로 같아, 코등이·칼끝은 두 그림의 차이(칼)에서
# 잰 값이다. 발 기준점은 디딘 채 움직이지 않는 발(화면 오른쪽, 캐릭터의 왼발)의 바깥 끝에서 FRONT_FOOT 안쪽이다
# (1타 첫 칸에서 두 발 가운데). 내딛는 발은 화면 쪽(아래)으로 나간다.
FRONT_FOOT = 76


def toward(guard, tip, length):
    """화면 쪽으로 겨눈 칼: 그림 속 칼은 원근으로 아주 짧게(60px) 그려져 있어, 같은 방향으로 길이만 정한다."""
    dx, dy = tip[0] - guard[0], tip[1] - guard[1]
    k = length / math.hypot(dx, dy)
    return (guard[0] + dx * k, guard[1] + dy * k)


# 정면 원화의 칼은 옆모습보다 짧게(약 100px) 그려졌다. 칼은 장착 무기 레이어라 길이를 정할 수 있으므로,
# 방향을 바꿔도 칼 크기가 같도록 옆모습 칼 길이(약 135px)로 맞춘다(방향은 원화 그대로).
FRONT_BLADE = 135


def front(outer: int, sole: int, guard, tip, length: float = FRONT_BLADE):
    return (outer - FRONT_FOOT, sole, guard, toward(guard, tip, length))


SHEETS += [
    dict(prefix='attack1', view='front', name='attack-front6', shift=[0] * 6, frames=[
        front(323, 465, (203, 379), (149, 463)),  # 0 준비: 칼 7시
        front(323, 465, (205, 260), (205, 144)),  # 1 예비: 머리 옆, 칼 12시
        front(323, 465, (196, 247), (130, 166)),  # 2 최대 들어 올림: 칼 10~11시
        front(323, 465, (272, 354), (348, 420)),  # 3 타격: 칼 4~5시, 왼발을 화면 쪽으로 내디딤
        front(323, 465, (294, 373), (346, 452)),  # 4 마무리: 칼 5시
        front(323, 461, (307, 365), (394, 417)),  # 5 복귀(2타의 시작): 주먹은 화면 오른쪽 옆
    ]),
    dict(prefix='attack2', view='front', name='attack2-front6', shift=[0] * 6, perspective={5: 'down'}, frames=[
        front(323, 460, (307, 364), (394, 416)),  # 0 시작(1타의 끝), 원화가 1px 위에 정렬됨
        front(326, 465, (280, 402), (369, 452)),  # 1 낮게 당김: 칼 4~5시
        front(327, 465, (237, 358), (237, 443)),  # 2 휘두르기 시작: 칼 6시
        front(326, 466, (197, 297), (106, 217)),  # 3 타격(올려 베기): 칼 10시
        front(326, 465, (185, 247), (146, 134)),  # 4 마무리: 칼 11~12시
        front(326, 465, (247, 345), (247, 426), 81),  # 5 자세 정리(3타의 시작): 칼 6시
    ]),
    # 3타 찌르기: 시작부터 유지까지(0~4번) 화면 쪽을 겨누는 원근 무기 그림('down')을 쓴다.
    dict(prefix='attack3', view='front', name='attack3-front6', shift=[0] * 6,
         perspective=dict.fromkeys(range(5), 'down'), frames=[
        front(326, 465, (247, 345), (247, 426), 81),  # 0 시작(2타의 끝): 칼 6시
        front(326, 465, (214, 339), (215, 399), 75),  # 1 당김
        front(333, 465, (225, 358), (226, 418), 75),  # 2 깊이 웅크림
        front(328, 465, (249, 373), (249, 437), 100), # 3 찌르기(타격): 낮게 내딛는 최신 원화
        front(327, 466, (248, 381), (247, 441), 100), # 4 유지
        front(323, 465, (203, 379), (149, 463)),                          # 5 복귀(1타의 시작): 칼 7시
    ]),
]


def build_sheet(sheet_def):
    scale = BODY / SOURCE_BODY
    frames, bodies = [], []
    prefix, name = sheet_def['prefix'], sheet_def['name']
    view = sheet_def.get('view', 'side')
    perspective = sheet_def.get('perspective', {})
    with Image.open(ROOT / f'{prefix}-{view}-sword-removed.png') as sheet:
        sheet = sheet.convert('RGBA')
        alpha = sheet.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a)
        sheet.putalpha(alpha)
        for i, ((foot_x, sole, guard, tip), dx) in enumerate(zip(sheet_def['frames'], sheet_def['shift'])):
            col, row = i % 3, i // 3
            cell = sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            left, top, right, bottom = cell.getchannel('A').getbbox()
            body = cell.crop((left, top, right, bottom))
            w, h = round((right - left) * scale), round((bottom - top) * scale)
            body = body.resize((w, h), Image.Resampling.LANCZOS)
            point = lambda p: dict(x=round((p[0] - dx - left) * scale, 2), y=round((p[1] - top) * scale, 2))
            # 옆모습은 앞발 발끝에서 FOOT_BACK 뒤, 정면은 표에 적은 발 기준점을 그대로 쓴다
            foot = point((foot_x - FOOT_BACK if view == 'side' else foot_x, sole))
            bodies.append(body)
            frame = dict(name=f'{name}-{i}', texture=f'hero-academy-{name}', w=w, h=h,
                         originX=round(foot['x'] / w, 5), originY=round(foot['y'] / h, 5), scale=1,
                         blade=dict(base=point(guard), tip=point(tip)))
            if i in perspective:
                frame['weaponPerspective'] = perspective[i]
            frames.append(frame)
    pad = 4
    width = sum(b.width + pad for b in bodies) + pad
    height = max(b.height for b in bodies) + pad * 2
    atlas = Image.new('RGBA', (width, height))
    x = pad
    for body, frame in zip(bodies, frames):
        atlas.paste(body, (x, pad))
        frame['x'], frame['y'] = x, pad
        x += body.width + pad
    atlas.save(ROOT / f'{prefix}-{view}.webp', quality=92, method=6)
    (ROOT / f'{prefix}-{view}_frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{name}: {len(frames)} frames, atlas {width}x{height}')


def build():
    for sheet_def in SHEETS:
        build_sheet(sheet_def)


if __name__ == '__main__':
    build()
