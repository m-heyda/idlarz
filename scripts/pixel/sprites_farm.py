"""Farm pasture (isometric): a big fenced meadow with a barn, a coop, troughs, water tanks, a pond, hay and a gate, drawn by the
same ray-caster and camera as the animals so everything shares one light. The image is the size of a big dialog at native
pixels (the game draws it at 3x without scaling it), so the fence runs along the four diagonals and the meadow fills the
whole window. Two layers are produced from one render: 'back' (everything) and 'front' (just the near fences + gate, cut out
of the same render) so animals can walk between them.

Ground -> screen:  sx = OX + (x - y) * 0.7071 * SCALE      sy = OY - 0.3536 * (x + y) * SCALE   (feet at z = 0)
The React farm scene uses these same constants and the prop footprints below (src/components/game/overlays/farmGeometry.ts)."""
import math
import random
from render3d import Scene, Prim, rot, vnoise, between, I3
from materials import MATS
from sprites_props import plank_tex, shingle_tex, hay_tex
import fx

W, H = 348, 300
SCALE = 13.0
OX, OY = 140, 165
HX, HY = 18.0, 18.0          # fenced pasture half-extents (x, y); the meadow itself runs on past the fence
GATE = (-4.0, -2.0)          # gate opening along the near-right fence (y = -HY)


BARN = (8.5, 8.5, 1.3)                 # x, y, scale
COOP = (-1.0, 11.0, 0.7)
TROUGHS = [(-3.3, 1.4, 'x'), (8.0, -1.5, 'y'), (-6.0, -7.0, 'x'), (4.0, 10.5, 'x'), (13.5, 11.5, 'x'), (-7.0, -1.0, 'y'), (1.0, -10.0, 'x')]
TANKS = [(-9.0, 9.0), (11.5, 2.5), (6.0, 13.0), (-1.0, -4.0)]     # round water tanks
HAY = [(-6.0, 7.0), (10.0, 2.0), (2.0, -6.0), (-5.0, -3.5), (-11.0, -1.0), (14.5, 13.0), (-3.0, -11.0)]
BARRELS = [(11.6, 5.6), (12.4, 6.5), (11.5, 7.0), (-3.4, 9.2), (-4.1, 9.9)]
CRATES = [(1.8, 12.4), (2.7, 12.9), (12.0, 14.2), (-4.8, 12.4)]
POND = (-12.0, -4.0, 2.0)               # x, y, radius
SPOTS = [(-0.5, 6.0), (6.0, 6.0), (-8.0, 2.0)]   # bare earth where the animals gather (dirt in the ground texture)


def ground_tex(pl, nl, pr):
    if nl[2] < 0.5:
        return 'soil', 0.0                                    # the cut edge of the turf
    x, y = pl[0], pl[1]
    n = vnoise(x * 1.5, y * 1.5, 0, 3)
    m = vnoise(x * 5.0, y * 5.0, 0, 4)
    d = (m - 0.5) * 0.3 + (n - 0.5) * 0.35
    # trodden dirt: around every trough and tank, at the gate and along a worn track from the gate to the barn
    near = [math.hypot((x - tx) / (1.6 if ax == 'x' else 1.1), (y - ty) / (1.1 if ax == 'x' else 1.6)) for tx, ty, ax in TROUGHS]
    near += [math.hypot((x - tx) / 1.3, (y - ty) / 1.3) for tx, ty in TANKS]
    near += [math.hypot((x - sx) / 2.4, (y - sy) / 1.8) for sx, sy in SPOTS]
    near.append(math.hypot((x - (GATE[0] + GATE[1]) / 2) / 1.9, (y + HY - 0.6) / 1.4))
    # worn track: from the gate up to the barn door
    t = (y + HY) / (BARN[1] + HY - 1.5)
    dist_track = abs(x - ((GATE[0] + GATE[1]) / 2 + t * (BARN[0] - 1.2 - (GATE[0] + GATE[1]) / 2))) / 0.85 if 0 < t < 1 else 9
    if min(near + [dist_track]) < 1.0 - (m - 0.5) * 0.5:
        return 'soil', d * 0.7
    if m > 0.8:
        return None, d - 0.18                                 # darker tufts
    if m < 0.12:
        return None, d + 0.2                                  # sun-bleached blades
    return None, d


