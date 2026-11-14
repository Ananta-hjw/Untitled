# 천무학관 캐릭터 시트

현재 게임의 주인공은 부위 조립 대신 완성된 캐릭터 프레임을 사용합니다.

## 원본과 추가 그림

- `player_walk.png`, `player_walk_atlas.json`: `Ananta-hjw/Bi-Ryeo-Do`의 천무학관 탐색용 원본을 그대로 사용합니다. 기준 커밋: `59142f72f0a7156ccb3a9cdf4cccfc34c870cc40`.
- 원본 경로: `Assets/_Project/Resources/Art/Exploration/`. [원본 저장소](https://github.com/Ananta-hjw/Bi-Ryeo-Do/tree/59142f72f0a7156ccb3a9cdf4cccfc34c870cc40/Assets/_Project/Resources/Art/Exploration).
- `player_combat.png`: 원본 걷기 시트를 참고해 이미지 생성 도구로 추가한 투명 시트입니다. 4열 × 4행이며 위에서부터 내려베기·올려베기·찌르기·회피입니다. 기존 저장소의 전투 그림은 사용하지 않았습니다.
- Unity 코드와 저장소 전체는 가져오지 않았습니다. 표시·방향·애니메이션 연결은 이 프로젝트의 Phaser 코드로 구현했습니다.

## 좌표와 재생

`tools/build_hero_frames.py`가 원본을 변경하지 않고 `frames.json`을 생성합니다. 걷기 좌표는 Unity의 아래쪽 원점을 Phaser의 위쪽 원점으로 변환합니다. 행 순서는 아래·왼쪽·오른쪽·위이며 각 행의 첫 칸은 대기입니다. 걷기는 초당 8프레임으로 1→2→3→2를 반복합니다.

걷기 전체에 공통 배율을 적용하고 발밑을 원점으로 사용합니다. 공격 시트는 원본과 머리 크기를 맞추는 공통 배율 1.2와 프레임별 발 위치를 사용합니다. 검의 가드와 끝 좌표는 같은 파일의 `ANCHORS`에 있으며, 화면상의 검과 타격·궤적 효과가 같은 기준점을 사용합니다. 왼쪽 공격은 그림과 기준점을 함께 반전합니다.

시트 교체 시 이미지 크기, 영역, 발과 검의 위치를 다시 측정하고 다음을 실행합니다.

```bash
python3 tools/build_hero_frames.py
npm run build
node --test tools/*.test.mjs
npm run test:browser
```

실제 화면에서 4방향 걷기와 정지, 좌우 3단 콤보, 회피, 크기·발 위치와 잔상을 확인합니다. 생성 그림은 새 애니메이션 초안이며 원본 걷기 그림과 동작별 연결감을 함께 검토해야 합니다.
