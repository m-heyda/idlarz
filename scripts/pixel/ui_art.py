"""2D UI art (Pillow): 9-slice frames, header chrome, HP/MP flask parts, stone XP bar, hero scene.
Everything is drawn at native pixel size and shown at integer scale (see reference/STYLE.md)."""
import math
import random
from PIL import Image, ImageDraw
from common import hexc as C, add_outline


# ----------------------------------------------------------------- 9-slice frames
def _corner_rivet(d, cx, cy):
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=C('#c9954a'))
    d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=C('#8a5f26'))
    d.point((cx - 1, cy - 1), fill=C('#fff0b8'))


def frame_modal(slice_px=12):
    """36x36 source, 12px border. Edges repeat (round) every 12px; corners carry the ornament."""
    S = slice_px * 3
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bands = [('#080504', 1), ('#d9a850', 1), ('#b07c34', 1), ('#7a5224', 1), ('#2b1d0e', 1),
             ('#4a4440', 1), ('#5e5750', 2), ('#3a352f', 1), ('#1c1814', 1), ('#080504', 1)]
    o = 0
    for col, t in bands:
        for _ in range(t):
            d.rectangle([o, o, S - 1 - o, S - 1 - o], outline=C(col))
            o += 1
    d.rectangle([slice_px, slice_px, S - 1 - slice_px, S - 1 - slice_px], fill=(0, 0, 0, 0))
    mid = slice_px * 1.5
    for (x, y) in ((mid, 6), (mid, S - 7), (6, mid), (S - 7, mid)):
        d.rectangle([int(x) - 1, int(y) - 1, int(x) + 1, int(y) + 1], fill=C('#2b2520'))
        d.point((int(x) - 1, int(y) - 1), fill=C('#7a6e60'))
    for cx, cy, sx, sy in ((0, 0, 1, 1), (S - 1, 0, -1, 1), (0, S - 1, 1, -1), (S - 1, S - 1, -1, -1)):
        pts = [(cx, cy), (cx + sx * 11, cy), (cx + sx * 11, cy + sy * 3), (cx + sx * 3, cy + sy * 3),
               (cx + sx * 3, cy + sy * 11), (cx, cy + sy * 11)]
        d.polygon(pts, fill=C('#b07c34'))
        d.line([pts[0], pts[1]], fill=C('#f0d27a'))
        d.line([pts[0], pts[5]], fill=C('#f0d27a'))
        d.line([pts[2], pts[3]], fill=C('#6a4414'))
        d.line([pts[3], pts[4]], fill=C('#6a4414'))
        d.line([pts[4], pts[5]], fill=C('#6a4414'))
        _corner_rivet(d, cx + sx * 6, cy + sy * 6)
    return img


def frame_panel():
    """12x12 source, 4px border: slim bronze inset for cards/panels."""
    S = 12
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for o, col in enumerate(('#080504', '#7a5224', '#3a2810', '#1a120c')):
        d.rectangle([o, o, S - 1 - o, S - 1 - o], outline=C(col))
    d.rectangle([4, 4, S - 5, S - 5], fill=(0, 0, 0, 0))
    for x, y in ((0, 0), (S - 1, 0), (0, S - 1), (S - 1, S - 1)):
        d.point((x, y), fill=(0, 0, 0, 0))
    for x, y in ((1, 1), (S - 2, 1), (1, S - 2), (S - 2, S - 2)):
        d.point((x, y), fill=C('#d9a850'))
    d.line([(2, 1), (S - 3, 1)], fill=C('#a8783a'))
    d.line([(1, 2), (1, S - 3)], fill=C('#a8783a'))
    return img


def frame_tip():
    """12x12 source, 4px border: brighter gold tooltip frame with accent corners."""
    S = 12
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for o, col in enumerate(('#050302', '#c08a30', '#5a3c14', '#120c08')):
        d.rectangle([o, o, S - 1 - o, S - 1 - o], outline=C(col))
    d.rectangle([4, 4, S - 5, S - 5], fill=(0, 0, 0, 0))
    for x, y in ((0, 0), (S - 1, 0), (0, S - 1), (S - 1, S - 1)):
        d.point((x, y), fill=(0, 0, 0, 0))
    for (x, y), (dx, dy) in (((1, 1), (1, 0)), ((S - 2, 1), (-1, 0)), ((1, S - 2), (1, 0)), ((S - 2, S - 2), (-1, 0))):
        d.point((x, y), fill=C('#fff0b8'))
        d.point((x + dx, y), fill=C('#f0d27a'))
    return img


