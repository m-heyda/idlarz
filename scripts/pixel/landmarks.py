"""Landmarks: one big cosmetic scene per biome, drawn when a 6x6 block of the same ground exists.

Ray-cast like the buildings and the rats (render3d.py): 3/4 view, hue-shifted ramps, coloured outlines, cast shadows, no baked
ground. Each scene is ~120-170px wide so it reads as the feature of a whole 288px area, with lived-in details to find around the
ground (a squirrel on the log, a husky by the fire, a frog, a goat, a crab, a duck). Purely cosmetic.
Camera: looking north and down at 50 degrees (screen up = y * 0.77 + z * 0.64), front of the scene is -y.
"""
import math
import random
from PIL import Image
from render3d import Scene, Prim, Material, rot, between, I3
from materials import MATS

LM_MATS = dict(MATS)
LM_MATS.update({
    'swamp_bark': Material(['#14110c', '#2a2418', '#453b28', '#645738', '#887a50'], '#0e0c08', grain=0.4, grain_scale=3.4),
    'old_bark': Material(['#1c130c', '#3a2616', '#5e3e22', '#85603a', '#aa8052'], '#140c06', grain=0.55, grain_scale=3.0),
    'leaf_dk': Material(['#0a2a1c', '#14482a', '#1e6a34', '#2e8c44', '#5cb860'], '#06180e', grain=0.3, grain_scale=3.6),
    'leaf_mid': Material(['#143a1a', '#24602a', '#3a8a36', '#5aae48', '#92d86a'], '#0a2410', grain=0.3, grain_scale=3.6),
    'leaf_yel': Material(['#3a4a14', '#667a1e', '#98ac2c', '#c4d44a', '#eef28a'], '#26300a', grain=0.3, grain_scale=3.6),
    'leaf_red': Material(['#4a1408', '#8a2a10', '#c4521c', '#e88a34', '#ffc868'], '#2e0c04', grain=0.3, grain_scale=3.6),
    'wisp': Material(['#5a2a9a', '#8a4ad8', '#c090ff', '#e8ccff', '#ffffff'], '#3a1a70', gain=1.35),
    'wisp_b': Material(['#0a4a6a', '#1a86b0', '#58c8e8', '#a8ecff', '#ffffff'], '#06304a', gain=1.35),
    'toad_cap': Material(['#2a0a50', '#5a1c98', '#8e3ed8', '#bb72f4', '#eed0ff'], '#1a0634', spec=0.05, shiny=16, spec_col='#ffffff'),
    'fungus_o': Material(['#4a1a06', '#8a3a0e', '#d0701c', '#f4a64a', '#ffdc96'], '#2e1004', spec=0.04, shiny=16, spec_col='#fff0c8'),
    'frog': Material(['#14401a', '#26702c', '#40a444', '#78d45c', '#c8f490'], '#0a2a10', spec=0.05, shiny=18, spec_col='#f0ffd0'),
    'sail': Material(['#7a6a50', '#b8a888', '#e0d4b0', '#f6ecd0', '#fffae8'], '#4a3c2a', grain=0.2, grain_scale=3.0),
    'crab': Material(['#4a0e0a', '#8e2418', '#d0442a', '#f0704a', '#ffb490'], '#2e0806', spec=0.04, shiny=18, spec_col='#ffe0c8'),
    'wet_sand': Material(['#5a4426', '#84683a', '#b0905a', '#d4b87c', '#f0dca4'], '#34260e', grain=0.25, grain_scale=4.0),
    'goat': Material(['#6a6258', '#a89e90', '#d8d0c0', '#f0eadc', '#ffffff'], '#3a342c', grain=0.2, grain_scale=4.0),
    'squirrel': Material(['#4a1e08', '#8a3e12', '#c4682a', '#e49a52', '#ffd090'], '#2e1004', grain=0.3, grain_scale=4.0),
    'husky': Material(['#2a2e3a', '#4c5266', '#7c849e', '#b4bccc', '#eef2f8'], '#181a24', grain=0.3, grain_scale=4.0),
    'bog_water': Material(['#0a2426', '#143e3e', '#245c54', '#3e8274', '#7ab8a4'], '#061a1a', spec=0.05, shiny=16, spec_col='#d8f4e8'),
    'algae': Material(['#2a4a10', '#4a7a1a', '#78aa2a', '#a8d44a', '#dcf68a'], '#18300a'),
    'old_stone': Material(['#3a3a42', '#6a6a72', '#9a9a9e', '#c8c6c0', '#eeeae0'], '#26262e', grain=0.35, grain_scale=3.2, gamma=1.25),
    'ice_block': Material(['#4a6aa0', '#86a8d4', '#bcd8f0', '#e2f0fc', '#ffffff'], '#2c4a80', grain=0.1, grain_scale=4.0),
    'duck': Material(['#7a6e60', '#b0a490', '#dcd2bc', '#f4efe4', '#ffffff'], '#463e30'),
    'beak_o': Material(['#7a3a08', '#b8661a', '#e49a2a', '#f8c850', '#fff0a0'], '#4a2204'),
    'crow': Material(['#06050c', '#121020', '#221e38', '#3a345c', '#6a64a0'], '#030208', spec=0.05, shiny=22, spec_col='#c8c4ff'),
    'cloth_b': Material(['#0c1c4a', '#1a3a8c', '#2c5cc4', '#4a84ee', '#9ac0ff'], '#08123a'),
})


def _P(sc, kind, c, size, mat, R=I3, seed=0, tex=None):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _scene(w, h, scale, origin):
    return Scene(LM_MATS, size=(w, h), scale=scale, origin=origin, yaw=0.0, pitch=50.0, ambient=0.3)


def _crop(img, pad=0):
    box = img.getbbox()
    return img.crop(box) if box else img


def _ring(n, r, a0=0.0):
    return [(r * math.cos(math.radians(a0 + 360.0 * i / n)), r * math.sin(math.radians(a0 + 360.0 * i / n)), a0 + 360.0 * i / n) for i in range(n)]


def _clear(x, y, avoid):
    return all((x - ax) ** 2 + ((y - ay) * 1.3) ** 2 > ar * ar for ax, ay, ar in avoid)


def _scatter(rng, n, xr, yr, avoid, fn):
    """Call fn(x, y) at n random spots inside the ellipse (xr, yr), skipping the circles in `avoid`."""
    done, tries = 0, 0
    while done < n and tries < n * 30:
        tries += 1
        x, y = rng.uniform(-xr, xr), rng.uniform(-yr, yr)
        if (x / xr) ** 2 + (y / yr) ** 2 > 1 or not _clear(x, y, avoid):
            continue
        fn(x, y)
        done += 1


def _mushroom(sc, x, y, s=1.0, cap='ruby_meat', dots=True, seed=0):
    _P(sc, 'cyl', (x, y, 0.2 * s), (0.09 * s, 0.2 * s), 'cream', I3, seed)
    _P(sc, 'ell', (x, y, 0.45 * s), (0.26 * s, 0.26 * s, 0.16 * s), cap, I3, seed + 1)
    if dots:
        for dx, dy in ((-0.1, -0.12), (0.09, -0.1), (0.0, 0.05)):
            _P(sc, 'ell', (x + dx * s, y + dy * s, 0.58 * s), (0.04 * s, 0.04 * s, 0.03 * s), 'cream', I3, seed + 2)


def _tuft(sc, x, y, s=1.0, mat='reed', seed=0):
    for k, (dx, a) in enumerate(((-0.07, -14), (0.0, 0), (0.07, 14))):
        _P(sc, 'cone', (x + dx * s, y, 0.2 * s), (0.06 * s, 0.2 * s), mat, rot(0, a, 0), seed + k)


def _flower(sc, x, y, mat='blossom', s=1.0):
    _P(sc, 'cyl', (x, y, 0.1 * s), (0.015 * s, 0.1 * s), 'reed')
    _P(sc, 'ell', (x, y, 0.22 * s), (0.07 * s, 0.07 * s, 0.05 * s), mat)


def _rock(sc, x, y, s=1.0, mat='rock', moss=False, seed=0):
    _P(sc, 'ell', (x, y, 0.18 * s), (0.34 * s, 0.26 * s, 0.2 * s), mat, I3, seed)
    _P(sc, 'ell', (x + 0.12 * s, y + 0.06 * s, 0.14 * s), (0.22 * s, 0.18 * s, 0.14 * s), mat, I3, seed + 1)
    if moss:
        _P(sc, 'ell', (x - 0.05 * s, y, 0.3 * s), (0.24 * s, 0.18 * s, 0.07 * s), 'moss', I3, seed + 2)


def _fern(sc, x, y, s=1.0, mat='leaf_mid', seed=0):
    for k in range(6):
        a = 60 * k + (seed % 7) * 9
        r = 0.28 * s
        _P(sc, 'ell', (x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a)), 0.2 * s), (0.34 * s, 0.07 * s, 0.04 * s), mat,
           rot(0, -28, a), seed + k)


