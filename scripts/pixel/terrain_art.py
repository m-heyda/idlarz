"""Terrain art for the dual-grid map layer (48 px per tile, 1:1).

Style target: scripts/pixel/reference/map-gemini.png - saturated top-down pixel art with depth tiers (shallow / deep /
abyssal water, plateau / terrace / summit hills), cliff rims, speckled snow and sand, murky swamp channels.
Per style we build
  texture(style)           seamless 192x192 fill, sampled at world coordinates so it never shows a cell seam
  render_cell(style, ...)  body alpha mask + rim overlay for one of the 16 shapes (see terrain_field.py)
A style is a ground ('plains'), optionally with a depth tier suffix ('lake_d1', 'lake_d2'); tier n is drawn on top of the
ground where a tile is surrounded by the same ground n rings deep.
"""
from PIL import Image
from common import hexc as C
from fog import tnoise
from terrain_field import shape, shape_square, rnd01, hash32, CELL

TEX = 192

# ------------------------------------------------------------------ palette
PAL = {
    'plains':   dict(tones=['#5d9a3a', '#65a540', '#6eaf46'], dk='#54932f', lt='#72b548', tuft='#3f7a28', tuft_lt='#8fd450', edge='#3e7a28'),
    'forest':   dict(tones=['#2c6b2e', '#317433', '#367c38'], dk='#235a28', tuft='#245c28', tuft_lt='#459a46', edge='#1f5024'),
    'forest_d1': dict(tones=['#245c29', '#28652d', '#2d6e32'], dk='#1d4e24', tuft='#1f5224', tuft_lt='#3b8a3c', edge='#1f5024'),
    'hills':    dict(tones=['#6a8840', '#709046', '#77984c'], dk='#5c7a38', lt='#86a85a', tuft='#4f6e30', tuft_lt='#9cc064', edge='#4f6e30',
                     rock='#8b8e86', rock_lt='#b4b6ac'),
    'hills_d1': dict(tones=['#7e7858', '#867f5e', '#8e8764'], dk='#6e684c', lt='#9a9470', grass='#6c8a40', rock='#84877f', rock_lt='#b0b2a8',
                     crack='#5a5640'),
    'hills_d2': dict(tones=['#868680', '#8d8d86', '#94948d'], step_lt='#aeaea6', step_sh='#6e6e68', rock='#74746e', crack='#5a5a54'),
    'swamp':    dict(tones=['#66652f', '#6c6b33', '#727137'], dk='#585726', water='#27606e', water2='#1c4856', water_lt='#3f8c98', tuft='#4f4e22',
                     tuft_lt='#8c8c3e', edge='#4a4a20'),
    'swamp_d1': dict(tones=['#5d5c2b', '#63622f', '#696833'], dk='#4e4d22', water='#245a68', water2='#1a4452', water_lt='#3a8490', tuft='#46451f',
                     tuft_lt='#80803a', edge='#4a4a20'),
    'tundra':   dict(tones=['#dce8f4', '#e3edf7', '#eaf2fa'], shade='#c4d8ec', spark='#ffffff', edge='#f6fafe', rim_sh='#a8c2dc'),
    'tundra_d1': dict(tones=['#cfe3f4', '#d6e8f7', '#dcecf9'], shade='#b8d2ea', spark='#ffffff', crack='#9cc0e0', edge='#eaf4fc', rim_sh='#9cbad8'),
    'coast':    dict(tones=['#d6c18a', '#dcc791', '#e2cd98'], dk='#c9b27a', speck='#b99e66', lt='#ecdca8', ripple='#c4ac74', edge='#bda568'),
    'lake':     dict(tones=['#2f9fd2', '#35a6d8', '#3badde'], tick='#a8dcf2', foam='#f0f8ff', foam2='#bfe4f6', band='#52bff0',
                     sand='#d6c18a', wet='#b49a66', pebble='#9a8456', fringe='#d0bc86'),
    # a lake's shore where it meets tundra (ice shelf over snow) or a swamp (scum over mud); the water body is the plain lake's
    'lake_frost': dict(slush='#c4c8c8', snow='#e8e8dc', crystal='#a8cce4', ice='#ffffff', ice2='#dff0fa', sheet='#bfe4f6', crack='#8ccbee', fringe='#d6d8cc'),
    'lake_bog': dict(mud='#6a6030', moss_mud='#8a8450', clump='#7fa04a', pit='#4a4624', scum='#b4c474', scum2='#8aa85a', murk='#4a8a7a',
                     taint='#8a5ac0', fringe='#a49a60'),
    'lake_d1':  dict(tones=['#2380bd', '#2886c3', '#2d8cc9'], tick='#4ca4da', edge='#2c94d0'),
    'lake_d2':  dict(tones=['#185b9e', '#1c61a4', '#2067aa'], tick='#3a7cc4', abyss='#123e7a', edge='#226cb8'),
'yard':     dict(tones=['#8a7860', '#928068', '#9a8870'], cobble='#a69678', cobble_lt='#c2b496', cobble_sh='#6e604a', mortar='#6a5c46',
                     lip='#d4ccb8', lip_sh='#aea690', face='#8c8470', mark='#6c6452', inner='#5c5444', outline='#2e2a22'),
    'castle':   dict(tones=['#5a3f98', '#6045a0', '#664ba8'], line='#3a2866', slab_lt='#7e63c0',
                     lip='#c4b8ec', lip_sh='#9c90c8', face='#7a6eb0', mark='#5a4e90', inner='#483c78', outline='#241a46'),
    'mist':     dict(tones=['#0d1a3a', '#112248', '#152a54'], edge='#1d3c78', edge2='#16306a', spark='#2a4c90'),
}

