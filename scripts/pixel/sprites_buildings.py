"""Grounds-tile buildings (48x48): farm, mine, lumber mill, market, blacksmith, workshop.
Seen from above like the castle, each fills its whole map tile and is dressed with props that show what it does for a
living (crops + scarecrow, ore veins + cart, a log mid-cut on the saw bench, ...). Roofs are textured (shingle courses /
thatch strands). Each is both the picker icon and the tile graphic once a grounds tile is converted."""
import math
from render3d import Scene, Prim, rot, between, I3
from materials import MATS
import fx

SIZE = 48
CAM = dict(yaw=0.0, pitch=78.0)        # looking almost straight down; front faces show as a thin strip


def _scene():
    return Scene(MATS, size=SIZE, scale=9.8, origin=(24, 25), **CAM)


def _P(sc, kind, c, size, mat, R=I3, seed=0, tex=None):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


# ----------------------------------------------------------------- textures
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


def _strands(col=0.2, depth=0.14):
    """Thatch: fine lines running down the slope."""
    def t(p, n, prim):
        if abs(n[2]) < 0.5:
            return None, 0.0
        f = (p[0] / col) % 1
        return None, (-depth if f < 0.22 else (0.05 if f > 0.8 else 0.0))
    return t


def _planks(col=0.3, depth=0.16):
    """Wooden boards seen from above, running along y."""
    def t(p, n, prim):
        if abs(n[2]) < 0.5:
            return None, 0.0
        return None, (-depth if ((p[0] / col) % 1) < 0.12 else 0.0)
    return t


def _roof(sc, cx, cy, hx, hy, base_z, rise, mat, ridge='cream', seed=0, tex=None):
    """Gable roof with the ridge along x: two sloped slabs meeting in a ridge beam."""
    ang = math.degrees(math.atan2(rise, hy))
    half = math.hypot(hy, rise) / 2
    tex = tex or _shingles()
    for s in (-1, 1):
        _P(sc, 'box', (cx, cy + s * hy / 2, base_z + rise / 2), (hx, half, 0.06), mat, rot(-s * ang, 0, 0), seed + s, tex)
    _P(sc, 'box', (cx, cy, base_z + rise + 0.03), (hx + 0.04, 0.07, 0.07), ridge)


# ----------------------------------------------------------------- shared props
def _gear(sc, x, y, z, r, teeth, mat='gold', hub='steel', h=0.08, phase=0.0):
    """Cog lying flat on the ground."""
    _P(sc, 'cyl', (x, y, z), (r, h), mat)
    for k in range(teeth):
        a = 2 * math.pi * k / teeth + phase
        _P(sc, 'box', (x + math.cos(a) * (r + 0.06), y + math.sin(a) * (r + 0.06), z),
           (0.11, 0.11, h), mat, rot(0, 0, math.degrees(a)))
    _P(sc, 'cyl', (x, y, z + h), (r * 0.3, 0.04), hub)


def _barrel(sc, x, y, r=0.34, h=0.38, top='bark', seed=0):
    _P(sc, 'cyl', (x, y, h), (r, h), 'bark', I3, seed)
    _P(sc, 'cyl', (x, y, h * 2 - 0.02), (r * 0.86, 0.03), top)
    _P(sc, 'cyl', (x, y, h * 1.0), (r * 1.04, 0.05), 'steel')


def _crate(sc, x, y, hx=0.4, hy=0.34, h=0.22, seed=0):
    _P(sc, 'box', (x, y, h), (hx, hy, h), 'plank', I3, seed, _planks())
    _P(sc, 'box', (x, y, h * 2 - 0.01), (hx + 0.02, 0.05, 0.03), 'bark')
    _P(sc, 'box', (x, y, h * 2 - 0.01), (0.05, hy + 0.02, 0.03), 'bark')


def _fence(sc, x0, x1, y, n):
    for i in range(n):
        _P(sc, 'cyl', (x0 + (x1 - x0) * i / (n - 1), y, 0.28), (0.07, 0.28), 'bark', I3, i)
    _P(sc, 'box', ((x0 + x1) / 2, y, 0.42), ((x1 - x0) / 2, 0.04, 0.05), 'plank')
    _P(sc, 'box', ((x0 + x1) / 2, y, 0.2), ((x1 - x0) / 2, 0.04, 0.05), 'plank')


