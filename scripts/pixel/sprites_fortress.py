"""The castle fortress (castle levels 7-10): from level 7 the castle stops being one sprite on one tile and grows over its
whole 3x3 bonus area, the way the old level 4-6 castles were walled, but on the map instead of inside one tile.
Walls and towers frame the area, the keep stands on the centre tile and spills a little over its neighbours, and every
biome inside stays visible.

  castle_keep / castle_keep_anim   the keep (64x64, centred on the castle tile, 8px overlap on every side); the sheet has
                                   4 frames: banners wave, the crystal pulses
  castle_tower_7 .. castle_tower_10  one tower per corner of the area, richer every level (40x56)
  castle_wall_h_a/b, castle_wall_v_a/b  48x12 / 12x48 wall pieces (a = stone for levels 7-8, b = gilded for 9-10)
  castle_gate_a/b                  52x30 gatehouse, one tile wide (48px block) in the middle of the south wall (a = stone, b = gilded)
The game tiles the wall pieces along the edges of the area and flips them for the south / east sides.
Towers, keep and gate are seen from a lower camera than the old castles (pitch 58) so stonework, windows and banners show."""
import math
import os
import sys
from PIL import Image
from render3d import Scene, Prim, rot, between, I3
from materials import MATS
from common import hexc
import fx
import sprites_castle as C

CAM = dict(yaw=0.0, pitch=58.0)
WALL = 'wallstone'

TOWER_SIZE = (40, 56)
KEEP_SIZE = 64
GATE_SIZE = (52, 30)

STONE = dict(o='#241e34', d='#3e3650', m='#6a6484', l='#9892b0', h='#c4bed6')
GILD = dict(o='#3a1708', d='#8e4a12', m='#cf8a1a', l='#f5c640', h='#fff3a8')


def _P(sc, kind, c, size, mat, R=I3, tex=None, seed=0):
    sc.add(Prim(kind, c, size, mat, R, tex, seed))


def _flag(sc, x, y, z, length=0.55, tilt=0.0, mat='flag', pole=0.9, drop=0.2):
    """Raised flag: a tall pole with a banner flying from its top."""
    if pole > 0:
        sc.add(between('cyl', (x, y, z), (x, y, z + pole), (0.035,), 'steel', None, (0, 0, 1)))
    _P(sc, 'ell', (x, y, z + pole + 0.03), (0.06, 0.06, 0.06), 'gold')
    _P(sc, 'box', (x + length / 2, y, z + pole - drop), (length / 2, 0.03, drop), mat, rot(0, tilt, 0))


# ----------------------------------------------------------------- stone textures (mortar joints)
def brick_round(pl, nl, pr):
    """Courses of bricks on a round shaft (mortar lines, joints staggered per course)."""
    row = math.floor(pl[2] / 0.24)
    zf = pl[2] / 0.24 - row
    turn = math.atan2(pl[1], pl[0]) / (2 * math.pi) * 12 + (0.5 if row % 2 else 0)
    af = turn - math.floor(turn)
    return None, (-0.32 if (zf < 0.14 or af < 0.1) else 0.0)


def brick_flat(pl, nl, pr):
    """Courses of bricks on a flat wall face."""
    row = math.floor(pl[2] / 0.24)
    zf = pl[2] / 0.24 - row
    xf = pl[0] / 0.5 + (0.5 if row % 2 else 0)
    xf -= math.floor(xf)
    return None, (-0.32 if (zf < 0.14 or xf < 0.09) else 0.0)


def _crown(sc, x, y, r, z, n=8, size=0.11):
    for i in range(n):
        a = 2 * math.pi * i / n
        _P(sc, 'box', (x + math.cos(a) * r * 0.86, y + math.sin(a) * r * 0.86, z + size), (size, size, size), WALL)


def _round_tower(sc, x, y, r, h, roof_h, roof, seed, crown=False, glow=False, bands=(), slits=2):
    """Brick shaft, optional gold bands, a corbelled top, battlement crown or a bare cone roof, arrow slits and a finial."""
    _P(sc, 'cyl', (x, y, h / 2), (r, h / 2), WALL, I3, brick_round, seed)
    for zb in bands:
        _P(sc, 'cyl', (x, y, zb), (r * 1.04, 0.07), 'gold')
    wm = 'glow' if glow else 'dark'
    for k in range(slits):
        _P(sc, 'box', (x + (k - (slits - 1) / 2) * r * 0.9, y - r * 0.93, h * (0.6 if k % 2 == 0 else 0.42)), (0.07, 0.04, 0.17), wm)
    _P(sc, 'cyl', (x, y, h + 0.05), (r * 1.14, 0.08), WALL, I3, None, seed + 2)          # corbelled top
    if crown:
        _crown(sc, x, y, r * 1.14, h + 0.12, 9)
        _P(sc, 'cone', (x, y, h + 0.14 + roof_h / 2), (r * 0.8, roof_h / 2), roof, I3, None, seed + 1)
        top = h + 0.14 + roof_h
    else:
        _P(sc, 'cone', (x, y, h + 0.1 + roof_h / 2), (r * 1.3, roof_h / 2), roof, I3, None, seed + 1)
        top = h + 0.1 + roof_h
    _P(sc, 'ell', (x, y, top + 0.04), (0.09, 0.09, 0.09), 'gold')
    return top


