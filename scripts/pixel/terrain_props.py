"""Sprites drawn on top of the terrain: trees, rocks, peaks, plants, ponds, docks, boats and sea details.

Style target (scripts/pixel/reference/map-gemini.png): saturated top-down 16-bit pixel art, 1px dark outlines in a
darker tone of the sprite's own colour (never black), 3-tone shading lit from the top-left, crisp leaf speckle.
Sprites are placed deterministically by hash in terrain_preview.py (and later src/utils/terrain.ts).
"""
from math import cos, sin, pi
from PIL import Image
from common import hexc as C
from terrain_field import hash32


# ------------------------------------------------------------------ helpers
def _outline(img, col):
    w, h = img.size
    src = img.copy()
    sp, dp = src.load(), img.load()
    for y in range(h):
        for x in range(w):
            if sp[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3]:
                    dp[x, y] = C(col)
                    break
    return img


def _pad(img, n=1):
    out = Image.new('RGBA', (img.size[0] + 2 * n, img.size[1] + 2 * n), (0, 0, 0, 0))
    out.paste(img, (n, n))
    return out


def _sprite(rows, colors, outline):
    w = len(rows[0])
    assert all(len(r) == w for r in rows), rows
    img = Image.new('RGBA', (w + 2, len(rows) + 2), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors:
                img.putpixel((x + 1, y + 1), C(colors[ch]))
    return _outline(img, outline)


def _put(px, w, h, x, y, col):
    if 0 <= x < w and 0 <= y < h:
        px[x, y] = col


def _disc(px, w, h, cx, cy, rx, ry, pick):
    """Fill an ellipse; pick(dx, dy, d) returns a colour (d = 0..1 from the centre)."""
    for dy in range(-ry - 1, ry + 2):
        for dx in range(-rx - 1, rx + 2):
            d = ((dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2) ** 0.5
            if d <= 1:
                _put(px, w, h, cx + dx, cy + dy, pick(dx, dy, d))


def _line(px, w, h, x0, y0, x1, y1, col, thick=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / max(n, 1)
        x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
        for k in range(thick):
            _put(px, w, h, x + k, y, col)


# ------------------------------------------------------------------ trees
OAK = dict(outline='#17401f', dark='#2a6a2c', mid='#3b8b37', light='#5fb04a', hi='#8fd45c')
OAK_DRY = dict(outline='#3a3a18', dark='#5e6a22', mid='#7a8a2e', light='#9aaa3e', hi='#bccb58')
TRUNK, TRUNK_D = '#7a5636', '#583c24'


def oak(seed=0, scale=1.0, pal=OAK):
    w, h = int(36 * scale) + 2, int(40 * scale) + 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    cx = w // 2
    ty = int(h * 0.62)
    for y in range(ty, h - 2):                               # trunk with a darker right side
        for x in range(cx - 2, cx + 2):
            _put(px, w, h, x, y, C(TRUNK_D if x >= cx + 1 else TRUNK))
    _put(px, w, h, cx - 3, h - 3, C(TRUNK_D))
    _put(px, w, h, cx + 2, h - 3, C(TRUNK_D))
    j = lambda k: (hash32(seed, k, 7) % 3) - 1
    s = scale
    lumps = [(0, -11, 9), (-8 + j(1), -6, 8), (8 + j(2), -6, 8), (0 + j(3), -3, 11), (-9, 2 + j(4), 7), (9, 2 + j(5), 7), (0, 4, 8)]
    mid, dark, light, hi = C(pal['mid']), C(pal['dark']), C(pal['light']), C(pal['hi'])
    ccy = int(h * 0.42)
    for lx, ly, r in lumps:
        rr = max(3, int(r * s))

        def pick(dx, dy, d, rr=rr, lx=lx, ly=ly):
            t = (dx + dy) / (2.0 * rr)
            n = hash32(dx + lx * 3, dy + ly * 5, seed + 11) % 11
            if t > 0.32 and d > 0.45:
                return dark if n else mid
            if t < -0.3 and d < 0.85:
                return hi if n < 2 else light
            return light if n == 0 else dark if n == 1 and t > -0.1 else mid
        _disc(px, w, h, cx + int(lx * s), ccy + int(ly * s), rr, rr, pick)
    return _outline(img, pal['outline'])


PINE = dict(outline='#173f27', dark='#1f5a30', mid='#2f7a3e', light='#4a9a52', snow='#f0f6fb', snow_sh='#c0d4e6')


def pine(seed=0, tiers=4, snow=False, scale=1.0, pal=PINE):
    cx = int(13 * scale)
    w = int(27 * scale)
    th = max(6, int(9 * scale))                               # tier height
    h = 3 + (tiers - 1) * (th - 2) + th + 7
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    mid, light, dark = C(pal['mid']), C(pal['light']), C(pal['dark'])
    for y in range(h - 9, h - 1):
        _put(px, w, h, cx - 1, y, C(TRUNK))
        _put(px, w, h, cx, y, C(TRUNK_D))
    for i in range(tiers):
        y0 = 3 + i * (th - 2)
        hwm = (4.0 + i * 2.7 + (hash32(seed, i, 3) % 3) * 0.4) * scale
        for dy in range(th):
            hw = hwm * (dy + 1) / th
            for dx in range(-int(hw), int(hw) + 1):
                if dy == th - 1 and (dx + 40) % 3 == 0:
                    continue                                   # ragged lower edge
                n = hash32(dx + i * 9, dy, seed + 5) % 9
                col = light if dx < -hw * 0.25 else dark if dx > hw * 0.3 else mid
                if dy >= th - 2:
                    col = dark
                if n == 0 and col is mid:
                    col = light
                if snow and dy < th * 0.5 and dx < hw * 0.55:
                    col = C(pal['snow'])
                elif snow and dy < th * 0.5:
                    col = C(pal['snow_sh'])
                _put(px, w, h, cx + dx, y0 + dy, col)
    return _outline(img, pal['outline'])


def palm(seed=0):
    w, h = 30, 34
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    bend = 3 if seed % 2 else -3
    pts = [(15 + int(bend * (t / 20) ** 2), 31 - t) for t in range(0, 22)]
    for i, (x, y) in enumerate(pts):
        _put(px, w, h, x, y, C('#9a7448'))
        _put(px, w, h, x + 1, y, C('#6e5030'))
        if i % 4 == 0:
            _put(px, w, h, x, y, C('#6e5030'))
    tx, ty = pts[-1]
    mid, light, dark = C('#3f8e3a'), C('#68b846'), C('#2a6a2c')
    for a in (-2.7, -2.2, -1.57, -0.9, -0.4, 0.1, 3.0):
        L = 12
        for t in range(L):
            x = tx + cos(a) * t
            y = ty + sin(a) * t * 0.8 + t * t * 0.045
            col = light if t < L // 2 and sin(a) < 0 else mid if t < L - 3 else dark
            _put(px, w, h, round(x), round(y), col)
            _put(px, w, h, round(x), round(y) + 1, dark if t > 2 else mid)
    _put(px, w, h, tx, ty + 1, C('#6e5030'))
    _put(px, w, h, tx + 1, ty + 1, C('#6e5030'))
    return _outline(img, '#1d4a22')


def dead_tree(seed=0, scale=1.0):
    w, h = int(34 * scale), int(40 * scale)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    bark, lit, dark = C('#6d4c2c'), C('#8e6838'), C('#4b3320')
    cx = w // 2

    def branch(x, y, ang, length, thick, depth):
        x1, y1 = x + cos(ang) * length, y + sin(ang) * length
        for k in range(thick):
            _line(px, w, h, x + k, y, x1 + k, y1, lit if k == 0 and thick > 1 else bark if k < thick - 1 or thick == 1 else dark)
        if depth > 0 and length > 4:
            r = hash32(int(x), int(y), seed + depth)
            branch(x1, y1, ang - 0.55 - (r % 3) * 0.12, length * 0.7, max(1, thick - 1), depth - 1)
            branch(x1, y1, ang + 0.5 + (r // 3 % 3) * 0.12, length * 0.65, max(1, thick - 1), depth - 1)
    branch(cx - 1, h - 3, -pi / 2 + ((seed % 3) - 1) * 0.12, 15 * scale, 3, 3)
    for dx in (-3, -2, 2, 3):
        _put(px, w, h, cx + dx, h - 3, dark)
    return _outline(img, '#2a1c10')


# ------------------------------------------------------------------ rocks and peaks
ROCK = dict(lit='#c0c4c8', mid='#9296a0', dark='#686c76', crack='#4c5058', outline='#3a3e46')
ROCK_BROWN = dict(lit='#b8a890', mid='#8e8068', dark='#665a48', crack='#463c2e', outline='#352c20')
ICE = dict(lit='#c8ecfc', mid='#7fc0ea', dark='#4a8ec4', crack='#e8f8ff', outline='#2d5f90')


def boulder(seed=0, size=1, pal=ROCK, snow=False):
    w, h = (12, 18, 24)[size], (9, 13, 17)[size]
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    lit, mid, dark = C(pal['lit']), C(pal['mid']), C(pal['dark'])
    cx, cy = w // 2, int(h * 0.55)
    lumps = [(0, 0, w // 2 - 1, h // 2 - 1), (-w // 5, 1, w // 3, h // 3), (w // 5, 1, w // 3, h // 3 + 1)]
    for lx, ly, rx, ry in lumps:
        def pick(dx, dy, d, lx=lx, ly=ly):
            t = (dx + dy) / (rx + ry + 1.0)
            if t > 0.28:
                return dark
            if t < -0.25 and d < 0.85:
                return lit
            return mid
        _disc(px, w, h, cx + lx, cy + ly, rx, ry, pick)
    if size > 0:                                             # crack
        x0, y0 = cx - 1, cy - h // 4
        for k in range(h // 3):
            _put(px, w, h, x0 + (k % 2), y0 + k, C(pal['crack']))
    if snow:
        for y in range(h // 2):
            for x in range(w):
                if px[x, y][3] and x + y < w * 0.9:
                    px[x, y] = C('#f0f6fb') if (x + y) % 5 else C('#c8dcec')
    return _outline(img, pal['outline'])


def rock_pile(seed=0, pal=ROCK_BROWN):
    """Three boulders heaped together with a few chips in front (a scree / rubble pile)."""
    w, h = 30, 20
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    lit, mid, dark = C(pal['lit']), C(pal['mid']), C(pal['dark'])
    stones = [(8, 12, 7, 5), (19, 12, 8, 6), (13, 7, 6, 5)] if seed % 2 == 0 else [(9, 12, 8, 6), (21, 13, 6, 5), (15, 7, 7, 5)]

    for cx, cy, rx, ry in stones:
        def pick(dx, dy, d, rx=rx, ry=ry):
            t = (dx / (rx + 0.5)) + (dy / (ry + 0.5))
            return dark if t > 0.7 else lit if t < -0.7 and d < 0.9 else mid
        _disc(px, w, h, cx, cy, rx, ry, pick)
    for i, (x, y) in enumerate(((3, 17), (14, 17), (26, 16), (22, 18))):
        _put(px, w, h, x, y, mid)
        _put(px, w, h, x + 1, y, dark)
    for x, y in ((7, 9), (18, 9), (13, 5)):
        _put(px, w, h, x, y, lit)
    return _outline(_pad(img, 0), pal['outline'])


def cave(seed=0):
    """A rocky knoll with a dark cave mouth framed by two timbers and a lintel, rubble at the foot."""
    w, h = 36, 30
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    lit, mid, dark = C(ROCK['lit']), C(ROCK['mid']), C(ROCK['dark'])
    for cx, cy, rx, ry in ((18, 15, 16, 12), (8, 19, 8, 7), (28, 19, 8, 7)):
        def pick(dx, dy, d):
            t = (dx / (rx_ + 0.5)) + (dy / (ry_ + 0.5))
            if t > 0.55:
                return dark
            if t < -0.45 and d < 0.9:
                return lit
            return mid
        rx_, ry_ = rx, ry
        _disc(px, w, h, cx, cy, rx, ry, pick)
    for k in range(6):                                                   # strata strokes
        y = 6 + k * 3
        for x in range(10 + (k % 2) * 3, 17 + (k % 2) * 3):
            if px[x, y][3]:
                px[x, y] = lit if k % 2 == 0 else dark
    cx, base = 18, 26
    for dy in range(-9, 1):                                              # the cave mouth: an arch of darkness
        half = int((1 - (dy / 9.5) ** 2) ** 0.5 * 7)
        for dx in range(-half, half + 1):
            col = C('#0c0a14') if dy > -6 or abs(dx) < half - 1 else C('#1c1824')
            _put(px, w, h, cx + dx, base + dy, col)
    for dx in range(-6, 7):                                              # a hint of floor inside
        if abs(dx) < 5:
            _put(px, w, h, cx + dx, base, C('#2c2638'))
    wood, wood_l = C('#7a4c26'), C('#a8703c')
    for x in (cx - 8, cx + 8):                                           # timbers
        for y in range(base - 9, base + 1):
            _put(px, w, h, x, y, wood)
            _put(px, w, h, x - 1, y, wood_l)
    for x in range(cx - 9, cx + 10):                                     # lintel
        _put(px, w, h, x, base - 10, wood_l)
        _put(px, w, h, x, base - 9, wood)
    for x, y in ((4, 27), (9, 28), (26, 28), (31, 27), (13, 28), (22, 28)):    # rubble
        _put(px, w, h, x, y, mid)
        _put(px, w, h, x + 1, y, dark)
    return _outline(img, ROCK['outline'])


def peak(seed=0, snow=False, pal=ROCK):
    """Mountain with a shoulder peak: lit left face, shaded right face, strata strokes and scree."""
    w, h = 40, 46
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    ax = 15 + (hash32(seed, 1, 5) % 5) - 2
    bx = ax + 12 + (hash32(seed, 2, 5) % 3)
    lit, lit2, mid, dark, dark2 = C(pal['lit']), C(pal['mid']), C('#7a7e88'), C(pal['dark']), C('#50545c')
    base = h - 4

    def top(x):
        return min(3 + abs(x - ax) * 2.0, 17 + abs(x - bx) * 1.9) + ((hash32(x, seed, 4) % 3) - 1) * 0.7

    for x in range(1, w - 1):
        for y in range(int(top(x)), base + (1 if 3 < x < w - 4 else 0)):
            ridge = ax + (y - 3) * 0.12 + ((hash32(y, seed, 6) % 3) - 1) * 0.6
            if x < ridge:
                col = lit if y < 16 else lit2 if y < 30 else mid
                if (x + y * 2) % 9 == 0 and y > 8:
                    col = lit2 if col == lit else mid
            elif x < bx - 1:
                col = mid if y < 12 else dark if y < 32 else dark2
                if (x * 2 - y) % 11 == 0 and y > 10:
                    col = dark2 if col == dark else dark
            else:
                col = lit2 if x < bx + 1 and y > 20 else dark if y < 32 else dark2
            if snow and y < 14:
                col = C('#f2f7fb') if x < ridge else C('#c4d6e8')
            px[x, y] = col
    for x in range(2, w - 2):
        if hash32(x, seed, 8) % 4 == 0:
            px[x, base + 1] = dark2
    return _outline(img, pal['outline'])


def ice_crystal(seed=0, big=False):
    w, h = (16, 20) if not big else (22, 26)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    lit, mid, dark = C(ICE['lit']), C(ICE['mid']), C(ICE['dark'])
    for cx, top, half, base in ([(w // 2, 2, 4, h - 3), (w // 2 - 5, 8, 3, h - 3), (w // 2 + 5, 10, 3, h - 3)] if big else
                                [(w // 2, 2, 4, h - 3), (w // 2 + 4, 8, 2, h - 3)]):
        for y in range(top, base):
            t = (y - top) / max(1, base - top)
            hw = max(1, int(half * min(1.0, t * 2.2)))
            for x in range(cx - hw, cx + hw + 1):
                col = lit if x < cx - hw // 3 else dark if x > cx + hw // 3 else mid
                _put(px, w, h, x, y, col)
    return _outline(img, ICE['outline'])


# ------------------------------------------------------------------ plants and misc
def flowers(kind=0):
    petal = ['#f0ece0', '#f2d870', '#e8a0b0', '#b8a0e0'][kind]
    rows = ['..p..y..', '.ppp.yyy', '..p..y..', '..g..g..', '.g.gg.g.']
    return _sprite(rows, dict(p=petal, y=petal, g='#3f8a30'), '#2f6a26')


def bush(berry=False):
    rows = ['..lll...', '.lmmml..', 'lmmmmmd.', 'mmmmmddd', '.dddddd.']
    if berry:
        rows = ['..lrl...', '.lmmmrl.', 'lmrmmmd.', 'mmmmrmdd', '.dddddd.']
    return _sprite(rows, dict(l='#6cb852', m='#4a9a3c', d='#337a2e', r='#d85a4a'), '#245a22')


def tall_grass():
    return _sprite(['.g..g..g.', '.gg.gg.gg', 'gggggggg.', 'hgggdgggd'], dict(g='#4c9a3a', h='#78c452', d='#347a2c'), '#255a22')


def log():
    return _sprite(['.bbbbbbbbbbb.', 'rrbbbbbbbbbbb', 'rlrbdddddddb.', '.rrbbbbbbbbb.'], dict(b='#8a6638', d='#684a28', r='#c4a068', l='#8a6638'), '#3c2a16')


def fern():
    return _sprite(['.g...g.g.', '..g.g.g..', 'g.ggggg.g', '.ggggggg.', '...gdg...'], dict(g='#3f9a40', d='#277a30'), '#1a5a22')


def mushrooms():
    return _sprite(['..cc....', '.cccc.cc', 'cccccccc', '..ss..ss', '..ss..ss'], dict(c='#c8503e', s='#ece4cc'), '#6a2a20')


def reeds():
    return _sprite(['.t...t..t.', '.t...t..t.', '.s.t.s..s.', '.s.s.s.ss.', 'ss.s.ss.s.', 'ssssssssss'], dict(t='#8a5a30', s='#7a9a3a'), '#445a1e')


def stump():
    return _sprite(['.rrrr.', 'rrllrr', 'rrrrrr', '.bbbb.', '.bbbb.'], dict(r='#a07a4a', l='#c49a62', b='#7a5636'), '#3c2a16')


def snow_drift():
    return _sprite(['...hhhh...', '.hhhhhhhh.', 'hhhhhhhmmm', '.mmmmmmmm.'], dict(h='#f6f9fc', m='#cadbea'), '#9ab4cc')


def shell():
    return _sprite(['.pp.', 'pwwp', '.pp.'], dict(p='#e8b8aa', w='#fff0e4'), '#a98a7e')


def driftwood():
    return _sprite(['.bbbbbbbbb..', 'bbllbbbbbbbb', '.bbbbddbbbb.'], dict(b='#b8a48c', l='#d8c8b0', d='#8c7a64'), '#6a5a48')


def pebbles():
    return _sprite(['.hh.....', 'hmmd.hh.', '.dd.hmmd', '.....dd.'], dict(h='#d4c6a6', m='#b4a484', d='#8c7c5c'), '#6b5c40')


def lily(flower=False):
    rows = ['..gggg..', '.ggwwgg.' if flower else '.gggggg.', 'ggg.gggg', '.gggggg.', '..gggg..']
    return _sprite(rows, dict(g='#4ea85a', w='#f0e0e6'), '#2c7a3c')


def water_rock():
    return _sprite(['..hhh...', '.hmmmh..', 'hmmmmmd.', '.ddddd..'], dict(h='#b4bcc4', m='#8a949e', d='#5e6a76'), '#3a4650')


def pond(frozen=False, seed=0):
    w, h = 34, 22
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    if frozen:
        body, lt, dk, edge, out = C('#9cd4f2'), C('#d4f0fc'), C('#6aaee0'), C('#eef8fe'), '#3f78a8'
    else:
        body, lt, dk, edge, out = C('#2f90cc'), C('#58b4e4'), C('#1f6aa4'), C('#8ad0ee'), '#17406a'
    rx, ry = w // 2 - 3, h // 2 - 3
    cx, cy = w // 2, h // 2

    def wobble(dx, dy):
        return 1 + ((hash32(dx // 3, dy // 3, seed + 1) % 3) - 1) * 0.08

    def pick(dx, dy, d):
        d2 = d * wobble(dx, dy)
        if d2 > 0.84:
            return edge if (dx + dy) < 0 else dk
        if (dx + dy) < -3 and d < 0.6:
            return lt
        return body
    _disc(px, w, h, cx, cy, rx, ry, pick)
    if frozen:
        for k in range(6):
            _put(px, w, h, cx - 4 + k, cy - 1 + (k // 2), C('#ffffff'))
    return _outline(img, out)


def lighthouse():
    rows = ['....rr....', '...rrrr...', '..gggggg..', '...wwww...', '...wrrw...', '...wwww...', '...wrrw...',
            '..wwwwww..', '..wwdwww..', '..wwwdww..', '..wwwwww..', '.sswwwwss.', 'ssssssssss', 'sdsdssdsds']
    return _sprite(rows, dict(r='#c4483a', g='#6a6e76', w='#e8e0cc', d='#b4aa94', s='#8c9096'), '#3a3e46')


# ------------------------------------------------------------------ sea and shore (also used on the fog ring)
def sea_rock(seed=0):
    rows = ['..hhh...', '.hmmmh..', 'hmmmmmmd', 'mmmmmmdd', '.dddddd.']
    if seed % 2:
        rows = ['...hh....', '.hhmmh...', 'hmmmmmmh.', 'mmmmmmmdd', '.mmddddd.']
    return _sprite(rows, dict(h='#5a6c92', m='#3e4e74', d='#2a3656'), '#16203a')


def islet(seed=0):
    w, h = 26, 22
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    _disc(px, w, h, 13, 14, 11, 6, lambda dx, dy, d: C('#5a6c92') if dy + dx * 0.3 > 1 else C('#7a8aa8') if d < 0.8 else C('#3e4e74'))
    _disc(px, w, h, 13, 11, 9, 4, lambda dx, dy, d: C('#4a9a3c') if dx + dy > 0 else C('#6cb852'))
    for y in range(3, 11):
        _put(px, w, h, 13, y, C(TRUNK))
    _disc(px, w, h, 13, 6, 5, 4, lambda dx, dy, d: C('#2a6a2c') if dx + dy > 1 else C('#4a9a3c') if d < 0.8 else C('#3b8b37'))
    return _outline(img, '#16203a')


def ice_floe(seed=0):
    rows = ['..hhhhh..', '.hhhhhhmm', 'hhhhhmmmm', '.hhmmmmm.', '..mmmmd..']
    if seed % 2:
        rows = ['.hhhh...', 'hhhhhmm.', 'hhhhmmmd', '.hmmmmd.']
    return _sprite(rows, dict(h='#e4f4fc', m='#b0d4ee', d='#82b0d4'), '#3f6b98')


# ------------------------------------------------------------------ water: boats and piers
def boat(vertical=False):
    img = _sprite(['..hhhhhhhhhhhh..', '.hhiiiiiiiiiihh.', 'hhiiiiiibiiiiihh', 'hhiiiiiibiiiiihh', '.hhiiiiiiiiiihh.', '..hhhhhhhhhhhh..'],
                  dict(h='#b88c58', i='#7a5a38', b='#9a7040'), '#47301a')
    return img.transpose(Image.TRANSPOSE) if vertical else img


def pier(land, length=26, barrel=False):
    """Pier whose base touches land on side `land` ('n','e','s','w'); far end points into the water."""
    w = 12
    img = Image.new('RGBA', (w, length), (0, 0, 0, 0))
    px = img.load()
    for y in range(length):
        for x in range(w):
            if x in (0, 1, w - 2, w - 1):
                px[x, y] = C('#98703e') if x in (0, w - 2) else C('#74522c')
            else:
                px[x, y] = C('#82603a') if y % 4 == 3 else C('#b48a54') if (y // 4) % 2 == 0 else C('#a8804c')
        if y % 4 == 1:
            px[2, y] = px[w - 3, y] = C('#82603a')
    for y in range(0, 4):
        for x in (0, 1, w - 2, w - 1):
            px[x, y] = C('#5a4026') if y else C('#a88050')
    mid = length // 2
    for x in (0, 1, w - 2, w - 1):
        px[x, mid] = C('#5a4026')
    if barrel:
        for y in range(length - 8, length - 1):
            for x in range(7, 11):
                px[x, y] = C('#7a5a3c') if y not in (length - 7, length - 4) else C('#4a3320')
    img = _outline(_pad(img), '#46301a')
    if land == 'n':
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    elif land == 'e':
        img = img.transpose(Image.TRANSPOSE)
    elif land == 'w':
        img = img.transpose(Image.TRANSPOSE).transpose(Image.FLIP_LEFT_RIGHT)
    return img


# ------------------------------------------------------------------ registry
_C = {}


def cached(fn, *a):
    key = (fn, tuple(id(v) if isinstance(v, dict) else v for v in a))     # palettes are module-level dicts
    if key not in _C:
        _C[key] = fn(*a)
    return _C[key]


def oaks(weight):
    return [(f'oak{i}', (oak, i, s), weight, 0) for i, s in enumerate((0.8, 1.0, 1.1, 0.9))]


def pines(weight, snow=False):
    return [(f'pine{i}', (pine, i, t, snow, sc), weight, 0) for i, (t, sc) in enumerate(((3, 0.9), (4, 1.0), (4, 1.1)))]


# ground -> dict(edge=[p(0),p(1),...], deep=[...] probabilities of 0,1,2.. props on a tile, opts=[(name, builder args, weight, min tile depth)])
PROPS = {
    'plains': dict(edge=[0.34, 0.4, 0.22, 0.04], deep=[0.2, 0.34, 0.3, 0.16],
                   opts=oaks(3) + pines(2) + [('flowers_w', (flowers, 0), 3, 0), ('flowers_y', (flowers, 1), 3, 0), ('flowers_p', (flowers, 2), 2, 0),
                                              ('flowers_v', (flowers, 3), 1, 0), ('bush', (bush, False), 3, 0), ('berry', (bush, True), 1, 0),
                                              ('rock', (boulder, 0, 1), 2, 0), ('rock_s', (boulder, 1, 0), 2, 0), ('grass', (tall_grass,), 3, 0),
                                              ('log', (log,), 1, 0), ('pond', (pond, False, 0), 1, 1)]),
    'forest': dict(edge=[0.12, 0.42, 0.34, 0.12], deep=[0.04, 0.18, 0.36, 0.42],
                   opts=oaks(4) + pines(4) + [('fern', (fern,), 2, 0), ('mushrooms', (mushrooms,), 1, 0), ('rock', (boulder, 2, 0), 1, 0),
                                              ('log', (log,), 1, 1), ('stump', (stump,), 1, 1), ('pond', (pond, False, 1), 1, 1)]),
    'hills': dict(edge=[0.4, 0.42, 0.15, 0.03], deep=[0.22, 0.4, 0.28, 0.1],
                  opts=[('boulder', (boulder, 3, 1), 4, 0), ('rock_s', (boulder, 4, 0), 3, 0), ('bush', (bush, False), 2, 0),
                        ('oak', (oak, 5, 0.8), 2, 0), ('pine', (pine, 3, 3, False, 0.9), 2, 0), ('grass', (tall_grass,), 2, 0),
                        ('rock_s2', (boulder, 7, 0, ROCK_BROWN), 3, 0), ('rock_m2', (boulder, 8, 1, ROCK_BROWN), 3, 0),
                        ('rubble', (rock_pile, 0), 3, 0), ('rubble2', (rock_pile, 1, ROCK), 2, 0),
                        ('boulder_l', (boulder, 5, 2), 3, 1), ('boulder_l2', (boulder, 9, 2, ROCK_BROWN), 2, 1),
                        ('cave', (cave, 0), 2, 1),
                        ('peak', (peak, 0), 4, 2), ('peak2', (peak, 1), 3, 2), ('peak3', (peak, 2), 3, 2)]),
    'swamp': dict(edge=[0.4, 0.45, 0.15], deep=[0.25, 0.4, 0.28, 0.07],
                  opts=[('dead', (dead_tree, 0, 1.0), 4, 0), ('dead2', (dead_tree, 1, 0.8), 3, 0), ('dead3', (dead_tree, 2, 1.1), 2, 0),
                        ('stump', (stump,), 2, 0), ('reeds', (reeds,), 4, 0), ('mushrooms', (mushrooms,), 1, 0), ('log', (log,), 1, 0),
                        ('oak', (oak, 6, 0.8, OAK_DRY), 1, 0)]),
    'tundra': dict(edge=[0.4, 0.45, 0.15], deep=[0.3, 0.4, 0.25, 0.05],
                   opts=pines(4, True) + [('ice', (ice_crystal, 0, False), 3, 0), ('ice_b', (ice_crystal, 1, True), 2, 1), ('rock', (boulder, 6, 1, ROCK, True), 3, 0),
                                          ('drift', (snow_drift,), 3, 0), ('pond', (pond, True, 2), 2, 1), ('peak', (peak, 3, True), 3, 2)]),
    'coast': dict(edge=[0.62, 0.3, 0.08], deep=[0.5, 0.35, 0.15],
                  opts=[('shell', (shell,), 3, 0), ('driftwood', (driftwood,), 2, 0), ('pebbles', (pebbles,), 3, 0), ('rock', (water_rock,), 2, 0),
                        ('palm', (palm, 0), 3, 0), ('palm2', (palm, 1), 3, 0), ('lighthouse', (lighthouse,), 1, 1)]),
    'lake': dict(edge=[0.8, 0.2], deep=[0.7, 0.28, 0.02],
                 opts=[('lily', (lily, False), 3, 0), ('lily_f', (lily, True), 1, 0), ('rock', (water_rock,), 2, 0),
                       ('boat', (boat, False), 2, 1), ('boat_v', (boat, True), 2, 1)]),
    'mist': dict(edge=[0.45, 0.4, 0.15], deep=[0.45, 0.4, 0.15],
                 opts=[('sea_rock', (sea_rock, 0), 4, 0), ('sea_rock2', (sea_rock, 1), 3, 0), ('islet', (islet, 0), 1, 0), ('floe', (ice_floe, 0), 2, 0),
                       ('floe2', (ice_floe, 1), 2, 0)]),
}
