"""Gear tiers (40x40 item icons) and the better healing potion.

Four armour families, each with all 12 slot pieces (the ring fits both ring slots, so 10 armour/accessory icons +
a weapon + an off hand): wooden/leather (plain brown), cloth (linen and violet robes), steel (cool silver plate with
blue cloth) and obsidian (glassy black, violet-cyan light, spikes - deliberately the fanciest). The pieces are the
slot icons of sprites_equipment re-skinned through material remaps, plus a few drawn from scratch (the wizard hat,
the robe). Weapons (swords, maces, axes, daggers, spears, bows, a crossbow, staves, a wand, a tome) are new
geometry built from the same primitives; three legendary weapons burn in `ember`.
"""
import math
from render3d import Scene, Prim, rot, between, place, add, mul, norm, frame, I3
from materials import MATS
import fx
import sprites_equipment as eq


# ----------------------------------------------------------------- helpers
def _mats(remap):
    out = dict(MATS)
    for key, value in remap.items():
        out[key] = MATS[value]
    return out


def _skin(fn, remap, glint=False, extras=None):
    """Render a sprites_equipment icon with materials swapped, optionally adding scene primitives before it renders."""
    old = eq.MATS, fx.glint, eq._scene
    eq.MATS = _mats(remap)
    if not glint:
        fx.glint = lambda *a, **k: None
    if extras:
        orig = eq._scene

        def scene(*a, **k):
            sc = orig(*a, **k)
            render = sc.render

            def render_plus(*ra, **rk):
                extras(sc)
                return render(*ra, **rk)
            sc.render = render_plus
            return sc
        eq._scene = scene
    try:
        return fn()
    finally:
        eq.MATS, fx.glint, eq._scene = old


def _A(sc, kind, c, size, mat, R=I3, tex=None, seed=0, yaw=-45):
    sc.add(place(Prim(kind, c, size, mat, R, tex, seed), yaw))


def _ws(scale=11.0):
    return Scene(MATS, scale=scale, origin=(20, 20))


def _P(sc, x, y):
    return add(mul(sc.r, x), mul(sc.u, y))


def _hint(sc):
    return mul(sc.f, -1)


def _rod(sc, p0, p1, r, mat, seed=0):
    sc.add(between('cyl', p0, p1, (r,), mat, None, _hint(sc), seed))


def _slab(sc, p0, p1, w, t, mat, tex=None):
    sc.add(between('box', p0, p1, (w, t), mat, tex, _hint(sc)))


def _ball(sc, p, r, mat, seed=0):
    sc.add(Prim('ell', p, (r, r, r), mat, I3, None, seed))


def _spike(sc, base, d, length, r, mat):
    """Cone from `base` pointing along `d`."""
    dn = norm(d)
    sc.add(Prim('cone', add(base, mul(dn, length / 2)), (r, length / 2), mat, frame(dn, _hint(sc))))


def _rotp(x, y, deg):
    a = math.radians(deg)
    return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)


def _blade_tex(groove=None, edge=None):
    def tex(pl, nl, pr):
        if abs(pl[0]) < 0.028:
            return groove, (0.0 if groove else -0.32)      # fuller: a glowing vein or a plain groove
        if abs(pl[0]) > pr.s[0] - 0.035:
            return edge, 0.3                               # honed edge
        return None, 0.0
    return tex


def _done(sc, glints=(), fit=37):
    """Render a weapon scene: first on a roomy canvas to measure it, then shrunk (never grown) and centred so
    it fits the 40x40 canvas with a 1-2 px margin. Glints land on the highest highlight pixel(s)."""
    sc.w = sc.h = 96
    sc.origin = (48, 48)
    bb = sc.render(outline=True).getbbox()
    cx, cy = (bb[0] + bb[2]) / 2 - 48, (bb[1] + bb[3]) / 2 - 48
    k = min(1.0, fit / max(bb[2] - bb[0], bb[3] - bb[1]))
    sc.scale *= k
    sc.w = sc.h = 40
    sc.origin = (round(20 - k * cx), round(20 - k * cy))
    img = sc.render()
    spots = fx.find_highlights(img, [m.ramp[-1] for m in sc.mats.values()], n=len(glints), min_dist=9)
    for (x, y), (_, _, r) in zip(spots, glints):
        fx.glint(img, x, y, r)
    return img