# ----------------------------------------------------------------- header chrome
def header_edge():
    """64x10 bronze + iron lower border with rivets (tiles horizontally)."""
    w, h = 64, 10
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rows = ['#0a0605', '#c9954a', '#9a6a2a', '#6a4418', '#2b1d0e', '#413a33', '#352f2a', '#1c1714', '#0a0605', '#0a0605']
    for y, c in enumerate(rows):
        d.line([(0, y), (w, y)], fill=C(c))
    for x in (8, 40):
        d.rectangle([x - 1, 4, x + 1, 6], fill=C('#5a5048'))
        d.point((x - 1, 4), fill=C('#a89b8a'))
        d.point((x, 4), fill=C('#d8ccb8'))
        d.point((x + 1, 6), fill=C('#26201b'))
    for x in range(0, w, 4):
        d.point((x, 2), fill=C('#b07c34'))
    return img


def slot_frame(active=False, size=48):
    """Square icon-slot frame (bronze bevel, dark well); `active` glows gold."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    hi = '#f0c860' if active else '#a8783a'
    mid = '#c08a30' if active else '#7a5224'
    lo = '#6a4414' if active else '#3d2a14'
    d.rectangle([0, 0, size - 1, size - 1], fill=C('#0e0a08'))
    d.rectangle([1, 1, size - 2, size - 2], fill=C(mid))
    d.line([(1, 1), (size - 2, 1)], fill=C(hi))
    d.line([(1, 1), (1, size - 2)], fill=C(hi))
    d.line([(1, size - 2), (size - 2, size - 2)], fill=C(lo))
    d.line([(size - 2, 1), (size - 2, size - 2)], fill=C(lo))
    d.rectangle([3, 3, size - 4, size - 4], fill=C('#0e0a08'))
    d.rectangle([4, 4, size - 5, size - 5], fill=C('#3a2410' if active else '#17100b'))
    d.line([(4, 4), (size - 5, 4)], fill=C('#050302'))
    d.line([(4, 4), (4, size - 5)], fill=C('#050302'))
    if active:
        for i in range(5, 9):
            a = 40 - (i - 5) * 9
            d.rectangle([i, i, size - 1 - i, size - 1 - i], outline=(240, 180, 60, a))
    for x, y in ((2, 2), (size - 3, 2), (2, size - 3), (size - 3, size - 3)):
        d.point((x, y), fill=C('#e8d29a'))
    return img


def header_divider(h=56):
    img = Image.new('RGBA', (9, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cy = h // 2
    d.line([(4, 2), (4, cy - 6)], fill=C('#5a3f1c'))
    d.line([(4, cy + 6), (4, h - 3)], fill=C('#5a3f1c'))
    d.line([(5, 2), (5, cy - 6)], fill=C('#1a120a'))
    d.line([(5, cy + 6), (5, h - 3)], fill=C('#1a120a'))
    d.polygon([(4, cy - 5), (8, cy), (4, cy + 5), (0, cy)], fill=C('#8a5f26'))
    d.polygon([(4, cy - 3), (6, cy), (4, cy + 3), (2, cy)], fill=C('#e0b23a'))
    d.point((4, cy - 1), fill=C('#fff0a0'))
    return add_outline(img)


def header_xp_frame(w=96):
    """Slim bronze XP bar frame used in the header profile."""
    img = Image.new('RGBA', (w, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, 9], fill=C('#0e0a08'))
    d.rectangle([1, 1, w - 2, 8], fill=C('#8a5f26'))
    d.line([(1, 1), (w - 2, 1)], fill=C('#d9a850'))
    d.line([(1, 8), (w - 2, 8)], fill=C('#4a3014'))
    d.rectangle([2, 2, w - 3, 7], fill=C('#0e0a08'))
    d.rectangle([3, 3, w - 4, 6], fill=C('#1d1511'))
    for x in (0, w - 1):
        d.point((x, 0), fill=(0, 0, 0, 0))
        d.point((x, 9), fill=(0, 0, 0, 0))
    d.point((1, 1), fill=C('#f0d890'))
    d.point((w - 2, 1), fill=C('#f0d890'))
    return img


def header_xp_fill():
    img = Image.new('RGBA', (2, 4), (0, 0, 0, 0))
    for y, c in enumerate(['#9be26a', '#5fbf3e', '#3f9a2c', '#2a6e1e']):
        for x in range(2):
            img.putpixel((x, y), C(c))
    return img


# ----------------------------------------------------------------- stone XP bar (character HUD)
def bar_frame():
    """16x14 source, 4px border: chiselled stone trough with a dark recess. Slice 4, edges repeat."""
    W, H, B = 16, 14, 4
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    rnd = random.Random(21)
    for y in range(H):
        for x in range(W):
            edge = min(x, y, W - 1 - x, H - 1 - y)
            if edge >= B:
                continue                                    # recess stays transparent
            if edge == 0:
                col = '#0a0806'
            elif edge == 1:                                 # chiselled bevel
                col = '#b8aa96' if (y <= x and y < H - 1 - x) or (x < y and x < W - 1 - y and y < H // 2) else '#5a4e42'
                if y < x and y <= H - 1 - y and (y == 1):
                    col = '#a89a86'
                elif x == 1 or y == 1:
                    col = '#a89a86'
                else:
                    col = '#5a4e42'
            elif edge == 2:
                col = ['#8a7c6a', '#7a6e5e', '#968a78', '#6e6254'][rnd.randrange(4)]
            else:
                col = '#0a0806'                              # inner shadow line
            px[x, y] = C(col)
    for x, y in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        px[x, y] = (0, 0, 0, 0)
    return img


def bar_fill():
    """8x6 tile: stepped emerald bands with a bright top line and glints (repeat-x, scrolls in CSS)."""
    rows = ['#d4ff96', '#8fe04a', '#6cc83a', '#4fb030', '#3a9028', '#236a1e']
    img = Image.new('RGBA', (8, 6), (0, 0, 0, 0))
    for y, col in enumerate(rows):
        for x in range(8):
            img.putpixel((x, y), C(col))
    for x, y in ((1, 1), (2, 1), (5, 2), (6, 2)):          # glints
        img.putpixel((x, y), C('#f2ffc8'))
    for x in (3, 7):                                          # segment seams
        for y in range(2, 6):
            img.putpixel((x, y), C('#2e8426'))
    return img


# ----------------------------------------------------------------- hero scene (stone alcove, 144x96)
SCENE_W, SCENE_H = 144, 112


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def hero_scene():
    """Dark brick wall, an arched niche and a worn stone floor - the stage the hero stands on."""
    img = Image.new('RGBA', (SCENE_W, SCENE_H), C('#14100d'))
    px = img.load()
    rnd = random.Random(8)
    brick_tones = [C(c) for c in ('#2e241d', '#34291f', '#281f19', '#3a2e24', '#30261e')]
    floor_y = 80
    # brick wall
    for row in range(0, floor_y // 8 + 1):
        off = 8 if row % 2 else 0
        for bx in range(-off, SCENE_W, 16):
            tone = rnd.choice(brick_tones)
            for y in range(row * 8, min(floor_y, row * 8 + 8)):
                for x in range(bx, bx + 16):
                    if not (0 <= x < SCENE_W):
                        continue
                    ly, lx = y - row * 8, x - bx
                    col = tone
                    if ly == 0 or lx == 0:
                        col = C('#0f0b09')                  # mortar
                    elif ly == 1 or lx == 1:
                        col = tuple(min(255, c + 12) for c in tone[:3]) + (255,)
                    elif rnd.random() < 0.05:
                        col = tuple(max(0, c - 10) for c in tone[:3]) + (255,)
                    px[x, y] = col
    # arch niche
    cx, cy, R = 72, 52, 32
    def in_arch(x, y, grow=0):
        return (y >= cy and abs(x - cx) <= R + grow and y <= floor_y) or ((x - cx) ** 2 + (y - cy) ** 2 <= (R + grow) ** 2 and y < cy)
    for y in range(SCENE_H):
        for x in range(SCENE_W):
            if y > floor_y:
                continue
            if in_arch(x, y):
                t = (y - (cy - R)) / (floor_y - (cy - R))
                col = _lerp((32, 40, 74), (10, 12, 26), min(1, max(0, t)))
                if (x + y) % 4 == 0 and t < 0.5:
                    col = tuple(min(255, c + 6) for c in col)
                px[x, y] = col + (255,)
            elif in_arch(x, y, 4):                                  # arch ring stones
                ang = math.degrees(math.atan2(y - cy, x - cx))
                seam = int(ang // 15) % 2
                ring = '#8a7a66' if seam else '#6e6050'
                if y > cy:
                    ring = '#7a6c58' if (y // 8) % 2 else '#5e5242'
                px[x, y] = C(ring)
                if not in_arch(x, y, 1):
                    px[x, y] = C('#a89880') if y < cy else C('#9a8a74')
                if in_arch(x, y, 4) and not in_arch(x, y, 3):
                    px[x, y] = C('#0f0b09')
    # keystone
    d = ImageDraw.Draw(img)
    d.rectangle([cx - 5, cy - R - 5, cx + 5, cy - R + 2], fill=C('#b8a68a'))
    d.rectangle([cx - 5, cy - R - 5, cx + 5, cy - R - 5], fill=C('#d8c8a8'))
    d.line([(cx - 5, cy - R + 2), (cx + 5, cy - R + 2)], fill=C('#0f0b09'))
    d.point((cx, cy - R - 2), fill=C('#e0b23a'))
    # sconces (the flames are a separate animated sprite)
    for sx in (18, SCENE_W - 19):
        d.rectangle([sx - 1, 48, sx + 1, 60], fill=C('#5a3a1c'))
        d.rectangle([sx - 3, 60, sx + 3, 62], fill=C('#2a2a32'))
        d.rectangle([sx - 3, 46, sx + 3, 48], fill=C('#2a2a32'))
        d.point((sx - 3, 46), fill=C('#7a7a88'))
        d.rectangle([sx - 2, 42, sx + 2, 46], fill=C('#3a2410'))
    # floor: worn slabs with a bright back edge
    for y in range(floor_y, SCENE_H):
        t = (y - floor_y) / (SCENE_H - floor_y)
        base = _lerp((74, 64, 54), (34, 28, 24), t)
        for x in range(SCENE_W):
            col = base
            slab_h = 10
            row = (y - floor_y) // slab_h
            offs = (row % 2) * 24
            if (y - floor_y) % slab_h == 0 or (x + offs) % 48 == 0:
                col = _lerp(col, (10, 8, 7), 0.65)
            elif rnd.random() < 0.06:
                col = _lerp(col, (120, 108, 92), 0.25)
            px[x, y] = tuple(col) + (255,)
    for x in range(SCENE_W):
        px[x, floor_y] = C('#9a8a74')
        px[x, floor_y + 1] = C('#6a5c4c')
    # edge vignette
    for y in range(SCENE_H):
        for x in range(SCENE_W):
            e = min(x, SCENE_W - 1 - x) / 22.0
            if e < 1:
                r, g, b, a = px[x, y]
                k = 0.45 + 0.55 * e
                px[x, y] = (int(r * k), int(g * k), int(b * k), a)
    return img


def torch_sheet():
    """3 flame frames, 10x16 each, side by side (animated with steps() in CSS)."""
    frames = [
        [(5, 15), (4, 14), (6, 14), (3, 12), (7, 12), (4, 10), (6, 10), (5, 8), (5, 6)],
        [(5, 15), (4, 14), (6, 14), (3, 12), (6, 12), (4, 10), (7, 9), (6, 7), (7, 5)],
        [(5, 15), (4, 14), (6, 14), (4, 12), (7, 12), (3, 10), (5, 10), (4, 8), (3, 6)],
    ]
    sheet = Image.new('RGBA', (30, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for i, pts in enumerate(frames):
        ox = i * 10
        d.ellipse([ox + 1, 6, ox + 8, 16], fill=C('#e8541a'))
        d.ellipse([ox + 2, 7, ox + 7, 15], fill=C('#f58a24'))
        d.ellipse([ox + 3, 9, ox + 6, 15], fill=C('#ffd050'))
        for x, y in pts[-3:]:
            d.point((ox + x, y - 2), fill=C('#f58a24'))
            d.point((ox + x, y - 1), fill=C('#e8541a'))
        d.point((ox + 4, 12), fill=C('#fff4b0'))
    return sheet


# ----------------------------------------------------------------- HP / MP flask parts
FLASK_W, FLASK_H = 40, 56


def _shape(r_bulb, neck_half, cx=20, cy=37):
    """Point-in-flask test: round bulb + shoulder + neck."""
    def inside(x, y):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r_bulb ** 2:
            return True
        if y <= 24 and abs(x - cx) <= neck_half and y >= 8:
            return True
        if 22 <= y <= 28:
            t = (y - 22) / 6.0
            if abs(x - cx) <= neck_half + t * (r_bulb - neck_half) * 0.85 and (x - cx) ** 2 + (y - cy) ** 2 <= (r_bulb + 3) ** 2:
                return True
        return False
    return inside


def flask_mask():
    """White where liquid may appear (the glass interior)."""
    img = Image.new('RGBA', (FLASK_W, FLASK_H), (0, 0, 0, 0))
    inside = _shape(12.5, 4)
    for y in range(FLASK_H):
        for x in range(FLASK_W):
            if inside(x + 0.5, y + 0.5) and y >= 11:
                img.putpixel((x, y), (255, 255, 255, 255))
    return img


def flask_glass():
    """Outline, glass thickness, highlights, lip and cork. Interior stays transparent."""
    img = Image.new('RGBA', (FLASK_W, FLASK_H), (0, 0, 0, 0))
    px = img.load()
    outer = _shape(15.5, 6.5)
    inner = _shape(12.5, 4)
    for y in range(FLASK_H):
        for x in range(FLASK_W):
            o, i = outer(x + 0.5, y + 0.5), inner(x + 0.5, y + 0.5)
            if o and not i and y >= 9:
                lit = (x + y) < 58
                px[x, y] = C('#cfe6f4', 200) if lit else C('#6a8aa0', 200)
    out = img.copy()
    op = out.load()
    for y in range(FLASK_H):
        for x in range(FLASK_W):
            if px[x, y][3] == 0 and not inner(x + 0.5, y + 0.5):
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < FLASK_W and 0 <= ny < FLASK_H and px[nx, ny][3] > 150:
                        op[x, y] = C('#10202c')
                        break
    img = out
    d = ImageDraw.Draw(img)
    d.rectangle([13, 8, 27, 10], fill=C('#8fb0c4'))
    d.line([(13, 8), (27, 8)], fill=C('#e8f6ff'))
    d.rectangle([12, 7, 28, 7], fill=C('#10202c'))
    d.rectangle([12, 11, 28, 11], fill=C('#10202c'))
    d.rectangle([16, 1, 24, 7], fill=C('#8a5a30'))
    d.rectangle([16, 1, 24, 2], fill=C('#c08a50'))
    d.rectangle([16, 6, 24, 7], fill=C('#5a3a1c'))
    d.line([(15, 1), (15, 7)], fill=C('#2a1608'))
    d.line([(25, 1), (25, 7)], fill=C('#2a1608'))
    d.line([(16, 0), (24, 0)], fill=C('#2a1608'))
    for p in ((18, 3), (21, 4), (19, 5)):
        d.point(p, fill=C('#6a4220'))
    for y in range(28, 46):
        d.point((9 + (46 - y) // 9, y), fill=(255, 255, 255, 150))
    d.line([(10, 30), (12, 28)], fill=(255, 255, 255, 190))
    d.point((18, 14), fill=(255, 255, 255, 170))
    d.point((18, 15), fill=(255, 255, 255, 170))
    d.point((31, 44), fill=(255, 255, 255, 80))
    return img


def flask_bubbles(h=24):
    """Tileable (vertically) bubble strip; animate background-position-y upward."""
    img = Image.new('RGBA', (FLASK_W, h), (0, 0, 0, 0))
    rnd = random.Random(5)
    d = ImageDraw.Draw(img)
    for _ in range(9):
        x, y = rnd.randint(6, FLASK_W - 8), rnd.randint(0, h - 1)
        r = rnd.choice((1, 1, 2))
        if r == 1:
            d.rectangle([x, y, x + 1, y + 1], fill=(255, 255, 255, 120))
        else:
            d.ellipse([x, y, x + 3, y + 3], outline=(255, 255, 255, 150))
            d.point((x + 1, y + 1), fill=(255, 255, 255, 220))
    return img


# ----------------------------------------------------------------- castle range overlay
def range_corner(size=20):
    """Top-left bracket of the castle's bonus range: violet rail with a gold rivet and a glowing tip."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # outer glow, rail, highlight
    for t, col in ((4, '#7a3ac820'), (3, '#9a56e840'), (2, '#c27aff')):
        d.line([(0, 0), (size - 1, 0)], fill=C(col[:7]) if len(col) == 7 else hexc8(col), width=t)
        d.line([(0, 0), (0, size - 1)], fill=C(col[:7]) if len(col) == 7 else hexc8(col), width=t)
    d.line([(1, 1), (size - 2, 1)], fill=C('#f0ddff'))
    d.line([(1, 1), (1, size - 2)], fill=C('#f0ddff'))
    d.rectangle([0, 0, 5, 5], fill=C('#8a44e0'), outline=C('#2a0a5a'))
    d.rectangle([1, 1, 4, 4], fill=C('#c9a0ff'))
    d.point((2, 2), fill=C('#fff6c8'))
    d.point((3, 3), fill=C('#d9a850'))
    for i in range(6, size, 1):                          # fading tips of the rails
        a = 255 if i < size - 6 else max(40, 255 - (i - (size - 7)) * 40)
        d.point((i, 3), fill=hexc8('#2a0a5a%02x' % min(a, 255)))
        d.point((3, i), fill=hexc8('#2a0a5a%02x' % min(a, 255)))
    return img