# ----------------------------------------------------------------- farm: cottage, crops, scarecrow, hay
def farm():
    sc = _scene()
    _P(sc, 'box', (-0.85, 1.05, 0.45), (1.25, 0.9, 0.45), 'cream', I3, 1)                  # cottage walls
    _roof(sc, -0.85, 1.05, 1.34, 1.06, 0.9, 0.62, 'thatch', 'wheat', 2, _strands())
    _P(sc, 'box', (-0.5, 0.14, 0.3), (0.2, 0.04, 0.28), 'door')                             # door
    _P(sc, 'box', (-0.5, 0.06, 0.04), (0.28, 0.1, 0.04), 'stone')                           # step
    for sx in (-1.5, -1.05):                                                                 # window + shutters
        _P(sc, 'box', (sx, 0.14, 0.5), (0.13, 0.04, 0.13), 'dark')
        for dx in (-0.2, 0.2):
            _P(sc, 'box', (sx + dx * 0.7, 0.12, 0.5), (0.05, 0.03, 0.14), 'cloth')
    _P(sc, 'box', (0.05, 1.45, 1.5), (0.17, 0.17, 0.3), 'granite', I3, 3)                  # chimney
    _P(sc, 'ell', (0.12, 1.5, 2.0), (0.2, 0.2, 0.16), 'smoke', I3, 4)                       # a wisp of smoke
    # haystack + bales
    _P(sc, 'cone', (1.75, 1.45, 0.6), (0.7, 0.6), 'wheat', I3, 5)
    _P(sc, 'ell', (1.75, 1.45, 1.22), (0.1, 0.1, 0.1), 'wheat')
    for i, (x, y) in enumerate(((1.15, 0.45), (1.75, 0.5))):
        _P(sc, 'box', (x, y, 0.2), (0.3, 0.22, 0.2), 'wheat', I3, 6 + i, _planks(0.16, 0.12))
    # crops: tilled rows with sprouts and a taller wheat row
    for row, y in enumerate((-0.75, -1.35)):
        _P(sc, 'box', (-0.55, y, 0.07), (1.7, 0.2, 0.07), 'soil', I3, 10 + row)
        for i in range(6):
            _P(sc, 'ell', (-2.0 + i * 0.7, y, 0.28), (0.2, 0.2, 0.24), 'grass', I3, 20 + row * 6 + i)
    for i in range(7):
        x = -2.05 + i * 0.58
        _P(sc, 'cyl', (x, -1.95, 0.4), (0.07, 0.4), 'grass', I3, 40 + i)
        _P(sc, 'ell', (x, -1.95, 0.85), (0.1, 0.1, 0.3), 'wheat', I3, 50 + i)
    # scarecrow in the field
    _P(sc, 'cyl', (1.55, -1.1, 0.7), (0.05, 0.7), 'bark')
    _P(sc, 'box', (1.55, -1.1, 1.05), (0.5, 0.04, 0.05), 'bark')
    _P(sc, 'ell', (1.55, -1.1, 1.4), (0.17, 0.17, 0.17), 'skin')
    _P(sc, 'cone', (1.55, -1.1, 1.62), (0.34, 0.12), 'tunic')
    _P(sc, 'ell', (1.55, -1.1, 0.85), (0.2, 0.12, 0.25), 'cloth')
    # pumpkins + watering can
    for i, (x, y) in enumerate(((0.95, -0.7), (1.0, -1.45), (2.05, -0.5))):
        _P(sc, 'ell', (x, y, 0.28), (0.28, 0.28, 0.24), 'cloth', I3, 60 + i)
    _fence(sc, 0.35, 2.3, -2.2, 5)
    img = sc.render()
    fx.glint(img, 8, 7, 1)
    return img


