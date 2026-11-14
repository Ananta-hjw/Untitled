# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

가상 조이스틱(화면에 고정된 원형 패드)으로 한 장짜리 배경 위를 360도로 돌아다니고,
공격 버튼(누르고 있으면 3단 콤보)과 회피 버튼으로 몬스터와 실시간으로 싸운다.
주인공은 부위별 그림을 뼈대에 붙여 움직이는 방식이고, 나머지는 코드로 그린 임시 그래픽이다.

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
| `npm test` | 회귀 테스트 (Node.js 24 이상 필요) |

## 구조

| 파일 | 역할 |
|---|---|
| `src/config.ts` | 화면 크기, 이동 속도, 전투 수치(체력·공격력·사거리 등) |
| `src/world/tavern.ts` | 선술집 맵: 소품 배치, 걸을 수 있는 영역, 조명, 등장 위치 |
| `src/world/navGrid.ts` | 적이 장애물을 돌아가는 길 찾기 격자 |
| `src/ui/Hud.ts` | 체력 막대, 버전 표시, 안내 문구 |
| `src/ui/VirtualJoystick.ts` | 고정형 가상 조이스틱 (멀티터치, 데드존) |
| `src/ui/ActionButton.ts` | 공격·회피 버튼 |
| `src/ui/DamageNumbers.ts` | 데미지 숫자 (숫자 그림과 표시 항목을 재사용) |
| `src/combat/BladeTrail.ts` | 검 궤적 이펙트 (Graphics 하나를 재사용) |
| `src/combat/Enemy.ts` | 몬스터 AI (배회 → 추격 → 준비 동작 → 돌진) |
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/entities/HeroRig.ts` | 뼈대 캐릭터: 부위 그림을 뼈에 붙여 그린다 |
| `src/entities/heroAnimations.ts` | 주인공 동작(대기, 걷기, 공격 3종, 회피). 숫자를 바꾸면 움직임이 달라진다 |
| `art/hero_parts/` | 주인공 부위별 원본 PNG |
| `tools/build_hero_rig.py` | 원본 부위를 조립해 `src/assets/hero/rig.png`, `rig.json` 생성 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 한 판의 진행: 입력, 이동, 공격·회피·피격 판정 |

## 주인공 그림을 고쳤을 때

`art/hero_parts/images/`의 PNG를 바꾸거나 `tools/build_hero_rig.py` 안의 조립 수치를 고친 뒤 다시 만든다.

```bash
python3 tools/build_hero_rig.py art/hero_parts/images --preview preview.png
```

`preview.png`에서 조립된 모습을 확인할 수 있다.

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
