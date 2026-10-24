"""Menu-button icons added for Settings (steel cog) and Legacy / Rebirth (golden sun round a purple orb)."""
import math
from render3d import Scene, Prim, rot, I3, place
from materials import MATS
import fx


def _facing(sc, prim):
    """Sprites that face the camera: the same -45 degree yaw the other menu icons use."""
    sc.add(place(prim, -45))


# ----------------------------------------------------------------- settings: an upright steel cog with a gold hub
def gear():
    sc = Scene(MATS, scale=13.0, origin=(20, 29))
    cz = 0.0
    R_BODY, R_TOOTH, TEETH = 0.82, 1.0, 8

    def A(kind, c, size, mat, R=I3, tex=None, seed=0):
        _facing(sc, Prim(kind, c, size, mat, R, tex, seed))

    A('cyl', (0, 0, cz), (R_BODY, 0.26), 'steel', rot(90, 0, 0), None, 1)                    # body
    for k in range(TEETH):
        a = 2 * math.pi * k / TEETH
        A('box', (R_TOOTH * 0.93 * math.cos(a), 0, cz + R_TOOTH * 0.93 * math.sin(a)),
          (0.2, 0.26, 0.2), 'steel', rot(0, -math.degrees(a), 0), None, 3 + k)              # teeth
    A('cyl', (0, -0.1, cz), (0.62, 0.2), 'steel', rot(90, 0, 0), None, 20)                   # raised face
    A('cyl', (0, -0.3, cz), (0.34, 0.06), 'dark', rot(90, 0, 0))                             # socket
    A('cyl', (0, -0.36, cz), (0.22, 0.07), 'gold', rot(90, 0, 0))                            # gold hub
    for k in range(4):                                                                         # rivets
        a = math.pi / 4 + k * math.pi / 2
        A('ell', (0.47 * math.cos(a), -0.3, cz + 0.47 * math.sin(a)), (0.07, 0.05, 0.07), 'gold')
    img = sc.render()
    fx.glint(img, 13, 11, 1)
    return img


# ----------------------------------------------------------------- legacy: a gold sun (rays) around a purple orb
def legacy():
    sc = Scene(MATS, scale=13.0, origin=(20, 29))
    cz = 0.0

    def A(kind, c, size, mat, R=I3, tex=None, seed=0):
        _facing(sc, Prim(kind, c, size, mat, R, tex, seed))

    A('cyl', (0, 0, cz), (0.78, 0.2), 'gold', rot(90, 0, 0), None, 1)                         # sun disc
    for k in range(8):
        a = 2 * math.pi * k / 8
        long_ray = k % 2 == 0
        reach = 1.12 if long_ray else 0.98
        A('box', (reach * 0.9 * math.cos(a), 0, cz + reach * 0.9 * math.sin(a)),
          ((0.3 if long_ray else 0.22), 0.14, 0.13), 'gold', rot(0, -math.degrees(a), 0), None, 5 + k)   # rays
    A('cyl', (0, -0.1, cz), (0.56, 0.16), 'gold', rot(90, 0, 0), None, 30)                    # inner ring
    A('ell', (0, -0.3, cz), (0.42, 0.34, 0.42), 'xp', I3, None, 40)                            # purple orb
    A('ell', (-0.1, -0.52, cz + 0.12), (0.1, 0.05, 0.1), 'gold')                               # glint seed
    img = sc.render()
    fx.glint(img, 12, 10, 2)
    return img


# ----------------------------------------------------------------- main menu: a maroon journal with a gold sigil and an orb
def journal():
    sc = Scene(MATS, scale=13.5, origin=(20, 37))
    A = lambda *a: sc.add(Prim(*a))
    A('box', (0.05, 0.0, 1.05), (0.74, 0.21, 0.98), 'cream', I3, None, 1)                  # page block
    for z in (0.35, 0.62, 0.9, 1.18, 1.45, 1.72):                                          # page edges
        A('box', (0.82, 0.0, z), (0.015, 0.2, 0.012), 'tunic')
    A('box', (0.0, 0.21, 1.05), (0.82, 0.07, 1.05), 'cloth', I3, None, 2)                  # back cover
    A('box', (0.0, -0.21, 1.05), (0.82, 0.07, 1.05), 'cloth', I3, None, 3)                 # front cover
    A('box', (-0.8, 0.0, 1.05), (0.08, 0.3, 1.07), 'barn', I3, None, 4)                    # spine
    for z in (0.42, 0.75, 1.35, 1.68):
        A('box', (-0.86, 0.0, z), (0.035, 0.31, 0.055), 'gold')                            # spine bands
    for sx, z in ((0.76, 0.1), (0.76, 2.0), (-0.34, 0.1), (-0.34, 2.0)):                  # corner guards
        A('box', (sx, -0.27, z), (0.11, 0.035, 0.11), 'gold')
        A('cyl', (0.05, -0.28, 1.05), (0.46, 0.03), 'gold', rot(90, 0, 0), None, 6)            # sigil ring
    A('cyl', (0.05, -0.31, 1.05), (0.36, 0.03), 'dark', rot(90, 0, 0))
    A('ell', (0.05, -0.34, 1.05), (0.27, 0.06, 0.27), 'xp', I3, None, 7)                   # the purple orb
    A('ell', (-0.08, -0.4, 1.16), (0.06, 0.025, 0.06), 'gold')                             # glint seed
    A('box', (0.55, 0.0, -0.02), (0.05, 0.05, 0.3), 'gold')                                # bookmark tassel
    img = sc.render()
    fx.glint(img, 24, 9, 2)
    return img


# ----------------------------------------------------------------- stats: three rising bars on a stone plinth
def bars():
    sc = Scene(MATS, scale=11.0, origin=(20, 35))
    A = lambda *a: sc.add(Prim(*a))
    A('box', (0, 0, 0.1), (1.35, 0.62, 0.1), 'stone', I3, None, 1)                          # plinth
    A('box', (0, -0.62, 0.16), (1.38, 0.03, 0.05), 'granite')
    for x, h, mat, seed in ((-0.88, 0.42, 'coat', 2), (0.0, 0.75, 'gold', 3), (0.88, 1.08, 'xp', 4)):
        A('box', (x, 0, 0.2 + h), (0.36, 0.38, h), mat, I3, None, seed)                      # bar
        A('box', (x, -0.38, 0.2 + h * 1.86 - 0.02), (0.38, 0.02, 0.04), 'cream')              # lit cap edge
    A('ell', (0.88, -0.45, 2.3), (0.12, 0.05, 0.12), 'cream')                                  # glint seed
    img = sc.render()
    fx.glint(img, 28, 9, 2)
    return img


SPRITES = {'menu_settings': gear, 'menu_legacy': legacy, 'menu_main': journal, 'menu_stats': bars}
