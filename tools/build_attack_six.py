"""6프레임 공격 원화를 게임용 아틀라스로 포장한다. 원화는 고치지 않는다.

몸: src/assets/hero/academy/attack-six/<공격>-<시점>-sword-removed.png (칼을 지운 편집본, 512×512 칸, 3열×2행)
기준: <공격>-<시점>-source.png (칼이 그려진 원본)
출력: <공격>-<시점>.webp, <공격>-<시점>_frames.json (같은 폴더)

칼은 장착 무기 레이어로 그린다. 아래에서 칼이 그려진 원본을 보고 칸마다 잰 코등이(base)·칼끝(tip)에
무기 그림을 놓고, 같은 좌표로 명중 판정과 검기를 계산한다.
발 기준점은 디딘 앞발의 발끝에서 일정 거리 뒤(FOOT_BACK)로 잡아, 앞발이 미끄러지지 않고
뒷발만 벌어지는 것처럼 보이게 한다.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/hero/academy/attack-six'
CELL = 512
BODY = 304          # 게임 몸 높이(다른 시트와 같음)
SOURCE_BODY = 310   # 원화의 발바닥~머리끝 높이(6칸 거의 같음)
FOOT_BACK = 68      # 앞발 발끝에서 발 기준점까지 (1번 칸에서 두 발 가운데)
ALPHA_FLOOR = 24    # 생성 도구가 남긴 거의 투명한 번짐은 지운다

# 정면·옆모습·위쪽 원화의 칼 길이를 통일한다(방향은 원화 그대로).
FRONT_BLADE = 135


def toward(guard, tip, length):
    """원화에서 잰 방향으로 칼 길이만 맞춘다(원근 칼은 짧게, 일반 칼은 일정 길이로)."""
    dx, dy = tip[0] - guard[0], tip[1] - guard[1]
    k = length / math.hypot(dx, dy)
    return (guard[0] + dx * k, guard[1] + dy * k)


def side(foot_x: int, sole: int, guard, tip, length: float = FRONT_BLADE):
    return (foot_x, sole, guard, toward(guard, tip, length))


# 칸마다 (앞발 발끝 x, 발바닥 y, 코등이 (x, y), 칼끝 (x, y)) — 칼이 그려진 원본의 칸 안 픽셀 좌표
SHEETS = [
    dict(prefix='attack', name='attack-side6', shift=[0] * 6, grip_covers={
        1: [(203, 260), (216, 260), (221, 267), (220, 290), (215, 298), (203, 297), (198, 289), (198, 269)],
        2: [(215, 239), (226, 238), (233, 243), (235, 258), (231, 269), (224, 273), (211, 269), (208, 259), (209, 246)],
    }, frames=[
        side(331, 466, (290, 383), (405, 441)),       # 0 준비: 칼 4시
        side(334, 466, (210, 250), (210, 112)),       # 1 예비: 칼 12시
        side(319, 466, (211, 238), (129, 139)),       # 2 최대 들어 올림: 칼 11시 (코등이 주먹 밀착)
        side(336, 406, (345, 251), (480, 251)),       # 3 타격: 칼 3시
        side(317, 407, (283, 337), (360, 420), 124),  # 4 내려 베기 마무리: 칼 5시
        side(307, 406, (267, 321), (380, 390)),       # 5 복귀
    ]),
    # 2타 상승 베기. 칼을 지운 편집본은 0·3·5번 칸의 몸이 원본보다 옆으로 3px 밀려 있어(shift),
    # 원본에서 잰 좌표를 그만큼 옮겨 편집본의 몸에 맞춘다(양수 = 편집본이 원본보다 왼쪽).
    # 2번 칸은 다시 그린 자세(낮게 웅크리고 주먹을 무릎 높이로, 칼 5시)라 편집본도 원본과 같은 자리에 있다.
    dict(prefix='attack2', name='attack2-side6', shift=[3, 0, 0, 3, 0, -3], frames=[
        side(329, 466, (287, 379), (405, 441)),       # 0 시작(1타의 끝): 칼 4시
        side(337, 466, (173, 365), (61, 435)),        # 1 낮게 뒤로 당김: 칼 8시
        side(317, 465, (285, 391), (393, 461), 130),  # 2 휘두르기 시작: 낮게 웅크리고 칼 4~5시
        side(331, 406, (365, 232), (471, 132)),       # 3 타격(올려 베기): 칼 2시
        side(317, 406, (342, 171), (292, 39)),        # 4 마무리: 칼 12시 (코등이 주먹 중앙 정렬)
        side(310, 406, (310, 283), (412, 185)),       # 5 자세 정리(3타 시작): 칼 2시
    ]),
    # 3타 찌르기(마무리 일격). 0번 칸은 2타 마지막(5번)과 동일 자세로 통일해 주먹·칼 이탈과 튐을 없앴다.
    # 앞발이 거의 제자리이고 뒷발이 뒤로 벌어지며 찌른다(게임이 캐릭터를 앞으로 46px 내딛게 한다).
    dict(prefix='attack3', name='attack3-side6', shift=[0, 0, -3, 3, 0, -3], frames=[
        side(313, 466, (313, 343), (415, 245)),       # 0 시작(2타의 끝과 동일): 칼 2시
        side(337, 466, (279, 325), (417, 325)),       # 1 당김: 칼 3시, 빈손은 앞으로 겨눔
        side(330, 466, (293, 327), (433, 327)),       # 2 깊이 웅크림: 칼 3시(얼굴 높이)
        side(327, 406, (375, 255), (510, 253)),       # 3 찌르기(타격): 칼 3시, 팔을 쭉 뻗음
        side(325, 406, (369, 255), (507, 255)),       # 4 유지
        side(310, 406, (267, 321), (383, 389)),       # 5 복귀(1타의 시작): 칼 4시
    ]),
]

# 정면(아래 방향) 1·2·3타. 원본과 칼 지운 편집본의 몸이 픽셀 단위로 같아, 코등이·칼끝은 두 그림의 차이(칼)에서
# 잰 값이다. 발 기준점은 디딘 채 움직이지 않는 발(화면 오른쪽, 캐릭터의 왼발)의 바깥 끝에서 FRONT_FOOT 안쪽이다
# (1타 첫 칸에서 두 발 가운데). 내딛는 발은 화면 쪽(아래)으로 나간다.
FRONT_FOOT = 76


def front(outer: int, sole: int, guard, tip, length: float = FRONT_BLADE):
    return (outer - FRONT_FOOT, sole, guard, toward(guard, tip, length))


FRONT_SETTLE_GRIP_COVER = [(230, 308), (255, 307), (263, 318), (262, 336), (253, 343), (233, 343), (224, 334), (224, 318)]

SHEETS += [
    dict(prefix='attack1', view='front', name='attack-front6', shift=[0] * 6, grip_covers={
        1: [(197, 260), (209, 260), (215, 268), (215, 286), (209, 294), (196, 293), (191, 284), (191, 268)],
        2: [(192, 243), (205, 244), (210, 253), (210, 268), (203, 276), (190, 275), (185, 266), (186, 251)],
    }, frames=[
        front(323, 465, (203, 379), (149, 463), 104),  # 0 준비: 칼 7시 (바닥선 안쪽 유지)
        front(323, 465, (205, 259), (205, 144)),       # 1 예비: 머리 옆, 칼 12시
        front(323, 465, (194, 245), (128, 164)),       # 2 최대 들어 올림: 칼 10~11시
        front(323, 465, (272, 354), (348, 420)),       # 3 타격: 칼 4~5시, 왼발을 화면 쪽으로 내디딤
        front(323, 465, (294, 373), (346, 452), 112),  # 4 마무리: 칼 5시 (바닥선 안쪽 유지)
        front(323, 461, (307, 365), (394, 417), 125),  # 5 복귀(2타의 시작): 주먹은 화면 오른쪽 옆
    ]),
    dict(prefix='attack2', view='front', name='attack2-front6', shift=[0] * 6, perspective={2: 'down', 5: 'down'}, grip_covers={
        3: [(196, 282), (211, 285), (220, 296), (218, 312), (207, 318), (194, 313), (184, 302), (184, 291)],
        4: [(181, 246), (193, 247), (200, 260), (201, 277), (192, 286), (180, 283), (172, 272), (171, 256)],
        5: FRONT_SETTLE_GRIP_COVER,
    }, frames=[
        front(323, 460, (307, 364), (394, 416), 125),  # 0 시작(1타의 끝), 원화가 1px 위에 정렬됨
        front(326, 465, (280, 402), (369, 452), 118),  # 1 낮게 당김: 칼 4~5시
        front(327, 465, (237, 356), (237, 444), 88),   # 2 휘두르기 시작: 칼 6시 원근 (바닥 뚫림 방지)
        front(326, 466, (193, 290), (102, 210)),       # 3 타격(올려 베기): 칼 10시
        front(326, 465, (183, 247), (144, 134)),       # 4 마무리: 칼 11~12시
        front(326, 465, (247, 342), (247, 423), 81),   # 5 자세 정리(3타의 시작): 칼 6시
    ]),
    # 3타 찌르기: 시작부터 유지까지(0~4번) 화면 쪽을 겨누는 원근 무기 그림('down')을 쓴다.
    dict(prefix='attack3', view='front', name='attack3-front6', shift=[0] * 6,
         perspective=dict.fromkeys(range(5), 'down'), grip_covers={0: FRONT_SETTLE_GRIP_COVER}, frames=[
        front(326, 465, (247, 342), (247, 423), 81),   # 0 시작(2타의 끝): 칼 6시
        front(332, 465, (214, 336), (215, 396), 75),   # 1 당김 (중심선·코등이 밀착 보정)
        front(333, 465, (225, 354), (226, 414), 75),   # 2 깊이 웅크림 (코등이 밀착 보정)
        front(328, 465, (249, 369), (249, 433), 100),  # 3 찌르기(타격): 낮게 내딛는 최신 원화
        front(327, 466, (248, 376), (247, 436), 100),  # 4 유지
        front(323, 465, (203, 379), (149, 463), 104),  # 5 복귀(1타의 시작): 칼 7시
    ]),
]


# 위쪽(뒷모습) 1·2·3타. 원본과 칼 지운 편집본의 몸이 픽셀 단위로 같아, 코등이(금색 고리의 가운데)·칼끝은 두 그림의
# 차이(칼)에서 잰 값이다. 발 기준점은 6칸 내내 디딘 왼발(화면 왼쪽)의 바깥 끝에서 BACK_FOOT 안쪽이다
# (1타 첫 칸에서 두 발 가운데). 내딛는 오른발은 화면 위쪽(먼 곳)으로 나간다.
# 원화의 칼은 100~119px로 그려져 옆모습 길이(135px)로 늘린다(방향은 원화 그대로).
# 3타의 당김·웅크림·찌르기·유지(1~4번)는 먼 곳을 겨눈 칼이라 원근 무기 그림('up')을 쓰고, 길이를 정면 3타처럼 75·100px로 둔다.
BACK_FOOT = 70


def back(outer: int, sole: int, guard, tip, length: float = FRONT_BLADE):
    return (outer + BACK_FOOT, sole, guard, toward(guard, tip, length))


SHEETS += [
    dict(prefix='attack1', view='back', name='attack-back6', shift=[0] * 6, frames=[
        back(183, 451, (332, 293), (388, 195)),  # 0 준비: 칼 1시
        back(181, 451, (333, 248), (381, 156)),  # 1 예비: 오른쪽 어깨로 당김
        back(181, 450, (343, 235), (420, 172)),  # 2 들어 올림
        back(182, 450, (218, 145), (148, 69)),   # 3 타격: 머리 위를 넘어 11시
        back(181, 449, (152, 365), (70, 447)),   # 4 마무리: 왼쪽 아래 7~8시
        back(180, 451, (152, 362), (48, 420)),   # 5 복귀(2타의 시작): 왼쪽 허리 아래 8시
    ]),
    dict(prefix='attack2', view='back', name='attack2-back6', shift=[0] * 6, frames=[
        back(180, 451, (152, 362), (48, 420)),   # 0 시작(1타의 끝)
        back(178, 450, (158, 373), (92, 456)),   # 1 낮게 감아 들임: 칼 7시
        back(179, 450, (155, 333), (54, 333)),   # 2 올리기 시작: 칼 9시
        back(180, 450, (349, 175), (423, 83)),   # 3 타격(올려 베기): 칼 1~2시
        back(180, 450, (318, 153), (352, 45)),   # 4 마무리: 칼 12시 (코등이 주먹 상단 밀착)
        back(179, 451, (319, 238), (371, 141)),  # 5 자세 정리(3타의 시작): 칼 1시
    ]),
    dict(prefix='attack3', view='back', name='attack3-back6', shift=[0] * 6,
         perspective=dict.fromkeys(range(1, 5), 'up'), frames=[
        back(179, 451, (319, 238), (371, 141)),       # 0 시작(2타의 끝): 칼 1시
        back(148, 451, (292, 279), (291, 212), 75),   # 1 당김: 중심선 정렬·코등이 주먹 상단 정렬
        back(149, 451, (295, 303), (295, 235), 75),   # 2 깊이 웅크림: 중심선 정렬·코등이 주먹 상단 정렬
        back(180, 450, (316, 184), (316, 113), 100),  # 3 찌르기(타격): 코등이 주먹 상단 정렬
        back(180, 450, (316, 185), (316, 112), 100),  # 4 유지: 코등이 주먹 상단 정렬
        back(183, 451, (332, 293), (388, 195)),       # 5 복귀(1타의 시작): 칼 1시
    ]),
]


# 앞대각선 1타. 디딘 발을 (318, 450)에 맞춘 6칸 모두 같은 피벗을 쓴다.
SHEETS.append(dict(prefix='attack1', view='down-diag', name='attack-down-diag6', shift=[0] * 6, grip_covers={
    0: [(218, 321), (230, 320), (242, 324), (249, 330), (249, 340), (241, 349), (229, 351), (219, 344), (215, 333)],
    1: [(184, 239), (199, 239), (204, 247), (204, 261), (201, 269), (191, 270), (182, 263), (180, 250)],
    2: [(180, 191), (191, 190), (198, 193), (201, 199), (198, 209), (196, 220), (191, 228), (180, 227), (173, 218), (172, 207), (175, 197)],
    3: [(308, 284), (327, 282), (339, 286), (347, 294), (347, 304), (337, 313), (324, 315), (310, 308), (304, 297)],
    4: [(263, 348), (276, 348), (286, 357), (292, 368), (287, 380), (277, 383), (265, 378), (258, 366)],
    5: [(215, 320), (227, 320), (239, 323), (247, 329), (247, 340), (239, 349), (227, 350), (216, 344), (212, 331)],
}, frames=[
    (232, 450, guard, toward(guard, tip, 135))
    for guard, tip in [
        ((247, 344), (363, 413)),  # 준비, 4시
        ((192, 237), (192, 102)),  # 예비, 12시
        ((176, 198), (81, 103)),  # 팔꿈치를 굽혀 머리 옆으로 들어 올림, 10시 반
        ((337, 304), (454, 372)),  # 타격, 4시
        ((284, 374), (379, 469)),  # 마무리, 4시 반
        ((244, 343), (360, 412)),  # 복귀, 4시
    ]
]))



def grip_capsule(guard, pommel, radius=12, gap=3, past_pommel=8):
    """주먹 마스크: 원화에서 코등이와 칼자루 끝 사이의 손잡이는 주먹에 가려 보이지 않으므로, 그 사이를 덮는 캡슐을 쓴다.
    코등이 쪽은 gap만큼 비워 무기의 코등이는 보이게 하고, 칼자루 끝 쪽은 past_pommel만큼 더 덮는다.
    무기 레이어의 손잡이가 원화의 칼자루 끝보다 조금 길어, 덮지 않으면 손목 위로 검은 손잡이가 삐져나온다.
    덮개는 칼 지운 편집본의 픽셀이라 그 자리가 투명하면(몸 밖) 무기가 그대로 보인다."""
    dx, dy = pommel[0] - guard[0], pommel[1] - guard[1]
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    a = (guard[0] + ux * gap, guard[1] + uy * gap)
    b = (pommel[0] + ux * past_pommel, pommel[1] + uy * past_pommel)
    angle = math.atan2(uy, ux)
    points = []
    for center, start in ((b, angle - math.pi / 2), (a, angle + math.pi / 2)):
        for step in range(7):
            t = start + math.pi * step / 6
            points.append((round(center[0] + radius * math.cos(t)), round(center[1] + radius * math.sin(t))))
    return points


def down_diag(prefix, name, poses):
    """앞대각선 2·3타: 1타와 같은 발 기준점(디딘 앞발)과 칼 길이(135px). poses는 칸마다 (코등이, 칼끝, 칼자루 끝)이며
    원본과 칼 지운 편집본의 차이(칼)에서 잰 값이다(코등이 = 금색 픽셀의 가운데, 칼끝 = 코등이에서 가장 먼 칼 픽셀)."""
    return dict(prefix=prefix, view='down-diag', name=name, shift=[0] * 6,
                grip_covers={i: grip_capsule(guard, pommel) for i, (guard, _, pommel) in enumerate(poses)},
                frames=[(232, 450, guard, toward(guard, tip, 135)) for guard, tip, _ in poses])


SHEETS += [
    # 2타 올려 베기: 4시 → 뒷발 옆 낮게 7~8시 → 앞 아래 4시 반 → 2시 → 머리 위 12~1시 → 2~3시(3타 시작)
    down_diag('attack2', 'attack2-down-diag6', [
        ((245, 340), (359, 411), (207, 321)),  # 시작(1타의 끝), 4시
        ((110, 355), (11, 447), (138, 326)),   # 낮게 뒤로 당김, 7시 반
        ((232, 374), (326, 469), (201, 344)),  # 낮게 웅크림, 4시 반
        ((346, 236), (469, 182), (309, 254)),  # 올려 베기(타격), 2시
        ((293, 176), (333, 47), (283, 216)),   # 마무리, 12시 반
        ((315, 264), (445, 231), (276, 276)),  # 자세 정리(3타 시작), 2시 반
    ]),
    # 3타 찌르기: 2시 반 → 가슴 높이로 당김 4시 → 웅크림 → 찌르기 4시 → 유지 → 1타 시작(4시)
    down_diag('attack3', 'attack3-down-diag6', [
        ((315, 264), (445, 231), (276, 276)),  # 시작(2타의 끝)
        ((200, 288), (316, 355), (166, 269)),  # 당김, 빈손은 앞으로 겨눔
        ((209, 292), (323, 359), (173, 271)),  # 깊이 웅크림
        ((338, 366), (453, 434), (291, 341)),  # 찌르기(타격)
        ((338, 366), (453, 434), (291, 341)),  # 유지
        ((247, 343), (362, 412), (211, 323)),  # 복귀(1타의 시작)
    ]),
]


def build_sheet(sheet_def):
    scale = BODY / SOURCE_BODY
    frames, bodies, covers = [], [], []
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
            if i in sheet_def.get('grip_covers', {}):
                mask = Image.new('L', cell.size)
                ImageDraw.Draw(mask).polygon(sheet_def['grip_covers'][i], fill=255)
                alpha = mask.crop((left, top, right, bottom)).resize(body.size, Image.Resampling.LANCZOS)
                cx, cy, cr, cb = alpha.getbbox()
                patch = body.crop((cx, cy, cr, cb))
                patch.putalpha(alpha.crop((cx, cy, cr, cb)))
                frame['gripCover'] = dict(name=f'{frame["name"]}-grip-cover', x=cx, y=cy, w=patch.width, h=patch.height)
                covers.append((patch, frame['gripCover']))
            frames.append(frame)
    pad = 4
    width = sum(b.width + pad for b in bodies) + pad
    height = max(b.height for b in bodies) + pad * 2
    cover_y = height
    if covers:
        height += max(patch.height for patch, _ in covers) + pad
    atlas = Image.new('RGBA', (width, height))
    x = pad
    for body, frame in zip(bodies, frames):
        atlas.paste(body, (x, pad))
        frame['x'], frame['y'] = x, pad
        x += body.width + pad
    x = pad
    for patch, cover in covers:
        atlas.paste(patch, (x, cover_y))
        cover['atlasX'], cover['atlasY'] = x, cover_y
        x += patch.width + pad
    atlas.save(ROOT / f'{prefix}-{view}.webp', quality=92, method=6)
    (ROOT / f'{prefix}-{view}_frames.json').write_text(json.dumps(dict(frames=frames), indent=2) + '\n')
    print(f'{name}: {len(frames)} frames, atlas {width}x{height}')


def build():
    for sheet_def in SHEETS:
        build_sheet(sheet_def)


if __name__ == '__main__':
    build()
