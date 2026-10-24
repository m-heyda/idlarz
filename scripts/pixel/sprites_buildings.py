"""Town buildings (16; 48x60, transparent, anchored at the tile bottom): little 3/4-view scenes in the reference style -
terracotta / blue / slate roofs, whitewash and timber walls, props that show the trade, a tree or two at the edges.
The ground under them is NOT drawn here: the terrain layer gives the tile a biome-styled foundation (see terrain_pads.py).
Camera: looking north and down at 48 degrees, so the south facade and the roof both read. Keep silhouettes chunky: at 48px
a building is ~30px wide, props are few and big."""
import math
from render3d import Scene, Prim, rot, between, I3
from materials import MATS
import fx

W, H = 48, 60


# ----------------------------------------------------------------- textures and small helpers
def _shingles(row=0.34, col=0.5, depth=0.2):
    """Staggered shingle courses on a roof slab (slab-local x runs along the ridge, y up the slope)."""
    def t(p, n, prim):
        if abs(n[2]) < 0.5:
            return None, 0.0
        ri = math.floor(p[1] / row)
        fy = p[1] / row - ri
        fxx = ((p[0] + 0.5 * col * (ri % 2)) / col) % 1
        if fy < 0.16:
            return None, -depth
        if fxx < 0.07:
            return None, -depth * 0.7
        return None, (0.05 if fy > 0.82 else 0.0)
    return t


def _planks(col=0.3, depth=0.16):
    """Wooden boards seen from above, running along y."""
    def t(p, n, prim):
        if abs(n[2]) < 0.5:
            return None, 0.0
        return None, (-depth if ((p[0] / col) % 1) < 0.12 else 0.0)
    return t


def _fence(sc, x0, x1, y, n):
    for i in range(n):
        _P(sc, 'cyl', (x0 + (x1 - x0) * i / (n - 1), y, 0.28), (0.07, 0.28), 'bark', I3, i)
    _P(sc, 'box', ((x0 + x1) / 2, y, 0.42), ((x1 - x0) / 2, 0.04, 0.05), 'plank')
    _P(sc, 'box', ((x0 + x1) / 2, y, 0.2), ((x1 - x0) / 2, 0.04, 0.05), 'plank')


def _scene(scale=9.2, origin=(24, 43)):
    return Scene(MATS, size=(W, H), scale=scale, origin=origin, yaw=0.0, pitch=48.0)


def _P(sc, kind, c, size, mat, R=I3, seed=0, tex=None):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _roof(sc, cx, cy, hx, hy, base_z, rise, mat, ridge='cream', seed=0, tex=None, gable=None):
    """Gable roof, ridge along x: two sloped slabs, a ridge beam and (optionally) a gable-end wall colour."""
    ang = math.degrees(math.atan2(rise, hy))
    half = math.hypot(hy, rise) / 2
    tex = tex or _shingles()
    for s in (-1, 1):
        _P(sc, 'box', (cx, cy + s * hy / 2, base_z + rise / 2), (hx, half, 0.07), mat, rot(-s * ang, 0, 0), seed + s, tex)
    _P(sc, 'box', (cx, cy, base_z + rise + 0.04), (hx + 0.05, 0.08, 0.08), ridge)


def _tree(sc, x, y, s=1.0, seed=0, mat='pine'):
    _P(sc, 'cyl', (x, y, 0.3 * s), (0.11 * s, 0.3 * s), 'bark', I3, seed)
    for k, (dz, r) in enumerate(((0.75, 0.55), (1.2, 0.45), (1.6, 0.32))):
        _P(sc, 'cone', (x, y, dz * s), (r * s * 1.15, 0.38 * s), mat, I3, seed + k)


def _oak(sc, x, y, s=1.0, seed=0):
    _P(sc, 'cyl', (x, y, 0.3 * s), (0.12 * s, 0.3 * s), 'bark', I3, seed)
    _P(sc, 'ell', (x, y, 1.0 * s), (0.6 * s, 0.55 * s, 0.52 * s), 'moss', I3, seed + 1)
    _P(sc, 'ell', (x - 0.2 * s, y - 0.15 * s, 1.25 * s), (0.36 * s, 0.32 * s, 0.3 * s), 'grass', I3, seed + 2)


def _window(sc, x, y, z, w=0.16, h=0.2):
    _P(sc, 'box', (x, y, z), (w + 0.05, 0.04, h + 0.05), 'timber')
    _P(sc, 'box', (x, y - 0.02, z), (w, 0.03, h), 'glass')


def _door(sc, x, y, w=0.28, h=0.5):
    _P(sc, 'box', (x, y, h), (w + 0.06, 0.04, h + 0.04), 'bark')
    _P(sc, 'box', (x, y - 0.02, h), (w, 0.035, h), 'door', I3, 0, _planks(0.2, 0.2))


def _barrel(sc, x, y, r=0.26, h=0.3):
    _P(sc, 'cyl', (x, y, h), (r, h), 'bark', I3, 3)
    _P(sc, 'cyl', (x, y, h * 2 - 0.02), (r * 0.86, 0.03), 'wood_cut')


def _crate(sc, x, y, s=0.3):
    _P(sc, 'box', (x, y, s), (s, s, s), 'plank', I3, 2, _planks(0.2, 0.12))


