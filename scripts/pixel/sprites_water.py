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


# ------------------------------------------------------------------ life on the water (WaterLayer)
def _outline(img, col):
    """1px outline around every opaque pixel (4-neighbourhood), drawn into transparent pixels only."""
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


def _sheet(frames, w, h):
    """Lay equally sized frames side by side."""
    img = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        img.alpha_composite(f, (i * w, 0))
    return img


def _rows(rows, colors, w, h, ox=0, oy=0):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors and 0 <= x + ox < w and 0 <= y + oy < h:
                img.putpixel((x + ox, y + oy), C(colors[ch]))
    return img


BUBBLE = 10


def water_bubble():
    """A corruption bubble on a swamp pool: swells, wobbles, pops in a ring of spray, rests. 8 frames of 10x10, purple with a
    viridian glint. Pure decoration."""
    cols = dict(o='#4a2480', f='#9a62d8', l='#e6ccff', g='#5ff0b4', r='#c89af0')
    n = BUBBLE
    frames = []
    for r, glint in ((0, False), (1, False), (2, False), (3, True), (3, True)):
        img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        if r:
            cx, cy = 5, 6 - (1 if r == 3 else 0)
            for y in range(n):
                for x in range(n):
                    d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                    if d <= r + 0.3:
                        img.putpixel((x, y), C(cols['o'] if d > r - 0.7 else cols['f']))
            if glint:
                img.putpixel((cx - 1, cy - 1), C(cols['l']))
                img.putpixel((cx + 1, cy + 1), C(cols['g']))
        frames.append(img)
    pop = Image.new('RGBA', (n, n), (0, 0, 0, 0))                    # the ring bursts
    for x, y in ((1, 5), (2, 3), (4, 1), (6, 1), (8, 3), (9, 5), (2, 7), (8, 7)):
        pop.putpixel((x, y), C(cols['r']))
    pop.putpixel((5, 0), C(cols['l']))
    spray = Image.new('RGBA', (n, n), (0, 0, 0, 0))                  # then a few drops fall back
    for x, y in ((0, 4), (3, 2), (7, 2), (9, 4), (4, 7), (6, 8)):
        spray.putpixel((x, y), C(cols['f'] if (x + y) % 2 else cols['g']))
    frames += [pop, spray, Image.new('RGBA', (n, n), (0, 0, 0, 0))]
    return _sheet(frames, n, n)


FALL_W, FALL_H = 16, 24