# ----------------------------------------------------------------- towers (area corners), one per level
def tower(level):
    sc = Scene(MATS, size=TOWER_SIZE, scale=15.0, origin=(20, 46), **CAM)
    _P(sc, 'cyl', (0, 0, 0.08), (0.8, 0.08), 'granite_dk', I3, None, 70)                    # low footing ring
    if level == 7:
        top = _round_tower(sc, 0, 0, 0.66, 1.9, 0.95, 'barn', 7)
        _flag(sc, 0, 0, top, 0.5, -8, pole=0.6, drop=0.14)
    elif level == 8:
        top = _round_tower(sc, 0, 0, 0.68, 2.2, 1.0, 'slate_blue', 8, crown=True, bands=(1.0,))
        _P(sc, 'box', (0, -0.7, 1.3), (0.16, 0.03, 0.42), 'cloth')                        # banner hanging on the front
        _P(sc, 'box', (0, -0.71, 0.86), (0.2, 0.03, 0.05), 'gold')
        _flag(sc, 0, 0, top, 0.55, -10, pole=0.8, drop=0.16)
    elif level == 9:
        top = _round_tower(sc, 0, 0, 0.7, 2.5, 1.05, 'gold', 9, crown=True, glow=True, bands=(0.7, 1.55), slits=3)
        _P(sc, 'box', (0, -0.72, 1.35), (0.16, 0.03, 0.42), 'cloth')
        _flag(sc, 0, 0, top, 0.6, 0, pole=0.95, drop=0.18)
    else:
        top = _round_tower(sc, 0, 0, 0.72, 2.8, 1.1, 'gold', 10, crown=True, glow=True, bands=(0.7, 1.5, 2.3), slits=3)
        _P(sc, 'box', (0, -0.74, 1.5), (0.18, 0.03, 0.46), 'cloth')
        _P(sc, 'ell', (0, 0, top + 0.5), (0.26, 0.26, 0.4), 'crystal', I3, None, 31)       # crystal over the spire
        sc.add(between('cyl', (0, 0, top + 0.04), (0, 0, top + 0.22), (0.03,), 'gold', None, (0, 0, 1)))
        for sx in (-0.74, 0.74):
            _flag(sc, sx, 0, 2.55, 0.42, 12 * sx, pole=0.65, drop=0.14)
    img = sc.render()
    if level >= 9:
        fx.glint(img, 17, 9, 2 if level == 10 else 1)
    return img


# ----------------------------------------------------------------- keep (centre tile, spills over its neighbours)
def keep(phase=0):
    """Great hall (slate gable roof, parapet, arched door, banners) with a tall gold-roofed donjon rising behind it and a small
    turret with a raised flag at each front corner. The crystal on the donjon pulses and the banners wave over 4 frames."""
    tilt = (-14, 0, 14, 0)[phase % 4]
    pulse = (1.0, 1.1, 1.0, 0.92)[phase % 4]
    sc = Scene(MATS, size=KEEP_SIZE, scale=15.0, origin=(32, 51), **CAM)
    # the great hall
    _P(sc, 'box', (0, -0.15, 0.8), (1.2, 0.78, 0.8), WALL, I3, brick_flat, 9)
    _P(sc, 'box', (0, -0.15, 0.5), (1.23, 0.81, 0.05), 'gold')                              # gold band
    for i in range(7):                                                                      # front parapet
        _P(sc, 'box', (-1.08 + i * 0.36, -0.9, 1.7), (0.1, 0.08, 0.1), WALL)
    C._gable_roof(sc, 0, -0.15, 0.98, 0.62, 1.64, 0.55, 'slate_blue', 14)
    # door and windows
    _P(sc, 'box', (0, -0.94, 0.5), (0.3, 0.05, 0.4), 'door')
    _P(sc, 'ell', (0, -0.94, 0.9), (0.3, 0.05, 0.16), 'door')
    for sx in (-0.62, 0.62):
        _P(sc, 'box', (sx, -0.94, 1.15), (0.09, 0.04, 0.2), 'glow')
    for sx in (-0.95, 0.95):                                                                # banners on the front
        _P(sc, 'box', (sx, -0.95, 1.05), (0.13, 0.03, 0.4), 'cloth')
        _P(sc, 'box', (sx, -0.96, 0.62), (0.17, 0.03, 0.04), 'gold')
    # the donjon behind the roof
    top = _round_tower(sc, 0, 0.55, 0.62, 2.9, 1.1, 'gold', 12, crown=True, glow=True, bands=(1.2, 2.2), slits=0)
    r = 0.3 * pulse
    _P(sc, 'ell', (0, 0.55, top + 0.62), (r, r, r * 1.5), 'crystal', I3, None, 30)
    sc.add(between('cyl', (0, 0.55, top + 0.04), (0, 0.55, top + 0.36), (0.03,), 'gold', None, (0, 0, 1)))
    _flag(sc, 0.0, 0.55, top + 1.0, 0.62, tilt, pole=0.0, drop=0.18)                        # banner under the crystal
    # front corner turrets with raised flags
    for sx, sgn in ((-1.3, -1), (1.3, 1)):
        t = _round_tower(sc, sx, -0.8, 0.42, 1.9, 0.8, 'slate_blue', int(sx * 7) + 20, crown=True, bands=(0.9,), slits=1)
        _flag(sc, sx, -0.8, t, 0.6, tilt * -sgn, pole=1.0, drop=0.2)
    img = sc.render()
    for x, y, rr in ((32, 5, (3, 2, 1, 2)[phase % 4]), (45, 18, (1, 3, 2, 1)[phase % 4])):
        fx.glint(img, x, y, rr)
    return img


