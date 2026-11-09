"""Pass 2 placeholder item icons (IDL-217): simple silhouettes for every slot / weapon type / grade the registry cannot fill yet.

  python scripts/pixel/placeholders.py            draw the files + write src/config/itemIcons/placeholders.json
  python scripts/pixel/placeholders.py --gaps     only print the gap list

64 px (the supplied-art size, so the registry treats them as `art_ph_*`), hard alpha, no dither, 1 px coloured outline, no glow.
Palettes: grade look cues of art_style_reference/equip/README.md section 3, S1-S3 ramps of section 5.1.
A placeholder is replaced later by changing ONE line: register the real icon with that grade and delete the placeholder line + file."""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import hexc  # noqa: E402
import item_registry  # noqa: E402

OUT_JSON = os.path.join(item_registry.REGISTRY_DIR, 'placeholders.json')
SIZE = 64
LADDER = 12


def _r(*h):
    return [hexc(x) for x in h]


# grade -> (5 tones light to dark, the last is the outline; an accent colour)
RAMPS = {
    'G1': (_r('#C9A877', '#A88454', '#7E5F38', '#5A4228', '#2E2014'), hexc('#8A6A3A')),
    'G2': (_r('#E3C08A', '#C99A5C', '#A8763C', '#7C5428', '#3C2410'), hexc('#B87333')),
    'G3': (_r('#C4C6CA', '#9EA1A8', '#777A82', '#53565E', '#24262C'), hexc('#8C8F96')),
    'G4': (_r('#EEF3F8', '#C4D2E0', '#97ABC0', '#6A7F96', '#2A3646'), hexc('#4FA3D9')),
    'G5': (_r('#B8CCEE', '#7F9FD4', '#5679B4', '#3A5690', '#16264A'), hexc('#F2C84B')),
    'G6': (_r('#5A5666', '#3E3A4A', '#2A2634', '#1A1722', '#0A080E'), hexc('#F08A2A')),
    'G7': (_r('#C7B6F2', '#9C86DA', '#7660B8', '#523E92', '#241A4A'), hexc('#5FE3E6')),
    'G8': (_r('#F6E7B4', '#E0C878', '#BFA050', '#8E7434', '#463816'), hexc('#E8E2D0')),
    'G9': (_r('#FFE6A0', '#F2B63C', '#D9822A', '#A04A18', '#4A1A08'), hexc('#E03A30')),
    'S1': (_r('#FFE68A', '#E8C468', '#C98F2E', '#8F5E1C', '#5A3A12'), hexc('#FFF7E0')),
    'S2': (_r('#7A7A82', '#5A5A62', '#3F3F46', '#2B2B31', '#121216'), hexc('#D03C34')),
    'S3': (_r('#7A58A0', '#583A80', '#3A2358', '#22123A', '#0E0716'), hexc('#9AE03C')),
}
GRADES = list(RAMPS)

# family (= registry file name) -> (slot, weapon)
FAMILIES = {
    'head': ('head', None), 'shoulder': ('shoulder', None), 'chest': ('chest', None), 'hands': ('hands', None),
    'cape': ('cape', None), 'charm': ('charm', None), 'legs': ('legs', None), 'feet': ('feet', None),
    'neck': ('neck', None), 'ring': ('ring', None), 'belt': ('belt', None),
    'offHand-shield': ('offHand', 'shield'), 'offHand-tome': ('offHand', 'tome'),
}
WEAPONS = ('sword', 'dagger', 'mace', 'maul', 'axe', 'spear', 'bow', 'crossbow', 'staff', 'wand')
for _w in WEAPONS:
    FAMILIES[f'mainHand-{_w}'] = ('mainHand', _w)


def gaps():
    """family -> registered icon count, for every family with fewer icons than the 12-grade ladder.
    Registry grades are still null (pass 1 sets them), so such a family gets the whole ladder as placeholders."""
    counts = {}
    for name in sorted(os.listdir(item_registry.REGISTRY_DIR)):
        if name.endswith('.json') and name != 'placeholders.json':
            with open(os.path.join(item_registry.REGISTRY_DIR, name), encoding='utf8') as fh:
                counts[name[:-5]] = len(json.load(fh))
    return {fam: counts.get(fam, 0) for fam in FAMILIES if counts.get(fam, 0) < LADDER}