# ----------------------------------------------------------------- farm: cottage, windmill, wheat, fence
def farm():
    sc = _scene()
    _P(sc, 'box', (-0.85, 0.6, 0.8), (1.25, 0.8, 0.8), 'whitewash', I3, 1)
    _P(sc, 'box', (-0.85, 0.6, 0.05), (1.3, 0.85, 0.06), 'cobble', I3, 2)
    _roof(sc, -0.85, 0.6, 1.5, 1.05, 1.6, 0.95, 'terracotta', 'cream', 3, _shingles(0.34, 0.42, 0.34))
    _door(sc, -0.55, -0.22)
    _window(sc, -1.6, -0.22, 0.95)
    _window(sc, 0.05, -0.22, 0.95)
    _P(sc, 'box', (-0.1, 0.95, 2.7), (0.17, 0.17, 0.4), 'granite', I3, 4)
    _P(sc, 'ell', (-0.05, 1.0, 3.35), (0.22, 0.2, 0.18), 'smoke', I3, 5)
    # windmill behind-right
    _P(sc, 'cone', (1.7, 1.4, 1.1), (0.6, 1.1), 'whitewash', I3, 6)
    _P(sc, 'cone', (1.7, 1.4, 2.5), (0.66, 0.4), 'terracotta', I3, 7)
    cx, cz = 1.7, 2.0
    for ang in (40, 130):
        a = math.radians(ang)
        sc.add(between('box', (cx - math.cos(a) * 1.25, 0.62, cz - math.sin(a) * 1.25), (cx + math.cos(a) * 1.25, 0.62, cz + math.sin(a) * 1.25),
                       (0.07, 0.03), 'timber', None, (0, 1, 0)))
        for s in (-1, 1):
            sc.add(between('box', (cx + s * math.cos(a) * 0.4, 0.58, cz + s * math.sin(a) * 0.4),
                           (cx + s * math.cos(a) * 1.25, 0.58, cz + s * math.sin(a) * 1.25), (0.24, 0.02), 'cream', None, (0, 1, 0)))
    _P(sc, 'ell', (cx, 0.62, cz), (0.12, 0.12, 0.12), 'bark')
    # wheat field in front, hay stack, fence
    _P(sc, 'box', (0.7, -1.35, 0.04), (1.45, 0.7, 0.04), 'soil', I3, 8)
    for row in range(3):
        for i in range(5):
            _P(sc, 'ell', (-0.55 + i * 0.5, -0.95 - row * 0.4, 0.36), (0.14, 0.12, 0.34), 'wheat', I3, 10 + row * 5 + i)
    _fence(sc, -2.3, -0.4, -1.9, 4)
    _P(sc, 'cone', (-1.9, -1.2, 0.5), (0.45, 0.5), 'hay', I3, 9)
    _tree(sc, -2.0, 1.9, 0.85, 20)
    _oak(sc, 2.0, -1.0, 0.85, 24)
    img = sc.render()
    fx.glint(img, 8, 18, 1)
    return img


# ----------------------------------------------------------------- mine: rock face, timbered entrance, rails, ore
def mine():
    sc = _scene()
    _P(sc, 'ell', (0.0, 1.4, 0.8), (2.3, 1.3, 1.3), 'rock', I3, 1)
    for i, (x, y, z, rx, ry, rz) in enumerate(((-1.7, 1.1, 0.75, 0.75, 0.65, 0.75), (1.7, 1.1, 0.75, 0.75, 0.6, 0.75), (0.8, 1.6, 1.7, 0.8, 0.55, 0.7),
                                               (-0.9, 1.5, 1.8, 0.75, 0.55, 0.65), (0.0, 1.9, 2.1, 0.65, 0.5, 0.5))):
        _P(sc, 'ell', (x, y, z), (rx, ry, rz), 'rock' if i % 2 else 'granite', I3, 2 + i)
    for i, (x, y, z, m) in enumerate(((-1.3, 0.45, 0.8, 'nugget'), (1.4, 0.5, 0.9, 'iron_ore'), (1.0, 1.55, 1.8, 'nugget'), (-0.5, 1.7, 2.0, 'amethyst'))):
        _P(sc, 'ell', (x, y, z), (0.2, 0.14, 0.16), m, I3, 20 + i)
    # timbered entrance
    _P(sc, 'box', (0.0, 0.5, 0.55), (0.7, 0.4, 0.55), 'dark')
    for sx in (-1, 1):
        _P(sc, 'box', (0.8 * sx, 0.12, 0.7), (0.12, 0.14, 0.75), 'timber', I3, 3)
    _P(sc, 'box', (0.0, 0.1, 1.5), (0.95, 0.15, 0.12), 'timber', I3, 4)
    _P(sc, 'box', (0.0, 0.04, 1.78), (0.6, 0.12, 0.1), 'timber', I3, 5)
    _P(sc, 'ell', (0.0, -0.02, 1.2), (0.09, 0.09, 0.09), 'glow')
    # rails + cart, a pile of ore each side
    for sx in (-0.25, 0.25):
        _P(sc, 'box', (sx, -1.1, 0.05), (0.05, 1.2, 0.04), 'steel')
    for k in range(5):
        _P(sc, 'box', (0.0, -0.1 - k * 0.38, 0.02), (0.38, 0.06, 0.03), 'timber')
    _P(sc, 'box', (0.0, -1.3, 0.42), (0.52, 0.42, 0.26), 'steel', I3, 6)
    _P(sc, 'box', (0.0, -1.3, 0.68), (0.56, 0.46, 0.05), 'timber')
    for i, (x, y, m) in enumerate(((-0.17, -1.25, 'iron_ore'), (0.15, -1.38, 'nugget'), (0.0, -1.15, 'charcoal'))):
        _P(sc, 'ell', (x, y, 0.76), (0.2, 0.17, 0.15), m, I3, 30 + i)
    for i, (x, y, m, s) in enumerate(((1.6, -0.5, 'iron_ore', 1.1), (1.15, -0.85, 'nugget', 0.9), (-1.6, -0.6, 'charcoal', 1.1), (-1.15, -0.95, 'rock', 0.9))):
        _P(sc, 'ell', (x, y, 0.28 * s), (0.4 * s, 0.34 * s, 0.3 * s), m, I3, 40 + i)
    _tree(sc, -2.05, 1.9, 0.9, 50)
    _tree(sc, 2.05, 1.8, 0.8, 54)
    img = sc.render()
    fx.glint(img, 22, 11, 1)
    return img


