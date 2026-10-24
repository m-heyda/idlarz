"""Meadow around the farm pen: decor (trees, bush, rocks, flowers, stump, mushrooms, pond) and the little critters that
pop up for a bonus (butterfly, bee, ladybug, rabbit). Critters are 2-frame sheets (flap / hop) stepped with CSS."""
from PIL import Image
from render3d import Scene, Prim, rot, I3
from materials import MATS
import fx


def _sc(w, h, ox, oy, scale=13.0):
    return Scene(MATS, size=(w, h), scale=scale, origin=(ox, oy))


def _P(sc, kind, c, size, mat, R=I3, seed=0):
    sc.add(Prim(kind, c, size, mat, R, None, seed))


def tree():
    sc = _sc(56, 72, 28, 66)
    _P(sc, 'cyl', (0, 0, 0.9), (0.26, 0.9), 'bark', I3, 1)
    for sx in (-1, 1):                                       # root flare
        _P(sc, 'ell', (0.3 * sx, 0.1, 0.12), (0.22, 0.2, 0.14), 'bark', I3, 2)
    for i, (x, y, z, r) in enumerate(((0, 0, 2.7, 1.1), (-0.75, 0.15, 2.3, 0.8), (0.8, -0.1, 2.35, 0.8),
                                      (0.1, 0.5, 3.35, 0.8), (-0.3, -0.45, 3.1, 0.7))):
        _P(sc, 'ell', (x, y, z), (r, r * 0.95, r * 0.88), 'cap', I3, 10 + i)
    for i, (x, y, z) in enumerate(((0.5, -0.8, 3.0), (-0.6, -0.7, 2.6), (0.2, -0.9, 2.2))):   # apples
        _P(sc, 'ell', (x, y, z), (0.08, 0.08, 0.08), 'cloth', I3, 20 + i)
    return sc.render()


def pine():
    sc = _sc(48, 76, 24, 70)
    _P(sc, 'cyl', (0, 0, 0.5), (0.2, 0.5), 'bark', I3, 1)
    for i, (z, r, h) in enumerate(((0.9, 1.0, 0.7), (1.7, 0.82, 0.65), (2.45, 0.62, 0.6), (3.1, 0.4, 0.55))):
        _P(sc, 'cone', (0, 0, z + h * 0.6), (r, h), 'pine', I3, 5 + i)
    return sc.render()


def bush():
    sc = _sc(40, 30, 20, 26)
    for i, (x, y, r) in enumerate(((0, 0, 0.7), (-0.55, 0.15, 0.5), (0.55, 0.1, 0.52), (0.1, -0.5, 0.42))):
        _P(sc, 'ell', (x, y, r * 0.8), (r, r, r * 0.85), 'cap', I3, 3 + i)
    for i, (x, y, z) in enumerate(((0.3, -0.55, 0.8), (-0.4, -0.45, 0.55), (0.6, -0.3, 0.45), (-0.1, -0.7, 0.35))):
        _P(sc, 'ell', (x, y, z), (0.08, 0.08, 0.08), 'blossom', I3, 20 + i)
    return sc.render()


def rocks():
    sc = _sc(36, 26, 18, 22)
    for i, (x, y, r, m) in enumerate(((0, 0, 0.6, 'granite'), (0.7, 0.2, 0.38, 'granite_dk'), (-0.65, 0.1, 0.34, 'granite'))):
        _P(sc, 'ell', (x, y, r * 0.55), (r, r * 0.85, r * 0.62), m, I3, 4 + i)
    _P(sc, 'ell', (-0.1, -0.1, 0.62), (0.3, 0.25, 0.1), 'grass', I3, 9)           # moss
    return sc.render()


