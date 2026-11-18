# 로웬 마을 일반 병사

30세 전후의 평범한 경비병. 철제 투구·녹색 제복·누비옷·등의 원형 방패·허리의 칼집으로 테온과 구분한다. 웃는 입꼬리 없는 차분한 무표정이며, 턱을 살짝 낮춰 진행 방향을 본다. 보행할 때 무기를 뽑지 않는다.

- `dialogue.png`: 대화용 원화. `dialogue-768.webp`가 게임에서 쓰는 압축본이다.
- `sd_idle.png`: 정면 전신 SD 원화.
- `walk_cardinal.png`: 4×4. 행은 앞·왼쪽·오른쪽·뒤, 열은 대기·왼발·통과·오른발이다.
- `walk_diagonal.png`: 4×4. 행은 앞왼쪽·앞오른쪽·뒤왼쪽·뒤오른쪽이다.
- `walk_frames.json`: 8방향 32개 프레임과 발 기준점. 이동 거리에 맞춰 보행 프레임을 고른다.
- `walk_*-60.webp`: 원화의 60% 크기인 런타임 시트. 모든 병사가 같은 텍스처 두 장을 공유한다.

기존 테온 원화를 화풍 참고로 이미지 생성 도구로 제작했다. 병사별 배치·대화 ID는 `src/world/guards.ts`에 정의하며, 그래픽 ID인 `soldier`와 분리한다. 문지기는 고정 경계, 순찰병은 주변의 걸을 수 있는 곳으로 이동한다.

프레임 재측정: `python3 tools/build_npc_frames.py --characters soldier`

런타임 압축은 `tools/build_rowen_assets.py`의 NPC 압축 규칙과 동일하다.

## 쓰러진 병사 이미지

기존 `sd_idle.png`를 기준으로 투구·녹색 제복·누비옷·둥근 방패를 유지한 정적 자세 4종입니다. 피나 노출된 상처 없이 눈을 감고 바닥에 쓰러진 모습입니다.

- `fallen-source.png`: 이미지 생성 도구로 만든 투명 배경 2×2 원화.
- `fallen-back.webp`: 등을 대고 누워 한쪽 무릎을 굽힌 모습.
- `fallen-side.webp`: 옆으로 누운 모습.
- `fallen-prone.webp`: 엎드려 방패와 등이 보이는 모습.
- `fallen-curled.webp`: 옆으로 몸을 웅크린 모습.
- 개별 파일은 512×384이며, `fallen.webp`는 네 자세를 모은 1024×768 아틀라스입니다.
- `fallen-frames.json`: 각 영역과 몸 중심 원점(0.5, 0.5), 권장 월드 표시 너비 180을 담습니다.

재생성: `python3 tools/build_fallen_soldiers.py` (Pillow로 영역 측정, ImageMagick으로 분리·압축).

현재 병사 NPC의 보행·대화 상태와 사건 배치는 유지하며, 쓰러진 병사를 표시할 장면에서 사용할 이미지 에셋으로 준비했습니다.
