# 제작된 캐릭터의 게임 연결

기본 초상화와 SD가 있는 `src/assets/characters/*`의 모든 인물을 NPC 외형과
대화 데이터에 등록했다. `tools/cast-assets.test.mjs`가 폴더와 등록 명단을 비교한다.
아래 추가 인물은 아직 본편의 등장 지역·사건이 구현되지 않아 확인 모드로 배치한다.
본편의 퀘스트·진행 단계나 방문 기록을 앞당기지 않는다.

## 추가 등록한 인물

| 인물 | 연결된 그림/동작 |
| --- | --- |
| 토비 | 전신 초상화, 8방향 걷기, 몽유 4자세, 풀무질 2자세, 안개 고치 |
| 가짜 종 사내 | 전신 초상화, 8방향 걷기, 종 울리기 4자세, 붙잡힌 자세 |
| 사내의 어머니 | 전신 초상화, 걸상에 앉은 SD |
| 브람·미렐·카이렌·벨카·라젠 | 각자의 초상화와 8방향 대기·이동 시트 |

여관 주인과 2장 주요 여섯 명의 기존 연결도 유지한다.
계승자들의 전투 수치나 새 전투 그림은 추가하지 않았다.
기본 SD는 원본으로 보존하고, 걷기 시트가 있는 인물은 그 시트의 대기 칸을 실제 외형으로 쓴다.

## 확인 방법

개발 서버에서:

- `?map=east-stream&npcs=support&companion=none`: 여관 주인·토비·종 사내·어머니.
  토비는 풀무질, 사내는 종 울리기를 한다.
- 위 주소에 `&action=cocoon`: 토비가 고치 안에 잠든 모습.
  말을 걸면 시온이 상태를 살피며 잠든 토비의 대사는 나오지 않는다.
- 위 주소에 `&action=idle`: 조연들의 기본 SD.
- `?map=east-stream&npcs=successors&companion=none`: 계승자 다섯 명.
- `?map=east-stream&npcs=all&companion=none`: 기존 2장 여섯 명과 조연·계승자.
- 기존 `npcs=chapter2` 여섯 명, `npcs=innkeeper&sleepwalk=1`도 유지한다.

확인 모드는 개발 빌드에만 적용한다. 등장 시점이 정해지면 같은 NpcDef를 실제 지역의
NPC 목록에 배치하면 된다. 본편 고갯길의 도르·퀘스트 3은 그대로 동작한다.

## 전용 동작 API

`Npc.setStoryAction('bellows' | 'cocoon' | 'ring')`는 해당 외형이 지원하는 동작만
설정한다. 지원하지 않으면 false를 반환하고 기존 상태를 유지한다.
인자 없이 호출하면 기본 외형과 대화로 돌아온다.
`npcStoryActions.ts`에 원본을 보존한 실행용 시트·프레임·배율을 등록했다.

- 토비의 풀무질은 대화 중 멈추고, 대화 뒤 잠깐 기다렸다 이어 간다.
- 사내는 말을 걸면 종 울리기를 멈추고 기본 SD로 돌아온다.
- 고치는 대화해도 풀리지 않는다. 구출 연출이 명시적으로 동작을 해제해야 한다.
- 별도 브라우저 타이머 없이 NPC가 받는 게임 시간으로 재생해 메뉴·대화와 함께 멈춘다.
- 풀무 장치와 어머니의 걸상은 인물 그림에 포함되어 있으므로 중복 소품을 두지 않는다.

`PYTHONDONTWRITEBYTECODE=1 python3 tools/build_successor_runtime.py`는 계승자 원본을
보존하며 초상화 768높이 사본과 60% 크기의 걷기 WebP를 재생성한다.

## 2장 특수 동작 확인

- 본편에서 도르는 쉼터 불을 돌보고, 에반은 강가에 앉아 있다. 「사라진 다섯」의 어부의 딸·약초 가게 할머니·에반은 대사에 맞춰 자세를 바꾼다.
- 1장 습격에서 쓰러진 일반 경비병은 전용 그림을 쓴다. 갈대밭 늪의 잠복 마물은 멀리 있을 때 몸을 숨기고, 시온이 접근하면 출현한 뒤 물줄기 공격을 한다.
- `?map=east-stream&npcs=support&actor=toby&action=sleepwalk`에서 토비가 몽유로 걷는다. `actor=fisher-daughter&action=walk`처럼 지정하면 인물의 보행을 확인할 수 있다.
- `?map=east-stream&npcs=all&actor=evan&action=rope-pull`처럼 인물 ID와 등록된 동작 이름을 지정해 다음 장면의 원화를 본다. 예를 들어 `actor=bell-ringer&action=caught`로 붙잡힌 종 사내를 확인할 수 있다.
- `?map=east-stream&npcs=rescue`와 `?map=east-stream&npcs=bell-carry`는 각각 실종자 네 명의 구출과 종 운반을 재생한다. `?map=reed-swamp&monsters=mist-weaver`에서 안개를 잣는 자와 본체 그림자를 확인한다.
