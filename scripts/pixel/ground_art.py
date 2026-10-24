"""Fog-of-war cloud tiles (the two drifting mist layers behind the map). The biome terrain itself lives in terrain_art.py."""
from PIL import Image
from common import hexc as C  # noqa: F401  (kept for callers that import it from here)
from fog import tnoise


def cloud_tile(size, seed, levels, base=None, edge=None, cells=(2, 4), warp=0.0, edge_from=1):
    """Flat-banded cartoon clouds that tile. levels = [(threshold, colour), ...] ascending; pixels below the first
    threshold get `base` (or stay transparent). `edge` lights the top-left rim of each higher band."""
    grid = [[0] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            xs, ys = x, y
            if warp:
                xs += (tnoise(x, y, size, 3, seed + 3) - 0.5) * warp
                ys += (tnoise(x, y, size, 3, seed + 5) - 0.5) * warp
            v = 0.6 * tnoise(xs, ys, size, cells[0], seed) + 0.4 * tnoise(xs, ys, size, cells[1], seed + 9)
            grid[y][x] = sum(1 for th, _ in levels if v >= th)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            lvl = grid[y][x]
            if lvl == 0:
                if base:
                    px[x, y] = base
                continue
            col = levels[lvl - 1][1]
            if edge and lvl >= edge_from and grid[(y - 1) % size][(x - 1) % size] < lvl:
                col = edge
            px[x, y] = col
    return img


def fog(size=48, seed=3, tint=(120, 150, 200), thresholds=(0.42, 0.50, 0.58), alphas=(14, 28, 46)):
    """Fog of war: puffy flat-banded clouds at low resolution (shown 3x so every pixel is a chunky block).
    Transparent between clouds; two layers of different sizes hide the repeat."""
    levels = [(th, tint + (a,)) for th, a in zip(thresholds, alphas)]
    return cloud_tile(size, seed, levels, base=None, edge=None, cells=(3, 6), warp=3)
