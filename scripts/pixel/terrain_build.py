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
import landmarks
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
                if barrel == 0:                                          # swamp docks are rotten (no barrel), tundra docks are frozen in
                    images[f'pier_bog_{d}_{length}_0'] = props.cached(props.pier, d, length, False, 'bog')
                images[f'pier_ice_{d}_{length}_{barrel}'] = props.cached(props.pier, d, length, bool(barrel), 'ice')
    for pid, make in pads.PADS.items():
        images[pid] = make()
    for lm_id, make, _ in landmarks.LANDMARKS:                       # one big cosmetic scene per biome (landmarks.py), ids lm_<ground>
        images[lm_id] = make()
    for kind, name in (('', 'boat'), ('ice', 'boat_ice'), ('bog', 'boat_bog')):
        images[f'{name}_h'] = props.cached(props.boat, False, kind)
        images[f'{name}_v'] = props.cached(props.boat, True, kind)
    return images, table, decor


def _pool_spots(tier, half_w, half_h, apart, most):
    """Per 48px block of the (4x4 block) swamp texture of `tier`: up to `most` local centres whose box is all water and sits
    in the middle of the tile (the part its own dual-cell blobs always cover)."""
    p = art.PAL['swamp_d1' if tier else 'swamp']
    img = art.tex_swamp(tier)
    px = img.load()
    tex = art.TEX
    water = {tuple(art.C(p[k])) for k in ('water', 'water2', 'water_lt')}
    wet = [[tuple(px[x, y]) in water for x in range(tex)] for y in range(tex)]
    blocks = []
    for by in range(tex // CELL):
        for bx in range(tex // CELL):
            cand = [(lx, ly) for ly in range(14, CELL - 14) for lx in range(12, CELL - 12)
                    if all(wet[(by * CELL + ly + dy) % tex][(bx * CELL + lx + dx) % tex]
                           for dx in range(-half_w, half_w + 1) for dy in range(-half_h, half_h + 1))]
            cand.sort(key=lambda c: hash32(bx * CELL + c[0], by * CELL + c[1], 800))
            keep = []
            for c in cand:
                if all((c[0] - k[0]) ** 2 + (c[1] - k[1]) ** 2 >= apart * apart for k in keep):
                    keep.append(c)
                if len(keep) == most:
                    break
            blocks.append([list(c) for c in keep])
    return blocks


def water_spots():
    """Where things fit inside the swamp pools. `swamp`: ripple spots (13x5 box) in the deep-swamp texture; `swamp0`: smaller
    spots (9x5 box) in the plain swamp texture, so bubbles can also rise on the rim and in small swamps."""
    return {'swamp': _pool_spots(1, 6, 2, 14, 6), 'swamp0': _pool_spots(0, 4, 2, 12, 5)}


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


def shore_sheet(kind):
    """Rim overlays of the tinted lake shores: column = bits of the corners holding the tundra / swamp, row = mask * 2 + variant."""
    sheet = Image.new('RGBA', (16 * CELL, 32 * CELL), (0, 0, 0, 0))
    for mask in range(1, 15):
        for sub in range(1, 16):
            if sub & mask:
                continue                                              # those corners are lake themselves
            for var in (0, 1):
                sheet.paste(art.render_shore(kind, mask, sub, var), (sub * CELL, (mask * 2 + var) * CELL))
    return sheet


def parity_layout():
    """A canned map covering every ground (incl. yard, castle) plus unexplored tiles. A lowercase letter is a building on that biome's tile."""
    rows = [
        '.............................',
        '.TTTTTTT..HHHHHHHHH..........',
        '.TTTTtTTHHHHHHHHHHHH.........',
        '.TTTTTTPPHHHHHHHHHPP..SSS....',
        '.TTTPPPPPPHHHHHHPPPPPSsSSS...',
        '..PPPPPPPFFfFFFPPPPPPSSSSS...',
        '..PPPPPPPFFFFFFFPPPPPSSSS....',
        '.BBPPPPpPFFFFFFFPPPPPSSS.....',
        '.BBBPPPPPPFFFWFPPPPPPPP......',
        '.BLLBPPPPPPCPPPPPPPPBBB......',
        '.LLLLBPPPPPPPPPPPBBbBLL......',
        '.LLLLLLBBBBBBBBBBBLLLLL......',
        '.LLLLLLLLLLLLLLLLLLLLLL......',
        '..LLLLLLLLLLLLLLLLLLLL.......',
        '.............................',
    ]
    names = {'T': 'tundra', 'H': 'hills', 'P': 'plains', 'S': 'swamp', 'F': 'forest', 'W': 'yard', 'B': 'coast', 'L': 'lake', 'C': 'castle',
             't': 'tundra', 's': 'swamp', 'f': 'forest', 'p': 'plains', 'b': 'coast'}
    return rows, names


def layout_owned(rows, names):
    """(ground name per tile, coordinates of building tiles) from layout rows; lowercase letters are buildings."""
    owned = [[names.get(c) for c in row] for row in rows]
    built = {(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c.islower() and c != '.'}
    return owned, built


def landmark_layout():
    """A canned map for the landmark rules: one big block per ground, a block with a building inside, and a 6x6 that is one short."""
    rows = [
        '..............................',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '.FFFFFFFFFF.HHHHHHHHHH........',
        '..............................',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '.PPPPPPP.TTTTTTT.SSSSSSS......',
        '..............................',
        '.LLLLLLL.BBBBBBB.PPPPPp.......',
        '.LLLLLLL.BBBBBBB.PPPPPP.......',
        '.LLLLLLL.BBBBBBB.PPPPPP.......',
        '.LLLLLLL.BBBBBBB.PPPPPP.......',
        '.LLLLLLL.BBBBBBB.PPPPP........',
        '.LLLLLLL.BBBBBBB.PPPPPP.......',
        '..............................',
    ]
    return rows


def build_landmarks(m):
    rows = landmark_layout()
    _, names = parity_layout()
    owned, built = layout_owned(rows, names)
    g = logic.ground_grid(owned)
    return {'layout': rows, 'anchors': [list(a) for a in logic.landmark_anchors(g, built, 0, 0, len(g[0]) - 1, len(g) - 1)],
            'sprites': [list(s) for s in logic.all_sprites(m, g, built)]}


def build_parity(m):
    rows, names = parity_layout()
    owned, built = layout_owned(rows, names)
    g = logic.ground_grid(owned)
    return {
        'layout': rows,
        'names': names,
        'hashes': [[x, y, s, hash32(x, y, s)] for x, y, s in ((0, 0, 0), (1, 2, 3), (7, 5, 101), (49, 49, 520), (-1, 3, 300), (12, -2, 7))],
        'depth': [[logic.depth(g, x, y) for x in range(len(g[0]))] for y in range(len(g))],
        'cells': [[cx, cy, [list(layer) for layer in logic.cell_layers(g, cx, cy)]]
                  for cy in range(len(g) + 1) for cx in range(len(g[0]) + 1)],
        'sprites': [list(s) for s in logic.all_sprites(m, g, built)],
        'pads': [list(p) for p in logic.all_pads(owned, built)],
        'landmarks': build_landmarks(m),
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
    for kind in ('frost', 'bog'):
        shore_sheet(kind).save(os.path.join(OUT, f'shore_{kind}.png'))
        written.add(f'shore_{kind}.png')
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
