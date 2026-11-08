"""DEV-ONLY art for the five rebirth biomes (docs/plan/12-rebirth-biomes.md): jungle, fields, orchard, blight, battlefield.

Importing this module registers them into the terrain pipeline (palettes, textures, rims, props, decor); terrain_build.py imports it,
so they are built into public/pixel/terrain and src/config/terrainAtlas.json like every other ground. Whether the *game* uses a biome is
decided only by src/config/biomeStage.ts (dev = map lab only). The draw order and hash ids are in terrain_logic.py.

Art sources: every ground, rim and the Jungle / Fields / Orchard / Blight props are drawn here and in terrain_dev_sprites.py
in the style of terrain_props.py; the Battlefield props are cut from art_style_reference/biomes by cut_biome_refs.py.
Concepts: Jungle = river-cut teal rainforest with palms, bamboo, banyans and exotic flowers; Fields = a patchwork of farm plots;
Orchard = blossom trees in six shapes and five colours; Blight = a violet spore wasteland of giant mushrooms and amethyst crystal;
Battlefield = churned mud with graves and bones.
"""
import os
from PIL import Image
import terrain_art as art
import terrain_props as props
from common import hexc as C
from fog import tnoise
from terrain_field import hash32
from terrain_art import _banded, _tufts, _sprinkle, _warped, _put, TEX
from terrain_props import boulder
import terrain_dev_sprites as S

DEV_BIOMES = ('jungle', 'fields', 'orchard', 'blight', 'battlefield')
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'biomes')


# ------------------------------------------------------------------ palettes
art.PAL.update({
    'jungle':   dict(tones=['#14564a', '#195f52', '#1e685a'], dk='#0f4238', lt='#2a8a74', tuft='#0c3a30', tuft_lt='#46b898', edge='#0c3a30'),
    'jungle_d1': dict(tones=['#0f4a42', '#13534a', '#175c52'], dk='#0a3a32', lt='#1f7664', tuft='#08302a', tuft_lt='#3aa088', edge='#0c3a30'),
    'fields':   dict(edge='#b89038', straw='#f2dc88'),
    'orchard':  dict(tones=['#7fc04a', '#88c850', '#92d058'], dk='#6aa83e', lt='#a4de68', tuft='#4f8f30', tuft_lt='#bdf080', edge='#5a9a38'),
    'blight':   dict(tones=['#4a2a6a', '#523070', '#5a3678'], dk='#3c2058', lt='#6e4490', tuft='#7a4aa0', tuft_lt='#b888e0', edge='#2a1648',
                     pool='#9a3ab8', pool_lt='#c868e0', lip='#f0b0f8', drip='#c050d0', mist='#8a5ab0'),
    'blight_d1': dict(tones=['#3c2058', '#44265f', '#4c2c68'], dk='#30184a', lt='#5a3680', tuft='#6a3a90', tuft_lt='#a070d0', edge='#2a1648',
                      pool='#8a2ea8', pool_lt='#b858d0', lip='#e0a0f0', drip='#c050d0', mist='#8a5ab0'),
    'battlefield': dict(tones=['#6a5a48', '#725f4a', '#7a6650'], ash='#8a7a62', mud='#4e4034', dark='#3a3028', rut='#3e3228', edge='#3e3228', ash_lt='#a89a84'),
})
art.STYLES.update({
    'jungle': dict(amp=5.0, lobe=3.0), 'jungle_d1': dict(amp=6.0, lobe=2.5),
    'fields': dict(amp=4.0, lobe=0.0), 'orchard': dict(amp=5.0, lobe=1.5),
    'blight': dict(amp=6.0, lobe=3.0), 'blight_d1': dict(amp=6.0, lobe=2.5),
    'battlefield': dict(amp=6.0, lobe=2.0),
})