# ----------------------------------------------------------------- fishing hut: its own pond, stilt hut, pier, boat
def fishinghut():
    sc = _scene()
    _P(sc, 'ell', (0.0, 0.1, 0.0), (2.4, 2.0, 0.3), 'sand', I3, 1)                                      # sandy bank rim
    _P(sc, 'ell', (0.0, 0.05, 0.0), (2.15, 1.78, 0.36), 'pond', I3, 2)                                  # the pond
    for sx in (-1, 1):
        _P(sc, 'cyl', (-0.55 + 0.85 * sx, 0.95, 0.5), (0.08, 0.5), 'bark', I3, 3)
    _P(sc, 'box', (-0.55, 1.2, 0.9), (1.1, 0.65, 0.08), 'timber', I3, 4, _planks(0.3, 0.14))             # deck on stilts
    _P(sc, 'box', (-0.55, 1.25, 1.5), (0.95, 0.55, 0.52), 'timber', I3, 5, _planks(0.35, 0.14))
    _roof(sc, -0.55, 1.25, 1.2, 0.8, 2.0, 0.7, 'terracotta', 'cream', 6, _shingles(0.34, 0.42, 0.34))
    _door(sc, -0.25, 0.66, 0.18, 0.3)
    sc.prims[-1].c = (-0.25, 0.66, 1.25)                                                                   # sit the door on the deck
    sc.prims[-2].c = (-0.25, 0.66, 1.25)
    _window(sc, -0.95, 0.7, 1.55)
    # pier to the front with posts, a flag and a rowboat
    _P(sc, 'box', (-0.25, -0.35, 0.7), (0.34, 1.0, 0.05), 'plank', I3, 7, _planks(0.25, 0.2))
    for y in (-1.2, -0.5):
        _P(sc, 'cyl', (-0.55, y, 0.34), (0.06, 0.36), 'bark')
        _P(sc, 'cyl', (0.05, y, 0.34), (0.06, 0.36), 'bark')
    _P(sc, 'cyl', (0.05, -1.2, 1.2), (0.05, 0.6), 'bark')
    _P(sc, 'box', (0.3, -1.2, 1.6), (0.26, 0.02, 0.16), 'banner_blue')
    _P(sc, 'ell', (0.95, -0.55, 0.4), (0.42, 0.95, 0.22), 'timber', I3, 8)                                 # rowboat
    _P(sc, 'ell', (0.95, -0.55, 0.5), (0.3, 0.8, 0.13), 'dark')
    _barrel(sc, 0.3, 0.7, 0.2, 0.24)
    _tree(sc, -2.1, -0.8, 0.9, 60)
    _oak(sc, 2.05, 1.5, 0.8, 66)
    img = sc.render()
    fx.glint(img, 33, 33, 1)
    return img


def _hut(sc, cx, cy, hx, hy, wall_h, wall, roof, rise=0.8, ridge='cream', seed=0, tex=None, door_x=None, windows=()):
    """Walls + gable roof + door + windows on the south face: the common cottage."""
    _P(sc, 'box', (cx, cy, wall_h / 2 + 0.05), (hx, hy, wall_h / 2), wall, I3, seed, _planks(0.35, 0.14) if wall == 'timber' else None)
    _roof(sc, cx, cy, hx + 0.2, hy + 0.2, wall_h + 0.05, rise, roof, ridge, seed + 3, tex or _shingles(0.34, 0.42, 0.34))
    _door(sc, cx + (hx * 0.35 if door_x is None else door_x), cy - hy - 0.02, 0.24, 0.45)
    for wx in windows:
        _window(sc, cx + wx, cy - hy - 0.02, wall_h * 0.62)


def _smoke(sc, x, y, z, seed=0):
    for k, (dx, dz, r) in enumerate(((0, 0, 0.22), (0.12, 0.45, 0.26), (0.28, 0.95, 0.3))):
        _P(sc, 'ell', (x + dx, y, z + dz), (r, r, r * 0.8), 'smoke', I3, seed + k)


def _chimney(sc, x, y, z, seed=0):
    _P(sc, 'box', (x, y, z), (0.18, 0.18, 0.4), 'granite', I3, seed)
    _smoke(sc, x, y, z + 0.5, seed)


def _logs(sc, x, y, n=3, along='x'):
    """A little stack of logs (ends toward the camera when along='y')."""
    pts = [(0, 0.25), (0.5, 0.25), (0.25, 0.68)][:n]
    for i, (dx, z) in enumerate(pts):
        if along == 'y':
            _P(sc, 'cyl', (x + dx, y, z), (0.24, 0.55), 'bark', rot(90, 0, 0), i)
            _P(sc, 'cyl', (x + dx, y - 0.55, z), (0.2, 0.01), 'wood_cut', rot(90, 0, 0))
        else:
            _P(sc, 'cyl', (x, y + dx, z), (0.24, 0.6), 'bark', rot(0, 90, 0), i)


