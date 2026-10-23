"""Grounds-tile buildings (48x48): farm, mine, lumber mill, market, blacksmith, workshop.
Seen from above like the castle, each fills its whole map tile. Each is both the picker icon and the tile graphic
once a grounds tile is converted."""
import math
from render3d import Scene, Prim, rot, between, I3
from materials import MATS
import fx

SIZE = 48
CAM = dict(yaw=0.0, pitch=78.0)        # looking almost straight down; front faces show as a thin strip


def _scene():
    return Scene(MATS, size=SIZE, scale=9.8, origin=(24, 25), **CAM)


def _P(sc, kind, c, size, mat, R=I3, seed=0):
    sc.add(Prim(kind, c, size, mat, R, None, seed))


def _roof(sc, cx, cy, hx, hy, base_z, rise, mat, ridge='cream', seed=0):
    """Gable roof with the ridge along x: two sloped slabs meeting in a ridge beam."""
    ang = math.degrees(math.atan2(rise, hy))
    half = math.hypot(hy, rise) / 2
    for s in (-1, 1):
        _P(sc, 'box', (cx, cy + s * hy / 2, base_z + rise / 2), (hx, half, 0.06), mat, rot(-s * ang, 0, 0), seed + s)
    _P(sc, 'box', (cx, cy, base_z + rise), (hx, 0.06, 0.06), ridge)


def _gear(sc, x, y, z, r, teeth, mat='gold', hub='steel', h=0.08):
    """Cog lying flat on the ground."""
    _P(sc, 'cyl', (x, y, z), (r, h), mat)
    for k in range(teeth):
        a = 2 * math.pi * k / teeth
        _P(sc, 'box', (x + math.cos(a) * (r + 0.06), y + math.sin(a) * (r + 0.06), z),
           (0.12, 0.12, h), mat, rot(0, 0, math.degrees(a)))
    _P(sc, 'cyl', (x, y, z + h), (r * 0.28, 0.04), hub)


# ----------------------------------------------------------------- farm: thatched cottage, haystack, crops
def farm():
    sc = _scene()
    _P(sc, 'box', (-0.75, 0.95, 0.45), (1.2, 0.9, 0.45), 'cream', I3, 1)                    # cottage walls
    _roof(sc, -0.75, 0.95, 1.28, 1.05, 0.9, 0.6, 'thatch', 'thatch', 2)
    _P(sc, 'box', (-0.3, 0.04, 0.3), (0.2, 0.04, 0.28), 'door')                             # door
    _P(sc, 'box', (-1.3, 0.04, 0.5), (0.16, 0.04, 0.14), 'dark')                            # window
    _P(sc, 'box', (0.1, 1.3, 1.45), (0.17, 0.17, 0.3), 'granite', I3, 3)                    # chimney
    _P(sc, 'cone', (1.6, 1.25, 0.6), (0.72, 0.6), 'wheat', I3, 4)                           # haystack
    _P(sc, 'ell', (1.6, 1.25, 1.22), (0.1, 0.1, 0.1), 'wheat')
    for row, y in enumerate((-0.95, -1.7)):                                                  # crop rows
        _P(sc, 'box', (-0.5, y, 0.07), (1.7, 0.22, 0.07), 'soil', I3, 10 + row)
        for i in range(6):
            _P(sc, 'ell', (-1.9 + i * 0.7, y, 0.28), (0.2, 0.2, 0.24), 'grass', I3, 20 + row * 6 + i)
    _P(sc, 'ell', (1.5, -0.95, 0.3), (0.3, 0.3, 0.26), 'cloth', I3, 40)                     # pumpkin
    _P(sc, 'ell', (1.65, -1.75, 0.3), (0.26, 0.26, 0.22), 'cloth', I3, 41)
    return sc.render()


