"""LEGACY (do not run). New art is made in Sprite Fusion and then recoloured or touched up in existing images; see "Assets" in CLAUDE.md.
This procedural pipeline only stays for the few things Sprite Fusion cannot make yet (new kinds of thing, a special effect) and for the
starter item_* icons that still come from sprites_gear.py. Running it rewrites hand-made files in public/pixel/icons and deletes
every file it does not know about, so main() refuses unless you pass --legacy.

Builds the old pixel assets.   python scripts/pixel/build.py --legacy [name ...]

  public/pixel/icons/  sprites (resources, menu, equipment, portraits, animals, gold shine strip); the item_* ones are listed in
                       src/config/itemIcons/*.json (the item icon registry, checked by item_registry.py before the build)
  public/pixel/ui/     frames, header chrome, stone XP bar
  public/pixel/bg/     cracked-stone header tile, fog mist, biome ground swatches (dialogs, farm stage)
  public/pixel/terrain/ dual-grid map terrain: textures, shape atlases, sprite atlas (+ src/config/terrainAtlas.json)
  scripts/pixel/previews/  contact sheets for review (git-ignored)
  --refs                   also refresh the curated images in scripts/pixel/reference/

Files are rewritten in place and anything stale is removed afterwards, so a running dev server never 404s."""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render3d  # noqa: E402

render3d.DEFAULTS.update(rim=True, dither=0.2)       # the house look: rim light + whisper of dither

from PIL import Image  # noqa: E402
import fog  # noqa: E402
import ground_art  # noqa: E402
import ui_art  # noqa: E402
import sprites_animal_art  # noqa: E402
import sprites_menu_art  # noqa: E402
import sprites_characters  # noqa: E402
import sprites_equipment  # noqa: E402
import sprites_gear  # noqa: E402
import sprites_map  # noqa: E402
import sprites_menu  # noqa: E402
import sprites_water  # noqa: E402
import sprites_monsters  # noqa: E402
import sprites_meadow  # noqa: E402
import sprites_props  # noqa: E402
import sprites_resources  # noqa: E402
import sprites_resource_art  # noqa: E402
import sprites_sheet  # noqa: E402
import item_registry  # noqa: E402
import terrain_art  # noqa: E402
import terrain_build  # noqa: E402
import terrain_preview  # noqa: E402
from common import upscale  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PUB = os.path.join(ROOT, 'public', 'pixel')
PREVIEW = os.path.join(HERE, 'previews')

SPRITES = {
    # cut from the supplied sheet (assets/*.png): resources, reserved currencies, the gem and both chests
    **sprites_sheet.SPRITES,
    # no picture in the sheet: bread, the emerald ability shard, farm products
    'food': sprites_resources.carrot, 'res_shard': sprites_resources.shard, 'diamond': sprites_resources.diamond,
    'eggs': sprites_resources.eggs, 'milk': sprites_resources.milk, 'hide': sprites_resources.hide,
    'menu_character': sprites_props.helm,
    'level_orb': sprites_props.level_orb,
    **sprites_characters.SPRITES,
    **sprites_animal_art.SPRITES,
    **sprites_meadow.SPRITES,
    **sprites_map.SPRITES,
    **sprites_menu.SPRITES,
    **sprites_menu_art.SPRITES,  # Sprite Fusion menu buttons: menu_equipment, merchant, farm, crafting, legacy (rebirth) and the unwired extras
    **sprites_water.SPRITES,
    **sprites_monsters.SPRITES,
    **sprites_gear.SPRITES,
    # supplied resource art (public/pixel/resources/) wins over the procedural and sheet versions above
    **sprites_resource_art.SPRITES,
}

UI = {
    'frame_modal': ui_art.frame_modal, 'frame_panel': ui_art.frame_panel, 'frame_tip': ui_art.frame_tip,
    'slot_frame': lambda: ui_art.slot_frame(False), 'slot_frame_active': lambda: ui_art.slot_frame(True),
    'slot_frame_s': lambda: ui_art.slot_frame(False, 40), 'slot_frame_s_active': lambda: ui_art.slot_frame(True, 40),
    'header_edge': ui_art.header_edge, 'header_divider': ui_art.header_divider,
    'header_xp_frame': ui_art.header_xp_frame, 'header_xp_fill': ui_art.header_xp_fill,
    'bar_frame': ui_art.bar_frame, 'bar_fill': ui_art.bar_fill,
    'torch': ui_art.torch_sheet,
    'range_corner': ui_art.range_corner, 'range_tint': ui_art.range_tint, 'spark_sheet': ui_art.spark_sheet,
    'banner_left': ui_art.banner_left, 'banner_mid': ui_art.banner_mid, 'banner_right': ui_art.banner_right,
}

BG = {
    'crack': fog.crack_tile,
    'fog_a': ground_art.fog,
    'fog_b': lambda: ground_art.fog(size=64, seed=11, tint=(110, 170, 190), thresholds=(0.44, 0.52, 0.60), alphas=(10, 22, 36)),
    **{f'ground_{name}': (lambda n=name: terrain_art.texture(n))      # swatches for dialogs / the farm stage
       for name in ('forest', 'plains', 'hills', 'swamp', 'tundra', 'lake', 'coast', 'castle', 'yard')},
}


def save_group(folder, makers, only):
    out = os.path.join(PUB, folder)
    os.makedirs(out, exist_ok=True)
    made = {}
    for name, fn in makers.items():
        if only and name not in only:
            continue
        img = fn()
        img.save(os.path.join(out, f'{name}.png'))
        made[name] = img
    return made