# ----------------------------------------------------------------- melee weapons
def _sword(blade='steel', guard='gold', grip='leather', gem='ruby', pom='gold', groove=None, edge=None,
           wing=0.62, reach=1.0, glints=((33, 6, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    g = _P(sc, -0.85, -0.95)
    tip = _P(sc, 1.45 * reach, 1.6 * reach)
    pm = _P(sc, -1.45, -1.55)
    mid = add(mul(g, 0.12), mul(tip, 0.88))
    tex = _blade_tex(groove, edge)
    sc.add(between('box', g, mid, (0.17, 0.05), blade, tex, h))
    sc.add(between('box', mid, tip, (0.1, 0.045), blade, tex, h))
    bx, by = 1.45 * reach + 0.85, 1.6 * reach + 0.95
    ln = math.hypot(bx, by)
    nx, ny = -by / ln * wing, bx / ln * wing
    sc.add(between('box', add(g, _P(sc, -nx, -ny)), add(g, _P(sc, nx, ny)), (0.1, 0.1), guard, None, h))
    _ball(sc, g, 0.2, gem, 9)
    sc.add(between('cyl', g, pm, (0.11,), grip, None, h))
    _ball(sc, pm, 0.24, pom, 2)
    if extras:
        extras(sc)
    return _done(sc, glints)


def _dagger(blade='steel', guard='gold', grip='leather', gem='ruby', groove=None, curved=False, glints=((30, 9, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    g = _P(sc, -0.35, -0.45)
    tip = _P(sc, 1.25, 1.35)
    pm = _P(sc, -1.0, -1.1)
    tex = _blade_tex(groove)
    if curved:                                    # kris: a flame-shaped wave
        pts = [g, _P(sc, 0.25, 0.1), _P(sc, 0.55, 0.85), _P(sc, 0.95, 1.05), tip]
        for a, b in zip(pts, pts[1:]):
            sc.add(between('box', a, b, (0.15, 0.045), blade, tex, h))
    else:
        sc.add(between('box', g, tip, (0.14, 0.045), blade, tex, h))
    n = (-0.707 * 0.5, 0.707 * 0.5)
    sc.add(between('box', add(g, _P(sc, -n[0], -n[1])), add(g, _P(sc, n[0], n[1])), (0.08, 0.09), guard, None, h))
    _ball(sc, g, 0.16, gem, 9)
    sc.add(between('cyl', g, pm, (0.1,), grip, None, h))
    _ball(sc, pm, 0.2, guard, 2)
    if extras:
        extras(sc)
    return _done(sc, glints)


def _mace(shaft='bark', head='steel', flange='steel', band='gold', gem=None, spikes=6, glints=((29, 7, 2),), extras=None):
    sc = _ws()
    pm = _P(sc, -1.5, -1.5)
    top = _P(sc, 0.85, 0.9)
    _rod(sc, pm, top, 0.12, shaft)
    _ball(sc, pm, 0.2, band, 2)
    hc = _P(sc, 1.15, 1.2)
    _ball(sc, hc, 0.58, head, 5)
    for k in range(spikes):                       # flanges around the head
        a = k * 2 * math.pi / spikes + 0.3
        d = add(mul(sc.r, math.cos(a)), mul(sc.u, math.sin(a)))
        _spike(sc, add(hc, mul(d, 0.45)), d, 0.5, 0.17, flange)
    _ball(sc, add(hc, mul(sc.f, -0.5)), 0.2, gem or band, 6)
    _rod(sc, add(top, _P(sc, -0.05, -0.05)), add(top, _P(sc, 0.15, 0.15)), 0.17, band)
    if extras:
        extras(sc)
    return _done(sc, glints)


def _maul(shaft='bark', head='steel', cap='gold', inlay=None, glints=((28, 5, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    pm = _P(sc, -1.55, -1.55)
    top = _P(sc, 0.95, 1.0)
    _rod(sc, pm, top, 0.13, shaft)
    _ball(sc, pm, 0.2, cap, 2)
    c = _P(sc, 1.05, 1.15)
    n = _P(sc, -0.707, 0.707)
    sc.add(between('box', add(c, mul(n, -1.0)), add(c, mul(n, 1.0)), (0.5, 0.42), head, None, h))
    for s in (-1, 1):                              # metal end caps
        sc.add(between('box', add(c, mul(n, 0.84 * s)), add(c, mul(n, 1.08 * s)), (0.56, 0.48), cap, None, h))
    if inlay:
        sc.add(between('box', add(c, mul(n, -0.5)), add(c, mul(n, 0.5)), (0.2, 0.46), inlay, None, h))
    _rod(sc, add(top, _P(sc, -0.1, -0.1)), add(top, _P(sc, 0.12, 0.12)), 0.2, cap)
    if extras:
        extras(sc)
    return _done(sc, glints)


def _axe(shaft='bark', blade='steel', edge='plate', band='gold', glints=((31, 4, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    pm = _P(sc, -1.55, -1.55)
    top = _P(sc, 1.25, 1.3)
    _rod(sc, pm, top, 0.12, shaft)
    _ball(sc, pm, 0.2, band, 2)
    d = _P(sc, 0.707, 0.707)
    n = _P(sc, -0.707, 0.707)
    base = _P(sc, 0.75, 0.8)
    _rod(sc, add(base, mul(d, -0.1)), add(base, mul(d, 0.9)), 0.17, band)                    # socket
    # crescent head swinging out toward the upper left: widens with distance, then the honed edge
    steps = [(0.0, 0.35, 0.28), (0.35, 0.75, 0.4), (0.75, 1.15, 0.52), (1.15, 1.5, 0.58)]
    for s0, s1, w in steps:
        c0 = add(add(base, mul(d, 0.38)), mul(n, s0 + 0.1))
        c1 = add(add(base, mul(d, 0.38)), mul(n, s1 + 0.1))
        sc.add(between('box', c0, c1, (w, 0.1), blade, None, h))
    e0 = add(add(base, mul(d, 0.38)), mul(n, 1.55))
    sc.add(between('box', add(e0, mul(d, -0.62)), add(e0, mul(d, 0.62)), (0.08, 0.1), edge, None, h))
    sc.add(between('box', add(base, add(mul(d, 1.0), mul(n, 0.15))), add(base, add(mul(d, 1.0), mul(n, 0.55))), (0.14, 0.09), blade, None, h))  # back spike
    if extras:
        extras(sc)
    return _done(sc, glints)


def _spear(shaft='bark', head='steel', band='gold', tassel='cloth', glints=((32, 4, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    pm = _P(sc, -1.75, -1.7)
    top = _P(sc, 0.85, 0.95)
    _rod(sc, pm, top, 0.1, shaft)
    _ball(sc, pm, 0.17, band, 2)
    d = norm(add(top, mul(pm, -1)))
    for a, b, w in ((0.0, 0.5, 0.22), (0.5, 0.95, 0.3), (0.95, 1.35, 0.22), (1.35, 1.65, 0.1)):
        sc.add(between('box', add(top, mul(d, a)), add(top, mul(d, b)), (w, 0.06), head, _blade_tex(), h))
    _rod(sc, add(top, mul(d, -0.15)), add(top, mul(d, 0.12)), 0.16, band)
    _ball(sc, add(top, _P(sc, -0.12, -0.2)), 0.2, tassel, 4)
    if extras:
        extras(sc)
    return _done(sc, glints)


# ----------------------------------------------------------------- ranged weapons
def _bow(limb='bark', string='bone', grip='leather', gem=None, tip='gold', tilt=-22, glints=((12, 6, 2),), extras=None, spread=0.95):
    sc = _ws()
    n = 16
    pts = []
    for i in range(n + 1):
        s = -1 + 2 * i / n
        x = -0.3 - spread * (1 - s * s)
        y = 1.95 * s
        pts.append(_rotp(x, y, tilt))
    for i in range(n):
        r = 0.17 - 0.08 * abs(-1 + 2 * (i + 0.5) / n) ** 2
        a, b = pts[i], pts[i + 1]
        _rod(sc, _P(sc, *a), _P(sc, *b), max(0.08, r), limb, i)
    top, bot = pts[-1], pts[0]
    _ball(sc, _P(sc, *top), 0.12, tip, 90)
    _ball(sc, _P(sc, *bot), 0.12, tip, 91)
    _rod(sc, _P(sc, *top), _P(sc, *bot), 0.06, string)                       # bowstring
    mid = pts[n // 2]
    g0, g1 = pts[n // 2 - 2], pts[n // 2 + 2]
    _rod(sc, _P(sc, *g0), _P(sc, *g1), 0.17, grip)                            # wrapped grip
    if gem:
        _ball(sc, add(_P(sc, *mid), mul(sc.f, -0.15)), 0.19, gem, 92)
    ax, ay = _rotp(-0.35, 0, tilt)
    bx, by = _rotp(1.6, 0, tilt)
    _rod(sc, _P(sc, ax, ay), _P(sc, bx, by), 0.06, 'bone')                    # nocked arrow
    _spike(sc, _P(sc, bx, by), _P(sc, *_rotp(1, 0, tilt)), 0.4, 0.09, 'steel')
    if extras:
        extras(sc)
    return _done(sc, glints)


def _crossbow(stock='bark', prod='steel', string='bone', trim='gold', gem=None, glints=((30, 9, 2),), extras=None):
    sc = _ws()
    h = _hint(sc)
    tilt = -24
    P = lambda x, y: _P(sc, *_rotp(x, y, tilt))
    sc.add(between('box', P(-1.55, 0), P(1.15, 0), (0.2, 0.17), stock, None, h))                    # stock
    _rod(sc, P(-1.55, 0.02), P(-1.7, 0.02), 0.25, trim)
    n = 12
    pts = []
    for i in range(n + 1):
        s = -1 + 2 * i / n
        pts.append((1.0 + 0.45 * (1 - s * s) * 0.0 + 0.35 * s * s, 1.65 * s))
    for i in range(n):
        _rod(sc, P(*pts[i]), P(*pts[i + 1]), 0.11, prod, i)                                          # steel prod, tips swept back
    _rod(sc, P(*pts[-1]), P(-0.55, 0), 0.06, string)
    _rod(sc, P(*pts[0]), P(-0.55, 0), 0.06, string)
    _rod(sc, P(-0.55, 0.2), P(1.75, 0.2), 0.07, 'bone')                                              # bolt
    _spike(sc, P(1.7, 0.2), _P(sc, *_rotp(1, 0, tilt)), 0.35, 0.09, 'steel')
    _ball(sc, P(0.3, -0.05), 0.2, trim, 3)
    if gem:
        _ball(sc, add(P(-0.2, 0.0), mul(sc.f, -0.2)), 0.17, gem, 4)
    if extras:
        extras(sc)
    return _done(sc, glints)


# ----------------------------------------------------------------- staves, wand, tome
def _staff(shaft='bark', band='gold', orb='arcane', prongs='gold', leaf=False, glints=((27, 6, 2),), extras=None):
    sc = _ws()
    pm = _P(sc, -1.65, -1.65)
    top = _P(sc, 0.95, 0.95)
    _rod(sc, pm, top, 0.12, shaft)
    _ball(sc, pm, 0.17, band, 2)
    c = _P(sc, 1.25, 1.25)
    _rod(sc, add(top, _P(sc, -0.15, -0.15)), add(top, _P(sc, 0.1, 0.1)), 0.19, band)
    for k in range(5):                                                       # cradle of prongs
        a = math.radians(k * 72 + 20)
        d = add(add(mul(sc.r, 0.707 * 0.7), mul(sc.u, 0.707 * 0.7)), add(mul(sc.r, math.cos(a) * 0.6), mul(sc.u, math.sin(a) * 0.6)))
        _spike(sc, add(top, _P(sc, 0.05, 0.05)), d, 0.65, 0.1, prongs)
    _ball(sc, c, 0.42, orb, 7)
    if leaf:
        _ball(sc, add(c, _P(sc, -0.08, 0.1)), 0.14, 'moss', 8)
    if extras:
        extras(sc)
    return _done(sc, glints)


def _wand(shaft='bark', band='gold', orb='arcane', glints=((28, 8, 3),)):
    sc = _ws()
    pm = _P(sc, -1.2, -1.2)
    top = _P(sc, 0.7, 0.75)
    _rod(sc, pm, top, 0.1, shaft)
    _ball(sc, pm, 0.15, band, 2)
    _rod(sc, add(top, _P(sc, -0.1, -0.1)), add(top, _P(sc, 0.1, 0.1)), 0.15, band)
    _ball(sc, _P(sc, 0.95, 1.0), 0.3, orb, 6)
    for k in range(4):
        a = math.radians(k * 90 + 45)
        _spike(sc, _P(sc, 0.95, 1.0), add(mul(sc.r, math.cos(a)), mul(sc.u, math.sin(a))), 0.62, 0.07, band)
    return _done(sc, glints)


def _tome(cover='robe', trim='gold', pages='linen', gem='arcane', clasp='gold', glints=((12, 6, 2),)):
    sc = _ws()
    h = _hint(sc)
    f = sc.f
    sc.add(between('box', _P(sc, 0.05, -1.4), _P(sc, 0.05, 1.4), (1.05, 0.34), cover, None, h))                    # cover
    sc.add(between('box', add(_P(sc, 0.18, -1.3), mul(f, 0.14)), add(_P(sc, 0.18, 1.3), mul(f, 0.14)), (0.95, 0.3), pages, None, h))   # page block
    sc.add(between('box', add(_P(sc, -1.0, -1.4), mul(f, -0.02)), add(_P(sc, -1.0, 1.4), mul(f, -0.02)), (0.16, 0.38), trim, None, h))  # spine
    for y in (-1.38, 1.38):
        sc.add(between('box', _P(sc, -0.9, y), _P(sc, 1.1, y), (0.07, 0.36), trim, None, h))                      # bound corners
    sc.add(between('box', add(_P(sc, 0.2, -1.3), mul(f, -0.32)), add(_P(sc, 0.2, 1.3), mul(f, -0.32)), (0.16, 0.05), clasp, None, h))
    _ball(sc, add(_P(sc, 0.15, 0.1), mul(f, -0.4)), 0.34, trim, 3)
    _ball(sc, add(_P(sc, 0.15, 0.1), mul(f, -0.55)), 0.22, gem, 4)
    return _done(sc, glints)


# ----------------------------------------------------------------- the better potion
def potion_greater():
    sc = Scene(MATS, scale=13.0, origin=(20, 33))
    sc.add(Prim('ell', (0, 0, 0.85), (0.98, 0.98, 0.92), 'ruby', I3, None, 1))                  # a bigger flask of brighter liquid
    sc.add(Prim('cyl', (0, 0, 0.92), (1.0, 0.07), 'gold'))                                      # gold belly band
    sc.add(Prim('ell', (0, 0, 1.2), (0.62, 0.62, 0.22), 'glass', I3, None, 2))
    sc.add(Prim('cyl', (0, 0, 1.78), (0.28, 0.42), 'glass', I3, None, 3))
    sc.add(Prim('cyl', (0, 0, 2.22), (0.34, 0.07), 'gold'))
    sc.add(Prim('cyl', (0, 0, 2.45), (0.22, 0.22), 'bark', I3, None, 4))
    sc.add(Prim('ell', (0.25, -0.62, 0.95), (0.12, 0.08, 0.12), 'ruby_meat', I3, None, 5))      # a swirl of bubbles
    sc.add(Prim('ell', (-0.3, -0.58, 0.55), (0.09, 0.06, 0.09), 'meat', I3, None, 6))
    sc.add(Prim('ell', (0, -0.9, 1.25), (0.1, 0.06, 0.14), 'gold'))                             # star stud
    img = sc.render()
    fx.glint(img, 14, 17, 2)
    fx.glint(img, 26, 25, 1)
    return img


# ----------------------------------------------------------------- armour families (re-skins)
LEATHER = {
    'head': {'steel': 'leather', 'gold': 'pleather', 'cloth': 'bark', 'bark': 'wood_cut'},
    'shoulder': {'steel': 'leather', 'gold': 'pleather', 'leather': 'bark'},
    'chest': {'steel': 'leather', 'cloth': 'tunic', 'gold': 'pleather', 'pleather': 'bark', 'leather': 'bark'},
    'hands': {'steel': 'leather', 'gold': 'pleather'},
    'legs': {'trouser': 'tunic', 'steel': 'leather', 'gold': 'pleather', 'pleather': 'bark'},
    'feet': {'leather': 'leather', 'gold': 'pleather', 'pleather': 'bark'},
    'neck': {'gold': 'leather', 'steel': 'wood_cut', 'ruby': 'emerald'},
    'cape': {'cloth': 'leather', 'gold': 'pleather'},
    'ring': {'gold': 'wood_cut', 'ruby': 'emerald'},
    'charm': {'gold': 'wood_cut', 'ruby': 'moss', 'leather': 'bark'},
}
CLOTH = {
    'shoulder': {'steel': 'robe', 'gold': 'gold', 'leather': 'pleather'},
    'hands': {'steel': 'linen', 'gold': 'gold'},
    'legs': {'trouser': 'robe', 'steel': 'robe', 'gold': 'gold', 'pleather': 'linen'},
    'feet': {'leather': 'robe', 'pleather': 'linen', 'gold': 'gold'},
    'neck': {'gold': 'gold', 'steel': 'linen', 'ruby': 'arcane'},
    'cape': {'cloth': 'robe', 'gold': 'gold'},
    'ring': {'gold': 'gold', 'ruby': 'arcane'},
    'charm': {'gold': 'gold', 'ruby': 'arcane', 'leather': 'pleather'},
}
STEEL = {
    'head': {'steel': 'plate', 'cloth': 'banner_blue', 'gold': 'steel'},
    'shoulder': {'steel': 'plate', 'gold': 'steel', 'leather': 'banner_blue'},
    'chest': {'steel': 'plate', 'cloth': 'banner_blue', 'gold': 'steel', 'pleather': 'steel', 'leather': 'banner_blue'},
    'hands': {'steel': 'plate', 'gold': 'steel'},
    'legs': {'trouser': 'trouser', 'steel': 'plate', 'gold': 'steel', 'pleather': 'steel'},
    'feet': {'leather': 'plate', 'pleather': 'steel', 'gold': 'steel'},
    'neck': {'gold': 'steel', 'steel': 'plate', 'ruby': 'crystal'},
    'cape': {'cloth': 'banner_blue', 'gold': 'plate'},
    'ring': {'gold': 'plate', 'ruby': 'crystal'},
    'charm': {'gold': 'plate', 'ruby': 'crystal', 'leather': 'steel'},
}
OBSIDIAN = {
    'head': {'steel': 'obsidian', 'cloth': 'obsidian_edge', 'gold': 'arcane'},
    'shoulder': {'steel': 'obsidian', 'gold': 'arcane', 'leather': 'plate_dk'},
    'chest': {'steel': 'obsidian', 'cloth': 'roof_plum', 'gold': 'arcane', 'pleather': 'plate_dk', 'leather': 'plate_dk'},
    'hands': {'steel': 'obsidian', 'gold': 'arcane'},
    'legs': {'trouser': 'obsidian', 'steel': 'obsidian', 'gold': 'arcane', 'pleather': 'plate_dk'},
    'feet': {'leather': 'obsidian', 'pleather': 'obsidian_edge', 'gold': 'arcane'},
    'neck': {'gold': 'obsidian_edge', 'steel': 'obsidian', 'ruby': 'amethyst'},
    'cape': {'cloth': 'obsidian', 'gold': 'obsidian_edge'},
    'ring': {'gold': 'obsidian', 'ruby': 'amethyst'},
    'charm': {'gold': 'obsidian', 'ruby': 'amethyst', 'leather': 'plate_dk'},
}

SLOT_FN = {'head': eq.head, 'shoulder': eq.shoulder, 'chest': eq.chest, 'hands': eq.hands, 'legs': eq.legs,
           'feet': eq.feet, 'neck': eq.neck, 'cape': eq.cape, 'ring': eq.ring, 'charm': eq.charm}


# --- obsidian flourishes: horns, spikes and a glowing core
def _x_head(sc):
    for sx in (-1, 1):
        _A(sc, 'cone', (0.78 * sx, 0, 1.45), (0.22, 0.75), 'obsidian_edge', rot(0, 40 * sx, 0))
    _A(sc, 'ell', (0, -0.78, 1.0), (0.1, 0.06, 0.24), 'obsidian_edge')


def _x_shoulder(sc):
    for sx in (-1, 1):
        _A(sc, 'cone', (1.05 * sx, 0, 1.5), (0.16, 0.5), 'obsidian_edge', rot(0, 28 * sx, 0))
        _A(sc, 'cone', (1.55 * sx, 0, 1.0), (0.12, 0.34), 'obsidian_edge', rot(0, 80 * sx, 0))


def _x_chest(sc):
    _A(sc, 'ell', (0, -0.62, 1.2), (0.2, 0.11, 0.3), 'obsidian_edge', I3, None, 40)
    for sx in (-1, 1):
        _A(sc, 'cone', (1.15 * sx, 0, 2.25), (0.15, 0.46), 'obsidian_edge', rot(0, 24 * sx, 0))


def _x_hands(sc):
    _A(sc, 'cyl', (0, 0, 0.9), (0.66, 0.05), 'obsidian_edge')
    for x in (-0.42, 0.42):
        _A(sc, 'cone', (x, -0.2, 1.85), (0.09, 0.3), 'obsidian_edge', rot(-25, 0, 0))


def _x_legs(sc):
    for sx in (-1, 1):
        _A(sc, 'cone', (0.5 * sx, -0.62, 1.22), (0.12, 0.3), 'obsidian_edge', rot(90, 0, 0))


def _x_feet(sc):
    for sx, dy in ((-1, 0.0), (1, 0.35)):
        _A(sc, 'cone', (0.62 * sx, -1.1 + dy, 0.4), (0.11, 0.3), 'obsidian_edge', rot(90, 0, 0))


def _x_cape(sc):
    _A(sc, 'ell', (0, -0.36, 2.2), (0.2, 0.1, 0.2), 'obsidian_edge')


OBS_EXTRAS = {'head': _x_head, 'shoulder': _x_shoulder, 'chest': _x_chest, 'hands': _x_hands, 'legs': _x_legs,
              'feet': _x_feet, 'cape': _x_cape}


def _x_aegis(sc):
    for k in range(8):                                    # a crown of glowing spikes around the rim
        a = math.radians(k * 45 + 22)
        d = add(mul(sc.r, math.cos(a)), mul(sc.u, math.sin(a)))
        _spike(sc, _P(sc, 1.3 * math.cos(a), 1.3 * math.sin(a)), d, 0.5, 0.14, 'obsidian_edge')


# --- cloth, drawn from scratch: a wizard hat and a robe
def cloth_hat():
    sc = eq._scene(13.0, (20, 34))
    _A(sc, 'cyl', (0, 0, 0.5), (1.35, 0.07), 'robe', I3, None, 1)                    # brim
    _A(sc, 'cone', (0, 0, 1.55), (0.88, 1.0), 'robe', I3, None, 2)                   # cone
    _A(sc, 'cyl', (0, 0, 0.72), (0.86, 0.1), 'linen')                                # hat band
    _A(sc, 'box', (0, -0.84, 0.72), (0.14, 0.04, 0.12), 'gold')                      # buckle
    _A(sc, 'ell', (0.28, 0.0, 2.6), (0.2, 0.2, 0.3), 'robe', rot(0, 38, 0), None, 3)  # bent tip
    _A(sc, 'ell', (0.6, 0.0, 2.7), (0.14, 0.14, 0.18), 'robe', rot(0, 75, 0), None, 4)
    _A(sc, 'ell', (0.74, -0.04, 2.55), (0.1, 0.1, 0.1), 'gold')                      # tip bead
    _A(sc, 'ell', (-0.35, -0.7, 1.7), (0.11, 0.06, 0.11), 'arcane')                  # star stud
    img = sc.render()
    fx.glint(img, 15, 14, 2)
    return img


def cloth_robe():
    sc = eq._scene(12.5, (20, 35))
    _A(sc, 'ell', (0, 0, 1.2), (1.0, 0.62, 1.15), 'robe', I3, None, 1)               # body
    _A(sc, 'ell', (0, 0, 0.5), (1.1, 0.7, 0.6), 'robe', I3, None, 6)                 # skirt
    _A(sc, 'box', (0, -0.6, 0.8), (0.28, 0.05, 0.85), 'linen')                       # front panel
    _A(sc, 'box', (0, -0.64, 0.8), (0.05, 0.03, 0.85), 'gold')
    _A(sc, 'cyl', (0, 0, 0.45), (0.9, 0.09), 'gold')                                 # sash
    _A(sc, 'ell', (0, -0.82, 0.45), (0.12, 0.06, 0.12), 'arcane')
    for sx in (-1, 1):
        _A(sc, 'ell', (1.05 * sx, 0, 1.85), (0.5, 0.45, 0.4), 'linen', I3, None, 2)   # mantle
        _A(sc, 'ell', (1.1 * sx, 0, 1.0), (0.3, 0.3, 0.7), 'robe', rot(0, 10 * sx, 0), None, 3)  # sleeve
        _A(sc, 'cyl', (1.15 * sx, 0, 0.35), (0.34, 0.08), 'gold')                    # cuff
    _A(sc, 'cyl', (0, 0, 1.95), (0.52, 0.12), 'linen')                               # collar
    _A(sc, 'cyl', (0, 0, 2.06), (0.54, 0.04), 'gold')
    img = sc.render()
    fx.glint(img, 13, 10, 2)
    return img


# ----------------------------------------------------------------- the registry
SPRITES = {'item_potion_greater': potion_greater}

SLOT_ID = {                      # slot -> icon suffix per family
    'wooden': {'head': 'leather_cap', 'shoulder': 'leather_pauldrons', 'chest': 'leather_vest', 'hands': 'leather_gloves',
               'legs': 'leather_leggings', 'feet': 'leather_boots', 'neck': 'wooden_pendant', 'cape': 'leather_cloak',
               'ring': 'wooden_ring', 'charm': 'acorn_charm'},
    'cloth': {'head': 'cloth_hat', 'shoulder': 'cloth_mantle', 'chest': 'cloth_robe', 'hands': 'cloth_gloves',
              'legs': 'cloth_trousers', 'feet': 'cloth_slippers', 'neck': 'cloth_amulet', 'cape': 'cloth_cape',
              'ring': 'cloth_ring', 'charm': 'cloth_charm'},
    'steel': {'head': 'steel_helm', 'shoulder': 'steel_pauldrons', 'chest': 'steel_cuirass', 'hands': 'steel_gauntlets',
              'legs': 'steel_greaves', 'feet': 'steel_sabatons', 'neck': 'steel_gorget', 'cape': 'steel_cloak',
              'ring': 'steel_ring', 'charm': 'steel_charm'},
    'obsidian': {'head': 'obsidian_helm', 'shoulder': 'obsidian_pauldrons', 'chest': 'obsidian_cuirass', 'hands': 'obsidian_gauntlets',
                 'legs': 'obsidian_greaves', 'feet': 'obsidian_sabatons', 'neck': 'obsidian_pendant', 'cape': 'obsidian_cloak',
                 'ring': 'obsidian_ring', 'charm': 'obsidian_charm'},
}
FAMILY = {'wooden': (LEATHER, False), 'cloth': (CLOTH, False), 'steel': (STEEL, True), 'obsidian': (OBSIDIAN, True)}
SPECIAL = {('cloth', 'head'): cloth_hat, ('cloth', 'chest'): cloth_robe}

for _fam, _slots in SLOT_ID.items():
    _table, _glint = FAMILY[_fam]
    for _slot, _name in _slots.items():
        if (_fam, _slot) in SPECIAL:
            SPRITES[f'item_{_name}'] = SPECIAL[(_fam, _slot)]
            continue
        _extras = OBS_EXTRAS.get(_slot) if _fam == 'obsidian' else None
        SPRITES[f'item_{_name}'] = (lambda s=_slot, t=_table, g=_glint, x=_extras: _skin(SLOT_FN[s], t[s], g, x))

# --- weapons and off hands
SPRITES.update({
    # wooden / cloth line (common)
    'item_wooden_club': lambda: _mace('bark', 'wood_cut', 'bark', 'pleather', spikes=0, glints=(), extras=None),
    'item_hunting_bow': lambda: _bow('wood_cut', 'bone', 'leather', None, 'bark', glints=()),
    'item_oak_staff': lambda: _staff('bark', 'pleather', 'emerald', 'bark', leaf=True, glints=()),
    'item_apprentice_wand': lambda: _wand('bark', 'gold', 'arcane'),
    'item_apprentice_tome': lambda: _tome('robe', 'gold', 'linen', 'arcane'),
    # steel line (uncommon)
    'item_iron_sword': lambda: _sword('steel', 'bark', 'leather', 'crystal', 'steel', edge='plate'),
    'item_steel_mace': lambda: _mace('leather', 'steel', 'plate', 'steel', 'crystal'),
    'item_battle_axe': lambda: _axe('bark', 'steel', 'plate', 'steel'),
    'item_steel_dagger': lambda: _dagger('plate', 'steel', 'leather', 'crystal'),
    'item_steel_spear': lambda: _spear('bark', 'plate', 'steel', 'banner_blue'),
    'item_recurve_bow': lambda: _bow('plate', 'bone', 'leather', 'crystal', 'steel', glints=((14, 5, 2),)),
    'item_steel_shield': lambda: _skin(eq.offhand, {'steel': 'plate', 'bark': 'steel', 'cloth': 'banner_blue', 'gold': 'steel'}, True),
    # obsidian line (rare)
    'item_obsidian_blade': lambda: _sword('obsidian', 'obsidian_edge', 'plate_dk', 'amethyst', 'obsidian_edge', groove='obsidian_edge', wing=0.8),
    'item_obsidian_maul': lambda: _maul('plate_dk', 'coal', 'obsidian_edge', 'obsidian_edge'),
    'item_obsidian_longbow': lambda: _bow('obsidian', 'obsidian_edge', 'plate_dk', 'amethyst', 'obsidian_edge', glints=((14, 5, 2),), spread=1.1),
    'item_obsidian_crossbow': lambda: _crossbow('plate_dk', 'obsidian', 'obsidian_edge', 'obsidian_edge', 'amethyst'),
    'item_obsidian_kris': lambda: _dagger('obsidian', 'obsidian_edge', 'plate_dk', 'amethyst', groove='obsidian_edge', curved=True),
    'item_obsidian_staff': lambda: _staff('obsidian', 'obsidian_edge', 'obsidian_edge', 'obsidian'),
    'item_obsidian_aegis': lambda: _skin(eq.offhand, {'steel': 'obsidian', 'bark': 'obsidian', 'cloth': 'obsidian_edge', 'gold': 'arcane'}, True, _x_aegis),
    # legendary (ember)
    'item_emberbrand': lambda: _sword('ember', 'gold', 'bark', 'ruby', 'gold', groove='glow', edge='glow', wing=0.95, reach=1.08),
    'item_starfall_bow': lambda: _bow('gold', 'glow', 'ember', 'glow', 'glow', glints=((13, 5, 3),), spread=1.2),
    'item_titan_maul': lambda: _maul('bark', 'ember', 'gold', 'glow'),
})
