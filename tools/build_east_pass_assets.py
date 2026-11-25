"""Encode separate east-pass objects and terrain; never flatten props onto ground."""
import json
from pathlib import Path
from PIL import Image
from build_map_art import encode_ground_tiles

ROOT = Path(__file__).resolve().parents[1] / 'src/assets/maps/east-pass'
# Origins/size hints are relative to the trimmed runtime art, not global map scale.
SPECS = {
    'dead-tree': (512, 0.49, 0.98, 250),
    'cliff-straight': (1024, 0.5, 0.98, 740),
    'cliff-corner': (1024, 0.5, 0.98, 680),
    'stone-shelter': (1024, 0.5, 0.98, 520),
}


def main():
    objects = {}
    ground = {**encode_ground_tiles(ROOT / 'ground.png'), 'containsSolidObjects': False}
    for name, (limit, ox, oy, display_width) in SPECS.items():
        with Image.open(ROOT / f'{name}.png') as source:
            image = source.convert('RGBA')
        alpha = image.getchannel('A')
        assert alpha.getextrema()[0] == 0, name
        box = alpha.point(lambda a: 255 if a >= 128 else 0).getbbox()
        assert box is not None, name
        l, t, r, b = box
        assert l > 0 and t > 0 and r < image.width and b < image.height, f'{name}: clipped silhouette'
        crop = (max(0, l - 4), max(0, t - 4), min(image.width, r + 4), min(image.height, b + 4))
        image = image.crop(crop)
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        image.save(ROOT / f'{name}.webp', quality=92, method=6)
        objects[name] = {'file': f'{name}.webp', 'width': image.width, 'height': image.height,
                         'sourceCrop': list(crop), 'originX': ox, 'originY': oy,
                         'suggestedDisplayWidth': display_width,
                         'collisionStatus': 'requires layout-specific footprint; not gameplay collision data'}
    manifest = {'ground': ground, 'objects': objects,
                'proposedWorld': {'width': 4800, 'height': 3200, 'status': 'proposal; not connected'},
                'reuse': {'texture': 'village-props', 'frames': ['pine', 'boulders', 'rock', 'shrub', 'stump', 'sign'],
                          'fireTexture': 'festival-props', 'fireFrames': ['bonfire-base', 'flame-0', 'flame-1', 'flame-2', 'flame-3']}}
    (ROOT / 'assets.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('East pass: ground and four independent transparent props ready')


if __name__ == '__main__':
    main()
