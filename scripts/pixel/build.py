"""Builds every pixel asset the game uses.   python scripts/pixel/build.py [name ...]

  public/pixel/icons/  sprites (resources, menu, equipment, portraits, animals, gold shine strip)
  public/pixel/ui/     frames, header chrome, HP/MP flask parts, stone XP bar, hero scene
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
import sprites_animals  # noqa: E402
import sprites_buildings  # noqa: E402
import sprites_castle  # noqa: E402
import sprites_characters  # noqa: E402
import sprites_equipment  # noqa: E402
import sprites_farm  # noqa: E402
import sprites_fortress  # noqa: E402
import sprites_gear  # noqa: E402
import sprites_map  # noqa: E402
import sprites_menu  # noqa: E402
import sprites_water  # noqa: E402
import sprites_monsters  # noqa: E402
import sprites_meadow  # noqa: E402
import sprites_props  # noqa: E402
import sprites_resources  # noqa: E402
import sprites_sheet  # noqa: E402
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
    'menu_character': sprites_props.helm, 'menu_merchant': sprites_props.pouch, 'menu_farm': sprites_props.barn,
    'level_orb': sprites_props.level_orb,
    'equip_head': sprites_equipment.head, 'equip_neck': sprites_equipment.neck,
    'equip_chest': sprites_equipment.chest, 'equip_mainHand': sprites_equipment.mainhand,
    'equip_offHand': sprites_equipment.offhand, 'equip_legs': sprites_equipment.legs,
    'equip_feet': sprites_equipment.feet, 'equip_ring': sprites_equipment.ring,
    'equip_shoulder': sprites_equipment.shoulder, 'equip_hands': sprites_equipment.hands,
    'equip_cape': sprites_equipment.cape, 'equip_charm': sprites_equipment.charm,
    **sprites_characters.SPRITES,
    **sprites_animals.SPRITES,
    **sprites_farm.SPRITES,
    **sprites_meadow.SPRITES,
    **sprites_map.SPRITES,
    **sprites_castle.SPRITES,
    **sprites_fortress.SPRITES,
    **sprites_buildings.SPRITES,
    **sprites_menu.SPRITES,
    **sprites_water.SPRITES,
    **sprites_monsters.SPRITES,
    **sprites_gear.SPRITES,
}

UI = {
    'frame_modal': ui_art.frame_modal, 'frame_panel': ui_art.frame_panel, 'frame_tip': ui_art.frame_tip,
    'slot_frame': lambda: ui_art.slot_frame(False), 'slot_frame_active': lambda: ui_art.slot_frame(True),
    'slot_frame_s': lambda: ui_art.slot_frame(False, 40), 'slot_frame_s_active': lambda: ui_art.slot_frame(True, 40),
    'header_edge': ui_art.header_edge, 'header_divider': ui_art.header_divider,
    'header_xp_frame': ui_art.header_xp_frame, 'header_xp_fill': ui_art.header_xp_fill,
    'bar_frame': ui_art.bar_frame, 'bar_fill': ui_art.bar_fill,
    'hero_scene': ui_art.hero_scene, 'torch': ui_art.torch_sheet,
    'range_corner': ui_art.range_corner, 'range_tint': ui_art.range_tint, 'spark_sheet': ui_art.spark_sheet,
    'banner_left': ui_art.banner_left, 'banner_mid': ui_art.banner_mid, 'banner_right': ui_art.banner_right,
    'flask_glass': ui_art.flask_glass, 'flask_mask': ui_art.flask_mask, 'flask_bubbles': ui_art.flask_bubbles,
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
    """Contact sheets show icon-sized art only (not the big farm pen layers or the 40px bust crops)."""
    return {n: im for n, im in sprites.items() if im.size[0] <= 80 and not n.startswith(('bust_', 'meadow_', 'bonus_'))}


def hero_hud_composite(sprites, ui):
    """Static mock of the Character HUD (alcove, hero, flasks, stone XP bar, gem) at 2x, for the style guide."""
    S = 2
    scene = upscale(ui['hero_scene'], S)
    img = scene.copy()
    img.alpha_composite(upscale(sprites['hero_warrior'], S), ((img.size[0] - 112) // 2, img.size[1] - 40 - 160))
    glass, mask = ui['flask_glass'], ui['flask_mask']
    for side, (top, bottom) in (('left', ((255, 154, 154), (138, 16, 40))), ('right', ((154, 208, 255), (28, 46, 144)))):
        liquid = Image.new('RGBA', glass.size, (0, 0, 0, 0))
        top_y = 11
        for y in range(top_y, glass.size[1] - 4):
            t = (y - top_y) / (glass.size[1] - 4 - top_y)
            col = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
            for x in range(glass.size[0]):
                if mask.getpixel((x, y))[3]:
                    liquid.putpixel((x, y), col)
        flask = Image.new('RGBA', glass.size, (0, 0, 0, 0))
        flask.alpha_composite(liquid)
        flask.alpha_composite(glass)
        x0 = 6 if side == 'left' else img.size[0] - 6 - 80
        img.alpha_composite(upscale(flask, S), (x0, img.size[1] - 22 - 112))
    # stone bar with a 48% emerald fill
    frame, fill = ui['bar_frame'], ui['bar_fill']
    w = (img.size[0] - 28) // S
    bar = Image.new('RGBA', (w, 14), (0, 0, 0, 0))
    for x in range(w):
        sx = x if x < 4 else (16 - (w - x) if x >= w - 4 else 4 + ((x - 4) % 8))
        for y in range(14):
            bar.putpixel((x, y), frame.getpixel((sx, y)))
    inner = Image.new('RGBA', (w - 8, 6), (10, 7, 6, 255))
    for x in range(int((w - 8) * 0.48)):
        for y in range(6):
            inner.putpixel((x, y), fill.getpixel((x % 8, y)))
    bar.alpha_composite(inner, (4, 4))
    img.alpha_composite(upscale(bar, S), (14, img.size[1] - 10 - 28))
    gem = upscale(sprites['level_orb'], S)
    img.alpha_composite(gem, (0, img.size[1] - 48 + 2))
    return img


def reference_sheets(sprites, ui, bg):
    os.makedirs(REFERENCE, exist_ok=True)
    for stale in ('biome-blend.png', 'map-tiles.png'):
        if os.path.exists(os.path.join(REFERENCE, stale)):
            os.remove(os.path.join(REFERENCE, stale))
    contact_sheet(small_sprites(sprites), os.path.join(REFERENCE, 'icons.png'), k=4, cols=6)
    # the 16 town buildings (48x60, no ground) on meadow green; the foundation pads are shown in map-terrain.png
    contact_sheet({n: im for n, im in sprites.items() if n.startswith('building_')}, os.path.join(REFERENCE, 'town.png'), k=3, cols=4, bg=(88, 140, 60, 255))
    hero_hud_composite(sprites, ui).save(os.path.join(REFERENCE, 'hero-hud.png'))
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
    # castle levels 1-6 side by side (top-down, 48px each) at 2x
    lv = [sprites[f'castle_{i}'] for i in range(1, 7)]
    sheet = Image.new('RGBA', (sum(im.size[0] * 2 + 16 for im in lv) + 16, 48 * 2 + 32), (60, 36, 100, 255))
    x = 16
    for im in lv:
        sheet.alpha_composite(upscale(im, 2), (x, 16))
        x += im.size[0] * 2 + 16
    sheet.save(os.path.join(REFERENCE, 'castle-levels.png'))
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
    refs = '--refs' in sys.argv
    only = set(a for a in sys.argv[1:] if not a.startswith('--'))
    started = time.time()
    os.makedirs(PREVIEW, exist_ok=True)

    sprites = save_group('icons', SPRITES, only)
    ui = save_group('ui', UI, only)
    bg = save_group('bg', BG, only)
    for name, make in sprites_sheet.SHEETS.items():
        if not only or name in only:
            make().save(os.path.join(PUB, 'icons', f'{name}.png'))
    if not only or 'castle_6_anim' in only:
        sprites_castle.sheet_max().save(os.path.join(PUB, 'icons', 'castle_6_anim.png'))
    if not only or 'castle_keep_anim' in only:
        sprites_fortress.keep_sheet().save(os.path.join(PUB, 'icons', 'castle_keep_anim.png'))
    if not only or 'castle_loading' in only:
        # loading screen: the castle growing through its six levels (48px cells)
        cells = Image.new('RGBA', (48 * 6, 48), (0, 0, 0, 0))
        for i in range(6):
            cells.alpha_composite(sprites_castle.build(i + 1, 0), (i * 48, 0))
        cells.save(os.path.join(PUB, 'icons', 'castle_loading.png'))
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
