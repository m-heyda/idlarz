"""The farm's loose parts (public/pixel/farm/*.png + index.json): fence segments, gate, barn, coop, troughs, tanks, hay, barrels, crates, pond, trees, bushes, stones,
flowers and dirt patches, each ray-traced alone with the camera of the animals (render3d, the pen's old SCALE) on a transparent background, with its shadow as soft black.
The Farm window (src/components/game/overlays/FarmProps.tsx) lays them out on the repeating meadow tile (public/pixel/bg/farm_meadow.png), so the pasture has no
edge and fills any window size. index.json gives every part's size and the pixel of its ground anchor (world x = y = z = 0), which the scene places on the ground
position of the prop (farmGeometry.ts `project`). Run: python scripts/pixel/farm_parts.py (deterministic; the PNGs are committed)."""
import json
import math
import os
from PIL import Image
from render3d import Scene, Prim, I3, between
from materials import MATS
from sprites_props import plank_tex
import sprites_farm as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'pixel', 'farm')
SCALE = sf.SCALE
STEP = 1.75                                    # the length of one fence segment (world units)
SHADOW = (0, 0, 0, 64)


def render(prims, w=170, h=170, ax=85, ay=125, shadow=True, outline=True):
    """Render `prims` (placed round world 0,0) alone; the ground anchor sits at pixel (ax, ay). Returns (image, anchor) cropped to what was drawn."""
    kw = dict(size=(w, h), scale=SCALE, origin=(ax, ay))
    sc = Scene(MATS, **kw)
    sc.add(*prims)
    part = sc.render(outline=outline)
    if shadow:
        ground = Prim('box', (0, 0, -0.14), (40, 40, 0.14), 'grass', I3, None, 1)
        with_ground = Scene(MATS, **kw)
        with_ground.add(*prims, ground)
        only_ground = Scene(MATS, **kw)
        only_ground.add(ground)
        a, b, g = part.load(), with_ground.render().load(), only_ground.render().load()
        out = part.copy()
        px = out.load()
        for y in range(h):
            for x in range(w):
                if a[x, y][3] == 0 and b[x, y] != g[x, y] and b[x, y][3] > 0:
                    px[x, y] = SHADOW
        part = out
    box = part.getbbox()
    return part.crop(box), (ax - box[0], ay - box[1])


PARTS = {}


def add(name, prims, **kw):
    PARTS[name] = render(prims, **kw)


def fence_post_rails(axis):
    """One post at the origin and the two rails running a segment's length towards +axis (the next post is the next segment's)."""
    prims = []
    prims.append(Prim('box', (0, 0, 0.55), (0.1, 0.1, 0.55), 'plank', I3, None, 100))
    prims.append(Prim('box', (0, 0, 1.13), (0.12, 0.12, 0.05), 'wood_cut', I3, None, 120))
    for z in (0.42, 0.86):
        p0, p1 = ((0, 0, z), (STEP, 0, z)) if axis == 'x' else ((0, 0, z), (0, STEP, z))
        prims.append(between('box', p0, p1, (0.045, 0.07), 'plank', None, (0, 0, 1), 140 + int(z * 10)))
    return prims


