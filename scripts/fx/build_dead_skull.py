"""Draws the skull-and-crossbones shown in the combat window in place of a monster it has just killed (public/fx/dead.png, 48x40)."""
import os
from PIL import Image, ImageChops, ImageDraw

W, H = 48, 40
BONE, SHADE, LIGHT, DARK, EYE, GLINT = (232, 220, 192, 255), (178, 160, 124, 255), (255, 246, 224, 255), (26, 18, 16, 255), (10, 6, 5, 255), (216, 38, 28, 255)


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


bones = layer()
d = ImageDraw.Draw(bones)
for (x0, y0, x1, y1) in ((5, 8, 43, 35), (43, 8, 5, 35)):
    d.line((x0, y0, x1, y1), fill=SHADE, width=5)
    d.line((x0, y0 - 1, x1, y1 - 1), fill=BONE, width=3)
    for (cx, cy) in ((x0, y0), (x1, y1)):  # the knobbed ends
        d.ellipse((cx - 3, cy - 3, cx + 2, cy + 2), fill=BONE)
        d.ellipse((cx - 3 + (3 if cx < 24 else -3), cy - 4, cx + 2 + (3 if cx < 24 else -3), cy + 1), fill=BONE)

skull = layer()
d = ImageDraw.Draw(skull)
d.ellipse((9, 3, 38, 28), fill=SHADE)
d.ellipse((9, 3, 37, 26), fill=BONE)
d.ellipse((13, 6, 24, 13), fill=LIGHT)
d.rectangle((16, 22, 31, 31), fill=BONE)
d.rectangle((16, 29, 31, 31), fill=SHADE)
d.ellipse((14, 15, 22, 24), fill=EYE)
d.ellipse((26, 15, 34, 24), fill=EYE)
d.point((17, 19), fill=GLINT)
d.point((29, 19), fill=GLINT)
d.polygon(((24, 22), (21, 27), (27, 27)), fill=EYE)
for x in (19, 22, 25, 28):
    d.line((x, 28, x, 31), fill=DARK)
d.line((16, 28, 31, 28), fill=DARK)


def outlined(img):
    a = img.getchannel('A')
    grown = a.copy()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grown = ImageChops.lighter(grown, ImageChops.offset(a, dx, dy))
    edge = ImageChops.subtract(grown, a)
    out = Image.new('RGBA', img.size, DARK)
    out.putalpha(edge)
    out.alpha_composite(img)
    return out


sheet = layer()
sheet.alpha_composite(outlined(bones))
sheet.alpha_composite(outlined(skull))
dest = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'fx', 'dead.png')
sheet.save(dest, optimize=True)