def _log(sc, x, y, length=1.6, r=0.3, ang=0, mat='old_bark', seed=0, moss=True):
    _P(sc, 'cyl', (x, y, r), (r, length / 2), mat, rot(0, 90, ang), seed)
    _P(sc, 'cyl', (x + math.cos(math.radians(ang)) * length / 2, y + math.sin(math.radians(ang)) * length / 2, r), (r * 0.8, 0.03), 'wood_cut', rot(0, 90, ang))
    if moss:
        _P(sc, 'ell', (x - math.cos(math.radians(ang)) * 0.2, y - math.sin(math.radians(ang)) * 0.2, r * 1.8), (length * 0.28, r * 0.55, r * 0.35), 'moss', rot(0, 0, ang), seed + 1)


def _pebbles(sc, rng, x, y, n=4, spread=0.4, mat='granite'):
    for k in range(n):
        _P(sc, 'ell', (x + rng.uniform(-spread, spread), y + rng.uniform(-spread, spread) * 0.7, 0.07), (0.12, 0.09, 0.07), mat if k % 3 else 'rock')


def _leaves(sc, rng, x, y, mats=('leaf_red', 'leaf_yel', 'nugget'), n=5, spread=0.45):
    for k in range(n):
        _P(sc, 'ell', (x + rng.uniform(-spread, spread), y + rng.uniform(-spread, spread) * 0.7, 0.04), (0.08, 0.06, 0.025), mats[k % len(mats)],
           rot(0, 0, rng.uniform(0, 180)))


# ----------------------------------------------------------------- forest: the old oak
def ancient_oak():
    sc = _scene(210, 200, 17.0, (105, 150))
    rng = random.Random(11)
    # roots, then a twisted trunk
    for i, (x, y, a) in enumerate(_ring(8, 1.0, 15)):
        _P(sc, 'ell', (x * 1.3, y * 1.2, 0.24), (0.9, 0.26, 0.26), 'old_bark', rot(0, 0, a + (i % 3) * 6), 2 + i)
    spine = [((0.0, 0.0, 0.0), 1.25), ((0.15, 0.05, 1.3), 1.05), ((-0.1, 0.1, 2.5), 0.9), ((0.2, 0.05, 3.6), 0.75), ((0.0, 0.1, 4.6), 0.62)]
    for (p0, r0), (p1, r1) in zip(spine, spine[1:]):
        sc.add(between('cyl', p0, p1, ((r0 + r1) / 2 + 0.05,), 'old_bark', None, (0, 1, 0), 20))
    _P(sc, 'ell', (0.05, -0.8, 1.0), (0.7, 0.3, 0.85), 'timber', I3, 30)                       # hollow with a lit-up pair of eyes
    _P(sc, 'ell', (0.05, -1.0, 1.0), (0.5, 0.16, 0.66), 'dark', I3, 31)
    for s_ in (-1, 1):
        _P(sc, 'ell', (0.05 + 0.17 * s_, -1.13, 1.2), (0.05, 0.03, 0.06), 'glow')
    for i, (y0, z0, r) in enumerate(((-0.5, 2.9, 0.34), (-0.6, 3.5, 0.28))):                    # knots and a little shelf fungus
        _P(sc, 'ell', (0.4 - i * 0.9, y0 - 0.55, z0), (r, 0.14, r * 0.9), 'fungus_o', I3, 40 + i)
    limbs = [((0.1, 0.1, 4.2), (-3.0, 0.2, 6.0), 0.42), ((0.1, 0.1, 4.3), (3.2, 0.4, 6.1), 0.42), ((0.0, 0.1, 4.6), (0.4, 1.6, 7.4), 0.36),
             ((0.0, 0.0, 3.2), (-4.0, -0.3, 4.4), 0.3), ((0.1, 0.0, 3.4), (4.2, 0.3, 4.3), 0.3), ((-1.5, 0.1, 5.1), (-2.0, 1.2, 7.2), 0.2),
             ((1.6, 0.2, 5.2), (1.9, 1.0, 7.4), 0.2), ((-2.9, 0.2, 5.9), (-4.3, 0.5, 6.4), 0.16), ((3.1, 0.4, 6.0), (4.6, 0.6, 6.0), 0.16)]
    for i, (a, b, r) in enumerate(limbs):
        sc.add(between('cyl', a, b, (r,), 'old_bark', None, (0, 1, 0), 50 + i))
    tips = [(l[1], 1.0) for l in limbs] + [((-1.2, 0.2, 7.2), 1.0), ((1.4, 0.0, 7.6), 1.0), ((0.0, -0.5, 6.4), 0.9), ((-2.2, -0.6, 6.4), 0.8), ((2.4, -0.5, 6.3), 0.8),
                                           ((-3.6, -0.4, 5.2), 0.7), ((3.8, -0.2, 5.1), 0.7)]
    for ti, ((tx, ty, tz), sz) in enumerate(tips):                                                 # leaf clumps around every limb tip
        for k in range(5):
            x, y, z = tx + rng.uniform(-0.9, 0.9), ty + rng.uniform(-0.6, 0.6), tz + rng.uniform(-0.35, 0.6)
            light = z + (-x) * 0.28 - y * 0.25
            if light > 7.4:
                mat = rng.choice(('leaf_mid', 'leaf_mid', 'leaf_yel', 'leaf_mid', 'leaf_dk'))
            elif light > 6.3:
                mat = rng.choice(('leaf_mid', 'leaf_dk', 'leaf_mid', 'leaf_yel'))
            else:
                mat = rng.choice(('leaf_dk', 'leaf_dk', 'leaf_mid'))
            r = rng.uniform(0.5, 0.95) * sz
            _P(sc, 'ell', (x, y, z), (r, r * 0.9, r * 0.75), mat, I3, 100 + ti * 5 + k)
    for i in range(8):                                                                            # a few turning leaves and hanging strands
        _P(sc, 'ell', (rng.uniform(-3.6, 3.6), rng.uniform(-1.4, 0.2), rng.uniform(5.0, 7.4)), (0.17, 0.14, 0.1), 'leaf_red' if i % 2 else 'nugget', I3, 190 + i)
    for i, (x, z) in enumerate(((-3.3, 4.7), (3.5, 4.6), (-1.5, 5.4))):
        _P(sc, 'ell', (x, -0.3, z - 0.5), (0.05, 0.05, 0.5), 'moss', I3, 200 + i)
    # the forest floor
    avoid = [(0, 0, 1.6)]
    _log(sc, -2.6, -1.9, 1.9, 0.32, 14, 'old_bark', 220)                                           # mossy log, with a squirrel
    qx, qy = -3.2, -1.95
    _P(sc, 'ell', (qx, qy, 0.9), (0.2, 0.14, 0.17), 'squirrel', I3, 225)
    _P(sc, 'ell', (qx - 0.18, qy, 1.08), (0.11, 0.1, 0.1), 'squirrel', I3, 226)
    _P(sc, 'ell', (qx + 0.28, qy + 0.1, 1.15), (0.1, 0.1, 0.3), 'squirrel', rot(0, -22, 0), 227)
    _P(sc, 'ell', (qx - 0.27, qy - 0.03, 1.07), (0.025, 0.025, 0.025), 'coal')
    _P(sc, 'cyl', (2.7, -1.5, 0.3), (0.42, 0.3), 'old_bark', I3, 230)                              # a stump
    _P(sc, 'cyl', (2.7, -1.5, 0.61), (0.38, 0.02), 'wood_cut')
    _P(sc, 'ell', (2.45, -1.5, 0.5), (0.3, 0.18, 0.1), 'moss', I3, 231)
    for i, (x, y, s_) in enumerate(((-1.4, -2.4, 1.1), (1.3, -2.3, 1.0), (3.5, -0.6, 1.2), (-4.0, -0.8, 1.2), (-0.2, -2.9, 0.9))):
        _fern(sc, x, y, s_, 'leaf_mid' if i % 2 else 'leaf_dk', 240 + i * 7)
    for i, (x, y, s_, cap) in enumerate(((-1.9, -1.2, 1.0, 'ruby_meat'), (-1.65, -1.35, 0.7, 'ruby_meat'), (1.7, -1.3, 1.0, 'diamond'), (1.95, -1.15, 0.7, 'diamond'),
                                         (3.3, -2.1, 0.9, 'fungus_o'), (-3.7, -2.9, 0.8, 'ruby_meat'))):
        _mushroom(sc, x, y, s_, cap, cap == 'ruby_meat', 280 + i * 3)
    _rock(sc, 3.9, -1.4, 1.2, 'rock', True, 300)
    _rock(sc, -4.4, -1.6, 1.0, 'granite', True, 304)
    _scatter(rng, 7, 4.8, 2.9, avoid + [(-2.6, -1.9, 1.3), (2.7, -1.5, 0.7)], lambda x, y: _flower(sc, x, y, rng.choice(('cream', 'blossom', 'glow')), 1.2))
    _scatter(rng, 9, 4.9, 3.0, avoid, lambda x, y: _tuft(sc, x, y, 1.3, rng.choice(('reed', 'grass', 'moss')), 320))
    _scatter(rng, 6, 4.9, 3.0, avoid, lambda x, y: _leaves(sc, rng, x, y, n=4))
    _scatter(rng, 4, 4.9, 3.0, avoid, lambda x, y: _pebbles(sc, rng, x, y, 3, 0.25, 'rock'))
    return _crop(sc.render())


