# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

가상 조이스틱(화면에 고정된 원형 패드)으로 한 장짜리 배경 위를 360도로 돌아다니고,
공격 버튼(누르고 있으면 3단 콤보)과 회피 버튼으로 몬스터와 실시간으로 싸운다.
주인공은 천무학관의 4방향 대기·걷기 시트와 같은 디자인으로 추가한 3단 공격·회피 시트를 사용한다. 나머지는 코드로 그린 임시 그래픽이다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

같은 와이파이의 휴대폰에서 터미널에 표시되는 Network 주소로 접속하면 터치로 조작할 수 있다.
PC에서는 방향키나 WASD로 움직이고 스페이스바나 J로 공격, Shift나 K로 회피한다. 주소 뒤에 `?debug`를 붙이면 이동 가능 영역이 보인다.

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
| `src/config.ts` | 화면 크기, 이동 속도, 전투 수치(체력·공격력·사거리 등) |
| `src/ui/VirtualJoystick.ts` | 고정형 가상 조이스틱 (멀티터치, 데드존) |
| `src/ui/ActionButton.ts` | 공격·회피 버튼 |
| `src/combat/Enemy.ts` | 몬스터 AI (배회 → 추격 → 준비 동작 → 돌진) |
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/entities/HeroSprite.ts` | 원본 프레임 표시, 발·검날 좌표, 좌우 공격, 잔상 복사 |
| `src/entities/heroFrames.ts` | 4방향 선택, 8fps 걷기 순서, 공격·회피 프레임 시점 |
| `src/assets/hero/academy/` | 현재 사용하는 캐릭터 시트·프레임 좌표·출처 |
| `art/hero_parts/` | 이전 뼈대 캐릭터의 부위별 원본 PNG 보관 |
| `tools/build_hero_rig.py` | 원본 부위를 조립해 `src/assets/hero/rig.png`, `rig.json` 생성 |
| `tools/cut_sprites.py` | 캐릭터 시트에서 한 줄을 잘라 게임용 스프라이트 시트로 변환 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 맵 배치, 입력, 이동, 카메라, 타격 판정 |

## 주인공 그림을 고쳤을 때

현재 캐릭터는 `src/assets/hero/academy/`의 `player_walk.png`와 `player_combat.png`를 사용한다.
원본 시트를 편집하지 않고 프레임 영역과 발·검날 기준점을 별도 JSON으로 관리한다.
공격 그림을 교체할 때는 `tools/build_hero_frames.py`의 `ANCHORS`와 파츠 영역도 다시 측정한다.

```bash
python3 tools/build_hero_frames.py
npm run build
node --test tools/*.test.mjs
npm run test:browser
```

`heroFrames.ts`의 공격 프레임 시점은 `src/config.ts`의 콤보 명중 구간과 함께 조정한다.
게임 화면에서 네 방향 이동·정지, 좌우 3단 공격, 회피, 발 높이와 이름표를 확인한다.
이전 뼈대 조립 도구와 파츠는 보관하며 현재 주인공 표시에는 사용하지 않는다.

## 안드로이드 테스트 APK

Capacitor 7로 게임을 앱 안에 포함한다. 별도 개발 서버 없이 실행되며, 가로 화면과 전체 화면을 사용한다.

준비물은 Node.js 24 이상, JDK 21, Android SDK Platform 35와 Build Tools 34.0.0이다.
Android Studio의 SDK Manager로 설치한 뒤 `ANDROID_HOME`을 SDK 경로로 설정하거나,
추적되지 않는 `android/local.properties`에 `sdk.dir=/실제/SDK/경로`를 지정한다.

```bash
npm ci
npm run android:apk
```

APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성된다.
웹 게임을 수정할 때도 같은 명령으로 웹 빌드·앱 동기화·APK 빌드를 다시 실행한다.
Windows에서는 `npm run android:sync` 후 `android` 폴더에서 `gradlew.bat assembleDebug`를 실행한다.

APK를 휴대폰으로 복사해 열고 해당 파일 앱의 ‘알 수 없는 앱 설치’를 허용하거나,
USB 디버깅을 켠 기기에서 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`로 설치한다.
테스트용 디버그 서명을 사용하므로 스토어 배포용으로 사용하지 않는다.
이전 설치본과 서명 키가 다르면 기존 앱을 삭제한 뒤 설치해야 한다.
