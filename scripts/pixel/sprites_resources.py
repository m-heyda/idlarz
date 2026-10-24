"""Resource sprites (40x40): gold, wood, stone, coal (fuel), food, meat - plus the reserved late-game set (iron, fish, mana,
ability shard, random-item box) that exists as art only. Reference look: chunky faceted heaps, saturated ramps, crisp
glints. Sprites float on transparency (no ground shadow) so they sit on any background."""
import math
from PIL import ImageDraw
from render3d import Scene, Prim, rot, vnoise, between, I3
from materials import MATS
import fx

GOLD_HI = [MATS['gold'].ramp[-1], MATS['gold'].spec_col]              # coin pouch (menu button)
NUGGET_HI = [MATS['nugget'].ramp[-1], MATS['nugget'].spec_col]


# ----------------------------------------------------------------- textures
def coin_tex(pl, nl, pr):
    r = math.hypot(pl[0], pl[1]) / pr.s[0]
    if nl[2] > 0.9:                       # top face
        if 0.76 < r < 0.88:
            return None, -0.42           # engraved ring
        if r > 0.9:
            return None, 0.3             # bevel rim light
        if r < 0.36 and (abs(pl[0]) < 0.07 or abs(pl[1]) < 0.07 or r < 0.14):
            return None, -0.35           # tiny cross emblem
        if r < 0.36:
            return None, 0.1
        return None, 0.0
    ang = math.atan2(pl[1], pl[0])       # milled edge
    h = pr.s[1]
    if pl[2] > h - 0.05:
        return None, 0.32                # rim catches the light
    if pl[2] < -h + 0.05:
        return None, -0.35               # underside tucked in shadow
    return None, (-0.05 if int(ang * 8 / math.pi) % 2 else -0.18)


def make_log_tex(seed):
    def tex(pl, nl, pr):
        if abs(nl[2]) > 0.9:             # cut end -> pale wood with rings
            r = math.hypot(pl[0], pl[1]) / pr.s[0]
            ring = int(r * 5.5)
            d = -0.1 if ring % 2 else 0.1
            if r < 0.1:
                d = -0.4
            if r > 0.92:
                return 'bark', 0.0
            if abs(math.atan2(pl[1], pl[0]) - 0.6) < 0.05 and 0.12 < r < 0.7:
                d = -0.5                 # a radial crack
            return 'wood_cut', d
        ang = math.atan2(pl[1], pl[0])
        n = vnoise(ang * 3.0, pl[2] * 1.1, seed, seed)
        d = (n - 0.5) * 0.7
        if n > 0.82:
            d -= 0.4                       # dark bark fissures
        return None, d
    return tex


def facet_tex(pl, nl, pr):
    """Chiselled chunks: lit edges, hairline cracks. Shared by gold nuggets, rock, charcoal and ore."""
    s = pr.s
    d = 0.0
    if len(s) == 3:                                           # boxes / ellipsoids: lit chiselled edges
        ex = [abs(abs(pl[i]) - s[i]) for i in range(3)]
        if sum(1 for e in ex if e < 0.09) >= 2:
            d += 0.3
    c = abs(vnoise(pl[0] * 2.6, pl[1] * 2.6, pl[2] * 2.6, pr.seed) - 0.5)
    if c < 0.02:
        d -= 0.45
    return None, d


def flecked_tex(pl, nl, pr):
    """Facets plus glassy flecks (charcoal and iron ore)."""
    _, d = facet_tex(pl, nl, pr)
    if vnoise(pl[0] * 3.3, pl[1] * 3.3, pl[2] * 3.3, pr.seed + 5) > 0.76:
        d += 0.24
    return None, d


def stone_tex(pl, nl, pr):                    # kept for sprites that still use the old stone look
    return facet_tex(pl, nl, pr)


def coal_tex(pl, nl, pr):
    return flecked_tex(pl, nl, pr)


def meat_tex(pl, nl, pr):
    n = vnoise(pl[0] * 2.6, pl[1] * 2.6, pl[2] * 2.6, pr.seed)
    if n > 0.66:
        return 'sear', (n - 0.66) * -0.2
    return None, (n - 0.5) * 0.25


def bone_tex(pl, nl, pr):
    return None, 0.0


def plank_tex(pl, nl, pr):
    """Vertical boards on a crate."""
    axis = pl[0] if abs(nl[1]) > 0.5 else pl[1]
    return None, (-0.22 if int(math.floor(axis * 2.6)) % 2 else 0.05)