def barn(prims, cx, cy, k=1.3):
    def P(kind, c, size, mat, R=I3, tex=None, seed=0):
        prims.append(Prim(kind, (cx + c[0] * k, cy + c[1] * k, c[2] * k), tuple(s * k for s in size), mat, R, tex, seed))

    P('box', (0, 0, 0.06), (1.35, 0.98, 0.08), 'slate', I3, None, 30)
    P('box', (0, 0, 0.8), (1.25, 0.9, 0.72), 'barn', I3, plank_tex, 1)
    P('box', (0, -0.52, 1.9), (1.45, 0.7, 0.07), 'shingle', rot(38, 0, 0), shingle_tex, 2)
    P('box', (0, 0.52, 1.9), (1.45, 0.7, 0.07), 'shingle', rot(-38, 0, 0), shingle_tex, 3)
    P('box', (0, 0, 2.36), (1.45, 0.08, 0.07), 'cream')
    for z, hw in ((1.64, 0.78), (1.86, 0.56), (2.07, 0.34)):
        P('box', (-1.22, 0, z), (0.05, hw, 0.12), 'barn', I3, plank_tex, 4)
    P('box', (0.35, -0.9, 0.62), (0.64, 0.05, 0.6), 'cream')
    P('box', (0.35, -0.93, 0.62), (0.52, 0.05, 0.52), 'door', I3, plank_tex, 5)
    for (x0, x1) in ((0.0, 0.7), (0.7, 0.0)):
        prims.append(between('box', (cx + x0 * k, cy - 0.97 * k, 0.15 * k), (cx + x1 * k, cy - 0.97 * k, 1.05 * k),
                             (0.04 * k, 0.03 * k), 'cream', None, (0, -1, 0)))
    P('box', (-0.72, -0.9, 1.15), (0.22, 0.04, 0.2), 'cream')
    P('box', (-0.72, -0.93, 1.15), (0.16, 0.04, 0.14), 'dark')
    P('ell', (-0.72, -0.95, 1.05), (0.17, 0.05, 0.08), 'wheat', I3, hay_tex, 6)
    P('box', (-1.25, -0.9, 0.8), (0.05, 0.05, 0.72), 'cream')
    P('box', (1.25, -0.9, 0.8), (0.05, 0.05, 0.72), 'cream')
    P('cyl', (0.3, 0, 2.75), (0.035, 0.38), 'steel', I3, None, 7)
    P('box', (0.3, 0, 3.2), (0.3, 0.02, 0.06), 'gold')
    P('ell', (0.6, 0, 3.2), (0.1, 0.03, 0.1), 'gold')


def fence_run(back, front, axis, fixed, lo, hi, near, gap=None, step=1.75):
    """Posts + two rails along one edge. axis 'x' runs along x at y=fixed; 'y' runs along y at x=fixed."""
    out = front if near else back
    n = max(1, round((hi - lo) / step))
    pts = [lo + (hi - lo) * i / n for i in range(n + 1)]

    def at(t, z):
        return (t, fixed, z) if axis == 'x' else (fixed, t, z)

    for i, t in enumerate(pts):
        if gap and gap[0] < t < gap[1]:
            continue
        out.append(Prim('box', at(t, 0.55), (0.1, 0.1, 0.55), 'plank', I3, None, 100 + i))
        out.append(Prim('box', at(t, 1.13), (0.12, 0.12, 0.05), 'wood_cut', I3, None, 120 + i))
    for z in (0.42, 0.86):
        segs = [(lo, hi)] if not gap else [(lo, gap[0]), (gap[1], hi)]
        for a, b in segs:
            if b - a < 0.1:
                continue
            p0, p1 = at(a, z), at(b, z)
            out.append(between('box', p0, p1, (0.045, 0.07), 'plank', None, (0, 0, 1), 140 + int(z * 10)))


