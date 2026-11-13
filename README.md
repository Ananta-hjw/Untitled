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

## 구조

| 파일 | 역할 |
|---|---|
| `src/config.ts` | 화면 크기, 이동 속도, 전투 수치(체력·공격력·사거리 등) |
| `src/ui/VirtualJoystick.ts` | 고정형 가상 조이스틱 (멀티터치, 데드존) |
| `src/ui/ActionButton.ts` | 공격·회피 버튼 |
| `src/combat/Enemy.ts` | 몬스터 AI (배회 → 추격 → 준비 동작 → 돌진) |
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/entities/HeroRig.ts` | 뼈대 캐릭터: 부위 그림을 뼈에 붙여 그린다 |
| `src/entities/heroAnimations.ts` | 주인공 동작(대기, 걷기, 공격 3종, 회피). 숫자를 바꾸면 움직임이 달라진다 |
| `art/hero_parts/` | 주인공 부위별 원본 PNG |
| `tools/build_hero_rig.py` | 원본 부위를 조립해 `src/assets/hero/rig.png`, `rig.json` 생성 |
| `tools/cut_sprites.py` | 캐릭터 시트에서 한 줄을 잘라 게임용 스프라이트 시트로 변환 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 맵 배치, 입력, 이동, 카메라, 타격 판정 |

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
이 APK는 테스트용 키(`android/app/debug.keystore`)로 서명되며 스토어 출시용이 아니다.
