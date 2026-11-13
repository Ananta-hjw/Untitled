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
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "hero")

# 일러스트 좌표 → 게임 리그 좌표 배율. 리그에서 캐릭터 키가 약 400이 되게 한다.
K = 400 / 1185
FEET = (640, 1262)  # 리그의 원점(발밑 가운데)이 될 일러스트 좌표

# 뼈: 이름 → (부모, 관절의 일러스트 좌표). 쉬는 자세에서 모든 뼈의 회전은 0이다.
BONES = {
    "root": (None, FEET),
    "hip": ("root", (648, 742)),
    "chest": ("hip", (652, 690)),
    "head": ("chest", (668, 452)),
    "hair_back": ("head", (610, 250)),
    "ponytail": ("head", (652, 172)),
    "upper_arm_r": ("chest", (568, 492)),
    "forearm_r": ("upper_arm_r", (516, 640)),
    "hand_r": ("forearm_r", (468, 782)),
    "sword": ("hand_r", (452, 826)),
    "upper_arm_l": ("chest", (742, 500)),
    "forearm_l": ("upper_arm_l", (790, 640)),
    "hand_l": ("forearm_l", (826, 772)),
    "thigh_r": ("hip", (598, 800)),
    "shin_r": ("thigh_r", (566, 1010)),
    "foot_r": ("shin_r", (548, 1172)),
    "thigh_l": ("hip", (700, 800)),
    "shin_l": ("thigh_l", (716, 1010)),
    "foot_l": ("shin_l", (726, 1172)),
    "sash": ("hip", (724, 706)),
    "scabbard": ("chest", (458, 356)),
}

# 슬롯: 뒤에서 앞으로 그리는 순서.
#   fit=(시작점, 끝점, 끝 관절)  파츠 안의 두 점(0~1 비율)을 뼈의 관절과 다음 관절에 맞춘다.
#   pivot/scale/rot             직접 지정. pivot은 파츠 안에서 관절에 올 점(0~1 비율).
#   wide                        길이는 그대로 두고 폭만 조절
SLOTS = [
    dict(part="hair_back", bone="hair_back", pivot=(0.66, 0.10), scale=1.95, rot=6),
    dict(part="hair_ponytail", bone="ponytail", pivot=(0.80, 0.33), scale=1.5, rot=-6),
    dict(part="scabbard", bone="scabbard", pivot=(0.5, 0.06), scale=0.95, rot=-38),
    dict(part="hand_l", bone="hand_l", pivot=(0.45, 0.06), scale=0.58, rot=-8),
    dict(part="forearm_l", bone="forearm_l", fit=((0.42, 0.10), (0.62, 0.92), (826, 772)), wide=1.0),
    dict(part="upper_arm_l", bone="upper_arm_l", fit=((0.50, 0.14), (0.36, 0.88), (790, 640)), wide=0.9),
    dict(part="foot_l", bone="foot_l", pivot=(0.34, 0.36), scale=0.62, rot=0),
    dict(part="thigh_l", bone="thigh_l", fit=((0.58, 0.08), (0.48, 0.92), (716, 1010)), wide=1.25),
    dict(part="shin_l", bone="shin_l", fit=((0.50, 0.14), (0.50, 0.93), (726, 1172)), wide=1.4),
    dict(part="foot_r", bone="foot_r", pivot=(0.50, 0.36), scale=0.64, rot=4),
    dict(part="thigh_r", bone="thigh_r", fit=((0.58, 0.08), (0.42, 0.92), (566, 1010)), wide=1.2),
    dict(part="shin_r", bone="shin_r", fit=((0.50, 0.14), (0.50, 0.93), (548, 1172)), wide=1.4),
    dict(part="pelvis", bone="hip", pivot=(0.50, 0.24), scale=1.34, rot=0),
    dict(part="torso", bone="chest", pivot=(0.52, 0.94), scale=1.3, rot=0),
    dict(part="sash", bone="sash", pivot=(0.62, 0.10), scale=1.45, rot=-6),
    dict(part="sword", bone="sword", pivot=(0.5, 0.11), scale=1.55, rot=37),
    dict(part="hand_r_grip", bone="hand_r", pivot=(0.48, 0.10), scale=0.6, rot=14),
    dict(part="forearm_r", bone="forearm_r", fit=((0.62, 0.10), (0.34, 0.90), (468, 782)), wide=1.0),
    dict(part="upper_arm_r", bone="upper_arm_r", fit=((0.62, 0.22), (0.28, 0.86), (516, 640)), wide=0.90),
    dict(part="head", bone="head", pivot=(0.62, 0.90), scale=1.32, rot=0),
]


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
    scale = slot["scale"]
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

    bones = []
    for name, (parent, pos) in BONES.items():
        base = BONES[parent][1] if parent else FEET
        bones.append(dict(name=name, parent=parent, x=round((pos[0] - base[0]) * K, 2), y=round((pos[1] - base[1]) * K, 2)))

    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(os.path.join(OUT_DIR, "rig.png"))
    with open(os.path.join(OUT_DIR, "rig.json"), "w", encoding="utf-8") as f:
        json.dump(dict(frames=frames, bones=bones, slots=slots), f, indent=1)
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
    canvas.save(target)


if __name__ == "__main__":
    main()
