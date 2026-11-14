# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

시온의 집 앞에서 시작해 여덟 채의 건물과 마을 사람 열한 명이 있는 로웬 마을을 가상 조이스틱으로 돌아다니며 말을 걸고,
마을 밖 사냥터(남쪽 들판, 서쪽 숲길, 동쪽 개울가)에서 공격 버튼(누르고 있으면 3단 콤보)과 회피 버튼으로 몬스터와 실시간으로 싸운다.
주인공은 천무학관 기반의 상하좌우·대각선 8방향 대기·걷기 시트와 같은 디자인의 좌우·대각선 3단 공격 및 회피 시트를 사용한다. 나머지는 코드로 그린 임시 그래픽이다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

같은 와이파이의 휴대폰에서 터미널에 표시되는 Network 주소로 접속하면 터치로 조작할 수 있다.
PC에서는 방향키나 WASD로 움직이고 스페이스바나 J로 공격, Shift나 K로 회피한다. 적의 돌진이 닿기 직전에 회피하면 저스트 회피가 되어 잠깐 느려지고 다음 공격이 강해진다. 말을 걸 수 있는 곳 근처에서는 E나 Enter로 대화한다. 오른쪽 위 II 버튼이나 Esc(안드로이드는 뒤로가기)로 일시정지하고, 설정에서 버튼·조이스틱 크기와 저스트 회피 판정을 바꿀 수 있다. 주소 뒤에 `?debug`를 붙이면 이동 가능 영역이 보인다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run build:single` | HTML 한 파일로 묶은 빌드 (`dist-single/`) |
| `npm run typecheck` | 타입 검사 |

## 회귀 검사

```bash
node --test tools/*.test.mjs
npm run test:browser
```

브라우저 검사는 Chromium이 필요하며, 개발 서버와 임시 브라우저를 자동으로 실행하고 종료한다.
실행 파일 경로가 기본값과 다르면 `CHROMIUM_PATH`로 지정한다.
장면 재시작, 공통 게임 시계, 부활, 가변 프레임 회피 거리, 짧은 공격 입력, 타격 시간 경계와 효과 객체 재사용을 실제 게임 코드로 검사한다.

## 구조

| 파일 | 역할 |
|---|---|
| `src/config.ts` | 화면 크기, 이동 속도, 전투 수치(체력·공격력·사거리 등), 성장 수치(`PROGRESSION`) |
| `src/ui/VirtualJoystick.ts` | 고정형 가상 조이스틱 (멀티터치, 데드존) |
| `src/ui/ActionButton.ts` | 공격·회피 버튼 |
| `src/combat/Enemy.ts` | 몬스터 AI (배회 → 추격 → 준비 동작 → 돌진) |
| `src/combat/justDodge.ts` | 저스트 회피 판정과 느린 화면 배율 |
| `src/combat/hitFeel.ts` | 히트스톱(타격 순간 멈춤)과 맞은 적의 찌그러짐 |
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/entities/HeroSprite.ts` | 원본 프레임 표시, 발·검날 좌표, 좌우 공격, 잔상 복사 |
| `src/entities/heroFrames.ts` | 8방향 선택, 공격 방향·타격 레인, 걷기·공격·회피 프레임 시점 |
| `src/assets/hero/academy/` | 현재 사용하는 캐릭터 시트·프레임 좌표·출처 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 입력, 이동, 카메라, 타격 판정 |
| `src/world/maps.ts` | 맵 목록(마을·사냥터), 소품 배치, 몬스터 위치, 맵 사이 출구와 도착 지점 |
| `src/world/village.ts` | 맵의 지형·집·소품·출구 표시와 이동 영역 만들기 |
| `src/world/villageLayout.ts` | 로웬 마을의 건물·나무·바위 배치와 충돌 영역, 시작 위치 |
| `src/world/npcs.ts` | 마을 사람 목록(이름, 위치, 대사, 장사·걷기 여부)과 돌아다니기 규칙 |
| `src/entities/Npc.ts` | 마을 사람 표시, 이름표, 8방향 걷기와 멈춰서 바라보기 |
| `src/world/navGrid.ts` | 적의 장애물 우회 경로 |
| `src/ui/Hud.ts`, `src/ui/DamageNumbers.ts` | HUD와 재사용 피해 숫자 |
| `src/entities/progression.ts` | 경험치·레벨 계산 (레벨별 체력·공격력, 필요 경험치) |
| `src/ui/ProgressEffects.ts` | 경험치 획득·레벨 업 연출 |
| `src/entities/saveData.ts` | 레벨·경험치 저장과 불러오기 (기기의 localStorage) |
| `src/story/dialogues.ts` | 대사 모음 (표지판, 집 문, 마을 사람들의 첫날 대사) |
| `src/world/interactables.ts` | 말을 걸 수 있는 곳과 범위 (집 문, 표지판. 마을 사람은 `Npc`가 직접 만든다) |
| `src/ui/DialogueBox.ts` | 대화창 (초상화, 이름, 한 글자씩 나오는 대사) |
| `src/ui/PauseMenu.ts` | 일시정지 메뉴와 설정 화면 |
| `src/ui/settingsData.ts` | 조작 설정(버튼·조이스틱 크기, 저스트 회피 판정)과 그 저장 |

## 로웬 마을

맵은 2400×1600이며 시온의 집 앞에서 시작한다(`docs/rowen-village.md`). 가운데 큰 나무를 두고
북서쪽 시온의 집, 북쪽 촌장의 집, 북동쪽 치유소, 서쪽 수련소, 동쪽 잡화점, 남서쪽 대장간, 남동쪽 여관,
남쪽 입구(초소·아치·행상 수레)가 둘러싼다. 건물 이름은 지붕 위에 띄운다.
건물 벽은 사각형, 나무줄기와 바위는 타원으로 막으며, 지붕·나뭇잎과의 겹침은 발 위치로 정렬한다.
남쪽 입구는 아치의 두 기둥 사이로만 지나간다. 마을은 평화로운 곳이라 몬스터가 나오지 않는다.

**마을 사람.** 열한 명이 머리 위에 이름을 달고 서 있고, 다가가면 대화할 수 있다(대화창에 그 사람의 이름과 그림이 나온다).
모두 8방향 걷기 그림으로 그린다. 장사하는 도란·메리나·로제타는 가게 앞을 지키며 걷지 않고(이름표가 금색) 시온이 오면 돌아본다.
나머지 여덟 명은 자기 자리 주변을 천천히 돌아다니다가 시온이 가까이 오면 멈춰서 바라본다.
페른은 습격 다음 날 도착하므로 첫날에는 없다.

배치는 `src/world/villageLayout.ts`와 `src/world/npcs.ts`, 그림은 `src/assets/village/`와 `src/assets/characters/`에서 관리한다.
원본 그림은 크기가 커서, 게임에는 `python3 tools/build_rowen_assets.py`로 만든 작은 WebP 사본
(`rowen/buildings.webp`, 인물별 `dialogue-768.webp`, `walk_*-60.webp`)을 쓴다. 원본을 바꾸면 이 스크립트를 다시 실행한다.
나무·바위 소품은 `python3 tools/build_village_frames.py`로 프레임을 측정한다.
`?debug`를 붙이면 사각형 벽·타원 장애물, 이동 경계, 출구 영역(노란 사각형)을 확인할 수 있다.

## 성능 테스트 모드

일시정지 메뉴의 **성능 테스트** 버튼을 누를 때마다 끔 → 50명 → 100명 → 200명 → 끔으로 바뀌고, 마을에서 다시 시작한다.
기존 마을 사람 열한 명의 그림을 돌려 써서 그만큼의 사람을 마을 곳곳에 더 세우고 모두 돌아다니게 한다.
켜져 있는 동안 왼쪽 위에 FPS(평균·최저), 가장 긴 프레임, 인물 수, 그림 메모리 추정치(불러온 텍스처의 가로×세로×4바이트 합,
글자 제외), JS 메모리(지원하는 브라우저·WebView에서만)를 0.5초마다 보여 준다. 브라우저에서는 주소에 `?stress=100`을 붙여도 된다.
같은 그림을 여럿이 나눠 쓰는 경우를 재는 것이라, 서로 다른 인물 100명의 메모리는 인물 수에 비례해 더 늘어난다.

## 맵 이동

로웬 마을의 남쪽 입구 아치, 서쪽·동쪽 가장자리에 출구가 있다. 출구 영역에 발이 들어가면 화면이 잠깐 어두워지며
남쪽 들판, 서쪽 숲길, 동쪽 개울가로 옮겨 가고, 각 사냥터의 출구로 마을에 돌아온다.
옮겨 가는 동안에는 게임이 멈추고, 체력은 그대로 이어지며 레벨·경험치는 저장된 그대로다.
사냥터는 아직 전용 그림이 없어서 마을의 지면과 소품을 다른 배치·색조로 다시 쓰고, 개울은 코드로 그린다.
몬스터는 지금은 슬라임뿐이다(스토리 문서의 새 몬스터는 그림이 생기면 추가한다).

맵과 출구는 `src/world/maps.ts`에서 관리한다. 개발 서버에서는 주소에 `?map=south-field`처럼 붙여
그 맵에서 바로 시작할 수 있다 (`village`, `south-field`, `west-forest`, `east-stream`).

## 주인공 그림을 고쳤을 때

현재 캐릭터는 `src/assets/hero/academy/`의 `player_walk.png`, `player_walk_diagonal.png`, `player_combat.png`, `player_attack_down.png`, `player_attack_up.png`를 사용한다.
원본 시트를 편집하지 않고 프레임 영역과 발·검날 기준점을 별도 JSON으로 관리한다. 공격은 이동 입력을 우선하고, 입력이 없으면 근처 적 또는 마지막 방향을 사용한다. 한 타격 동안 방향을 고정하며 전진·넉백·검날 판정이 같은 방향을 따른다.
공격 그림을 교체할 때는 `tools/build_hero_frames.py`의 `ANCHORS`와 파츠 영역도 다시 측정한다.

```bash
python3 tools/build_hero_frames.py
npm run build
node --test tools/*.test.mjs
npm run test:browser
```

`heroFrames.ts`의 공격 프레임 시점은 `src/config.ts`의 콤보 명중 구간과 함께 조정한다.
게임 화면에서 여덟 방향 이동·정지, 좌우·대각선 4방향의 3단 공격, 회피, 발 높이와 이름표를 확인한다.

## 안드로이드 APK

Capacitor로 웹 빌드를 안드로이드 앱으로 감싼다 (`android/`, `capacitor.config.ts`).
푸시하면 GitHub Actions(`.github/workflows/android-apk.yml`)가 테스트용 APK를 만든다.
저장소의 Actions 탭 → 해당 실행 → Artifacts의 `untitled-rpg-apk`에서 받을 수 있다 (GitHub 로그인 필요, zip으로 내려온다).

안드로이드 스튜디오가 설치된 PC에서 직접 만들 때:

```bash
npm run build
```

```bash
npx cap sync android
```

```bash
cd android && ./gradlew assembleDebug
```

결과물은 `android/app/build/outputs/apk/debug/app-debug.apk`.
화면에 표시되는 버전은 `package.json`의 `version`을 따른다.

### 서명 키

기본값은 저장소에 들어 있는 테스트용 키(`android/app/debug.keystore`)다. 이 키는 공개되어 있어서
누구나 같은 서명의 APK를 만들 수 있다. 본인 기기 테스트에만 쓰고, 다른 사람에게 나눠 주기 전에
비공개 키로 바꾼다.

1. 키를 만든다 (비밀번호와 별칭은 직접 정한다. 이 파일은 저장소에 올리지 않는다).

```bash
keytool -genkeypair -keystore signing.keystore -alias untitled -keyalg RSA -keysize 2048 -validity 10000
```

2. 키 파일을 한 줄 문자열로 바꾼다.

```bash
base64 -w 0 signing.keystore
```

3. 저장소 Settings → Secrets and variables → Actions 에 다음 네 개를 등록한다.

| 이름 | 값 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 2번에서 나온 문자열 |
| `ANDROID_KEYSTORE_PASSWORD` | 키 저장소 비밀번호 |
| `ANDROID_KEY_ALIAS` | 별칭 (위 예시에서는 `untitled`) |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

등록한 뒤의 빌드부터 비공개 키로 서명된다. 서명이 바뀌므로 기존에 설치한 앱은 한 번 지우고 다시 설치해야 한다.
그다음 `android/app/debug.keystore`와 `build.gradle`의 테스트용 키 부분을 지우면 된다.
스토어 출시에는 이와 별도로 릴리스 빌드 설정과 고유한 앱 ID가 필요하다.
