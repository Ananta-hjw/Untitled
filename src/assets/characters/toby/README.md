# 토비 — 마르타의 견습생

2장 `docs/story-chapter2.md`에 등장하는 견습 소년이다. 가장 늦게 안개섬으로 끌려갔다가 구출된 뒤 풀무질로 돌아오며, 훗날 마르타와 새 종을 붓는다.

## 디자인

14~15세쯤의 외형을 제작 기준으로 삼았다. 구체적인 나이를 스토리의 확정 설정으로 추가한 것은 아니다. 핀보다 나이 든 소년으로 구분하며, 짧고 곧은 짙은 적갈색 머리·흰 천 머리띠·청회색 눈·뺨과 손의 그을음으로 기억할 수 있게 했다. 벽돌색 소매·이끼색 조끼·기운 가죽 앞치마와 작은 망치·측정용 끈은 장인의 견습생을 나타낸다. 앞치마의 나무 종 모양 견본은 직업을 보여 주는 디자인 소품이다. 표정은 입을 다문 진지하고 순한 인상이다.

## 파일

| 원본 | 용도 |
| --- | --- |
| `dialogue.png` | 대화용 전신 원화, 1024 × 1536 RGBA |
| `sd_idle.png` | 정면 기본 SD, 1254 × 1254 RGBA |
| `bellows-source.png` | 발로 밟는 풀무질 2자세, 1774 × 887 RGBA. 왼쪽은 풀무가 펴진 상태, 오른쪽은 오른발로 눌러 압축한 상태 |
| `cocoon.png` | 안개 고치 안에서 잠든 SD, 1254 × 1254 RGBA. 가장 최근 실종자이므로 고치가 두껍고 온전하며, 얼굴과 복장이 보이도록 표현 |
| `walk_cardinal.png`, `walk_diagonal.png` | 8방향 걷기, 각각 1254 × 1254 RGBA. 방향마다 대기 1자세와 걷기 3자세 |
| `sleepwalk-source.png` | 강 쪽으로 고개를 떨구고 걷는 몽유 4자세, 2열 × 2행 RGBA |

이미지 생성 도구로 제작했다. 대화용은 기존 마을 인물의 화풍과 마르타의 작업복을 기준으로 디자인했으며, SD는 토비의 대화용 원화와 핀의 SD를 참고했다. 풀무질과 고치는 토비의 SD를 참고해 외형과 색감을 유지했다. 풀무질에는 균형을 잡는 손잡이·발판·풀무 장치가 함께 들어 있으므로 배경에 같은 장치를 중복해 놓지 않는다. 고치의 물방울은 이슬이며 부상이나 죽음을 표현한 것이 아니다.

## 게임용 사본과 상태

`python3 tools/build_toby_assets.py`로 원본을 보존하며 아래 파일을 만든다.

- `dialogue-768.webp`, `sd_idle-256.webp`, 발 중심 자료 `sd_idle.json`
- `bellows-open.webp`, `bellows-press.webp`, 두 자세를 묶은 `bellows.webp`와 `bellows-frames.json`
- `cocoon-512.webp`

풀무질 시트는 1280 × 512, 한 칸은 640 × 512다. 두 자세를 같은 배율과 지지 발 원점에 맞춰 배치했다.

`python3 tools/build_toby_assets.py --motion`은 게임용 걷기 WebP 2장과 `walk_frames.json`, 몽유 WebP와 `sleepwalk-frames.json`을 만든다. 개발 서버의 `?map=east-stream&npcs=support&companion=none`에서 풀무질을 볼 수 있다. `&action=sleepwalk`를 붙이면 몽유를, `&action=cocoon`을 붙이면 고치를 볼 수 있다. 몽유의 본편 이동 경로는 실종 사건을 구현할 때 연결한다.
