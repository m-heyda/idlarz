"""One-off: strip the baked checkerboard from a UI kit sheet and cut every sprite out as a transparent PNG (plus a numbered contact sheet to pick from).
Usage: python segment-sheet.py <sheet> <outdir>"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = np.array(Image.open(src).convert('RGB')).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
neutral = (np.abs(r - g) < 9) & (np.abs(g - b) < 9) & (r > 175)  # checker squares: white and light grey
# only background connected to the sheet edge or to other background is dropped; dilate a little to eat anti-aliased halo
bg_lab, n = ndi.label(neutral)
bg = neutral.copy()
alpha = ~ndi.binary_dilation(bg, iterations=1)
# keep only parts of the foreground mask that are big enough (drops stray checker pixels)
fg_lab, m = ndi.label(ndi.binary_dilation(alpha, iterations=3))
objs = ndi.find_objects(fg_lab)
rgba = np.dstack([im, (alpha * 255)]).astype(np.uint8)
sheet = Image.fromarray(rgba)
items = []
for i, sl in enumerate(objs, 1):
    y, x = sl
    w, h = x.stop - x.start, y.stop - y.start
    if w < 8 or h < 8 or w * h < 120:
        continue
    items.append((x.start, y.start, x.stop, y.stop))
items.sort(key=lambda t: (t[1] // 40, t[0]))
for k, (x0, y0, x1, y1) in enumerate(items):
    sheet.crop((x0, y0, x1, y1)).save(f'{out}/s{k:03d}.png')
print(len(items), 'sprites')
with open(f'{out}/index.txt', 'w') as f:
    for k, bb in enumerate(items):
        f.write(f's{k:03d} {bb} {bb[2]-bb[0]}x{bb[3]-bb[1]}\n')
# contact sheet over a dark ground with ids
cs = Image.new('RGBA', sheet.size, (60, 60, 70, 255))
cs.alpha_composite(sheet)
d = ImageDraw.Draw(cs)
for k, (x0, y0, x1, y1) in enumerate(items):
    d.rectangle((x0, y0, x1, y1), outline=(255, 0, 255, 255))
    d.text((x0 + 2, y0 + 2), str(k), fill=(0, 255, 255, 255))
cs.save(f'{out}/contact.png')