# ----------------------------------------------------------------- heaps
def _chunk(sc, mat, tex, x, y, z, hx, hy, hz, ax, ay, az, seed, kind='box'):
    sc.add(Prim(kind, (x, y, z), (hx, hy, hz), mat, rot(ax, ay, az), tex, seed))


def wood():
    sc = Scene(MATS, scale=12.5, origin=(19, 23))

    def log(x, y, z, length, r, yaw, seed):
        sc.add(Prim('cyl', (x, y, z), (r, length / 2), 'bark', rot(90, 0, yaw), make_log_tex(seed), seed))
    log(0.0, 0.52, 0.5, 1.7, 0.5, 90, 3)
    log(0.0, -0.52, 0.5, 1.7, 0.5, 90, 7)
    log(0.1, 0.0, 1.32, 1.7, 0.48, 90, 11)
    img = sc.render()
    return img


def stone():
    sc = Scene(MATS, scale=12.0, origin=(20, 24))
    for i, p in enumerate(((-0.75, 0.2, 0.5, 0.66, 0.6, 0.5, 8, 12, 24), (0.7, 0.3, 0.52, 0.7, 0.62, 0.52, -6, 8, 64),
                           (0.0, -0.7, 0.4, 0.6, 0.5, 0.4, 5, -9, 10), (-0.05, 0.1, 1.25, 0.6, 0.55, 0.48, 12, 8, 41),
                           (-1.2, -0.65, 0.28, 0.32, 0.3, 0.28, 10, 20, 33), (1.25, -0.5, 0.3, 0.34, 0.3, 0.3, -8, 14, 52))):
        _chunk(sc, 'rock', facet_tex, *p, i + 1, kind='ell' if i in (0, 1, 3) else 'box')
    img = sc.render()
    fx.glint(img, 15, 7, 1)
    return img


def coal():
    """Fuel: charcoal lumps with a glassy sheen."""
    sc = Scene(MATS, scale=12.2, origin=(20, 24))
    for i, p in enumerate(((-0.7, 0.25, 0.5, 0.62, 0.55, 0.5, 8, 14, 30), (0.65, 0.2, 0.5, 0.6, 0.55, 0.5, -10, 10, 70),
                           (0.0, -0.75, 0.42, 0.55, 0.45, 0.42, 6, -12, 14), (-0.1, 0.05, 1.2, 0.5, 0.46, 0.44, 14, 6, 48),
                           (1.2, -0.7, 0.25, 0.3, 0.28, 0.26, 12, 18, 26), (-1.2, -0.55, 0.25, 0.3, 0.26, 0.25, 6, 16, 55))):
        _chunk(sc, 'charcoal', flecked_tex, *p, i + 4, kind='ell' if i in (0, 3) else 'box')
    return sc.render()


def iron():
    """Reserved: dark navy ore chunks with bright blue facets."""
    sc = Scene(MATS, scale=12.2, origin=(20, 24))
    for i, p in enumerate(((-0.65, 0.3, 0.52, 0.64, 0.56, 0.52, 10, 12, 34), (0.7, 0.15, 0.5, 0.58, 0.54, 0.5, -12, 9, 58),
                           (0.05, -0.7, 0.42, 0.58, 0.46, 0.42, 4, -14, 18), (0.0, 0.05, 1.22, 0.52, 0.48, 0.46, 16, 5, 44),
                           (1.15, -0.65, 0.26, 0.3, 0.28, 0.26, 10, 18, 22), (-1.15, -0.5, 0.26, 0.28, 0.26, 0.26, 4, 14, 61))):
        _chunk(sc, 'iron_ore', flecked_tex, *p, i + 9)
    img = sc.render()
    fx.glint(img, 18, 11, 1)
    return img


def _nugget_base():
    sc = Scene(MATS, scale=12.2, origin=(20, 24))
    for i, p in enumerate(((-0.72, 0.28, 0.46, 0.56, 0.5, 0.46, 10, 15, 30), (0.62, 0.34, 0.5, 0.6, 0.52, 0.5, -12, 10, 60),
                           (0.0, -0.58, 0.4, 0.52, 0.46, 0.4, 5, -10, 10), (0.0, 0.1, 1.12, 0.5, 0.46, 0.42, 16, 10, 45),
                           (-1.05, -0.5, 0.26, 0.28, 0.26, 0.25, 8, 20, 40), (1.18, -0.45, 0.28, 0.3, 0.27, 0.26, -6, 14, 22),
                           (0.9, 0.95, 0.9, 0.22, 0.2, 0.2, 10, 20, 15))):
        _chunk(sc, 'nugget', facet_tex, *p, i + 1)
    return sc.render()