# ------------------------------------------------------------------ textures
def _soft(p, seed, cells=(3, 7), patch_lt=0.66, patch_dk=0.3):
    """The shipped grounds' recipe: three banded tones, a lighter and a darker soft patch, nothing else."""
    img, px = _banded(p['tones'], seed, cells=cells)
    for y in range(TEX):
        for x in range(TEX):
            v = _warped(x, y, 3, seed + 2)
            if v > patch_lt:
                px[x, y] = C(p['lt'])
            elif v < patch_dk:
                px[x, y] = C(p['dk'])
    return img, px


def tex_jungle(tier=0):
    p = art.PAL['jungle_d1' if tier else 'jungle']
    img, px = _soft(p, 301 + tier * 4, cells=(4, 9))
    _tufts(px, p, 305, 14, 0.4)
    water, deep, bank, lip = C('#1f8498'), C('#176a80'), C('#3c5a38'), C('#6ad0c8')   # a narrow winding river with muddy banks
    is_w = [[False] * TEX for _ in range(TEX)]
    for y in range(TEX):
        for x in range(TEX):
            d = abs(_warped(x, y, 3, 309 + tier, 30) - 0.5)
            if d < 0.021:
                is_w[y][x] = True
                px[x, y] = deep if d < 0.009 else water
            elif d < 0.033:
                px[x, y] = bank
    for y in range(TEX):
        for x in range(TEX):
            if is_w[y][x] and not is_w[(y - 1) % TEX][(x - 1) % TEX]:
                px[x, y] = lip
    return img


# farm plots: one 48 px plot per tile (the texture is world-anchored, so the patchwork lines up with the tile grid)
_PLOTS = [(('#dcc05a', '#d2b650'), 3), (('#e6d28a', '#dcc880'), 1), (('#8cb84a', '#82ae42'), 1), (('#a07a48', '#946e3e'), 1),
          (('#e0a840', '#d69e38'), 1), (('#a8c868', '#9ec05e'), 1)]
_PLOT_POOL = [cols for cols, w in _PLOTS for _ in range(w)]


