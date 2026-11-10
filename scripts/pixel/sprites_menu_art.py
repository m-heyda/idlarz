"""Menu button art generated outside the build (Sprite Fusion, 64 x 64, a prop on a grey stone slab) and kept in scripts/pixel/assets/menu/.

Each picture is copied 1:1 into public/pixel/icons/ (no resampling). `merchant`, `farm`, `crafting` and `rebirth` replace the built `menu_merchant`, `menu_farm`, `menu_crafting` and `menu_legacy`;
`equipment` is the new `menu_equipment` (the Equipment button and window; `menu_character`, the helm, stays for the hero picker). `achievements`, `glossary`, `gems_pouch` and `bag_scroll` are not wired yet.
They are drawn bigger than the old 40 px buttons: the header menu scales them down until the menu is reworked."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'assets', 'menu')
CELL = 64

# source file -> icon name
FILES = {
    'equipment': 'menu_equipment', 'merchant': 'menu_merchant', 'farm': 'menu_farm', 'crafting': 'menu_crafting', 'rebirth': 'menu_legacy',
    'achievements': 'menu_achievements', 'glossary': 'menu_glossary', 'gems_pouch': 'menu_gems_pouch', 'bag_scroll': 'menu_bag_scroll',
}


def art(name):
    img = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')
    if img.size != (CELL, CELL):
        raise ValueError(f'{name}.png is {img.size}, expected {CELL}x{CELL}')
    return img


SPRITES = {icon: (lambda n=n: art(n)) for n, icon in FILES.items()}
