# 물안개 나루 아트

2장 나루 마을(`ferry-village`). 바닥은 4800×3200 원화를 1:1로 6조각 WebP(`ground-*.webp`, `ground.json`)로 표시한다.

## 건물과 소품

| 원본 | 내용 |
| --- | --- |
| `buildings/<이름>.png` | 1536×1024 투명, 건물 하나씩: 여관, 마르타의 대장간, 모르간의 창고, 망루, 사공 에반의 집, 방앗간, 어부의 집, 약초 가게, 평범한 집 두 채 |
| `props.png` | 1536×768 투명, 384px 칸 4열×2행: 작은 배, 나룻배, 상자와 통, 그물 건조대 / 갈대, 계류 기둥, 등불 기둥, 우물 |

`python3 tools/build_ferry_village_assets.py`가 원본을 고치지 않고 그림마다 실제 영역만 잘라
`objects/<이름>.webp`와 크기 목록 `objects.json`을 만든다. 그림을 바꾸면 다시 실행하고,
세로/가로 비율이 달라졌으면 `src/world/ferryVillage.ts`의 `ASPECT`도 고친다.

## 게임 연결

`src/world/ferryVillage.ts`가 배치를 맡는다. 건물은 바닥 그림의 빈 집터 열 곳에 앉혔고(`FERRY_BUILDINGS`),
각 그림은 따로 불러오는 소품(`VillageProp`, 텍스처 `ferry-<이름>`, `world/ferryVillageArt.ts`)이며 이름은 지붕 위에 띄운다.
벽은 그림 아래 끝보다 6px 앞까지, 그림 너비의 90%·높이의 절반 깊이를 막아 앞과 옆에서 다가가는 사람은 늘 건물 앞에 그려진다.
망루는 네 기둥만 막는다. 배는 강 위라 충돌이 없다. `tools/maps.test.mjs`가 벽과 모든 건물 앞·두 잔교 끝까지 걸어갈 수 있는지 검사한다.
건물 실내와 문(들어가기)은 아직 없다.
