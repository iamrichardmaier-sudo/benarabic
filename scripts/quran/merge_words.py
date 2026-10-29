#!/usr/bin/env python3
"""
Turn annotators' JSONL into rows for public.words.

    python3 scripts/quran/merge_words.py WORK OUTDIR [--shards s01,s02,...]

Reads WORK/out/*.jsonl (shard files named test* are ignored) and writes, to OUTDIR:

    seed/words-000.json ...   arrays of rows with exact column names, 400 per file
    dataset.jsonl             one record per kept entry, with everything computed
    report.md                 counts, what was dropped and why, what was renamed

What it decides, and why
------------------------
* A word is only ever held once (see src/lib/duplicates.ts). An entry is dropped when the bank
  already holds the same lexeme: the same verb form of the same root, or the same bare spelling
  under the same root and part of speech family.
* public.words.key is unique, so two different words that share a bare spelling (the verb كاتَبَ
  and the participle كاتِب) cannot both be stored plainly. The bank's existing convention is a
  trailing gloss in brackets — "ملك (فعل)", "ذَهَب (اسم)" — so the commoner word keeps the bare
  spelling and the other gets one. If the bank already holds the bare spelling for a different
  word, every colliding entry here gets one.
* companion_forms are the word's connections: the other words of its root, ranked by how they
  relate to it (a verb's masdar and participles first, a noun's base verb first), then by how
  often scripture uses them, then labelled the way the rest of the bank is labelled.
"""

import collections
import glob
import json
import math
import os
import re
import sys

import quran_words as qw

CHUNK = 400
MAX_COMPANIONS = 6
SUFFIX = {
    'verb': 'فعل', 'masdar': 'مصدر', 'active participle': 'اسم فاعل', 'passive participle': 'اسم مفعول',
    'plural': 'جمع', 'noun': 'اسم', 'noun of place': 'اسم مكان', 'noun of instrument': 'اسم آلة',
    'noun of instance': 'اسم مرة', 'collective noun': 'اسم جمع', 'diminutive': 'تصغير',
    'adjective': 'صفة', 'comparative': 'اسم تفضيل', 'relative adjective': 'نسبة', 'intensive adjective': 'صفة',
    'proper noun': 'علم', 'number': 'عدد', 'adverb': 'ظرف', 'expression': 'تعبير',
}
LABEL = {
    'masdar': 'Verbal noun', 'active participle': 'Active participle', 'passive participle': 'Passive participle',
    'noun': 'Noun', 'noun of place': 'Noun of place', 'noun of instrument': 'Noun of instrument',
    'noun of instance': 'Noun of instance', 'collective noun': 'Collective noun', 'plural': 'Plural',
    'diminutive': 'Diminutive', 'adjective': 'Adjective', 'comparative': 'Comparative',
    'relative adjective': 'Relative adjective', 'intensive adjective': 'Adjective', 'proper noun': 'Name',
    'number': 'Number', 'adverb': 'Adverb', 'expression': 'Expression',
}
FORM_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
TYPE_RANK = {'verb': 0, 'noun': 1, 'adjective': 2, 'masdar': 3, 'participle': 4, 'other': 5}


def label_for(kind, form, en):
    if kind == 'verb':
        return f'Form {form} verb ({en})'
    return f'{LABEL.get(kind, "Noun")} ({en})'


def group_of(word_type):
    return 'verb' if word_type == 'verb' else 'other'