def _flag(sc, x, y, h=1.6, mat='banner_blue'):
    _P(sc, 'cyl', (x, y, h / 2), (0.05, h / 2), 'bark')
    _P(sc, 'box', (x + 0.26, y, h - 0.2), (0.26, 0.02, 0.17), mat)


def _cobbles(sc, cx, cy, hx, hy):
    _P(sc, 'box', (cx, cy, 0.04), (hx, hy, 0.04), 'cobble', I3, 1)


# ----------------------------------------------------------------- lumber mill: shed, water wheel, logs, planks
def lumbermill():
    sc = _scene()
    _P(sc, 'ell', (1.25, 0.2, 0.0), (0.75, 1.9, 0.2), 'pond', I3, 1)                                      # mill stream
    _hut(sc, -0.6, 0.7, 1.15, 0.8, 1.0, 'timber', 'terracotta', 0.85, 'cream', 2, None, 0.5, (-0.7,))
    for k in range(5):                                                                                       # water wheel on the east wall
        ang = math.radians(k * 36)
        sc.add(between('box', (0.95 - math.cos(ang) * 0.75, 0.7, 0.85 - math.sin(ang) * 0.75), (0.95 + math.cos(ang) * 0.75, 0.7, 0.85 + math.sin(ang) * 0.75),
                       (0.07, 0.05), 'timber', None, (0, 1, 0)))
    _P(sc, 'cyl', (0.95, 0.7, 0.85), (0.14, 0.14), 'bark', rot(90, 0, 0))
    _logs(sc, -1.6, -1.2, 3, 'y')
    for z in range(3):                                                                                       # sawn planks
        _P(sc, 'box', (0.4, -1.1, 0.1 + z * 0.15), (0.7, 0.4, 0.06), 'wood_cut', I3, 6 + z, _planks(0.2, 0.18))
    _P(sc, 'cyl', (1.4, -1.2, 0.2), (0.35, 0.2), 'wood_cut', I3, 9)
    _tree(sc, -2.1, 1.9, 0.85, 30)
    _tree(sc, 2.1, 1.9, 0.8, 34)
    img = sc.render()
    fx.glint(img, 38, 38, 1)
    return img


# ----------------------------------------------------------------- market: striped stalls, crates, barrels
def market():
    sc = _scene()
    _cobbles(sc, 0.0, -0.1, 2.1, 1.9)
    for sx, a, b in ((-1.05, 'cloth', 'cream'), (1.1, 'banner_blue', 'cream')):
        _P(sc, 'box', (sx, 0.55, 0.4), (0.8, 0.45, 0.4), 'plank', I3, 1, _planks(0.35, 0.14))              # counter
        for p in (-1, 1):
            _P(sc, 'cyl', (sx + p * 0.85, 0.15, 0.9), (0.06, 0.9), 'bark')
            _P(sc, 'cyl', (sx + p * 0.85, 1.0, 1.0), (0.06, 1.0), 'bark')
        for i in range(6):                                                                                   # striped awning, sloping down to the front
            _P(sc, 'box', (sx - 0.8 + i * 0.32, 0.58, 1.95), (0.16, 0.62, 0.04), a if i % 2 == 0 else b, rot(-16, 0, 0))
        for i in range(6):
            _P(sc, 'box', (sx - 0.8 + i * 0.32, 0.12, 1.62), (0.16, 0.03, 0.14), a if i % 2 == 0 else b)
        for j, m in enumerate(('ruby', 'nugget', 'grass')):
            _P(sc, 'ell', (sx - 0.4 + j * 0.4, 0.4, 0.88), (0.13, 0.13, 0.12), m, I3, 4 + j)
    _barrel(sc, -2.0, -0.9)
    _crate(sc, 0.1, -1.3, 0.3)
    _crate(sc, 0.55, -1.45, 0.24)
    _P(sc, 'box', (-0.9, -1.5, 0.12), (0.5, 0.2, 0.12), 'cream')                                           # price board
    for k in range(4):
        _P(sc, 'cyl', (1.5, -1.3, 0.07 + k * 0.1), (0.2, 0.05), 'nugget', I3, k)
    _tree(sc, 2.15, 1.95, 0.75, 40)
    img = sc.render()
    fx.glint(img, 30, 22, 1)
    return img


# ----------------------------------------------------------------- blacksmith: forge house, anvil, glowing coals
def blacksmith():
    sc = _scene()
    _hut(sc, -0.7, 0.75, 1.25, 0.8, 1.1, 'rock', 'roof_slate', 0.85, 'steel', 2, None, 0.7, (-0.8,))
    _chimney(sc, 0.1, 1.1, 2.55, 3)
    _P(sc, 'box', (-0.15, -0.12, 0.45), (0.38, 0.05, 0.36), 'dark')                                        # forge mouth
    _P(sc, 'box', (-0.15, -0.16, 0.34), (0.28, 0.04, 0.2), 'glow')
    _P(sc, 'box', (1.5, -0.25, 0.3), (0.28, 0.25, 0.3), 'granite_dk', I3, 4)                              # anvil
    _P(sc, 'box', (1.5, -0.25, 0.68), (0.5, 0.22, 0.1), 'steel', I3, 5)
    _P(sc, 'cone', (2.05, -0.25, 0.68), (0.12, 0.2), 'steel', rot(0, 90, 0))
    _P(sc, 'box', (1.4, -0.25, 0.8), (0.3, 0.06, 0.03), 'meat')
    _P(sc, 'cyl', (1.5, -1.3, 0.38), (0.32, 0.38), 'bark', I3, 6)                                          # quench barrel
    _P(sc, 'cyl', (1.5, -1.3, 0.76), (0.26, 0.03), 'pond')
    for i, (x, y) in enumerate(((-1.8, -0.9), (-1.4, -1.2), (-2.0, -1.3), (-1.55, -0.7))):               # coal
        _P(sc, 'ell', (x, y, 0.2), (0.28, 0.24, 0.22), 'charcoal', I3, 7 + i)
    _P(sc, 'box', (-0.2, -1.5, 0.1), (0.7, 0.1, 0.1), 'plank')                                            # blade rack
    for k in range(3):
        _P(sc, 'box', (-0.65 + k * 0.45, -1.35, 0.22), (0.04, 0.3, 0.03), 'steel')
    _tree(sc, 2.1, 1.9, 0.8, 50)
    img = sc.render()
    fx.glint(img, 30, 30, 1)
    return img


