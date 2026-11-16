# 로웬 마을 일반 병사

30세 전후의 평범한 경비병. 철제 투구·녹색 제복·누비옷·등의 원형 방패·허리의 칼집으로 테온과 구분한다. 입은 닫고, 보행할 때 무기를 뽑지 않는다.

- `dialogue.png`: 대화용 원화. `dialogue-768.webp`가 게임에서 쓰는 압축본이다.
- `sd_idle.png`: 정면 전신 SD 원화.
- `walk_cardinal.png`: 4×4. 행은 앞·왼쪽·오른쪽·뒤, 열은 대기·왼발·통과·오른발이다.
- `walk_diagonal.png`: 4×4. 행은 앞왼쪽·앞오른쪽·뒤왼쪽·뒤오른쪽이다.
- `walk_frames.json`: 8방향 32개 프레임과 발 기준점. 이동 거리에 맞춰 보행 프레임을 고른다.
- `walk_*-60.webp`: 원화의 60% 크기인 런타임 시트. 모든 병사가 같은 텍스처 두 장을 공유한다.

기존 테온 원화를 화풍 참고로 이미지 생성 도구로 제작했다. 병사별 배치·대화 ID는 `src/world/guards.ts`에 정의하며, 그래픽 ID인 `soldier`와 분리한다. 문지기는 고정 경계, 순찰병은 주변의 걸을 수 있는 곳으로 이동한다.

프레임 재측정: `python3 tools/build_npc_frames.py --characters soldier`

런타임 압축은 `tools/build_rowen_assets.py`의 NPC 압축 규칙과 동일하다.