def gold_base():
    return _nugget_base()


def gold():
    img = _nugget_base()
    spots = fx.find_highlights(img, NUGGET_HI, n=2, min_dist=11)
    for (x, y), r in zip(spots, (3, 2)):
        fx.glint(img, x - 1, y - 1, r)
    return img


# ----------------------------------------------------------------- food: bread + wheat
def loaf_tex(pl, nl, pr):
    if pl[2] > 0.08 and abs(pl[1]) < 0.42:
        if ((pl[0] * 1.1 + pl[1] * 1.5) % 1.0) < 0.3:
            return 'crumb', 0.0
    n = vnoise(pl[0] * 4, pl[1] * 4, pl[2] * 4, pr.seed)
    return None, (0.3 if n > 0.78 else 0.0)


def boule_tex(pl, nl, pr):
    if pl[2] > 0.18 and (abs(pl[0]) < 0.11 or abs(pl[1]) < 0.11):
        return 'crumb', 0.0
    n = vnoise(pl[0] * 4, pl[1] * 4, pl[2] * 4, pr.seed)
    return None, (0.3 if n > 0.8 else 0.0)


def bread():
    """Food: a baguette and a cross-cut boule with ears of wheat across the front."""
    sc = Scene(MATS, scale=12.0, origin=(20, 28))
    sc.add(Prim('ell', (0.35, 0.6, 0.5), (1.5, 0.5, 0.46), 'bread', rot(0, 0, 14), loaf_tex, 1))
    sc.add(Prim('ell', (-0.2, -0.75, 0.62), (0.82, 0.82, 0.62), 'bread', rot(0, 0, 25), boule_tex, 2))
    for p in ((-1.25, -0.05), (0.75, -1.15)):
        sc.add(Prim('ell', (p[0], p[1], 0.06), (0.09, 0.09, 0.06), 'crumb', I3, None, 4))
    return sc.render()


# ----------------------------------------------------------------- meat: roast drumstick
def meat():
    sc = Scene(MATS, scale=12.0, origin=(21, 22))
    sc.add(between('cyl', (-0.5, 0.0, 0.7), (-1.55, -0.2, 0.2), (0.17,), 'bone', bone_tex))
    sc.add(Prim('ell', (-1.65, 0.0, 0.18), (0.3, 0.28, 0.27), 'bone', rot(0, 0, 0), bone_tex, 3))
    sc.add(Prim('ell', (-1.62, -0.42, 0.14), (0.28, 0.26, 0.26), 'bone', rot(0, 0, 0), bone_tex, 4))
    sc.add(Prim('ell', (-0.25, 0.0, 0.85), (0.62, 0.55, 0.55), 'ruby_meat', rot(0, 0, 0), meat_tex, 1))
    sc.add(Prim('ell', (0.5, 0.05, 1.05), (0.95, 0.85, 0.85), 'ruby_meat', rot(0, 0, 0), meat_tex, 2))
    img = sc.render()
    fx.glint(img, 25, 9, 1)
    return img


# ----------------------------------------------------------------- reserved late-game art
def fish():
    """A blue fish seen from its flat side, head to the right."""
    sc = Scene(MATS, scale=10.6, origin=(22, 25))
    Rz = rot(0, 0, -45)
    def at(lx, ly, lz):                                  # fish-local (along the body, toward the camera, up) -> world
        return (lx * 0.7071 + ly * 0.7071, -lx * 0.7071 + ly * 0.7071, lz)
    sc.add(Prim('ell', at(0.1, 0, 1.0), (1.55, 0.42, 0.64), 'fish_blue', Rz, None, 1))                 # body
    sc.add(Prim('ell', at(0.15, -0.1, 0.72), (1.25, 0.36, 0.3), 'fish_belly', Rz, None, 2))            # pale belly
    sc.add(Prim('ell', at(-1.4, 0, 1.0), (0.5, 0.2, 0.34), 'fish_blue', Rz, None, 3))                  # tail root
    sc.add(Prim('ell', at(-2.0, 0, 1.45), (0.6, 0.09, 0.2), 'fish_blue', rot(0, -38, -45), None, 4))   # upper tail lobe
    sc.add(Prim('ell', at(-2.0, 0, 0.55), (0.6, 0.09, 0.2), 'fish_blue', rot(0, 38, -45), None, 5))    # lower tail lobe
    sc.add(Prim('ell', at(-0.1, 0, 1.6), (0.62, 0.12, 0.34), 'fish_blue', rot(0, -22, -45), None, 6))  # dorsal fin
    sc.add(Prim('ell', at(0.55, -0.3, 0.62), (0.36, 0.08, 0.2), 'fish_blue', rot(0, 30, -45), None, 7))   # pectoral fin
    sc.add(Prim('ell', at(1.12, -0.38, 1.12), (0.17, 0.06, 0.17), 'cream', Rz, None, 8))               # eye
    sc.add(Prim('ell', at(1.16, -0.43, 1.1), (0.09, 0.04, 0.1), 'dark', Rz, None, 9))
    img = sc.render()
    fx.glint(img, 24, 12, 1)
    return img