# Families with a full set of registered icons still lack art for the early grades the catalog now enables (IDL-220): the real
# G1-G3 icons there belong to the reuse items, so the ladder cells of these grades get placeholders too.
# EXTRA stays until real ladder art exists for every cell (IDL-239, 2026-11-09): the supplied packs under
# public/pixel/assets_to_assess_and_use hold no equipment art (map props, buildings, potions only), and the procedural
# sprites_gear.py icons already belong to the starter items. Drop a family from EXTRA (and its placeholder lines) only
# in the PR that registers its real G1-G3 icons.
EXTRA = {fam: ('G1', 'G2', 'G3') for fam in ('feet', 'legs', 'neck', 'ring', 'mainHand-sword', 'offHand-shield')}


class Pen:
    def __init__(self, ramp, accent, grade):
        self.img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.r, self.acc = ramp, accent
        self.rank = GRADES.index(grade)

    def poly(self, pts, tone=2, hi=True):
        pts = [(round(x), round(y)) for x, y in pts]
        self.d.polygon([(x + 1, y + 1) for x, y in pts], fill=self.r[3])
        self.d.polygon(pts, fill=self.r[tone])
        if hi:
            self.d.line([pts[0], pts[1]], fill=self.r[max(tone - 2, 0)], width=1)

    def rect(self, x0, y0, x1, y1, tone=2):
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], tone)

    def ell(self, box, tone=2):
        x0, y0, x1, y1 = [round(v) for v in box]
        self.d.ellipse((x0 + 1, y0 + 1, x1 + 1, y1 + 1), fill=self.r[3])
        self.d.ellipse((x0, y0, x1, y1), fill=self.r[tone])
        self.d.arc((x0, y0, x1, y1), 200, 290, fill=self.r[0])

    def dot(self, x, y, s=3):
        x, y = round(x), round(y)
        self.d.rectangle((x - s // 2, y - s // 2, x + s // 2, y + s // 2), fill=self.acc)


def tilt(pts):
    """a vertical item drawn pointing up at x=32, turned 45 degrees to the upper right about the centre"""
    return [(32 + (x - 32) * 0.7 + (y - 32) * 0.7, 32 - (x - 32) * 0.7 + (y - 32) * 0.7) for x, y in pts]


def draw_head(p):
    p.poly([(14, 40), (14, 26), (22, 14), (42, 14), (50, 26), (50, 40), (42, 40), (42, 34), (22, 34), (22, 40)], 2)
    p.rect(22, 28, 42, 33, 4)
    if p.rank >= 4: p.rect(30, 8, 34, 16, 1)
    if p.rank >= 6: p.dot(32, 20, 4)
    if p.rank >= 8:
        p.poly([(14, 26), (8, 16), (18, 22)], 1)
        p.poly([(50, 26), (56, 16), (46, 22)], 1)


def draw_shoulder(p):
    p.poly([(10, 44), (12, 28), (22, 18), (42, 18), (52, 28), (54, 44), (44, 40), (20, 40)], 2)
    p.rect(14, 36, 50, 42, 1)
    if p.rank >= 3: p.rect(18, 24, 46, 27, 1)
    if p.rank >= 6: p.dot(32, 31, 4)
    if p.rank >= 8:
        p.poly([(10, 30), (4, 20), (16, 24)], 1)
        p.poly([(54, 30), (60, 20), (48, 24)], 1)


def draw_chest(p):
    p.poly([(8, 20), (22, 12), (28, 18), (36, 18), (42, 12), (56, 20), (50, 30), (48, 52), (16, 52), (14, 30)], 2)
    p.rect(14, 40, 50, 44, 1)
    if p.rank >= 2: p.rect(30, 18, 34, 40, 1)
    if p.rank >= 6: p.dot(32, 30, 4)
    if p.rank >= 8:
        p.poly([(8, 20), (2, 28), (14, 30)], 1)
        p.poly([(56, 20), (62, 28), (50, 30)], 1)


def draw_hands(p):
    p.rect(20, 10, 44, 24, 1)
    p.poly([(18, 24), (46, 24), (50, 44), (42, 56), (22, 56), (14, 44)], 2)
    if p.rank >= 3:
        for x in (22, 30, 38): p.rect(x, 28, x + 5, 34, 3)
    p.rect(16, 40, 48, 43, 4)
    if p.rank >= 6: p.dot(32, 50, 4)


def draw_cape(p):
    p.poly([(14, 10), (50, 10), (58, 54), (44, 48), (32, 56), (20, 48), (6, 54)], 2)
    p.rect(14, 10, 50, 15, 1)
    p.d.line([(32, 16), (32, 50)], fill=p.r[3])
    if p.rank >= 4: p.dot(32, 12, 4)
    if p.rank >= 8: p.d.line([(8, 52), (56, 52)], fill=p.acc)


def draw_charm(p):
    p.d.line([(32, 4), (20, 22)], fill=p.r[4])
    p.d.line([(32, 4), (44, 22)], fill=p.r[4])
    p.ell((16, 22, 48, 54), 2)
    p.ell((24, 30, 40, 46), 1)
    if p.rank >= 6: p.dot(32, 38, 6)
    if p.rank >= 8: p.dot(32, 20, 4)


def draw_legs(p):
    p.rect(14, 8, 50, 18, 1)
    p.poly([(14, 18), (32, 18), (30, 56), (14, 56)], 2)
    p.poly([(32, 18), (50, 18), (50, 56), (34, 56)], 2)
    if p.rank >= 3:
        p.rect(14, 34, 30, 38, 1)
        p.rect(34, 34, 50, 38, 1)
    if p.rank >= 6: p.dot(32, 13, 4)


def draw_feet(p):
    p.poly([(14, 8), (34, 8), (34, 38), (56, 44), (56, 54), (14, 54)], 2)
    p.rect(14, 8, 34, 14, 1)
    p.rect(14, 50, 56, 54, 4)
    if p.rank >= 6: p.dot(24, 26, 4)


def draw_neck(p):
    p.d.arc((8, 4, 56, 52), 20, 160, fill=p.r[4])
    p.d.arc((9, 5, 55, 51), 20, 160, fill=p.r[3])
    p.poly([(32, 40), (40, 50), (32, 60), (24, 50)], 2)
    p.dot(32, 50, 4 if p.rank >= 4 else 2)


def draw_ring(p):
    p.ell((14, 14, 50, 50), 2)
    p.d.ellipse((24, 24, 40, 40), fill=(0, 0, 0, 0))
    p.poly([(26, 6), (38, 6), (42, 16), (22, 16)], 1)
    p.dot(32, 11, 4 if p.rank >= 3 else 2)


def draw_belt(p):
    p.rect(2, 26, 62, 38, 2)
    p.rect(24, 22, 40, 42, 1)
    p.d.rectangle((29, 28, 35, 36), fill=p.acc)


def draw_shield(p):
    p.poly([(10, 10), (54, 10), (54, 34), (32, 58), (10, 34)], 2)
    p.rect(30, 12, 34, 52, 1)
    p.rect(12, 26, 52, 30, 1)
    if p.rank >= 6: p.dot(32, 28, 6)
    if p.rank >= 8:
        p.dot(13, 13, 3)
        p.dot(51, 13, 3)


def draw_tome(p):
    p.rect(14, 8, 52, 56, 2)
    p.rect(14, 8, 20, 56, 3)
    p.rect(24, 14, 48, 50, 1)
    p.rect(28, 22, 44, 26, 3)
    p.rect(28, 32, 44, 36, 3)
    p.dot(36, 44, 4 if p.rank >= 3 else 2)


def draw_sword(p):
    p.poly(tilt([(29, 6), (35, 6), (35, 40), (32, 44), (29, 40)]), 1)
    p.poly(tilt([(20, 40), (44, 40), (44, 45), (20, 45)]), 3)
    p.poly(tilt([(30, 45), (34, 45), (34, 56), (30, 56)]), 4)
    p.dot(*tilt([(32, 58)])[0], 4)


def draw_dagger(p):
    p.poly(tilt([(30, 18), (34, 18), (34, 42), (32, 46), (30, 42)]), 1)
    p.poly(tilt([(25, 42), (39, 42), (39, 46), (25, 46)]), 3)
    p.poly(tilt([(30, 46), (34, 46), (34, 56), (30, 56)]), 4)


def draw_mace(p):
    p.poly(tilt([(30, 24), (34, 24), (34, 58), (30, 58)]), 4)
    p.ell((tilt([(32, 14)])[0][0] - 11, tilt([(32, 14)])[0][1] - 11, tilt([(32, 14)])[0][0] + 11, tilt([(32, 14)])[0][1] + 11), 1)


def draw_maul(p):
    p.poly(tilt([(30, 18), (34, 18), (34, 60), (30, 60)]), 4)
    p.poly(tilt([(16, 4), (48, 4), (48, 22), (16, 22)]), 2)
    p.poly(tilt([(16, 4), (22, 4), (22, 22), (16, 22)]), 1)


def draw_axe(p):
    p.poly(tilt([(30, 10), (34, 10), (34, 60), (30, 60)]), 4)
    p.poly(tilt([(34, 8), (52, 6), (56, 20), (52, 34), (34, 30)]), 1)
    if p.rank >= 6: p.poly(tilt([(30, 8), (14, 12), (12, 22), (30, 26)]), 1)


def draw_spear(p):
    p.poly(tilt([(31, 14), (33, 14), (33, 62), (31, 62)]), 4)
    p.poly(tilt([(32, 0), (38, 14), (32, 20), (26, 14)]), 1)


def draw_bow(p):
    p.d.arc((-14, 4, 36, 60), 290, 70, fill=p.r[3], width=3)
    p.d.arc((-14, 4, 36, 60), 292, 68, fill=p.r[1], width=1)
    p.d.line([(25, 8), (25, 56)], fill=p.r[0])
    if p.rank >= 6: p.dot(34, 32, 4)


def draw_crossbow(p):
    p.rect(30, 8, 34, 56, 4)
    p.poly([(8, 16), (32, 24), (56, 16), (56, 22), (32, 30), (8, 22)], 2)
    p.d.line([(8, 19), (32, 52), (56, 19)], fill=p.r[0])
    if p.rank >= 6: p.dot(32, 20, 4)


def draw_staff(p):
    p.poly(tilt([(30, 16), (34, 16), (34, 62), (30, 62)]), 4)
    top = tilt([(32, 8)])[0]
    p.ell((top[0] - 10, top[1] - 10, top[0] + 10, top[1] + 10), 1)
    p.dot(*top, 6 if p.rank >= 5 else 4)


def draw_wand(p):
    p.poly(tilt([(31, 14), (33, 14), (33, 58), (31, 58)]), 4)
    p.poly(tilt([(32, 4), (36, 12), (32, 16), (28, 12)]), 1)
    p.dot(*tilt([(32, 10)])[0], 3)


DRAW = {
    'head': draw_head, 'shoulder': draw_shoulder, 'chest': draw_chest, 'hands': draw_hands, 'cape': draw_cape,
    'charm': draw_charm, 'legs': draw_legs, 'feet': draw_feet, 'neck': draw_neck, 'ring': draw_ring, 'belt': draw_belt,
    'offHand-shield': draw_shield, 'offHand-tome': draw_tome,
}
for _w in WEAPONS:
    DRAW[f'mainHand-{_w}'] = globals()[f'draw_{_w}']


def finish(img, outline):
    """Hard alpha, then a 1 px outline in the ramp's darkest tone (coloured, not black)."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            px[x, y] = px[x, y][:3] + (255,) if px[x, y][3] >= 128 else (0, 0, 0, 0)
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3]:
                    dst[x, y] = outline
                    break
    return out


def render(family, grade):
    ramp, accent = RAMPS[grade]
    pen = Pen(ramp, accent, grade)
    DRAW[family](pen)
    return finish(pen.img, ramp[4])


def rel_file(family, grade):
    slot, weapon = FAMILIES[family]
    return '/'.join(p for p in (slot, weapon, f'ph_{grade.lower()}') if p)


def main():
    todo = gaps()
    if '--gaps' in sys.argv:
        for fam, n in todo.items():
            print(f'{fam}: {n} registered icons of {LADDER} -> placeholders G1-G9, S1-S3')
        return
    lines = []
    # `item` is set by hand in the line once a catalog item uses the placeholder; regenerating keeps it
    kept = {}
    if os.path.exists(OUT_JSON):
        with open(OUT_JSON, encoding='utf8') as fh:
            kept = {e['icon']: e['item'] for e in json.load(fh)}
    plan = [(fam, GRADES) for fam in todo] + [(fam, gs) for fam, gs in EXTRA.items() if fam not in todo]
    for fam, grades in plan:
        slot, weapon = FAMILIES[fam]
        for g in grades:
            f = rel_file(fam, g)
            path = os.path.join(item_registry.ART_DIR, *f.split('/')) + '.png'
            os.makedirs(os.path.dirname(path), exist_ok=True)
            render(fam, g).save(path)
            icon = 'art_ph_' + slot + ('_' + weapon if weapon else '') + '_' + g.lower()
            lines.append(dict(icon=icon, item=kept.get(icon), file=f, slot=slot, weapon=weapon, grade=g,
                              provenance='placeholder, scripts/pixel/placeholders.py'))
    with open(OUT_JSON, 'w', encoding='utf8', newline='\n') as fh:
        fh.write('[\n' + ',\n'.join('\t' + json.dumps(line, ensure_ascii=False) for line in lines) + '\n]\n')
    print(f'{len(lines)} placeholders in {len(plan)} families')


if __name__ == '__main__':
    main()
