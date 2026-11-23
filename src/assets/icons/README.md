# 아이콘

상태창·장비창·아이템창에 쓰는 아이콘을 여기에 넣으면 게임이 자동으로 읽습니다(`src/ui/icons.ts`).
물약·도시락·슬라임 점액·철검·가죽 갑옷과 페른의 여행 상품 4종은 `src/assets/items/icons.webp`의 공용 프레임을 재사용합니다. 이 폴더에 같은 ID의 개별 이미지가 있으면 우선 사용하고, 둘 다 없는 칸은 색 상자와 글자로 임시 아이콘을 그립니다.

- 형식: 투명 배경 PNG(또는 WebP), 정사각형 권장. 128 × 128 이상이면 충분합니다. 칸의 82% 크기로 줄여 그립니다.
- 파일 이름 = id. 폴더별로 아래 이름을 씁니다.

| 폴더 | 파일 이름 |
| --- | --- |
| `items/` (소모품·재료) | `potion`, `lunch`, `slime-gel`, `travel-biscuit`, `blue-dew`, `antidote-herb` |
| `items/` (장비) | `wooden-sword`, `short-sword`, `long-sword`, `iron-sword`, `cloth-hood`, `worn-tunic`, `leather-armor`, `leather-gloves`, `light-boots`, `clover-charm`, `blue-bead`, `travel-cloak` |
| `stats/` (능력치) | `str`, `vit`, `def`, `dex`, `int`, `luk` |
| `slots/` (빈 장비 칸, 흐리게 표시) | `weapon`, `head`, `body`, `hands`, `feet`, `accessory` |

예: `src/assets/icons/items/iron-sword.png`, `src/assets/icons/stats/str.png`

## 중세 RPG 장비 아이콘

`items/short-sword.webp`, `long-sword.webp`, `cloth-hood.webp`, `worn-tunic.webp`는 중세 RPG풍으로 제작한 투명 배경 256×256 아이콘입니다. 기존 철검·가죽 갑옷을 화풍 기준으로 사용했습니다. 짧은 검은 넓고 짧은 날, 긴 검은 긴 날과 손잡이, 천 두건은 소박한 리넨, 낡은 수련복은 덧댄 천과 해진 옷단으로 구분합니다.

원화는 `src/assets/items/starter-gear-source.png`이며 `python3 tools/build_starter_gear_icons.py`로 2×2 원화를 나누고 투명 여백을 맞춘 실행 파일을 재생성합니다. `IconView`가 같은 ID의 파일을 자동으로 연결하므로 장비창·가방·대장간에서 글자 대체 표시 없이 그림을 사용합니다.

페른의 여행 상품은 `items/travel-biscuit.webp`·`blue-dew.webp`·`antidote-herb.webp`·`travel-cloak.webp`에 있습니다. 모두 투명 배경 256 × 256이며 공용 아이템 시트에도 같은 ID로 등록했습니다. 원본과 수레 그림의 구성은 `../items/fern/README.md`, 재생성은 `python3 tools/build_fern_assets.py`를 참고하세요.

`items/leather-gloves.webp`, `light-boots.webp`, `clover-charm.webp`, `blue-bead.webp`도 같은 화풍의 256×256 투명 아이콘입니다. 장갑·장화는 갈색 가죽과 황동 버클, 네잎 부적은 청동 테두리 안의 네잎클로버, 목걸이는 가죽끈과 둥근 푸른 유리 구슬로 표현했습니다. 원화 `src/assets/items/accessory-gear-source.png`도 같은 생성 스크립트에서 처리합니다. 목걸이 끈은 윗부분까지 온전히 표시합니다.
