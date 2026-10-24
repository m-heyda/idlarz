"""Foundation pads: the little worked-ground patch under a building (48x48, drawn on the terrain layer under the sprite).
A building tile takes the ground of the biome around it (see terrain logic); the pad is what makes it a building plot, in
that biome's style: packed earth and cobbles on plains, trampled snow on tundra, plank walkways over mud in swamp, ..."""
import math
from PIL import Image
from render3d import vnoise, hexc
from common import add_outline
from materials import MATS

SIZE = 48
PAD_BIOMES = ('plains', 'forest', 'hills', 'swamp', 'tundra', 'coast')
CX, CY, RX, RY = 24, 29, 23.0, 18.0


def _mask(seed):
    """Organic pad outline: an ellipse with a noisy radius."""
    m = {}
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = (x + 0.5 - CX) / RX, (y + 0.5 - CY) / RY
            ang = math.atan2(dy, dx)
            r = math.hypot(dx, dy)
            wob = 1.0 + (vnoise(math.cos(ang) * 2.2 + 5, math.sin(ang) * 2.2 + 5, seed, seed) - 0.5) * 0.34
            m[(x, y)] = r / wob
    return m


def _paint(kind, seed):
    m = _mask(seed)
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    if kind == 'plains':
        base, alt, dark, edge = MATS['soil'].ramp[3], MATS['cobble'].ramp[3], MATS['soil'].ramp[1], MATS['soil'].ramp[0]
    elif kind == 'tundra':
        base, alt, dark, edge = hexc('#d6e3f2'), hexc('#b4c8e2'), hexc("#8ea6cc"), hexc("#5f79a8")
    elif kind == 'swamp':
        base, alt, dark, edge = hexc('#6e5a30'), hexc('#8c6e3c'), hexc('#4a3a1e'), hexc('#2e2410')
    elif kind == 'forest':
        base, alt, dark, edge = hexc('#6b4a2a'), hexc('#8a6238'), hexc('#3e2a18'), hexc('#241810')
    elif kind == 'hills':
        base, alt, dark, edge = hexc('#a09484'), hexc('#c4b8a4'), hexc('#6e6458'), hexc('#3c342c')
    else:                                                    # coast: sand with a plank landing
        base, alt, dark, edge = MATS['sand'].ramp[3], MATS['sand'].ramp[4], MATS['sand'].ramp[1], MATS['sand'].ramp[0]
    for (x, y), r in m.items():
        if r > 1.0:
            continue
        n = vnoise(x * 0.42, y * 0.42, 3, seed)
        c = base
        if kind == 'plains':
            if vnoise(x * 0.9, y * 0.9, 9, seed) > 0.72:
                c = alt                                    # cobbles set in the earth
            elif n < 0.28:
                c = dark
        elif kind == 'tundra':
            if n < 0.3:
                c = alt
            if vnoise(x * 0.8, y * 0.8, 4, seed) > 0.8:
                c = dark                                   # boot prints
        elif kind == 'forest':
            if vnoise(x * 0.8, y * 0.8, 12, seed) > 0.7:
                c = alt                                    # leaf litter
            elif n < 0.26:
                c = dark
        elif kind == 'hills':
            if vnoise(x * 0.9, y * 0.9, 13, seed) > 0.68:
                c = alt                                    # gravel
            elif n < 0.3:
                c = dark
        elif kind == 'coast':
            if (int(y // 4) % 2 == 0) and 12 < x < 36:
                c = MATS['plank'].ramp[3]                  # a short plank landing
            elif n < 0.28:
                c = dark
        elif kind == 'swamp':
            c = alt if (int((x + y * 0.5) // 3) % 2 == 0) else base          # plank courses
            if (x + int(y * 0.5)) % 3 == 0:
                c = dark
        if r > 0.86:
            c = edge if r > 0.94 else dark                 # rim: darker band then outline
        px[x, y] = c
    return img


def pad(biome, variant=0):
    """48x48 pad for a foundation biome; `variant` (0-1) shifts the outline so neighbouring plots differ."""
    kind = biome if biome in PAD_BIOMES else 'plains'
    return _paint(kind, 11 + variant * 7)


PADS = {f'pad_{b}_{v}': (lambda b=b, v=v: pad(b, v)) for b in PAD_BIOMES for v in (0, 1)}