def contact_sheet(imgs, path, k=5, cols=6, bg=(150, 133, 117, 255)):
    """Sprites at k x on a flat colour, one cell per sprite (the cell fits the biggest one)."""
    cw = max(56, max(im.size[0] for im in imgs.values())) * k + 16
    ch = max(56, max(im.size[1] for im in imgs.values())) * k + 16
    rows = -(-len(imgs) // cols)
    sheet = Image.new('RGBA', (cw * cols, ch * rows), bg)
    for i, im in enumerate(imgs.values()):
        big = upscale(im, k)
        sheet.alpha_composite(big, ((i % cols) * cw + (cw - big.size[0]) // 2, (i // cols) * ch + (ch - big.size[1]) // 2))
    sheet.save(path)


REFERENCE = os.path.join(HERE, 'reference')


def small_sprites(sprites):
    """Contact sheets show icon-sized art only (not the big farm pen layers)."""
    return {n: im for n, im in sprites.items() if im.size[0] <= 80 and not n.startswith(('meadow_', 'bonus_'))}


def reference_sheets(sprites, ui, bg):
    os.makedirs(REFERENCE, exist_ok=True)
    for stale in ('biome-blend.png', 'map-tiles.png'):
        if os.path.exists(os.path.join(REFERENCE, stale)):
            os.remove(os.path.join(REFERENCE, stale))
    contact_sheet(small_sprites(sprites), os.path.join(REFERENCE, 'icons.png'), k=4, cols=6)
    # the 16 town buildings (48x60, no ground) on meadow green; the foundation pads are shown in map-terrain.png
    contact_sheet({n: im for n, im in sprites.items() if n.startswith('building_')}, os.path.join(REFERENCE, 'town.png'), k=3, cols=4, bg=(88, 140, 60, 255))
    # fog: two layers over the map colour, tiled
    sheet = Image.new('RGBA', (384, 256), (7, 10, 18, 255))
    for i in range(3):
        for j in range(2):
            sheet.alpha_composite(bg['fog_a'], (i * 128, j * 128))
    sheet.save(os.path.join(REFERENCE, 'fog.png'))
    strip = Image.open(os.path.join(PUB, 'icons', 'gold_shine.png'))
    shine = Image.new('RGBA', (strip.size[0] * 3, strip.size[1] * 3), (26, 19, 15, 255))
    shine.alpha_composite(upscale(strip, 3))
    shine.save(os.path.join(REFERENCE, 'gold-shine.png'))
    # map: the dual-grid terrain sample island (organic edges, depth tiers, sprites, docks)
    m, images, _ = terrain_build.manifest()
    terrain_preview.render_world(terrain_preview.make_layout(), m, images).save(os.path.join(REFERENCE, 'map-terrain.png'))
    terrain_preview.sprite_sheet(images).save(os.path.join(REFERENCE, 'map-sprites.png'))
    # UI parts at 3x on a dark ground
    parts = ['frame_modal', 'frame_panel', 'frame_tip', 'bar_frame', 'bar_fill', 'slot_frame', 'slot_frame_active',
             'header_divider', 'torch']
    sheet = Image.new('RGBA', (3 * 700, 3 * 120), (26, 19, 15, 255))
    x = 12
    for name in parts:
        im = upscale(ui[name], 3)
        sheet.alpha_composite(im, (x, 12))
        x += im.size[0] + 16
    sheet.crop((0, 0, x + 8, 3 * 60 + 40)).save(os.path.join(REFERENCE, 'ui-parts.png'))


def main():
    if '--legacy' not in sys.argv:
        sys.exit('scripts/pixel/build.py is legacy: it overwrites hand-made art and deletes files it does not know. Read "Assets" in CLAUDE.md; pass --legacy only for a deliberate special case.')
    refs = '--refs' in sys.argv
    only = set(a for a in sys.argv[1:] if not a.startswith('--'))
    started = time.time()
    problems = item_registry.validate(SPRITES)      # src/config/itemIcons/*.json must match what is drawn
    if problems:
        sys.exit('item icon registry out of sync:\n  ' + '\n  '.join(problems))
    os.makedirs(PREVIEW, exist_ok=True)

    sprites = save_group('icons', SPRITES, only)
    ui = save_group('ui', UI, only)
    bg = save_group('bg', BG, only)
    for name, make in sprites_sheet.SHEETS.items():
        if not only or name in only:
            make().save(os.path.join(PUB, 'icons', f'{name}.png'))
    if not only or 'level_orb_shine' in only:
        sprites_props.level_orb_sheet().save(os.path.join(PUB, 'icons', 'level_orb_shine.png'))

    if small_sprites(sprites):
        contact_sheet(small_sprites(sprites), os.path.join(PREVIEW, 'sprites.png'))
    if not only or 'terrain' in only:
        terrain_build.write_all(verbose=False)
    if refs:
        reference_sheets(sprites, ui, bg)
    if not only:
        # drop stale files AFTER writing, so a running dev server never serves a half-empty folder (images would 404 until reload)
        for folder in ('icons', 'ui', 'bg'):
            for name in os.listdir(os.path.join(PUB, folder)):
                path = os.path.join(PUB, folder, name)
                if os.path.getmtime(path) < started - 1:
                    os.remove(path)
    print('built', len(sprites), 'sprites,', len(ui), 'ui parts ->', PUB)


if __name__ == '__main__':
    main()
