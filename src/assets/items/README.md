# 중세 판타지 아이템 아이콘

- `icons-source.png`: 이미지 생성 도구로 제작한 세 아이템의 투명 배경 원화. 왼쪽부터 회복 물약·도시락·슬라임 점액이다.
- `potion.png`: 붉은 회복액, 코르크 마개와 가죽 장식 유리병.
- `lunch.png`: 천으로 싼 빵·치즈·사과 여행식.
- `slime-gel.png`: 토기에 담긴 청록색 점액 재료. 몬스터의 얼굴은 그리지 않는다.
- 개별 PNG는 256×256이며 투명 여백을 포함한다.
- `icons.webp`와 `icons.json`: 게임에서 읽는 400×136 아틀라스. 각 프레임은 128×128이고, 창을 열 때마다 같은 텍스처를 재사용한다. 원화와 개별 PNG는 게임에서 로드하지 않는다.

`python3 tools/build_item_icons.py`로 개별 파일과 실행용 압축본을 재생성한다. 원화의 빈 간격으로 나눠 도시락의 천 끝이 잘리지 않도록 한다. 아이템 ID는 `src/items/inventory.ts`, 표시 연결은 `src/ui/itemIcons.ts`와 `ItemPanel.ts`에 있다.
