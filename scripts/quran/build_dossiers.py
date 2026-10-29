#!/usr/bin/env python3
"""
One evidence file per root, for the people (or models) annotating it.

    python3 -I scripts/quran/build_dossiers.py WORKDIR EXISTING_WORDS_JSON

WORKDIR holds corpus/ from build_corpus.py. EXISTING_WORDS_JSON is an export of
public.words (a JSON array of rows). Writes WORKDIR/dossiers/<n>.txt, one per
root, and WORKDIR/roots.json (the scope, with a workload estimate for sharding).

A dossier is evidence, not an answer: what the Qur'an attests for the root
(by part of speech, verb form and lemma, with a sample reference and the
quran.com word-by-word hint), which words the bank already holds, and what
Wiktionary lists for the root outside scripture.
"""

import collections
import gzip
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEO = os.path.join(HERE, '..', 'seo', 'data')

# Pure function words. Everything else with a root is vocabulary.
GRAMMAR = {'P', 'REL', 'PRON', 'NEG', 'ACC', 'CONJ', 'DEM', 'COND', 'RES', 'SUB', 'CERT', 'INTG', 'INC',
           'PREV', 'VOC', 'RET', 'FUT', 'SUP', 'INL', 'ANS', 'AVR', 'EXP', 'EXL', 'EXH', 'IMPN'}
ROOTLESS_POS = {'N', 'ADJ', 'PN', 'NUM', 'LOC', 'T'}
POS_NAME = {'N': 'noun', 'ADJ': 'adjective', 'V': 'verb', 'PN': 'proper noun', 'NUM': 'number',
            'LOC': 'place adverb', 'T': 'time adverb', '?': 'unclassified (QAC 0.1 lacks this verse)'}


def canon_root(r):
    """Every hamza seat -> أ; a radical alef is always a hamza."""
    return re.sub('[ءأإآٱا]', 'أ', r or '')


def fold(r):
    return re.sub(r'[-\s]', '', canon_root(r))


def bare(s):
    s = re.sub('[ً-ٰٟـۖ-ۭ]', '', s)
    s = re.sub('[أإآٱ]', 'ا', s)
    return s.replace('ى', 'ي').replace('ة', 'ه').strip()


def load_wiktionary():
    """root -> [(word, pos, first sense, freq)] from the repo's Wiktionary extract."""
    d = json.load(gzip.open(os.path.join(SEO, 'dictionary.json.gz'), 'rt', encoding='utf-8'))
    roots = json.load(open(os.path.join(SEO, 'wiktionary-roots.json'), encoding='utf-8'))
    out = collections.defaultdict(list)
    for e in d['entries']:
        by_et = roots.get(e['page'], {})
        rs = by_et.get(str(e.get('et', '0'))) or by_et.get('0') or []
        if not rs or not e.get('senses'):
            continue
        r = rs[0]
        out[fold(r)].append((e['w'], e['pos'], e['senses'][0]['head'][:60], e.get('freq', 0)))
    return out


def tag_hint(seg):
    keep = [t for t in seg.get('tags', []) if t in ('M', 'F', 'MS', 'FS', 'MP', 'FP', 'MD', 'FD', 'P', 'D', 'S')]
    return ' '.join(keep)