# ----------------------------------------------------------------- workshop: blue roof, chimney, cogs, bench
def workshop():
    sc = _scene()
    _hut(sc, -0.6, 0.8, 1.3, 0.8, 1.05, 'timber', 'roof_blue', 0.9, 'steel', 2, None, 0.6, (-0.8,))
    _chimney(sc, 0.35, 1.15, 2.6, 3)
    _P(sc, 'ell', (0.4, 1.1, 3.55), (0.24, 0.24, 0.24), 'amethyst', I3, 4)                                 # a glowing orb above the chimney
    for gx, gy, r, m in ((1.65, 0.0, 0.5, 'steel'), (1.25, -0.7, 0.34, 'nugget')):                         # cogs standing on the ground
        _P(sc, 'cyl', (gx, gy, 0.18), (r, 0.1), m)
        for k in range(8):
            a = math.radians(k * 45)
            _P(sc, 'box', (gx + math.cos(a) * (r + 0.05), gy + math.sin(a) * (r + 0.05), 0.18), (0.1, 0.1, 0.1), m, rot(0, 0, k * 45))
        _P(sc, 'cyl', (gx, gy, 0.3), (r * 0.3, 0.05), 'dark')
    _P(sc, 'box', (-1.2, -1.2, 0.35), (1.0, 0.4, 0.35), 'plank', I3, 5, _planks(0.35, 0.14))              # workbench
    _P(sc, 'box', (-1.5, -1.2, 0.74), (0.4, 0.28, 0.02), 'cream')
    _P(sc, 'box', (-0.8, -1.2, 0.78), (0.2, 0.08, 0.06), 'steel')
    _crate(sc, 0.9, -1.5, 0.28)
    _barrel(sc, 2.0, -1.3)
    _tree(sc, 2.1, 1.9, 0.8, 52)
    img = sc.render()
    fx.glint(img, 24, 6, 1)
    return img


# ----------------------------------------------------------------- lumber camp: open lean-to, log stacks, stump
def lumbercamp():
    sc = _scene()
    for sx in (-1, 1):
        _P(sc, 'cyl', (-0.5 + 1.0 * sx, 0.2, 0.75), (0.09, 0.75), 'bark', I3, 1)
        _P(sc, 'cyl', (-0.5 + 1.0 * sx, 1.3, 1.2), (0.09, 1.2), 'bark', I3, 2)
    _P(sc, 'box', (-0.5, 0.75, 1.75), (1.35, 0.85, 0.07), 'plank', rot(-25, 0, 0), 3, _planks(0.3, 0.18))   # sloped shed roof
    _P(sc, 'box', (-0.5, 1.3, 0.08), (1.1, 0.9, 0.06), 'soil', I3, 4)
    _P(sc, 'box', (-0.5, 1.2, 0.35), (0.6, 0.3, 0.3), 'wood_cut', I3, 5, _planks(0.2, 0.18))
    _logs(sc, 0.9, -0.5, 3, 'y')
    _logs(sc, -2.0, -1.0, 3, 'y')
    _P(sc, 'cyl', (-0.3, -1.4, 0.24), (0.34, 0.24), 'wood_cut', I3, 6)                                     # chopping stump + axe
    _P(sc, 'box', (-0.3, -1.4, 0.55), (0.18, 0.04, 0.1), 'steel')
    sc.add(between('cyl', (-0.3, -1.4, 0.5), (0.1, -1.1, 0.78), (0.04,), 'bark', None, (0, 0, 1)))
    _tree(sc, -2.1, 1.7, 1.0, 10)
    _tree(sc, 2.05, 1.6, 1.0, 14)
    _tree(sc, 2.0, -1.5, 0.8, 18)
    img = sc.render()
    fx.glint(img, 30, 30, 1)
    return img


