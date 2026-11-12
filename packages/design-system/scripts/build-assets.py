"""One-off cutter for the design-system art. Reads the UI kit sheet in docs/plan/design, strips its baked checkerboard, cuts the chosen pieces, clears the busy cobble
inside frames (the panel fill is a clean generated slate tile instead) and writes small PNGs to src/assets. Per CLAUDE.md this is not the legacy pixel pipeline:
it only crops/resizes/recolours existing sheet art. Run: python packages/design-system/scripts/build-assets.py"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'docs/plan/design/ui-kit-sheet-frames-bars.webp')).convert('RGB')
OUT = os.path.join(ROOT, 'packages/design-system/src/assets')
os.makedirs(OUT, exist_ok=True)


def cut(box, scale=0.5, hole=None, dim=1.0):
	"""Crop `box` (x0,y0,x1,y1 on the sheet), remove the checkerboard connected to the crop edge, optionally clear a centre `hole` margin, scale (area-averaged then re-quantised)."""
	a = np.array(SHEET.crop(box)).astype(int)
	r, g, b = a[..., 0], a[..., 1], a[..., 2]
	neutral = (np.abs(r - g) < 9) & (np.abs(g - b) < 9) & (r > 175)
	lab, n = ndi.label(neutral)
	edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
	bg = np.isin(lab, list(edge))
	alpha = ~ndi.binary_dilation(bg, iterations=1)
	rgba = np.dstack([np.clip(a * dim, 0, 255), alpha * 255]).astype(np.uint8)
	if hole:
		m = hole
		rgba[m:-m, m:-m, 3] = 0
	im = Image.fromarray(rgba)
	if scale != 1:
		im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
	return im


def save(name, im):
	im.save(os.path.join(OUT, name + '.png'))
	print(name, im.size)


# --- frames (interior cleared; slice widths documented in src/frames.ts) ---
save('frame-stone', cut((7, 8, 342, 271), 0.5, hole=30))          # big window frame: stone rim + gold line + corner studs
save('frame-stone-b', cut((343, 8, 629, 253), 0.5, hole=30))
save('frame-panel', cut((10, 392, 172, 515), 0.5, hole=22))      # inner panel frame (thinner)
save('frame-panel-b', cut((185, 392, 338, 515), 0.5, hole=22))
save('frame-slot', cut((8, 905, 60, 960), 0.5, hole=9))
# --- bars and plaques ---
save('plaque-wood', cut((923, 62, 1348, 108), 0.5))
save('plaque-wood-plain', cut((923, 112, 1348, 152), 0.5))
save('plaque-dark', cut((923, 205, 1348, 247), 0.5))
save('bar-stone', cut((923, 9, 1346, 61), 0.5))
save('bar-wood-long', cut((10, 573, 342, 612), 0.5))
save('plaque-wood-ornate', cut((352, 560, 745, 609), 0.5))
# --- buttons / tabs (plates) ---
save('btn-gold', cut((12, 780, 142, 818), 0.5))
save('btn-gold-pressed', cut((12, 822, 142, 860), 0.5))
save('btn-wood', cut((163, 780, 274, 818), 0.5))
save('btn-stone', cut((288, 780, 398, 818), 0.5))
save('btn-dark', cut((12, 866, 142, 898), 0.5))
save('tab-idle', cut((453, 625, 566, 667), 0.5))
save('tab-active', cut((775, 625, 862, 667), 0.5))
save('tab-stone', cut((573, 625, 668, 667), 0.5))
# --- ornaments ---
save('divider-gold', cut((1125, 665, 1415, 690), 0.5))
save('divider-flourish', cut((1125, 598, 1415, 650), 0.5))
save('divider-fleur', cut((1125, 775, 1415, 850), 0.5))
save('corner-gold', cut((1068, 625, 1115, 672), 0.5))
save('banner-navy', cut((1428, 618, 1530, 805), 0.5))
save('banner-red', cut((1428, 806, 1530, 985), 0.5))
save('emblem-shield', cut((1405, 385, 1520, 495), 0.5))
save('stud', cut((1356, 255, 1392, 290), 0.5))
save('scroll', cut((985, 388, 1142, 575), 0.5))

# --- textures: clean slate (generated), parchment and wood (cut from the sheet, dimmed) ---
rng = np.random.default_rng(7)
S = 32
base = np.array([27, 31, 42])
tile = np.tile(base, (S, S, 1)).astype(int)
yy, xx = np.mgrid[0:S, 0:S]
tile += (((xx // 2 + yy // 2) % 2) * 3)[..., None]            # faint 2px checker dither
for _ in range(26):                                            # sparse speckles
	x, y = rng.integers(0, S, 2)
	tile[y, x] += rng.choice([-7, 6, 9])
tile[S // 2 - 1 : S // 2, :] -= 3                              # a hairline "course" line so it reads as stone without cobble noise
tile[:, S // 4 : S // 4 + 1] += 2
save('tex-slate', Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).convert('RGBA'))
save('tex-parchment', cut((372, 415, 492, 520), 1.0, dim=0.97).crop((8, 8, 100, 90)))


def wood(dim=1.0, seed=11):
	"""Pixel wood: horizontal planks of slightly different tone, a dark seam and a light edge per plank, short grain streaks, the odd knot and butt joint. Tiles in both directions."""
	r = np.random.default_rng(seed)
	W = H = 48
	PH = 12
	base = np.array([124, 80, 44])
	img = np.zeros((H, W, 3), int)
	for p in range(H // PH):
		tone = base * r.choice([0.82, 0.92, 1.0, 1.08])
		y0 = p * PH
		img[y0 : y0 + PH] = tone
		for _ in range(7):  # grain streaks, wrapping around x so the tile repeats
			y = y0 + int(r.integers(2, PH - 1))
			x = int(r.integers(0, W))
			ln = int(r.integers(8, 26))
			k = r.choice([0.86, 0.9, 1.1, 1.14])
			for i in range(ln):
				img[y, (x + i) % W] = np.clip(tone * k, 0, 255)
		if r.random() < 0.6:  # knot
			kx, ky = int(r.integers(6, W - 6)), y0 + int(r.integers(4, PH - 4))
			for dx, dy, k in [(0, 0, 0.62), (1, 0, 0.7), (-1, 0, 0.7), (0, 1, 0.78), (0, -1, 0.78), (2, 0, 0.88), (-2, 0, 0.88)]:
				img[ky + dy, (kx + dx) % W] = np.clip(tone * k, 0, 255)
		jx = int(r.integers(0, W))  # butt joint
		img[y0 + 1 : y0 + PH, jx] = np.clip(tone * 0.6, 0, 255)
		img[y0 + 1 : y0 + PH, (jx + 1) % W] = np.clip(tone * 1.12, 0, 255)
		img[y0] = np.clip(tone * 0.5, 0, 255)  # seam above the plank
		img[y0 + 1] = np.clip(tone * 1.16, 0, 255)  # light lip below the seam
	return Image.fromarray(np.clip(img * dim, 0, 255).astype(np.uint8)).convert('RGBA')




def planks(dim=1.0, seed=3):
	"""Calmer wood: 64x32 tile, two wide planks, low-contrast grain, a seam with a light lip and one butt joint each. Reads as wood at small size without noise."""
	r = np.random.default_rng(seed)
	W, H, PH = 64, 32, 16
	base = np.array([112, 74, 42])
	img = np.zeros((H, W, 3), int)
	for p in range(H // PH):
		tone = base * r.choice([0.94, 1.0, 1.06])
		y0 = p * PH
		img[y0 : y0 + PH] = tone
		for _ in range(4):
			y = y0 + int(r.integers(3, PH - 2))
			x, ln = int(r.integers(0, W)), int(r.integers(14, 40))
			k = r.choice([0.93, 1.07])
			for i in range(ln):
				img[y, (x + i) % W] = tone * k
		jx = int(r.integers(8, W - 8))
		img[y0 + 1 : y0 + PH, jx] = tone * 0.7
		img[y0] = tone * 0.55
		img[y0 + 1] = np.clip(tone * 1.12, 0, 255)
	return Image.fromarray(np.clip(img * dim, 0, 255).astype(np.uint8)).convert('RGBA')


def stone(seed=4):
	"""Cobblestone: wrapped voronoi cells (so it tiles), each its own warm grey, dark mortar between cells and a light edge on the top-left of each stone."""
	r = np.random.default_rng(seed)
	W = H = 64
	n = 16
	pts = np.stack([r.integers(0, W, n), r.integers(0, H, n)], 1)
	yy, xx = np.mgrid[0:H, 0:W]
	d = np.full((n, H, W), 1e9)
	for i, (px, py) in enumerate(pts):
		dx = np.minimum(np.abs(xx - px), W - np.abs(xx - px))
		dy = np.minimum(np.abs(yy - py), H - np.abs(yy - py))
		d[i] = dx * dx + dy * dy
	cell = d.argmin(0)
	tones = np.array([[74, 67, 60]]) * r.choice([0.88, 0.95, 1.0, 1.08, 1.14], n)[:, None]
	img = tones[cell].astype(int)
	right = np.roll(cell, -1, 1) != cell
	below = np.roll(cell, -1, 0) != cell
	left = np.roll(cell, 1, 1) != cell
	above = np.roll(cell, 1, 0) != cell
	img[right | below] = (img[right | below] * 0.45).astype(int)
	light = (left | above) & ~(right | below)
	img[light] = np.clip(img[light] * 1.22, 0, 255).astype(int)
	for _ in range(70):
		x, y = r.integers(0, W), r.integers(0, H)
		img[y, x] = np.clip(img[y, x] * r.choice([0.88, 1.12]), 0, 255)
	return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')


save('tex-wood', planks(1.0))
save('tex-wood-dark', planks(0.62, seed=5))
save('tex-stone', stone())
