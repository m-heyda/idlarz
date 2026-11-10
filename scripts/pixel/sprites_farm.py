"""The farm's 3D parts (isometric), drawn by the same ray-caster and camera as the animals so everything shares one light: the fence, barn, coop, troughs,
tanks, hay, barrels, crates and the pond. scripts/pixel/farm_parts.py renders each one alone into public/pixel/farm/ and the Farm window lays them out on a
repeating meadow (src/components/game/overlays/FarmProps.tsx); where they stand is src/components/game/overlays/farmGeometry.ts.

Ground -> screen:  sx = OX + (x - y) * 0.7071 * SCALE      sy = OY - 0.3536 * (x + y) * SCALE   (feet at z = 0)"""
import math
from render3d import Prim, rot, between, I3
from materials import MATS
from sprites_props import plank_tex, shingle_tex, hay_tex

SCALE = 13.0
HX, HY = 18.0, 18.0          # fenced pasture half-extents (x, y); the meadow itself runs on past the fence
GATE = (-4.0, -2.0)          # gate opening along the near-right fence (y = -HY)


BARN = (8.5, 8.5, 1.3)                 # x, y, scale (the scale of the barn model)
COOP = (-1.0, 11.0, 0.7)


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
