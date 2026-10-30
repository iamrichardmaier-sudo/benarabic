#!/usr/bin/env python3
"""
Batches of Wiktionary words for annotation, on roots the Qur'an word bank does not cover.

    python3 scripts/wiktionary_bank/make_batches.py WORK [--roots-per-batch 25] [--limit-roots N]

Reads scripts/seo/data/dictionary.json.gz (Wiktionary via kaikki.org, CC BY-SA 4.0) and
WORK/roots.json from the Qur'an pipeline (to keep off its roots: those belong to the shards
s01..s63). Roots are ranked by the subtitle frequency of their words; each batch takes the next
N roots. Writes, under WORK (a directory of its own, not the Qur'an one):

    roots.json               the batch roots, in the shape quran_words.Work expects
    shards/wNN.json          {"id": "wNN", "roots": [n, ...]}
    dossiers/NNNN.txt        one per root: Wiktionary's words for it, then the bank's
    wanted.json              {"wNN": [normalized spelling, ...]} the words a batch must answer for
    roots_list.txt           the roots, to fetch the bank's rows for them
"""
import collections
import gzip
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'quran'))
import quran_words as qw  # noqa: E402

DATA = os.path.join(HERE, '..', 'seo', 'data', 'dictionary.json.gz')


def entry_line(e):
    bits = [f'{e["w"]}  [{e["pos"]}]']
    if e.get('form'):
        bits.append(f'form {e["form"]}')
    for k, label in (('present', 'pres'), ('masdar', 'masdar'), ('ap', 'act.ptcp'), ('pp', 'pass.ptcp')):
        v = e.get(k)
        if v:
            bits.append(f'{label} ' + (', '.join(v) if isinstance(v, list) else str(v)))
    senses = ' | '.join(s['head'] for s in e.get('senses', [])[:3])
    bits.append(f'= {senses}')
    bits.append(f'(freq {e["freq"]})')
    return '  '.join(bits)


def main(work, per_batch, limit):
    qwork = os.path.expanduser('~/quran-work')
    qroots = {r['fold'] for r in json.load(open(os.path.join(qwork, 'roots.json'), encoding='utf-8'))}
    entries = json.load(gzip.open(DATA))['entries']
    by_root = collections.defaultdict(list)
    for e in entries:
        r = e.get('root')
        if not r:
            continue
        fold = qw.fold_root(qw.canon_root(r))
        if fold in qroots or len(fold) > 4:
            continue
        by_root[fold].append((qw.canon_root(r), e))
    ranked = sorted(((sum(e['freq'] for _, e in v), f) for f, v in by_root.items() if any(e['freq'] > 0 for _, e in v)),
                    reverse=True)
    if limit:
        ranked = ranked[:limit]
    os.makedirs(os.path.join(work, 'shards'), exist_ok=True)
    os.makedirs(os.path.join(work, 'dossiers'), exist_ok=True)
    os.makedirs(os.path.join(work, 'out'), exist_ok=True)
    roots, wanted, shards = [], {}, []
    for n, (weight, fold) in enumerate(ranked, 1):
        items = by_root[fold]
        root = items[0][0]
        roots.append({'n': n, 'root': root, 'fold': fold, 'weight': weight})
        lines = [f'ROOT {root}   (no Qur\'an word; total subtitle frequency {weight})', '',
                 'WIKTIONARY words for this root (verify every one; the glosses are hints):']
        for _, e in sorted(items, key=lambda x: -x[1]['freq']):
            lines.append('  ' + entry_line(e))
        open(os.path.join(work, 'dossiers', f'{n:04d}.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    for i in range(0, len(roots), per_batch):
        sid = f'w{i // per_batch + 1:02d}'
        chunk = roots[i:i + per_batch]
        json.dump({'id': sid, 'roots': [r['n'] for r in chunk], 'rootless': False},
                  open(os.path.join(work, 'shards', f'{sid}.json'), 'w'))
        want = set()
        for r in chunk:
            for _, e in by_root[r['fold']]:
                if e['freq'] > 0:
                    want.add(qw.normalize_arabic(qw.drop_paren(e['w'])))
        wanted[sid] = sorted(want)
        shards.append(sid)
    json.dump(roots, open(os.path.join(work, 'roots.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(wanted, open(os.path.join(work, 'wanted.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    open(os.path.join(work, 'roots_list.txt'), 'w', encoding='utf-8').write('\n'.join(r['root'] for r in roots))
    print(f'{len(roots)} roots, {len(shards)} batches: {shards[0]}..{shards[-1]}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    per = int(sys.argv[sys.argv.index('--roots-per-batch') + 1]) if '--roots-per-batch' in sys.argv else 25
    lim = int(sys.argv[sys.argv.index('--limit-roots') + 1]) if '--limit-roots' in sys.argv else 0
    main(sys.argv[1], per, lim)
