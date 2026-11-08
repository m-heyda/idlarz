"""Packs the CraftPix free magic slash effect frames (800x600 PNGs) into one-row sprite sheets for the combat window.

Usage: python -I scripts/fx/build_slash_sheets.py <folder holding the six effect folders>
Writes public/fx/slash/<name>.png; every frame is scaled to FRAME_W x FRAME_H (the sheet is frames x that wide).
"""
import glob
import os
import sys
from PIL import Image

FRAME_W, FRAME_H = 240, 180
EFFECTS = {
    'ultimate': 'Ultimate Slash',
    'water': 'Water Slash',
    'wind': 'Double Wind Slashes',
    'fire': 'Fire Slash',
    'lightning': 'Lightning Slash',
    'poison': 'Poisonous Slashes',
}

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'fx', 'slash')
os.makedirs(out, exist_ok=True)
for name, folder in EFFECTS.items():
    files = sorted(glob.glob(os.path.join(src, folder, 'PNG', '*.png')))
    sheet = Image.new('RGBA', (FRAME_W * len(files), FRAME_H))
    for i, f in enumerate(files):
        sheet.paste(Image.open(f).convert('RGBA').resize((FRAME_W, FRAME_H), Image.LANCZOS), (i * FRAME_W, 0))
    sheet.save(os.path.join(out, f'{name}.png'), optimize=True)
    print(name, len(files), os.path.getsize(os.path.join(out, f'{name}.png')) // 1024, 'KB')
