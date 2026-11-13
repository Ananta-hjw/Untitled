# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

가상 조이스틱(화면에 고정된 원형 패드)으로 한 장짜리 배경 위를 360도로 돌아다니고,
공격 버튼(누르고 있으면 3단 콤보)과 회피 버튼으로 몬스터와 실시간으로 싸운다.
주인공은 실제 그림(걷기 4프레임)을 쓰고, 나머지는 코드로 그린 임시 그래픽이다.

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
| `src/world/heroArt.ts` | 주인공 그림 등록 (`src/assets/hero/`) |
| `tools/cut_sprites.py` | 캐릭터 시트에서 한 줄을 잘라 게임용 스프라이트 시트로 변환 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 맵 배치, 입력, 이동, 카메라, 타격 판정 |
