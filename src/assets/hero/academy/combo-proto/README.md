# 방향별 콤보 보정

`attack-front.png`와 `attack-down-diag.png`는 기존 몸 시트다. 검은 몸에 포함하지 않고 장착 무기 레이어로 그린다.

`attack-corrections.webp`와 `attack-corrections_frames.json`은 다음 자세만 추가하거나 덮어쓴다.

- `attack-back-0..11`: 바로 위를 향하는 뒷모습 3타 × 4자세. 기존 `attack-up`은 위 대각선에서 계속 사용한다.
- `attack-front-4..7`: 아래 정면 2타. 몸 앞 바닥 방향으로 칼끝이 나간다.
- `attack-down-diag-4..11`: 아래 대각선 2·3타. 타격 시 칼날을 화면 수평에서 아래로 35도 향하게 한다. 왼쪽은 몸과 검을 함께 반전한다.

나머지 자세는 기존 시트와 좌표를 그대로 사용한다. 아래 정면 3타의 원근 검도 유지한다.

2026-11-23 생성 원화는 `attack-back-source.png`, `attack-front-second-source.png`, `attack-down-diag-second-third-source.png`에 보존했다. 기존 캐릭터를 참조해 이미지 생성 도구로 제작했다. 재생성은 다음과 같다.

```bash
python3 tools/build_attack_corrections.py
```

스크립트의 `SHEETS`에는 원화 각 칸에서 측정한 발·주먹 좌표와 검 각도가 있다. 몸을 높이 304px로 포장하면서 같은 변환을 기준점에 적용한다. 가드는 주먹에서 칼 방향으로 10px 앞, 칼날 길이는 145px다. 뒷모습의 주먹은 몸 앞에 가려지며 무기도 몸 뒤에서 그린다. 칼날 끝은 몸 프레임 바깥에 있을 수 있다. 별도 무기 레이어라 몸의 잘라낸 영역에 의해 잘리지 않는다.

검기 시작 시각은 방향별 타격 자세 전환과 공유하며, 검기 위치·각도·크기는 화면에 그린 검날 좌표에서 계산한다. `tools/gameplay-browser.mjs`에서 8방향 × 3타 × 2거리 × 4프레임 속도의 실제 명중과 뒤·옆·먼 적 제외, 전진·넉백, 검기 위치와 시각을 검사한다.
