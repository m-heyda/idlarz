"""Character art: the four hero classes (warrior/paladin/ranger/mage).

Each figure is built from the same body kit (legs, torso, arms, head with a proper face, hair) and dressed per
class, rendered by the ray-caster at 56x80 plus a head-and-shoulders bust (40x40) for the header.
Figure space: +x = screen right, -y = toward the camera, +z = up; feet at z=0, head centre at HEAD_Z."""
import math
from render3d import Scene, Prim, rot, between, place, I3
from materials import MATS
import fx

FULL = dict(size=(56, 80), scale=12.2, origin=(28, 76))
BUST = dict(size=(40, 40), scale=14.6, origin=(20, 86))
HEAD_Z = 5.2


class Fig:
    """Adds primitives in figure space, turned to face the camera."""

    def __init__(self, view):
        self.view = view
        self.sc = Scene(MATS, **view)

    def a(self, kind, c, size, mat, R=I3, tex=None, seed=0):
        self.sc.add(place(Prim(kind, c, size, mat, R, tex, seed), -45))

    def ell(self, c, size, mat, R=I3, seed=0, tex=None):
        self.a('ell', c, size, mat, R, tex, seed)

    def box(self, c, size, mat, R=I3, seed=0):
        self.a('box', c, size, mat, R, None, seed)

    def cyl(self, c, r, h, mat, R=I3, seed=0, tex=None):
        self.a('cyl', c, (r, h), mat, R, tex, seed)

    def limb(self, p0, p1, r, mat, seed=0, kind='cyl'):
        radii = (r,) if kind == 'cyl' else (r, r)
        self.sc.add(place(between(kind, p0, p1, radii, mat, None, (0, 0, 1), seed), -45))

    def rod(self, p0, p1, r, mat, seed=0):
        """A round limb with ball ends, so joints never show flat caps."""
        self.limb(p0, p1, r, mat, seed)
        self.ell(p0, (r, r, r), mat, I3, seed)
        self.ell(p1, (r, r, r), mat, I3, seed)

    def render(self):
        return self.sc.render()


def strands(pl, nl, pr):
    """Hair: light/dark streaks running from the crown down, so hair reads as hair and not a cap."""
    a = math.atan2(pl[1], pl[0])
    v = math.sin(a * 9 + pl[2] * 2.2 + pr.seed) * 0.5 + math.sin(a * 17 - pl[2] * 3.1) * 0.25
    return None, v * 0.2


# ----------------------------------------------------------------- shared body parts
def legs(f, trouser, boot, cuff='pleather'):
    for sx in (-1, 1):
        x = 0.33 * sx
        f.rod((x, 0, 2.95), (x * 1.05, 0, 1.2), 0.24, trouser, 2)
        f.ell((x, -0.14, 0.3), (0.29, 0.54, 0.28), boot, I3, 6)                  # boot foot
        f.cyl((x, 0, 0.86), 0.27, 0.3, boot, I3, 7)                              # boot shaft
        f.cyl((x, 0, 1.14), 0.3, 0.05, cuff, I3, 8)                              # cuff


def torso(f, shirt, z=3.65):
    f.ell((0, 0, 2.95), (0.64, 0.45, 0.4), shirt, I3, 7)                         # hips
    f.ell((0, 0, z), (0.76, 0.5, 0.85), shirt, I3, 8)                            # chest
    f.cyl((0, 0, 4.5), 0.3, 0.12, 'skin' if shirt != 'robe' else 'skin_dk', I3, 9)   # neck


