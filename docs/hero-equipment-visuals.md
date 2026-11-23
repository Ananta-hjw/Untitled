# 주인공 장비 외형 변경 설계 (초안)

> 향후 무기와 방어구가 수십 종 이상 늘어나는 것을 전제로 한 외형 변경 설계서다. 현재 공격 모션 작업이 마무리된 뒤 단계적으로 반영한다.

## 방향: 대표 실루엣 + 색상 치환 + 무기·머리·망토 파츠

주인공은 고해상도 회화풍 8방향 통짜 스프라이트 시트(`src/assets/hero/academy/`)를 사용한다. 이 회화풍 퀄리티와 역동적인 동작을 유지하면서도 많은 장비를 감당하기 위해 부위별로 역할을 나눈다.

| 부위 | 슬롯 (`equipment.ts`) | 외형 반영 방식 | 아이템 1종 추가 시 준비물 |
|---|---|---|---|
| **무기 (칼)** | `weapon` | **100% 개별 외형 교체** | 측면 직선 검 1장 + 전방/후방 3/4 원근 검 2장 + `atlas.json` 1줄 |
| **몸통 (갑옷·코트)** | `body` | **대표 실루엣 4~5종 × 의상 색상 치환** | 실루엣 추가 시 전 동작 시트 1세트 / 색상 변형은 팔레트 수치 1줄 |
| **머리 (두건·투구)** | `head` | **5방향 소형 파츠** (머리 기준점 부착) | `front`·`back`·`side`·`down-diag`·`up-diag` 5장 |
| **망토** | `body` 또는 `cloak` | **5방향 소형 파츠** (어깨 기준점 부착) | 5방향 정지 파츠 5장 (방향별 앞/뒤 자동 전환) |
| **장갑·신발·장신구** | `hands`, `feet`, `accessory1~2` | 장비창 아이콘·스탯 중심 *(희귀 장신구는 검기·잔상 색감 포인트 가능)* | 아이콘 1장 |

---

## 1. `HeroSprite` 렌더링 레이어 순서

현재 4개 레이어(`weaponBack → image → supportHand → weaponFront`)를 **7개 레이어**로 확장한다.

```text
[뒤] cloakBack → weaponBack → body → supportHand → headgear → cloakFront → weaponFront [앞]
```

- **정면·측면·앞대각선(`down`, `left`, `right`, `down-*`)**: 망토는 `cloakBack`(몸 뒤), 두건과 검은 앞쪽.
- **후면·뒤대각선(`up`, `up-*`)**: 망토는 `cloakFront`(등 위), 검은 기존 `weaponBehind` 규칙으로 몸 뒤.
- 왼쪽 계열(`left`, `down-left`, `up-left`)은 몸과 함께 파츠도 `scaleX = -1`로 대칭 반전한다.
- 회피 잔상(`spawnGhost`)도 현재 활성화된 레이어 구성을 그대로 복사한다.

---

## 2. 부위별 세부 설계

### ① 무기 (`weapon`)
- 기존 `src/entities/weaponPose.ts`와 `src/assets/hero/weapons/` 구조를 그대로 확장한다.
- 현재 등록된 무기 4종(`wooden-sword`, `short-sword`, `long-sword`, `iron-sword`) 중 `short-sword`와 `long-sword`의 전용 원화를 추가하면 4종 모두 개별 외형을 갖게 된다.
- `atlas.json`의 `bladeLength`와 `guardX`를 검마다 지정하므로, 검 길이에 따라 화면 표시 크기와 실제 칼날 명중 판정(`HeroSprite.getBlade()`)이 자동 동기화된다.

### ② 몸통 방어구 (`body`) — 대표 실루엣 + 의상 영역 색상 치환
- **대표 실루엣(장기 목표 4~5벌)**:
  1. `academy`: 기본 붉은 코트 / 수련복 계열
  2. `leather`: 가죽 갑옷·경갑 계열
  3. `plate`: 판금·중갑 계열
  4. `robe`: 로브·천 의상 계열
