# 첫 화면 배경

- `overlook.png`: 시온이 높은 곳에서 에르다인을 바라보는 뒷모습 원화. 기존 `hero/dialogue/neutral-768.png`의 머리·붉은 외투·등의 칼집을 참고해 생성했다.
- `background.webp`: 게임에서 읽는 압축본(1672×941, 약 227KiB). 원화는 런타임에 읽지 않는다.
- 제목과 버튼은 그림에 포함하지 않고 `TitleScene.ts`에서 별도로 배치한다. 4:3부터 넓은 모바일 화면까지 중앙 기준으로 배경을 채운다.

압축본 재생성(Pillow):

```python
from PIL import Image
Image.open('src/assets/title/overlook.png').convert('RGB').save(
    'src/assets/title/background.webp', quality=84, method=6)
```