# ----------------------------------------------------------------- mine: ore-veined rock, headframe, carts
def mine():
    sc = _scene()
    _P(sc, 'ell', (0.0, 1.2, 0.45), (2.3, 1.25, 0.85), 'granite_dk', I3, 1)                # rock mass
    for i, (x, y, z, rx, ry, rz) in enumerate(((-1.7, 1.65, 0.35, 0.65, 0.55, 0.5), (1.8, 1.55, 0.35, 0.6, 0.5, 0.5),
                                               (0.5, 1.8, 0.9, 0.55, 0.42, 0.4), (-0.7, 1.3, 0.95, 0.5, 0.4, 0.35),
                                               (1.3, 0.9, 0.7, 0.4, 0.32, 0.3))):
        _P(sc, 'ell', (x, y, z), (rx, ry, rz), 'granite', I3, 2 + i)
    for i, (x, y, z, m) in enumerate(((-0.2, 1.55, 1.0, 'gold'), (1.0, 1.35, 0.95, 'gold'), (-1.2, 1.05, 0.7, 'crystal'),
                                      (0.35, 0.95, 0.72, 'crystal'), (1.65, 1.9, 0.62, 'gold'), (-1.75, 1.95, 0.55, 'gold'))):   # ore flecks
        _P(sc, 'ell', (x, y, z), (0.17, 0.14, 0.12), m, I3, 20 + i)
    _P(sc, 'box', (0.0, -0.35, 0.04), (0.62, 0.75, 0.03), 'dark')                           # shaft floor
    for sx in (-1, 1):
        _P(sc, 'box', (0.74 * sx, -0.3, 0.55), (0.1, 0.12, 0.6), 'bark', I3, 5)             # timber frame
        _P(sc, 'box', (0.74 * sx, -0.95, 0.4), (0.1, 0.12, 0.45), 'bark', I3, 6)
    for y in (-0.25, -0.95):
        _P(sc, 'box', (0.0, y, 1.1 if y > -0.5 else 0.88), (0.9, 0.1, 0.09), 'bark', I3, 7)
    _P(sc, 'ell', (0.0, -0.3, 0.95), (0.08, 0.08, 0.08), 'glow')                            # lantern
    for sx in (-0.2, 0.2):                                                                    # rails
        _P(sc, 'box', (sx, -1.5, 0.05), (0.04, 1.0, 0.04), 'steel')
    for k in range(6):
        _P(sc, 'box', (0.0, -0.6 - k * 0.3, 0.02), (0.32, 0.05, 0.03), 'bark')
    _P(sc, 'box', (0.0, -1.65, 0.32), (0.42, 0.34, 0.2), 'steel', I3, 7)                    # ore cart
    _P(sc, 'box', (0.0, -1.65, 0.5), (0.45, 0.37, 0.05), 'bark')
    for i, (x, y, m) in enumerate(((-0.12, -1.6, 'coal'), (0.14, -1.75, 'coal'), (0.05, -1.5, 'gold'), (0.18, -1.55, 'coal'))):
        _P(sc, 'ell', (x, y, 0.6), (0.15, 0.14, 0.13), m, I3, 30 + i)
    # second cart parked on a spur + ore piles + crates + tools
    for sx in (-1.55, -1.15):
        _P(sc, 'box', (sx, -1.55, 0.05), (0.04, 0.55, 0.04), 'steel')
    _P(sc, 'box', (-1.35, -1.5, 0.3), (0.36, 0.3, 0.18), 'steel', I3, 8)
    _P(sc, 'ell', (-1.35, -1.5, 0.52), (0.3, 0.24, 0.12), 'stone', I3, 9)
    for i, (x, y, m) in enumerate(((1.4, -0.7, 'coal'), (1.9, -1.2, 'coal'), (1.25, -1.35, 'gold'), (1.75, -1.8, 'coal'), (2.0, -0.6, 'stone'))):
        _P(sc, 'ell', (x, y, 0.15), (0.24, 0.2, 0.17), m, I3, 50 + i)
    _crate(sc, 0.95, -2.1, 0.32, 0.26, 0.2, 3)
    sc.add(between('cyl', (-2.1, -0.4, 0.1), (-1.55, 0.05, 0.1), (0.05,), 'bark', None, (0, 0, 1)))   # pickaxe
    _P(sc, 'box', (-1.6, 0.0, 0.14), (0.28, 0.05, 0.05), 'steel', rot(0, 0, 40))
    img = sc.render()
    fx.glint(img, 20, 10, 1)
    fx.glint(img, 33, 12, 1)
    return img


