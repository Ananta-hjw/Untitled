"""Create mobile WebP copies; preserve all original PNG art and measured coordinates."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/monsters'
for name in ['slime', 'waterdrop-mushroom', 'iron-scale-lizard', 'ashen-moth', 'corrosion-tracker', 'corrosion-executioner', 'frost-beetle']:
    for source in sorted((ROOT / name).glob('*.png')):
        if not (source.stem.startswith(('walk_', 'attack_')) or source.stem == 'projectile'):
            continue
        with Image.open(source) as image:
            image.resize((round(image.width * .6), round(image.height * .6)), Image.Resampling.LANCZOS).save(
                source.with_suffix('.webp'), 'WEBP', quality=82, method=6)
        print(source.with_suffix('.webp').relative_to(ROOT))

# Tight runtime frame for the water bead; keeps transparent source padding out of its hit position.
with Image.open(ROOT / 'waterdrop-mushroom/projectile.webp') as image:
    x0, y0, x1, y1 = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    frame = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}
(ROOT / 'waterdrop-mushroom/projectile_frame.json').write_text(json.dumps(frame, indent=2) + '\n')