def hexc8(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in range(0, 8, 2)) if len(h) == 8 else C('#' + h)


def range_tint(size=16, seed=5):
    """Seamless faint violet ground wash: sparse rune dots on a diagonal weave (drawn at 2x in CSS)."""
    rnd = random.Random(seed)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            if (x + y) % 8 == 0:
                px[x, y] = (150, 90, 230, 54)
            elif (x - y) % 8 == 0:
                px[x, y] = (120, 70, 210, 30)
    for _ in range(4):
        x, y = rnd.randrange(size), rnd.randrange(size)
        px[x, y] = (226, 190, 255, 140)
    return img


def spark_sheet(n=6, s=11):
    """Gold twinkle: a plus that grows, flashes white and fades; n frames of s x s."""
    sheet = Image.new('RGBA', (s * n, s), (0, 0, 0, 0))
    radii = (0, 1, 2, 3, 2, 1)
    c = s // 2
    for i in range(n):
        r = radii[i % len(radii)]
        if not r:
            continue
        px = sheet.load()
        ox = i * s
        px[ox + c, c] = C('#ffffff')
        for k in range(1, r + 1):
            col = C('#fff2a0') if k == 1 else C('#ffd23a')
            a = 255 if k < r or r == 1 else 200
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                px[ox + c + dx, c + dy] = col[:3] + (a,)
        if r >= 2:
            for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                px[ox + c + dx, c + dy] = (255, 214, 80, 170)
    return sheet


