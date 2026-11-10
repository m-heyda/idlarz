"""Monsters and the items that come with them.

- item_potion_hp (40x40) and the wooden starter kit.
"""
from render3d import Scene, Prim, I3, add, place
from materials import MATS
import fx
import sprites_equipment as eq


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


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


# ----------------------------------------------------------------- skull (lies over a dead monster in the minimized combat box)
def skull():
    sc = Scene(MATS, scale=14.0, origin=(20, 22))

    def A(kind, c, size, mat, R=I3, tex=None, seed=0):
        sc.add(place(Prim(kind, c, size, mat, R, tex, seed), -45))

    A('ell', (0, 0, 0.3), (0.84, 0.74, 0.74), 'bone', I3, None, 1)                       # cranium
    A('ell', (0, -0.05, -0.38), (0.5, 0.42, 0.3), 'bone', I3, None, 2)                   # jaw
    for s in (-1, 1):
        A('ell', (0.3 * s, -0.6, 0.18), (0.21, 0.14, 0.24), 'dark')                      # eye sockets
        A('ell', (0.3 * s, -0.76, 0.2), (0.07, 0.05, 0.09), 'eye_glow')                  # a red spark in each
    A('ell', (0, -0.74, -0.12), (0.08, 0.08, 0.13), 'dark')                              # nose hole
    img = sc.render()
    fx.glint(img, 14, 12, 1)
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


WOOD = {'steel': 'wood_cut', 'gold': 'bark', 'ruby': 'bark', 'cloth': 'leather', 'bark': 'wood_cut'}


def _item(fn, remap):
    return lambda: _skin(fn, remap)


SPRITES = {
    'skull': skull,
    'item_potion_hp': potion,
    'item_wooden_sword': _item(eq.mainhand, WOOD),
    'item_wooden_shield': _item(eq.offhand, WOOD),
}
