"""Quick look at sprites without touching public/: renders the named SPRITES entries at Nx on a dark ground.

    python art_preview.py gold stone coal --k 6 --out previews/look.png
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render3d  # noqa: E402

render3d.DEFAULTS.update(rim=True, dither=0.2)

from PIL import Image  # noqa: E402
from common import upscale  # noqa: E402


def sheet(images, k=6, bg=(26, 22, 30, 255), pad=16, cols=8):
    cw = max(im.size[0] for im in images.values()) * k + pad
    ch = max(im.size[1] for im in images.values()) * k + pad
    rows = -(-len(images) // cols)
    out = Image.new('RGBA', (cw * min(cols, len(images)), ch * rows), bg)
    for i, im in enumerate(images.values()):
        big = upscale(im, k)
        out.alpha_composite(big, ((i % cols) * cw + pad // 2, (i // cols) * ch + pad // 2))
    return out


def main():
    args = sys.argv[1:]
    k = int(args[args.index('--k') + 1]) if '--k' in args else 6
    out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, 'previews', 'look.png')
    names = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] not in ('--k', '--out'))]
    import build  # noqa: E402 (heavy: registers every sprite)
    images = {n: build.SPRITES[n]() for n in names}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet(images, k).save(out)
    print('wrote', out, {n: im.size for n, im in images.items()})


if __name__ == '__main__':
    main()
