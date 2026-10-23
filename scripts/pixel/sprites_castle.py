"""Castle sprites, one per upgrade level (1-6), seen from above and filling the whole 48px map tile.
Every level stands on the same paved plinth so the castle always covers its tile; what grows is the building:
  1 crenellated keep, timber roof   2 keep + round watchtower       3 keep + two towers, gate wall
  4 walled courtyard, 4 towers      5 fortress: tall watchtowers, central tower, gold trim
  6 grand castle: gold roofs, glowing windows, crystal spire (animated)
The max level is also rendered as a 4-frame sheet (flags wave, crystal pulses)."""
import math
from PIL import Image
from render3d import Scene, Prim, rot, between, I3
from materials import MATS
import fx

SIZE = 48
SIZES = {lv: SIZE for lv in range(1, 7)}
WALL = 'wallstone'
PAVE = 'stone'
CAM = dict(yaw=0.0, pitch=78.0)        # looking almost straight down; front faces show as a thin strip


def _P(sc, kind, c, size, mat, R=I3, seed=0):
    sc.add(Prim(kind, c, size, mat, R, None, seed))


def _plinth(sc, h):
    """The paved square every castle stands on (fills the tile)."""
    _P(sc, 'box', (0, 0, 0.12), (h, h, 0.12), PAVE, I3, 77)


def _crown(sc, x, y, r, z, n=8, size=0.1, mat=WALL):
    """Ring of battlement blocks on a round tower top (z = top of the shaft)."""
    for i in range(n):
        a = 2 * math.pi * i / n
        _P(sc, 'box', (x + math.cos(a) * r * 0.82, y + math.sin(a) * r * 0.82, z + size), (size, size, size), mat)


def _tower(sc, x, y, r, h, roof_h, roof='barn', seed=0, glow=False, crown=False):
    """Round tower: stone shaft, then a cone roof (or a battlement crown with a smaller cone)."""
    _P(sc, 'cyl', (x, y, h / 2), (r, h / 2), WALL, I3, seed)
    if crown:
        _P(sc, 'cyl', (x, y, h + 0.04), (r * 1.12, 0.06), WALL, I3, seed + 2)
        _crown(sc, x, y, r * 1.12, h + 0.08, 8, 0.09)
        _P(sc, 'cone', (x, y, h + 0.1 + roof_h / 2), (r * 0.78, roof_h / 2), roof, I3, seed + 1)
        _P(sc, 'ell', (x, y, h + 0.1 + roof_h + 0.04), (0.09, 0.09, 0.09), 'gold')
    else:
        _P(sc, 'cone', (x, y, h + roof_h / 2), (r * 1.28, roof_h / 2), roof, I3, seed + 1)
        _P(sc, 'ell', (x, y, h + roof_h + 0.04), (0.09, 0.09, 0.09), 'gold')
    wm = 'glow' if glow else 'dark'
    _P(sc, 'box', (x, y - r * 0.98, h * 0.6), (0.07, 0.03, 0.13), wm)         # arrow slit on the front


def _flag(sc, x, y, z, length=0.45, tilt=0.0, mat='flag', pole=0.6):
    sc.add(between('cyl', (x, y, z), (x, y, z + pole), (0.03,), 'steel', None, (0, 0, 1)))
    _P(sc, 'box', (x + length / 2, y, z + pole - 0.12), (length / 2, 0.03, 0.12), mat, rot(0, tilt, 0))


def _wall_ring(sc, h, thick=0.2, wall_h=0.7, gate=0.0):
    """Curtain wall along the plinth edge. gate > 0 leaves a gap in the front wall."""
    if gate:
        seg = (h - gate / 2) / 2
        for sx in (-1, 1):
            _P(sc, 'box', (sx * (gate / 2 + seg), -h, wall_h / 2), (seg, thick, wall_h / 2), WALL)
    else:
        _P(sc, 'box', (0, -h, wall_h / 2), (h, thick, wall_h / 2), WALL)
    _P(sc, 'box', (0, h, wall_h / 2), (h, thick, wall_h / 2), WALL)
    _P(sc, 'box', (-h, 0, wall_h / 2), (thick, h, wall_h / 2), WALL)
    _P(sc, 'box', (h, 0, wall_h / 2), (thick, h, wall_h / 2), WALL)


def _wall_crenels(sc, h, wall_h, n=7, size=0.09):
    for i in range(n):
        t = -h + 2 * h * (i + 0.5) / n
        for c in ((t, -h), (t, h), (-h, t), (h, t)):
            _P(sc, 'box', (c[0], c[1], wall_h + size), (size, size, size), WALL)


def _gable_roof(sc, cx, cy, hx, hy, base_z, rise, mat='barn', seed=0):
    """Two sloped slabs meeting in a ridge along x, plus a ridge beam."""
    ang = math.degrees(math.atan2(rise, hy))
    half = math.hypot(hy, rise) / 2
    for s in (-1, 1):
        _P(sc, 'box', (cx, cy + s * hy / 2, base_z + rise / 2), (hx + 0.12, half, 0.06), mat, rot(-s * ang, 0, 0), seed + s)
    _P(sc, 'box', (cx, cy, base_z + rise), (hx + 0.12, 0.05, 0.06), 'plank')


