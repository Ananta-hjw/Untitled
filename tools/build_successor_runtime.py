"""Encode existing successor portraits and walking sheets without changing originals."""
from PIL import Image
from build_rowen_assets import CHARACTERS, fit_height

for name in ['bram', 'mirel', 'kairen', 'velka', 'razen']:
    folder = CHARACTERS / name
    fit_height(folder / 'dialogue.png', folder / 'dialogue-768.webp', 768)
    for sheet in ['walk_cardinal', 'walk_diagonal']:
        with Image.open(folder / f'{sheet}.png') as image:
            image.resize((round(image.width * 0.6), round(image.height * 0.6)), Image.Resampling.LANCZOS).save(
                folder / f'{sheet}-60.webp', quality=88, method=6)
    print(f'{name}: runtime portrait + 8-direction walking copies ready')