# ----------------------------------------------------------------- quarry: cut stone blocks, crane, cart
def quarry():
    sc = _scene()
    for i, (x, y, z, hx, hy, hz) in enumerate(((-1.2, 1.2, 0.9, 1.0, 0.8, 0.9), (0.3, 1.6, 1.3, 0.9, 0.7, 1.3), (1.5, 1.2, 0.7, 0.8, 0.7, 0.7))):   # stepped cut face
        _P(sc, 'box', (x, y, z), (hx, hy, hz), 'granite' if i != 1 else 'granite_dk', rot(0, 0, 5 * i), 1 + i)
    for k in range(3):
        _P(sc, 'box', (-1.2, 0.4 - k * 0.0, 0.5 + k * 0.6), (0.9 - k * 0.1, 0.05, 0.02), 'granite_dk')
    for i, (x, y, z) in enumerate(((0.9, -0.3, 0.25), (1.45, -0.55, 0.25), (1.15, -0.4, 0.7), (-0.4, -0.9, 0.25))):   # dressed blocks
        _P(sc, 'box', (x, y, z), (0.36, 0.3, 0.25), 'rock', rot(0, 0, 8 * i), 10 + i, None)
    for sx in (-1, 1):                                                                                          # crane
        sc.add(between('cyl', (-1.0 + sx * 0.4, -0.5, 0.0), (-1.0, -0.5, 1.9), (0.06,), 'timber', None, (0, 1, 0)))
    sc.add(between('cyl', (-1.0, -0.5, 1.9), (0.2, -0.5, 1.6), (0.05,), 'timber', None, (0, 1, 0)))
    sc.add(between('cyl', (0.2, -0.5, 1.6), (0.2, -0.5, 0.9), (0.02,), 'rope', None, (0, 1, 0)))
    _P(sc, 'box', (0.2, -0.5, 0.78), (0.2, 0.18, 0.15), 'rock', I3, 14)
    _P(sc, 'box', (-1.7, -1.2, 0.3), (0.45, 0.35, 0.2), 'steel', I3, 15)                                       # cart of rubble
    for i in range(3):
        _P(sc, 'ell', (-1.8 + i * 0.2, -1.2, 0.55), (0.17, 0.14, 0.12), 'rock', I3, 16 + i)
    _tree(sc, 2.1, 1.9, 0.8, 20)
    _tree(sc, -2.1, 1.9, 0.8, 24)
    img = sc.render()
    fx.glint(img, 20, 14, 1)
    return img


# ----------------------------------------------------------------- hunter's lodge: dark timber lodge, antlers, hides, fire
def hunterslodge():
    sc = _scene()
    _hut(sc, -0.7, 0.8, 1.25, 0.8, 1.0, 'timber', 'timber', 0.85, 'bark', 2, _planks(0.26, 0.2), 0.5, (-0.75,))
    for sx in (-1, 1):                                                                                          # antlers over the door
        _P(sc, 'box', (-0.2 + 0.22 * sx, -0.1, 1.5), (0.04, 0.03, 0.2), 'bone', rot(0, 20 * sx, 0))
        _P(sc, 'box', (-0.2 + 0.36 * sx, -0.1, 1.7), (0.03, 0.03, 0.12), 'bone', rot(0, 40 * sx, 0))
    for sx in (-1, 1):                                                                                          # hide-drying frame
        _P(sc, 'cyl', (1.1 + 0.55 * sx, -0.4, 0.8), (0.05, 0.8), 'bark')
    _P(sc, 'box', (1.1, -0.4, 1.5), (0.6, 0.04, 0.04), 'bark')
    _P(sc, 'box', (1.1, -0.42, 1.0), (0.4, 0.03, 0.5), 'leather', I3, 3)
    _P(sc, 'cyl', (-0.3, -1.4, 0.1), (0.3, 0.1), 'rock')                                                      # campfire ring
    _P(sc, 'cone', (-0.3, -1.4, 0.4), (0.18, 0.3), 'glow', I3, 4)
    _P(sc, 'cone', (-0.3, -1.4, 0.35), (0.3, 0.25), 'meat', I3, 5)
    _tree(sc, 2.1, 1.5, 1.0, 10)
    _tree(sc, -2.1, 1.7, 1.0, 14)
    _tree(sc, 2.0, -1.5, 0.8, 18)
    _bush(sc, -1.9, -0.8)
    img = sc.render()
    fx.glint(img, 20, 40, 1)
    return img


def _bush(sc, x, y, s=1.0):
    _P(sc, 'ell', (x, y, 0.22 * s), (0.36 * s, 0.3 * s, 0.24 * s), 'moss', I3, 77)


# ----------------------------------------------------------------- tavern: big two-storey inn with a hanging sign
def tavern():
    sc = _scene()
    _P(sc, 'box', (-0.5, 0.7, 1.05), (1.55, 0.85, 1.05), 'whitewash', I3, 1)
    _P(sc, 'box', (-0.5, -0.17, 1.15), (1.55, 0.03, 0.05), 'timber')                                        # timber band between floors
    _roof(sc, -0.5, 0.7, 1.8, 1.1, 2.1, 1.0, 'terracotta', 'cream', 2, _shingles(0.34, 0.42, 0.34))
    _door(sc, -0.5, -0.17, 0.28, 0.5)
    for wx in (-1.45, 0.45):
        _window(sc, wx, -0.17, 0.75)
    for wx in (-1.2, -0.5, 0.2):
        _window(sc, wx, -0.17, 1.6)
    _chimney(sc, 0.5, 1.2, 3.15, 3)
    _P(sc, 'box', (1.4, -0.17, 1.05), (0.03, 0.03, 0.4), 'bark')                                            # sign bracket + hanging mug sign
    _P(sc, 'box', (1.7, -0.17, 1.62), (0.3, 0.03, 0.03), 'bark')
    _P(sc, 'box', (1.7, -0.22, 1.3), (0.2, 0.025, 0.2), 'nugget')
    for bx, by in ((1.1, -1.0), (1.7, -1.2)):
        _barrel(sc, bx, by, 0.24, 0.28)
    _P(sc, 'cyl', (-1.3, -1.3, 0.4), (0.4, 0.04), 'timber')                                                  # outdoor table with mugs
    _P(sc, 'cyl', (-1.3, -1.3, 0.2), (0.08, 0.2), 'bark')
    for dx in (-0.15, 0.15):
        _P(sc, 'cyl', (-1.3 + dx, -1.3, 0.5), (0.07, 0.07), 'nugget')
    _tree(sc, 2.1, 1.9, 0.8, 30)
    img = sc.render()
    fx.glint(img, 33, 30, 1)
    return img