def _keep(sc, cx, cy, hx, hy, h, roof='barn', seed=9, inset=0.3, rise=0.45):
    """Stone keep with a crenellated parapet all round and a roof set inside it."""
    _P(sc, 'box', (cx, cy, h / 2), (hx, hy, h / 2), WALL, I3, seed)
    nx, ny = max(2, int(hx * 2 / 0.36)), max(2, int(hy * 2 / 0.36))
    for i in range(nx):
        t = cx - hx + 0.1 + (2 * hx - 0.2) * i / (nx - 1)
        for yy in (cy - hy + 0.08, cy + hy - 0.08):
            _P(sc, 'box', (t, yy, h + 0.08), (0.09, 0.08, 0.08), WALL)
    for j in range(1, ny - 1):
        t = cy - hy + 0.1 + (2 * hy - 0.2) * j / (ny - 1)
        for xx in (cx - hx + 0.09, cx + hx - 0.09):
            _P(sc, 'box', (xx, t, h + 0.08), (0.08, 0.09, 0.08), WALL)
    _gable_roof(sc, cx, cy, hx - inset - 0.12, hy - inset, h + 0.04, rise, roof, seed + 3)


def _gatehouse(sc, y, hw, h, roof=None, trim=False):
    """Gate block in the front wall: crenellated top, optional inset roof and gold band, dark doorway."""
    _P(sc, 'box', (0, y, h / 2), (hw, 0.28, h / 2), WALL)
    for i in range(4):
        t = -hw + 0.1 + (2 * hw - 0.2) * i / 3
        for yy in (y - 0.2, y + 0.2):
            _P(sc, 'box', (t, yy, h + 0.08), (0.09, 0.07, 0.08), WALL)
    if roof:
        _P(sc, 'box', (0, y, h + 0.06), (hw - 0.2, 0.17, 0.05), roof)
    if trim:
        _P(sc, 'box', (0, y, h * 0.55), (hw + 0.02, 0.3, 0.05), 'gold')
    _door(sc, 0, y - 0.29, 0.34, 0.26, 0.34)


def _shrub(sc, x, y, r=0.3):
    _P(sc, 'ell', (x, y, r * 0.7), (r, r, r * 0.8), 'pine', I3, int(x * 7 + y * 3))


def _door(sc, x, y, z, w=0.3, h=0.42):
    _P(sc, 'box', (x, y, z), (w, 0.05, h), 'door')


