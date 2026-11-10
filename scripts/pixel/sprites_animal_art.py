"""Farm animal art generated outside the build (Sprite Fusion, 96 x 96, transparent) and kept in scripts/pixel/assets/animals/.

Each picture is copied 1:1 into public/pixel/icons/ as `animal_<file>` (no resampling). The farm draws them at half size (an exact 2:1 step,
see src/components/game/overlays/farmGeometry.ts). chicken_1/2 and cow_1/2 are variants of one animal (the farm picks one per animal, see
`animalIcon` in src/config/pixelIcons.ts); duck and rooster are not used by the farm yet."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'assets', 'animals')
CELL = 96

FILES = ('chicken_1', 'chicken_2', 'cow_1', 'cow_2', 'pig', 'sheep', 'duck', 'rooster')


def art(name):
    img = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')
    if img.size != (CELL, CELL):
        raise ValueError(f'{name}.png is {img.size}, expected {CELL}x{CELL}')
    return img


SPRITES = {f'animal_{n}': (lambda n=n: art(n)) for n in FILES}
