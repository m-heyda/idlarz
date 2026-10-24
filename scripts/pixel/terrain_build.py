"""Builds the terrain atlas the game loads (called by build.py; or run `python terrain_build.py`).

  public/pixel/terrain/tex_<style>.png     seamless 192x192 fill per style (plains, lake_d1, castle, ...)
  public/pixel/terrain/shapes_<style>.png  16 columns (shape mask 0..15) x 4 rows: body v0, rim v0, body v1, rim v1
  public/pixel/terrain/props.png           every sprite (trees, rocks, piers, boats...) shelf-packed
  src/config/terrainAtlas.json             sprite rects + prop tables (probabilities in thousandths)
  tests/fixtures/terrain-parity.json       expected layers / sprites for a canned map, checked against terrain.ts
"""
import json
import os
from PIL import Image
import terrain_art as art
import terrain_logic as logic
import terrain_pads as pads
import terrain_props as props
from terrain_field import CELL, hash32

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'pixel', 'terrain')
CONFIG = os.path.join(ROOT, 'src', 'config', 'terrainAtlas.json')
FIXTURE = os.path.join(ROOT, 'tests', 'fixtures', 'terrain-parity.json')

STYLES = list(art.STYLES)
SQUARE = [s for s in STYLES if art.STYLES[s].get('square')]
ATLAS_W = 1024


def _thousandths(probs):
    out = [round(p * 1000) for p in probs]
    out[-1] += 1000 - sum(out)
    return out


def collect():
    """(sprite images by id, props table). Sprite ids: pN for table sprites, pier_<side>_<len>_<barrel>, boat_h / boat_v."""
    images, ids, table = {}, {}, {}
    for ground, spec in props.PROPS.items():
        opts = []
        for name, build, weight, min_depth in spec['opts']:
            key = (build[0], tuple(id(v) if isinstance(v, dict) else v for v in build[1:]))
            if key not in ids:
                ids[key] = f'p{len(ids)}'
                images[ids[key]] = props.cached(*build)
            opts.append([ids[key], weight, min_depth])
        table[ground] = {'edge': _thousandths(spec['edge']), 'deep': _thousandths(spec['deep']), 'opts': opts}
    decor = {}
    for ground, spec in props.DECOR.items():                       # after the props, so their ids never shift
        opts = []
        for name, build, weight, min_depth in spec['opts']:
            key = (build[0], tuple(id(v) if isinstance(v, dict) else v for v in build[1:]))
            if key not in ids:
                ids[key] = f'p{len(ids)}'
                images[ids[key]] = props.cached(*build)
            opts.append([ids[key], weight, min_depth])
        decor[ground] = {'edge': _thousandths(spec['edge']), 'deep': _thousandths(spec['deep']), 'opts': opts}
    for d in 'nesw':
        for length in (22, 26, 30):
            for barrel in (0, 1):
                images[f'pier_{d}_{length}_{barrel}'] = props.cached(props.pier, d, length, bool(barrel))
    for pid, make in pads.PADS.items():
        images[pid] = make()
    images['boat_h'] = props.cached(props.boat, False)
    images['boat_v'] = props.cached(props.boat, True)
    return images, table, decor


