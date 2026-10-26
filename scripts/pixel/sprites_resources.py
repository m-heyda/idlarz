"""Resource sprites. The six heaps (gold, wood, stone, coal, meat) plus the reserved late-game set (iron, fish, mana,
blue crystals, mystery box) and the gem and chests come from the supplied sheet (extract_sheet.py -> assets/*.png, 40px, no
ground shadow). What the sheet has no picture for stays procedural: the carrots (food), the emerald ability shard and the farm
products (eggs, milk, hide). Sprites float on transparency so they sit on any background."""
import math
import os
from PIL import Image
from render3d import Scene, Prim, rot, vnoise, I3, mv, mm as mm3, mul as mul3, add as add3
from materials import MATS
import fx

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
GOLD_HI = [MATS['gold'].ramp[-1], MATS['gold'].spec_col]              # coin pouch (menu button)


def sheet_sprite(name):
    """A sprite cut from the supplied sheet (see extract_sheet.py)."""
    return Image.open(os.path.join(ASSETS, f'{name}.png')).convert('RGBA')


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




# ----------------------------------------------------------------- food: carrots (and the bread kept for later)
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


def carrot_tex(pl, nl, pr):
    """Growth rings across the root and the odd chip of lighter skin."""
    ring = (pl[2] * 2.6 + vnoise(pl[0] * 3, pl[1] * 3, 0, pr.seed) * 0.5) % 1.0
    if ring < 0.1:
        return None, -0.22
    n = vnoise(pl[0] * 4, pl[1] * 4, pl[2] * 4, pr.seed)
    return None, (0.2 if n > 0.8 else 0.0)


def carrot():
    """Food: two carrots lying across each other, with leafy green tops."""
    sc = Scene(MATS, scale=11.0, origin=(20, 29))
    for k, (c, yaw, h, r) in enumerate((((0.35, 0.3, 0.8), 300, 1.55, 0.55), ((-0.95, -0.7, 0.6), 335, 1.1, 0.42))):
        R = rot(90, 0, yaw)
        sc.add(Prim('cone', c, (r, h), 'carrot', R, carrot_tex, 10 + k))
        up = mv(R, (0, 0, -1))                                   # from the tip towards the leafy end
        top = add3(c, mul3(up, h))
        for j, (side, splay) in enumerate(((0.0, 0), (0.16, 24), (-0.16, -24))):
            Rl = mm3(R, rot(0, splay, 0))
            base = add3(top, mul3(mv(Rl, (0, 0, -1)), 0.75))
            sc.add(Prim('ell', (base[0] + side * 0.3, base[1], base[2] + 0.05), (0.17, 0.17, 0.95), 'reed', Rl, None, 20 + k * 3 + j))
    return sc.render()


def shard():
    """Reserved: a tall green shard (the ability-shard reward)."""
    sc = Scene(MATS, scale=10.4, origin=(20, 27))
    sc.add(Prim('box', (0.0, 0.0, 1.5), (0.62, 0.62, 0.62), 'emerald', rot(0, 0, 45), facet_tex, 3))
    sc.add(Prim('cone', (0.0, 0.0, 2.7), (0.88, 0.62), 'emerald', rot(0, 0, 45), facet_tex, 1))
    sc.add(Prim('cone', (0.0, 0.0, 0.35), (0.88, 0.62), 'emerald', rot(180, 0, 45), facet_tex, 2))
    img = sc.render()
    fx.glint(img, 17, 10, 2)
    return img


# ----------------------------------------------------------------- farm products
def egg_tex(pl, nl, pr):
    n = vnoise(pl[0] * 5, pl[1] * 5, pl[2] * 5, pr.seed)
    return None, (0.12 if n > 0.8 else (-0.1 if n < 0.18 else 0.0))


def eggs():
    """Farm product: three eggs in a small straw nest."""
    sc = Scene(MATS, scale=12.0, origin=(20, 27))
    sc.add(Prim('ell', (0.0, 0.0, 0.12), (1.75, 1.45, 0.2), 'hay', I3, None, 1))
    for i, (x, y, z, mat, yaw) in enumerate(((-0.62, 0.3, 0.62, 'crumb', 14), (0.62, 0.22, 0.6, 'crumb', -10), (0.0, -0.55, 0.64, 'cream', 4))):
        sc.add(Prim('ell', (x, y, z), (0.5, 0.5, 0.66), mat, rot(0, 0, yaw), egg_tex, i + 3))
    return sc.render()


def milk():
    """Farm product: a glass bottle of milk with a wooden stopper."""
    sc = Scene(MATS, scale=11.5, origin=(20, 28))
    sc.add(Prim('cyl', (0.0, 0.0, 0.95), (0.82, 0.95), 'cream', I3, None, 1))                # body
    sc.add(Prim('cone', (0.0, 0.0, 2.2), (0.82, 0.5), 'cream', I3, None, 2))                 # shoulder
    sc.add(Prim('cyl', (0.0, 0.0, 2.45), (0.34, 0.4), 'glass', I3, None, 3))                 # neck
    sc.add(Prim('cyl', (0.0, 0.0, 2.95), (0.4, 0.14), 'timber', I3, None, 4))                # stopper
    sc.add(Prim('cyl', (0.0, 0.0, 1.0), (0.86, 0.26), 'banner_blue', I3, None, 5))           # label band
    return sc.render()


def hide_tex(pl, nl, pr):
    n = vnoise(pl[0] * 3.4, pl[1] * 3.4, pl[2] * 3.4, pr.seed)
    return None, (n - 0.5) * 0.4


def hide():
    """Farm product: a rolled hide tied with cord."""
    sc = Scene(MATS, scale=11.5, origin=(20, 25))
    sc.add(Prim('cyl', (0.0, 0.0, 0.85), (0.85, 1.45), 'pleather', rot(90, 0, 35), hide_tex, 1))
    for off in (-0.7, 0.7):
        sc.add(Prim('cyl', (off * 0.82, off * 0.57, 0.85), (0.9, 0.09), 'rope', rot(90, 0, 35), None, 2))
    sc.add(Prim('ell', (1.25 * 0.82, 1.25 * 0.57, 0.85), (0.7, 0.7, 0.18), 'leather', rot(0, 90, 35), None, 3))
    return sc.render()