# ----------------------------------------------------------------- plains: the abandoned wagon
def _wheel(sc, x, y, r=0.78, seed=0):
    _P(sc, 'cyl', (x, y, r), (0.13, 0.1), 'bark', rot(90, 0, 0), seed)
    for k in range(6):
        a = 30 * k
        _P(sc, 'box', (x, y, r), (r * 0.9, 0.04, 0.045), 'timber', rot(0, a, 0), seed + 1 + k)
    for k in range(14):                                                                            # rim
        t = math.radians(k * 360 / 14)
        ang = math.degrees(math.atan2(-math.cos(t), -math.sin(t)))
        _P(sc, 'box', (x + r * math.cos(t), y, r + r * math.sin(t)), (0.2, 0.07, 0.06), 'old_bark', rot(0, ang, 0), seed + 10 + k)


def standing_stones():
    sc = _scene(270, 210, 21.0, (135, 142))
    rng = random.Random(23)
    # the wagon, long side to the camera, tipped on a broken wheel
    _P(sc, 'box', (0, 0.4, 1.0), (1.9, 0.85, 0.12), 'plank', rot(0, -2, 0), 1)
    for s_ in (-1, 1):
        _P(sc, 'box', (0, 0.4 + 0.85 * s_, 1.35), (1.9, 0.07, 0.35), 'plank', rot(0, -2, 0), 2 + s_)
        for k in range(5):
            _P(sc, 'box', (-1.6 + k * 0.8, 0.4 + 0.88 * s_, 1.35), (0.05, 0.05, 0.38), 'timber', I3, 6 + k + s_)
    _P(sc, 'box', (-1.95, 0.4, 1.35), (0.07, 0.85, 0.35), 'plank', I3, 12)
    _P(sc, 'ell', (0.0, 0.4, 1.7), (1.7, 0.75, 0.55), 'hay', I3, 13)                              # the hay load
    _P(sc, 'ell', (-0.5, 0.2, 2.1), (0.9, 0.6, 0.3), 'hay', I3, 14)
    for k in range(3):
        _P(sc, 'cyl', (-1.0 + k * 0.9, 0.4, 1.85), (0.025, 0.7), 'rope', rot(90, 0, 0), 15 + k)  # ropes tying it down
    sc.add(between('cyl', (1.9, 0.4, 0.95), (3.4, 0.2, 0.5), (0.09,), 'timber', None, (0, 0, 1), 20))   # the shaft
    _wheel(sc, -1.2, -0.55, 0.78, 30)
    _wheel(sc, 1.2, -0.55, 0.78, 50)
    _P(sc, 'cyl', (0.0, -0.55, 0.78), (0.05, 1.3), 'bark', rot(0, 90, 0), 70)
    # scarecrow in front of a patch of wheat, with crows
    sx, sy = 3.6, 0.9
    _P(sc, 'cyl', (sx, sy, 1.1), (0.06, 1.1), 'timber', I3, 80)
    sc.add(between('cyl', (sx - 0.8, sy, 1.75), (sx + 0.8, sy, 1.75), (0.05,), 'timber', None, (0, 0, 1), 81))
    _P(sc, 'ell', (sx, sy - 0.05, 1.45), (0.3, 0.2, 0.4), 'tunic', I3, 82)
    _P(sc, 'ell', (sx - 0.65, sy, 1.55), (0.14, 0.08, 0.25), 'tunic', I3, 83)
    _P(sc, 'ell', (sx + 0.65, sy, 1.55), (0.14, 0.08, 0.25), 'tunic', I3, 84)
    _P(sc, 'ell', (sx, sy - 0.05, 2.1), (0.22, 0.2, 0.22), 'hay', I3, 85)
    _P(sc, 'cyl', (sx, sy - 0.05, 2.28), (0.34, 0.03), 'bark')
    _P(sc, 'cone', (sx, sy - 0.05, 2.5), (0.2, 0.2), 'bark', I3, 86)
    for s_ in (-1, 1):
        _P(sc, 'ell', (sx + 0.08 * s_, sy - 0.26, 2.1), (0.03, 0.02, 0.03), 'coal')
    for i, (cx, cz, cy) in enumerate(((sx - 0.7, 1.95, sy), (sx + 0.55, 1.95, sy))):
        _P(sc, 'ell', (cx, cy, cz), (0.16, 0.1, 0.1), 'crow', I3, 90 + i)
        _P(sc, 'ell', (cx - 0.15, cy, cz + 0.08), (0.07, 0.06, 0.06), 'crow', I3, 92 + i)
        _P(sc, 'cone', (cx - 0.23, cy, cz + 0.08), (0.03, 0.06), 'beak_o', rot(0, 90, 0))
    for row in range(3):                                                                            # wheat
        for i in range(8):
            wx, wy = 2.2 + i * 0.28 + (row % 2) * 0.12, -0.2 + row * 0.5 + 0.35
            if wx > 4.6:
                continue
            _P(sc, 'ell', (wx, wy, 0.4), (0.07, 0.07, 0.4), 'wheat', I3, 100 + row * 10 + i)
            _P(sc, 'ell', (wx, wy, 0.78), (0.06, 0.06, 0.13), 'hay', I3, 140 + row * 10 + i)
    # haystacks and bales, a broken fence and a well
    for i, (hx, hy, s_) in enumerate(((-3.7, 1.2, 1.0), (-3.0, 2.1, 0.8))):
        _P(sc, 'ell', (hx, hy, 0.55 * s_), (0.85 * s_, 0.85 * s_, 0.6 * s_), 'hay', I3, 160 + i)
        _P(sc, 'cone', (hx, hy, 1.25 * s_), (0.6 * s_, 0.5 * s_), 'hay', I3, 162 + i)
    for i, (bx, by, a) in enumerate(((-2.8, -1.5, 8), (-1.8, -1.9, -6), (-2.3, -1.6, 4))):
        _P(sc, 'box', (bx, by, 0.3 + (0.35 if i == 2 else 0)), (0.5, 0.32, 0.3), 'hay', rot(0, 0, a), 170 + i)
        _P(sc, 'box', (bx - 0.14, by - 0.32, 0.3 + (0.35 if i == 2 else 0)), (0.025, 0.02, 0.3), 'rope', rot(0, 0, a))
        _P(sc, 'box', (bx + 0.14, by - 0.32, 0.3 + (0.35 if i == 2 else 0)), (0.025, 0.02, 0.3), 'rope', rot(0, 0, a))
    for i, fx in enumerate((1.8, 2.6, 3.4, 4.2, 5.0)):
        _P(sc, 'cyl', (fx, -1.6, 0.38 - (0.1 if i == 3 else 0)), (0.07, 0.38), 'old_bark', rot(0, 0, 0) if i != 3 else rot(0, 18, 0), 180 + i)
    for i, (x0, x1) in enumerate(((1.8, 2.6), (2.6, 3.4), (4.2, 5.0))):
        sc.add(between('box', (x0, -1.6, 0.55), (x1, -1.6, 0.5 - 0.1 * i), (0.04, 0.045), 'plank', None, (0, 0, 1), 190 + i))
        sc.add(between('box', (x0, -1.6, 0.28), (x1, -1.6, 0.28), (0.04, 0.045), 'plank', None, (0, 0, 1), 195 + i))
    _P(sc, 'cyl', (-0.5, -2.7, 0.35), (0.55, 0.35), 'old_stone', I3, 200)                         # an old well
    _P(sc, 'cyl', (-0.5, -2.7, 0.58), (0.4, 0.03), 'bog_water')
    for s_ in (-1, 1):
        _P(sc, 'cyl', (-0.5 + 0.5 * s_, -2.7, 1.0), (0.05, 0.7), 'timber', I3, 210)
    _P(sc, 'box', (-0.5, -2.7, 1.8), (0.7, 0.35, 0.07), 'terracotta', rot(0, 0, 0), 211)
    _P(sc, 'cyl', (-0.5, -2.7, 1.6), (0.04, 0.2), 'timber', rot(0, 90, 0))
    _P(sc, 'cyl', (0.2, -2.6, 0.2), (0.17, 0.2), 'bark', I3, 212)                                   # bucket
    # the meadow: flowers, tufts, a rabbit, stones
    avoid = [(0, 0.3, 2.4), (3.6, 0.9, 1.6), (-3.3, 1.6, 1.4), (-2.3, -1.7, 1.2), (3.4, -1.6, 1.8), (-0.5, -2.7, 1.1)]
    _scatter(rng, 14, 5.2, 3.3, avoid, lambda x, y: _flower(sc, x, y, rng.choice(('cream', 'blossom', 'glow', 'blossom')), 1.3))
    _scatter(rng, 12, 5.3, 3.3, avoid, lambda x, y: _tuft(sc, x, y, 1.5, rng.choice(('reed', 'grass')), 230))
    _scatter(rng, 4, 5.2, 3.3, avoid, lambda x, y: _pebbles(sc, rng, x, y, 4, 0.3, 'old_stone'))
    rx, ry = -4.5, -0.7
    _P(sc, 'ell', (rx, ry, 0.2), (0.24, 0.16, 0.17), 'goat', I3, 240)
    _P(sc, 'ell', (rx - 0.22, ry, 0.3), (0.11, 0.1, 0.1), 'goat', I3, 241)
    for s_ in (-1, 1):
        _P(sc, 'ell', (rx - 0.24, ry + 0.05 * s_, 0.5), (0.03, 0.03, 0.15), 'goat', rot(0, -8, 4 * s_))
    return _crop(sc.render())