# ----------------------------------------------------------------- lumber mill: shed, log on the saw bench, planks
def lumbermill():
    sc = _scene()
    _P(sc, 'box', (-0.8, 1.15, 0.55), (1.45, 0.95, 0.55), 'bark', I3, 1)                    # shed
    _roof(sc, -0.8, 1.15, 1.54, 1.1, 1.1, 0.7, 'plank', 'wood_cut', 2, _shingles(0.3, 0.45, 0.22))
    _P(sc, 'box', (-0.8, 0.2, 0.34), (0.3, 0.04, 0.32), 'door')
    # saw bench: a log mid-cut, the blade biting into it, sawdust + offcuts
    _P(sc, 'box', (-0.5, -1.2, 0.3), (1.35, 0.5, 0.3), 'plank', I3, 8, _planks(0.35, 0.14))
    _P(sc, 'cyl', (-0.55, -1.2, 0.5), (0.2, 1.1), 'bark', rot(0, 90, 0), 9)                  # the log (runs along x)
    _P(sc, 'cyl', (0.56, -1.2, 0.5), (0.2, 0.01), 'wood_cut', rot(0, 90, 0))
    _P(sc, 'cyl', (-0.3, -1.2, 0.74), (0.46, 0.03), 'steel')                                  # saw blade, flat
    for k in range(10):
        a = math.radians(k * 36)
        _P(sc, 'box', (-0.3 + 0.49 * math.cos(a), -1.2 + 0.49 * math.sin(a), 0.74), (0.07, 0.04, 0.03), 'steel', rot(0, 0, k * 36))
    _P(sc, 'cyl', (-0.3, -1.2, 0.78), (0.1, 0.03), 'gold')
    for i, (x, y) in enumerate(((-0.3, -1.85), (0.1, -1.95), (-0.7, -1.9), (0.55, -1.8), (-1.1, -1.8))):   # sawdust
        _P(sc, 'ell', (x, y, 0.04), (0.2, 0.1, 0.04), 'crumb', I3, 70 + i)
    # stacked planks (layers of boards, alternating direction)
    for z in range(4):
        _P(sc, 'box', (1.75, 0.55, 0.1 + z * 0.17), (0.55 if z % 2 == 0 else 0.45, 0.95 if z % 2 == 0 else 1.0, 0.08),
           'wood_cut', I3, 80 + z, _planks(0.18, 0.18))
    # log pile (logs run along y) with cut ends
    for i, (x, z) in enumerate(((1.15, 0.27), (1.7, 0.27), (1.42, 0.7))):
        _P(sc, 'cyl', (x + 0.15, -1.15, z), (0.27, 0.95), 'bark', rot(90, 0, 0), i)
    # axe in a stump
    _P(sc, 'cyl', (-2.0, -0.3, 0.22), (0.36, 0.22), 'wood_cut', I3, 9)
    _P(sc, 'box', (-2.0, -0.3, 0.46), (0.2, 0.05, 0.1), 'steel')
    sc.add(between('cyl', (-2.0, -0.3, 0.45), (-1.6, 0.2, 0.7), (0.04,), 'bark', None, (0, 0, 1)))
    img = sc.render()
    fx.glint(img, 20, 31, 1)
    return img


# ----------------------------------------------------------------- market: awning, goods, scales, coins
def market():
    sc = _scene()
    _P(sc, 'box', (0, 0.7, 0.42), (1.9, 0.75, 0.42), 'plank', I3, 1, _planks(0.4, 0.12))   # counter
    for sx in (-1.9, 1.9):                                                                    # posts
        _P(sc, 'cyl', (sx, -0.3, 0.8), (0.08, 0.8), 'bark', I3, 2)
    for i in range(8):                                                                        # striped awning
        _P(sc, 'box', (-1.65 + i * 0.47, 0.8, 1.62), (0.235, 1.1, 0.05),
           'cloth' if i % 2 == 0 else 'cream', rot(10, 0, 0))
    for i in range(8):
        _P(sc, 'box', (-1.65 + i * 0.47, -0.3, 1.45), (0.235, 0.07, 0.2), 'cloth' if i % 2 == 0 else 'cream')   # valance
    _P(sc, 'box', (0, 0.3, 1.78), (1.95, 0.05, 0.05), 'bark')                                 # front rail with hanging sign
    # goods on display in front: fruit, melons, loaves, a basket
    for sx, mat in ((-1.5, 'ruby'), (-0.45, 'grass'), (0.6, 'cloth')):
        _P(sc, 'box', (sx, -1.45, 0.22), (0.5, 0.4, 0.22), 'plank', I3, int(sx * 7), _planks())
        for j in range(6):
            a = j * 1.05
            _P(sc, 'ell', (sx + 0.24 * math.cos(a), -1.45 + 0.17 * math.sin(a), 0.5), (0.16, 0.16, 0.14), mat, I3, 5 + j)
    for j in range(3):                                                                        # bread loaves
        _P(sc, 'ell', (1.45 + j * 0.3, -1.45, 0.14), (0.14, 0.2, 0.12), 'bread', I3, 30 + j)
    _P(sc, 'cyl', (1.7, -1.95, 0.2), (0.32, 0.2), 'plank', I3, 40)                           # basket of wheat
    for j in range(4):
        _P(sc, 'ell', (1.58 + 0.08 * j, -1.95, 0.46), (0.07, 0.07, 0.28), 'wheat', I3, 45 + j)
    _barrel(sc, 2.05, -0.5, 0.3, 0.36, 'bark', 20)
    _barrel(sc, -2.1, -0.55, 0.3, 0.36, 'bark', 21)
    for k in range(5):                                                                        # coin stack + loose coins
        _P(sc, 'cyl', (-0.9, -2.0, 0.07 + k * 0.1), (0.22, 0.05), 'gold', I3, 12 + k)
    for k in range(3):
        _P(sc, 'cyl', (-0.4 + k * 0.3, -2.1, 0.05), (0.15, 0.04), 'gold', I3, 60 + k)
    _P(sc, 'box', (0.4, -2.12, 0.07), (0.45, 0.14, 0.07), 'cream')                           # price board
    img = sc.render()
    fx.glint(img, 15, 40, 1)
    fx.glint(img, 38, 7, 1)
    return img


