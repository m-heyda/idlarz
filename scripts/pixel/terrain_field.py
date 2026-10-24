"""Dual-grid shape fields for the terrain layer.

A dual cell is 48x48 px and sits on the corner shared by four map tiles (cell corners = tile centres). The
shape index says which of the four corner tiles belong to a ground: NW=1, NE=2, SW=4, SE=8. For every shape
we build a smooth scalar field f (1 at the set corners, 0 at the others, wobbled by noise that is zero on the
cell border so neighbouring cells always meet). The ground's body is f >= 0.5; rims are bands of the signed
distance estimate sd = (f - 0.5) / |grad f| (px, positive inside).
"""
from fog import tnoise

CELL = 48
NW, NE, SW, SE = 1, 2, 4, 8
_CACHE = {}


def hash32(x, y, salt=0):
    """32-bit integer mix. Mirrored by tileHash in src/utils/terrain.ts (Math.imul based)."""
    m = 0xFFFFFFFF
    h = ((x * 0x27D4EB2D) & m) ^ ((y * 0x165667B1) & m) ^ ((salt * 0x9E3779B1) & m)
    h ^= h >> 15
    h = (h * 0x85EBCA6B) & m
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & m
    h ^= h >> 16
    return h & m


def rnd01(x, y, salt=0):
    return hash32(x, y, salt) / 4294967296.0


def _s(t):
    return t * t * (3 - 2 * t)


def shape(mask, seed=1, amp=5.0, lobe=0.0):
    """Returns dict(sd, lit) as 48x48 lists. lit in [-1, 1]: > 0 where the outward normal faces the light (top-left)."""
    key = (mask, seed, amp, lobe)
    if key in _CACHE:
        return _CACHE[key]
    n = CELL + 2
    f = [[0.0] * n for _ in range(n)]
    for j in range(n):
        py = j - 1
        cy = max(0, min(CELL - 1, py))
        for i in range(n):
            px = i - 1
            cx = max(0, min(CELL - 1, px))
            # smooth coordinate warp: ramps to zero over 8 px at every cell border so neighbouring cells always meet,
            # and stays gentle enough (slope < 1) that the field can never fold into spikes
            ramp = min(1.0, (cx + 0.5) / 8) * min(1.0, (CELL - cx - 0.5) / 8) * min(1.0, (cy + 0.5) / 8) * min(1.0, (CELL - cy - 0.5) / 8)
            dx = ((tnoise(cx, cy, CELL, 2, seed) - 0.5) * 2 * amp + (tnoise(cx, cy, CELL, 8, seed + 3) - 0.5) * 2.4) * ramp
            dy = ((tnoise(cx, cy, CELL, 2, seed + 1) - 0.5) * 2 * amp + (tnoise(cx, cy, CELL, 8, seed + 4) - 0.5) * 2.4) * ramp
            u = min(1.0, max(0.0, (px + dx + 0.5) / CELL))
            v = min(1.0, max(0.0, (py + dy + 0.5) / CELL))
            su, sv = _s(u), _s(v)
            val = 0.0
            if mask & NW:
                val += (1 - su) * (1 - sv)
            if mask & NE:
                val += su * (1 - sv)
            if mask & SW:
                val += (1 - su) * sv
            if mask & SE:
                val += su * sv
            if mask in (6, 9):
                val += 0.07 * 16 * u * (1 - u) * v * (1 - v)   # saddles: keep the two corners connected
            f[j][i] = val
    sd = [[0.0] * CELL for _ in range(CELL)]
    lit = [[0.0] * CELL for _ in range(CELL)]
    for y in range(CELL):
        for x in range(CELL):
            i, j = x + 1, y + 1
            # one-sided differences on the cell border: the padding there is clamped and would halve the gradient
            gx = (f[j][i + 1] - f[j][i - 1]) / 2 if 0 < x < CELL - 1 else (f[j][i + 1] - f[j][i] if x == 0 else f[j][i] - f[j][i - 1])
            gy = (f[j + 1][i] - f[j - 1][i]) / 2 if 0 < y < CELL - 1 else (f[j + 1][i] - f[j][i] if y == 0 else f[j][i] - f[j - 1][i])
            g = max((gx * gx + gy * gy) ** 0.5, 0.004)
            d = (f[j][i] - 0.5) / g
            if lobe:
                u, v = (x + 0.5) / CELL, (y + 0.5) / CELL
                win = 16 * u * (1 - u) * v * (1 - v)
                d += lobe * (tnoise(x, y, CELL, 12, seed + 9) - 0.5) * 2 * min(1.0, 8 * win * win)
            sd[y][x] = max(-14.0, min(14.0, d))
            lit[y][x] = (gx + gy) / g * 0.7071
    out = {'sd': sd, 'lit': lit}
    _CACHE[key] = out
    return out


_OFFSETS = sorted(((dx, dy, (dx * dx + dy * dy) ** 0.5) for dx in range(-6, 7) for dy in range(-6, 7)
                   if (dx or dy) and (dx * dx + dy * dy) ** 0.5 <= 6), key=lambda o: o[2])


def shape_square(mask):
    """Square footprint for yard / castle: the union of the 24 px quadrants of the set corners (each corner tile covers
    one quadrant of the cell). Same output as shape(); the kerb is painted from sd/lit."""
    key = ('sq', mask)
    if key in _CACHE:
        return _CACHE[key]
    half = CELL // 2

    def inside(x, y):
        x, y = min(max(x, 0), CELL - 1), min(max(y, 0), CELL - 1)
        bit = (NW if x < half else NE) if y < half else (SW if x < half else SE)
        return bool(mask & bit)

    sd = [[0.0] * CELL for _ in range(CELL)]
    lit = [[0.0] * CELL for _ in range(CELL)]
    for y in range(CELL):
        for x in range(CELL):
            me = inside(x, y)
            found = None
            for dx, dy, d in _OFFSETS:
                if inside(x + dx, y + dy) != me:
                    found = (dx, dy, d)
                    break
            if not found:
                sd[y][x] = 6.5 if me else -6.5
                continue
            dx, dy, d = found
            sd[y][x] = d - 0.5 if me else -(d - 0.5)
            nx, ny = (dx / d, dy / d) if me else (-dx / d, -dy / d)    # outward normal
            lit[y][x] = -(nx + ny) * 0.7071
    out = {'sd': sd, 'lit': lit}
    _CACHE[key] = out
    return out