def load_entries(work, only):
    out = []
    shard_info = {os.path.basename(p)[:-5]: json.load(open(p, encoding='utf-8'))
                  for p in glob.glob(os.path.join(work.path, 'shards', '*.json'))}
    for path in sorted(glob.glob(os.path.join(work.path, 'out', '*.jsonl'))):
        sid = os.path.basename(path)[:-6]
        if sid.startswith('test') or (only and sid not in only):
            continue
        rootless = shard_info.get(sid, {}).get('rootless', False)
        for ln, line in enumerate(open(path, encoding='utf-8'), 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            o = json.loads(line)
            if 'skip' in o:
                continue
            o['_shard'], o['_line'] = sid, ln
            if rootless:
                o['root'] = None
            out.append(o)
    return out


def quran_counts(work):
    verbs, lemmas = collections.Counter(), collections.Counter()
    for t in work.tokens:
        for s in t['segs']:
            if s['pos'] in qw.GRAMMAR:
                continue
            fold = qw.fold_root(s['root']) if s.get('root') and len(qw.fold_root(s['root'])) <= 4 else ''
            if s['pos'] == 'V':
                verbs[(fold, s.get('form', 'I'))] += 1
            else:
                lemmas[(fold, qw.normalize_arabic(s.get('lem') or qw.strip_marks(t['ar'])))] += 1
    return verbs, lemmas


def main(work_dir, out_dir, only):
    work = qw.Work(work_dir)
    os.makedirs(os.path.join(out_dir, 'seed'), exist_ok=True)
    entries = load_entries(work, only)
    verbs, lemmas = quran_counts(work)
    report = []
    dropped = []

    # ---- frequency, for ordering only
    for e in entries:
        fold = qw.fold_root(e['root']) if e.get('root') else ''
        e['_fold'] = fold
        e['_clean'] = qw.drop_paren(e['w'])
        e['_key0'] = qw.normalize_arabic(e['_clean'])
        if e['type'] == 'verb':
            e['_q'] = verbs.get((fold, e['form']), 0)
        else:
            forms = qw.entry_forms(e)
            e['_q'] = max([lemmas.get((fold, f), 0) for f in forms] or [0])

    # ---- the bank's side of the table
    bank = work.existing
    bank_forms = collections.defaultdict(list)
    bank_verbs = collections.defaultdict(list)
    for b in bank:
        spell = {b['key'], qw.normalize_arabic(qw.drop_paren(b['word'] or '')), qw.normalize_arabic(qw.drop_paren(b['word_voweled'] or ''))}
        for part in re.split(r'[/،]', b['word'] or ''):
            spell.add(qw.normalize_arabic(qw.drop_paren(part.strip())))
        for sp in spell:
            if sp:
                bank_forms[sp].append(b)
        if b['word_type'] == 'verb' and b.get('root') and b.get('verb_form'):
            bank_verbs[(qw.fold_root(b['root']), b['verb_form'])].append(b)

    kept = []
    for e in entries:
        fold = e['_fold']
        if e['type'] == 'verb' and fold and bank_verbs.get((fold, e['form'])):
            b = bank_verbs[(fold, e['form'])][0]
            dropped.append((e, f'bank already has this verb: {b["word_voweled"] or b["word"]} (form {b["verb_form"]})'))
            continue
        hits = bank_forms.get(e['_key0'], [])
        same = [b for b in hits if (qw.fold_root(b['root']) if b.get('root') else '') == fold
                and group_of(b['word_type']) == group_of(e['type'])]
        if same:
            dropped.append((e, f'bank already has {same[0]["word_voweled"] or same[0]["word"]} [{same[0]["word_type"]}]'))
            continue
        e['_bank_collision'] = bool(hits)
        kept.append(e)

    # ---- exact repeats inside the new set (same word listed twice)
    seen, unique = {}, []
    for e in sorted(kept, key=lambda e: (e['src'] != 'quran', not e.get('q'), e['_shard'], e['_line'])):
        sig = (e['_key0'], e['_fold'], group_of(e['type']), e.get('form') if e['type'] != 'noun' else None, e['kind'])
        if sig in seen:
            dropped.append((e, f'same word as {seen[sig]["w"]} (shard {seen[sig]["_shard"]})'))
            continue
        seen[sig] = e
        unique.append(e)
    kept = unique

    # ---- one bare spelling, one word: the commoner keeps it, the rest are bracketed
    def rank(e):
        form_rank = FORM_ORDER.index(e['form']) if e.get('form') in FORM_ORDER else 0
        return (-e['_q'], TYPE_RANK.get(e['type'], 9), form_rank, e['_shard'], e['_line'])

    by_key = collections.defaultdict(list)
    for e in kept:
        by_key[e['_key0']].append(e)
    renamed = 0
    used = set(bank_forms)
    for k, group in by_key.items():
        group.sort(key=rank)
        for i, e in enumerate(group):
            plain = (i == 0 and not any(g['_bank_collision'] for g in group))
            if plain and not e['w'].endswith(')'):
                e['_word'] = e['_clean']
            else:
                suf = SUFFIX.get(e['kind'], 'اسم')
                cand = f'{e["_clean"]} ({suf})'
                n = 2
                while qw.normalize_arabic(cand) in used or any(qw.normalize_arabic(cand) == qw.normalize_arabic(x.get('_word', '')) for x in group):
                    cand = f'{e["_clean"]} ({suf} {n})'
                    n += 1
                e['_word'] = cand
                renamed += 1
        for e in group:
            used.add(qw.normalize_arabic(e['_word']))

    # ---- connections
    by_root = collections.defaultdict(list)
    for e in kept:
        if e['_fold']:
            by_root[e['_fold']].append(e)
    bank_by_root = collections.defaultdict(list)
    for b in bank:
        if b.get('root'):
            bank_by_root[qw.fold_root(b['root'])].append(b)

    def cand_from_entry(c):
        return {'form': c['_clean'], 'kind': c['kind'], 'vform': c.get('form'), 'en': c['en'], 'q': c['_q'],
                'quran': c['src'] == 'quran', 'type': c['type'], 'key': c['_key0'], 'bank': False}

    def cand_from_bank(b):
        t = b['word_type']
        kind = {'verb': 'verb', 'masdar': 'masdar', 'participle': 'active participle', 'adjective': 'adjective'}.get(t, 'noun')
        return {'form': b['word_voweled'] or b['word'], 'kind': kind, 'vform': b.get('verb_form'),
                'en': b['english'] or '', 'q': 0, 'quran': False, 'type': t, 'key': b['key'], 'bank': True}

    def score(e, c):
        fe = FORM_ORDER.index(e['form']) if e.get('form') in FORM_ORDER else 0
        fc = FORM_ORDER.index(c['vform']) if c.get('vform') in FORM_ORDER else 0
        if e['type'] == 'verb':
            if c['kind'] == 'masdar' and c['vform'] == e['form']:
                s = 100
            elif c['kind'] == 'active participle' and c['vform'] == e['form']:
                s = 90
            elif c['kind'] == 'passive participle' and c['vform'] == e['form']:
                s = 80
            elif c['kind'] == 'verb':
                s = 75 - abs(fc - fe)
            elif c['kind'] in ('masdar', 'active participle', 'passive participle'):
                s = 55
            else:
                s = 50
        elif e['type'] in ('masdar', 'participle'):
            if c['kind'] == 'verb' and c['vform'] == e['form']:
                s = 100
            elif c['kind'] == 'verb' and c['vform'] == 'I':
                s = 85
            elif c['kind'] == 'verb':
                s = 65
            elif c['kind'] in ('masdar', 'active participle', 'passive participle') and c['vform'] == e['form']:
                s = 70
            else:
                s = 50
        else:
            if c['kind'] == 'verb':
                s = 95 - fc
            elif c['kind'] == 'masdar':
                s = 70
            elif c['kind'] in ('active participle', 'passive participle'):
                s = 60
            elif c['kind'] == 'plural':
                s = 20
            else:
                s = 50
        return s + min(c['q'], 60) / 12 + (3 if c['quran'] else 0) + (1 if c['bank'] else 0)

    rows, records = [], []
    for e in kept:
        own = {e['_key0']}
        for f in ('masdar', 'past'):
            if e.get(f):
                own.add(qw.normalize_arabic(qw.drop_paren(e[f])))
        pool = [cand_from_entry(c) for c in by_root.get(e['_fold'], []) if c is not e]
        pool += [cand_from_bank(b) for b in bank_by_root.get(e['_fold'], [])]
        seen_keys, chosen = set(own), []
        for c in sorted(pool, key=lambda c: -score(e, c)):
            if c['key'] in seen_keys or not c['en']:
                continue
            seen_keys.add(c['key'])
            chosen.append(c)
            if len(chosen) == MAX_COMPANIONS:
                break
        companions = [{'form': c['form'], 'label': label_for(c['kind'], c['vform'], c['en'])} for c in chosen]
        for s in e.get('see', [])[:2]:
            companions.append({'form': s['w'], 'label': s['label']})

        row = {
            'key': qw.normalize_arabic(e['_word']),
            'word': e['_word'],
            'word_voweled': e['_clean'],
            'english': e['en'],
            'root': e.get('root'),
            'word_type': e['type'],
            'verb_form': e.get('form'),
            'past_tense': e.get('past') if e['type'] == 'verb' else None,
            'present_tense': e.get('pres') if e['type'] == 'verb' else None,
            'masdar_form': e.get('masdar') if e['type'] == 'verb' else None,
            'gender': e.get('gender'),
            'fusha_plural': e.get('plural'),
            'companion_forms': companions or None,
            'quran_example': None, 'quran_example_en': None, 'quran_reference': None,
        }
        if e.get('q'):
            c, v, i, j = map(int, re.match(r'^(\d+):(\d+):(\d+)-(\d+)$', e['q']).groups())
            row['quran_example'] = ' '.join(work.verses[f'{c}:{v}']['toks'][i - 1:j])
            row['quran_example_en'] = e['qen']
            row['quran_reference'] = f'{work.suras[c]["rom"]} {c}:{v}'
        rows.append(row)
        records.append({**{k: v for k, v in e.items() if not k.startswith('_')}, 'word': row['word'],
                        'key': row['key'], 'shard': e['_shard'], 'qcount': e['_q']})

    # ---- invariants: fail loudly rather than write a bad load
    keys = [r['key'] for r in rows]
    assert len(keys) == len(set(keys)), 'duplicate keys among new rows'
    bank_keys = {b['key'] for b in bank}
    clash = [k for k in keys if k in bank_keys]
    assert not clash, f'rows collide with the bank: {clash[:5]}'

    rows.sort(key=lambda r: (r['root'] or '', r['key']))
    for i in range(0, len(rows), CHUNK):
        json.dump(rows[i:i + CHUNK], open(os.path.join(out_dir, 'seed', f'words-{i // CHUNK:03d}.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(out_dir, 'dataset.jsonl'), 'w', encoding='utf-8') as f:
        for r in sorted(records, key=lambda r: (r.get('root') or '', r['key'])):
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    # ---- report
    tc = collections.Counter(r['word_type'] for r in rows)
    sc = collections.Counter(e['src'] for e in kept)
    report += ['# Merge report', '', f'* entries read: {len(entries)}', f'* rows to load: {len(rows)}',
               f'* dropped: {len(dropped)}', f'* given a bracketed disambiguator: {renamed}',
               f'* by type: {dict(tc)}', f'* by source: {dict(sc)}',
               f'* with a Qur\'an excerpt: {sum(1 for r in rows if r["quran_example"])}',
               f'* with connections: {sum(1 for r in rows if r["companion_forms"])}',
               f'* roots touched: {len({r["root"] for r in rows if r["root"]})}', '', '## Dropped', '']
    for e, why in dropped:
        report.append(f'* {e["w"]} ({e["_shard"]}:{e["_line"]}): {why}')
    open(os.path.join(out_dir, 'report.md'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
    print(f'{len(rows)} rows in {math.ceil(len(rows) / CHUNK)} files; {len(dropped)} dropped; {renamed} bracketed')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    only = None
    if '--shards' in sys.argv:
        only = set(sys.argv[sys.argv.index('--shards') + 1].split(','))
    main(sys.argv[1], sys.argv[2], only)