def flowers():
    sc = _sc(36, 30, 18, 26, 14.0)
    cols = ('blossom', 'wheat', 'cloth', 'ice', 'blossom', 'wheat')
    pts = ((-0.9, 0.0), (-0.35, -0.3), (0.2, 0.2), (0.75, -0.2), (0.0, -0.75), (-0.6, 0.55))
    for i, ((x, y), c) in enumerate(zip(pts, cols)):
        h = 0.5 + 0.12 * (i % 3)
        _P(sc, 'cyl', (x, y, h / 2), (0.025, h / 2), 'reed', I3, 30 + i)
        _P(sc, 'ell', (x, y, h + 0.04), (0.14, 0.14, 0.1), c, I3, 40 + i)
        _P(sc, 'ell', (x, y, h + 0.1), (0.05, 0.05, 0.05), 'glow', I3, 50 + i)
        _P(sc, 'ell', (x + 0.14, y, 0.08), (0.14, 0.04, 0.06), 'reed', rot(0, 0, 20), 60 + i)
    return sc.render()


def stump():
    sc = _sc(30, 32, 15, 28)
    _P(sc, 'cyl', (0, 0, 0.35), (0.42, 0.35), 'bark', I3, 1)
    _P(sc, 'cyl', (0, 0, 0.72), (0.38, 0.03), 'wood_cut', I3, 2)
    _P(sc, 'cyl', (0, 0, 0.76), (0.2, 0.02), 'crumb', I3, 3)
    for sx in (-1, 1):
        _P(sc, 'ell', (0.4 * sx, 0.05, 0.08), (0.2, 0.16, 0.12), 'bark', I3, 5)
    _P(sc, 'ell', (0.3, -0.25, 0.1), (0.1, 0.1, 0.08), 'cloth', I3, 6)           # a mushroom
    _P(sc, 'cyl', (0.3, -0.25, 0.04), (0.03, 0.05), 'cream', I3, 7)
    return sc.render()


def mushrooms():
    sc = _sc(28, 26, 14, 22)
    for i, (x, y, r, h) in enumerate(((0, 0, 0.3, 0.4), (0.5, 0.1, 0.2, 0.28), (-0.45, 0.15, 0.22, 0.3))):
        _P(sc, 'cyl', (x, y, h / 2), (r * 0.3, h / 2), 'cream', I3, 4 + i)
        _P(sc, 'ell', (x, y, h + 0.02), (r, r, r * 0.7), 'cloth', I3, 10 + i)
        _P(sc, 'ell', (x - r * 0.3, y - r * 0.5, h + r * 0.55), (r * 0.18, r * 0.12, r * 0.1), 'cream', I3, 20 + i)
    return sc.render()


def pond():
    sc = _sc(80, 48, 40, 34)
    _P(sc, 'ell', (0, 0, 0.0), (2.4, 1.5, 0.2), 'sand', I3, 1)
    _P(sc, 'ell', (0, 0, 0.12), (2.1, 1.25, 0.14), 'water', I3, 2)
    for i, (x, y) in enumerate(((0.5, -0.1), (-0.9, 0.3))):
        _P(sc, 'ell', (x, y, 0.28), (0.32, 0.28, 0.04), 'lily', I3, 5 + i)
    _P(sc, 'ell', (0.55, -0.15, 0.34), (0.08, 0.08, 0.05), 'blossom', I3, 8)
    for i, (x, y) in enumerate(((1.7, 0.7), (1.95, 0.4), (-1.8, 0.6), (-2.0, 0.2))):
        _P(sc, 'cyl', (x, y, 0.55), (0.04, 0.55), 'reed', I3, 10 + i)
        _P(sc, 'ell', (x, y, 1.15), (0.07, 0.07, 0.18), 'cattail', I3, 20 + i)
    for i, (x, y, r) in enumerate(((1.9, -0.9, 0.3), (-1.6, -0.9, 0.24), (0.2, 1.4, 0.2))):
        _P(sc, 'ell', (x, y, r * 0.5), (r, r * 0.85, r * 0.6), 'granite', I3, 30 + i)
    img = sc.render()
    fx.glint(img, 34, 24, 1)
    return img