def build():
    add('fence_x', fence_post_rails('x'), w=120, h=90, ax=20, ay=60)
    add('fence_y', fence_post_rails('y'), w=120, h=90, ax=20, ay=40)
    # the gate: two tall posts and the planks of a swung-open gate between them
    gate = []
    gx0, gx1 = sf.GATE
    for gx in (0, gx1 - gx0):
        gate.append(Prim('box', (gx, 0, 0.7), (0.14, 0.14, 0.7), 'bark', I3, None, 160))
        gate.append(Prim('box', (gx, 0, 1.45), (0.17, 0.17, 0.07), 'wood_cut', I3, None, 161))
    width = gx1 - gx0
    for z in (0.34, 0.7, 1.06):
        gate.append(Prim('box', (width / 2, -0.05, z), (width - 0.12, 0.04, 0.07), 'wood_cut', I3, None, 170))
    gate.append(between('box', (0.1, -0.05, 0.3), (width - 0.1, -0.05, 1.1), (0.04, 0.03), 'wood_cut', None, (0, -1, 0), 171))
    add('gate', gate, w=120, h=90, ax=20, ay=70)
    add('fence_post', fence_post_rails('x')[:2], w=40, h=60, ax=20, ay=40)
    sf_barn, sf_coop = [], []
    sf.barn(sf_barn, 0, 0, sf.BARN[2])
    add('barn', sf_barn, w=230, h=230, ax=115, ay=165)
    sf.barn(sf_coop, 0, 0, sf.COOP[2])
    add('coop', sf_coop, w=140, h=150, ax=70, ay=105)
    for ax_ in ('x', 'y'):
        t = []
        sf.trough(t, 0, 0, ax_, 200)
        add(f'trough_{ax_}', t, w=110, h=80, ax=55, ay=50)
    t = []
    sf.tank(t, 0, 0, 240)
    add('tank', t, w=90, h=80, ax=45, ay=50)
    t = []
    sf.hay_stack(t, 0, 0, 300)
    add('hay', t, w=120, h=100, ax=60, ay=70)
    t = []
    sf.barrel(t, 0, 0, 340)
    add('barrel', t, w=60, h=70, ax=30, ay=50)
    t = []
    sf.crate(t, 0, 0, 360)
    add('crate', t, w=70, h=70, ax=35, ay=50)
    t = []
    sf.pond(t, 0, 0, 2.0, 260)
    add('pond', t, w=150, h=100, ax=75, ay=50)
    add('bucket', [Prim('cyl', (0, 0, 0.26), (0.2, 0.26), 'steel', I3, None, 40), Prim('ell', (0, 0, 0.5), (0.18, 0.18, 0.04), 'water', I3, None, 41)], w=40, h=40, ax=20, ay=28)
    for i, r in enumerate((0.25, 0.34, 0.45)):
        add(f'stone_{i}', [Prim('ell', (0, 0, r * 0.5), (r, r * 0.85, r * 0.6), 'granite', I3, None, 400 + i)], w=50, h=40, ax=25, ay=28)
    for i, r in enumerate((0.55, 0.7, 0.85)):
        add(f'bush_{i}', [Prim('ell', (0, 0, r * 0.8), (r, r, r * 0.85), 'pine', I3, None, 420 + i)], w=70, h=70, ax=35, ay=50)
    add('pine', [Prim('cyl', (0, 0, 0.45), (0.12, 0.45), 'bark', I3, None, 600), Prim('cone', (0, 0, 1.9), (0.95, 1.4), 'pine', I3, None, 640)], w=80, h=110, ax=40, ay=90)
    for i, col in enumerate(('blossom', 'wheat', 'cream')):
        add(f'flower_{i}', [Prim('ell', (0, 0, 0.2), (0.07, 0.07, 0.1), col, I3, None, 500 + i), Prim('cyl', (0, 0, 0.08), (0.02, 0.1), 'reed', I3, None, 560 + i)], w=20, h=30, ax=10, ay=22, shadow=False)
    # bare earth: flat soil blobs the animals have trodden (three sizes), no shadow
    for i, r in enumerate((1.1, 1.6, 2.3)):
        add(f'dirt_{i}', [Prim('ell', (0, 0, 0.0), (r * 1.1, r * 0.9, 0.04), 'soil', I3, None, 700 + i)], w=150, h=90, ax=75, ay=45, shadow=False, outline=False)


def main():
    os.makedirs(OUT, exist_ok=True)
    build()
    index = {}
    for name, (img, (ax, ay)) in sorted(PARTS.items()):
        img.save(os.path.join(OUT, f'{name}.png'))
        index[name] = {'w': img.width, 'h': img.height, 'ax': ax, 'ay': ay}
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, indent='\t', sort_keys=True)
        f.write('\n')
    print('wrote', len(index), 'parts to', OUT)


if __name__ == '__main__':
    main()