# ----------------------------------------------------------------- blacksmith: forge, hot blade on the anvil, rack
def blacksmith():
    sc = _scene()
    _P(sc, 'box', (-0.85, 1.1, 0.7), (1.4, 0.95, 0.7), 'granite', I3, 1)                    # forge house
    _roof(sc, -0.85, 1.1, 1.48, 1.1, 1.4, 0.6, 'slate_blue', 'steel', 2, _shingles(0.3, 0.42, 0.22))
    _P(sc, 'box', (0.3, 1.45, 1.9), (0.3, 0.3, 0.7), 'granite_dk', I3, 3)                   # chimney
    for i, (x, y, z, r) in enumerate(((0.35, 1.5, 3.0, 0.3), (0.55, 1.6, 3.7, 0.38), (0.8, 1.75, 4.4, 0.42))):   # smoke
        _P(sc, 'ell', (x, y, z), (r, r, r * 0.8), 'smoke', I3, 40 + i)
    _P(sc, 'box', (-0.85, 0.2, 0.4), (0.5, 0.05, 0.34), 'dark')                              # forge mouth
    _P(sc, 'box', (-0.85, 0.16, 0.32), (0.38, 0.04, 0.2), 'meat')
    # open fire pit with bellows
    _P(sc, 'box', (0.55, -1.2, 0.3), (0.85, 0.55, 0.3), 'granite_dk', I3, 4)
    _P(sc, 'box', (0.55, -1.2, 0.62), (0.68, 0.4, 0.05), 'meat')
    for k in range(5):
        _P(sc, 'ell', (0.05 + k * 0.25, -1.2 + (k % 2) * 0.14 - 0.07, 0.7), (0.1, 0.09, 0.07), 'glow', I3, k)
    _P(sc, 'cone', (-0.6, -1.25, 0.3), (0.3, 0.35), 'leather', rot(0, 90, 0), 8)           # bellows
    _P(sc, 'box', (-0.2, -1.25, 0.3), (0.15, 0.1, 0.06), 'steel')
    # anvil with a hot blade
    _P(sc, 'box', (1.85, -0.2, 0.28), (0.3, 0.27, 0.28), 'granite_dk', I3, 6)
    _P(sc, 'box', (1.85, -0.2, 0.62), (0.52, 0.23, 0.1), 'steel', I3, 7)
    _P(sc, 'cone', (2.42, -0.2, 0.62), (0.13, 0.2), 'steel', rot(0, 90, 0))
    _P(sc, 'box', (1.75, -0.2, 0.76), (0.55, 0.06, 0.03), 'steel')                          # blade lying on it
    _P(sc, 'box', (2.15, -0.2, 0.76), (0.2, 0.06, 0.03), 'meat')                            # hot tip
    sc.add(between('cyl', (1.1, -0.55, 0.14), (1.65, -0.35, 0.14), (0.05,), 'bark', None, (0, 0, 1)))   # hammer
    _P(sc, 'box', (1.12, -0.55, 0.2), (0.14, 0.1, 0.1), 'steel', rot(0, 0, 25))
    # quench barrel + coal pile + weapon rack
    _P(sc, 'cyl', (1.95, -1.55, 0.38), (0.34, 0.38), 'bark', I3, 10)
    _P(sc, 'cyl', (1.95, -1.55, 0.76), (0.28, 0.03), 'water')
    for i, (x, y) in enumerate(((-1.9, -0.55), (-1.55, -0.8), (-2.05, -0.95), (-1.65, -0.35))):
        _P(sc, 'ell', (x, y, 0.15), (0.23, 0.2, 0.17), 'coal', I3, 20 + i)
    _P(sc, 'box', (-1.1, -2.1, 0.12), (0.9, 0.1, 0.12), 'plank')                            # rack with blades laid out
    for k in range(4):
        _P(sc, 'box', (-1.7 + k * 0.45, -1.95, 0.28), (0.04, 0.38, 0.03), 'steel')
        _P(sc, 'box', (-1.7 + k * 0.45, -1.52, 0.28), (0.12, 0.04, 0.04), 'gold')
    img = sc.render()
    fx.glint(img, 24, 24, 1)
    fx.glint(img, 41, 29, 1)
    return img


