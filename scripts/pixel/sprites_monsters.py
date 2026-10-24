"""Monsters and the items that come with them.

- monster_rat (2-frame idle sheet, 2 x 40x40) and monster_ratking (2 x 56x56, crowned): 3/4 view, head to the
  lower-left like the farm animals.
- item_potion_hp (40x40) and the wooden starter kit.
- the 12 Rattatui set icons: the slot pieces from sprites_equipment re-skinned in rat materials (fur, pink, tan).
"""
import math
from PIL import Image
from render3d import Scene, Prim, rot, between, I3, add, mul
from materials import MATS
import fx
import sprites_equipment as eq


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


# ----------------------------------------------------------------- the rat
def _rat(sc, bob=0.0, tail=0.0, king=False):
    z = bob
    _P(sc, 'ell', (0.15, 0, 0.52 + z), (0.75, 0.4, 0.4), 'rat_fur', I3, None, 1)                 # body
    _P(sc, 'ell', (0.62, 0, 0.55 + z), (0.4, 0.42, 0.4), 'rat_fur', I3, None, 2)                 # haunch
    _P(sc, 'ell', (-0.36, 0, 0.58 + z), (0.4, 0.37, 0.38), 'rat_fur', I3, None, 3)               # chest
    _P(sc, 'ell', (-0.78, 0, 0.64 + z), (0.36, 0.28, 0.28), 'rat_fur', rot(0, -8, 0), None, 4)   # head
    _P(sc, 'ell', (-1.1, 0, 0.55 + z), (0.26, 0.16, 0.15), 'rat_fur', rot(0, 12, 0), None, 5)    # snout
    _P(sc, 'ell', (-1.33, 0, 0.5 + z), (0.08, 0.08, 0.07), 'rat_pink')                           # nose
    _P(sc, 'box', (-1.22, 0, 0.36 + z), (0.04, 0.05, 0.08), 'bone')                              # buck teeth
    for s in (-1, 1):
        _P(sc, 'ell', (-0.66, 0.26 * s, 0.97 + z), (0.15, 0.05, 0.19), 'rat_pink', rot(0, 0, 14 * s), None, 6)  # ears
        _P(sc, 'ell', (-0.52, 0.2 * s, 0.08), (0.13, 0.08, 0.06), 'rat_pink')                    # front paws
        _P(sc, 'ell', (0.72, 0.3 * s, 0.1), (0.22, 0.1, 0.07), 'rat_pink')                       # hind feet
    _P(sc, 'ell', (-0.96, -0.22, 0.78 + z), (0.06, 0.045, 0.06), 'eye_glow')                     # glowing red eye
    for k in range(9):                                                                           # tail
        t = k / 8
        _P(sc, 'ell', (0.95 + 0.85 * t, tail * math.sin(t * 3.0), 0.4 + 0.5 * t ** 1.6),
           (0.075 - 0.03 * t,) * 3, 'rat_pink')
    for dy in (-0.2, -0.05):                                                                     # whiskers
        sc.add(between('cyl', (-1.25, dy, 0.52 + z), (-1.5, dy - 0.28, 0.58 + z), (0.012,), 'rat_tan', None, (0, 0, 1)))


def _king_extras(sc, bob=0.0):
    z = bob
    _P(sc, 'ell', (0.4, 0.0, 0.86 + z), (0.62, 0.46, 0.2), 'cloth', I3, None, 20)                # red cape draped over the back
    _P(sc, 'ell', (0.86, 0.0, 0.62 + z), (0.3, 0.34, 0.24), 'cloth', I3, None, 21)               # cape tail over the haunch
    _P(sc, 'ell', (-0.08, 0.0, 0.88 + z), (0.12, 0.5, 0.2), 'rat_tan', I3, None, 22)             # fur collar
    _P(sc, 'cyl', (-0.8, 0, 0.99 + z), (0.2, 0.05), 'gold')                                       # crown band
    for k in range(5):
        a = math.radians(k * 72 + 36)
        _P(sc, 'ell', (-0.8 + 0.19 * math.cos(a), 0.19 * math.sin(a), 1.1 + z), (0.055, 0.055, 0.12), 'gold')
    _P(sc, 'ell', (-0.97, -0.03, 1.0 + z), (0.06, 0.06, 0.06), 'ruby')                           # crown jewel


