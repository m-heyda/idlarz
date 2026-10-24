"""Terrain placement logic with no imaging: layers per dual cell, tile depth, props and docks.

src/utils/terrain.ts is a line-for-line port of this file (integer maths only, so both produce identical results);
terrain_build.py writes a `parity` block into the manifest and tests/terrain.test.ts checks the port against it.
`m` is the manifest dict (see terrain_build.py): sprite sizes, prop tables, rank, depth limits.
"""
from terrain_field import hash32

CELL = 48
NW, NE, SW, SE = 1, 2, 4, 8
RANK = ['mist', 'coast', 'plains', 'swamp', 'tundra', 'grounds', 'forest', 'hills', 'lake', 'yard', 'castle']
MAX_DEPTH = {'forest': 1, 'hills': 2, 'swamp': 1, 'tundra': 1, 'lake': 2}
LAND = ('plains', 'forest', 'hills', 'swamp', 'tundra', 'coast')
SIDES = ((0, -1, 'n'), (1, 0, 'e'), (0, 1, 's'), (-1, 0, 'w'))
DOCK_PCT = 55


def at(g, x, y):
    return g[min(max(y, 0), len(g) - 1)][min(max(x, 0), len(g[0]) - 1)]


def depth(g, x, y):
    """How many rings (1..MAX_DEPTH) around the tile share its ground; 0 on edges and for flat grounds."""
    me = at(g, x, y)
    d = 0
    for r in range(1, MAX_DEPTH.get(me, 0) + 1):
        if all(at(g, x + dx, y + dy) == me for dx in range(-r, r + 1) for dy in range(-r, r + 1)):
            d = r
        else:
            break
    return d


def cell_layers(g, cx, cy):
    """[(style, mask, variant)] bottom-up for dual cell (cx, cy); corners are tiles NW=(cx-1,cy-1) ... SE=(cx,cy)."""
    corners = [(NW, cx - 1, cy - 1), (NE, cx, cy - 1), (SW, cx - 1, cy), (SE, cx, cy)]
    info = [(bit, at(g, x, y), depth(g, x, y)) for bit, x, y in corners]
    present = sorted({gr for _, gr, _ in info if gr}, key=RANK.index)
    layers = []
    for gr in present:
        mask = sum(bit for bit, other, _ in info if other and RANK.index(other) >= RANK.index(gr))
        layers.append((gr, mask, hash32(cx, cy, RANK.index(gr)) % 2))
    full = [i for i, layer in enumerate(layers) if layer[1] == 15]
    out = []
    for i, (gr, mask, var) in enumerate(layers):
        if full and i < full[-1]:
            continue
        out.append((gr, mask, var))
        for tier in range(1, MAX_DEPTH.get(gr, 0) + 1):
            dmask = sum(bit for bit, other, d in info if other == gr and d >= tier)
            if dmask:
                out.append((f'{gr}_d{tier}', dmask, var))
    return out


# Foundation of a building tile: the land biome most common among its 8 neighbours (a lake counts as coast, so a
# lakeside plot stands on sand); ties go to the earlier entry; no land around -> plains.
FOUNDATION_ORDER = ('hills', 'forest', 'tundra', 'swamp', 'plains', 'coast')
PAD_VARIANTS = 2


def foundation(owned, x, y):
    h, w = len(owned), len(owned[0])
    counts = dict.fromkeys(FOUNDATION_ORDER, 0)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = x + dx, y + dy
            if (dx or dy) and 0 <= nx < w and 0 <= ny < h:
                name = owned[ny][nx]
                name = 'coast' if name == 'lake' else name
                if name in counts:
                    counts[name] += 1
    best = max(counts.values())
    if best == 0:
        return 'plains'
    return next(b for b in FOUNDATION_ORDER if counts[b] == best)


def ground_grid(owned):
    """owned: rows of ground name or None ('building' = a built-on grounds tile, which takes its neighbours' biome as
    foundation) -> adds 'mist' for unowned tiles 4-adjacent to an owned one."""
    h, w = len(owned), len(owned[0])
    g = [row[:] for row in owned]
    for y in range(h):
        for x in range(w):
            if owned[y][x] == 'building':
                g[y][x] = foundation(owned, x, y)
    for y in range(h):
        for x in range(w):
            if owned[y][x] is None and any(0 <= x + dx < w and 0 <= y + dy < h and owned[y + dy][x + dx] is not None
                                           for dx, dy, _ in SIDES):
                g[y][x] = 'mist'
    return g


