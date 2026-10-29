"""Resource art that is generated outside the build (Sprite Fusion) and dropped into public/pixel/resources/.

The pictures are 32 x 32; the icon registry (src/config/pixelIcons.ts) and the twinkle strips use 40 x 40 frames, so each one is
centred on a transparent 40 x 40 canvas at 1:1 (a picture may be smaller than 32 x 32, e.g. the cropped Embers gem) (no resampling). Icon name -> file in public/pixel/resources/ (without .png).
The rest of that folder is the roster (src/catalog/resourceArt.ts) or spare art with a "_" prefix, and is not built into icons."""
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'public', 'pixel', 'resources')
CELL = 40

# icon name in the game -> file in public/pixel/resources/
USED = {
    'gold': 'gold', 'wood': 'wood', 'stone': 'stone', 'coal': 'coal', 'food': 'food', 'meat': 'meat',
    'eggs': 'eggs', 'milk': 'milk', 'hide': 'hide', 'xp': 'xp',
    'legacy': 'embers',          # the rebirth currency kept its old sprite name
    'diamond': 'gems',           # the premium currency
    'res_fish': 'fish', 'res_iron': 'iron-ore',
}


def art(icon):
    img = Image.open(os.path.join(SRC, f'{USED[icon]}.png')).convert('RGBA')
    canvas = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((CELL - img.width) // 2, (CELL - img.height) // 2))
    return canvas


SPRITES = {icon: (lambda i=icon: art(i)) for icon in USED}