def keep_sheet():
    sheet = Image.new('RGBA', (KEEP_SIZE * 4, KEEP_SIZE), (0, 0, 0, 0))
    for i in range(4):
        sheet.alpha_composite(keep(i), (i * KEEP_SIZE, 0))
    return sheet


# ----------------------------------------------------------------- gatehouse (south wall)
def gate(tier):
    """Gatehouse in the south wall, exactly one tile wide (48px) so it joins the wall on both sides: brick block, arch with a
    portcullis, glowing slits, crenellated roof, a flag on each corner. Low, so it hides little of the biome behind it."""
    gilded = tier == 'b'
    bar = 'gold' if gilded else 'steel'
    sc = Scene(MATS, size=GATE_SIZE, scale=13.0, origin=(26, 22), **CAM)
    _P(sc, 'box', (0, 0, 0.55), (1.85, 0.52, 0.55), WALL, I3, brick_flat, 5)               # block, 48px wide
    if gilded:
        _P(sc, 'box', (0, 0, 0.95), (1.88, 0.55, 0.05), 'gold')
    _P(sc, 'box', (0, 0, 1.12), (1.78, 0.46, 0.05), 'slate')                                # roof deck
    for i in range(9):                                                                      # front parapet
        _P(sc, 'box', (-1.52 + i * 0.38, -0.46, 1.25), (0.1, 0.08, 0.1), WALL)
    _P(sc, 'box', (0, -0.52, 0.42), (0.3, 0.05, 0.42), 'dark')                              # arch
    _P(sc, 'ell', (0, -0.52, 0.76), (0.3, 0.05, 0.16), 'dark')
    for k in range(3):
        _P(sc, 'box', (-0.2 + k * 0.2, -0.56, 0.45), (0.022, 0.02, 0.45), bar)
    for sx in (-1.15, 1.15):                                                                # slits beside the door
        _P(sc, 'box', (sx, -0.54, 0.62), (0.07, 0.03, 0.17), 'glow' if gilded else 'dark')
    for sx in (-1.62, 1.62):
        _flag(sc, sx, 0.05, 1.12, 0.4, 8 * (1 if sx > 0 else -1), pole=0.55, drop=0.14)
    return sc.render()


# ----------------------------------------------------------------- walls (2D, top-down parapet)
def _px(img, x, y, col):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), hexc(col))


