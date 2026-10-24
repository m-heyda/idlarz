"""Map sprites: one icon per biome (32x32), the bonus treasure chest (24x24) and the XP orb (40x40).
Same ray-cast look as the rest of the set, just smaller canvases for the 48px map tiles."""
import math
from render3d import Scene, Prim, rot, vnoise, between, I3
from materials import MATS
from sprites_resources import coin_tex
import fx


def _scene(scale, origin, size=32):
    return Scene(MATS, size=size, scale=scale, origin=origin)


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _pine(sc, x, y, h=1.0, mat='pine', seed=0):
    """Layered fir: trunk + three cones."""
    _P(sc, 'cyl', (x, y, 0.28 * h), (0.11 * h, 0.28 * h), 'bark', I3, None, seed)
    for i, (r, hh, z) in enumerate(((0.78, 0.44, 0.72), (0.6, 0.4, 1.12), (0.42, 0.36, 1.5))):
        _P(sc, 'cone', (x, y, z * h), (r * h, hh * h), mat, I3, None, seed + i)


# ----------------------------------------------------------------- biomes
def forest():
    sc = _scene(10.0, (16, 24))
    _pine(sc, -0.55, 0.45, 0.85, seed=1)
    _pine(sc, 0.65, 0.1, 0.95, seed=4)
    _pine(sc, -0.05, -0.65, 1.1, seed=7)
    img = sc.render()
    return img


def plains():
    sc = _scene(9.4, (16, 24))
    for i, (x, y, h) in enumerate(((-0.7, 0.3, 1.5), (-0.3, -0.2, 1.9), (0.1, 0.35, 1.7), (0.5, -0.1, 2.0),
                                    (0.85, 0.3, 1.45), (-0.05, -0.6, 1.3))):
        _P(sc, 'cyl', (x, y, h / 2), (0.09, h / 2), 'grass', I3, None, i)
        _P(sc, 'ell', (x, y, h + 0.1), (0.14, 0.14, 0.42), 'wheat', I3, None, i)
        _P(sc, 'cone', (x, y, h + 0.62), (0.05, 0.2), 'wheat', I3, None, i)
    for i, (x, y, mat) in enumerate(((-0.95, -0.35, 'blossom'), (0.35, -0.7, 'ruby'))):
        _P(sc, 'cyl', (x, y, 0.35), (0.04, 0.35), 'grass')
        _P(sc, 'ell', (x, y, 0.8), (0.17, 0.17, 0.12), mat)
        _P(sc, 'ell', (x, y, 0.85), (0.07, 0.07, 0.07), 'gold')
    _P(sc, 'ell', (0.0, 0.0, 0.1), (1.35, 1.0, 0.16), 'grass', I3, None, 9)
    return sc.render()


def hills():
    sc = _scene(9.0, (16, 24))
    _P(sc, 'cone', (-0.25, 0.1, 1.0), (1.15, 1.0), 'granite_dk', rot(0, 0, 25), None, 1)
    _P(sc, 'cone', (0.2, 0.9, 1.0 * 0.65), (0.85, 0.65), 'granite_dk', rot(0, 0, 70), None, 2)
    _P(sc, 'cone', (-0.25, 0.1, 1.5), (0.52, 0.5), 'snow', rot(0, 0, 25), None, 3)       # snow cap
    _P(sc, 'ell', (0.85, -0.55, 0.28), (0.4, 0.35, 0.28), 'granite', I3, None, 4)         # boulders
    _P(sc, 'ell', (-0.9, -0.5, 0.2), (0.3, 0.26, 0.2), 'granite', I3, None, 5)
    return sc.render()


def swamp():
    sc = _scene(9.4, (16, 24))
    _P(sc, 'cyl', (0, 0.05, 0.1), (1.35, 0.1), 'swamp_water', I3, None, 1)                 # murky pool
    _P(sc, 'cyl', (-0.35, -0.3, 0.24), (0.5, 0.05), 'lily', I3, None, 2)                   # lily pad
    _P(sc, 'ell', (-0.3, -0.35, 0.36), (0.15, 0.15, 0.1), 'blossom')
    _P(sc, 'cyl', (0.45, -0.5, 0.24), (0.34, 0.05), 'lily', I3, None, 3)
    for i, (x, y, h) in enumerate(((0.55, 0.55, 1.7), (0.95, 0.15, 1.4), (-0.7, 0.6, 1.55), (0.2, 0.8, 1.2))):
        _P(sc, 'cyl', (x, y, h / 2), (0.1, h / 2), 'reed', I3, None, i)
        _P(sc, 'ell', (x, y, h + 0.05), (0.11, 0.11, 0.32), 'cattail', I3, None, i)
    return sc.render()


