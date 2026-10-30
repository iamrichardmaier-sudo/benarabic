#!/usr/bin/env python3
"""
Batches of Wiktionary words whose page carries no root, ranked by subtitle frequency.

    python3 scripts/wiktionary_bank/make_unrooted_batches.py WORK [--per-batch 80]

These are common words (فَتاة، سَنَة، مَدينة) that the root cache missed, plus loanwords, names and
numbers. The annotator decides each word's root, or marks it rootless. Writes u01..uNN under WORK:
shards/uNN.json, dossiers/uNN.txt, wanted.json (appended to), and an empty out/ directory.
"""
import gzip
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'quran'))
sys.path.insert(0, HERE)
import quran_words as qw  # noqa: E402
from make_batches import DATA, entry_line  # noqa: E402


def main(work, per):
    entries = [e for e in json.load(gzip.open(DATA))['entries'] if not e.get('root') and e['freq'] > 0]
    entries.sort(key=lambda e: -e['freq'])
    for d in ('shards', 'dossiers', 'out'):
        os.makedirs(os.path.join(work, d), exist_ok=True)
    wpath = os.path.join(work, 'wanted.json')
    wanted = json.load(open(wpath, encoding='utf-8')) if os.path.exists(wpath) else {}
    n = 0
    for i in range(0, len(entries), per):
        n += 1
        sid = f'u{n:02d}'
        chunk = entries[i:i + per]
        json.dump({'id': sid, 'roots': [], 'rootless': False, 'free': True},
                  open(os.path.join(work, 'shards', f'{sid}.json'), 'w'))
        lines = [f'BATCH {sid}: Wiktionary words with no root on their page, most frequent first.', '',
                 'For each word decide: its root (verify it: the letters must be in the word), or rootless',
                 '(a name, loanword, number, particle). Verify vowels and gloss; they are hints.', '']
        lines += ['  ' + entry_line(e) for e in chunk]
        open(os.path.join(work, 'dossiers', f'{sid}.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        wanted[sid] = sorted({qw.normalize_arabic(qw.drop_paren(e['w'])) for e in chunk})
    json.dump(wanted, open(wpath, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(entries)} words, {n} batches u01..u{n:02d}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    per = int(sys.argv[sys.argv.index('--per-batch') + 1]) if '--per-batch' in sys.argv else 80
    main(sys.argv[1], per)
