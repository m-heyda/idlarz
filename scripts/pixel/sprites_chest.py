"""Treasure chest art: `chest_map` (40x40: a banded wooden chest on a small grass patch with rocks, the pickup on the map)
and `bonus_chest` (24x24: the same chest alone, for toasts and tooltips)."""
import math
from render3d import Scene, Prim, rot, vnoise, I3
from materials import MATS
import fx


def _plank_tex(pl, nl, pr):
    """Horizontal boards on the body, a grain line along the lid."""
    if abs(nl[2]) > 0.9:
        return None, 0.0
    return None, (-0.24 if int(math.floor(pl[2] * 3.4)) % 2 else 0.04)


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _chest(sc, z0=0.0):
    _P(sc, 'box', (0, 0, z0 + 0.6), (1.15, 0.78, 0.6), 'timber', I3, _plank_tex, 1)                  # body
    _P(sc, 'cyl', (0, 0, z0 + 1.2), (0.78, 1.15), 'timber', rot(0, 90, 0), None, 2)                    # round lid (axis x)
    for sx in (-0.72, 0.72):                                                                              # gold straps
        _P(sc, 'box', (sx, 0, z0 + 0.6), (0.14, 0.81, 0.63), 'nugget', I3, None, 3)
        _P(sc, 'cyl', (sx, 0, z0 + 1.2), (0.82, 0.14), 'nugget', rot(0, 90, 0), None, 4)
    _P(sc, 'box', (0, 0, z0 + 0.04), (1.18, 0.82, 0.06), 'nugget', I3, None, 5)                        # base trim
    _P(sc, 'box', (0, -0.82, z0 + 1.1), (0.2, 0.06, 0.26), 'steel', I3, None, 6)                      # lock plate
    _P(sc, 'box', (0, -0.87, z0 + 1.0), (0.07, 0.04, 0.1), 'dark', I3, None, 7)                       # keyhole


def _grass_patch(sc):
    _P(sc, 'ell', (0, 0.05, 0.0), (2.2, 1.75, 0.2), 'moss', I3, None, 11)
    _P(sc, 'ell', (-0.3, -0.15, 0.0), (1.7, 1.3, 0.25), 'moss', I3, None, 12)
    for i, (x, y, h) in enumerate(((-1.6, 0.3, 0.5), (1.5, 0.8, 0.55), (-1.2, 1.0, 0.45), (1.7, -0.5, 0.5), (0.3, 1.35, 0.5),
                                   (-1.7, -0.5, 0.42), (1.1, -1.2, 0.45))):                              # tufts
        _P(sc, 'cone', (x, y, h * 0.6), (0.2, h), 'reed', rot(0, (i % 3 - 1) * 10, 0), None, 20 + i)
    for i, (x, y, r) in enumerate(((-1.5, -0.95, 0.3), (1.45, -1.0, 0.28), (-0.9, 1.4, 0.24), (1.85, 0.25, 0.22))):   # rocks
        _P(sc, 'ell', (x, y, r * 0.8), (r * 1.2, r, r * 0.8), 'rock', rot(0, 0, i * 40), None, 30 + i)


def chest_map():
    sc = Scene(MATS, size=40, scale=8.4, origin=(20, 29), yaw=38.0, pitch=34.0)
    _grass_patch(sc)
    _chest(sc, z0=0.08)
    img = sc.render()
    fx.glint(img, 15, 11, 1)
    return img


def bonus_chest():
    sc = Scene(MATS, size=24, scale=6.6, origin=(12, 17), yaw=30.0, pitch=30.0, dither=0.0)
    _chest(sc)
    img = sc.render()
    fx.glint(img, 9, 6, 1)
    return img


SPRITES = {'chest_map': chest_map, 'bonus_chest': bonus_chest}