def trough(back, x, y, axis, seed):
    """A wooden water trough on two legs (long side along `axis`)."""
    hx, hy = (0.95, 0.38) if axis == 'x' else (0.38, 0.95)
    back.append(Prim('box', (x, y, 0.3), (hx, hy, 0.28), 'plank', I3, plank_tex, seed))
    back.append(Prim('box', (x, y, 0.5), (hx - 0.15, hy - 0.12, 0.1), 'water', I3, None, seed + 1))
    for s in (-1, 1):
        lx, ly = (x + 0.8 * s, y) if axis == 'x' else (x, y + 0.8 * s)
        back.append(Prim('box', (lx, ly, 0.18), ((0.08, 0.34, 0.18) if axis == 'x' else (0.34, 0.08, 0.18)), 'bark', I3, None, seed + 2))


def tank(back, x, y, seed):
    """A round wooden water tank with a steel hoop."""
    back.append(Prim('cyl', (x, y, 0.42), (0.78, 0.42), 'plank', I3, plank_tex, seed))
    back.append(Prim('cyl', (x, y, 0.3), (0.82, 0.05), 'steel', I3, None, seed + 1))
    back.append(Prim('cyl', (x, y, 0.62), (0.82, 0.05), 'steel', I3, None, seed + 2))
    back.append(Prim('ell', (x, y, 0.84), (0.66, 0.66, 0.07), 'water', I3, None, seed + 3))


def hay_stack(back, x, y, seed):
    """Three round bales and a heap of loose hay."""
    for i, (dx, dy, rz) in enumerate(((-0.55, -0.45, 15), (0.5, 0.15, -20), (-0.35, 0.65, 70))):
        back.append(Prim('cyl', (x + dx, y + dy, 0.42), (0.5, 0.5), 'wheat', rot(90, 0, rz), hay_tex, seed + i))
    back.append(Prim('ell', (x + 0.05, y + 0.05, 0.9), (0.38, 0.38, 0.28), 'wheat', I3, hay_tex, seed + 3))


def barrel(back, x, y, seed):
    back.append(Prim('cyl', (x, y, 0.4), (0.32, 0.4), 'plank', I3, plank_tex, seed))
    back.append(Prim('cyl', (x, y, 0.22), (0.34, 0.035), 'steel', I3, None, seed + 1))
    back.append(Prim('cyl', (x, y, 0.6), (0.34, 0.035), 'steel', I3, None, seed + 2))


def crate(back, x, y, seed):
    back.append(Prim('box', (x, y, 0.36), (0.38, 0.38, 0.36), 'plank', I3, plank_tex, seed))
    back.append(Prim('box', (x, y, 0.74), (0.4, 0.4, 0.03), 'wood_cut', I3, None, seed + 1))


def pond(back, x, y, r, seed):
    back.append(Prim('ell', (x, y, 0.0), (r * 1.15, r, 0.1), 'water', I3, None, seed))
    for i in range(10):
        a = i * math.tau / 10
        rr = 0.22 + 0.1 * ((i * 7) % 3)
        back.append(Prim('ell', (x + math.cos(a) * r * 1.2, y + math.sin(a) * r * 1.05, rr * 0.45), (rr, rr * 0.85, rr * 0.55), 'granite', I3, None, seed + 1 + i))
    for i, (dx, dy) in enumerate(((-0.5, 0.4), (0.7, -0.3), (0.1, -0.7))):
        back.append(Prim('cyl', (x + dx, y + dy, 0.35), (0.02, 0.35), 'reed', I3, None, seed + 20 + i))