def _gap2(rx0, ry0, box):
    bx0, by0, bx1, by1 = box
    gx = max(rx0 - bx1, bx0 - (rx0 + CELL), 0)
    gy = max(ry0 - by1, by0 - (ry0 + CELL), 0)
    return gx * gx + gy * gy


def fits(g, x, y, box, margin, ground):
    """Box (tile-local px, may extend outside the tile) keeps `margin` px from every neighbouring tile of another ground."""
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if (dx or dy) and at(g, x + dx, y + dy) != ground and _gap2(dx * CELL, dy * CELL, box) < margin * margin:
                return False
    return True


def _pick(opts, h):
    total = sum(o[1] for o in opts)
    n = h % total
    for o in opts:
        if n < o[1]:
            return o
        n -= o[1]


def tile_sprites(m, g, x, y):
    """[(sprite_id, world_x, world_y_bottom)] for tile (x, y): 0..3 props anchored at their base centre."""
    me = at(g, x, y)
    table = m['props'].get(me)
    if not table:
        return []
    d = depth(g, x, y)
    probs = table['deep'] if d else table['edge']                 # thousandths for 0, 1, 2.. props
    roll = hash32(x, y, 500) % 1000
    count, acc = len(probs) - 1, 0
    for i, p in enumerate(probs):
        acc += p
        if roll < acc:
            count = i
            break
    opts = [o for o in table['opts'] if d >= o[2]]                 # [sprite_id, weight, min_depth]
    if me == 'mist':
        opts = [o for o in opts if m['sprites'][o[0]][2] <= 18]
    out, anchors = [], []
    for k in range(count):
        o = _pick(opts, hash32(x, y, 510 + k))
        sw, sh = m['sprites'][o[0]][2], m['sprites'][o[0]][3]
        for attempt in range(4):
            if me == 'mist':                                       # fog tiles keep their centre for the '?' marker
                slot = hash32(x, y, 520 + k * 5 + attempt) % 4
                px = 3 if slot % 2 == 0 else CELL - sw - 3
                py = 3 if slot < 2 else CELL - sh - 3
                cx, cy = px + sw // 2, py + sh
            else:
                cx = 5 + hash32(x, y, 520 + k * 5 + attempt) % (CELL - 10)
                cy = 12 + hash32(x, y, 540 + k * 5 + attempt) % (CELL - 14)
                px, py = cx - sw // 2, cy - sh
            if any((cx - ax) ** 2 + (cy - ay) ** 2 < 169 for ax, ay in anchors):
                continue
            if fits(g, x, y, (px, py, px + sw, py + sh), 2 if me == 'mist' else 6 if sh < 20 else 4, me):
                anchors.append((cx, cy))
                out.append((o[0], x * CELL + px, y * CELL + py + sh))
                break
    return out


def _overlaps(a, b, margin):
    return a[0] < b[2] + margin and b[0] < a[2] + margin and a[1] < b[3] + margin and b[1] < a[3] + margin


def tile_decor(m, g, x, y, props):
    """Tiny decorations (flowers on plains, fallen trees on swamps): a second hash pass that never moves the props.
    `props` are this tile's prop placements; decor keeps clear of them and of the neighbouring grounds."""
    me = at(g, x, y)
    table = (m.get('decor') or {}).get(me)
    if not table:
        return []
    d = depth(g, x, y)
    probs = table['deep'] if d else table['edge']
    roll = hash32(x, y, 700) % 1000
    count, acc = len(probs) - 1, 0
    for i, p in enumerate(probs):
        acc += p
        if roll < acc:
            count = i
            break
    opts = [o for o in table['opts'] if d >= o[2]]
    boxes = [(px - x * CELL, bottom - m['sprites'][pid][3] - y * CELL, px - x * CELL + m['sprites'][pid][2], bottom - y * CELL)
             for pid, px, bottom in props]
    out = []
    for k in range(count):
        o = _pick(opts, hash32(x, y, 710 + k))
        sw, sh = m['sprites'][o[0]][2], m['sprites'][o[0]][3]
        for attempt in range(6):
            px = 2 + hash32(x, y, 720 + k * 7 + attempt) % (CELL - sw - 4)
            py = 2 + hash32(x, y, 760 + k * 7 + attempt) % (CELL - sh - 4)
            box = (px, py, px + sw, py + sh)
            if any(_overlaps(box, b, 2) for b in boxes) or not fits(g, x, y, box, 3, me):
                continue
            boxes.append(box)
            out.append((o[0], x * CELL + px, y * CELL + py + sh))
            break
    return out


