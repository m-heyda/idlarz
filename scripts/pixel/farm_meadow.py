"""The farm meadow tile (public/pixel/bg/farm_meadow.png): the flat light grass of the pen art (the farm parts' ground) with its darker specks, scattered at random,
so it repeats without a seam and the Farm window's background (src/styles/Farm.css .farm-stage) blends into the pen at any window size.
Run: python scripts/pixel/farm_meadow.py (deterministic; the PNG is committed)."""
import os
import random
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'pixel', 'bg', 'farm_meadow.png')
SIZE = 96
GRASS = (192, 240, 144, 255)       # the pen's ground
SPECK = (130, 214, 90, 255)        # its darker grass specks
TUFT = (88, 176, 64, 255)          # the occasional tuft

rnd = random.Random(7)
img = Image.new('RGBA', (SIZE, SIZE), GRASS)
px = img.load()
for _ in range(SIZE * SIZE // 14):
    x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
    px[x, y] = SPECK
    if rnd.random() < 0.25:
        px[(x + 1) % SIZE, y] = SPECK
for _ in range(SIZE * SIZE // 400):
    x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
    px[x, y] = TUFT
    px[(x + 1) % SIZE, (y + 1) % SIZE] = SPECK
img.save(OUT)
print('wrote', OUT)