# ----------------------------------------------------------------- hills: the ruined watchtower
def rock_arch():
    sc = _scene(230, 230, 17.0, (115, 175))
    rng = random.Random(31)
    mats = ['rock', 'granite', 'stone', 'rock', 'granite']
    strata = lambda p, n, pr: (None, -0.17 if ((p[2] / 0.42 + 0.3 * math.sin(p[0] * 1.3)) % 1) < 0.12 else (0.06 if ((p[2] / 0.42) % 1) > 0.85 else 0.0))
    blobs = [(0.0, 1.2, 1.3, 6.4, 2.6, 1.8, 'granite'), (-3.6, 0.5, 1.9, 2.6, 2.0, 2.0, 'rock'), (3.6, 0.7, 2.0, 2.8, 2.1, 2.1, 'granite'), (0.0, 1.3, 2.8, 4.6, 2.1, 1.7, 'rock'),
             (-1.8, 0.6, 3.4, 2.4, 1.7, 1.2, 'stone'), (2.0, 0.9, 3.5, 2.6, 1.7, 1.3, 'granite'), (0.0, 1.2, 3.9, 3.6, 1.8, 0.9, 'rock'),
             (-5.4, -0.3, 0.8, 1.5, 1.2, 1.0, 'stone'), (5.6, -0.2, 0.9, 1.5, 1.2, 1.1, 'rock'), (-2.0, -1.0, 0.9, 2.0, 1.1, 0.9, 'granite'), (2.2, -1.2, 1.0, 2.2, 1.1, 1.0, 'stone')]
    for i, (x, y, z, rx, ry, rz, m) in enumerate(blobs):
        _P(sc, 'ell', (x, y, z), (rx, ry, rz), m, rot(0, 0, rng.uniform(-8, 8)), 10 + i, strata)
    for i in range(14):                                                                              # chipped blocks and ledges on the face
        _P(sc, 'box', (rng.uniform(-5.2, 5.2), rng.uniform(-1.9, -1.1), rng.uniform(0.4, 3.4)), (rng.uniform(0.3, 0.6), 0.26, rng.uniform(0.16, 0.3)), mats[i % 5],
           rot(rng.uniform(-6, 6), 0, rng.uniform(-12, 12)), 40 + i)
    _P(sc, 'ell', (0, 1.0, 4.65), (3.3, 1.8, 0.35), 'grass', I3, 80)                                  # turf on top
    _P(sc, 'ell', (-2.0, 0.6, 4.6), (1.3, 0.9, 0.3), 'moss', I3, 81)
    # the tower: a round keep with a broken crown, windows, ivy and rubble
    tx, ty = 1.5, 1.2
    _P(sc, 'cyl', (tx, ty, 6.4), (1.1, 1.8), 'stone', I3, 90, lambda p, n, pr: (None, -0.2 if (p[2] / 0.38) % 1 < 0.1 else 0.0))
    _P(sc, 'cyl', (tx, ty, 4.8), (1.3, 0.12), 'granite', I3, 91)
    for k in range(7):
        t = math.radians(k * 360 / 7 + 20)
        hgt = 0.34 if k % 3 else 0.12
        _P(sc, 'box', (tx + 1.0 * math.cos(t), ty + 1.0 * math.sin(t), 8.5 + hgt), (0.24, 0.24, hgt + 0.04 * (k % 2)), 'stone', rot(0, 0, math.degrees(t)), 92 + k)
    for s_, zz in ((-1, 6.9), (1, 6.1)):
        _P(sc, 'box', (tx + 0.55 * s_, ty - 1.05, zz), (0.14, 0.06, 0.28), 'dark', rot(0, 0, 14 * s_), 100 + zz)
        _P(sc, 'box', (tx + 0.55 * s_, ty - 1.02, zz + 0.32), (0.18, 0.05, 0.06), 'granite', rot(0, 0, 14 * s_))
    _P(sc, 'box', (tx - 0.1, ty - 1.12, 5.3), (0.32, 0.08, 0.5), 'dark', I3, 110)                    # doorway
    _P(sc, 'box', (tx - 0.1, ty - 1.1, 5.9), (0.4, 0.06, 0.07), 'granite', I3, 111)
    for i in range(8):
        _P(sc, 'ell', (tx - 0.8 + rng.uniform(0, 1.6), ty - 1.1 + rng.uniform(-0.1, 0.1), 5.2 + rng.uniform(0, 2.6)), (0.22, 0.08, 0.2), 'moss', I3, 112 + i)
    sc.add(between('cyl', (tx - 0.9, ty - 1.15, 4.9), (tx - 0.7, ty - 1.15, 7.8), (0.05,), 'reed', None, (0, 1, 0), 125))
    for i, (x, y, z) in enumerate(((0.2, 0.2, 4.95), (3.0, 0.4, 4.95), (2.4, -0.6, 4.95), (3.4, 1.9, 4.9))):
        _P(sc, 'box', (x, y, z + 0.2), (0.32, 0.26, 0.2), 'stone', rot(0, 0, rng.uniform(0, 50)), 130 + i)
    # stairs cut into the crag, a waterfall into a pool, pines and a goat
    for k in range(6):
        _P(sc, 'box', (-4.9 + k * 0.3, -1.45, 0.12 + k * 0.3), (0.55, 0.4, 0.12), 'stone', I3, 140 + k)
    _P(sc, 'ell', (-3.0, -2.2, 0.12), (1.5, 0.8, 0.07), 'pond', I3, 150)                              # pool
    _P(sc, 'box', (-3.0, -1.75, 2.1), (0.2, 0.06, 1.5), 'crystal', I3, 151)
    _P(sc, 'box', (-2.55, -1.72, 1.6), (0.08, 0.05, 1.0), 'crystal', I3, 154)
    _P(sc, 'box', (-3.0, -1.65, 3.5), (0.12, 0.05, 0.4), 'crystal', I3, 152)
    for i in range(5):
        _P(sc, 'ell', (-3.3 + rng.uniform(0, 0.6), -1.9 + rng.uniform(-0.1, 0.1), 0.35 + rng.uniform(0, 0.15)), (0.26, 0.2, 0.18), 'snow', I3, 153 + i)
    for i, (x, y) in enumerate(((-3.8, -1.4), (-2.6, -1.1), (-3.1, -1.7))):
        _P(sc, 'ell', (x, y, 0.2), (0.28, 0.22, 0.14), ('rock', 'granite', 'stone')[i], I3, 160 + i)
    for i, (px_, py_, sz) in enumerate(((-2.4, 1.2, 1.0), (-1.2, 0.8, 0.8), (3.5, 1.6, 0.9))):
        _P(sc, 'cyl', (px_, py_, 5.3 + 0.2 * sz), (0.09, 0.3 * sz), 'bark', I3, 170 + i)
        for k, (dz, r) in enumerate(((0.55, 0.62), (1.0, 0.5), (1.4, 0.36))):
            _P(sc, 'cone', (px_, py_, 5.2 + dz * sz + 0.2), (r * sz, 0.4 * sz), 'pine', I3, 175 + i * 3 + k)
    gx, gy, gz = 0.2, -0.3, 4.75
    _P(sc, 'ell', (gx, gy, gz + 0.3), (0.36, 0.2, 0.2), 'goat', I3, 190)
    _P(sc, 'ell', (gx - 0.4, gy, gz + 0.52), (0.15, 0.12, 0.14), 'goat', I3, 191)
    _P(sc, 'ell', (gx - 0.55, gy, gz + 0.46), (0.08, 0.07, 0.06), 'goat', I3, 192)
    for s_ in (-1, 1):
        _P(sc, 'ell', (gx - 0.36, gy + 0.08 * s_, gz + 0.7), (0.03, 0.03, 0.11), 'bone', rot(0, 20, 0))
        for lx in (-0.22, 0.22):
            _P(sc, 'cyl', (gx + lx, gy + 0.09 * s_, gz + 0.1), (0.04, 0.12), 'goat')
    avoid = [(-3.3, -1.3, 1.6), (0, 1.4, 3.8)]
    for i, (x, y, s_) in enumerate(((-5.4, -2.2, 1.3), (5.2, -1.8, 1.4), (4.0, -2.6, 0.9), (-1.2, -2.4, 1.1), (1.6, -2.5, 1.0), (6.1, 0.2, 1.1))):
        _rock(sc, x, y, s_, ('rock', 'granite', 'stone')[i % 3], i % 2 == 0, 200 + i * 3)
    _scatter(rng, 8, 6.2, 3.2, avoid, lambda x, y: _tuft(sc, x, y, 1.5, rng.choice(('grass', 'reed')), 230))
    _scatter(rng, 7, 6.2, 3.2, avoid, lambda x, y: _flower(sc, x, y, rng.choice(('glow', 'blossom', 'cream')), 1.3))
    _scatter(rng, 4, 6.2, 3.2, avoid, lambda x, y: _pebbles(sc, rng, x, y, 4, 0.3, 'rock'))
    return _crop(sc.render())