def main(work, existing_path):
    corpus = os.path.join(work, 'corpus')
    tokens = json.load(open(os.path.join(corpus, 'tokens.json'), encoding='utf-8'))
    suras = {s['id']: s['rom'] for s in json.load(open(os.path.join(corpus, 'suras.json'), encoding='utf-8'))}
    existing = json.load(open(existing_path, encoding='utf-8'))
    wikt = load_wiktionary()

    q = collections.defaultdict(list)            # fold(root) -> [(token, seg)]
    rootless = collections.defaultdict(list)     # lemma -> [(token, seg)]
    for t in tokens:
        for s in t['segs']:
            if s['pos'] in GRAMMAR:
                continue
            # More than four radicals is not a root: a name or a loanword (QAC still lists one).
            if s.get('root') and len(fold(s['root'])) <= 4:
                q[fold(s['root'])].append((t, s))
            elif s['pos'] in ROOTLESS_POS:
                rootless[s.get('lem') or bare(t['ar'])].append((t, s))
    bank = collections.defaultdict(list)
    for w in sorted(existing, key=lambda w: w['key']):   # sorted, so any export gives the same dossiers
        if w.get('root'):
            bank[fold(w['root'])].append(w)

    scope = sorted(set(q) | set(bank))
    os.makedirs(os.path.join(work, 'dossiers'), exist_ok=True)
    index = []
    for i, k in enumerate(scope, 1):
        hits = q.get(k, [])
        # Display the root the way the bank spells it, else the canonical spelling.
        shown = (bank[k][0]['root'] if bank.get(k) else None) or next((canon_root(s['root']) for _, s in hits), k)
        if not bank.get(k):
            shown = '-'.join(k) if '-' not in shown else shown
        lines = [f'=== ROOT {shown}   (dossier {i}/{len(scope)})']

        lines.append(f'QURAN: {len(hits)} content-word tokens' if hits else 'QURAN: not attested in the Qur\'an (vocabulary beyond scripture)')
        groups = collections.OrderedDict()
        for t, s in hits:
            if s['pos'] == 'V':
                key = ('V', s.get('form', 'I'))
            elif s.get('vn'):
                key = ('VN', s.get('lem', ''))
            elif s.get('pcpl'):
                key = (('ACT' if s.get('voice') == 'ACT' else 'PASS') + ' PCPL', s.get('form', 'I'), s.get('lem', ''))
            else:
                key = (s['pos'], s.get('lem') or bare(t['ar']))
            groups.setdefault(key, []).append((t, s))
        n_groups = 0
        for key, items in sorted(groups.items(), key=lambda kv: (-len(kv[1]), str(kv[0]))):
            n_groups += 1
            t0, s0 = items[0]
            if key[0] == 'V':
                asp = collections.Counter(s.get('asp', '?') for _, s in items)
                forms = collections.Counter(bare(t['ar']) for t, _ in items).most_common(3)
                desc = f'VERB form {key[1]}  x{len(items)}  aspects {dict(asp)}  e.g. ' + ' | '.join(f for f, _ in forms)
            elif key[0] == 'VN':
                desc = f'VERBAL NOUN {key[1]}  x{len(items)}'
            elif 'PCPL' in key[0]:
                desc = f'{key[0]} form {key[1]}  lemma {key[2]}  x{len(items)}'
            else:
                desc = f'{POS_NAME.get(key[0], key[0]).upper()} lemma {key[1]}  x{len(items)}  {tag_hint(s0)}'
            ref = f"{suras.get(t0['c'], t0['c'])} {t0['c']}:{t0['v']}"
            gl = f" \"{t0['gloss']}\"" if t0.get('gloss') else ''
            lines.append(f'  - {desc}   ~ {t0["ar"]} ({ref}){gl}')

        if bank.get(k):
            lines.append('BANK (already in the words table; do NOT re-add, but link to them):')
            for w in bank[k]:
                lines.append(f'  - {w["word_voweled"] or w["word"]} [{w["word_type"]}{" " + w["verb_form"] if w.get("verb_form") else ""}] {w["english"]}')
        else:
            lines.append('BANK: nothing yet for this root')

        cands = sorted(wikt.get(k, []), key=lambda c: -c[3])[:25]
        if cands:
            lines.append('WIKTIONARY (outside scripture; verify before use):')
            for w, pos, head, _ in cands:
                lines.append(f'  - {w} ({pos}) {head}')

        text = '\n'.join(lines) + '\n'
        open(os.path.join(work, 'dossiers', f'{i:04d}.txt'), 'w', encoding='utf-8').write(text)
        weight = n_groups + min(len(cands), 12) + len(bank.get(k, [])) * 0.5 + 2
        index.append({'n': i, 'root': shown, 'fold': k, 'quran_tokens': len(hits), 'quran_groups': n_groups,
                      'bank': len(bank.get(k, [])), 'wikt': len(cands), 'weight': round(weight, 1)})

    # Names, loanwords, numbers: content words with no root, listed by lemma.
    lines = ['=== WORDS WITHOUT A ROOT (names, loanwords, numbers, a few adverbs)']
    for lem, items in sorted(rootless.items(), key=lambda kv: -len(kv[1])):
        t0, s0 = items[0]
        ref = f"{suras.get(t0['c'], t0['c'])} {t0['c']}:{t0['v']}"
        gl = f" \"{t0['gloss']}\"" if t0.get('gloss') else ''
        lines.append(f"  - {POS_NAME.get(s0['pos'], s0['pos'])} lemma {lem}  x{len(items)}   ~ {t0['ar']} ({ref}){gl}")
    open(os.path.join(work, 'dossiers', 'rootless.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    json.dump(index, open(os.path.join(work, 'roots.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'{len(scope)} roots; {sum(r["quran_groups"] for r in index)} quran groups; '
          f'total weight {sum(r["weight"] for r in index):.0f}')
    print(f'{len(rootless)} rootless lemmas, {sum(len(v) for v in rootless.values())} tokens')
    print('quran-only', sum(1 for r in index if not r['bank']), 'bank-only', sum(1 for r in index if not r['quran_tokens']))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