def tundra():
    sc = _scene(9.4, (16, 24))
    _P(sc, 'ell', (0, 0.1, 0.12), (1.35, 1.0, 0.2), 'snow', I3, None, 1)                   # snow drift
    for i, (x, y, h, rx, rz) in enumerate(((0.1, 0.1, 1.6, 20, 10), (-0.7, -0.1, 1.15, -15, 25), (0.8, 0.45, 1.0, 18, -20), (0.45, -0.7, 0.7, -10, 40))):
        _P(sc, 'box', (x, y, 0.2 + h / 2), (0.28, 0.26, h / 2), 'ice', rot(rx, 0, rz), None, i)     # crystals
        _P(sc, 'cone', (x, y, 0.2 + h + 0.2), (0.28, 0.22), 'ice', rot(rx, 0, rz), None, i + 5)
    _P(sc, 'ell', (0.55, -0.55, 0.22), (0.3, 0.25, 0.2), 'snow')
    return sc.render()


def lake():
    sc = _scene(9.4, (16, 24))
    _P(sc, 'cyl', (0, 0, 0.06), (1.55, 0.06), 'sand', I3, None, 1)                          # shore
    _P(sc, 'cyl', (0, 0, 0.16), (1.2, 0.1), 'water', I3, None, 2)                           # water
    _P(sc, 'cyl', (0.35, -0.2, 0.28), (0.34, 0.04), 'lily', I3, None, 3)
    _P(sc, 'ell', (0.35, -0.2, 0.36), (0.1, 0.1, 0.08), 'blossom')
    for i, (x, y, h) in enumerate(((-0.95, 0.75, 1.3), (-0.7, 0.95, 1.0), (1.0, 0.7, 1.15))):
        _P(sc, 'cyl', (x, y, h / 2), (0.1, h / 2), 'reed', I3, None, i)
        _P(sc, 'ell', (x, y, h + 0.04), (0.1, 0.1, 0.28), 'cattail', I3, None, i)
    img = sc.render()
    fx.glint(img, 12, 14, 1)
    return img


def coast():
    """A sandy beach: a leaning palm, driftwood, shells and a starfish."""
    sc = _scene(8.2, (16, 26))
    _P(sc, 'cyl', (0, 0, 0.06), (1.55, 0.06), 'sand', I3, None, 1)                          # beach
    _P(sc, 'ell', (-0.15, 0.2, 0.14), (1.1, 0.8, 0.2), 'sand', I3, None, 2)                  # dune
    for i, (z, dx) in enumerate(((0.45, 0.0), (0.95, 0.07), (1.45, 0.16), (1.9, 0.28))):    # curved palm trunk
        _P(sc, 'cyl', (-0.35 + dx, -0.25, z), (0.13 - i * 0.012, 0.28), 'bark', rot(0, -8 - 4 * i, 0), None, 10 + i)
    top = (-0.07, -0.25, 2.18)
    for i, (dx, dy, rx, rz) in enumerate(((0.55, 0.0, 0, 25), (-0.5, 0.05, 0, -25), (0.0, 0.55, 25, 0),
                                          (0.0, -0.55, -25, 0), (0.4, 0.4, 20, 15), (-0.4, -0.4, -20, -15))):
        _P(sc, 'ell', (top[0] + dx, top[1] + dy, top[2] - 0.12), (0.5, 0.2, 0.07), 'grass', rot(rx, rz, 0), None, 20 + i)
    _P(sc, 'ell', (top[0], top[1], top[2] - 0.05), (0.14, 0.14, 0.14), 'bark', I3, None, 30)  # coconuts
    _P(sc, 'cyl', (0.65, 0.55, 0.2), (0.12, 0.55), 'plank', rot(0, 80, 25), None, 31)        # driftwood
    for i, (x, y) in enumerate(((0.3, 0.9), (0.95, 0.15), (-0.8, 0.7))):                      # shells
        _P(sc, 'ell', (x, y, 0.2), (0.16, 0.16, 0.1), 'cream' if i % 2 else 'blossom', I3, None, 40 + i)
    img = sc.render()
    fx.glint(img, 24, 20, 1)
    return img


