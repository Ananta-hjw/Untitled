# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

주인공의 집 앞에서 시작해 나무·바위·잔디·흙길이 있는 작은 마을을 가상 조이스틱으로 돌아다니고,
공격 버튼(누르고 있으면 3단 콤보)과 회피 버튼으로 몬스터와 실시간으로 싸운다.
주인공은 천무학관 기반의 상하좌우·대각선 8방향 대기·걷기 시트와 같은 디자인의 좌우·대각선 3단 공격 및 회피 시트를 사용한다. 나머지는 코드로 그린 임시 그래픽이다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

같은 와이파이의 휴대폰에서 터미널에 표시되는 Network 주소로 접속하면 터치로 조작할 수 있다.
PC에서는 방향키나 WASD로 움직이고 스페이스바나 J로 공격, Shift나 K로 회피한다. 말을 걸 수 있는 곳 근처에서는 E나 Enter로 대화한다. 주소 뒤에 `?debug`를 붙이면 이동 가능 영역이 보인다.

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
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/entities/HeroSprite.ts` | 원본 프레임 표시, 발·검날 좌표, 좌우 공격, 잔상 복사 |
| `src/entities/heroFrames.ts` | 8방향 선택, 공격 방향·타격 레인, 걷기·공격·회피 프레임 시점 |
| `src/assets/hero/academy/` | 현재 사용하는 캐릭터 시트·프레임 좌표·출처 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 입력, 이동, 카메라, 타격 판정 |
| `src/world/village.ts` | 시작 마을의 지형·집·소품 표시 |
| `src/world/villageLayout.ts` | 집·나무·바위 배치와 충돌 영역, 시작 위치 |
| `src/world/navGrid.ts` | 적의 장애물 우회 경로 |
| `src/ui/Hud.ts`, `src/ui/DamageNumbers.ts` | HUD와 재사용 피해 숫자 |
| `src/entities/progression.ts` | 경험치·레벨 계산 (레벨별 체력·공격력, 필요 경험치) |
| `src/ui/ProgressEffects.ts` | 경험치 획득·레벨 업 연출 |
| `src/entities/saveData.ts` | 레벨·경험치 저장과 불러오기 (기기의 localStorage) |
| `src/story/dialogues.ts` | 대사 모음 (지금은 임시 대사) |
| `src/world/interactables.ts` | 말을 걸 수 있는 곳과 범위 (집 문, 표지판) |
| `src/ui/DialogueBox.ts` | 대화창 (초상화, 이름, 한 글자씩 나오는 대사) |

## 시작 마을

맵은 2400×1600이며 집 앞에서 시작한다. 잔디·흙길 지면과 집·나무·바위 소품을 분리해 표시한다.
건물 벽은 사각형, 나무줄기와 큰 바위는 타원으로 막으며, 나뭇잎과 지붕의 겹침은 발 위치로 정렬한다.
작은 돌·풀꽃은 통과할 수 있다. 기존 전투는 유지하며 몬스터 시작 위치는 마을 외곽에 둔다.
집은 현재 외관과 현관 앞 접근 공간을 제공한다.

배치는 `src/world/villageLayout.ts`, 그림은 `src/assets/village/`에서 관리한다.
이미지 교체 시 `python3 tools/build_village_frames.py`로 프레임을 다시 측정한다.
`?debug`를 붙이면 사각형 벽·타원 장애물과 이동 경계를 확인할 수 있다.

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