# ----------------------------------------------------------------- tower: stone watchtower with banner
def tower():
    sc = _scene()
    _P(sc, 'box', (0.0, 0.5, 1.7), (0.85, 0.85, 1.7), 'wallstone', I3, 1)
    for k in range(4):                                                                                         # brick courses
        _P(sc, 'box', (0.0, -0.36, 0.5 + k * 0.8), (0.86, 0.02, 0.025), 'granite_dk')
    _P(sc, 'box', (0.0, 0.5, 3.5), (1.0, 1.0, 0.12), 'granite', I3, 2)                                      # overhanging crown
    for ix in range(4):
        for iy in range(4):
            if ix in (0, 3) or iy in (0, 3):
                _P(sc, 'box', (-0.78 + ix * 0.52, -0.5 + iy * 0.52, 3.85), (0.14, 0.14, 0.18), 'wallstone', I3, 3 + ix + iy)
    _door(sc, 0.0, -0.37, 0.24, 0.45)
    _P(sc, 'box', (0.0, -0.37, 1.9), (0.1, 0.03, 0.28), 'dark')
    _P(sc, 'box', (0.0, -0.37, 2.8), (0.1, 0.03, 0.28), 'dark')
    _flag(sc, 0.0, 0.5, 5.4, 'banner_blue')
    _P(sc, 'box', (0.0, 0.5, 0.04), (1.3, 1.3, 0.04), 'cobble')
    for i, (x, y) in enumerate(((-1.7, 1.2), (1.7, 1.3), (-1.8, -1.2), (1.8, -1.3))):
        _bush(sc, x, y)
    _tree(sc, -2.1, 1.9, 0.9, 40)
    _tree(sc, 2.1, 1.8, 0.9, 44)
    img = sc.render()
    fx.glint(img, 24, 4, 1)
    return img


# ----------------------------------------------------------------- well: stone ring, roof, bucket
def well():
    sc = _scene(scale=10.4, origin=(24, 44))
    _P(sc, 'cyl', (0.0, 0.0, 0.4), (0.95, 0.4), 'cobble', I3, 1)
    _P(sc, 'cyl', (0.0, 0.0, 0.82), (0.72, 0.03), 'pond')
    for sx in (-1, 1):
        _P(sc, 'cyl', (0.85 * sx, 0.0, 1.2), (0.08, 1.2), 'timber', I3, 2)
    _roof(sc, 0.0, 0.0, 1.15, 0.8, 2.3, 0.65, 'timber', 'bark', 3, _planks(0.25, 0.16))
    sc.add(between('cyl', (-0.85, 0.0, 1.95), (0.85, 0.0, 1.95), (0.07,), 'bark', None, (0, 0, 1)))
    sc.add(between('cyl', (0.0, 0.0, 1.9), (0.0, 0.0, 1.0), (0.015,), 'rope', None, (0, 0, 1)))
    _P(sc, 'cyl', (0.0, -0.04, 0.95), (0.16, 0.12), 'bark', I3, 4)
    for i, (x, y) in enumerate(((-1.7, -0.9), (1.7, -1.0), (-1.4, 1.2), (1.6, 1.3))):
        _bush(sc, x, y)
    for i, (x, y, m) in enumerate(((-1.2, -1.4, 'cloth'), (-0.9, -1.55, 'nugget'), (1.2, -1.4, 'amethyst'))):    # flowers
        _P(sc, 'ell', (x, y, 0.12), (0.1, 0.1, 0.1), m, I3, 5 + i)
    _tree(sc, -2.1, 1.8, 0.85, 50)
    _tree(sc, 2.1, 1.7, 0.85, 54)
    img = sc.render()
    fx.glint(img, 22, 33, 1)
    return img


# ----------------------------------------------------------------- alchemy lab: plum roof, cauldron, bottles, crystals
def alchemylab():
    sc = _scene()
    _hut(sc, -0.7, 0.8, 1.25, 0.8, 1.05, 'whitewash', 'roof_plum', 0.95, 'nugget', 2, None, 0.55, (-0.8,))
    _chimney(sc, 0.2, 1.15, 2.6, 3)
    _P(sc, 'cyl', (1.3, -0.3, 0.38), (0.5, 0.38), 'charcoal', I3, 4)                                       # cauldron with a green brew
    _P(sc, 'cyl', (1.3, -0.3, 0.7), (0.4, 0.03), 'emerald')
    for i, (dx, dy, r) in enumerate(((0.1, 0.05, 0.1), (-0.15, -0.1, 0.07))):
        _P(sc, 'ell', (1.3 + dx, -0.3 + dy, 0.85 + i * 0.2), (r, r, r), 'emerald', I3, 5 + i)
    _P(sc, 'cyl', (1.3, -0.3, 0.05), (0.4, 0.05), 'glow')
    for i, (x, y, m) in enumerate(((-0.7, -1.0, 'amethyst'), (-0.4, -1.15, 'ruby'), (-1.0, -1.2, 'fish_blue'))):    # bottles
        _P(sc, 'cyl', (x, y, 0.22), (0.12, 0.22), m, I3, 8 + i)
        _P(sc, 'cyl', (x, y, 0.5), (0.04, 0.08), 'glass')
    for i, (x, y, h) in enumerate(((1.6, -1.4, 0.5), (1.9, -1.2, 0.35), (0.9, -1.5, 0.4))):                 # crystals
        _P(sc, 'cone', (x, y, h), (0.18, h), 'amethyst', I3, 12 + i)
    _tree(sc, 2.1, 1.8, 0.8, 60)
    _tree(sc, -2.1, 1.9, 0.8, 64, 'moss')
    img = sc.render()
    fx.glint(img, 33, 33, 1)
    return img