# ----------------------------------------------------------------- level-up ribbon (3 slices, middle repeats)
def _ribbon(w, parts):
    return None


def banner_parts(h=28):
    """Returns (left, middle, right): a crimson ribbon with gold edging and swallow-tailed ends."""
    cap, mid_w = 22, 8
    full_w = cap * 2 + mid_w
    img = Image.new('RGBA', (full_w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def body(x0, x1):
        d.rectangle([x0, 4, x1, h - 5], fill=C('#8a1428'))
        d.rectangle([x0, 4, x1, 5], fill=C('#c8283c'))
        d.rectangle([x0, h - 8, x1, h - 5], fill=C('#5e0c1c'))
        d.line([(x0, 3), (x1, 3)], fill=C('#2a0610'))
        d.line([(x0, h - 4), (x1, h - 4)], fill=C('#2a0610'))
        d.line([(x0, 4), (x1, 4)], fill=C('#f0d27a'))
        d.line([(x0, h - 5), (x1, h - 5)], fill=C('#b07c34'))
        d.line([(x0, 8), (x1, 8)], fill=C('#d94a5c'))

    body(cap, cap + mid_w - 1)
    # left tail (folded behind) and body cap
    d.polygon([(0, 8), (cap, 8), (cap, h - 2), (0, h - 2), (7, (h + 6) // 2)], fill=C('#5e0c1c'), outline=C('#2a0610'))
    d.polygon([(2, 10), (cap, 10), (cap, h - 4), (2, h - 4), (8, (h + 6) // 2)], fill=C('#7a1224'))
    d.rectangle([cap - 8, 4, cap, h - 5], fill=C('#8a1428'))
    d.rectangle([cap - 8, 4, cap, 5], fill=C('#c8283c'))
    d.line([(cap - 8, 3), (cap, 3)], fill=C('#2a0610'))
    d.line([(cap - 8, h - 4), (cap, h - 4)], fill=C('#2a0610'))
    d.line([(cap - 8, 4), (cap, 4)], fill=C('#f0d27a'))
    d.line([(cap - 8, h - 5), (cap, h - 5)], fill=C('#b07c34'))
    left = img.crop((0, 0, cap, h))
    # right = mirror of left
    from PIL import ImageOps
    right = ImageOps.mirror(left)
    mid = img.crop((cap, 0, cap + mid_w, h))
    return left, mid, right


def banner_left():
    return banner_parts()[0]


def banner_mid():
    return banner_parts()[1]


def banner_right():
    return banner_parts()[2]