- **의상 색상 치환(Canvas 전처리 캐싱)**:
  - 스프라이트 전체에 `setTint()`를 적용하면 얼굴·피부·머리카락까지 변색되므로 사용하지 않는다.
  - 대신 **장비를 교체하는 순간 1회만** Offscreen Canvas에서 의상 색상 범위(또는 의상 마스크) 픽셀의 색조·채도·명도(HSL)를 치환해 새 Phaser 텍스처(`hero-body-<silhouette>-<paletteId>`)로 캐싱한다.
  - Phaser 4 WebGL 쉐이더 호환성 문제를 피하고, 전투 중 60fps 성능 저하를 없앤다.
  - 실루엣 4~5벌 × 색상 변형으로 **20~40종 이상의 방어구 외형**을 확보할 수 있다.

### ③ 머리 (`head`) & 망토 (`cloak`) — 5방향 파츠와 기준점
- `frames.json` 각 프레임에 `head: { x, y }`, `shoulder: { x, y }` 기준점을 한 번만 측정해 둔다.
- 이후 새 모자·두건·투구·망토가 추가되어도 5방향 정지 이미지(`front`, `back`, `side`, `down-diag`, `up-diag`)만 넣으면 모든 걷기·공격·막기·회피 프레임에 자동 부착된다.

---

## 3. 코드 모듈 구성

| 파일 | 역할 |
|---|---|
| `src/items/equipment.ts` | `GearDef`에 `visual?: GearVisual` 추가 (`weapon`, `body`, `palette`, `head`, `cloak`) |
| `src/entities/heroAppearance.ts` *(신규)* | 현재 `equipped` 장비 조합 → 최종 외형 명세(`HeroAppearance`) 계산 (Phaser 미사용, 순수 로직) |
| `src/entities/armorPalette.ts` *(신규)* | 의상 픽셀 영역만 HSL 치환해 Phaser 텍스처로 1회 캐싱 |
| `src/entities/HeroSprite.ts` | `setAppearance(appearance)` 추가 (기존 `setWeapon()` 통합·확장), `head`/`shoulder` 앵커 파츠 배치 |
| `src/scenes/GameScene.ts` | 장비 장착·해제·맵 전환·저장 복원 시 `hero.setAppearance(...)` 호출 |
| `tools/hero-appearance.test.mjs` *(신규)* | 장비 조합별 외형 매핑, 팔레트 기본값, 해제 시 복귀 회귀 테스트 |

```ts
export interface ArmorPalette {
  id: string;
  hueShift: number;   // 색조 회전 (-180 ~ 180)
  saturation: number; // 채도 배율 (0.0 ~ 1.5)
  lightness: number;  // 명도 배율 (0.5 ~ 1.4)
}

export interface GearVisual {
  weapon?: string;          // 예: 'wooden-sword', 'short-sword', 'long-sword', 'iron-sword'
  body?: string;            // 예: 'academy', 'leather', 'plate', 'robe'
  palette?: ArmorPalette;   // 의상 색상 변형
  head?: string;            // 예: 'cloth-hood'
  cloak?: string;           // 예: 'travel-cloak'
}
```

---

## 4. 단계별 구현 로드맵

1. **1단계 — 외형 시스템 뼈대 + 의상 색상 치환 (`armorPalette`)**:
   `heroAppearance.ts`와 `HeroSprite.setAppearance()`를 도입해 `worn-tunic` · `leather-armor` · `travel-cloak` 장착 시 코트/의상 색감이 즉시 바뀌도록 연결한다.
2. **2단계 — 무기 4종 개별 외형 완성**:
   `short-sword`, `long-sword` 원화를 추가해 무기 4종이 모두 다른 외형과 길이로 동작하게 한다.
3. **3단계 — 머리·망토 5방향 파츠 연동**:
   공격 모션 시트가 최종 확정된 뒤 `frames.json`에 `head`/`shoulder` 기준점을 측정하고, `cloth-hood`·`travel-cloak` 5방향 파츠를 연결한다.
4. **4단계 — 대표 갑옷 실루엣 시트 확장**:
   중반 이후 챕터 확장에 맞춰 `leather`, `plate`, `robe` 전용 실루엣 시트를 순차 추가한다.
