"""캐릭터 시트(투명 또는 흰 배경)에서 한 줄을 잘라 게임용 스프라이트 시트로 만든다.

사용법:
    python3 tools/cut_sprites.py <입력 이미지> <행 번호(0부터)> <출력 PNG> [출력 높이]

- 가장자리와 이어진 흰색만 지우므로 캐릭터 안쪽의 흰 옷은 남는다.
- 각 프레임은 같은 크기의 칸에 넣고, 발이 칸의 가로 가운데·맨 아래에 오도록 맞춘다.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def remove_background(image: Image.Image, threshold: int = 236) -> Image.Image:
    # 이미 투명 배경이면 그대로 쓴다 (희미한 잡티만 정리).
    if image.mode == "RGBA":
        alpha = np.asarray(image)[:, :, 3]
        if (alpha < 8).mean() > 0.2:
            cleaned = np.asarray(image).copy()
            cleaned[alpha < 8] = 0
            return Image.fromarray(cleaned)
    rgb = np.asarray(image.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    near_white = (rgb.min(axis=2) >= threshold) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 14)

    background = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        queue.append((0, x))
        queue.append((h - 1, x))
    for y in range(h):
        queue.append((y, 0))
        queue.append((y, w - 1))
    while queue:
        y, x = queue.popleft()
        if y < 0 or y >= h or x < 0 or x >= w or background[y, x] or not near_white[y, x]:
            continue
        background[y, x] = True
        queue.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))

    # 경계에 남는 흰 테두리를 줄이기 위해 배경을 1px 넓히고 가장자리를 살짝 부드럽게 한다.
    mask = Image.fromarray((~background * 255).astype(np.uint8))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def runs(filled: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """True가 이어진 구간들을 찾는다. min_gap보다 좁은 틈은 같은 구간으로 본다."""
    spans = []
    start = None
    gap = 0
    for i, value in enumerate(filled):
        if value:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap > min_gap:
                spans.append((start, i - gap + 1))
                start = None
    if start is not None:
        spans.append((start, len(filled)))
    return spans


def main() -> None:
    source, row_index, target = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    out_height = int(sys.argv[4]) if len(sys.argv) > 4 else 0

    image = remove_background(Image.open(source))
    alpha = np.asarray(image)[:, :, 3] > 40

    rows = runs(alpha.any(axis=1), 12)
    top, bottom = rows[row_index]
    band = alpha[top:bottom]
    columns = runs(band.any(axis=0), 12)
    print(f"rows={len(rows)} frames in row {row_index}={len(columns)}")

    frames = []
    for left, right in columns:
        cell = alpha[top:bottom, left:right]
        ys = np.where(cell.any(axis=1))[0]
        y0, y1 = top + ys[0], top + ys[-1] + 1
        crop = image.crop((left, y0, right, y1))
        # 기준점: 발(아래쪽 12%)의 가로 중심
        a = np.asarray(crop)[:, :, 3] > 40
        feet = a[int(a.shape[0] * 0.88):]
        xs = np.where(feet.any(axis=0))[0]
        anchor = (xs[0] + xs[-1]) / 2
        frames.append((crop, anchor))

    # 걷는 프레임은 두 발이 벌어져 발 중심이 흔들리므로, 몸통(가운데 높이 40~70%)의 중심으로 맞춘다.
    anchored = []
    for crop, _ in frames:
        a = np.asarray(crop)[:, :, 3] > 40
        h = a.shape[0]
        body = a[int(h * 0.45):int(h * 0.7)]
        weights = body.sum(axis=0)
        anchor = float((weights * np.arange(len(weights))).sum() / max(1, weights.sum()))
        anchored.append((crop, anchor))

    half = max(max(anchor, crop.width - anchor) for crop, anchor in anchored)
    cell_w = int(half * 2) + 8
    cell_h = max(crop.height for crop, _ in anchored) + 4
    sheet = Image.new("RGBA", (cell_w * len(anchored), cell_h), (0, 0, 0, 0))
    for i, (crop, anchor) in enumerate(anchored):
        x = i * cell_w + round(cell_w / 2 - anchor)
        y = cell_h - crop.height
        sheet.paste(crop, (x, y))

    if out_height:
        scale = out_height / cell_h
        cell_w = round(cell_w * scale)
        sheet = sheet.resize((cell_w * len(anchored), out_height), Image.LANCZOS)
        cell_h = out_height
    sheet.save(target)
    print(f"saved {target}: frame {cell_w}x{cell_h}, {len(anchored)} frames")


if __name__ == "__main__":
    main()
