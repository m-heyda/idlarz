"""The item icon registry, read from src/config/itemIcons/*.json (one JSON file per slot / weapon type, one line per icon).

The same files are read by src/config/pixelIcons.ts, so an icon is wired in exactly one place:
  file = "<slot>/<name>"  supplied 64 px art in public/pixel/items/, never touched by the build (registered natively)
  file = null             a 40 px icon the build draws (sprites_gear.py) into public/pixel/icons/<icon>.png

  python scripts/pixel/item_registry.py            validate against the build's sprite list
  python scripts/pixel/item_registry.py --provenance   print the provenance lines"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
REGISTRY_DIR = os.path.join(ROOT, 'src', 'config', 'itemIcons')
ART_DIR = os.path.join(ROOT, 'public', 'pixel', 'items')


def entries():
    out = []
    for path in sorted(glob.glob(os.path.join(REGISTRY_DIR, '*.json'))):
        with open(path, encoding='utf8') as fh:
            out.extend(json.load(fh))
    return out


def built_icons():
    """Icon names the build must draw: registry entries without a supplied file."""
    return [e['icon'] for e in entries() if not e['file']]


def validate(sprites):
    """Problems between the registry and the build's SPRITES (an empty list means consistent)."""
    problems = []
    seen = set()
    for e in entries():
        if e['icon'] in seen:
            problems.append(f"duplicate icon {e['icon']}")
        seen.add(e['icon'])
        if e['file']:
            if not os.path.exists(os.path.join(ART_DIR, e['file'] + '.png')):
                problems.append(f"{e['icon']}: missing public/pixel/items/{e['file']}.png")
        elif e['icon'] not in sprites:
            problems.append(f"{e['icon']}: registered as built but no build sprite draws it")
    registered = set(built_icons())
    for name in sprites:
        if name.startswith('item_') and name not in registered:
            problems.append(f'{name}: drawn by the build but not in src/config/itemIcons/')
    return problems


def provenance_lines():
    return [f"- `{e['icon']}` ({e['slot']}{'/' + e['weapon'] if e['weapon'] else ''}, {e['grade'] or 'ungraded'}): {e['provenance']}" for e in entries()]


if __name__ == '__main__':
    if '--provenance' in sys.argv:
        print('\n'.join(provenance_lines()))
    else:
        sys.path.insert(0, HERE)
        import build  # noqa: E402
        probs = validate(build.SPRITES)
        print('\n'.join(probs) or 'registry matches the build')
        sys.exit(1 if probs else 0)