def build(level, phase=0):
    flag_tilt = (-14, 0, 14, 0)[phase % 4]
    pulse = (1.0, 1.1, 1.0, 0.92)[phase % 4]
    sc = Scene(MATS, size=SIZE, scale=9.8, origin=(24, 26), **CAM)
    _plinth(sc, 2.2)
    W = 1.85                                    # half-width of the curtain wall / tower ring

    if level == 1:
        _keep(sc, 0, 0.1, 1.3, 1.05, 0.85, inset=0.34)
        _door(sc, 0, -0.96, 0.4, 0.28, 0.4)
        for sx in (-0.8, 0.8):
            _P(sc, 'box', (sx, -0.96, 0.55), (0.1, 0.03, 0.12), 'dark')
        for sx in (-1.7, 1.7):                                             # shrubs at the front corners
            _shrub(sc, sx, -1.65)
        _flag(sc, 0.0, 0.1, 1.0, 0.45, flag_tilt, pole=0.6)

    elif level == 2:
        _keep(sc, -0.5, 0.05, 1.2, 1.0, 0.9, inset=0.32)
        _door(sc, -0.5, -0.96, 0.42, 0.28, 0.4)
        _tower(sc, 1.45, 0.75, 0.52, 1.6, 0.9, seed=3)
        _shrub(sc, -1.75, -1.7)
        _shrub(sc, 1.5, -1.5)
        _flag(sc, -0.5, 0.05, 1.05, 0.45, flag_tilt, pole=0.6)

    elif level == 3:
        _keep(sc, 0, 0.45, 1.05, 0.85, 1.0)
        _P(sc, 'box', (0, -1.5, 0.35), (1.55, 0.14, 0.35), WALL)          # low gate wall
        _P(sc, 'box', (0, -1.5, 0.75), (0.46, 0.2, 0.18), WALL)
        _door(sc, 0, -1.72, 0.33, 0.28, 0.34)
        _tower(sc, -1.6, -1.45, 0.46, 1.5, 0.8, seed=3)
        _tower(sc, 1.6, -1.45, 0.46, 1.9, 0.9, seed=6)
        _P(sc, 'box', (-0.55, -0.43, 0.7), (0.1, 0.03, 0.14), 'dark')
        _flag(sc, 1.6, -1.45, 2.8, 0.42, flag_tilt, pole=0.55)
        _flag(sc, 0, 0.45, 1.3, 0.36, -flag_tilt, pole=0.5)

    elif level == 4:
        _wall_ring(sc, W, 0.16, 0.7, gate=0.7)
        _wall_crenels(sc, W, 0.7)
        for sx, sy in ((-W, -W), (W, -W), (-W, W), (W, W)):
            _tower(sc, sx, sy, 0.46, 1.5, 0.8, roof='slate_blue', seed=int(sx * 3 + sy), crown=True)
        _keep(sc, 0, 0.2, 0.9, 0.75, 1.05, roof='slate_blue')
        _gatehouse(sc, -W, 0.5, 1.0, roof='slate_blue')
        _flag(sc, 0, 0.2, 1.1, 0.42, flag_tilt, pole=0.55)
        for sx in (-W, W):
            _flag(sc, sx, -W, 2.4, 0.36, flag_tilt * (-1 if sx < 0 else 1), pole=0.5)

    elif level == 5:
        _wall_ring(sc, W, 0.18, 0.85, gate=0.7)
        _wall_crenels(sc, W, 0.85, 8)
        for sx, sy in ((-W, -W), (W, -W), (-W, W), (W, W)):
            _tower(sc, sx, sy, 0.5, 2.0, 0.85, roof='slate_blue', seed=int(sx * 3 + sy), crown=True, glow=sy < 0)
        for sx in (-W, W):                                                  # mid-wall bastions
            _P(sc, 'cyl', (sx, 0, 0.55), (0.36, 0.55), WALL, I3, int(sx) + 20)
            _P(sc, 'cone', (sx, 0, 1.4), (0.46, 0.35), 'slate_blue', I3, 22)
            _P(sc, 'ell', (sx, 0, 1.78), (0.08, 0.08, 0.08), 'gold')
        _keep(sc, 0, 0.3, 1.0, 0.8, 1.15, roof='slate_blue')
        _P(sc, 'box', (0, 0.3, 0.55), (1.03, 0.83, 0.07), 'gold')           # gold trim band
        _tower(sc, 0.0, 0.4, 0.5, 2.6, 0.95, roof='slate_blue', seed=12, crown=True)
        _gatehouse(sc, -W, 0.55, 1.1, roof='slate_blue', trim=True)
        for k in (-0.4, 0.4):
            _P(sc, 'box', (k, -0.52, 0.85), (0.1, 0.03, 0.16), 'glow')
        _flag(sc, 0.0, 0.4, 3.7, 0.5, flag_tilt, pole=0.7)
        for sx in (-W, W):
            _flag(sc, sx, -W, 2.95, 0.4, flag_tilt * (-1 if sx < 0 else 1), pole=0.5)

    else:   # level 6: grand castle
        _wall_ring(sc, W, 0.2, 0.9, gate=0.75)
        _wall_crenels(sc, W, 0.9, 8)
        for sx, sy in ((-W, -W), (W, -W), (-W, W), (W, W)):
            _tower(sc, sx, sy, 0.52, 2.2, 0.95, roof='gold', seed=int(sx * 3 + sy), crown=True, glow=True)
        for sx in (-W, W):
            _P(sc, 'cyl', (sx, 0, 0.65), (0.38, 0.65), WALL, I3, int(sx) + 20)
            _P(sc, 'cone', (sx, 0, 1.55), (0.48, 0.4), 'gold', I3, 22)
            _P(sc, 'ell', (sx, 0, 1.97), (0.08, 0.08, 0.08), 'gold')
        _keep(sc, 0, 0.3, 1.0, 0.85, 1.3, roof='gold')
        _P(sc, 'box', (0, 0.3, 0.6), (1.03, 0.88, 0.07), 'gold')
        _tower(sc, 0.0, 0.4, 0.55, 3.0, 1.1, roof='gold', seed=12, crown=True)
        for k in (-0.4, 0, 0.4):
            _P(sc, 'box', (k, -0.56, 0.95), (0.09, 0.03, 0.17), 'glow')
        _gatehouse(sc, -W, 0.6, 1.25, roof='gold', trim=True)
        r = 0.28 * pulse                                                      # crystal above the spire
        _P(sc, 'ell', (0.0, 0.4, 4.5), (r, r, r * 1.5), 'crystal', I3, 30)
        sc.add(between('cyl', (0.0, 0.4, 4.15), (0.0, 0.4, 4.35), (0.03,), 'gold', None, (0, 0, 1)))
        for sx in (-W, W):
            _flag(sc, sx, -W, 3.3, 0.5, flag_tilt * (-1 if sx < 0 else 1), pole=0.6)

    img = sc.render()
    if level == 6:
        for x, y, r in ((25, 8, (3, 2, 1, 2)[phase % 4]), (40, 13, (1, 3, 2, 1)[phase % 4]), (8, 16, (2, 1, 3, 2)[phase % 4])):
            fx.glint(img, x, y, r)
    elif level == 5:
        fx.glint(img, 25, 8, 1)
    return img


def sheet_max():
    """4-frame animation for the max level (48x48 each, side by side)."""
    sheet = Image.new('RGBA', (SIZE * 4, SIZE), (0, 0, 0, 0))
    for i in range(4):
        sheet.alpha_composite(build(6, i), (i * SIZE, 0))
    return sheet


SPRITES = {f'castle_{lv}': (lambda lv=lv: build(lv, 0)) for lv in range(1, 7)}
