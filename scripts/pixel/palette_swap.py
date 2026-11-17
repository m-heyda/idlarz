"""Palette swap for special-set pieces (IDL-200): remap a 64x64 reuse PNG to the approved S1-S3 ramps by luminance rank.

  python scripts/pixel/palette_swap.py SRC.png S1 OUT.png [--ramp 1]      one file
  python scripts/pixel/palette_swap.py --batch [OUTDIR]                   the first batch + a contact sheet (64/40/20 px on map green)

Ramps: (S1 Sunhoney, S2 Ashen Warlord, S3 Blightbound), five tones light to dark;
the last tone is the 1 px outline, the first four shade the body. --ramp picks the ramp of the set (0 = main, 1 = second, 2 = third).
Rules: no dither, hard alpha, the outline is kept as an outline (opaque pixels that touch transparency), body colours are ranked by
luminance (pixel-weighted) and spread over the four body tones. Nothing is registered here: copy the result to public/pixel/items/<slot>/
under a new snake_case id and add its line to src/config/itemIcons/<slot>.json (provenance: "palette swap of <source>, S<n>")."""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import hexc  # noqa: E402
import item_registry  # noqa: E402

SETS = {
    'S1': [['#FFF7E0', '#F4E3B8', '#E3CF95', '#BFA56A', '#7A6238'],
           ['#FFE68A', '#E8C468', '#C98F2E', '#8F5E1C', '#5A3A12'],
           ['#FFB347', '#E8862A', '#B3571A', '#7A3510', '#4A2008']],
    'S2': [['#7A7A82', '#5A5A62', '#3F3F46', '#2B2B31', '#121216'],
           ['#F06A58', '#D03C34', '#A02424', '#701620', '#3E0C14'],
           ['#D8BC6A', '#B89A4A', '#8A7030', '#5E4A20', '#34280E']],
    'S3': [['#7A58A0', '#583A80', '#3A2358', '#22123A', '#0E0716'],
           ['#D8FF7A', '#9AE03C', '#5CB42A', '#2E7A22', '#143E12'],
           ['#8C80A4', '#645878', '#40344E', '#221A2C', '#0A0710']],
}
MAP_GREEN = (110, 150, 80, 255)

# first batch of IDL-200: (source under public/pixel/items, set, ramp)
BATCH = [
    ('feet/sunsilk_boots', 'S1', 0), ('legs/royal_silk_trousers', 'S1', 0), ('offHand/royal_lion_crest', 'S1', 0),
    ('feet/mossweave_boots', 'S3', 0), ('legs/verdant_greaves', 'S3', 0), ('neck/leaf_amulet', 'S3', 0),
    ('ring/thornvine_ring', 'S3', 0), ('offHand/verdant_kite_shield', 'S3', 0), ('belt/hunter_trophy_belt', 'S3', 0),
]


def ramp_of(set_name, index=0):
    return [hexc(h) for h in SETS[set_name][index]]


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def swap(img, set_name, index=0):
    """img: RGBA; returns the remapped copy"""
    ramp = ramp_of(set_name, index)
    img = img.convert('RGBA')
    w, h = img.size
    src = img.load()
    solid = {(x, y) for y in range(h) for x in range(w) if src[x, y][3] >= 128}
    outline = {(x, y) for (x, y) in solid
               if any((x + dx, y + dy) not in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    body = sorted(solid - outline, key=lambda p: -lum(src[p]))      # light to dark
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dst = out.load()
    for (x, y) in outline:
        dst[x, y] = ramp[4]
    n = len(body)
    for i, (x, y) in enumerate(body):                                # equal-population rank buckets over the 4 body tones
        dst[x, y] = ramp[min(3, i * 4 // max(n, 1))]
    return out


def contact_sheet(rows, path):
    """rows: [(label, image)] -> each shown at 64, 40 and 20 px on map green"""
    sizes = (64, 40, 20)
    pad = 6
    cell_w = sum(sizes) + pad * (len(sizes) + 1)
    sheet = Image.new('RGBA', (cell_w * 2, (64 + pad) * ((len(rows) + 1) // 2) + pad), MAP_GREEN)
    for i, (_, im) in enumerate(rows):
        ox, oy = (i % 2) * cell_w + pad, (i // 2) * (64 + pad) + pad
        for s in sizes:
            shown = im if s == im.size[0] else im.resize((s, s), Image.NEAREST)
            sheet.alpha_composite(shown, (ox, oy + 64 - s))
            ox += s + pad
    sheet.save(path)


def main(argv):
    if argv and argv[0] == '--batch':
        out_dir = argv[1] if len(argv) > 1 else os.path.join(item_registry.ROOT, 'scratch-palette-swap')
        os.makedirs(out_dir, exist_ok=True)
        rows = []
        for rel, set_name, idx in BATCH:
            path = os.path.join(item_registry.ART_DIR, *rel.split('/')) + '.png'
            if not os.path.exists(path):
                print(f'skip {rel}: not found')
                continue
            res = swap(Image.open(path), set_name, idx)
            res.save(os.path.join(out_dir, f"{set_name.lower()}_{rel.split('/')[-1]}.png"))
            rows.append((rel, res))
        contact_sheet(rows, os.path.join(out_dir, 'contact_sheet.png'))
        print(f'{len(rows)} swapped -> {out_dir}')
        return 0
    if len(argv) < 3:
        print(__doc__)
        return 1
    idx = int(argv[argv.index('--ramp') + 1]) if '--ramp' in argv else 0
    swap(Image.open(argv[0]), argv[1].upper(), idx).save(argv[2])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