def dock_at(m, g, x, y):
    """A pier (sometimes with a boat) on a lake tile with exactly one land side; only a local maximum of the roll."""
    def eligible(tx, ty):
        if at(g, tx, ty) != 'lake':
            return None
        land = [(dx, dy, d) for dx, dy, d in SIDES if at(g, tx + dx, ty + dy) != 'lake']
        if len(land) != 1 or at(g, tx + land[0][0], ty + land[0][1]) not in LAND:
            return None
        dx, dy, _ = land[0]                                         # the diagonals on the water side must be water too
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                if (ox, oy) != (0, 0) and (ox * dx + oy * dy) <= 0 and at(g, tx + ox, ty + oy) != 'lake':
                    return None
        return land[0]

    land = eligible(x, y)
    if not land or hash32(x, y, 300) % 100 >= DOCK_PCT:
        return []
    mine = hash32(x, y, 301)
    for ox in range(-2, 3):
        for oy in range(-2, 3):
            if (ox or oy) and eligible(x + ox, y + oy) and hash32(x + ox, y + oy, 300) % 100 < DOCK_PCT and hash32(x + ox, y + oy, 301) >= mine:
                return []
    dx, dy, d = land
    length = (22, 26, 30)[hash32(x, y, 302) % 3]
    barrel = 1 if hash32(x, y, 303) % 3 == 0 else 0
    pid = f'pier_{d}_{length}_{barrel}'
    w, h = m['sprites'][pid][2], m['sprites'][pid][3]
    off = 8 + hash32(x, y, 304) % (CELL - 16 - (w if d in 'ns' else h))
    if d == 's':
        px, py = x * CELL + off, (y + 1) * CELL + 7 - h
    elif d == 'n':
        px, py = x * CELL + off, y * CELL - 7
    elif d == 'e':
        px, py = (x + 1) * CELL + 7 - w, y * CELL + off
    else:
        px, py = x * CELL - 7, y * CELL + off
    out = [(pid, px, py + h)]
    if hash32(x, y, 305) % 3 == 0:                                  # a rowboat moored beside the pier
        bid = 'boat_v' if d in 'ns' else 'boat_h'
        bw, bh = m['sprites'][bid][2], m['sprites'][bid][3]
        side = 1 if ((px - x * CELL) if d in 'ns' else (py - y * CELL)) < 20 else -1
        if d in 'ns':
            bx = px + (w + 1 if side > 0 else -bw - 1)
            by = py + (6 if d == 's' else h - bh - 6)
        else:
            by = py + (h + 1 if side > 0 else -bh - 1)
            bx = px + (6 if d == 'e' else w - bw - 6)
        out.append((bid, bx, by + bh))
    return out


def all_pads(owned):
    """[(pad_id, world_x, world_y)] top-left corners of the 48x48 foundation pads (drawn under every sprite)."""
    out = []
    for y, row in enumerate(owned):
        for x, name in enumerate(row):
            if name == 'building':
                out.append((f'pad_{foundation(owned, x, y)}_{hash32(x, y, 600) % PAD_VARIANTS}', x * CELL, y * CELL))
    return out


def built_set(owned):
    """Coordinates of building tiles (they carry no props: the building stands there)."""
    return {(x, y) for y, row in enumerate(owned) for x, name in enumerate(row) if name == 'building'}


def all_sprites(m, g, built=None):
    """Every sprite of the map as (sprite_id, world_x, world_y_bottom), in draw order (bottom edge, then x)."""
    items = []
    for y in range(len(g)):
        for x in range(len(g[0])):
            props = [] if built and (x, y) in built else tile_sprites(m, g, x, y)
            items += props + ([] if built and (x, y) in built else tile_decor(m, g, x, y, props)) + dock_at(m, g, x, y)
    return sorted(items, key=lambda it: (it[2], it[1]))