def _wall_north(pal, w=48, h=12):
    """Horizontal wall, outer edge on top: merlons (8 wide, 4 gap, period 12 so it tiles), a walkway, a shaded inner face."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for x in range(w):
        mer = x % 12 < 8
        for y in range(h):
            col = None
            if mer and y <= 3:
                col = pal['o'] if y == 0 or x % 12 in (0, 7) else (pal['h'] if y == 1 else (pal['l'] if y == 2 else pal['m']))
            elif not mer and y == 3:
                col = pal['o']
            elif y == 4:
                col = pal['o'] if mer else pal['l']
            elif 5 <= y <= 8:
                joint = (x + (0 if y % 2 else 6)) % 12 == 0
                col = pal['d'] if joint else (pal['l'] if y == 5 else pal['m'])
            elif y in (9, 10):
                col = pal['d']
            elif y == 11:
                col = pal['o']
            if col:
                _px(img, x, y, col)
    return img


def _gilded(img):
    """Gold trim: the lit top edge of every merlon and the walkway edge turn gold."""
    out = img.copy()
    px = out.load()
    hi, lo = hexc(STONE['h']), hexc(STONE['l'])
    for x in range(out.width):
        for y in range(out.height):
            if y <= 4 and px[x, y] == hi:
                px[x, y] = hexc(GILD['h'])
            elif y <= 4 and px[x, y] == lo:
                px[x, y] = hexc(GILD['l'] if y < 4 else GILD['m'])
    return out


def wall_h(tier):
    return _wall_north(STONE) if tier == 'a' else _gilded(_wall_north(STONE))


def wall_v(tier):
    return wall_h(tier).transpose(Image.TRANSPOSE)


# ----------------------------------------------------------------- registry
SPRITES = {
    'castle_keep': lambda: keep(0),
    **{f'castle_tower_{lv}': (lambda lv=lv: tower(lv)) for lv in (7, 8, 9, 10)},
    'castle_wall_h_a': lambda: wall_h('a'), 'castle_wall_h_b': lambda: wall_h('b'),
    'castle_wall_v_a': lambda: wall_v('a'), 'castle_wall_v_b': lambda: wall_v('b'),
    'castle_gate_a': lambda: gate('a'), 'castle_gate_b': lambda: gate('b'),
}


# ----------------------------------------------------------------- preview (not part of the game build)
def mock(level, ground_dir):
    """The whole fortress on real biome ground: 3x3 tiles (144px) with a margin, for review. No violet wash: the castle
    tile uses the cobbled yard ground."""
    pad = 36
    S = 48
    grounds = ['forest', 'plains', 'hills', 'swamp', 'coast', 'tundra', 'lake', 'grounds']
    canvas = Image.new('RGBA', (3 * S + 2 * pad, 3 * S + 2 * pad), (12, 14, 28, 255))
    k = 0
    for ty in range(3):
        for tx in range(3):
            name = 'yard' if (tx, ty) == (1, 1) else grounds[k % len(grounds)]
            k += 0 if (tx, ty) == (1, 1) else 1
            tex = Image.open(os.path.join(ground_dir, f'ground_{name}.png')).convert('RGBA')
            tex = tex.resize((tex.width * 2, tex.height * 2), Image.NEAREST)
            for yy in range(0, S, tex.height):
                for xx in range(0, S, tex.width):
                    canvas.alpha_composite(tex.crop((0, 0, min(tex.width, S - xx), min(tex.height, S - yy))), (pad + tx * S + xx, pad + ty * S + yy))
    tier = 'a' if level <= 8 else 'b'
    wh, wv = wall_h(tier), wall_v(tier)
    for i in range(3):
        canvas.alpha_composite(wh, (pad + i * S, pad))
        if i != 1:
            canvas.alpha_composite(wh.transpose(Image.FLIP_TOP_BOTTOM), (pad + i * S, pad + 3 * S - 12))
        canvas.alpha_composite(wv, (pad, pad + i * S))
        canvas.alpha_composite(wv.transpose(Image.FLIP_LEFT_RIGHT), (pad + 3 * S - 12, pad + i * S))
    g = gate(tier)
    canvas.alpha_composite(g, (pad + 3 * S // 2 - g.width // 2, pad + 3 * S - g.height + 4))
    kp = keep(0)
    canvas.alpha_composite(kp, (pad + S + S // 2 - kp.width // 2, pad + S + S // 2 - kp.height // 2 - 6))
    t = tower(level)
    for cx, cy in ((0, 0), (3 * S, 0), (0, 3 * S), (3 * S, 3 * S)):
        canvas.alpha_composite(t, (pad + cx - t.width // 2, pad + cy - 40))
    return canvas


if __name__ == '__main__':
    out = sys.argv[1]
    ground = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'pixel', 'bg')
    scale = 4
    sheets = [mock(lv, ground) for lv in (7, 8, 9, 10)]
    cw, ch = sheets[0].size
    sheet = Image.new('RGBA', (cw * scale * 2 + 40, ch * scale * 2 + 40), (40, 32, 30, 255))
    for i, s in enumerate(sheets):
        big = s.resize((cw * scale, ch * scale), Image.NEAREST)
        sheet.alpha_composite(big, (10 + (i % 2) * (cw * scale + 20), 10 + (i // 2) * (ch * scale + 20)))
    sheet.save(out)
    print(sheet.size)
    if len(sys.argv) > 2:
        parts = [keep(0), tower(7), tower(8), tower(9), tower(10), gate('a'), gate('b')]
        z = 6
        W = sum(p_.width * z + 24 for p_ in parts) + 24
        H = max(p_.height for p_ in parts) * z + 48
        zs = Image.new('RGBA', (W, H), (60, 48, 44, 255))
        x = 24
        for p_ in parts:
            zs.alpha_composite(p_.resize((p_.width * z, p_.height * z), Image.NEAREST), (x, 24))
            x += p_.width * z + 24
        zs.save(sys.argv[2])