# ----------------------------------------------------------------- mine: rock face, timbered tunnel, cart
def mine():
    sc = _scene()
    _P(sc, 'ell', (0.0, 1.15, 0.45), (2.2, 1.25, 0.85), 'granite_dk', I3, 1)                # rock mass
    for i, (x, y, z, rx, ry, rz) in enumerate(((-1.6, 1.6, 0.35, 0.65, 0.55, 0.5), (1.75, 1.5, 0.35, 0.6, 0.5, 0.5),
                                               (0.5, 1.75, 0.9, 0.55, 0.42, 0.4), (-0.6, 1.2, 0.95, 0.5, 0.4, 0.35),
                                               (1.2, 0.85, 0.7, 0.4, 0.32, 0.3))):
        _P(sc, 'ell', (x, y, z), (rx, ry, rz), 'granite', I3, 2 + i)
    _P(sc, 'box', (0.0, -0.35, 0.04), (0.62, 0.75, 0.03), 'dark')                           # shaft floor in the open mouth
    for sx in (-1, 1):
        _P(sc, 'box', (0.74 * sx, -0.3, 0.55), (0.1, 0.12, 0.6), 'bark', I3, 5)             # timber frame
        _P(sc, 'box', (0.74 * sx, -0.95, 0.4), (0.1, 0.12, 0.45), 'bark', I3, 6)
    for y in (-0.25, -0.95):
        _P(sc, 'box', (0.0, y, 1.1 if y > -0.5 else 0.88), (0.9, 0.1, 0.09), 'bark', I3, 7)   # cross beams
    _P(sc, 'ell', (0.0, -0.3, 0.95), (0.08, 0.08, 0.08), 'glow')                           # lantern
    for sx in (-0.2, 0.2):                                                                    # rails
        _P(sc, 'box', (sx, -1.5, 0.05), (0.04, 1.0, 0.04), 'steel')
    for k in range(6):
        _P(sc, 'box', (0.0, -0.6 - k * 0.3, 0.02), (0.32, 0.05, 0.03), 'bark')
    _P(sc, 'box', (0.0, -1.65, 0.32), (0.42, 0.34, 0.2), 'steel', I3, 7)                    # cart
    _P(sc, 'box', (0.0, -1.65, 0.5), (0.45, 0.37, 0.05), 'bark')
    for i, (x, y) in enumerate(((-0.12, -1.6), (0.14, -1.75), (0.05, -1.5))):                # coal load
        _P(sc, 'ell', (x, y, 0.6), (0.17, 0.16, 0.14), 'coal', I3, 30 + i)
    sc.add(between('cyl', (-1.9, -1.7, 0.1), (-1.1, -1.2, 0.1), (0.05,), 'bark', None, (0, 0, 1)))   # pickaxe
    _P(sc, 'box', (-1.15, -1.23, 0.14), (0.3, 0.05, 0.05), 'steel', rot(0, 0, 30))
    for i, (x, y) in enumerate(((1.4, -0.7), (1.9, -1.3), (1.3, -1.7))):                     # spilled ore
        _P(sc, 'ell', (x, y, 0.15), (0.2, 0.18, 0.15), 'coal', I3, 50 + i)
    img = sc.render()
    fx.glint(img, 20, 10, 1)
    return img


# ----------------------------------------------------------------- lumber mill: shed, saw bench, log pile
def lumbermill():
    sc = _scene()
    _P(sc, 'box', (-0.65, 0.95, 0.55), (1.35, 0.95, 0.55), 'bark', I3, 1)                   # shed
    _roof(sc, -0.65, 0.95, 1.42, 1.1, 1.1, 0.7, 'plank', 'wood_cut', 2)
    _P(sc, 'box', (-0.65, 0.04, 0.34), (0.3, 0.04, 0.32), 'door')
    for i, (x, y, z) in enumerate(((1.5, 0.95, 0.27), (2.0, 0.95, 0.27), (1.75, 0.95, 0.7))):   # log pile (logs run along y)
        _P(sc, 'cyl', (x, y, z), (0.27, 1.05), 'bark', rot(90, 0, 0), i)
    _P(sc, 'box', (-0.7, -1.35, 0.3), (1.0, 0.5, 0.3), 'plank', I3, 8)                      # saw bench
    _P(sc, 'cyl', (-0.7, -1.35, 0.64), (0.5, 0.03), 'steel')                                 # circular saw, lying flat
    for k in range(10):
        a = math.radians(k * 36)
        _P(sc, 'box', (-0.7 + 0.53 * math.cos(a), -1.35 + 0.53 * math.sin(a), 0.64), (0.07, 0.04, 0.03), 'steel', rot(0, 0, k * 36))
    _P(sc, 'cyl', (-0.7, -1.35, 0.68), (0.1, 0.03), 'gold')
    _P(sc, 'cyl', (1.5, -1.5, 0.22), (0.38, 0.22), 'wood_cut', I3, 9)                       # stump + axe
    sc.add(between('cyl', (1.7, -1.7, 0.5), (1.95, -1.1, 0.5), (0.04,), 'bark', None, (0, 0, 1)))
    _P(sc, 'box', (1.52, -1.5, 0.5), (0.07, 0.17, 0.1), 'steel', rot(0, 0, 25))
    _P(sc, 'box', (0.85, -0.85, 0.08), (0.25, 0.12, 0.05), 'wood_cut', rot(0, 0, 20))       # scrap planks
    return sc.render()


# ----------------------------------------------------------------- market: striped stall, crates, coins
def market():
    sc = _scene()
    _P(sc, 'box', (0, 0.55, 0.42), (1.85, 0.7, 0.42), 'plank', I3, 1)                       # counter
    for sx in (-1.85, 1.85):                                                                  # front posts
        _P(sc, 'cyl', (sx, -0.25, 0.8), (0.08, 0.8), 'bark', I3, 2)
    for i in range(8):                                                                        # striped awning, seen from above
        _P(sc, 'box', (-1.575 + i * 0.45, 0.6, 1.62), (0.225, 1.05, 0.05),
           'cloth' if i % 2 == 0 else 'cream', rot(10, 0, 0))
    for i in range(8):
        _P(sc, 'box', (-1.575 + i * 0.45, -0.38, 1.45), (0.225, 0.07, 0.2), 'cloth' if i % 2 == 0 else 'cream')   # valance
    for sx, mat in ((-1.45, 'ruby'), (-0.15, 'grass'), (1.25, 'cloth')):                      # fruit crates
        _P(sc, 'box', (sx, -1.5, 0.22), (0.55, 0.42, 0.22), 'plank', I3, int(sx * 7))
        for j in range(5):
            a = j * 1.26
            _P(sc, 'ell', (sx + 0.22 * math.cos(a), -1.5 + 0.17 * math.sin(a), 0.5), (0.17, 0.17, 0.15), mat, I3, 5 + j)
    _P(sc, 'cyl', (2.0, -1.35, 0.4), (0.34, 0.4), 'bark', I3, 20)                            # barrel with coins
    for k in range(4):
        _P(sc, 'cyl', (2.0, -1.35, 0.85 + k * 0.1), (0.2, 0.05), 'gold', I3, 12 + k)
    img = sc.render()
    fx.glint(img, 42, 31, 1)
    return img