# ----------------------------------------------------------------- swamp: the drowned tree
def drowned_tree():
    sc = _scene(210, 200, 17.0, (105, 148))
    rng = random.Random(41)
    for i, (x, y, rx, ry, m) in enumerate(((0, 0.2, 3.7, 2.5, 'bog_water'), (-2.0, -0.9, 1.9, 1.3, 'bog_water'), (2.2, 0.8, 1.9, 1.3, 'swamp_water'),
                                           (-2.6, 1.0, 1.2, 0.9, 'swamp_water'), (1.0, -1.5, 1.6, 0.9, 'bog_water'), (3.3, -0.6, 0.9, 0.7, 'bog_water'))):
        _P(sc, 'ell', (x, y, 0.0 + 0.004 * i), (rx, ry, 0.08), m, I3, 1 + i)                           # an irregular pool of several lobes
    for i, (x, y, rx, ry) in enumerate(((-1.3, 1.5, 0.9, 0.5), (2.4, 1.9, 0.8, 0.4), (-3.2, -0.2, 0.6, 0.4), (0.6, -2.1, 0.7, 0.4))):
        _P(sc, 'ell', (x, y, 0.1), (rx, ry, 0.07), 'algae', I3, 10 + i)                               # floating algae
    pts = [((0.0, 0.3, 0.0), 0.95), ((0.25, 0.1, 1.5), 0.78), ((-0.2, 0.2, 3.0), 0.6), ((0.3, 0.1, 4.4), 0.42)]
    for (p0, r0), (p1, r1) in zip(pts, pts[1:]):
        sc.add(between('cyl', p0, p1, ((r0 + r1) / 2,), 'swamp_bark', None, (0, 1, 0), 5))
    for i, (x, y, a) in enumerate(_ring(6, 1.0, 30)):
        _P(sc, 'ell', (x * 1.2, y * 1.0 + 0.3, 0.2), (0.8, 0.22, 0.22), 'swamp_bark', rot(0, 0, a), 20 + i)
    _P(sc, 'ell', (0.05, -0.6, 1.1), (0.34, 0.16, 0.5), 'dark', I3, 30)
    for s_ in (-1, 1):
        _P(sc, 'ell', (0.05 + 0.1 * s_, -0.74, 1.22), (0.04, 0.025, 0.05), 'wisp_b')
    branches = [((0.3, 0.1, 4.2), (-2.2, 0.0, 5.5), 0.3), ((0.3, 0.1, 4.3), (2.4, 0.4, 5.6), 0.3), ((0.2, 0.1, 4.6), (0.2, 1.2, 6.4), 0.26),
                ((-1.2, 0.0, 4.9), (-2.8, -0.2, 4.6), 0.15), ((1.4, 0.3, 5.0), (3.0, 0.5, 4.7), 0.15), ((-1.4, 0.0, 5.0), (-1.8, 0.4, 6.6), 0.14),
                ((1.5, 0.3, 5.1), (1.9, 0.2, 6.8), 0.14), ((0.0, 0.3, 3.3), (-1.7, -0.2, 3.5), 0.18), ((1.9, 0.3, 5.4), (2.8, 0.2, 6.5), 0.1)]
    for i, (a, b, r) in enumerate(branches):
        sc.add(between('cyl', a, b, (r,), 'swamp_bark', None, (0, 1, 0), 40 + i))
    ends = [(-2.2, 0.0, 5.5), (2.4, 0.4, 5.6), (-2.8, -0.2, 4.6), (3.0, 0.5, 4.7), (-1.7, -0.2, 3.5), (1.0, 0.0, 4.7), (-0.9, 0.0, 4.4), (2.8, 0.2, 6.5)]
    for i, (x, y, z) in enumerate(ends):
        for k in range(3 + i % 2):
            _P(sc, 'ell', (x + 0.16 * (k - 1), y - 0.05, z - 0.6 - 0.12 * k), (0.07, 0.07, 0.6), ('moss', 'reed', 'algae')[(i + k) % 3], I3, 60 + i * 4 + k)
    for i, (x, y, z, m) in enumerate(((0.75, -0.55, 1.9, 'toad_cap'), (-0.65, -0.5, 2.7, 'fungus_o'), (0.55, -0.4, 3.3, 'toad_cap'), (-0.4, -0.55, 1.2, 'fungus_o'))):
        _P(sc, 'ell', (x, y, z), (0.36, 0.28, 0.1), m, I3, 100 + i)
    for i, (x, y, z, m) in enumerate(((-2.0, -0.6, 3.9, 'wisp'), (1.7, -0.9, 5.2, 'wisp_b'), (0.2, -1.1, 3.1, 'wisp'), (-1.0, 0.6, 6.0, 'wisp_b'), (2.6, -0.2, 3.7, 'wisp'),
                                      (-3.1, -0.7, 2.4, 'wisp_b'), (3.4, -1.2, 2.0, 'wisp'))):
        _P(sc, 'ell', (x, y, z), (0.1, 0.1, 0.1), m, I3, 110 + i)
        _P(sc, 'ell', (x, y, z), (0.2, 0.2, 0.2), m, I3, 120 + i) if False else None
    for i, (x, y, s_, m) in enumerate(((-2.5, -1.8, 1.4, 'toad_cap'), (2.5, -1.9, 1.6, 'toad_cap'), (-1.7, -2.3, 0.9, 'fungus_o'), (1.2, -2.4, 1.0, 'ruby_meat'),
                                       (-3.6, -0.6, 1.0, 'fungus_o'), (3.9, -1.0, 0.9, 'toad_cap'))):
        _mushroom(sc, x, y, s_, m, True, 140 + i * 3)
    for i, (x, y) in enumerate(((-1.0, -1.7), (1.6, -1.0), (-2.7, 0.3), (2.9, 0.9), (-0.2, -2.1), (0.9, 1.5))):
        _P(sc, 'ell', (x, y, 0.1), (0.42, 0.34, 0.05), 'lily', I3, 170 + i)
        if i % 2 == 0:
            _P(sc, 'ell', (x, y, 0.2), (0.09, 0.09, 0.09), 'blossom' if i % 4 == 0 else 'glow')
    fx, fy = 1.6, -1.0
    _P(sc, 'ell', (fx, fy, 0.3), (0.2, 0.17, 0.14), 'frog', I3, 180)
    _P(sc, 'ell', (fx - 0.15, fy - 0.05, 0.4), (0.09, 0.09, 0.09), 'frog', I3, 181)
    for s_ in (-1, 1):
        _P(sc, 'ell', (fx - 0.2, fy - 0.06 + 0.07 * s_, 0.5), (0.04, 0.04, 0.04), 'cream')
    _P(sc, 'ell', (-2.7, 0.3, 0.3), (0.16, 0.13, 0.12), 'frog', I3, 182)                                # a second, smaller frog
    _P(sc, 'ell', (-2.82, 0.28, 0.38), (0.07, 0.07, 0.07), 'frog', I3, 183)
    _log(sc, 2.6, 1.9, 1.8, 0.26, -12, 'swamp_bark', 190)                                              # a sunken log
    sx_, sy_ = -3.5, -1.7                                                                              # a skull half in the mud
    _P(sc, 'ell', (sx_, sy_, 0.2), (0.22, 0.2, 0.19), 'bone', I3, 195)
    _P(sc, 'ell', (sx_ - 0.02, sy_ - 0.14, 0.12), (0.12, 0.1, 0.08), 'bone', I3, 196)
    for s_ in (-1, 1):
        _P(sc, 'ell', (sx_ + 0.08 * s_, sy_ - 0.17, 0.24), (0.05, 0.04, 0.055), 'dark')
    for i, (x, y) in enumerate(((-3.1, -0.8), (3.2, -0.9), (-2.9, 1.0), (3.4, 1.4), (-3.4, 0.0), (3.7, 0.2), (-1.6, 2.1), (1.9, 2.2))):
        _P(sc, 'cyl', (x, y, 0.65 + 0.1 * (i % 3)), (0.04, 0.65 + 0.1 * (i % 3)), 'reed', I3, 200 + i)
        _P(sc, 'cyl', (x, y, 1.4 + 0.2 * (i % 3)), (0.07, 0.2), 'cattail', I3, 210 + i)
    for i, (x, y) in enumerate(((-3.0, -2.5), (3.3, -2.2), (0.2, -3.0), (-1.2, -2.9))):               # marsh flowers and rocks on the bank
        _flower(sc, x, y, 'glow', 1.3)
        _flower(sc, x + 0.25, y + 0.1, 'blossom', 1.1)
    for i, (x, y) in enumerate(((-4.1, -1.2), (4.2, -1.6), (-3.9, 0.9))):
        _rock(sc, x, y, 1.0 + 0.2 * (i % 2), 'granite', True, 230 + i * 3)
    for i, (x, y, z) in enumerate(((-0.9, -0.2, 1.9), (1.3, 0.0, 2.6), (-0.4, 0.5, 3.4))):               # dragonfly-ish blue sparks
        _P(sc, 'ell', (x + 0.8, y - 0.9, z + 0.4), (0.05, 0.03, 0.03), 'wisp_b')
    return _crop(sc.render())


