#!/usr/bin/env python3
"""
Cut the root scope into annotation shards, deterministically.

    python3 -I scripts/quran/make_shards.py WORK            # writes WORK/shards/*.json
    python3 -I scripts/quran/make_shards.py WORK --verify   # compares with scripts/quran/shards.json

Roots are taken in dossier order and packed greedily up to CAP workload points, so the
same bank snapshot always yields the same shards. shards.json (committed) records which
roots each shard holds; --verify is how a second machine confirms it rebuilt the same
scope before it annotates anything.
"""

import json
import os
import sys

CAP = 330
HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, 'shards.json')


def build(roots):
    shards, cur, w = [], [], 0
    for r in roots:
        if cur and w + r['weight'] > CAP:
            shards.append(cur)
            cur, w = [], 0
        cur.append(r)
        w += r['weight']
    if cur:
        shards.append(cur)
    return {f's{i:02d}': s for i, s in enumerate(shards, 1)}


def main(work, verify):
    roots = json.load(open(os.path.join(work, 'roots.json'), encoding='utf-8'))
    shards = build(roots)
    manifest = {sid: [r['root'] for r in s] for sid, s in shards.items()}
    if verify:
        want = json.load(open(MANIFEST, encoding='utf-8'))
        if want != manifest:
            bad = [k for k in sorted(set(want) | set(manifest)) if want.get(k) != manifest.get(k)]
            sys.exit(f'scope differs from shards.json in {len(bad)} shards ({bad[:5]}...). '
                     f'Use the committed bank snapshot, not a fresh export.')
        print(f'OK: {len(manifest)} shards match shards.json')
        return
    os.makedirs(os.path.join(work, 'shards'), exist_ok=True)
    for sid, s in shards.items():
        json.dump({'id': sid, 'roots': [r['n'] for r in s], 'rootless': False},
                  open(os.path.join(work, 'shards', f'{sid}.json'), 'w'))
    json.dump({'id': 'rootless', 'roots': [], 'rootless': True},
              open(os.path.join(work, 'shards', 'rootless.json'), 'w'))
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'{len(shards)} shards + rootless')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], '--verify' in sys.argv)
