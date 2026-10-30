#!/usr/bin/env python3
"""
Validate a Wiktionary batch.

    python3 scripts/wiktionary_bank/check_batch.py WORK wNN

Every entry goes through the same checks as the Qur'an annotations (quran_words.check_entry: the
root's radicals must appear in the word, voweled headword, verb principal parts, gender, plural,
English gloss), against the batch's own roots. On top of that, every Wiktionary word that has any
subtitle frequency must be an entry or a stated skip: {"skip": "<word>", "why": "..."}.
Exit 0 when there are no errors.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'quran'))
import quran_words as qw  # noqa: E402


def main(work_dir, sid):
    work = qw.Work(work_dir)
    shard = json.load(open(os.path.join(work_dir, 'shards', f'{sid}.json'), encoding='utf-8'))
    wanted = set(json.load(open(os.path.join(work_dir, 'wanted.json'), encoding='utf-8'))[sid])
    by_n = {r['n']: r for r in work.roots}
    shard_roots = {by_n[n]['fold'] for n in shard['roots']}
    free = shard.get('free', False)
    qroots = set()
    if free:
        qroots = {r['fold'] for r in json.load(open(os.path.expanduser('~/quran-work/roots.json'), encoding='utf-8'))}
    path = os.path.join(work_dir, 'out', f'{sid}.jsonl')
    if not os.path.exists(path):
        sys.exit(f'{path} does not exist yet')
    errors, warns, entries, skips = [], [], [], []
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError as ex:
            errors.append(f'line {ln}: invalid JSON ({ex})')
            continue
        if 'skip' in o:
            skips.append(o)
            if not o.get('why'):
                errors.append(f'line {ln}: skip needs "why"')
            continue
        if o.get('src') != 'msa' or o.get('q'):
            errors.append(f'line {ln} ({o.get("w")}): these roots have no Qur\'an word; use "src": "msa" and no "q"')
            continue
        if free:
            # roots are the annotator's call; Qur'an roots belong to the s01..s63 shards
            if o.get('root'):
                fold = qw.fold_root(qw.canon_root(o['root']))
                if fold in qroots:
                    errors.append(f'line {ln} ({o.get("w")}): {o["root"]} is a Qur\'an root, covered by the s01..s63 '
                                  f'shards; replace with {{"skip": "{o.get("w")}", "why": "Qur\'an root"}}')
                    continue
                shard_roots = shard_roots | {fold}
            else:
                o['rootless'] = True
        before = len(errors)
        qw.check_entry(work, o, shard_roots, errors, warns, f'line {ln} ({o.get("w", "?")})')
        if len(errors) == before:
            entries.append((ln, o))
    have = set()
    for _, e in entries:
        have |= qw.entry_forms(e)
        have.add(qw.normalize_arabic(qw.drop_paren(e['w'])))
    skipped = {qw.normalize_arabic(qw.drop_paren(s['skip'])) for s in skips}
    for w in sorted(wanted - have - skipped):
        errors.append(f'UNANSWERED Wiktionary word, add an entry or {{"skip": "...", "why": "..."}}: {w}')
    seen = {}
    for ln, e in entries:
        k = (qw.normalize_arabic(qw.drop_paren(e['w'])), e['type'], e.get('form'), e['kind'])
        if k in seen:
            errors.append(f'line {ln} ({e["w"]}): repeats line {seen[k]}')
        seen[k] = ln
    print(f'{sid}: {len(entries)} entries, {len(skips)} skips, {len(errors)} errors, {len(warns)} warnings')
    for m in errors[:80]:
        print('ERROR', m)
    for m in warns[:25]:
        print('warn ', m)
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