# ----------------------------------------------------------------- tundra: the snowed-in camp
def ice_spire():
    sc = _scene(230, 200, 17.0, (115, 150))
    rng = random.Random(53)
    _P(sc, 'ell', (0, 0.4, 0.12), (5.6, 3.2, 0.3), 'snow', I3, 1)                                      # drifts
    for i, (x, y, rx, ry) in enumerate(((-3.4, -0.8, 1.8, 1.0), (3.6, -0.4, 1.7, 1.0), (0.0, -2.4, 2.2, 0.8), (-1.0, 2.2, 1.8, 0.8))):
        _P(sc, 'ell', (x, y, 0.22), (rx, ry, 0.4), 'snow', I3, 2 + i)
    # the ice wall behind: tall faceted shards
    spires = [(-0.4, 2.7, 6.4, 1.0, -4, 6, 'crystal'), (1.2, 2.5, 5.2, 0.9, 8, -6, 'ice'), (-2.0, 2.5, 4.6, 0.85, -12, 8, 'ice'),
              (2.7, 2.3, 4.0, 0.8, 14, -4, 'crystal'), (-3.3, 2.0, 3.0, 0.65, -16, 4, 'crystal'), (3.8, 1.9, 2.8, 0.6, 18, -8, 'ice')]
    for i, (x, y, hgt, r, tx, ty, mat) in enumerate(spires):
        _P(sc, 'cone', (x, y, hgt / 2 + 0.1), (r, hgt / 2), mat, rot(tx * 0.4, ty, 0), 10 + i)
        _P(sc, 'cone', (x, y, hgt * 0.88 + 0.1), (r * 0.32, hgt * 0.12), 'snow', rot(tx * 0.4, ty, 0), 20 + i)
    # the igloo with its tunnel
    ix, iy = -0.6, 0.1
    brick = lambda p, n, pr: (None, -0.22 if ((p[2] / 0.34) % 1 < 0.11 or (((math.atan2(p[1], p[0]) / 0.4) + 0.5 * math.floor(p[2] / 0.34)) % 1) < 0.07) else 0.0)
    _P(sc, 'ell', (ix, iy, 0.1), (1.85, 1.85, 1.6), 'ice_block', I3, 30, brick)
    _P(sc, 'ell', (ix, iy - 1.4, 0.1), (0.85, 1.0, 0.8), 'ice_block', I3, 31, brick)
    _P(sc, 'ell', (ix, iy - 2.08, 0.28), (0.5, 0.2, 0.5), 'dark', I3, 32)
    _P(sc, 'ell', (ix, iy - 2.1, 0.6), (0.52, 0.2, 0.12), 'snow', I3, 33)
    _P(sc, 'cyl', (ix - 0.8, iy + 0.3, 2.2), (0.08, 0.4), 'granite', I3, 34)                           # smoke hole with a wisp
    for k in range(3):
        _P(sc, 'ell', (ix - 0.8 + 0.1 * k, iy + 0.3, 2.9 + 0.38 * k), (0.2 + 0.07 * k, 0.2 + 0.07 * k, 0.16), 'smoke', I3, 35 + k)
    # firepit, sled, drying rack and the husky
    fx_, fy_ = 2.4, -1.5
    for k, (x, y, a) in enumerate(_ring(7, 0.65, 10)):
        _P(sc, 'ell', (fx_ + x, fy_ + y, 0.14), (0.2, 0.17, 0.14), 'granite' if k % 2 else 'rock', I3, 40 + k)
    _P(sc, 'cyl', (fx_, fy_, 0.16), (0.08, 0.5), 'bark', rot(0, 90, 20), 50)
    _P(sc, 'cyl', (fx_, fy_, 0.16), (0.08, 0.5), 'bark', rot(0, 90, -40), 51)
    _P(sc, 'ell', (fx_, fy_, 0.3), (0.34, 0.3, 0.2), 'ember', I3, 52)
    _P(sc, 'cone', (fx_, fy_, 0.7), (0.26, 0.4), 'ember', I3, 53)
    _P(sc, 'cone', (fx_, fy_, 0.8), (0.14, 0.34), 'glow', I3, 54)
    for k in range(2):
        _P(sc, 'ell', (fx_ + 0.15 * k, fy_ + 0.1, 1.5 + 0.45 * k), (0.15 + 0.06 * k, 0.15 + 0.06 * k, 0.12), 'smoke', I3, 55 + k)
    sx_, sy_ = 3.9, 0.3                                                                                # a loaded sled
    for s_ in (-1, 1):
        _P(sc, 'box', (sx_, sy_ + 0.4 * s_, 0.14), (1.1, 0.05, 0.08), 'timber', rot(0, 0, 8), 60 + s_)
    _P(sc, 'box', (sx_, sy_, 0.3), (1.0, 0.45, 0.05), 'plank', rot(0, 0, 8), 63)
    _P(sc, 'ell', (sx_ - 0.1, sy_, 0.6), (0.6, 0.38, 0.3), 'leather', rot(0, 0, 8), 64)
    _P(sc, 'ell', (sx_ + 0.5, sy_, 0.55), (0.3, 0.3, 0.2), 'cloth_b', I3, 65)
    for k in range(3):
        _P(sc, 'cyl', (sx_ - 0.4 + 0.4 * k, sy_, 0.75), (0.02, 0.5), 'rope', rot(90, 0, 0))
    px_, py_ = -3.6, -1.8                                                                              # fish drying rack
    for s_ in (-1, 1):
        _P(sc, 'cyl', (px_ + 0.8 * s_, py_, 0.8), (0.06, 0.8), 'bark', I3, 70)
    sc.add(between('cyl', (px_ - 0.9, py_, 1.55), (px_ + 0.9, py_, 1.55), (0.05,), 'bark', None, (0, 0, 1), 71))
    for k in range(4):
        _P(sc, 'ell', (px_ - 0.6 + 0.4 * k, py_ - 0.08, 1.1), (0.1, 0.05, 0.38), 'fish_blue', I3, 72 + k)
        _P(sc, 'ell', (px_ - 0.6 + 0.4 * k, py_ - 0.1, 1.05), (0.07, 0.04, 0.26), 'fish_belly', I3, 76 + k)
    hx, hy = 1.0, -2.2                                                                                 # a husky curled up
    _P(sc, 'ell', (hx, hy, 0.28), (0.42, 0.3, 0.26), 'husky', I3, 80)
    _P(sc, 'ell', (hx - 0.4, hy - 0.05, 0.22), (0.2, 0.17, 0.16), 'husky', I3, 81)
    _P(sc, 'ell', (hx - 0.55, hy - 0.2, 0.2), (0.1, 0.07, 0.07), 'snow', I3, 82)
    _P(sc, 'ell', (hx + 0.35, hy + 0.2, 0.22), (0.28, 0.1, 0.1), 'husky', rot(0, 0, 40), 83)
    for s_ in (-1, 1):
        _P(sc, 'cone', (hx - 0.36, hy + 0.1 * s_ - 0.02, 0.46), (0.05, 0.1), 'husky', I3, 84)
    # snowy pines, a frozen pond with a fishing hole, ice shards and rocks
    for i, (x, y, s_) in enumerate(((-4.6, 1.0, 1.1), (4.8, 0.8, 1.2), (-4.2, 2.2, 0.9))):
        _P(sc, 'cyl', (x, y, 0.4 * s_), (0.14 * s_, 0.4 * s_), 'bark', I3, 90 + i)
        for k, (dz, r) in enumerate(((0.9, 0.85), (1.5, 0.68), (2.05, 0.5), (2.5, 0.32))):
            _P(sc, 'cone', (x, y, dz * s_ + 0.3), (r * s_, 0.45 * s_), 'pine', I3, 95 + i * 4 + k)
            _P(sc, 'cone', (x, y, dz * s_ + 0.4), (r * 0.82 * s_, 0.32 * s_), 'snow', I3, 110 + i * 4 + k)
    _P(sc, 'ell', (-1.2, -2.5, 0.07), (1.7, 0.8, 0.06), 'ice', I3, 130)
    _P(sc, 'ell', (-1.2, -2.5, 0.12), (0.22, 0.12, 0.04), 'dark', I3, 131)
    _P(sc, 'cyl', (-0.75, -2.45, 0.35), (0.02, 0.4), 'bark', rot(0, 22, 0), 132)
    _P(sc, 'box', (-1.0, -2.6, 0.1), (0.8, 0.012, 0.01), 'snow', rot(0, 0, 14))
    for i, (x, y, s_) in enumerate(((-4.2, -0.6, 0.9), (4.4, -1.5, 0.8), (5.4, 0.0, 0.7))):
        _P(sc, 'cone', (x, y, 0.5 * s_), (0.22 * s_, 0.55 * s_), 'crystal', rot(0, 9 * (i - 1), 0), 135 + i)
    for i, (x, y) in enumerate(((-2.4, -1.9), (3.2, -2.5), (5.0, -0.9), (-5.2, -0.2))):
        _P(sc, 'ell', (x, y, 0.22), (0.46, 0.34, 0.26), 'granite', I3, 140 + i)
        _P(sc, 'ell', (x, y, 0.4), (0.34, 0.24, 0.14), 'snow', I3, 144 + i)
    for i in range(8):                                                                                  # footprints and ice flecks in the snow
        _P(sc, 'ell', (-1.0 + 0.5 * i, -1.1 - 0.1 * (i % 2) * 3 - 0.2 * i * 0.2, 0.05), (0.09, 0.06, 0.02), 'ice_block', I3, 150 + i)
    for i in range(10):
        x, y = rng.uniform(-5, 5), rng.uniform(-3, 2.6)
        if _clear(x, y, [(-0.6, 0.1, 2.2), (2.4, -1.5, 1.0), (-1.2, -2.5, 1.8), (3.9, 0.3, 1.5)]):
            _P(sc, 'cone', (x, y, 0.16), (0.07, 0.17), 'crystal', I3, 170 + i)
    return _crop(sc.render())