# ----------------------------------------------------------------- stone craft: slate workshop, blocks, a statue
def stonecraft():
    sc = _scene()
    _hut(sc, -0.7, 0.8, 1.25, 0.8, 1.0, 'rock', 'roof_slate', 0.85, 'steel', 2, None, 0.6, (-0.8,))
    _P(sc, 'box', (0.35, 1.2, 2.3), (0.17, 0.17, 0.35), 'granite', I3, 3)
    for i, (x, y, z) in enumerate(((1.1, -0.3, 0.28), (1.7, -0.5, 0.28), (1.4, -0.4, 0.78), (-1.6, -1.1, 0.28))):   # stacked blocks
        _P(sc, 'box', (x, y, z), (0.38, 0.32, 0.28), 'rock', rot(0, 0, 6 * i), 10 + i, None)
    _P(sc, 'box', (-0.4, -1.2, 0.3), (0.34, 0.3, 0.3), 'rock', I3, 14)                                       # block being carved
    _P(sc, 'ell', (-0.4, -1.2, 0.8), (0.24, 0.2, 0.3), 'rock', I3, 15)
    _P(sc, 'box', (0.05, -1.15, 0.2), (0.12, 0.05, 0.03), 'steel', rot(0, 0, 30))                           # chisel
    _P(sc, 'box', (0.9, -1.4, 0.15), (0.5, 0.25, 0.15), 'plank', I3, 16, _planks(0.2, 0.15))               # pallet with rubble
    for i in range(3):
        _P(sc, 'ell', (0.75 + i * 0.22, -1.4, 0.38), (0.15, 0.13, 0.1), 'rock', I3, 17 + i)
    _tree(sc, 2.1, 1.9, 0.8, 30)
    _tree(sc, -2.1, 1.8, 0.8, 34)
    img = sc.render()
    fx.glint(img, 30, 30, 1)
    return img


# ----------------------------------------------------------------- barracks: canvas tent, banners, weapon racks, palisade
def barracks():
    sc = _scene()
    for side in (-1, 1):                                                                                       # tent: two canvas slopes
        _P(sc, 'box', (-0.3, 0.7 + side * 0.5, 1.0), (1.1, 0.72, 0.05), 'canvas', rot(-side * 48, 0, 0), 1)
    _P(sc, 'box', (-0.3, 0.7, 1.6), (1.15, 0.06, 0.06), 'timber')
    _P(sc, 'box', (-0.3, 0.2, 0.5), (0.3, 0.03, 0.5), 'dark')                                                # tent door
    for k in range(3):
        _P(sc, 'box', (-0.8 + k * 0.5, 0.18, 1.0), (0.04, 0.03, 0.5), 'cloth')                               # red stripes
    for sx in (-1, 1):
        _P(sc, 'cyl', (-0.3 + 1.15 * sx, 0.2, 0.8), (0.06, 0.8), 'timber')
    for sx in (-1.9, 1.5):                                                                                      # banner poles
        _flag(sc, sx, 0.0, 2.6, 'banner_blue')
    for k in range(5):                                                                                          # spear rack
        _P(sc, 'cyl', (0.7 + k * 0.18, -1.0, 0.6), (0.03, 0.6), 'bark', rot(0, 8, 0))
        _P(sc, 'cone', (0.7 + k * 0.18, -1.0, 1.28), (0.07, 0.1), 'steel')
    _P(sc, 'box', (0.9, -1.0, 0.25), (0.55, 0.06, 0.05), 'timber')
    for i in range(7):                                                                                          # palisade at the back
        _P(sc, 'cone', (-2.0 + i * 0.66, 1.9, 0.8), (0.17, 0.8), 'timber', I3, i)
    _P(sc, 'cyl', (-1.2, -1.2, 0.35), (0.36, 0.35), 'rock')                                                   # training dummy
    _P(sc, 'box', (-1.2, -1.2, 0.95), (0.4, 0.06, 0.06), 'bark')
    _P(sc, 'ell', (-1.2, -1.2, 1.2), (0.17, 0.17, 0.17), 'hay')
    _P(sc, 'cyl', (-1.2, -1.2, 0.9), (0.05, 0.6), 'bark')
    _tree(sc, 2.1, 1.0, 0.8, 70)
    img = sc.render()
    fx.glint(img, 24, 4, 1)
    return img


SPRITES = {
    'building_farm': farm, 'building_mine': mine, 'building_lumbermill': lumbermill, 'building_market': market,
    'building_blacksmith': blacksmith, 'building_workshop': workshop, 'building_lumbercamp': lumbercamp,
    'building_quarry': quarry, 'building_fishinghut': fishinghut, 'building_hunterslodge': hunterslodge,
    'building_tavern': tavern, 'building_tower': tower, 'building_well': well, 'building_alchemylab': alchemylab,
    'building_stonecraft': stonecraft, 'building_barracks': barracks,
}
