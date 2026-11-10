"""The procedural farm animal (40x40): the deer, standing along the x axis, head toward -x (screen lower-left), so the camera sees the head end and
the -y flank in the usual 3/4 view. Chicken, cow and pig are Sprite Fusion art (sprites_animal_art.py)."""
import math
from render3d import Scene, Prim, rot, vnoise, between, I3
from materials import MATS


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _eye(sc, x, y, z, r=0.06):
    _P(sc, 'ell', (x, y, z), (r, r * 0.8, r), 'dark')


# ----------------------------------------------------------------- deer
def fawn_tex(pl, nl, pr):
    n = vnoise(pl[0] * 3.2, pl[1] * 3.2, pl[2] * 3.2, pr.seed)
    if n > 0.74 and nl[1] < 0.3:
        return 'spots', 0.0                     # dappled flank
    return None, (n - 0.5) * 0.2


def deer():
    sc = Scene(MATS, scale=12.0, origin=(21, 36))
    _P(sc, 'ell', (0.12, 0, 1.5), (0.98, 0.42, 0.5), 'fawn', I3, fawn_tex, 21)                # body
    _P(sc, 'ell', (-0.5, 0, 1.52), (0.5, 0.36, 0.46), 'hide', I3, None, 22)                  # pale chest
    _P(sc, 'ell', (-0.88, 0, 2.0), (0.26, 0.24, 0.55), 'fawn', rot(0, -28, 0), None, 23)     # neck
    _P(sc, 'ell', (-1.2, 0, 2.5), (0.34, 0.2, 0.2), 'fawn', rot(0, -18, 0), None, 24)        # head
    _P(sc, 'ell', (-1.5, 0, 2.43), (0.07, 0.08, 0.07), 'dark')                                 # nose
    _eye(sc, -1.3, -0.17, 2.56, 0.045)
    for s in (-1, 1):
        _P(sc, 'ell', (-1.0, 0.2 * s, 2.7), (0.12, 0.06, 0.2), 'fawn', rot(0, 0, 25 * s), None, 25)   # ears
        # antlers: main beam + two tines
        for a, b in (((-1.02, 0.1 * s, 2.66), (-0.9, 0.3 * s, 3.3)),
                     ((-0.95, 0.2 * s, 2.95), (-1.18, 0.32 * s, 3.25)),
                     ((-0.91, 0.27 * s, 3.18), (-0.7, 0.38 * s, 3.52))):
            sc.add(between('cyl', a, b, (0.05,), 'bone', None, (0, 0, 1)))
    for x in (-0.58, 0.8):                                                                     # legs
        for sy in (-1, 1):
            _P(sc, 'cyl', (x, 0.26 * sy, 0.72), (0.085, 0.74), 'fawn', I3, None, 26)
            _P(sc, 'cyl', (x, 0.26 * sy, 0.08), (0.09, 0.08), 'dark')
    _P(sc, 'ell', (1.08, 0, 1.72), (0.12, 0.1, 0.18), 'hide', rot(0, -25, 0), None, 27)      # tail
    img = sc.render()
    return img


SPRITES = {
    'animal_deer': deer,
}
