"""Mock maps for the dual-grid terrain layer, composed with the SAME logic and atlas data the game uses
(terrain_logic.py + terrain_build.py), so what you preview is what terrain.ts draws. Output: scripts/pixel/previews/.

    python terrain_preview.py            # terrain-sample.png (island), terrain-yard.png (canned map), zoom sims, sprite sheet
"""
import os
from PIL import Image
import terrain_art as art
import terrain_build as build
import terrain_logic as logic
from terrain_field import hash32, CELL

NAMES = {'P': 'plains', 'F': 'forest', 'L': 'lake', 'H': 'hills', 'S': 'swamp', 'T': 'tundra', 'B': 'coast',
         'G': 'grounds', 'Y': 'building', 'W': 'yard', 'C': 'castle'}


def make_layout(W=30, H=20):
    """An island with the biome arrangement of the reference map: tundra NW, hills N, swamp E, forest centre, lake SW."""
    def el(u, v, cx, cy, rx, ry):
        return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2

    rows = []
    for y in range(H):
        row = ''
        for x in range(W):
            u, v = (x + 0.5) / W, (y + 0.5) / H
            n = (hash32(x, y, 900) % 100) / 100 - 0.5
            if el(u, v, 0.5, 0.5, 0.47, 0.46) + n * 0.1 > 1:
                row += '.'
            elif el(u, v, 0.21, 0.78, 0.19, 0.14) + n * 0.12 < 1:
                row += 'L'
            elif el(u, v, 0.21, 0.78, 0.19, 0.14) + n * 0.12 < 1.7 or (v > 0.86 and el(u, v, 0.5, 0.5, 0.47, 0.46) > 0.55):
                row += 'B'
            elif el(u, v, 0.16, 0.22, 0.17, 0.17) + n * 0.1 < 1:
                row += 'T'
            elif el(u, v, 0.5, 0.17, 0.25, 0.18) + n * 0.1 < 1 or el(u, v, 0.78, 0.72, 0.12, 0.13) + n * 0.1 < 1:
                row += 'H'
            elif el(u, v, 0.87, 0.45, 0.1, 0.22) + n * 0.1 < 1:
                row += 'S'
            elif el(u, v, 0.5, 0.52, 0.16, 0.2) + n * 0.1 < 1:
                row += 'F'
            else:
                row += 'P'
        rows.append(row)
    return rows


def _crop_tex(tex, ox, oy):
    big = Image.new('RGBA', (art.TEX * 2, art.TEX * 2))
    for i in (0, 1):
        for j in (0, 1):
            big.paste(tex, (i * art.TEX, j * art.TEX))
    return big.crop((ox % art.TEX, oy % art.TEX, ox % art.TEX + CELL, oy % art.TEX + CELL))


def render_world(layout, m, images, sprites=True, marks=True):
    owned = [[NAMES.get(c) for c in row] for row in layout]
    g = logic.ground_grid(owned)
    h, w = len(g), len(g[0])
    pad = 48
    world = Image.new('RGBA', (w * CELL + 2 * pad, h * CELL + 2 * pad), (9, 16, 36, 255))
    for cy in range(h + 1):
        for cx in range(w + 1):
            ox, oy = cx * CELL - 24, cy * CELL - 24
            for style, mask, var in logic.cell_layers(g, cx, cy):
                tex = _crop_tex(art.texture(style), ox, oy)
                if mask == 15:
                    world.paste(tex, (ox + pad, oy + pad))
                    continue
                body, rim = art.render_cell(style, mask, var)
                world.paste(tex, (ox + pad, oy + pad), body)
                world.alpha_composite(rim, (ox + pad, oy + pad))
    if sprites:
        for pid, px, py in logic.all_pads(owned):
            world.alpha_composite(images[pid], (px + pad, py + pad))
        for sid, sx, sbottom in logic.all_sprites(m, g, logic.built_set(owned)):
            sp = images[sid]
            world.alpha_composite(sp, (sx + pad, sbottom - sp.size[1] + pad))
    if marks:
        mk = art.unknown_mark()
        mk.putalpha(mk.getchannel('A').point(lambda a: int(a * 0.8)))
        for y in range(h):
            for x in range(w):
                if g[y][x] == 'mist':
                    world.alpha_composite(mk, (x * CELL + (CELL - mk.size[0]) // 2 + pad, y * CELL + (CELL - mk.size[1]) // 2 + pad))
    return world.crop((pad, pad, pad + w * CELL, pad + h * CELL))


def sprite_sheet(images):
    """Contact sheet of every sprite at 3x, in manifest order."""
    k = 3
    sheet = Image.new('RGBA', (1500, 3000), (52, 70, 48, 255))
    x, y, rowh = 10, 10, 0
    for sid in sorted(images, key=lambda s: (s.startswith('pier'), s.startswith('boat'), len(s), s)):
        sp = images[sid]
        big = sp.resize((sp.size[0] * k, sp.size[1] * k), Image.NEAREST)
        if x + big.size[0] > 1490:
            x, y, rowh = 10, y + rowh + 12, 0
        sheet.alpha_composite(big, (x, y))
        x += big.size[0] + 14
        rowh = max(rowh, big.size[1])
    return sheet.crop((0, 0, 1500, y + rowh + 12))


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'previews')
    os.makedirs(out, exist_ok=True)
    m, images, _ = build.manifest()
    layout = make_layout()
    world = render_world(layout, m, images)
    world.save(os.path.join(out, 'terrain-sample.png'))
    for z in (0.75, 1.5):
        world.resize((int(world.size[0] * z), int(world.size[1] * z)), Image.NEAREST).save(os.path.join(out, f'terrain-sample-zoom{z}.png'))
    render_world(layout, m, images, sprites=False, marks=False).save(os.path.join(out, 'terrain-sample-bare.png'))
    rows, _ = build.parity_layout()
    render_world(rows, m, images).save(os.path.join(out, 'terrain-yard.png'))
    sprite_sheet(images).save(os.path.join(out, 'terrain-sprites.png'))
    print('wrote', out)


if __name__ == '__main__':
    main()