# ----------------------------------------------------------------- blacksmith: stone forge, anvil, smoke
def blacksmith():
    sc = _scene()
    _P(sc, 'box', (-0.75, 0.95, 0.7), (1.35, 0.95, 0.7), 'granite', I3, 1)                  # forge house
    _roof(sc, -0.75, 0.95, 1.42, 1.1, 1.4, 0.6, 'slate_blue', 'steel', 2)
    _P(sc, 'box', (0.3, 1.3, 1.9), (0.3, 0.3, 0.7), 'granite_dk', I3, 3)                    # chimney
    for i, (x, y, z, r) in enumerate(((0.35, 1.35, 3.0, 0.3), (0.55, 1.45, 3.7, 0.38), (0.8, 1.6, 4.4, 0.42))):   # smoke
        _P(sc, 'ell', (x, y, z), (r, r, r * 0.8), 'smoke', I3, 40 + i)
    _P(sc, 'box', (-0.75, 0.05, 0.4), (0.5, 0.05, 0.34), 'dark')                             # forge mouth
    _P(sc, 'box', (-0.75, 0.02, 0.32), (0.38, 0.04, 0.2), 'meat')
    _P(sc, 'box', (0.3, -1.25, 0.3), (0.8, 0.55, 0.3), 'granite_dk', I3, 4)                  # fire pit
    _P(sc, 'box', (0.3, -1.25, 0.62), (0.62, 0.4, 0.05), 'meat')                            # glowing coals
    for k in range(4):
        _P(sc, 'ell', (0.0 + k * 0.2, -1.25 + (k % 2) * 0.14 - 0.07, 0.7), (0.1, 0.09, 0.07), 'glow', I3, k)
    _P(sc, 'box', (1.85, -0.9, 0.28), (0.3, 0.27, 0.28), 'granite_dk', I3, 6)                # anvil
    _P(sc, 'box', (1.85, -0.9, 0.62), (0.5, 0.22, 0.1), 'steel', I3, 7)
    _P(sc, 'cone', (2.4, -0.9, 0.62), (0.13, 0.2), 'steel', rot(0, 90, 0))
    sc.add(between('cyl', (-1.9, -1.7, 0.1), (-1.0, -1.3, 0.1), (0.05,), 'bark', None, (0, 0, 1)))   # hammer
    _P(sc, 'box', (-1.0, -1.3, 0.16), (0.16, 0.1, 0.1), 'steel', rot(0, 0, 25))
    img = sc.render()
    fx.glint(img, 24, 24, 1)
    return img


# ----------------------------------------------------------------- workshop: gear house, XP orb
def workshop():
    sc = _scene()
    _P(sc, 'box', (-0.75, 0.95, 0.6), (1.35, 0.95, 0.6), 'plank', I3, 1)                    # house
    _roof(sc, -0.75, 0.95, 1.42, 1.1, 1.2, 0.6, 'slate_blue', 'steel', 2)
    _P(sc, 'box', (0.35, 1.3, 1.7), (0.22, 0.22, 0.5), 'granite', I3, 3)                    # chimney
    _P(sc, 'box', (-1.2, 0.04, 0.3), (0.3, 0.04, 0.28), 'door')
    _P(sc, 'ell', (0.35, 1.3, 2.7), (0.36, 0.36, 0.36), 'xp', I3, 20)                       # XP orb above the chimney
    _P(sc, 'ell', (0.28, 1.22, 2.82), (0.16, 0.14, 0.16), 'xp', I3, 21)
    _gear(sc, 1.35, -1.05, 0.12, 0.8, 8)                                                      # big cog on the ground
    _P(sc, 'box', (-1.15, -1.5, 0.3), (0.85, 0.4, 0.3), 'plank', I3, 8)                     # workbench
    _P(sc, 'cyl', (-0.9, -1.5, 0.66), (0.14, 0.05), 'steel')
    _P(sc, 'box', (-1.5, -1.45, 0.66), (0.22, 0.1, 0.05), 'steel', rot(0, 0, 20))
    img = sc.render()
    fx.glint(img, 28, 5, 2)
    return img


SPRITES = {
    'building_farm': farm, 'building_mine': mine, 'building_lumbermill': lumbermill,
    'building_market': market, 'building_blacksmith': blacksmith, 'building_workshop': workshop,
}