def _sheet(frames):
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * w, 0))
    return sheet


def butterfly():
    def frame(open_):
        sc = _sc(28, 28, 14, 18, 15.0)
        _P(sc, 'ell', (0, 0, 0.5), (0.1, 0.5, 0.1), 'dark', I3, 1)
        for sx in (-1, 1):
            tilt = 78 if open_ else 18
            lift = 0.0 if open_ else 0.2
            _P(sc, 'ell', (0.5 * sx, -0.15, 0.55 + lift), (0.5, 0.42, 0.04), 'blossom', rot(0, -tilt * sx, 0), 2)
            _P(sc, 'ell', (0.4 * sx, 0.3, 0.52 + lift * 0.75), (0.32, 0.3, 0.04), 'ice', rot(0, -tilt * sx, 0), 3)
            _P(sc, 'ell', (0.55 * sx, -0.2, 0.62 + lift * 0.5), (0.11, 0.1, 0.05), 'glow', rot(0, -tilt * sx, 0), 4)
        _P(sc, 'cyl', (0.1, -0.5, 0.75), (0.015, 0.2), 'dark', rot(30, 0, 0), 5)
        return sc.render()
    return _sheet([frame(True), frame(False)])


def bee():
    def frame(up):
        sc = _sc(28, 26, 14, 18, 15.0)
        for i, z in enumerate((-0.28, -0.05, 0.18)):
            _P(sc, 'ell', (0, z, 0.5), (0.3, 0.2, 0.3), 'glow' if i != 1 else 'dark', I3, 1 + i)
        _P(sc, 'ell', (0, -0.42, 0.55), (0.22, 0.2, 0.22), 'dark', I3, 5)
        _P(sc, 'cyl', (0, 0.5, 0.45), (0.03, 0.1), 'steel', rot(90, 0, 0), 6)
        for sx in (-1, 1):
            a = 60 if up else 15
            _P(sc, 'ell', (0.35 * sx, -0.05, 0.85 if up else 0.7), (0.34, 0.2, 0.04), 'wing', rot(0, -a * sx, 0), 7)
        return sc.render()
    return _sheet([frame(True), frame(False)])


def ladybug():
    def frame(lift):
        sc = _sc(24, 22, 12, 16, 15.0)
        _P(sc, 'ell', (0, 0.05, 0.3), (0.5, 0.55, 0.4), 'cloth', I3, 1)
        _P(sc, 'ell', (0, -0.52, 0.3), (0.28, 0.2, 0.22), 'dark', I3, 2)
        _P(sc, 'box', (0, 0.05, 0.62), (0.015, 0.5, 0.02), 'dark')
        for i, (x, y) in enumerate(((-0.25, 0.0), (0.25, 0.0), (-0.28, 0.32), (0.28, 0.32))):
            _P(sc, 'ell', (x, y, 0.6), (0.08, 0.08, 0.05), 'dark', I3, 10 + i)
        for sx in (-1, 1):
            if lift:
                _P(sc, 'ell', (0.55 * sx, 0.1, 0.5), (0.3, 0.2, 0.03), 'wing', rot(0, -25 * sx, 0), 20)
            for k in range(3):
                _P(sc, 'ell', (0.5 * sx, -0.25 + 0.3 * k, 0.07), (0.1, 0.06, 0.05), 'dark', I3, 30 + k)
        return sc.render()
    return _sheet([frame(False), frame(True)])


