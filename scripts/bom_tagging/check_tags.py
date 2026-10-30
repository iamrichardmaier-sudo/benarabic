#!/usr/bin/env python3
"""
Validate a batch of corpus tags.

    python3 scripts/bom_tagging/check_tags.py WORK tNN

Checks WORK/out/tNN.jsonl: JSON shape, the part-of-speech vocabulary, voweled lemmas, the root's radicals
appearing in the lemma, verb forms, and an English gloss. Exit 0 when there are no errors.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'quran'))
import quran_words as qw  # noqa: E402

POS = {'verb', 'noun', 'adjective', 'participle', 'proper_noun', 'particle', 'other'}
FORMS = {'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'}


def main(work, bid):
    path = os.path.join(work, 'out', f'{bid}.jsonl')
    if not os.path.exists(path):
        sys.exit(f'{path} does not exist yet')
    errors, seen, n = [], set(), 0
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f'line {ln}: invalid JSON ({e})')
            continue
        n += 1
        w = f'line {ln}'
        missing = [k for k in ('surface', 'lemma', 'pos', 'gloss') if not o.get(k)]
        if missing:
            errors.append(f'{w}: missing {missing}')
            continue
        if o['surface'] in seen:
            errors.append(f'{w}: surface repeated')
        seen.add(o['surface'])
        if o['pos'] not in POS:
            errors.append(f'{w}: pos "{o["pos"]}" not in {sorted(POS)}')
        lemma = o['lemma']
        if re.search('[A-Za-z0-9]', lemma):
            errors.append(f'{w}: lemma must be Arabic script')
        if o['pos'] in ('verb', 'noun', 'adjective', 'participle') and not re.search('[ً-ْ]', lemma):
            errors.append(f'{w}: lemma "{lemma}" needs tashkeel')
        if re.match('^(ال|الْ|اَل)', lemma) and o['pos'] not in ('particle', 'other', 'proper_noun') \
                and not (o['pos'] == 'verb'):
            errors.append(f'{w}: lemma "{lemma}" starts with the article')
        root = o.get('root')
        if root:
            if not re.match('^[ء-ي](-[ء-ي]){1,3}$', root):
                errors.append(f'{w}: root "{root}" is not letters joined by "-"')
            elif root != qw.canon_root(root):
                errors.append(f'{w}: root must spell every hamza as أ: {qw.canon_root(root)}')
            elif o['pos'] not in ('particle', 'other', 'proper_noun') and not qw.has_root(lemma, root) \
                    and not o.get('override'):
                errors.append(f'{w}: lemma "{lemma}" lacks the radicals of {root} (add "override": "<why>" if real)')
        vf = o.get('verb_form')
        if o['pos'] == 'verb' and vf not in FORMS:
            errors.append(f'{w}: verb needs verb_form I..X')
        if vf and vf not in FORMS:
            errors.append(f'{w}: verb_form "{vf}" not I..X')
        if vf and o['pos'] not in ('verb', 'participle'):
            errors.append(f'{w}: verb_form only for verbs and participles')
        g = o['gloss']
        if re.search('[؀-ۿ]', g) or len(g.split()) > 9:
            errors.append(f'{w}: gloss must be short English')
    print(f'{bid}: {n} rows, {len(errors)} errors')
    for m in errors[:60]:
        print('ERROR', m)
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