# ----------------------------------------------------------------- workshop: cogs, blueprint bench, XP orb
def workshop():
    sc = _scene()
    _P(sc, 'box', (-0.85, 1.1, 0.6), (1.4, 0.95, 0.6), 'plank', I3, 1, _planks(0.4, 0.12))   # house
    _roof(sc, -0.85, 1.1, 1.48, 1.1, 1.2, 0.6, 'coat', 'steel', 2, _shingles(0.3, 0.42, 0.22))
    _P(sc, 'box', (0.35, 1.45, 1.7), (0.22, 0.22, 0.5), 'granite', I3, 3)                   # chimney
    _P(sc, 'box', (-1.2, 0.2, 0.3), (0.3, 0.04, 0.28), 'door')
    _P(sc, 'ell', (0.35, 1.45, 2.7), (0.36, 0.36, 0.36), 'xp', I3, 20)                      # XP orb above the chimney
    _P(sc, 'ell', (0.28, 1.37, 2.82), (0.16, 0.14, 0.16), 'xp', I3, 21)
    # meshing cogs on the ground
    _gear(sc, 1.45, -0.55, 0.12, 0.72, 8)
    _gear(sc, 0.35, -0.95, 0.12, 0.42, 6, 'steel', 'gold', phase=0.3)
    # workbench with a blueprint, tools and parts
    _P(sc, 'box', (-1.2, -1.45, 0.3), (1.0, 0.45, 0.3), 'plank', I3, 8, _planks(0.35, 0.14))
    _P(sc, 'box', (-1.5, -1.42, 0.62), (0.45, 0.3, 0.02), 'cream')                          # rolled-out blueprint
    for k in range(3):
        _P(sc, 'box', (-1.5, -1.3 - k * 0.1 + 0.05, 0.64), (0.3, 0.012, 0.01), 'slate_blue')
    _P(sc, 'cyl', (-0.7, -1.45, 0.65), (0.14, 0.05), 'steel')                               # gear on the bench
    _P(sc, 'box', (-0.95, -1.7, 0.64), (0.3, 0.05, 0.04), 'steel', rot(0, 0, 18))           # saw / wrench
    _P(sc, 'box', (-0.35, -1.55, 0.66), (0.14, 0.1, 0.08), 'gold')
    # crate of spare parts, glowing crystals, scattered cogs
    _crate(sc, 2.0, -1.75, 0.4, 0.34, 0.22, 5)
    for i, (x, y) in enumerate(((1.9, -1.75), (2.1, -1.7))):
        _P(sc, 'ell', (x, y, 0.54), (0.12, 0.1, 0.15), 'xp', I3, 30 + i)
    _gear(sc, 0.55, -2.0, 0.06, 0.22, 6, 'gold', 'steel', h=0.05)
    _P(sc, 'cyl', (-2.1, -0.35, 0.28), (0.3, 0.28), 'bark', I3, 12)                         # oil barrel
    _P(sc, 'cyl', (-2.1, -0.35, 0.57), (0.24, 0.03), 'coal')
    img = sc.render()
    fx.glint(img, 28, 5, 2)
    return img


SPRITES = {
    'building_farm': farm, 'building_mine': mine, 'building_lumbermill': lumbermill,
    'building_market': market, 'building_blacksmith': blacksmith, 'building_workshop': workshop,
}
