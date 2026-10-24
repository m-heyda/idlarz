"""Sprites that come from the supplied sheet (extract_sheet.py), their twinkle strips and the chest's idle sheet.

Shine strips are 6 frames of the sprite with 4-point glints that swell and fade out of phase (the old gold coin
twinkle, now for every shiny resource). Sheets are one row of equal frames, drawn at native size."""
from PIL import Image
import fx
from sprites_resources import sheet_sprite

# game name -> asset name (they match; kept explicit so the build list reads as the sheet mapping)
SHEET_NAMES = ('gold', 'wood', 'stone', 'coal', 'meat', 'res_iron', 'res_fish', 'res_mana', 'res_crystal',
               'res_sapphire', 'res_mystery', 'gems', 'chest_map', 'bonus_chest')

# sprites that twinkle, and how many glints each carries
SHINE = {'gold': 2, 'gems': 2, 'res_crystal': 2, 'res_sapphire': 2, 'res_mana': 2, 'res_mystery': 1}
CHEST_FRAMES = 4


def _bright_spots(img, n, min_dist, warm=False):
    """The n brightest opaque pixels, spread apart (glints sit on highlights)."""
    px = img.load()
    cand = []
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            if warm:
                lum += 0.3 * (r - b)
            cand.append((lum, y, x))
    cand.sort(reverse=True)
    picked = []
    for _, y, x in cand:
        if all(abs(x - px_) + abs(y - py_) >= min_dist for px_, py_ in picked):
            picked.append((x, y))
        if len(picked) == n:
            break
    return picked


def shine_strip(name):
    """6-frame twinkle strip for a sheet sprite."""
    base = sheet_sprite(name)
    spots = _bright_spots(base, SHINE[name], 12)
    frames = fx.shine_frames(base, spots)
    w, h = base.size
    strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * w, 0))
    return strip


def chest_anim():
    """Idle frames for the map chest: a glint walks across the lid and the lock flashes."""
    base = sheet_sprite('chest_map')
    w, h = base.size
    spots = _bright_spots(base, 3, 9, warm=True)
    radii = ((0, 1, 2, 1), (1, 0, 1, 2), (2, 1, 0, 1))
    frames = []
    for i in range(CHEST_FRAMES):
        f = base.copy()
        for j, (x, y) in enumerate(spots):
            fx.glint(f, x, y, radii[j % 3][i])
        frames.append(f)
    strip = Image.new('RGBA', (w * CHEST_FRAMES, h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * w, 0))
    return strip


SPRITES = {name: (lambda n=name: sheet_sprite(n)) for name in SHEET_NAMES}
SHEETS = {f'{name}_shine': (lambda n=name: shine_strip(n)) for name in SHINE}
SHEETS['chest_map_anim'] = chest_anim