def water_fall():
    """A waterfall dropping off a hill's cliff into the lake below it, seen from the front. 4 frames of 16x24: the white
    streaks slide down the face, the foam at the foot breathes. The sprite stands half on the hill (channel and face) and
    half on the lake (foam)."""
    cols = dict(r='#6c706e', R='#8a8e8a', d='#505455', w='#ffffff', b='#7ccbf2', B='#3f9fdc', g='#4a8a3a')
    frames = []
    for f in range(4):
        img = Image.new('RGBA', (FALL_W, FALL_H), (0, 0, 0, 0))
        px = img.load()
        for y in range(0, 17):
            top = y < 5                                               # the stream gathers in a groove on the hill
            lo, hi = (5, 10) if top else (4, 11)
            for x in range(lo - 3, hi + 4):
                if x < lo or x > hi:
                    px[x, y] = C(cols['g'] if top else (cols['R'] if (x + y) % 5 == 0 else cols['r'] if x in (lo - 1, hi + 1) else cols['d']))
                else:
                    streak = ((y + f * 3 + x * 2) % 8) < 2
                    px[x, y] = C(cols['w'] if streak else cols['b'] if (x + y // 2) % 3 else cols['B'])
        for y in range(17, FALL_H):                                    # foam where the water lands
            t = y - 17
            reach = 3 + min(t, 3)
            for x in range(8 - reach, 8 + reach):
                if 0 <= x < FALL_W and ((x * 5 + y * 3 + f * 2) % 7) < 4:
                    px[x, y] = C(cols['w'] if (x + f + y) % 3 else cols['b'])
        frames.append(img)
    return _sheet(frames, FALL_W, FALL_H)


BOAT_W, BOAT_H = 20, 18


def water_boat():
    """A small sailboat under way, 2 frames of 20x18 (hull bobs a pixel, the wake sparkles). WaterLayer drifts it back and
    forth over open water and mirrors it at the turn."""
    cols = dict(k='#6a4a2a', w='#f6f0e0', s='#d4cbb4', h='#b88c58', b='#7a5a38', f='#e8f6ff', r='#c4483a')
    rows = [
        '.......k...........',
        '.......kr..........',
        '.......kw..........',
        '.......kww.........',
        '......skwww........',
        '......skwwww.......',
        '.....sskwwwww......',
        '.....sskwwwwww.....',
        '....ssskwwwwwww....',
        '.......k...........',
        '.hhhhhhhhhhhhhhhh..',
        '..hbbbbbbbbbbbbh...',
        '...hbbbbbbbbbbh....',
        '....hhhhhhhhhh.....',
    ]
    frames = []
    for f in range(2):
        img = _rows(rows, cols, BOAT_W, BOAT_H, ox=0, oy=1 + f)
        _outline(img, '#3a2a18')
        for k, (x, y) in enumerate([(2, 15), (5, 16), (9, 16), (13, 15), (16, 16)]):
            if (k + f) % 2 == 0 and y + f < BOAT_H:
                img.putpixel((x + 1, y + f), C(cols['f']))
        frames.append(img)
    return _sheet(frames, BOAT_W, BOAT_H)


DOL_POSE = 24                     # a pose is drawn centred in a 24x24 frame; WaterLayer moves it along the leap
DOL_POSES = 5
SPLASH_W, SPLASH_H, SPLASH_FRAMES = 20, 8, 4


def water_dolphin():
    """The five poses of a dolphin's leap, 24x24 each: steep up, up, level at the top, down, steep down (nose to the right).
    WaterLayer slides the pose along a parabola with CSS and swaps it as the body tilts, so the motion itself is smooth; the
    waterline is a clip, so the body rises out of the water. The body is a chain of discs along a parabola."""
    body, back, belly, dark = C('#6f98b8'), C('#46688a'), C('#cfe2ee'), C('#243e5a')
    profile = [0.6, 0.9, 1.3, 1.7, 2.0, 2.2, 2.1, 1.8, 1.4, 0.9]      # tail ... snout

    def path(u):
        return 3 + 22 * u, 30 - 15 * 4 * u * (1 - u)

    frames = []
    for head in (0.18, 0.39, 0.5, 0.61, 0.82):
        img = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
        px = img.load()
        pts, u = [], head                                                # walk back from the head, one body segment (1.5px of arc) at a time
        for _ in profile:
            pts.append(path(u))
            run = 0.0
            while run < 1.5:
                x0, y0 = path(u)
                u -= 0.002
                x1, y1 = path(u)
                run += ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        pts = pts[::-1]                                                  # tail first
        for (cx, cy), r in zip(pts, profile):
            for y in range(int(cy - r - 1), int(cy + r + 2)):
                for x in range(int(cx - r - 1), int(cx + r + 2)):
                    if 0 <= x < 48 and 0 <= y < 48 and (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.6:
                        px[x, y] = back if (y - cy) < -r * 0.25 else belly if (y - cy) > r * 0.35 else body
        tx, ty = pts[0]
        for k in range(-2, 3):                                           # tail flukes
            for j in range(2):
                x, y = int(tx - 2 + j), int(ty + k * (1 if head < 0.5 else -1) * 0.9)
                if 0 <= x < 48 and 0 <= y < 48:
                    px[x, y] = dark
        fx, fy = pts[5]                                                  # dorsal fin
        for k in range(2):
            px[int(fx), int(fy - profile[5] - k)] = dark
        hx, hy = pts[-1]
        px[int(hx + 1), int(hy - 1)] = dark                              # eye
        _outline(img, '#1b3350')
        box = img.getbbox()
        crop = img.crop(box)
        frame = Image.new('RGBA', (DOL_POSE, DOL_POSE), (0, 0, 0, 0))
        frame.alpha_composite(crop, ((DOL_POSE - crop.size[0]) // 2, (DOL_POSE - crop.size[1]) // 2))
        frames.append(frame)
    return _sheet(frames, DOL_POSE, DOL_POSE)


def water_splash():
    """Rings where the dolphin leaves and re-enters the water: 4 frames of 20x8 (small ring and drops, wider, thin and wide, gone)."""
    from math import cos, sin, pi
    light, mid = C('#f2fbff'), C('#9adcf6')
    frames = []
    for rx, ry, col, drops in ((4, 1, light, True), (7, 2, light, True), (9, 3, mid, False), (None, None, None, False)):
        img = Image.new('RGBA', (SPLASH_W, SPLASH_H), (0, 0, 0, 0))
        if rx:
            for a_ in range(0, 360, 15):
                x, y = int(10 + rx * cos(a_ * pi / 180)), int(5 + ry * sin(a_ * pi / 180))
                if 0 <= x < SPLASH_W and 0 <= y < SPLASH_H:
                    img.putpixel((x, y), col)
        if drops:
            for x, y in ((8, 1), (10, 0), (12, 1), (6, 2), (14, 2)):
                img.putpixel((x, y), light)
        frames.append(img)
    return _sheet(frames, SPLASH_W, SPLASH_H)


SPRITES = {
    'water_ripple': water_ripple, 'water_ripple_swamp': water_ripple_swamp, 'water_shimmer': water_shimmer,
    'water_bubble': water_bubble, 'water_fall': water_fall,
    'water_boat': water_boat, 'water_dolphin': water_dolphin, 'water_splash': water_splash,
}