def _sheet(frames):
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * w, 0))
    return out


def monster_rat():
    frames = []
    for bob, tail in ((0.0, 0.18), (0.05, -0.18)):
        sc = Scene(MATS, scale=17.0, origin=(20, 33))
        _rat(sc, bob, tail)
        frames.append(sc.render())
    return _sheet(frames)


def monster_ratking():
    frames = []
    for bob, tail in ((0.0, 0.2), (0.06, -0.2)):
        sc = Scene(MATS, size=56, scale=21.0, origin=(30, 46))
        _king_extras(sc, bob)
        _rat(sc, bob, tail, king=True)
        frames.append(sc.render())
    return _sheet(frames)


# ----------------------------------------------------------------- potion
def potion():
    sc = Scene(MATS, scale=13.0, origin=(20, 33))
    sc.add(Prim('ell', (0, 0, 0.75), (0.8, 0.8, 0.8), 'ruby', I3, None, 1))                       # flask full of red liquid
    sc.add(Prim('ell', (0, 0, 1.0), (0.5, 0.5, 0.18), 'glass', I3, None, 2))                      # glass shoulder
    sc.add(Prim('cyl', (0, 0, 1.55), (0.26, 0.4), 'glass', I3, None, 3))                          # neck
    sc.add(Prim('cyl', (0, 0, 1.98), (0.3, 0.06), 'gold'))                                        # collar
    sc.add(Prim('cyl', (0, 0, 2.2), (0.2, 0.2), 'bark', I3, None, 4))                             # cork
    img = sc.render()
    fx.glint(img, 15, 17, 2)
    return img


# ----------------------------------------------------------------- re-skins of the slot icons
def _mats(remap):
    out = dict(MATS)
    for key, value in remap.items():
        out[key] = MATS[value]
    return out


def _skin(fn, remap, glint=False):
    """Render a sprites_equipment icon with some materials swapped (and, for fur items, without metal glints)."""
    old_mats, old_glint = eq.MATS, fx.glint
    eq.MATS = _mats(remap)
    if not glint:
        fx.glint = lambda *a, **k: None
    try:
        return fn()
    finally:
        eq.MATS, fx.glint = old_mats, old_glint


RAT = {'steel': 'rat_fur', 'gold': 'rat_tan', 'cloth': 'rat_pink', 'leather': 'rat_fur_dk', 'pleather': 'rat_fur_dk',
       'trouser': 'rat_fur', 'ruby': 'rat_pink', 'bark': 'cheese', 'cap': 'rat_fur', 'tunic': 'rat_fur'}
WOOD = {'steel': 'wood_cut', 'gold': 'bark', 'ruby': 'bark', 'cloth': 'leather', 'bark': 'wood_cut'}
FANG = {'steel': 'bone', 'gold': 'rat_tan', 'ruby': 'rat_pink', 'leather': 'rat_fur_dk'}
BUCKLER = {'steel': 'rat_fur_dk', 'bark': 'cheese', 'cloth': 'rat_pink', 'gold': 'rat_tan'}


def _item(fn, remap=RAT):
    return lambda: _skin(fn, remap)


SPRITES = {
    'monster_rat': monster_rat,
    'monster_ratking': monster_ratking,
    'item_potion_hp': potion,
    'item_wooden_sword': _item(eq.mainhand, WOOD),
    'item_wooden_shield': _item(eq.offhand, WOOD),
    'item_rattatui_cap': _item(eq.head),
    'item_rattatui_shoulderpads': _item(eq.shoulder),
    'item_rattatui_tunic': _item(eq.chest),
    'item_rattatui_gloves': _item(eq.hands),
    'item_rattatui_trousers': _item(eq.legs),
    'item_rattatui_boots': _item(eq.feet),
    'item_rattatui_amulet': _item(eq.neck),
    'item_rattatui_cloak': _item(eq.cape),
    'item_rattatui_ring': _item(eq.ring),
    'item_rattatui_charm': _item(eq.charm),
    'item_rattatui_fang_blade': _item(eq.mainhand, FANG),
    'item_rattatui_buckler': _item(eq.offhand, BUCKLER),
}