def rabbit():
    def frame(hop):
        sc = _sc(34, 34, 17, 28 if not hop else 24, 15.0)
        z = 0.5 if hop else 0.0
        _P(sc, 'ell', (0, 0.1, 0.45 + z), (0.55, 0.78, 0.5), 'hide', I3, 1)
        _P(sc, 'ell', (0, -0.62, 0.78 + z), (0.36, 0.34, 0.34), 'hide', I3, 2)
        _P(sc, 'ell', (0, -0.9, 0.7 + z), (0.12, 0.1, 0.1), 'pig', I3, 3)
        for sx in (-1, 1):
            _P(sc, 'ell', (0.15 * sx, -0.55, 1.35 + z), (0.09, 0.07, 0.4), 'hide', rot(-10 if hop else 8, 0, 8 * sx), 4)
            _P(sc, 'ell', (0.15 * sx, -0.58, 1.33 + z), (0.04, 0.03, 0.3), 'pig', rot(-10 if hop else 8, 0, 8 * sx), 5)
            _P(sc, 'ell', (0.16 * sx, -0.88, 0.85 + z), (0.04, 0.03, 0.05), 'dark', I3, 6)
            _P(sc, 'ell', (0.34 * sx, 0.35, 0.18 + z * 0.4), (0.16, 0.38, 0.18), 'hide', I3, 7)
            _P(sc, 'ell', (0.2 * sx, -0.35, 0.1 + z * 0.4), (0.1, 0.16, 0.1), 'hide', I3, 8)
        _P(sc, 'ell', (0, 0.88, 0.55 + z), (0.2, 0.2, 0.2), 'cream', I3, 9)
        return sc.render()
    return _sheet([frame(False), frame(True)])


def fish():
    """A little fish for the lakes (2 frames: the tail swings), head to the right. Ambient only, never carries a gift."""
    def frame(swing):
        sc = _sc(32, 22, 14, 16, 7.4)
        Rz = rot(0, 0, -45)

        def at(lx, ly, lz):
            return (lx * 0.7071 + ly * 0.7071, -lx * 0.7071 + ly * 0.7071, lz)
        _P(sc, 'ell', at(0.1, 0, 0.9), (1.5, 0.4, 0.62), 'fish_blue', Rz, 1)
        _P(sc, 'ell', at(0.15, -0.1, 0.66), (1.2, 0.34, 0.28), 'fish_belly', Rz, 2)
        _P(sc, 'ell', at(-1.35, 0, 0.9), (0.5, 0.2, 0.32), 'fish_blue', Rz, 3)
        a = 38 if swing else 14
        _P(sc, 'ell', at(-1.95, 0, 1.3 if swing else 1.15), (0.58, 0.09, 0.2), 'fish_blue', rot(0, -a, -45), 4)
        _P(sc, 'ell', at(-1.95, 0, 0.5 if swing else 0.65), (0.58, 0.09, 0.2), 'fish_blue', rot(0, a, -45), 5)
        _P(sc, 'ell', at(-0.1, 0, 1.5), (0.6, 0.12, 0.3), 'fish_blue', rot(0, -22, -45), 6)
        _P(sc, 'ell', at(1.1, -0.36, 1.05), (0.17, 0.06, 0.17), 'cream', Rz, 7)
        _P(sc, 'ell', at(1.14, -0.41, 1.03), (0.09, 0.04, 0.1), 'dark', Rz, 8)
        return sc.render()
    return _sheet([frame(False), frame(True)])


def frog():
    """A swamp frog (2 frames: sitting, hopping)."""
    def frame(hop):
        sc = _sc(26, 22, 13, 17, 12.0)
        z = 0.35 if hop else 0.0
        _P(sc, 'ell', (0, 0.1, 0.4 + z), (0.62, 0.8, 0.42), 'grass', I3, 1)
        _P(sc, 'ell', (0, 0.15, 0.22 + z), (0.5, 0.65, 0.2), 'crumb', I3, 2)
        _P(sc, 'ell', (0, -0.55, 0.52 + z), (0.5, 0.36, 0.34), 'grass', I3, 3)
        for sx in (-1, 1):
            _P(sc, 'ell', (0.3 * sx, -0.62, 0.92 + z), (0.17, 0.17, 0.17), 'grass', I3, 4)
            _P(sc, 'ell', (0.3 * sx, -0.75, 0.96 + z), (0.1, 0.07, 0.1), 'cream', I3, 5)
            _P(sc, 'ell', (0.3 * sx, -0.81, 0.96 + z), (0.05, 0.03, 0.06), 'dark', I3, 6)
            _P(sc, 'ell', (0.55 * sx, 0.55 + (0.2 if hop else 0), 0.2 + z * 0.5), (0.2, 0.55 if hop else 0.4, 0.2), 'moss', I3, 7)
            _P(sc, 'ell', (0.42 * sx, -0.6, 0.1), (0.12, 0.2, 0.1), 'moss', I3, 8)
        return sc.render()
    return _sheet([frame(False), frame(True)])


