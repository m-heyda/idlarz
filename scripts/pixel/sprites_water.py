"""Ripple strips for the map's water (WaterLayer.tsx): a small ring that opens up, breaks apart and rests.

8 frames, hard alpha, no outline (a ripple is just light on the water). `water_ripple` is for lakes (16x6 frames),
`water_ripple_swamp` for the murky swamp pools (12x5 frames, greener). '#' is the light tone, 'o' the mid tone.
"""
from PIL import Image
from common import hexc as C

FRAMES = 8

LAKE = [
    ['................', '................', '.......##.......', '.......##.......', '................', '................'],
    ['................', '......####......', '.....#....#.....', '.....#....#.....', '......####......', '................'],
    ['................', '....########....', '...#........#...', '...#........#...', '....########....', '................'],
    ['.....oooooo.....', '..ooo......ooo..', '.o............o.', '.o............o.', '..ooo......ooo..', '.....oooooo.....'],
]
SWAMP = [
    ['............', '............', '.....##.....', '............', '............'],
    ['............', '....####....', '...#....#...', '....####....', '............'],
    ['............', '..########..', '.#........#.', '..########..', '............'],
    ['...oooooo...', '.oo......oo.', 'o..........o', '.oo......oo.', '...oooooo...'],
]


def _fade(rows, keep):
    """The ring breaking up: keep one pixel in `keep` (a fixed pattern, so every frame is reproducible)."""
    return [''.join(ch if ch != '.' and (x * 3 + y * 5) % keep == 0 else '.' for x, ch in enumerate(row)) for y, row in enumerate(rows)]


def _strip(frames, light, mid):
    w, h = len(frames[0][0]), len(frames[0])
    img = Image.new('RGBA', (w * FRAMES, h), (0, 0, 0, 0))
    cols = {'#': C(light), 'o': C(mid)}
    # 4 drawn frames, then the same ring thinning out twice, then two empty frames so it rests between pulses
    seq = frames + [_fade(frames[-1], 2), _fade(frames[-1], 4), None, None]
    for f, rows in enumerate(seq):
        for y, row in enumerate(rows or []):
            for x, ch in enumerate(row):
                if ch in cols:
                    img.putpixel((f * w + x, y), cols[ch])
    return img


def water_ripple():
    return _strip(LAKE, '#e2f7ff', '#9adcf6')


def water_ripple_swamp():
    return _strip(SWAMP, '#cfe08a', '#9bb556')


SHIMMER_FRAMES = 4
SHIMMER_CELL = 48


def water_shimmer():
    """A whole tile of open water, 4 frames: short light dashes that swell, drift a pixel to the right and fade.

    WaterLayer lays one over every open-water lake tile (flipped and delayed per tile, so no two look alike). A dash is
    light on the water, no outline; the layer shows it at half strength, so it reads as a soft glitter on the surface.
    """
    import random
    rng = random.Random(7)  # fixed seed: the same strip every build
    light, mid = C('#e2f7ff'), C('#9adcf6')
    spots = []
    while len(spots) < 11:
        x, y, w = rng.randrange(5, 36), rng.randrange(4, 44), rng.choice((3, 4, 5))
        if all(abs(y - sy) >= 5 or abs(x - sx) >= 9 for sx, sy, _ in spots):
            spots.append((x, y, w))
    img = Image.new('RGBA', (SHIMMER_CELL * SHIMMER_FRAMES, SHIMMER_CELL), (0, 0, 0, 0))
    for f in range(SHIMMER_FRAMES):
        for k, (x, y, w) in enumerate(spots):
            phase = (k + f) % 4  # 0 grows, 1 full, 2 thins, 3 rests
            if phase == 3:
                continue
            length, colour = {0: (w - 2, mid), 1: (w, light), 2: (w - 2, mid)}[phase]
            for i in range(max(length, 2)):
                img.putpixel((f * SHIMMER_CELL + x + f + i, y), colour)
    return img


SPRITES = {'water_ripple': water_ripple, 'water_ripple_swamp': water_ripple_swamp, 'water_shimmer': water_shimmer}