def build():
    back, front = [], []
    # --- ground
    back.append(Prim('box', (0, 0, -0.14), (HX + 16, HY + 16, 0.14), 'grass', I3, ground_tex, 1))
    # --- fences: far edges go behind the animals, the two near edges in front
    fence_run(back, front, 'x', HY, -HX, HX, near=False)                       # far-left edge (y = +HY)
    fence_run(back, front, 'y', HX, -HY, HY, near=False)                       # far-right edge (x = +HX)
    fence_run(back, front, 'y', -HX, -HY, HY, near=True)                       # near-left edge (x = -HX)
    fence_run(back, front, 'x', -HY, -HX, HX, near=True, gap=GATE)             # near-right edge, with a gate
    # gate: two taller posts + planks
    gate_mid = (GATE[0] + GATE[1]) / 2
    for gx in GATE:
        front.append(Prim('box', (gx, -HY, 0.7), (0.14, 0.14, 0.7), 'bark', I3, None, 160))
        front.append(Prim('box', (gx, -HY, 1.45), (0.17, 0.17, 0.07), 'wood_cut', I3, None, 161))
    for z in (0.34, 0.7, 1.06):
        front.append(Prim('box', (gate_mid, -HY - 0.05, z), (GATE[1] - GATE[0] - 0.12, 0.04, 0.07), 'wood_cut', I3, None, 170))
    front.append(between('box', (GATE[0] + 0.1, -HY - 0.05, 0.3), (GATE[1] - 0.1, -HY - 0.05, 1.1), (0.04, 0.03), 'wood_cut',
                         None, (0, -1, 0), 171))
    # --- buildings: the big barn at the back, a small coop on the left
    barn(back, BARN[0], BARN[1], BARN[2])
    barn(back, COOP[0], COOP[1], COOP[2])
    # --- water: troughs, round tanks, a pond with reeds
    for i, (x, y, ax) in enumerate(TROUGHS):
        trough(back, x, y, ax, 200 + i * 4)
    for i, (x, y) in enumerate(TANKS):
        tank(back, x, y, 240 + i * 5)
    pond(back, *POND, 260)
    # --- hay, barrels, crates, a bucket
    for i, (x, y) in enumerate(HAY):
        hay_stack(back, x, y, 300 + i * 5)
    for i, (x, y) in enumerate(BARRELS):
        barrel(back, x, y, 340 + i * 3)
    for i, (x, y) in enumerate(CRATES):
        crate(back, x, y, 360 + i * 2)
    back.append(Prim('cyl', (-1.9, 2.9, 0.26), (0.2, 0.26), 'steel', I3, None, 40))
    back.append(Prim('ell', (-1.9, 2.9, 0.5), (0.18, 0.18, 0.04), 'water', I3, None, 41))
    # --- scenery scattered over the meadow (seeded, so the art is the same on every build)
    rnd = random.Random(7)
    taken = [(BARN[0], BARN[1], 3.2), (COOP[0], COOP[1], 2.2), (POND[0], POND[1], 3.0)] + [(x, y, 1.6) for x, y, _ in TROUGHS] \
        + [(x, y, 1.6) for x, y in TANKS + HAY + BARRELS + CRATES]

    def free(x, y, pad=0.0):
        return all(math.hypot(x - tx, y - ty) > tr + pad for tx, ty, tr in taken)

    def scatter(n, lo=-16.6, hi=16.6, pad=0.0):
        out = []
        for _ in range(400):
            x, y = rnd.uniform(lo, hi), rnd.uniform(lo, hi)
            if free(x, y, pad):
                out.append((x, y))
                if len(out) == n:
                    break
        return out

    for i, (x, y) in enumerate(scatter(22, pad=0.4)):                          # stones
        r = rnd.uniform(0.22, 0.42)
        back.append(Prim('ell', (x, y, r * 0.5), (r, r * 0.85, r * 0.6), 'granite', I3, None, 400 + i))
    edge = []                                                                  # bushes hug the fences
    for i in range(24):
        t = rnd.uniform(-16.0, 16.0)
        side = i % 4
        pos = (t, HY - 0.9) if side == 0 else (HX - 0.9, t) if side == 1 else (-HX + 0.9, t) if side == 2 else (t, -HY + 0.9)
        if free(*pos) and not (side == 3 and GATE[0] - 1.5 < t < GATE[1] + 1.5):
            edge.append(pos)
    for i, (x, y) in enumerate(edge):
        r = rnd.uniform(0.5, 0.75)
        back.append(Prim('ell', (x, y, r * 0.8), (r, r, r * 0.85), 'pine', I3, None, 420 + i))
    for i, (x, y) in enumerate(scatter(90, pad=0.2)):                          # flowers
        col = ('blossom', 'wheat', 'blossom', 'cream')[i % 4]
        back.append(Prim('ell', (x, y, 0.2), (0.07, 0.07, 0.1), col, I3, None, 500 + i))
        back.append(Prim('cyl', (x, y, 0.08), (0.02, 0.1), 'reed', I3, None, 560 + i))
    # the meadow outside the fence: conifers, bushes, stones and flowers
    def apron(n, lo=HX + 1.2, hi=HX + 13.0):
        out = []
        for _ in range(600):
            x, y = rnd.uniform(-hi, hi), rnd.uniform(-hi, hi)
            if max(abs(x), abs(y)) >= lo and not (abs(x) < HX + 0.8 and abs(y) < HY + 0.8):
                out.append((x, y))
                if len(out) == n:
                    break
        return out

    for i, (x, y) in enumerate(apron(26)):
        if i % 3 == 0:
            back.append(Prim('cyl', (x, y, 0.45), (0.12, 0.45), 'bark', I3, None, 600 + i))
            back.append(Prim('cone', (x, y, 1.9), (0.95, 1.4), 'pine', I3, None, 640 + i))
        else:
            r = rnd.uniform(0.5, 0.85)
            back.append(Prim('ell', (x, y, r * 0.8), (r, r, r * 0.85), 'pine', I3, None, 680 + i))
    for i, (x, y) in enumerate(apron(14)):
        r = rnd.uniform(0.25, 0.5)
        back.append(Prim('ell', (x, y, r * 0.5), (r, r * 0.85, r * 0.6), 'granite', I3, None, 720 + i))
    for i, (x, y) in enumerate(apron(60)):
        col = ('blossom', 'wheat', 'blossom', 'cream')[i % 4]
        back.append(Prim('ell', (x, y, 0.2), (0.07, 0.07, 0.1), col, I3, None, 760 + i))
        back.append(Prim('cyl', (x, y, 0.08), (0.02, 0.1), 'reed', I3, None, 840 + i))
    # signpost by the gate (front)
    front.append(Prim('cyl', (GATE[1] + 0.3, -HY - 0.5, 0.65), (0.06, 0.65), 'bark', I3, None, 90))
    front.append(Prim('box', (GATE[1] + 0.3, -HY - 0.5, 1.2), (0.38, 0.03, 0.17), 'plank', I3, plank_tex, 91))
    front.append(Prim('ell', (GATE[1] + 0.3, -HY - 0.56, 1.2), (0.1, 0.02, 0.06), 'wheat'))
    return back, front


def _scene(prims):
    sc = Scene(MATS, size=(W, H), scale=SCALE, origin=(OX, OY))
    sc.add(*prims)
    return sc


_CACHE = {}


def layers():
    if not _CACHE:
        back, front = build()
        full = _scene(back + front).render()
        only_front = _scene(front).render()
        mask = only_front.getchannel('A').point(lambda a: 255 if a else 0)
        from PIL import Image
        fr = Image.new('RGBA', full.size, (0, 0, 0, 0))
        fr.paste(full, (0, 0), mask)
        _CACHE['back'], _CACHE['front'] = full, fr
    return _CACHE


SPRITES = {
    'farm_back': lambda: layers()['back'],
    'farm_front': lambda: layers()['front'],
}