STYLES = {                      # coordinate warp in px (amp) and scalloping (lobe) per style
    'plains': dict(amp=5.0, lobe=0.0),
    'forest': dict(amp=5.0, lobe=3.0), 'forest_d1': dict(amp=6.0, lobe=2.5),
    'hills': dict(amp=4.0, lobe=1.5), 'hills_d1': dict(amp=5.0, lobe=1.5), 'hills_d2': dict(amp=5.0, lobe=1.2),
    'swamp': dict(amp=6.0, lobe=3.0), 'swamp_d1': dict(amp=6.0, lobe=2.5),
    'tundra': dict(amp=5.0, lobe=2.5), 'tundra_d1': dict(amp=6.0, lobe=2.0),
    'coast': dict(amp=6.0, lobe=0.0),
    'lake': dict(amp=4.5, lobe=0.0),
    'lake_d1': dict(amp=6.0, lobe=0.0), 'lake_d2': dict(amp=7.0, lobe=0.0),
    'mist': dict(amp=7.0, lobe=3.0),
'yard': dict(square=True), 'castle': dict(square=True),
}
MAX_DEPTH = {'forest': 1, 'hills': 2, 'swamp': 1, 'tundra': 1, 'lake': 2}


# ------------------------------------------------------------------ textures
def _banded(tones, seed, cells=(3, 7), mix=(0.62, 0.38)):
    img = Image.new('RGBA', (TEX, TEX))
    px = img.load()
    t = [C(c) for c in tones]
    k = len(t)
    for y in range(TEX):
        for x in range(TEX):
            v = mix[0] * tnoise(x, y, TEX, cells[0], seed) + mix[1] * tnoise(x, y, TEX, cells[1], seed + 7)
            idx = int((v - 0.18) / 0.64 * k)
            px[x, y] = t[max(0, min(k - 1, idx))]
    return img, px


def _put(px, x, y, col):
    px[x % TEX, y % TEX] = col