def head(f, skin='skin', hair='hair', ear='round', eye='dark', white='cream', brow=None, z=HEAD_Z):
    """Big expressive head: skull, jaw, nose, eyes with whites + pupils, brows, mouth, ears."""
    f.ell((0, 0.02, z), (0.68, 0.62, 0.7), skin)
    f.ell((0, -0.1, z - 0.38), (0.52, 0.5, 0.4), skin)                          # jaw / cheeks
    f.ell((0, -0.64, z - 0.12), (0.11, 0.12, 0.13), skin)                        # nose
    f.ell((0, -0.56, z - 0.4), (0.15, 0.07, 0.03), 'dark')                       # mouth
    for sx in (-1, 1):
        f.ell((0.26 * sx, -0.54, z + 0.02), (0.13, 0.06, 0.11), white)           # eye white
        f.ell((0.27 * sx, -0.59, z + 0.01), (0.075, 0.03, 0.095), eye)           # pupil
        f.ell((0.27 * sx, -0.54, z + 0.25), (0.17, 0.05, 0.03), brow or hair, rot(0, 4 * sx, 0), 30)
    if ear == 'round':
        for sx in (-1, 1):
            f.ell((0.67 * sx, 0.02, z - 0.06), (0.08, 0.11, 0.17), skin)
    else:
        for sx in (-1, 1):                                                       # long, pointed elf ears
            f.ell((0.93 * sx, 0.05, z + 0.16), (0.38, 0.07, 0.11), skin, rot(0, -26 * sx, 0), 32)
            f.ell((0.64 * sx, 0.02, z - 0.04), (0.09, 0.1, 0.17), skin)


