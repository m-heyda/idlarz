"""Cuts the sprites out of the supplied resource sheet (reference/resource-sheet.jpg) into 40px game sprites.

    python scripts/pixel/extract_sheet.py [name ...]      -> scripts/pixel/assets/<name>.png (+ previews/extract.png)

Per sprite: crop the box, key the white page and the soft ground shadow out to transparency (a flood from the border
through near-white pixels and pixels close to the shadow's own grey), fit the result into the target canvas
(bottom-aligned, area average), quantize to a small palette with no dither and hard alpha, then close the outline.
The outputs are committed, so build.py never needs the jpg; rerun this only when the sheet or the boxes change."""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, 'reference', 'resource-sheet.jpg')
OUT = os.path.join(HERE, 'assets')
PREVIEW = os.path.join(HERE, 'previews')

# name -> (x0, y0, x1, y1) on the 1264x843 sheet, target (w, h), shadow tolerance, remove the soft shadow rim. Only the larger copy of each sprite is used.
SPRITES = {
    'gold': ((56, 124, 172, 224), (40, 40), 30, True),
    'wood': ((216, 124, 328, 224), (40, 40), 30, True),
    'stone': ((368, 124, 480, 224), (40, 40), 14, False),
    'res_iron': ((516, 124, 628, 224), (40, 40), 14, False),
    'meat': ((668, 128, 772, 220), (40, 40), 30, True),
    'res_fish': ((820, 136, 912, 220), (40, 40), 30, True),
    'res_mana': ((960, 124, 1064, 224), (40, 40), 30, True),
    'coal': ((1104, 136, 1208, 224), (40, 40), 12, False),
    'res_crystal': ((56, 288, 172, 388), (40, 40), 30, True),
    'res_sapphire': ((212, 288, 324, 388), (40, 40), 30, True),
    'res_mystery': ((920, 644, 1016, 724), (40, 40), 30, True),
    'legacy': ((1080, 644, 1180, 728), (40, 40), 30, True),
    'bonus_chest': ((968, 252, 1172, 436), (32, 32), 30, True),
    'chest_map': ((56, 468, 344, 696), (48, 40), 30, True),
}
PAD = 6
COLORS = 28


def load():
    return Image.open(SHEET).convert('RGB')


SHADOW = np.array([52, 52, 58])       # measured flat grey of the sheet's ground shadow


def key_out(crop, tol, soft):
    """RGBA with the page and the ground shadow transparent. The shadow is a neutral grey disc with a lighter soft rim;
    `soft` also removes the rim (off for sprites that are themselves neutral grey)."""
    a = np.asarray(crop).astype(int)
    h, w, _ = a.shape
    white = a.min(axis=2) >= 226
    spread = a.max(axis=2) - a.min(axis=2)
    dist = np.abs(a - SHADOW).sum(axis=2)
    val = a.max(axis=2)
    passable = white | ((spread < 11) & (dist < tol * 3))
    if soft:
        passable |= (spread < 12) & (val > 60) & (val < 226)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # jpeg leaves a pale fringe where the sprite meets the page: peel bright neutral pixels off the edge (twice)
    for _ in range(2):
        solid = alpha > 0
        pad = np.pad(solid, 1, constant_values=False)
        touches = ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        pale = (a.min(axis=2) > 196) & (spread < 22)
        alpha = np.where(solid & touches & pale, 0, alpha).astype(np.uint8)
    img = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    return keep_blobs(img)


def keep_blobs(img):
    a = np.asarray(img)
    mask = a[:, :, 3] > 0
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    sizes, n = {}, 0
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not lab[sy, sx]:
                n += 1
                lab[sy, sx] = n
                q = deque([(sy, sx)])
                c = 0
                while q:
                    y, x = q.popleft()
                    c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                q.append((ny, nx))
                sizes[n] = c
    big = max(sizes.values())
    keep = [k for k, v in sizes.items() if v >= big * 0.08]
    out = a.copy()
    out[~np.isin(lab, keep), 3] = 0
    return Image.fromarray(out, 'RGBA')


def fit(img, size):
    """Trim, scale to fit `size` (area average on premultiplied colour), bottom-centre it."""
    bbox = img.getbbox()
    img = img.crop(bbox)
    w, h = img.size
    k = min(size[0] / w, size[1] / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    arr = np.asarray(img).astype(float)
    pre = arr[:, :, :3] * (arr[:, :, 3:4] / 255)
    prem = Image.fromarray(np.dstack([pre, arr[:, :, 3]]).astype(np.uint8), 'RGBA')
    small = prem.resize((nw, nh), Image.BOX)
    s = np.asarray(small).astype(float)
    al = s[:, :, 3:4]
    col = np.where(al > 0, s[:, :, :3] * 255 / np.maximum(al, 1), 0)
    out = Image.fromarray(np.dstack([np.clip(col, 0, 255), al]).astype(np.uint8), 'RGBA')
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    canvas.alpha_composite(out, ((size[0] - nw) // 2, size[1] - nh))
    return canvas


def finish(img):
    """Sharpen a touch, hard alpha, small palette, no dither."""
    rgb = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=2))
    a = np.asarray(img)[:, :, 3]
    solid = a >= 120
    q = rgb.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    arr = np.dstack([np.asarray(q), np.where(solid, 255, 0).astype(np.uint8)])
    return Image.fromarray(arr, 'RGBA')


def outline(img, color=(16, 12, 14, 255)):
    """Close the silhouette with a 1px dark edge so it reads on any ground."""
    a = np.asarray(img).copy()
    solid = a[:, :, 3] > 0
    h, w = solid.shape
    edge = np.zeros_like(solid)
    pad = np.pad(solid, 1)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        edge |= pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    edge &= ~solid
    a[edge] = color
    return Image.fromarray(a, 'RGBA')


def extract(name, sheet):
    (x0, y0, x1, y1), size, tol, soft = SPRITES[name]
    crop = sheet.crop((x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD))
    keyed = key_out(crop, tol, soft)
    inner = (size[0] - 2, size[1] - 2)                      # leave room for the outline ring
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    canvas.alpha_composite(finish(fit(keyed, inner)), (1, 1))
    return keyed, outline(canvas)


def main():
    only = set(a for a in sys.argv[1:] if not a.startswith('--'))
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    sheet = load()
    made = {}
    for name in SPRITES:
        if only and name not in only:
            continue
        keyed, sprite = extract(name, sheet)
        sprite.save(os.path.join(OUT, f'{name}.png'))
        made[name] = (keyed, sprite)
    # contact sheet: keyed source on the left, game sprite at 4x on the right, on a mid-brown ground
    rows = len(made)
    cw, ch = 330, 180
    cols = 3
    rws = -(-rows // cols)
    prev = Image.new('RGBA', (cw * cols, ch * rws), (150, 133, 117, 255))
    for i, (name, (keyed, sprite)) in enumerate(made.items()):
        ox, oy = (i % cols) * cw, (i // cols) * ch
        k = keyed.copy()
        k.thumbnail((110, 110))
        prev.alpha_composite(k, (ox + 4, oy + 4))
        big = sprite.resize((sprite.size[0] * 4, sprite.size[1] * 4), Image.NEAREST)
        prev.alpha_composite(big, (ox + 120, oy + 4))
    prev.save(os.path.join(PREVIEW, 'extract.png'))
    print('extracted', len(made), 'sprites ->', OUT)


if __name__ == '__main__':
    main()