# ----------------------------------------------------------------- lake: the willow islet
def willow_islet():
    sc = _scene(190, 150, 17.0, (95, 108))
    _P(sc, 'ell', (0, 0, 0.0), (4.1, 3.0, 0.06), 'pond', I3, 1)                                   # ripple ring around the islet
    _P(sc, 'ell', (0, 0, 0.1), (3.6, 2.6, 0.1), 'snow', I3, 2)
    _P(sc, 'ell', (0, 0, 0.3), (3.3, 2.4, 0.4), 'soil', I3, 3)
    _P(sc, 'ell', (0, 0, 0.62), (3.1, 2.2, 0.28), 'grass', I3, 4)
    for i, (x, y, r) in enumerate(((-2.8, -1.0, 0.5), (-2.4, 1.0, 0.4), (2.9, 0.4, 0.45), (2.3, -1.4, 0.4), (0.6, -2.3, 0.35))):
        _P(sc, 'ell', (x, y, 0.35), (r, r * 0.8, r * 0.6), ('rock', 'granite')[i % 2], I3, 10 + i)
    pts = [((0.3, 0.2, 0.5), 0.55), ((0.0, 0.1, 1.6), 0.45), ((-0.3, 0.2, 2.6), 0.36), ((0.1, 0.2, 3.5), 0.3)]
    for (p0, r0), (p1, r1) in zip(pts, pts[1:]):
        sc.add(between('cyl', p0, p1, ((r0 + r1) / 2,), 'bark', None, (0, 1, 0), 20))
    for i, (b, r) in enumerate((((-1.4, 0.2, 4.6), 0.2), ((1.5, 0.2, 4.5), 0.2), ((0.1, 1.2, 4.7), 0.2))):
        sc.add(between('cyl', (0.1, 0.2, 3.4), b, (r,), 'bark', None, (0, 1, 0), 24 + i))
    for i, (x, y, z, rx, ry, rz) in enumerate(((0, 0.3, 4.9, 1.9, 1.5, 0.9), (-1.4, 0.2, 4.6, 1.2, 1.1, 0.7), (1.4, 0.3, 4.6, 1.2, 1.1, 0.7), (0, -0.3, 5.5, 1.3, 1.1, 0.7))):
        _P(sc, 'ell', (x, y, z), (rx, ry, rz), ('leaf_dk', 'leaf_mid', 'leaf_dk', 'leaf_mid')[i], I3, 30 + i)
    for i, (x, y, a) in enumerate(_ring(30, 2.1, 6)):                                             # drooping fronds around the crown, outer ring
        L = 1.0 + 0.35 * ((i * 7) % 4)
        mat = ('leaf_mid', 'leaf_dk', 'leaf_mid', 'leaf_yel', 'leaf_dk')[i % 5]
        lean = (x / 2.1) * 9
        _P(sc, 'ell', (x * 1.02, y * 0.85 + 0.2, 4.2 - L * 0.45), (0.14, 0.14, L * 0.6), mat, rot(0, lean, 0), 40 + i)
    for i, (x, y, a) in enumerate(_ring(20, 1.5, 3)):
        L = 0.9 + 0.3 * ((i * 5) % 3)
        _P(sc, 'ell', (x, y * 0.85 + 0.1, 4.0 - L * 0.4), (0.13, 0.13, L * 0.6), ('leaf_dk', 'leaf_mid', 'leaf_dk')[i % 3], I3, 80 + i)
    # the dock, a rowboat and a duck
    for k in range(6):
        _P(sc, 'box', (-2.6 - k * 0.28, -1.9 - k * 0.04, 0.3), (0.14, 0.62, 0.05), 'timber', I3, 120 + k)
    for x in (-2.7, -4.1):
        for y in (-2.5, -1.35):
            _P(sc, 'cyl', (x, y, 0.2), (0.07, 0.3), 'bark')
    _P(sc, 'ell', (-4.2, -2.9, 0.12), (0.9, 0.42, 0.2), 'plank', rot(0, 0, 18), 90)
    _P(sc, 'ell', (-4.2, -2.9, 0.2), (0.72, 0.3, 0.14), 'timber', rot(0, 0, 18), 91)
    _P(sc, 'cyl', (-3.2, -2.1, 0.2), (0.02, 0.4), 'rope', rot(60, 0, 0))
    dx, dy = 3.4, -2.1                                                                            # a duck on the water
    _P(sc, 'ell', (dx, dy, 0.2), (0.26, 0.17, 0.15), 'duck', I3, 100)
    _P(sc, 'ell', (dx + 0.22, dy, 0.42), (0.1, 0.1, 0.1), 'duck', I3, 101)
    _P(sc, 'ell', (dx + 0.34, dy, 0.4), (0.07, 0.04, 0.03), 'beak_o')
    for i, (x, y, f) in enumerate(((-1.5, -3.0, 1), (1.2, -3.1, 0), (-4.4, 0.3, 0), (4.2, 1.3, 1), (3.0, -3.0, 0))):
        _P(sc, 'ell', (x, y, 0.06), (0.42, 0.34, 0.04), 'lily', I3, 110 + i)
        if f:
            _P(sc, 'ell', (x, y, 0.16), (0.08, 0.08, 0.08), 'blossom')
    rng = random.Random(71)
    for i, (x, y) in enumerate(((-2.3, -1.6), (2.4, -1.5), (-0.6, -2.2), (2.8, 0.6), (-2.9, 0.3), (1.6, 1.9), (-1.4, 1.6))):
        _P(sc, 'cyl', (x, y, 0.95), (0.04, 0.55 + 0.1 * (i % 3)), 'reed', I3, 300 + i)
        _P(sc, 'cyl', (x, y, 1.7 + 0.1 * (i % 3)), (0.07, 0.18), 'cattail', I3, 310 + i)
    for i in range(10):
        x, y = rng.uniform(-2.9, 2.9), rng.uniform(-1.9, 1.9)
        if (x / 2.9) ** 2 + (y / 1.9) ** 2 < 1 and x * x + y * y > 1.0:
            _flower(sc, x, y + 0.2, ('cream', 'blossom', 'glow')[i % 3], 1.5)
            _tuft(sc, x + 0.3, y, 1.4, 'grass', 320)
    for i in range(6):
        _pebbles(sc, rng, rng.uniform(-3.0, 3.0), rng.uniform(-2.0, -1.6), 3, 0.2, 'rock')
    _P(sc, 'box', (1.6, -1.2, 0.8), (0.28, 0.2, 0.2), 'plank', rot(0, 0, 20), 330)               # a fisherman's crate and rod
    sc.add(between('cyl', (1.5, -1.2, 1.0), (2.9, -2.4, 1.9), (0.02,), 'bark', None, (0, 0, 1), 331))
    return _crop(sc.render())