def water_spots():
    """Where a ripple fits inside the swamp pools: per 48px block of the (4x4 block) deep-swamp texture, up to 6 local
    centres whose 13x5 box is all water and sits in the middle of the tile (the part its own dual-cell blobs always cover)."""
    p = art.PAL['swamp_d1']
    img = art.tex_swamp(1)
    px = img.load()
    tex = art.TEX
    water = {tuple(art.C(p[k])) for k in ('water', 'water2', 'water_lt')}
    wet = [[tuple(px[x, y]) in water for x in range(tex)] for y in range(tex)]
    blocks = []
    for by in range(tex // CELL):
        for bx in range(tex // CELL):
            cand = [(lx, ly) for ly in range(14, CELL - 14) for lx in range(12, CELL - 12)
                    if all(wet[(by * CELL + ly + dy) % tex][(bx * CELL + lx + dx) % tex] for dx in range(-6, 7) for dy in range(-2, 3))]
            cand.sort(key=lambda c: hash32(bx * CELL + c[0], by * CELL + c[1], 800))
            keep = []
            for c in cand:
                if all((c[0] - k[0]) ** 2 + (c[1] - k[1]) ** 2 >= 14 * 14 for k in keep):
                    keep.append(c)
                if len(keep) == 6:
                    break
            blocks.append([list(c) for c in keep])
    return {'swamp': blocks}


def pack(images):
    """Shelf-pack sprites into one atlas; returns (atlas image, {id: [x, y, w, h]})."""
    order = sorted(images, key=lambda k: (-images[k].size[1], k))
    rects, x, y, row_h = {}, 0, 0, 0
    for k in order:
        w, h = images[k].size
        if x + w > ATLAS_W:
            x, y, row_h = 0, y + row_h + 1, 0
        rects[k] = [x, y, w, h]
        x += w + 1
        row_h = max(row_h, h)
    atlas = Image.new('RGBA', (ATLAS_W, y + row_h), (0, 0, 0, 0))
    for k, (rx, ry, _, _) in rects.items():
        atlas.paste(images[k], (rx, ry))
    return atlas, rects


def shapes_sheet(style):
    sheet = Image.new('RGBA', (16 * CELL, 4 * CELL), (0, 0, 0, 0))
    for mask in range(1, 15):                                        # 0 is empty, 15 is a plain fill (no shape needed)
        for var in (0, 1):
            body, rim = art.render_cell(style, mask, var)
            white = Image.new('RGBA', (CELL, CELL), (255, 255, 255, 255))
            white.putalpha(body)
            sheet.paste(white, (mask * CELL, var * 2 * CELL))
            sheet.paste(rim, (mask * CELL, (var * 2 + 1) * CELL))
    return sheet


def parity_layout():
    """A canned map covering every ground (incl. farmland, yard, castle) plus unexplored tiles."""
    rows = [
        '.............................',
        '.TTTTTTT..HHHHHHHHH..........',
        '.TTTTYTTHHHHHHHHHHHH.........',
        '.TTTTTTPPHHHHHHHHHPP..SSS....',
        '.TTTPPPPPPHHHHHHPPPPPSYSSS...',
        '..PPPPPPPFFYFFFPPPPPPSSSSS...',
        '..PPPPGGPFFFFFFFPPPPPSSSS....',
        '.BBPPPGYPFFFFFFFPPPPPSSS.....',
        '.BBBPPPPPPFFFWFPPPPPPPP......',
        '.BLLBPPPPPPCPPPPPPPPBBB......',
        '.LLLLBPPPPPPPPPPPBBYBLL......',
        '.LLLLLLBBBBBBBBBBBLLLLL......',
        '.LLLLLLLLLLLLLLLLLLLLLL......',
        '..LLLLLLLLLLLLLLLLLLLL.......',
        '.............................',
    ]
    names = {'T': 'tundra', 'H': 'hills', 'P': 'plains', 'S': 'swamp', 'F': 'forest', 'G': 'grounds', 'Y': 'building',
             'W': 'yard', 'B': 'coast', 'L': 'lake', 'C': 'castle'}
    return rows, names


def build_parity(m):
    rows, names = parity_layout()
    owned = [[names.get(c) for c in row] for row in rows]
    g = logic.ground_grid(owned)
    return {
        'layout': rows,
        'names': names,
        'hashes': [[x, y, s, hash32(x, y, s)] for x, y, s in ((0, 0, 0), (1, 2, 3), (7, 5, 101), (49, 49, 520), (-1, 3, 300), (12, -2, 7))],
        'depth': [[logic.depth(g, x, y) for x in range(len(g[0]))] for y in range(len(g))],
        'cells': [[cx, cy, [list(layer) for layer in logic.cell_layers(g, cx, cy)]]
                  for cy in range(len(g) + 1) for cx in range(len(g[0]) + 1)],
        'sprites': [list(s) for s in logic.all_sprites(m, g, logic.built_set(owned))],
        'pads': [list(p) for p in logic.all_pads(owned)],
    }


def manifest():
    images, table, decor = collect()
    atlas, rects = pack(images)
    m = {'cell': CELL, 'tex': art.TEX, 'styles': STYLES, 'square': SQUARE, 'sprites': rects, 'props': table, 'decor': decor, 'water': water_spots()}
    return m, images, atlas


def write_all(verbose=True):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.dirname(FIXTURE), exist_ok=True)
    m, images, atlas = manifest()
    written = set()
    for style in STYLES:
        art.texture(style).save(os.path.join(OUT, f'tex_{style}.png'))
        shapes_sheet(style).save(os.path.join(OUT, f'shapes_{style}.png'))
        written |= {f'tex_{style}.png', f'shapes_{style}.png'}
        if verbose:
            print('  terrain style', style)
    atlas.save(os.path.join(OUT, 'props.png'))
    written.add('props.png')
    for name in os.listdir(OUT):
        if name not in written:
            os.remove(os.path.join(OUT, name))
    with open(CONFIG, 'w', encoding='utf-8') as f:
        json.dump(m, f, separators=(',', ':'))
        f.write('\n')
    with open(FIXTURE, 'w', encoding='utf-8') as f:
        json.dump(build_parity(m), f, separators=(',', ':'))
        f.write('\n')
    size = sum(os.path.getsize(os.path.join(OUT, n)) for n in written)
    print(f'terrain: {len(STYLES)} styles, {len(images)} sprites, {size // 1024} KB -> {OUT}')
    return m


if __name__ == '__main__':
    write_all()