def tex_fields():
    img = Image.new('RGBA', (TEX, TEX))
    px = img.load()
    for y in range(TEX):
        for x in range(TEX):
            cx, cy, lx, ly = x // 48, y // 48, x % 48, y % 48
            h = hash32(cx, cy, 23)
            ix, iy = lx - 2, ly - 2
            inside = 0 <= ix < 44 and 0 <= iy < 44 and min(ix, 43 - ix) + min(iy, 43 - iy) >= 3
            if not inside:
                px[x, y] = C('#b08a5a') if hash32(x, y, 3) % 7 else C('#c4a070')
                continue
            cols = _PLOT_POOL[h % len(_PLOT_POOL)]
            u = lx if (h >> 4) % 2 else ly
            col = C(cols[(u // 3) % 2])
            if min(ix, 43 - ix, iy, 43 - iy) == 0:                       # a darker 1 px edge so every plot reads as one field
                col = tuple(max(0, c - 22) for c in col[:3]) + (255,)
            px[x, y] = col
    return img


def tex_orchard():
    p = art.PAL['orchard']
    img, px = _soft(p, 321, cells=(3, 7))
    _tufts(px, p, 325, 12, 0.4)
    pet = [C('#fff0f4'), C('#f8c8d8')]
    _sprinkle(327, 18, 0.5, lambda x, y: _put(px, x, y, pet[hash32(x, y, 5) % 2]))
    return img


def tex_blight(tier=0):
    p = art.PAL['blight_d1' if tier else 'blight']
    img, px = _soft(p, 331 + tier * 3, cells=(3, 7))
    _tufts(px, p, 335, 14, 0.35)
    pool_c, lit_c = C(p['pool']), C(p['pool_lt'])
    is_pool = [[False] * TEX for _ in range(TEX)]
    for y in range(TEX):
        for x in range(TEX):
            pool = 0.6 * tnoise(x, y, TEX, 4, 333) + 0.4 * tnoise(x, y, TEX, 9, 337)
            if pool > (0.72 if tier else 0.76):
                is_pool[y][x] = True
                px[x, y] = lit_c if pool > 0.82 else pool_c
    for y in range(TEX):                                      # a bright lip on the top-left of each ichor pool
        for x in range(TEX):
            if is_pool[y][x] and not is_pool[(y - 1) % TEX][(x - 1) % TEX]:
                px[x, y] = C(p['lip'])
    return img


def tex_battlefield():
    p = art.PAL['battlefield']
    img, px = _banded(p['tones'], 341, cells=(3, 7))
    for y in range(TEX):
        for x in range(TEX):
            v = _warped(x, y, 3, 343)
            if v > 0.66:
                px[x, y] = C(p['ash'])
            elif v < 0.3:
                px[x, y] = C(p['mud'])
    return img


art.TEXTURES.update({
    'jungle': tex_jungle, 'jungle_d1': lambda: tex_jungle(1), 'fields': tex_fields, 'orchard': tex_orchard,
    'blight': tex_blight, 'blight_d1': lambda: tex_blight(1), 'battlefield': tex_battlefield,
})


# ------------------------------------------------------------------ rims
_paint_shipped = art._paint


def _paint_dev(style, sd, lit, r, x, y):
    fam = style.split('_')[0]
    if fam not in DEV_BIOMES:
        return _paint_shipped(style, sd, lit, r, x, y)
    p = art.PAL[style]
    tier = style[-2:] == 'd1'
    if fam == 'jungle':
        if tier:
            return None
        if 0 <= sd < 1.7:
            return C(p['edge'])
        if -2 <= sd < 0 and r < 0.4:
            return C(p['tuft']) if r < 0.22 else C(p['tuft_lt'])
    elif fam == 'fields':
        if 0 <= sd < 1.6:
            return C(p['edge'])
        if -2 <= sd < 0 and r < 0.4:
            return C(p['straw'])
    elif fam == 'orchard':
        if 0 <= sd < 1.6:
            return C(p['edge'])
        if -2 <= sd < 0 and r < 0.3:
            return C('#f8c8d8') if r < 0.15 else C('#fff0f4')
    elif fam == 'blight':
        if tier:
            return None
        if 0 <= sd < 1.8:
            return C(p['drip']) if r < 0.2 else C(p['edge'])
        if -3 <= sd < 0 and r < 0.2:
            return C(p['mist'])                                    # a violet haze creeps over the neighbour
    elif fam == 'battlefield':
        if 0 <= sd < 1.8:
            return C(p['edge'])
        if -2 <= sd < 0 and r < 0.35:
            return C(p['ash_lt']) if r < 0.15 else C(p['dark'])
    return None


art._paint = _paint_dev


# ------------------------------------------------------------------ depth (the rank, land list and hash ids live in terrain_logic.py)
art.MAX_DEPTH.update({'jungle': 1, 'blight': 1})


# ------------------------------------------------------------------ tables (same shape as terrain_props.PROPS / DECOR)
def asset(name):
    return Image.open(os.path.join(ASSETS, name + '.png')).convert('RGBA')


A = lambda name, w, d=0: (name, (asset, name), w, d)
MOSS = dict(lit='#6ac08a', mid='#3e8a60', dark='#2a6446', crack='#1c4a34', outline='#143a28')
VROCK = dict(lit='#a07ac8', mid='#6a4a98', dark='#44286c', crack='#2c1648', outline='#1c0c34')
J = S.JUNGLE

props.PROPS.update({
    'jungle': dict(edge=[0.3, 0.44, 0.22, 0.04], deep=[0.08, 0.3, 0.42, 0.2],
                   opts=[('jtree0', (S.jungle_tree, 0), 3, 0), ('jtree1', (S.jungle_tree, 1), 2, 0),
                         ('jemerg0', (S.tree_shape, 'umbrella', 40, J, ()), 3, 0), ('jemerg1', (S.tree_shape, 'umbrella', 41, J, ()), 2, 1),
                         ('jtall0', (S.tree_shape, 'tall', 42, J, ()), 3, 0), ('jtall1', (S.tree_shape, 'tall', 43, J, ()), 2, 0),
                         ('banyan', (S.banyan,), 2, 1), ('palm0', (S.jungle_palm, 0), 3, 0), ('palm1', (S.jungle_palm, 1), 3, 0),
                         ('palm2', (S.jungle_palm, 2), 2, 0), ('bamboo0', (S.bamboo, 0), 2, 0), ('bamboo1', (S.bamboo, 1), 2, 0),
                         ('treefern', (S.tree_fern,), 2, 0), ('fern_g', (S.fern_giant,), 2, 0), ('banana', (S.banana,), 2, 0),
                         ('roots', (S.roots, 0), 2, 0), ('roots1', (S.roots, 1), 1, 0), ('bop', (S.bird_of_paradise,), 2, 0),
                         ('hibiscus', (S.hibiscus,), 2, 0), ('orchid_t', (S.orchid_tall,), 2, 0), ('lily', (S.giant_lily,), 1, 0),
                         ('orchid_b', (S.orchid_bush,), 1, 0), ('hardwood', (S.hardwood_log,), 1, 1), ('mrock', (boulder, 11, 0, MOSS), 1, 0)]),
    'fields': dict(edge=[0.42, 0.4, 0.16, 0.02], deep=[0.3, 0.42, 0.22, 0.06],
                   opts=[('scarecrow', (S.scarecrow,), 2, 0), ('scarecrow_f', (S.scarecrow_flipped,), 1, 0), ('haystack', (S.haystack,), 4, 0),
                         ('bale', (S.hay_bale,), 3, 0), ('wheat', (S.wheat,), 3, 0), ('fence', (S.fence_broken,), 3, 0), ('barn', (S.barn_ruin,), 1, 1),
                         ('windmill', (S.windmill,), 1, 1), ('hedge', (S.hedge,), 2, 0), ('hay_cart', (S.hay_cart,), 2, 0),
                         ('wheelbarrow', (S.wheelbarrow,), 2, 0), ('sacks', (S.sacks,), 2, 0), ('barrel', (S.barrel,), 2, 0),
                         ('well', (S.farm_well,), 1, 1), ('trough', (S.trough,), 2, 0)]),
    'orchard': dict(edge=[0.3, 0.42, 0.24, 0.04], deep=[0.1, 0.32, 0.38, 0.2],
                    opts=[('apple_r', (S.tree_shape, 'round', 60, S.APPLE, ('#d8402e', '#e86a4a')), 3, 0),
                          ('apple_g', (S.tree_shape, 'gnarled', 61, S.APPLE, ('#d8402e', '#f0c040')), 2, 0),
                          ('cherry_t', (S.tree_shape, 'tall', 62, S.CHERRY, ('#fff0f4', '#f8c8d8')), 3, 0),
                          ('cherry_w', (S.tree_shape, 'weeping', 63, S.CHERRY, ('#fff0f4', '#f8c8d8')), 3, 0),
                          ('white_u', (S.tree_shape, 'umbrella', 64, S.WHITE, ('#ffffff', '#f4e8a0')), 3, 0),
                          ('peach_r', (S.tree_shape, 'round', 65, S.PEACH, ('#fff0e4', '#e8708a')), 2, 0),
                          ('pear_c', (S.tree_shape, 'cone', 66, S.APPLE, ('#e8e060', '#c8d048')), 2, 0),
                          ('lilac_w', (S.tree_shape, 'weeping', 67, S.LILAC, ('#ffffff', '#c8a8e8')), 2, 0),
                          ('lilac_u', (S.tree_shape, 'umbrella', 68, S.LILAC, ('#fff4ff', '#d8b8f0')), 1, 0),
                          ('sapling', (S.tree_shape, 'sapling', 69, S.CHERRY, ('#fff0f4',)), 2, 0),
                          ('hive', (S.beehive,), 2, 0), ('bed', (S.flower_bed,), 3, 0), ('tulips', (S.tulips,), 3, 0), ('daisies', (S.daisies,), 3, 0),
                          ('bbush', (S.blossom_bush,), 3, 0), ('crate', (S.apple_crate,), 2, 0), ('ladder', (S.ladder,), 1, 0), ('picket', (S.picket,), 2, 0)]),
    'blight': dict(edge=[0.5, 0.34, 0.14, 0.02], deep=[0.3, 0.4, 0.22, 0.08],
                   opts=[('shroom_s', (S.spore_shroom, 0), 4, 0), ('shroom_m', (S.spore_shroom, 1), 3, 0), ('shroom_l', (S.spore_shroom, 2), 2, 1),
                         ('crystal_a', (S.crystals, 0), 3, 0), ('crystal_b', (S.crystals, 1), 3, 0), ('crystal_c', (S.crystals, 2), 2, 1),
                         ('bramble0', (S.bramble, 0), 3, 0), ('bramble1', (S.bramble, 1), 2, 0), ('tentacle0', (S.tentacle, 0), 3, 0),
                         ('tentacle1', (S.tentacle, 1), 2, 0), ('pod_s', (S.pod, 0), 3, 0), ('pod_l', (S.pod, 1), 2, 0),
                         ('twisted0', (S.twisted_tree, 0), 3, 0), ('twisted1', (S.twisted_tree, 1), 2, 1), ('vrock', (boulder, 21, 1, VROCK), 2, 0),
                         ('vrock_s', (boulder, 22, 0, VROCK), 2, 0)]),
    'battlefield': dict(edge=[0.46, 0.38, 0.14, 0.02], deep=[0.3, 0.4, 0.22, 0.08],
                        opts=[A(f'tomb_{i}', 2) for i in range(6)] +
                             [A('skull_pile', 2), A('ribs', 1), A('bones', 2), A('pale_tree_0', 2, 1), A('pale_tree_1', 3), A('pale_stump', 2),
                              A('hand_green', 1), A('crypt_s', 1, 1), ('sword', (S.sword_in_ground,), 3, 0), ('banner', (S.banner,), 4, 0),
                              ('spear', (S.spear,), 2, 0), ('cart', (S.broken_cart,), 1, 1)]),
})
props.DECOR.update({
    'jungle': dict(edge=[0.4, 0.34, 0.18, 0.08], deep=[0.3, 0.36, 0.22, 0.12],
                   opts=[('orc0', (S.exotic_tiny, 0), 3, 0), ('orc1', (S.exotic_tiny, 1), 3, 0), ('orc2', (S.exotic_tiny, 2), 3, 0), ('orc3', (S.exotic_tiny, 3), 2, 0),
                         ('leaf', (S.leaf_litter,), 2, 0)]),
    'fields': dict(edge=[0.5, 0.3, 0.15, 0.05], deep=[0.5, 0.3, 0.15, 0.05], opts=[('poppy', (S.poppy,), 3, 0), ('corn', (S.cornflower,), 2, 0), ('hen', (S.hen,), 2, 0)]),
    'orchard': dict(edge=[0.2, 0.3, 0.3, 0.14, 0.06], deep=[0.2, 0.3, 0.3, 0.14, 0.06],
                    opts=[('petals', (S.petals,), 4, 0), ('apple_f0', (S.fallen_apple, 0), 2, 0), ('clover', (S.clover,), 2, 0),
                          ('fl0', (props.tiny_flower, 0), 3, 0), ('fl1', (props.tiny_flower, 1), 2, 0), ('fl2', (props.tiny_flower, 2), 4, 0), ('fl3', (props.tiny_flower, 3), 2, 0),
                          ('branch', (S.fallen_branch,), 2, 0)]),
    'blight': dict(edge=[0.4, 0.34, 0.18, 0.08], deep=[0.3, 0.36, 0.22, 0.12],
                   opts=[('spore', (S.glow_spore,), 4, 0), ('mini', (S.mini_shroom, 0), 3, 0), ('mini1', (S.mini_shroom, 1), 2, 0), ('shard', (S.shard,), 3, 0)]),
    'battlefield': dict(edge=[0.5, 0.32, 0.14, 0.04], deep=[0.5, 0.32, 0.14, 0.04], opts=[('crater', (S.crater,), 3, 0), A('bone_a', 2), A('bone_c', 2), A('skull', 1)]),
})
