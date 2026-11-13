# Untitled

모바일 RPG 프로토타입. Phaser + TypeScript + Vite.

가상 조이스틱(화면에 고정된 원형 패드)으로 한 장짜리 배경 위를 360도로 돌아다닌다.
지금 보이는 그림은 전부 코드로 그린 임시 그래픽이다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

같은 와이파이의 휴대폰에서 터미널에 표시되는 Network 주소로 접속하면 터치로 조작할 수 있다.
PC에서는 방향키나 WASD로 움직인다. 주소 뒤에 `?debug`를 붙이면 이동 가능 영역이 보인다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run build:single` | HTML 한 파일로 묶은 빌드 (`dist-single/`) |
| `npm run typecheck` | 타입 검사 |

## 구조

| 파일 | 역할 |
|---|---|
| `src/config.ts` | 화면 크기, 이동 속도 등 상수 |
| `src/ui/VirtualJoystick.ts` | 고정형 가상 조이스틱 (멀티터치, 데드존) |
| `src/world/walkArea.ts` | 이동 가능 영역(다각형)과 장애물(타원) |
| `src/entities/Character.ts` | 플레이어·NPC·몬스터 공통 틀, Y정렬 |
| `src/world/placeholderArt.ts` | 임시 그래픽. 실제 아트로 교체할 부분 |
| `src/scenes/GameScene.ts` | 맵 배치, 입력, 이동, 카메라 |
