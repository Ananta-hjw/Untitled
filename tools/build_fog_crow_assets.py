"""Measure fog crow animation sheets and encode runtime copies; preserve source PNGs."""
import json
from pathlib import Path
from PIL import Image
from build_monster_frames import build

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/monsters/fog-crow'


def main():
    build('fog-crow')
    data = json.loads((ROOT / 'animation_frames.json').read_text())
    data['animations']['walk']['fps'] = 10
    # All four drawn wing poses belong to the cycle (including level wings).
    data['animations']['walk']['poses'] = [0, 1, 2, 3]
    data['animations']['attack']['fps'] = 12
    data['animations']['attack']['poses'] = [0, 1, 2, 3]
    data['anchorNote'] = 'Fixed per-direction idle silhouette pivot for airborne flight. Set flight height and verify body pivot on integration; attack timings are preview suggestions, not combat balance.'
    for filename in data['sheets']:
        with Image.open(ROOT / filename) as image:
            image.save(ROOT / Path(filename).with_suffix('.webp'), quality=92, method=6)
    for name in ['sd_idle', 'afterimage']:
        with Image.open(ROOT / f'{name}.png') as image:
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            image.save(ROOT / f'{name}-512.webp', quality=92, method=6)
    data['effects'] = {'afterimage': {'file': 'afterimage-512.webp', 'direction': 'down-right',
                                    'note': 'Single drawn decoy pose; fade in code, no shadow. Other directions can reuse a faded current flight frame.'}}
    (ROOT / 'animation_frames.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print('Fog crow: 64 frames / 8 directions, idle and afterimage runtime copies ready')


if __name__ == '__main__':
    main()