def _sprinkle(seed, step, prob, fn):
    """Calls fn(x, y) for a sparse jittered lattice of step x step blocks (wraps with the texture)."""
    for by in range(0, TEX, step):
        for bx in range(0, TEX, step):
            if rnd01(bx, by, seed) < prob:
                fn(bx + int(rnd01(bx, by, seed + 1) * (step - 4)) + 2, by + int(rnd01(bx, by, seed + 2) * (step - 4)) + 2)


def _blob(px, cx, cy, rx, ry, fill, lit=None, shade=None):
    for dy in range(-ry - 1, ry + 2):
        for dx in range(-rx - 1, rx + 2):
            d = (dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2
            if d <= 1:
                col = fill
                if shade and dx + dy > 0 and d > 0.4:
                    col = shade
                if lit and dx + dy < 0 and d > 0.4:
                    col = lit
                _put(px, cx + dx, cy + dy, col)


def _warped(x, y, cells, seed, amt=30):
    return (tnoise(x + (tnoise(x, y, TEX, 5, seed + 4) - 0.5) * amt, y + (tnoise(x, y, TEX, 5, seed + 6) - 0.5) * amt, TEX, cells, seed))


def _tufts(px, p, seed, step, prob):
    dk, lt = C(p['tuft']), C(p['tuft_lt'])

    def tuft(x, y):
        _put(px, x, y, dk); _put(px, x + 2, y, dk); _put(px, x + 1, y + 1, dk)
        _put(px, x + 1, y - 1, lt)
    _sprinkle(seed, step, prob, tuft)


def tex_plains():
    p = PAL['plains']
    img, px = _banded(p['tones'], 11)
    dk, lt = C(p['dk']), C(p['lt'])
    for y in range(TEX):
        for x in range(TEX):
            v = _warped(x, y, 3, 91)
            if v > 0.66:
                px[x, y] = lt
            elif v < 0.3:
                px[x, y] = dk
    _tufts(px, p, 21, 12, 0.6)
    flowers = [C('#f0ece0'), C('#f2d870'), C('#e8a0b0'), C('#b8a0e0')]
    _sprinkle(31, 12, 0.3, lambda x, y: _put(px, x, y, flowers[hash32(x, y, 5) % 4]))
    return img


def tex_forest(tier=0):
    p = PAL['forest_d1' if tier else 'forest']
    img, px = _banded(p['tones'], 33 if tier else 31, cells=(4, 9))
    _tufts(px, p, 41, 14, 0.45)
    dark = C(p['dk'])
    _sprinkle(45, 22, 0.6, lambda x, y: _blob(px, x, y, 3, 2, dark))
    return img


def tex_hills(tier=0):
    key = ('hills', 'hills_d1', 'hills_d2')[tier]
    p = PAL[key]
    if tier == 2:                                         # stone summit: terraced grey rock
        tones = [C(t) for t in p['tones']]
        k = len(tones)
        lvl = [[0] * TEX for _ in range(TEX)]
        img = Image.new('RGBA', (TEX, TEX))
        px = img.load()
        for y in range(TEX):
            for x in range(TEX):
                h = 0.55 * tnoise(x, y, TEX, 3, 83) + 0.3 * tnoise(x, y, TEX, 6, 85) + 0.15 * tnoise(x, y, TEX, 12, 87)
                lvl[y][x] = max(0, min(k - 1, int((h - 0.25) / 0.5 * k)))
        lt, sh = C(p['step_lt']), C(p['step_sh'])
        for y in range(TEX):
            for x in range(TEX):
                me = lvl[y][x]
                up, left = lvl[(y - 1) % TEX][x], lvl[y][(x - 1) % TEX]
                px[x, y] = lt if (me > up or me > left) else sh if (me < up or (me < left and (x + y) % 2 == 0)) else tones[me]

        def fissure(x, y):
            for k2 in range(6):
                _put(px, x + k2, y + (k2 * 2) // 3, C(p['crack']))
        _sprinkle(93, 26, 0.45, fissure)
        return img
    img, px = _banded(p['tones'], 81 + tier * 5, cells=(3, 7))
    dk, lt = C(p['dk']), C(p['lt'])
    for y in range(TEX):
        for x in range(TEX):
            v = _warped(x, y, 3, 95 + tier)
            if v > 0.66:
                px[x, y] = lt
            elif v < 0.32:
                px[x, y] = dk
    if tier == 0:
        _tufts(px, p, 97, 12, 0.5)
        rock, rlt = C(p['rock']), C(p['rock_lt'])
        _sprinkle(99, 30, 0.35, lambda x, y: _blob(px, x, y, 3 + hash32(x, y, 1) % 2, 2, rock, rlt, C('#6a6e66')))
    else:
        gr, rock, rlt, crack = C(p['grass']), C(p['rock']), C(p['rock_lt']), C(p['crack'])
        for y in range(TEX):
            for x in range(TEX):
                if _warped(x, y, 4, 101) > 0.7:
                    px[x, y] = gr
        _sprinkle(103, 22, 0.55, lambda x, y: _blob(px, x, y, 4 + hash32(x, y, 1) % 3, 2 + hash32(x, y, 2) % 2, rock, rlt, C('#5e6058')))

        def fissure(x, y):
            for k2 in range(6):
                _put(px, x + k2, y + (k2 * 2) // 3, crack)
        _sprinkle(105, 28, 0.4, fissure)
    return img


def tex_swamp(tier=0):
    p = PAL['swamp_d1' if tier else 'swamp']
    img, px = _banded(p['tones'], 103 + tier * 2, cells=(3, 7))
    water, water2, lt = C(p['water']), C(p['water2']), C(p['water_lt'])
    w_ = [[False] * TEX for _ in range(TEX)]
    ch = 0.07 if tier else 0.05
    for y in range(TEX):
        for x in range(TEX):
            v = _warped(x, y, 3, 107)
            pool = 0.65 * tnoise(x, y, TEX, 4, 111) + 0.35 * tnoise(x, y, TEX, 9, 113)
            if abs(v - 0.5) < ch or pool > (0.66 if tier else 0.72):
                w_[y][x] = True
                px[x, y] = water2 if (abs(v - 0.5) < ch * 0.4 or pool > 0.74) else water
    for y in range(TEX):                                  # lit lip on the top-left of each murky pool
        for x in range(TEX):
            if w_[y][x] and not w_[(y - 1) % TEX][(x - 1) % TEX]:
                px[x, y] = lt
    _tufts(px, p, 115, 14, 0.4)
    return img


def tex_tundra(tier=0):
    p = PAL['tundra_d1' if tier else 'tundra']
    img, px = _banded(p['tones'], 121 + tier * 2, cells=(3, 7))
    shade = C(p['shade'])
    for y in range(TEX):
        for x in range(TEX):
            if _warped(x, y, 4, 125) > (0.62 if tier else 0.7):
                px[x, y] = shade
    for y in range(TEX):                                  # speckled snow
        for x in range(TEX):
            r = hash32(x, y, 127) % 100
            if r < 6:
                px[x, y] = C(p['spark'])
            elif r < 14:
                px[x, y] = shade

    if tier:
        def crack(x, y):
            for k in range(7):
                _put(px, x + k, y + (k // 2) - (k % 2), C(p['crack']))
        _sprinkle(129, 26, 0.5, crack)
    return img


def tex_coast():
    p = PAL['coast']
    img, px = _banded(p['tones'], 141, cells=(3, 6))
    dk = C(p['dk'])
    for y in range(TEX):
        for x in range(TEX):
            if _warped(x, y, 3, 143) > 0.68:
                px[x, y] = dk
            r = hash32(x, y, 145) % 100
            if r < 5:
                px[x, y] = C(p['speck'])
            elif r < 8:
                px[x, y] = C(p['lt'])
    rip = C(p['ripple'])

    def ripple(x, y):
        for k in range(7):
            _put(px, x + k, y + (1 if 2 <= k <= 4 else 0), rip)
    _sprinkle(147, 24, 0.4, ripple)
    return img


def tex_lake(tier=0):
    p = PAL[('lake', 'lake_d1', 'lake_d2')[tier]]
    img, px = _banded(p['tones'], 51 + tier * 6, cells=(3, 6))
    if tier == 2:
        ab = C(p['abyss'])
        for y in range(TEX):
            for x in range(TEX):
                if _warped(x, y, 3, 59) > 0.66:
                    px[x, y] = ab
    tick = C(p['tick'])

    def wave(x, y):
        for k in range(4):
            _put(px, x + k, y, tick)
        _put(px, x + 1, y - 1, tick)
    _sprinkle(61 + tier, 14, 0.3, wave)
    return img


def tex_yard():
    p = PAL['yard']
    img, px = _banded(p['tones'], 161, cells=(3, 6))
    for gy in range(0, TEX, 12):
        for gx in range(0, TEX, 12):
            jx, jy = hash32(gx, gy, 3) % 3 - 1, hash32(gx, gy, 4) % 3 - 1
            _blob(px, gx + 6 + jx, gy + 6 + jy, 4, 3, C(p['cobble']), C(p['cobble_lt']), C(p['cobble_sh']))
    _sprinkle(163, 8, 0.3, lambda x, y: _put(px, x, y, C(p['mortar'])))
    return img


def tex_castle():
    p = PAL['castle']
    img, px = _banded(p['tones'], 171, cells=(3, 6))
    line, lt = C(p['line']), C(p['slab_lt'])
    for y in range(TEX):
        for x in range(TEX):
            row = y // 24
            xo = (x + (12 if row % 2 else 0)) % 24
            if y % 24 == 0 or xo == 0:
                px[x, y] = line
            elif y % 24 == 1 or xo == 1:
                px[x, y] = lt if (x + y) % 3 else px[x, y]
    return img


def tex_mist():
    p = PAL['mist']
    img, px = _banded(p['tones'], 71, cells=(2, 5), mix=(0.7, 0.3))
    for y in range(TEX):
        for x in range(TEX):
            if hash32(x, y, 73) % 100 < 2:
                px[x, y] = C(p['spark'])
    return img


TEXTURES = {
    'plains': tex_plains, 'forest': tex_forest, 'forest_d1': lambda: tex_forest(1),
    'hills': tex_hills, 'hills_d1': lambda: tex_hills(1), 'hills_d2': lambda: tex_hills(2),
    'swamp': tex_swamp, 'swamp_d1': lambda: tex_swamp(1),
    'tundra': tex_tundra, 'tundra_d1': lambda: tex_tundra(1),
    'yard': tex_yard, 'castle': tex_castle,
    'coast': tex_coast, 'lake': tex_lake, 'lake_d1': lambda: tex_lake(1), 'lake_d2': lambda: tex_lake(2), 'mist': tex_mist,
}
_TEX_CACHE = {}


def texture(name):
    if name not in _TEX_CACHE:
        _TEX_CACHE[name] = TEXTURES[name]()
    return _TEX_CACHE[name]


# ------------------------------------------------------------------ rims
CLIFF = dict(lip='#c8cac0', lip_sh='#a4a69c', face='#6c706e', face_lo='#505455', mark='#3e4244', outline='#2c3032')


def _cliff(sd, lit, r, x, y, level):
    fw = (3.2, 4.5, 6)[level]
    if sd < 0:
        reach = fw if lit < -0.1 else 1.4
        if sd >= -reach:
            col = CLIFF['face'] if sd >= -reach * 0.5 else CLIFF['face_lo']
            if (x * 5 + y * 3) % 7 == 0 and reach > 2:
                col = CLIFF['mark']
            return C(col)
        if sd >= -reach - 1.2:
            return C(CLIFF['outline'])
        return None
    if sd < 1.6:
        return C(CLIFF['lip']) if lit > 0.15 else C(CLIFF['lip_sh'])
    return None


def _feather(p, sd, r):
    """The land side of a bank frays into the ground beside it: dithered pixels of the bank tone, thinning out over 2.5px, so a
    shore never ends in a ruler-straight line."""
    if -8.0 < sd <= -5.5 and r < 0.5 * (8.0 + sd) / 2.5:
        return C(p['fringe'])
    return None


def _paint_frost(p, sd, r):
    """Lake shore beside tundra: packed slush and snow on the bank, a pale ice shelf with hairline cracks on the water."""
    if sd < 0:
        if sd >= -2:
            return C(p['slush'])
        if sd >= -5.5:
            return C(p['crystal']) if r < 0.04 else C(p['snow'])
        return _feather(p, sd, r)
    if sd < 1.6:
        return C(p['ice']) if r > 0.25 else C(p['ice2'])
    if sd < 4.4:
        return C(p['ice']) if r < 0.05 else C(p['crack']) if r > 0.93 else C(p['sheet'])
    return None


def _paint_bog(p, sd, r):
    """Lake shore beside a swamp: black mud and moss clumps on the bank, a green scum line and murky water with a purple taint."""
    if sd < 0:
        if sd >= -2:
            return C(p['mud'])
        if sd >= -5.5:
            return C(p['clump']) if r < 0.05 else C(p['pit']) if r < 0.09 else C(p['moss_mud'])
        return _feather(p, sd, r)
    if sd < 1.4:
        return C(p['scum']) if r > 0.25 else C(p['scum2'])
    if sd < 3.0:
        return C(p['taint']) if r > 0.965 else C(p['murk'])
    return None


def _paint(style, sd, lit, r, x, y):
    """RGBA (or None) for one pixel of the rim overlay. sd > 0 is inside the body, lit > 0 faces the top-left light."""
    p = PAL[style]
    fam = style.split('_')[0]
    tier = int(style[-1]) if style[-2:] in ('d1', 'd2') else 0
    if fam == 'plains':
        if 0 <= sd < 1.6:
            return C(p['edge'])
        if -1.8 <= sd < 0 and r < 0.35:
            return C(p['tuft']) if r < 0.2 else C(p['tuft_lt'])
    elif fam == 'forest':
        if tier:
            return None
        if 0 <= sd < 1.6:
            return C(p['edge'])
        if -1.8 <= sd < 0 and r < 0.3:
            return C(p['tuft'])
    elif fam == 'hills':
        return _cliff(sd, lit, r, x, y, tier)
    elif fam == 'swamp':
        if tier:
            return None
        if 0 <= sd < 1.8:
            return C(p['edge'])
        if -2 <= sd < 0 and r < 0.45:
            return C(p['dk'])
    elif fam == 'tundra':
        if tier:
            return None
        if 0 <= sd < 1.6:
            return C(p['edge']) if lit > -0.2 else C(p['rim_sh'])
        if -2.4 <= sd < 0 and lit < 0.1:
            return C(p['rim_sh']) if r < 0.65 else None
    elif fam == 'coast':
        if 0 <= sd < 1.6:
            return C(p['edge'])
        if -1.6 <= sd < 0 and r < 0.35:
            return C(p['speck'])
    elif fam == 'lake':
        if tier:
            if 0 <= sd < 1.6:
                return C(p['edge'])
            return None
        if sd < 0:
            if sd >= -2:
                return C(p['wet'])
            if sd >= -5.5:
                return C(p['pebble']) if r < 0.035 else C(p['sand'])
            return _feather(p, sd, r)
        if sd < 1.4:
            return C(p['foam']) if r > 0.25 else C(p['foam2'])
        if sd < 3.0:
            return C(p['band'])
    elif fam in ('yard', 'castle'):
        if sd < 0:
            return C(p['outline']) if sd >= -1.2 else None
        if sd < 1.2:
            return C(p['lip']) if lit > 0.15 else C(p['lip_sh'])
        if sd < 3.2:
            return C(p['mark']) if (x + y) % 7 == 0 else C(p['face'])
        if sd < 4.2:
            return C(p['inner'])
    elif fam == 'mist':
        if 0 <= sd < 2.4:
            return C(p['edge'])
        if 2.4 <= sd < 4.4 and r < 0.5:
            return C(p['edge2'])
    return None


_CELL_CACHE = {}
_SHORE_CACHE = {}


def render_shore(kind, mask, sub, variant):
    """Rim overlay (RGBA) of a lake shore cell beside tundra ('frost') or a swamp ('bog'). `sub` holds the bits of the cell's
    corners that are that land. The ordinary sand shore is dithered into the tinted one by the bilinear weight of those corners,
    so the tint fades in from the corner and carries on across the borders of the neighbouring cells (they share the corners)."""
    key = (kind, mask, sub, variant)
    if key in _SHORE_CACHE:
        return _SHORE_CACHE[key]
    st = STYLES['lake']
    sh = shape(mask, seed=3 + variant * 17 + sum(map(ord, 'lake')) % 29, amp=st['amp'], lobe=st['lobe'])
    p_base, p_alt = PAL['lake'], PAL['lake_' + kind]
    alt = _paint_frost if kind == 'frost' else _paint_bog
    nw, ne, sw, se = (sub & 1) != 0, (sub & 2) != 0, (sub & 4) != 0, (sub & 8) != 0
    rim = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    rp = rim.load()
    for y in range(CELL):
        v = y / (CELL - 1)
        for x in range(CELL):
            u = x / (CELL - 1)
            w = (1 - u) * (1 - v) * nw + u * (1 - v) * ne + (1 - u) * v * sw + u * v * se
            sd = sh['sd'][y][x]
            r = rnd01(x, y, mask * 7 + variant)
            col = alt(p_alt, sd, r) if rnd01(x, y, 991) < min(1.0, w * 1.5) else _paint('lake', sd, sh['lit'][y][x], r, x, y)
            if col:
                rp[x, y] = col
    _SHORE_CACHE[key] = rim
    return rim



def render_cell(style, mask, variant):
    """(body alpha 'L' image, rim RGBA image) for a shape. Rim pixels may lie outside the body (banks, cliff faces)."""
    key = (style, mask, variant)
    if key in _CELL_CACHE:
        return _CELL_CACHE[key]
    st = STYLES[style]
    sh = (shape_square(mask) if st.get('square') else
          shape(mask, seed=3 + variant * 17 + sum(map(ord, style)) % 29, amp=st['amp'], lobe=st['lobe']))
    body = Image.new('L', (CELL, CELL), 0)
    rim = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    bp, rp = body.load(), rim.load()
    for y in range(CELL):
        for x in range(CELL):
            sd = sh['sd'][y][x]
            if sd >= 0:
                bp[x, y] = 255
            col = _paint(style, sd, sh['lit'][y][x], rnd01(x, y, mask * 7 + variant), x, y)
            if col:
                rp[x, y] = col
    _CELL_CACHE[key] = (body, rim)
    return body, rim


# ------------------------------------------------------------------ unexplored marker (toned down)
def unknown_mark():
    rows = ['..#####..', '.#######.', '##.....##', '##.....##', '.......##', '......##.', '.....##..',
            '....##...', '....##...', '.........', '....##...', '....##...']
    img = Image.new('RGBA', (11, 14), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '#':
                img.putpixel((x + 1, y + 1), C('#b4c4e4') if x + y < 9 else C('#8ea2cc'))
    src = img.copy()
    sp, dp = src.load(), img.load()
    for y in range(14):
        for x in range(11):
            if sp[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < 11 and 0 <= ny < 14 and sp[nx, ny][3]:
                    dp[x, y] = C('#1c2a58')
                    break
    return img
