"""분리된 파츠 PNG를 게임용 뼈대 캐릭터 데이터로 만든다.

사용법:
    python3 tools/build_hero_rig.py <파츠 images 폴더> [--preview <출력 PNG>] [--reference <전신 일러스트>]

출력:
    src/assets/hero/rig.png   모든 파츠를 한 장에 모은 이미지
    src/assets/hero/rig.json  파츠 위치(frames), 뼈대(bones), 그리는 순서(slots)

파츠들은 배율이 제각각이라, 전신 일러스트에서 잰 관절 위치(REF 좌표)를 기준으로
각 파츠의 크기·각도를 맞춘다. 좌표는 전신 일러스트(1182x1330)의 픽셀이다.
아래 BONES와 SLOTS의 숫자를 고치고 다시 실행하면 조립이 바뀐다.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "hero")

# 일러스트 좌표 → 게임 리그 좌표 배율. SD 관절과 파츠 크기에 함께 적용한다.
K = 400 / 1185
FEET = (640, 1262)  # 리그의 원점(발밑 가운데)이 될 일러스트 좌표

# 뼈: 이름 → (부모, 관절의 일러스트 좌표). 쉬는 자세에서 모든 뼈의 회전은 0이다.
# SD 비율: 큰 머리와 짧은 몸통·팔다리. 발 원점과 뼈 이름은 유지한다.
BONES = {
    "root": (None, FEET),
    "hip": ("root", (648, 1000)),
    "chest": ("hip", (652, 955)),
    "head": ("chest", (668, 825)),
    "hair_back": ("head", (585, 535)),
    "ponytail": ("head", (643, 421)),
    "upper_arm_r": ("chest", (550, 855)),
    "forearm_r": ("upper_arm_r", (515, 950)),
    "hand_r": ("forearm_r", (483, 1040)),
    "sword": ("hand_r", (483, 1040)),
    "upper_arm_l": ("chest", (758, 860)),
    "forearm_l": ("upper_arm_l", (781, 950)),
    "hand_l": ("forearm_l", (800, 1040)),
    "thigh_r": ("hip", (598, 1040)),
    "shin_r": ("thigh_r", (577, 1142)),
    "foot_r": ("shin_r", (562, 1220)),
    "thigh_l": ("hip", (700, 1040)),
    "shin_l": ("thigh_l", (710, 1142)),
    "foot_l": ("shin_l", (718, 1220)),
    "sash": ("hip", (709, 982)),
    "scabbard": ("chest", (493, 795)),
}

# 파츠에서 지울 영역(원본 PNG 좌표의 다각형). 다른 파츠와 겹쳐 그려진 부분이 있을 때 쓴다.
# 예: "torso": [[(0, 140), (0, 270), (71, 270), (75, 205)]]
ERASE: dict[str, list[list[tuple[int, int]]]] = {}

# 슬롯: 뒤에서 앞으로 그리는 순서.
#   fit=(시작점, 끝점, 끝 관절)  파츠 안의 두 점(0~1 비율)을 뼈의 관절과 다음 관절에 맞춘다.
#   pivot/scale/rot             직접 지정. pivot은 파츠 안에서 관절에 올 점(0~1 비율).
#   rigHeight                   원본 해상도에 관계없이 리그에서의 높이를 일정하게 유지
#   wide                        길이는 그대로 두고 폭만 조절
SLOTS = [
    dict(part="hair_back", bone="hair_back", pivot=(0.66, 0.10), scale=2.35, rot=6),
    dict(part="hair_ponytail", bone="ponytail", pivot=(0.80, 0.33), scale=2.05, rot=-6),
    dict(part="scabbard", bone="scabbard", pivot=(0.5, 0.06), scale=0.70, rot=-38),
    dict(part="hand_l", bone="hand_l", pivot=(0.45, 0.06), scale=0.58, rot=-8),
    dict(part="forearm_l", bone="forearm_l", fit=((0.42, 0.10), (0.62, 0.92), (800, 1040)), wide=1.25),
    dict(part="upper_arm_l", bone="upper_arm_l", fit=((0.50, 0.14), (0.36, 0.88), (781, 950)), wide=1.15),
    dict(part="foot_l", bone="foot_l", pivot=(0.34, 0.36), scale=0.50, rot=0),
    dict(part="thigh_l", bone="thigh_l", fit=((0.58, 0.08), (0.48, 0.92), (710, 1142)), wide=1.65),
    dict(part="shin_l", bone="shin_l", fit=((0.50, 0.14), (0.50, 0.93), (718, 1220)), wide=1.7),
    dict(part="foot_r", bone="foot_r", pivot=(0.50, 0.36), scale=0.52, rot=4),
    dict(part="thigh_r", bone="thigh_r", fit=((0.58, 0.08), (0.42, 0.92), (577, 1142)), wide=1.6),
    dict(part="shin_r", bone="shin_r", fit=((0.50, 0.14), (0.50, 0.93), (562, 1220)), wide=1.7),
    dict(part="pelvis", bone="hip", pivot=(0.50, 0.24), scale=0.88, rot=0),
    dict(part="torso", bone="chest", pivot=(0.60, 0.95), scale=0.24, rot=0),
    dict(part="sash", bone="sash", pivot=(0.62, 0.10), scale=0.90, rot=-6),
    dict(part="head", bone="head", pivot=(0.62, 0.90), scale=2.05, rot=0),
    # 갑옷 → 검 → 쥐는 손 순서로 그려 손잡이와 폼멜이 소매에 묻히지 않게 한다.
    dict(part="forearm_r", bone="forearm_r", fit=((0.62, 0.10), (0.34, 0.90), (483, 1040)), wide=1.25),
    dict(part="upper_arm_r", bone="upper_arm_r", fit=((0.62, 0.22), (0.28, 0.86), (515, 950)), wide=1.15),
    dict(part="sword", bone="sword", pivot=(0.5, 0.19), scale=1.55, rot=5),
    dict(part="hand_r_grip", bone="hand_r", pivot=(0.64, 0.04), rigHeight=32, rot=-24),
]


# 악수형 그립: 검지·엄지는 칼날 쪽, 새끼손가락은 폼멜 쪽에 둔다.
# 잘라낸 손 그림의 손잡이 중심과 기울기다.
SWORD_GRIP = dict(handPart="hand_r_grip", handX=0.46, handY=0.74,
                  swordX=0.5, swordY=0.19, handAxisDegrees=29)


def largest_blob(mask: np.ndarray) -> np.ndarray:
    """서로 붙어 있는 픽셀 덩어리 중 가장 큰 것만 남긴 마스크."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best: list[tuple[int, int]] = []
    for sy, sx in zip(*np.where(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        blob = []
        while stack:
            y, x = stack.pop()
            blob.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(blob) > len(best):
            best = blob
    out = np.zeros_like(mask)
    ys, xs = zip(*best)
    out[list(ys), list(xs)] = True
    return out


def load_part(folder: str, name: str) -> Image.Image:
    """희미한 잡티(거의 투명한 유색 픽셀)를 지우고 내용물에 맞게 자른다."""
    image = Image.open(os.path.join(folder, f"{name}.png")).convert("RGBA")
    if name in ERASE:
        keep = Image.new("L", image.size, 255)
        draw = ImageDraw.Draw(keep)
        for polygon in ERASE[name]:
            draw.polygon(polygon, fill=0)
        keep = keep.filter(ImageFilter.GaussianBlur(0.8))
        alpha = np.asarray(image.getchannel("A")).astype(np.float32) * np.asarray(keep) / 255
        image.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    data = np.asarray(image).copy()
    data[data[:, :, 3] < 24] = 0
    data[~largest_blob(data[:, :, 3] > 24)] = 0  # 본체와 떨어진 점 같은 잡티 제거
    solid = data[:, :, 3] > 128
    ys, xs = np.where(solid)
    return Image.fromarray(data).crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def resolve(slot: dict, size: tuple[int, int]) -> dict:
    """슬롯 설정을 (가로 배율, 세로 배율, 회전, 파츠 안의 기준점 픽셀)로 푼다."""
    w, h = size
    if "fit" in slot:
        (ax, ay), (bx, by), end = slot["fit"]
        start = BONES[slot["bone"]][1]
        wide = slot.get("wide", 1.0)
        # 폭 배율을 적용한 뒤의 파츠 안 벡터
        local = ((bx - ax) * w * wide, (by - ay) * h)
        target = (end[0] - start[0], end[1] - start[1])
        ratio = math.hypot(*target) / math.hypot(*local)
        rot = math.degrees(math.atan2(target[1], target[0]) - math.atan2(local[1], local[0]))
        return dict(sx=ratio * wide, sy=ratio, rot=rot, pivot=(ax * w, ay * h))
    px, py = slot["pivot"]
    scale = slot["scale"] if "scale" in slot else slot["rigHeight"] / (h * K)
    return dict(sx=scale * slot.get("wide", 1.0), sy=scale, rot=slot.get("rot", 0), pivot=(px * w, py * h))


def main() -> None:
    args = sys.argv[1:]
    folder = args[0]
    preview = args[args.index("--preview") + 1] if "--preview" in args else None
    reference = args[args.index("--reference") + 1] if "--reference" in args else None

    frames = {}
    slots = []
    images = []
    for slot in SLOTS:
        part = load_part(folder, slot["part"])
        t = resolve(slot, part.size)
        # 게임에서 배율 1로 쓰도록 미리 크기를 맞춰 둔다.
        w = max(1, round(part.width * t["sx"] * K))
        h = max(1, round(part.height * t["sy"] * K))
        scaled = part.resize((w, h), Image.LANCZOS)
        images.append((slot["part"], scaled))
        slots.append(
            dict(
                part=slot["part"],
                bone=slot["bone"],
                originX=round(t["pivot"][0] / part.width, 4),
                originY=round(t["pivot"][1] / part.height, 4),
                rotation=round(t["rot"], 2),
            )
        )

    # 한 장으로 모으기 (단순한 줄 채우기)
    pad = 2
    sheet_w = 512
    x = y = row_h = 0
    for name, image in images:
        if x + image.width + pad > sheet_w:
            x, y, row_h = 0, y + row_h + pad, 0
        frames[name] = dict(x=x, y=y, w=image.width, h=image.height)
        x += image.width + pad
        row_h = max(row_h, image.height)
    sheet = Image.new("RGBA", (sheet_w, y + row_h), (0, 0, 0, 0))
    for name, image in images:
        sheet.paste(image, (frames[name]["x"], frames[name]["y"]))

    # 축소된 실제 이미지 좌표를 사용해 반올림 후에도 손과 검의 기준점을 일치시킨다.
    hand = next(s for s in slots if s["part"] == SWORD_GRIP["handPart"])
    sword = next(s for s in slots if s["part"] == "sword")
    frame = frames[hand["part"]]
    dx = (SWORD_GRIP["handX"] - hand["originX"]) * frame["w"]
    dy = (SWORD_GRIP["handY"] - hand["originY"]) * frame["h"]
    angle = math.radians(hand["rotation"])
    wrist = BONES[hand["bone"]][1]
    BONES["sword"] = ("hand_r", (wrist[0] + (dx * math.cos(angle) - dy * math.sin(angle)) / K,
                                wrist[1] + (dx * math.sin(angle) + dy * math.cos(angle)) / K))
    sword["originX"] = SWORD_GRIP["swordX"]
    sword["originY"] = SWORD_GRIP["swordY"]
    sword["rotation"] = hand["rotation"] + SWORD_GRIP["handAxisDegrees"]

    bones = []
    for name, (parent, pos) in BONES.items():
        base = BONES[parent][1] if parent else FEET
        bones.append(dict(name=name, parent=parent, x=round((pos[0] - base[0]) * K, 2), y=round((pos[1] - base[1]) * K, 2)))

    # 이름표 높이는 실제 SD 파츠의 윗 경계로 계산한다.
    top = 0.0
    for slot in slots:
        frame = frames[slot["part"]]
        angle = math.radians(slot["rotation"])
        joint_y = (BONES[slot["bone"]][1][1] - FEET[1]) * K
        for x in (0, frame["w"]):
            for y in (0, frame["h"]):
                edge = joint_y + (x - slot["originX"] * frame["w"]) * math.sin(angle) + (y - slot["originY"] * frame["h"]) * math.cos(angle)
                top = min(top, edge)
    height = math.ceil(-top)

    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(os.path.join(OUT_DIR, "rig.png"))
    with open(os.path.join(OUT_DIR, "rig.json"), "w", encoding="utf-8") as f:
        json.dump(dict(frames=frames, bones=bones, slots=slots, swordGrip=SWORD_GRIP, height=height), f, indent=1)
    print(f"rig.png {sheet.size}, {len(bones)} bones, {len(slots)} slots")

    if preview:
        render_preview(images, slots, preview, reference)


def render_preview(images, slots, target: str, reference: str | None) -> None:
    """쉬는 자세로 조립한 모습을 그린다. 기준 일러스트가 있으면 옆에 나란히 놓는다."""
    width, height = round(1182 * K), round(1330 * K)
    canvas = Image.new("RGBA", (width, height), (96, 112, 96, 255))
    by_name = dict(images)
    for slot in slots:
        image = by_name[slot["part"]]
        joint = BONES[slot["bone"]][1]
        cx, cy = joint[0] * K, joint[1] * K
        ox, oy = slot["originX"] * image.width, slot["originY"] * image.height
        angle = math.radians(slot["rotation"])
        cos, sin = math.cos(angle), math.sin(angle)
        # 캔버스 좌표 → 파츠 좌표 (역변환)
        matrix = (cos, sin, ox - cos * cx - sin * cy, -sin, cos, oy + sin * cx - cos * cy)
        layer = image.transform((width, height), Image.AFFINE, matrix, resample=Image.BICUBIC)
        canvas.alpha_composite(layer)
    if reference:
        ref = Image.open(reference).convert("RGBA").resize((width, height), Image.LANCZOS)
        both = Image.new("RGBA", (width * 2, height), (96, 112, 96, 255))
        both.alpha_composite(canvas, (0, 0))
        backdrop = Image.new("RGBA", (width, height), (96, 112, 96, 255))
        backdrop.alpha_composite(ref)
        both.alpha_composite(backdrop, (width, 0))
        canvas = both
    canvas = canvas.resize((canvas.width * 2, canvas.height * 2), Image.LANCZOS)
    canvas.save(target)


if __name__ == "__main__":
    main()