def crab():
    """A beach crab seen from above (2 frames: claws down, claws up), drawn pixel by pixel."""
    from common import add_outline, hexc

    lit, mid, dark, deep = hexc('#f0705a'), hexc('#d04838'), hexc('#9a2c2c'), hexc('#6a1c24')

    def frame(up):
        img = Image.new('RGBA', (30, 20), (0, 0, 0, 0))
        px = img.load()

        def put(x, y, c):
            if 0 <= x < 30 and 0 <= y < 20:
                px[x, y] = c

        def disc(cx, cy, rx, ry, pick):
            for y in range(cy - ry, cy + ry + 1):
                for x in range(cx - rx, cx + rx + 1):
                    d = ((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2
                    if d <= 1:
                        put(x, y, pick(x - cx, y - cy, d))

        def line(x0, y0, x1, y1, c):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(n + 1):
                put(round(x0 + (x1 - x0) * i / max(n, 1)), round(y0 + (y1 - y0) * i / max(n, 1)), c)

        for sx in (-1, 1):                                                   # legs, three a side
            for k, dy in enumerate((0, 2, 4)):
                line(15 + sx * 7, 11 + dy, 15 + sx * (11 + k), 13 + dy + k, deep)
        cy = 5 if up else 8
        for sx in (-1, 1):                                                   # arms and pincers
            line(15 + sx * 7, 11, 15 + sx * 10, cy + 3, dark)
            disc(15 + sx * 11, cy, 3, 3, lambda dx, dy, d: lit if dx * sx < 0 and dy < 0 else mid if d < 0.7 else dark)
            put(15 + sx * 11, cy - 3, (0, 0, 0, 0))                          # the notch between the pincers
            put(15 + sx * 11, cy - 2, (0, 0, 0, 0))
        disc(15, 12, 8, 5, lambda dx, dy, d: lit if dx + dy < -3 and d < 0.8 else dark if dx + dy > 4 or d > 0.85 else mid)
        for sx in (-1, 1):                                                   # eye stalks
            line(15 + sx * 3, 8, 15 + sx * 3, 6, dark)
            put(15 + sx * 3, 5, hexc('#ffffff'))
            put(15 + sx * 3, 4, hexc('#ffffff'))
            put(15 + sx * 3, 5, hexc('#101010'))
        for x, y in ((12, 11), (17, 12), (14, 14)):                          # shell speckles
            put(x, y, lit)
        return add_outline(img, hexc('#3e0e16'))
    return _sheet([frame(False), frame(True)])


def goat():
    """A hill goat (2 frames: a step each), head to the lower left like the other critters."""
    def frame(step):
        sc = _sc(36, 32, 18, 25, 14.0)
        s = 0.18 if step else -0.18
        _P(sc, 'ell', (0, 0.1, 0.62), (0.5, 0.8, 0.46), 'fawn', I3, 1)
        _P(sc, 'ell', (0, 0.1, 0.48), (0.42, 0.7, 0.3), 'cream', I3, 2)
        _P(sc, 'ell', (0, -0.78, 0.98), (0.27, 0.38, 0.28), 'fawn', I3, 3)
        _P(sc, 'ell', (0, -1.1, 0.88), (0.13, 0.14, 0.12), 'cream', I3, 4)
        _P(sc, 'ell', (0, -1.0, 0.64), (0.07, 0.06, 0.13), 'beard', I3, 5)
        for sx in (-1, 1):
            _P(sc, 'cone', (0.15 * sx, -0.62, 1.4), (0.07, 0.3), 'bone', rot(-35, 12 * sx, 0), 6)
            _P(sc, 'ell', (0.3 * sx, -0.7, 1.05), (0.15, 0.07, 0.07), 'fawn', rot(0, 0, 25 * sx), 7)
            _P(sc, 'ell', (0.14 * sx, -1.0, 1.0), (0.04, 0.03, 0.04), 'dark', I3, 8)
            fy, ry = -0.42 + s * sx, 0.55 - s * sx
            _P(sc, 'cyl', (0.26 * sx, fy, 0.22), (0.07, 0.22), 'fawn', I3, 9)
            _P(sc, 'cyl', (0.26 * sx, ry, 0.22), (0.07, 0.22), 'fawn', I3, 10)
            _P(sc, 'cyl', (0.26 * sx, fy, 0.04), (0.08, 0.05), 'dark', I3, 11)
            _P(sc, 'cyl', (0.26 * sx, ry, 0.04), (0.08, 0.05), 'dark', I3, 12)
        _P(sc, 'ell', (0, 0.92, 0.85), (0.08, 0.12, 0.14), 'fawn', rot(25, 0, 0), 13)
        return sc.render()
    return _sheet([frame(False), frame(True)])


def wolf():
    """A small forest wolf (2 frames: a trot), head to the lower left."""
    def frame(step):
        sc = _sc(38, 30, 19, 24, 13.5)
        s = 0.2 if step else -0.2
        _P(sc, 'ell', (0, 0.15, 0.55), (0.42, 0.9, 0.4), 'rat_fur_dk', I3, 1)
        _P(sc, 'ell', (0, -0.3, 0.38), (0.34, 0.5, 0.26), 'rat_fur', I3, 2)
        _P(sc, 'ell', (0, -0.9, 0.82), (0.3, 0.38, 0.28), 'rat_fur_dk', I3, 3)
        _P(sc, 'ell', (0, -1.28, 0.7), (0.15, 0.26, 0.12), 'beard', I3, 4)
        _P(sc, 'ell', (0, -1.5, 0.74), (0.07, 0.07, 0.06), 'dark', I3, 5)
        for sx in (-1, 1):
            _P(sc, 'cone', (0.18 * sx, -0.78, 1.18), (0.1, 0.18), 'dark', I3, 6)
            _P(sc, 'ell', (0.15 * sx, -1.12, 0.92), (0.04, 0.03, 0.04), 'eye_glow', I3, 7)
            fy, ry = -0.5 + s * sx, 0.7 - s * sx
            _P(sc, 'cyl', (0.2 * sx, fy, 0.22), (0.07, 0.22), 'dark', I3, 8)
            _P(sc, 'cyl', (0.2 * sx, ry, 0.22), (0.08, 0.22), 'dark', I3, 9)
        _P(sc, 'ell', (0, 1.2, 0.62), (0.15, 0.5, 0.15), 'rat_fur_dk', rot(-25, 0, 0), 10)
        _P(sc, 'ell', (0, 1.52, 0.7), (0.1, 0.16, 0.1), 'beard', rot(-25, 0, 0), 11)
        return sc.render()
    return _sheet([frame(False), frame(True)])


SPRITES = {
    'meadow_tree': tree, 'meadow_pine': pine, 'meadow_bush': bush, 'meadow_rocks': rocks, 'meadow_flowers': flowers,
    'meadow_stump': stump, 'meadow_mushrooms': mushrooms, 'meadow_pond': pond,
    'bonus_butterfly': butterfly, 'bonus_bee': bee, 'bonus_ladybug': ladybug, 'bonus_rabbit': rabbit,
    'bonus_fish': fish, 'bonus_frog': frog, 'bonus_crab': crab, 'bonus_goat': goat, 'bonus_wolf': wolf,
}
