"""The stand-in monster picture (`public/pixel/enemies/placeholder/silhouette.png`) shown until a monster's real sprite is made.

  python scripts/pixel/placeholder_monster.py

A small teal slime with a cel-shaded body, a 1 px dark outline, a highlight and two sleepy eyes. Drawn on a 32 px grid and doubled to 64 px
(chunky pixels, hard alpha, no dither). It carries its own colours: the game draws it as it is (no grey filter), and it has no "?" so it
never reads as an undiscovered monster."""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'pixel', 'enemies', 'placeholder', 'silhouette.png')

OUTLINE = (18, 50, 58, 255)
TONES = [(150, 240, 214, 255), (84, 205, 188, 255), (46, 160, 160, 255), (30, 112, 128, 255)]  # light to dark
EYE = (14, 30, 36, 255)
SHINE = (236, 255, 246, 255)

# half-width of the body per row, top to bottom (a dome that widens, then a flat base)
HALF = [3, 5, 7, 8, 9, 10, 10, 11, 11, 11, 11, 11, 11, 11, 10, 10]
TOP = 10
CX = 16


def build():
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    px = img.load()
    body = {}
    for i, half in enumerate(HALF):
        for x in range(CX - half, CX + half):
            body[(x, TOP + i)] = True
    # outline = every empty pixel touching the body
    for (x, y) in list(body):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in body:
                px[x + dx, y + dy] = OUTLINE
    rows = len(HALF)
    for (x, y) in body:
        t = (y - TOP) / rows
        tone = 0 if t < 0.2 else 1 if t < 0.55 else 2 if t < 0.85 else 3
        # the right side sits one tone darker (light from the upper left)
        if x >= CX + 3 and tone < 3:
            tone += 1
        px[x, y] = TONES[tone]
    # highlight and eyes
    for x, y in ((9, 14), (10, 13), (11, 13), (9, 15)):
        px[x, y] = SHINE
    for ex in (11, 18):
        for dx in range(3):
            px[ex + dx, 19] = EYE
            px[ex + dx, 20] = EYE
        px[ex, 18] = EYE
    px[15, 23] = EYE
    px[16, 23] = EYE
    # a drop of goo on the base
    for x in (6, 7):
        px[x, TOP + rows] = TONES[2]
    return img.resize((64, 64), Image.NEAREST)


if __name__ == '__main__':
    build().save(OUT)
    print('wrote', os.path.normpath(OUT))