def _crystal(sc, mat, x, y, z, r, h, tilt, spin, seed):
    """A faceted crystal: square prism body (a box turned 45 degrees) with a pointed top."""
    R = rot(tilt[0], tilt[1], spin)
    sc.add(Prim('box', (x, y, z), (r, r, h), mat, R, facet_tex, seed))
    top = (x + math.sin(math.radians(tilt[1])) * h * 0.95, y - math.sin(math.radians(tilt[0])) * h * 0.95, z + h * 0.92)
    sc.add(Prim('cone', (top[0], top[1], top[2] + r * 0.9), (r * 1.42, r * 0.9), mat, rot(tilt[0], tilt[1], spin + 45), facet_tex, seed + 1))


def mana():
    """Reserved: a cluster of violet crystals."""
    sc = Scene(MATS, scale=12.0, origin=(20, 29))
    _crystal(sc, 'amethyst', -0.1, 0.1, 1.15, 0.36, 1.1, (0, 0), 45, 1)
    _crystal(sc, 'amethyst', -0.85, -0.2, 0.8, 0.3, 0.75, (0, -14), 40, 3)
    _crystal(sc, 'amethyst', 0.75, -0.25, 0.7, 0.3, 0.65, (12, 8), 50, 5)
    _crystal(sc, 'amethyst', 0.2, -0.85, 0.45, 0.25, 0.42, (14, 0), 45, 7)
    _crystal(sc, 'amethyst', -0.6, 0.65, 0.55, 0.24, 0.5, (-10, -8), 30, 9)
    img = sc.render()
    fx.glint(img, 19, 8, 2)
    fx.glint(img, 27, 17, 1)
    return img


def shard():
    """Reserved: a tall green shard (the ability-shard reward)."""
    sc = Scene(MATS, scale=10.4, origin=(20, 27))
    sc.add(Prim('box', (0.0, 0.0, 1.5), (0.62, 0.62, 0.62), 'emerald', rot(0, 0, 45), facet_tex, 3))
    sc.add(Prim('cone', (0.0, 0.0, 2.7), (0.88, 0.62), 'emerald', rot(0, 0, 45), facet_tex, 1))
    sc.add(Prim('cone', (0.0, 0.0, 0.35), (0.88, 0.62), 'emerald', rot(180, 0, 45), facet_tex, 2))
    img = sc.render()
    fx.glint(img, 17, 10, 2)
    return img


def mystery():
    """Reserved: a wooden crate with gold corners and a '?' plaque (the random-item reward)."""
    sc = Scene(MATS, scale=10.8, origin=(20, 27))
    sc.add(Prim('box', (0.0, 0.0, 0.95), (1.1, 1.1, 0.95), 'timber', I3, plank_tex, 1))
    for sx in (-1, 1):                                                      # gold corner posts + top and bottom bands
        for sy in (-1, 1):
            sc.add(Prim('box', (sx * 1.08, sy * 1.08, 0.97), (0.17, 0.17, 0.97), 'nugget', I3, None, 2))
    for z in (0.14, 1.8):
        sc.add(Prim('box', (0.0, 0.0, z), (1.14, 1.14, 0.1), 'nugget', I3, None, 4))
    img = sc.render()
    return _paint_question_mark(img)


def _paint_question_mark(img):
    """A gold '?' on a blue plaque, painted over the left-hand face of the crate."""
    d = ImageDraw.Draw(img)
    blue, gold_c, edge = MATS['banner_blue'].ramp[2], MATS['nugget'].ramp[3], MATS['banner_blue'].ramp[0]
    d.rectangle([10, 19, 19, 30], fill=blue, outline=edge)
    glyph = ['.####.', '##..##', '...##.', '..##..', '..#...', '......', '..#...']
    for j, row in enumerate(glyph):
        for i, c in enumerate(row):
            if c == '#':
                img.putpixel((12 + i, 21 + j), gold_c)
    return img