# ----------------------------------------------------------------- coast: the wreck
def shipwreck():
    sc = _scene(190, 170, 17.0, (95, 120))
    _P(sc, 'ell', (0, 0.3, 0.1), (4.4, 2.2, 0.4), 'sand', I3, 1)                                 # sand drifted over the hull
    _P(sc, 'ell', (-1.0, -1.5, 0.1), (3.0, 1.2, 0.2), 'wet_sand', I3, 2)

    def half(x):                                                                                  # hull half-breadth along the keel
        return 1.0 + 0.55 * math.cos(x / 3.3 * math.pi / 2) ** 0.8

    xs = [-3.2 + k * 0.7 for k in range(10)]
    lean = 0.0

    def hp(x, phi):
        r = half(x) * 1.15
        return (x, r * math.sin(math.radians(phi)) * 1.2 + 0.2, 2.3 - r * math.cos(math.radians(phi)) * 1.5 + 0.8 * (abs(x) / 3.3) ** 2)
    phis = [-80, -60, -40, -20, 0, 20, 40, 60, 80]
    for i, x in enumerate(xs):
        pts = [hp(x, p) for p in phis]
        for a, b in zip(pts, pts[1:]):
            sc.add(between('cyl', a, b, (0.09,), 'timber', None, (0, 1, 0), 3 + i))              # ribs
    for i, (x0, x1) in enumerate(zip(xs, xs[1:])):                                                # planking, the stern half is still covered
        if x0 < 2.2:
            for p in (-70, -50, -30, -10, 10, 30, 50, 70):
                a, b = hp(x0, p), hp(x1, p)
                sc.add(between('box', a, b, (0.14, 0.045), 'plank', None, (0, 0, 1), 40 + i * 8 + (p + 70) // 20))
    for i, (x0, x1) in enumerate(zip(xs, xs[1:])):                                                # keel and gunwale beams
        sc.add(between('cyl', hp(x0, 0), hp(x1, 0), (0.12,), 'swamp_bark', None, (0, 1, 0), 120 + i))
        sc.add(between('cyl', hp(x0, -80), hp(x1, -80), (0.1,), 'timber', None, (0, 1, 0), 130 + i))
        sc.add(between('cyl', hp(x0, 80), hp(x1, 80), (0.1,), 'timber', None, (0, 1, 0), 140 + i))
    sc.add(between('cyl', (3.4, 0.2, 1.0), (4.1, 0.2, 3.3), (0.17,), 'timber', None, (0, 1, 0), 150))     # prow post
    sc.add(between('cyl', (-3.5, 0.2, 1.3), (-3.9, 0.2, 2.6), (0.15,), 'timber', None, (0, 1, 0), 151))   # stern post
    sc.add(between('cyl', (-0.4, 0.2, 0.9), (0.5, 0.2, 6.6), (0.22,), 'timber', None, (0, 1, 0), 152))     # broken mast
    sc.add(between('box', (-2.0, 0.0, 5.6), (2.3, 0.0, 6.0), (0.1, 0.1), 'timber', None, (0, 1, 0), 153))  # yard
    for i, (x, z, w, hh) in enumerate(((-1.0, 4.6, 0.9, 0.9), (0.6, 4.7, 0.8, 0.8), (-0.2, 3.5, 0.7, 0.55), (1.5, 4.4, 0.45, 0.6), (-1.9, 4.3, 0.4, 0.7))):   # torn sail
        _P(sc, 'box', (x, -0.12 - i * 0.03, z), (w, 0.04, hh), 'sail', rot(0, 3 * (i - 2), 3 * i), 154 + i)
    sc.add(between('cyl', (0.5, 0.2, 6.6), (2.1, 0.0, 6.0), (0.03,), 'rope', None, (0, 1, 0), 160))
    _P(sc, 'box', (1.2, -0.05, 6.8), (0.35, 0.02, 0.22), 'flag', rot(0, 0, 8), 161)
    _P(sc, 'box', (0.6, 0.2, 0.75), (0.5, 0.35, 0.3), 'plank', I3, 162)                           # treasure chest with spilled gold
    _P(sc, 'box', (0.6, 0.2, 1.1), (0.52, 0.37, 0.07), 'timber', rot(18, 0, 0), 163)
    _P(sc, 'ell', (0.6, -0.3, 0.4), (0.4, 0.18, 0.12), 'nugget', I3, 164)
    for i, (x, y) in enumerate(((0.3, -0.45), (0.7, -0.5), (0.95, -0.35), (0.1, -0.3))):
        _P(sc, 'ell', (x, y, 0.55 + 0.05 * (i % 2)), (0.09, 0.09, 0.04), 'gold', I3, 165 + i)
    _P(sc, 'cyl', (-1.8, 0.4, 0.55), (0.3, 0.4), 'bark', I3, 170)                                 # barrels
    _P(sc, 'cyl', (-2.4, 0.5, 0.45), (0.27, 0.35), 'bark', rot(0, 90, 20), 171)
    cx, cy = 2.4, -2.3                                                                            # a crab
    _P(sc, 'ell', (cx, cy, 0.16), (0.24, 0.17, 0.12), 'crab', I3, 180)
    for s in (-1, 1):
        _P(sc, 'ell', (cx + 0.3 * s, cy - 0.15, 0.22), (0.1, 0.07, 0.07), 'crab', I3, 181)
        _P(sc, 'ell', (cx + 0.1 * s, cy - 0.12, 0.3), (0.025, 0.025, 0.03), 'cream')
        for k in range(3):
            _P(sc, 'cyl', (cx + 0.26 * s, cy + 0.02 + 0.07 * k, 0.07), (0.015, 0.08), 'crab', rot(0, 50 * s, 0))
    for i, (x, y, a) in enumerate(((-3.2, -1.9, 10), (3.9, -1.6, 40))):                           # starfish
        for k in range(5):
            _P(sc, 'ell', (x + 0.2 * math.cos(math.radians(a + 72 * k)), y + 0.2 * math.sin(math.radians(a + 72 * k)), 0.05), (0.14, 0.05, 0.04), 'terracotta', rot(0, 0, a + 72 * k), 190 + i * 5 + k)
    for i, (x, y) in enumerate(((-3.6, -0.9), (3.4, -2.3), (-0.2, -2.5), (4.2, 0.5))):
        _P(sc, 'ell', (x, y, 0.12), (0.18, 0.14, 0.09), 'cream', I3, 210 + i)
    for i, (x, y) in enumerate(((-3.0, 1.4), (3.3, 1.2))):                                        # beach grass
        _tuft(sc, x, y, 1.6, 'reed')
    rng = random.Random(81)
    av = [(0, 0.3, 3.8), (2.4, -2.3, 0.6)]
    for i, (x, y, a) in enumerate(((-4.4, -1.2, 8), (4.5, -0.6, -20), (-1.0, -2.8, 4))):                 # driftwood
        _log(sc, x, y, 1.7, 0.16, a, 'wet_sand' if False else 'plank', 340 + i, False)
    for i in range(7):                                                                                   # seaweed on the wet sand
        x, y = rng.uniform(-4.5, 4.5), rng.uniform(-3.2, -2.3)
        for k in range(3):
            _P(sc, 'ell', (x + 0.1 * k, y, 0.1), (0.2, 0.05, 0.04), 'algae' if k % 2 else 'reed', rot(0, 0, rng.uniform(0, 180)), 360 + i * 3 + k)
    _P(sc, 'ell', (-3.3, -2.6, 0.05), (0.9, 0.5, 0.05), 'pond', I3, 400)                                 # a tide pool with a shell and a rock
    _P(sc, 'ell', (-3.1, -2.55, 0.1), (0.2, 0.15, 0.1), 'rock', I3, 401)
    _P(sc, 'ell', (-3.6, -2.7, 0.12), (0.1, 0.08, 0.06), 'cream', I3, 402)
    for i, (x, y, s_) in enumerate(((-4.6, -0.3, 1.3), (4.9, 0.9, 1.1), (-3.8, 1.6, 1.0), (4.0, -2.4, 0.9))):
        _rock(sc, x, y, s_, ('rock', 'granite', 'stone')[i % 3], False, 410 + i * 3)
    for i in range(9):
        x, y = rng.uniform(-5, 5), rng.uniform(-3.3, 2.0)
        if _clear(x, y, av):
            _P(sc, 'ell', (x, y, 0.07), (0.14, 0.11, 0.07), ('cream', 'crab', 'terracotta')[i % 3], rot(0, 0, rng.uniform(0, 180)), 440 + i)
    px_, py_ = 4.2, 1.7                                                                                  # a little palm
    pts = [(px_, py_, 0.0), (px_ + 0.15, py_, 1.2), (px_ + 0.5, py_ + 0.05, 2.3), (px_ + 1.0, py_, 3.2)]
    for a, b in zip(pts, pts[1:]):
        sc.add(between('cyl', a, b, (0.14,), 'plank', None, (0, 1, 0), 460))
    for k in range(7):
        ang = k * 51 + 10
        ex, ey = px_ + 1.0 + 1.1 * math.cos(math.radians(ang)), py_ + 0.7 * math.sin(math.radians(ang))
        sc.add(between('box', (px_ + 1.0, py_, 3.3), (ex, ey, 3.0 - 0.1 * (k % 2)), (0.38, 0.03), ('leaf_mid', 'leaf_dk')[k % 2], None, (0, 0, 1), 470 + k))
    for i in range(2):
        _P(sc, 'ell', (px_ + 0.95 + 0.15 * i, py_ - 0.1, 3.05), (0.1, 0.1, 0.1), 'bark', I3, 480 + i)
    for x, y in ((-3.0, 1.4), (3.3, 1.2), (-4.3, 0.6)):
        _tuft(sc, x, y, 1.6, 'reed')
    return _crop(sc.render())


LANDMARKS = [
    ('lm_forest', ancient_oak, 'forest'),
    ('lm_plains', standing_stones, 'plains'),
    ('lm_hills', rock_arch, 'hills'),
    ('lm_swamp', drowned_tree, 'swamp'),
    ('lm_tundra', ice_spire, 'tundra'),
    ('lm_lake', willow_islet, 'lake'),
    ('lm_coast', shipwreck, 'coast'),
]
