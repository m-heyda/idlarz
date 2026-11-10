"""Prop sprites: menu-button icons (helm, coin pouch, barn) and the purple level/XP orb."""
import math
from PIL import Image
from render3d import Scene, Prim, rot, vnoise, place, I3, hexc
from common import add_outline
from materials import MATS
import fx


# ----------------------------------------------------------------- farm button: barn
def plank_tex(pl, nl, pr):
    axis = pl[0] if abs(nl[1]) > 0.5 else pl[1]
    d = -0.16 if int(math.floor(axis * 5)) % 2 else 0.04
    return None, d


# ----------------------------------------------------------------- level orb / XP orb (2D, light from the top-left)
_BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def orb_base(size=24, dark_core=True):
    """Purple glass orb. dark_core=True leaves a deep socket in the middle so a number reads on it (level badge);
    False fills it with a bright energy core (the XP icon)."""
    ring, core = MATS['xp'].ramp, MATS['xp_core'].ramp
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cx = cy = (size - 1) / 2.0
    R = size / 2.0 - 1.2
    L = (-0.45, -0.62, 0.64)
    for y in range(size):
        for x in range(size):
            dx, dy = (x - cx) / R, (y - cy) / R
            r2 = dx * dx + dy * dy
            if r2 > 1.0:
                continue
            nz = math.sqrt(1.0 - r2)
            lit = max(0.0, dx * L[0] + dy * L[1] + nz * L[2])
            rr = math.sqrt(r2)
            b = (_BAYER[y % 4][x % 4] / 16.0 - 0.5) * 0.22
            if dark_core and rr < 0.6:
                # socket: dark, with a faint lower-right bounce light
                t = 0.12 + 0.55 * max(0.0, dx * 0.5 + dy * 0.6) * (rr / 0.6) ** 2
                col = core[max(0, min(4, int(t * 5 + b)))]
            elif (not dark_core) and rr < 0.5:
                t = 0.62 + 0.45 * (1 - rr / 0.5)
                col = ring[max(0, min(4, int(t * 5 + b)))]
            else:
                t = 0.3 + 0.7 * lit + 0.2 * max(0.0, rr - 0.8) / 0.2          # glassy bright rim
                col = ring[max(0, min(4, int(t * 5 + b)))]
                if 0.78 < rr < 0.94 and dx + dy < -0.55 and lit > 0.35:     # curved window glint, upper left
                    col = ring[4]
            img.putpixel((x, y), col)
    return add_outline(img, hexc('#10042c'))


def _orb_decorate(img, size):
    fx.glint(img, int(size * 0.3), int(size * 0.28), 1 if size < 30 else 2)
    return img


def level_orb():
    return _orb_decorate(orb_base(24, True), 24)


def orb_frames(size=24, n=6):
    """n frames: a pale sweep glides across the glass, then the glint blooms and fades."""
    base = orb_base(size, True)
    px = base.load()
    c, R = (size - 1) / 2.0, size / 2.0 - 1.2
    # the sweep only crosses the glass rim: the dark socket stays dark so the level number never loses contrast
    inside = [(x, y) for y in range(size) for x in range(size)
              if px[x, y][3] > 200 and math.hypot(x - c, y - c) > 0.66 * R]
    frames = []
    for i in range(n):
        f = base.copy()
        fp = f.load()
        sweep = size * 0.4 + i * (size * 0.9 / n)
        for x, y in inside:
            d = abs((x + y) - sweep)
            if d <= 1:
                fp[x, y] = hexc('#f4e8ff')
            elif d <= 2:
                fp[x, y] = hexc('#c9a8ff')
        r = (0, 0, 1, 2, 1, 0)[i % 6]
        if r:
            fx.glint(f, int(size * 0.3), int(size * 0.28), r)
        frames.append(f)
    return frames


def level_orb_sheet():
    frames = orb_frames()
    sheet = Image.new('RGBA', (24 * len(frames), 24), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * 24, 0))
    return sheet


# ----------------------------------------------------------------- polished menu icons
def helm():
    sc = Scene(MATS, scale=13.0, origin=(20, 37))

    def A(kind, c, size, mat, R=I3, tex=None, seed=0):
        sc.add(place(Prim(kind, c, size, mat, R, tex, seed), -45))

    A('cyl', (0, 0, -0.05), (0.74, 0.25), 'steel', I3, None, 1)                         # gorget
    A('cyl', (0, 0, -0.28), (0.78, 0.05), 'gold')
    A('cyl', (0, 0, 0.62), (0.9, 0.55), 'steel', I3, None, 2)                           # face section
    A('ell', (0, 0, 1.25), (0.93, 0.93, 0.95), 'steel', I3, None, 3)                    # dome
    A('cyl', (0, 0, 1.42), (0.945, 0.06), 'gold')                                       # brow band
    A('box', (0, -0.9, 1.0), (0.66, 0.07, 0.085), 'dark')                               # eye slit
    A('box', (0, -0.9, 0.6), (0.055, 0.07, 0.4), 'dark')                                # vertical slit (T-visor)
    for sx in (-1, 1):
        for z in (0.62, 0.48, 0.34):
            A('box', (0.4 * sx, -0.9, z), (0.055, 0.06, 0.04), 'dark')                  # breath holes
        for x in (0.62, 0.34):
            A('ell', (x * sx, -0.92, 1.42), (0.06, 0.05, 0.06), 'gold')                  # rivets
    A('ell', (0, -0.94, 1.42), (0.07, 0.05, 0.07), 'gold')
    # plume
    A('ell', (0, 0.1, 2.25), (0.14, 0.6, 0.45), 'cloth', rot(-20, 0, 0), None, 6)
    A('ell', (0, 0.5, 2.0), (0.13, 0.5, 0.36), 'cloth', rot(-35, 0, 0), None, 7)
    A('ell', (0, -0.15, 2.4), (0.13, 0.36, 0.3), 'cloth', rot(-5, 0, 0), None, 8)
    A('ell', (0, 0, 2.12), (0.16, 0.16, 0.16), 'gold')
    img = sc.render()
    fx.glint(img, 13, 10, 2)
    return img


def shingle_tex(pl, nl, pr):
    row = int(math.floor(pl[1] * 5.5))
    off = 0.0 if row % 2 else 0.18
    col = int(math.floor((pl[0] + off) * 4.0))
    d = 0.0
    if (pl[1] * 5.5) % 1.0 < 0.2:
        d -= 0.22                                    # row shadow line
    if ((pl[0] + off) * 4.0) % 1.0 < 0.07:
        d -= 0.14                                    # shingle gap
    d += 0.05 * ((row + col) % 3 - 1)
    return None, d


def hay_tex(pl, nl, pr):
    n = vnoise(pl[0] * 5, pl[1] * 5, pl[2] * 5, pr.seed)
    d = -0.2 if int(math.floor(pl[0] * 6)) % 2 else 0.05
    return None, d + (n - 0.5) * 0.3