def grounds():
    sc = _scene(9.4, (16, 24))
    _P(sc, 'box', (0, 0, 0.12), (1.3, 0.95, 0.12), 'soil', rot(0, 0, 0), None, 1)           # tilled plot
    for i in range(3):                                                                      # furrows + sprouts
        _P(sc, 'box', (0, -0.55 + i * 0.55, 0.28), (1.15, 0.12, 0.07), 'soil', I3, None, 10 + i)
        for j in range(4):
            _P(sc, 'cone', (-0.8 + j * 0.5, -0.55 + i * 0.55, 0.5), (0.09, 0.16), 'grass', I3, None, 30 + i * 4 + j)
    for sx in (-1, 1):                                                                       # stakes + string
        _P(sc, 'cyl', (1.15 * sx, -0.85, 0.7), (0.07, 0.6), 'bark', I3, None, 5)
    sc.add(between('cyl', (-1.15, -0.85, 1.05), (1.15, -0.85, 1.05), (0.025,), 'cream', None, (0, 0, 1)))
    _P(sc, 'cyl', (0.55, 0.45, 0.85), (0.06, 0.75), 'bark', rot(0, 12, 0), None, 6)           # shovel
    _P(sc, 'box', (0.55 + 0.17, 0.45, 0.18), (0.2, 0.05, 0.26), 'steel', rot(0, 12, 0), None, 7)
    return sc.render()


# ----------------------------------------------------------------- bonus treasure chest (24x24)
def bonus_chest():
    """Deliberately plain: wooden box, round lid, two iron straps, gold lock, and a hard black outline so it reads
    at a glance on any ground."""
    sc = Scene(MATS, size=24, scale=6.6, origin=(12, 17), yaw=14.0, pitch=28.0, dither=0.0)
    _P(sc, 'box', (0, 0, 0.45), (1.2, 0.75, 0.45), 'leather', I3, None, 1)                    # body
    _P(sc, 'cyl', (0, 0, 0.9), (0.75, 1.2), 'pleather', rot(0, 90, 0), None, 2)               # round lid (axis along x)
    for sx in (-0.7, 0.7):                                                                      # iron straps
        _P(sc, 'box', (sx, 0, 0.45), (0.16, 0.8, 0.47), 'steel', I3, None, 3)
        _P(sc, 'cyl', (sx, 0, 0.9), (0.8, 0.16), 'steel', rot(0, 90, 0), None, 4)
    _P(sc, 'box', (0, -0.78, 0.8), (0.3, 0.06, 0.32), 'glow')                                    # gold lock
    img = sc.render(outline=False)
    # hard black outline round the whole silhouette
    w, h = img.size
    px = img.load()
    edge = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] == 0 and any(
        0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        px[x, y] = (8, 5, 4, 255)
    return img


# ----------------------------------------------------------------- XP orb (40x40): the same purple glass orb as the level badge
def xp_orb():
    from PIL import Image
    from sprites_props import orb_base
    orb = orb_base(30, dark_core=False)
    img = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    img.alpha_composite(orb, (5, 6))
    fx.glint(img, 13, 14, 3)
    fx.glint(img, 33, 8, 1)
    fx.glint(img, 8, 33, 1)
    return img


# ----------------------------------------------------------------- "?" mark for unexplored land (12x16)
def unknown_mark():
    import terrain_art
    return terrain_art.unknown_mark()


SPRITES = {
    'unknown': unknown_mark,
    'biome_forest': forest, 'biome_plains': plains, 'biome_hills': hills, 'biome_swamp': swamp,
    'biome_tundra': tundra, 'biome_lake': lake, 'biome_coast': coast, 'biome_grounds': grounds,
    'bonus_chest': bonus_chest, 'xp': xp_orb,
}
