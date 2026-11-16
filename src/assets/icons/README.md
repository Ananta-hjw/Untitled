# 아이콘

상태창·장비창·아이템창에 쓰는 아이콘을 여기에 넣으면 게임이 자동으로 읽습니다(`src/ui/icons.ts`).
그림이 없는 칸은 색 상자와 글자로 임시 아이콘을 그립니다.

- 형식: 투명 배경 PNG(또는 WebP), 정사각형 권장. 128 × 128 이상이면 충분합니다. 칸의 82% 크기로 줄여 그립니다.
- 파일 이름 = id. 폴더별로 아래 이름을 씁니다.

| 폴더 | 파일 이름 |
| --- | --- |
| `items/` (소모품·재료) | `potion`, `lunch`, `slime-gel` |
| `items/` (장비) | `practice-sword`, `iron-sword`, `cloth-hood`, `worn-tunic`, `leather-armor`, `leather-gloves`, `light-boots`, `clover-charm`, `blue-bead` |
| `stats/` (능력치) | `str`, `vit`, `def`, `dex`, `int`, `luk` |
| `slots/` (빈 장비 칸, 흐리게 표시) | `weapon`, `head`, `body`, `hands`, `feet`, `accessory` |

예: `src/assets/icons/items/iron-sword.png`, `src/assets/icons/stats/str.png`