def hair_short(f, mat, z=HEAD_Z):
    f.ell((0, 0.14, z + 0.16), (0.74, 0.68, 0.66), mat, I3, 17, strands)
    f.ell((0, -0.38, z + 0.4), (0.6, 0.28, 0.2), mat, rot(10, 0, 0), 19, strands)   # fringe
    for k, sx in enumerate((-1, 1, -1, 1)):                                            # swept locks over the brow
        f.ell(((0.18 + 0.2 * (k // 2)) * sx, -0.5, z + 0.34 - 0.05 * (k // 2)), (0.2, 0.08, 0.15), mat,
              rot(0, 22 * sx, 8 * sx), 25 + k, strands)
    for sx in (-1, 1):
        f.ell((0.62 * sx, 0.0, z + 0.12), (0.1, 0.22, 0.34), mat, I3, 21, strands)  # sideburns


def bangs(f, mat, z=HEAD_Z):
    for k, sx in enumerate((-1, 1)):
        f.ell((0.22 * sx, -0.56, z + 0.34), (0.26, 0.09, 0.16), mat, rot(0, 20 * sx, 6 * sx), 27 + k, strands)


def hair_long(f, mat, z=HEAD_Z, flow=1.4, cap=True):
    if cap:
        hair_short(f, mat, z)
    f.ell((0, 0.54, z - 0.6), (0.72, 0.3, flow * 0.8), mat, I3, 23, strands)       # back curtain
    for sx in (-1, 1):
        f.ell((0.66 * sx, 0.2, z - 0.6), (0.16, 0.22, 0.9), mat, I3, 24, strands)   # locks over the shoulders


def arm(f, side, hand, elbow, sleeve, glove, shoulder=(0.95, 0, 4.15), r=0.2):
    sx = side
    s = (shoulder[0] * sx, shoulder[1], shoulder[2])
    e = (elbow[0] * sx, elbow[1], elbow[2])
    h = (hand[0] * sx, hand[1], hand[2])
    f.rod(s, e, r, sleeve, 14)
    f.rod(e, h, r * 0.9, glove, 15)
    f.ell((h[0], h[1], h[2] - 0.1), (0.17, 0.17, 0.17), 'skin' if glove == 'skin' else glove, I3, 16)


# ----------------------------------------------------------------- weapons
def sword(f, hand, length=2.3, lean=0.45, mat='steel'):
    hx, hy, hz = hand
    tip = (hx + lean, hy - 0.04, hz + length)
    f.limb((hx, hy, hz + 0.05), tip, 0.1, mat, 40, kind='box')
    f.ell((tip[0], tip[1], tip[2] + 0.05), (0.08, 0.04, 0.12), mat, I3, 40)
    f.box((hx + lean * 0.1, hy, hz + 0.32), (0.42, 0.08, 0.07), 'gold')          # cross guard
    f.ell((hx, hy, hz - 0.1), (0.1, 0.1, 0.1), 'gold')                           # pommel


def round_shield(f, c, r=0.66, face='bark'):
    f.cyl(c, r, 0.09, face, rot(90, 0, 0), 41)
    f.cyl((c[0], c[1] - 0.05, c[2]), r + 0.05, 0.035, 'steel', rot(90, 0, 0), 42)
    f.ell((c[0], c[1] - 0.12, c[2]), (0.2, 0.1, 0.2), 'steel', I3, 43)
    for k in range(6):
        a = k * math.pi / 3
        f.ell((c[0] + 0.5 * r * math.cos(a) * 1.15, c[1] - 0.1, c[2] + 0.5 * r * math.sin(a) * 1.15),
              (0.05, 0.04, 0.05), 'gold')


# ----------------------------------------------------------------- WARRIOR (human)
def warrior(view=FULL):
    f = Fig(view)
    # red cape behind the shoulders
    f.ell((0, 0.52, 3.4), (0.95, 0.2, 1.7), 'cloth', rot(-6, 0, 0), 1)
    f.ell((0, 0.6, 1.9), (0.86, 0.18, 0.9), 'cloth', rot(-4, 0, 0), 2)
    legs(f, 'trouser', 'leather')
    torso(f, 'tunic')
    f.ell((0, -0.06, 3.7), (0.8, 0.52, 0.8), 'plate', I3, 5)                     # breastplate
    f.ell((0, -0.5, 3.85), (0.46, 0.08, 0.4), 'steel', I3, 6)
    f.box((0, -0.58, 3.7), (0.04, 0.03, 0.46), 'gold')
    f.cyl((0, 0, 3.0), 0.76, 0.09, 'pleather', I3, 10)                           # belt
    f.box((0, -0.76, 3.0), (0.15, 0.04, 0.12), 'gold')
    for sx in (-1, 1):                                                           # tassets
        f.box((0.42 * sx, -0.46, 2.45), (0.26, 0.05, 0.42), 'leather', I3, 3)
    f.box((0, -0.52, 2.4), (0.24, 0.05, 0.55), 'cloth', I3, 4)                   # tabard strip
    f.box((0, -0.55, 2.0), (0.24, 0.03, 0.04), 'gold')
    f.ell((-0.82, -0.2, 2.65), (0.22, 0.18, 0.26), 'pleather', I3, 11)           # pouch
    f.cyl((0, 0, 4.46), 0.38, 0.06, 'steel', I3)                                  # mail collar
    for sx in (-1, 1):
        f.ell((0.98 * sx, 0.0, 4.25), (0.4, 0.38, 0.28), 'plate', I3, 12)        # pauldrons
        f.cyl((0.98 * sx, 0.0, 4.06), 0.4, 0.04, 'gold', I3)
    arm(f, 1, (1.22, -0.36, 2.55), (1.15, -0.2, 3.3), 'tunic', 'leather')
    arm(f, -1, (1.22, -0.4, 2.6), (1.18, -0.2, 3.3), 'tunic', 'leather')
    sword(f, (1.22, -0.36, 2.55), length=2.3, lean=0.4)
    round_shield(f, (-1.42, -0.55, 3.0), 0.7)
    head(f, 'skin', 'hair_brown', 'round', 'dark', 'cream', 'hair_brown')
    f.ell((0, -0.24, HEAD_Z - 0.46), (0.38, 0.4, 0.1), 'hair_brown', I3, 31)     # light stubble on the chin
    hair_short(f, 'hair_brown')
    return f.render()


# ----------------------------------------------------------------- PALADIN (angel)
def paladin(view=FULL):
    f = Fig(view)
    # wings: layered feathers fanned from the shoulder blades
    for sx in (-1, 1):
        base = (0.55 * sx, 0.5, 4.2)
        fan = ((18, 1.7, 0.2), (34, 1.95, 0.21), (50, 2.0, 0.21), (66, 1.85, 0.2), (82, 1.6, 0.19), (98, 1.3, 0.18))
        for k, (ang, ln, w) in enumerate(fan):
            a = math.radians(ang)
            c = (base[0] + math.sin(a) * ln * sx * 0.95, base[1] + 0.05 * k, base[2] + math.cos(a) * ln * 0.9)
            f.ell(c, (w, 0.08, ln), 'wing', rot(0, ang * sx, 0), 50 + k)
        for k, (ang, ln) in enumerate(((30, 1.0), (55, 1.0), (80, 0.85))):          # coverts
            a = math.radians(ang)
            c = (base[0] + math.sin(a) * ln * sx * 0.8, base[1] - 0.04, base[2] + math.cos(a) * ln * 0.8 - 0.1)
            f.ell(c, (0.24, 0.09, ln * 0.62), 'tabard', rot(0, ang * sx, 0), 60 + k)
    legs(f, 'tabard', 'plate', 'gold')
    for sx in (-1, 1):
        f.ell((0.35 * sx, -0.22, 1.75), (0.28, 0.26, 0.45), 'plate', I3, 3)       # greaves
        f.ell((0.35 * sx, -0.2, 2.35), (0.27, 0.25, 0.2), 'gold', I3, 4)          # knee guards
    f.box((0, -0.5, 2.5), (0.4, 0.05, 0.6), 'tabard', I3, 5)                      # tabard skirt
    f.box((0, -0.56, 2.5), (0.05, 0.03, 0.5), 'gold')
    torso(f, 'tabard')
    f.ell((0, -0.06, 3.7), (0.8, 0.52, 0.8), 'plate', I3, 6)
    f.box((0, -0.58, 3.65), (0.06, 0.03, 0.46), 'gold')                           # gold cross
    f.box((0, -0.58, 3.82), (0.3, 0.03, 0.06), 'gold')
    f.cyl((0, 0, 3.0), 0.76, 0.09, 'gold', I3, 10)
    for sx in (-1, 1):
        f.ell((0.98 * sx, 0.0, 4.25), (0.42, 0.4, 0.3), 'gold', I3, 12)           # golden pauldrons
        f.ell((0.98 * sx, -0.04, 4.35), (0.28, 0.28, 0.2), 'plate', I3, 13)
    arm(f, 1, (1.18, -0.34, 2.6), (1.12, -0.18, 3.3), 'plate', 'plate')
    arm(f, -1, (1.22, -0.4, 2.7), (1.18, -0.2, 3.35), 'plate', 'plate')
    # blessed mace on the right, kite shield on the left
    f.limb((1.18, -0.34, 2.3), (1.55, -0.4, 4.3), 0.09, 'steel', 40)
    f.ell((1.6, -0.42, 4.6), (0.28, 0.28, 0.28), 'gold', I3, 41)
    f.ell((1.6, -0.5, 4.62), (0.15, 0.1, 0.15), 'glow', I3, 42)
    f.box((-1.36, -0.55, 3.05), (0.5, 0.07, 0.72), 'plate', I3, 43)
    f.ell((-1.36, -0.55, 2.4), (0.5, 0.07, 0.52), 'plate', I3, 44)
    f.box((-1.36, -0.64, 3.0), (0.06, 0.03, 0.6), 'gold')
    f.box((-1.36, -0.64, 3.25), (0.3, 0.03, 0.06), 'gold')
    head(f, 'skin', 'hair_gold', 'round', 'dark', 'cream', 'hair_gold')
    hair_long(f, 'hair_gold', flow=1.2)
    for k in range(14):                                                          # halo: ring of golden beads
        a = k * 2 * math.pi / 14
        f.ell((0.62 * math.cos(a), 0.62 * math.sin(a) * 0.9 + 0.12, HEAD_Z + 1.0), (0.09, 0.09, 0.07), 'glow', I3, 70 + k)
    return f.render()


# ----------------------------------------------------------------- RANGER (elf)
def ranger(view=FULL):
    f = Fig(view)
    # forest cloak + quiver behind
    f.ell((0, 0.5, 3.4), (0.95, 0.2, 1.7), 'cap', rot(-5, 0, 0), 5)
    f.cyl((0.5, 0.68, 4.0), 0.2, 0.7, 'leather', rot(0, 16, 0), 1)
    for k, dx in enumerate((-0.07, 0.05, 0.16)):
        f.limb((0.5 + dx, 0.66, 4.4), (0.7 + dx * 2, 0.66, 5.2), 0.03, 'wood_cut', 2 + k)
        f.ell((0.7 + dx * 2, 0.66, 5.28), (0.07, 0.04, 0.12), 'cloth', I3, 8 + k)
    legs(f, 'brown_hood', 'leather')
    for sx in (-1, 1):
        f.ell((0.35 * sx, -0.2, 1.9), (0.28, 0.28, 0.45), 'leather', I3, 3)       # leg wraps
    torso(f, 'coat')
    f.ell((0, -0.1, 3.55), (0.78, 0.52, 0.6), 'brown_hood', I3, 6)                # tunic front
    f.box((0, -0.6, 3.6), (0.05, 0.03, 0.6), 'pleather')                          # lacing
    for k in range(3):
        f.box((0, -0.62, 3.35 + k * 0.22), (0.2, 0.02, 0.025), 'pleather')
    f.limb((-0.55, -0.5, 4.3), (0.5, -0.55, 3.0), 0.045, 'pleather', 12)          # baldric strap
    f.cyl((0, 0, 3.0), 0.74, 0.09, 'pleather', I3, 10)
    f.box((0, -0.76, 3.0), (0.14, 0.04, 0.1), 'gold')
    f.box((0, -0.5, 2.4), (0.32, 0.05, 0.5), 'cap', I3, 4)                        # tunic skirt
    for sx in (-1, 1):
        f.ell((0.96 * sx, 0.0, 4.2), (0.34, 0.32, 0.22), 'leather', I3, 12)       # spaulders
    f.ell((0, 0.14, 4.4), (0.82, 0.5, 0.32), 'cap', I3, 13)                       # cloak on the shoulders
    arm(f, 1, (1.05, -0.52, 2.95), (1.12, -0.18, 3.4), 'coat', 'leather')
    arm(f, -1, (1.35, -0.5, 3.65), (1.2, -0.2, 3.5), 'coat', 'leather')
    pts = []
    for k in range(9):                                                           # longbow, on the screen-left
        t = k / 8.0
        pts.append((-1.45 - 0.55 * math.sin(math.pi * t), -0.52, 1.5 + 3.6 * t))
    for p0, p1 in zip(pts, pts[1:]):
        f.limb(p0, p1, 0.075, 'bark', 45)
    f.limb(pts[0], pts[-1], 0.02, 'tunic', 46)
    f.limb((1.05, -0.52, 2.95), (1.5, -0.55, 4.5), 0.025, 'wood_cut', 47)         # arrow in the other hand
    f.ell((1.53, -0.55, 4.6), (0.05, 0.04, 0.11), 'steel', I3, 48)
    head(f, 'skin', 'hair_red', 'pointed', 'dark', 'cream', 'hair_red')
    hair_long(f, 'hair_red', flow=1.0, cap=False)
    bangs(f, 'hair_red')
    f.ell((0, 0.24, HEAD_Z + 0.3), (0.78, 0.7, 0.5), 'cap', I3, 14)               # hood up
    f.ell((0, -0.14, HEAD_Z + 0.5), (0.7, 0.5, 0.2), 'cap', rot(12, 0, 0), 15)
    f.cyl((0, 0, HEAD_Z + 0.35), 0.74, 0.04, 'gold', I3)                           # circlet
    f.ell((0, -0.76, HEAD_Z + 0.35), (0.07, 0.04, 0.07), 'ruby')
    return f.render()


# ----------------------------------------------------------------- MAGE (dark elf)
def mage(view=FULL):
    f = Fig(view)
    # bell-shaped robe with gold trim, sash and a shoulder mantle
    f.ell((0, 0.05, 1.75), (1.08, 0.88, 1.55), 'robe', I3, 1)
    f.cyl((0, 0, 0.32), 1.08, 0.18, 'robe', I3, 2)
    f.cyl((0, 0, 0.36), 1.1, 0.05, 'gold')
    f.box((0, -0.8, 1.45), (0.09, 0.04, 1.1), 'gold')
    for sx in (-1, 1):
        f.ell((0.4 * sx, -0.55, 0.2), (0.28, 0.5, 0.2), 'leather', I3, 3)         # boot tips
    f.ell((0, 0, 3.4), (0.78, 0.52, 1.05), 'robe', I3, 4)
    f.box((0, -0.54, 3.55), (0.06, 0.03, 0.8), 'gold')
    f.cyl((0, 0, 2.85), 0.8, 0.1, 'pleather', I3, 5)                               # sash
    f.ell((0.22, -0.8, 2.85), (0.13, 0.05, 0.13), 'gold')
    f.ell((0, 0, 4.3), (0.82, 0.55, 0.28), 'robe', I3, 6)                          # mantle
    f.cyl((0, 0, 4.18), 0.86, 0.05, 'gold', I3)
    f.cyl((0, 0, 4.5), 0.3, 0.12, 'skin_dk', I3, 7)
    # right arm holds the staff, left hand conjures an orb
    f.rod((0.95, 0, 4.1), (1.18, -0.2, 3.3), 0.24, 'robe', 14)
    f.ell((1.24, -0.24, 3.15), (0.34, 0.3, 0.3), 'robe', I3, 15)
    f.ell((1.28, -0.42, 2.82), (0.17, 0.17, 0.17), 'skin_dk', I3, 16)
    f.rod((-0.95, 0, 4.1), (-1.2, -0.3, 3.55), 0.24, 'robe', 17)
    f.ell((-1.25, -0.4, 3.5), (0.32, 0.3, 0.3), 'robe', I3, 18)
    f.ell((-1.3, -0.56, 3.78), (0.17, 0.17, 0.17), 'skin_dk', I3, 19)
    f.ell((-1.34, -0.6, 4.5), (0.27, 0.27, 0.27), 'arcane', I3, 20)                # conjured orb
    f.ell((-1.34, -0.68, 4.54), (0.12, 0.1, 0.12), 'glow', I3, 21)
    f.limb((1.3, -0.42, 0.2), (1.34, -0.44, 5.6), 0.085, 'bark', 44)                # staff
    f.ell((1.34, -0.44, 5.85), (0.3, 0.3, 0.3), 'arcane', I3, 22)
    f.ell((1.34, -0.58, 5.9), (0.12, 0.1, 0.12), 'glow', I3, 23)
    f.cyl((1.34, -0.44, 5.5), 0.17, 0.05, 'gold', I3)
    head(f, 'skin_dk', 'hair_silver', 'pointed', 'eye_glow', 'skin_dk', 'hair_silver')
    hair_long(f, 'hair_silver', flow=1.3, cap=False)
    f.ell((0, 0.2, HEAD_Z + 0.2), (0.8, 0.72, 0.68), 'robe', I3, 24)                # hood up
    f.ell((0, -0.1, HEAD_Z + 0.6), (0.72, 0.5, 0.24), 'robe', rot(10, 0, 0), 25)
    f.ell((0, 0.5, HEAD_Z - 0.3), (0.8, 0.4, 0.7), 'robe', I3, 26)                 # hood back drapes
    f.a('cone', (0, 0.55, HEAD_Z + 1.15), (0.62, 0.75), 'robe', rot(-28, 0, 0), None, 29)   # pointed hood tip
    f.cyl((0, 0, HEAD_Z + 0.46), 0.74, 0.04, 'gold', I3)                             # hood trim
    f.ell((0, -0.74, HEAD_Z + 0.46), (0.08, 0.04, 0.08), 'arcane')
    bangs(f, 'hair_silver')                                                          # white bangs under the hood
    img = f.render()
    if view is FULL:
        fx.glint(img, 6, 10, 2)
    return img


# ----------------------------------------------------------------- public sprite set
CLASSES = {'warrior': warrior, 'paladin': paladin, 'ranger': ranger, 'mage': mage}

SPRITES = {}
for _name, _fn in CLASSES.items():
    SPRITES[f'hero_{_name}'] = (lambda fn=_fn: fn(FULL))
    SPRITES[f'bust_{_name}'] = (lambda fn=_fn: fn(BUST))
