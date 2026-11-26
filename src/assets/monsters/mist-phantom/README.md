# 안개 환영 (mist-phantom)

2장 갈대밭 늪과 퀘스트 6 "밤의 종소리"의 나루 밤길에 나오는 하급 마물. 그림자가 없다.

- `walk_*`, `attack_*`, `animation_frames.json`: 8방향 걷기·공격 (`combat/MonsterSprite.ts`)
- `materialize-source.png`: 등장 4칸 (안개 한 줄기 → 흐린 몸 → 눈빛이 켜진 몸 → 온몸), 1536×384, 칸 384px
- `dissipate-source.png`: 쓰러짐 4칸 (온몸 → 흐려진 몸 → 흩어진 안개 줄기 → 거의 사라짐), 같은 규격

## 게임용

`python3 tools/build_mist_phantom_fade.py`가 두 원본을 고치지 않고 `fade.webp`(192px 칸 8개)와 `fade-frames.json`을 만든다.
기준점은 온몸 칸의 그림 아래 가운데이고 여덟 칸이 같은 자리를 쓴다. 원화는 오른쪽 아래를 보며, 왼쪽을 볼 때는 뒤집는다.
게임은 온몸 높이를 걷기 그림의 오른쪽 아래 정지 자세 높이에 맞춰 그린다(`MonsterSprite.playFade`).

- 나타날 때(처음 생길 때와 다시 나타날 때) 등장 4칸을 칸마다 130ms씩 보여 주고, 그동안 움직이거나 공격하지 않는다.
- 쓰러지면 쓰러짐 4칸을 칸마다 120ms씩 보여 준 뒤 마지막 칸을 살짝 지운다. 쓰러진 뒤에도 게임 시계로 칸을 넘긴다.
