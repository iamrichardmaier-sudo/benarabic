#!/usr/bin/env python3
"""
Toolkit for building the word bank from the Qur'an and its roots.

    python3 scripts/quran/quran_words.py verse  2:255              --work WORK
    python3 scripts/quran/quran_words.py root   ك-ت-ب              --work WORK
    python3 scripts/quran/quran_words.py check  SHARD_ID           --work WORK
    python3 scripts/quran/quran_words.py merge                     --work WORK
    python3 scripts/quran/quran_words.py sql                       --work WORK

WORK is the directory build_corpus.py / build_dossiers.py wrote to. Annotators
only need `verse`, `root` and `check`; `merge` and `sql` belong to whoever owns
the database load.

Layout inside WORK
    corpus/        tokens.json verses.json suras.json wordmap.json
    dossiers/      one evidence file per root
    roots.json     the scope
    shards/NN.json {"id": "NN", "roots": [dossier numbers...], "rootless": bool}
    out/NN.jsonl   what an annotator writes (one JSON object per line)
    existing_words.json   export of public.words, for duplicate detection
"""

import argparse
import collections
import json
import os
import re
import sys

ALLOWED_TYPES = {'verb', 'masdar', 'noun', 'adjective', 'participle', 'other'}
ALLOWED_KINDS = {
    'verb', 'masdar', 'active participle', 'passive participle', 'noun', 'noun of place', 'noun of instrument',
    'noun of instance', 'collective noun', 'adjective', 'comparative', 'relative adjective', 'intensive adjective',
    'plural', 'proper noun', 'number', 'adverb', 'expression', 'diminutive',
}
KIND_FOR_TYPE = {
    'verb': {'verb'}, 'masdar': {'masdar'}, 'participle': {'active participle', 'passive participle'},
    'noun': {'noun', 'noun of place', 'noun of instrument', 'noun of instance', 'collective noun', 'plural',
             'proper noun', 'number', 'diminutive'},
    'adjective': {'adjective', 'comparative', 'relative adjective', 'intensive adjective'},
    'other': {'adverb', 'expression', 'proper noun', 'number', 'noun'},
}
FORMS = {'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'}
WEAK = set('اويىءأإآؤئٱ')
GRAMMAR = {'P', 'REL', 'PRON', 'NEG', 'ACC', 'CONJ', 'DEM', 'COND', 'RES', 'SUB', 'CERT', 'INTG', 'INC',
           'PREV', 'VOC', 'RET', 'FUT', 'SUP', 'INL', 'ANS', 'AVR', 'EXP', 'EXL', 'EXH', 'IMPN'}
MAX_COMPANIONS = 6


# ------------------------------------------------------------------ arabic text

def normalize_arabic(s):
    """Exactly public.normalize_arabic(): tashkeel/tatweel out, alef variants -> ا, ة -> ه, ى -> ي."""
    s = re.sub('[ً-ٰٟـ]', '', s)
    s = s.translate(str.maketrans('أإآٱةى', 'ااااهي'))
    return re.sub(r'\s+', ' ', s)


def strip_marks(s):
    return re.sub('[ً-ٰٟـۖ-ۭ]', '', s)


def canon_root(r):
    return re.sub('[ءأإآٱا]', 'أ', r or '')


def fold_root(r):
    # Tatweel is stripped too: the bank holds one root typed as ف-هـ-م.
    return re.sub(r'[-\sـ]', '', canon_root(r))


def drop_paren(w):
    """'ملك (فعل)' -> 'ملك'. The bank disambiguates homographs with a trailing gloss in brackets."""
    return re.sub(r'\s*\([^)]*\)\s*$', '', w).strip()


def vowel_profile(w):
    """[(letter, vowels)] with hamza seats, ى and ة folded; vowels drawn from a u i o (sukun)."""
    out = []
    for ch in drop_paren(w):
        if re.match('[\u0621-\u064a\u0671]', ch) and ch != 'ـ':
            out.append([ch.translate(str.maketrans('أإآٱةى', 'ااااهي')), ''])
        elif out and ch in '\u064e\u064f\u0650':
            out[-1][1] += {'\u064e': 'a', '\u064f': 'u', '\u0650': 'i'}[ch]
        elif out and ch == '\u0652':
            out[-1][1] += 'o'
    return out


def same_word(a, b):
    """Could these two voweled spellings be one word? Same letters, and no letter given different vowels.

    Vowels one side leaves out (the bank writes مَكتَب, not مَكْتَب) never count against it; a vowel
    both sides give and disagree on does: رِجْل (foot) and رَجُل (man) are two words.
    """
    pa, pb = vowel_profile(a), vowel_profile(b)
    if [x for x, _ in pa] != [x for x, _ in pb]:
        return False
    for (_, va), (_, vb) in zip(pa, pb):
        if va and vb and va != vb:
            return False
    return True


def skeleton(w):
    """Consonants of a voweled word; a shadda doubles its letter. Weak letters stay in place."""
    out = []
    for ch in drop_paren(w):
        if ch == 'ّ' and out:
            out.append(out[-1])
        elif re.match('[ء-يٱ]', ch):
            out.append(ch)
    return ''.join(c for c in out if c not in 'ةـ')


def has_root(w, root):
    """Are the root's radicals present, in order, in the word? Weak radicals are interchangeable and optional."""
    rad = [('W' if r in WEAK else r) for r in canon_root(root).split('-')]
    letters = [('W' if c in WEAK else c) for c in skeleton(w)]
    i = 0
    miss = 0
    for r in rad:
        j = i
        while j < len(letters) and letters[j] != r:
            j += 1
        if j < len(letters):
            i = j + 1
        elif r == 'W':
            miss += 1
        else:
            return False
    return miss <= 1


# ------------------------------------------------------------------ data access

class Work:
    def __init__(self, path):
        self.path = path
        self._cache = {}

    def load(self, name):
        if name not in self._cache:
            self._cache[name] = json.load(open(os.path.join(self.path, name), encoding='utf-8'))
        return self._cache[name]

    @property
    def verses(self):
        return self.load('corpus/verses.json')

    @property
    def suras(self):
        return {s['id']: s for s in self.load('corpus/suras.json')}

    @property
    def wordmap(self):
        return self.load('corpus/wordmap.json')

    @property
    def tokens(self):
        return self.load('corpus/tokens.json')

    @property
    def roots(self):
        return self.load('roots.json')

    @property
    def existing(self):
        return self.load('existing_words.json')

    def root_of_token(self, tok):
        hit = self.wordmap.get(strip_marks(tok)) or self.wordmap.get(normalize_arabic(tok))
        return canon_root(hit['root']) if hit and hit.get('root') else None


# ------------------------------------------------------------------ verse / root

def cmd_verse(work, ref):
    c, v = ref.split(':')[:2]
    vs = work.verses.get(f'{c}:{v}')
    if not vs:
        sys.exit(f'no verse {c}:{v}')
    sura = work.suras[int(c)]
    print(f'{sura["rom"]} {c}:{v}')
    print('  '.join(f'{i}={t}' for i, t in enumerate(vs['toks'], 1)))
    print('full:', vs['text'])


def cmd_root(work, root):
    key = fold_root(root)
    for r in work.roots:
        if r['fold'] == key:
            print(open(os.path.join(work.path, 'dossiers', f'{r["n"]:04d}.txt'), encoding='utf-8').read())
            return
    sys.exit(f'root {root} not in scope')


# ------------------------------------------------------------------ check

def quran_groups(work, fold):
    """Required coverage for one root: verb forms, and lemmas of every content word."""
    verb_forms, lemmas = set(), collections.Counter()
    for t in work.tokens:
        for s in t['segs']:
            if not s.get('root') or s['pos'] in GRAMMAR or fold_root(s['root']) != fold or len(fold) > 4:
                continue
            if s['pos'] == 'V':
                verb_forms.add(s.get('form', 'I'))
            else:
                lemmas[s.get('lem') or strip_marks(t['ar'])] += 1
    return verb_forms, lemmas


def entry_forms(e):
    """Every spelling an entry accounts for, folded for comparison."""
    forms = {normalize_arabic(drop_paren(e['w']))}
    for f in ('plural', 'past', 'pres', 'masdar', 'feminine'):
        for part in re.split(r'[\s/،,]+', e.get(f) or ''):
            if part:
                forms.add(normalize_arabic(drop_paren(part)))
                forms.add(normalize_arabic(re.sub('^[يتنأ]', '', drop_paren(part))))
    for a in e.get('also', []):
        forms.add(normalize_arabic(a))
    return forms


def check_entry(work, e, shard_roots, errors, warns, where):
    def err(m):
        errors.append(f'{where}: {m}')

    def warn(m):
        warns.append(f'{where}: {m}')

    missing = [f for f in ('w', 'en', 'type', 'kind', 'src') if not e.get(f)]
    if missing:
        err('missing ' + ', '.join(f'"{f}"' for f in missing))
        return
    w, t, kind = e['w'], e['type'], e['kind']
    if t not in ALLOWED_TYPES:
        err(f'type "{t}" not one of {sorted(ALLOWED_TYPES)}')
    if kind not in ALLOWED_KINDS or kind not in KIND_FOR_TYPE.get(t, set()):
        err(f'kind "{kind}" is not valid for type "{t}" (allowed: {sorted(KIND_FOR_TYPE.get(t, []))})')
    if e['src'] not in ('quran', 'msa'):
        err('src must be "quran" or "msa"')
    if re.search('[A-Za-z0-9]', drop_paren(w)):
        err('w must be Arabic script only (a trailing "(...)" disambiguator is allowed)')
    if not re.search('[ً-ْ]', w):
        err('w must carry tashkeel')
    if re.match('^(ال|الْ|اَل)', drop_paren(w)) and t != 'other':
        warn('w starts with the definite article; headwords are bare')
    if re.search('[ًٌٍ]$', drop_paren(w)) and t != 'other':
        warn('w ends in tanwin; headwords are bare')

    root = e.get('root')
    if root:
        if not re.match('^[ء-ي](-[ء-ي]){1,3}$', root):
            err(f'root "{root}" is not letters joined by "-"')
        elif root != canon_root(root):
            err(f'root "{root}" must spell every hamza as أ: {canon_root(root)}')
        elif fold_root(root) not in shard_roots:
            err(f'root {root} is not in this shard')
        elif t != 'other' and not has_root(w, root):
            if e.get('override'):
                warn(f'override ({e["override"]}): "{w}" lacks the radicals of {root}')
            else:
                err(f'"{w}" does not contain the radicals of {root} (wrong root, or wrong word?). '
                    f'If the word really belongs to this root (a dropped radical, as in فَم from ف-و-ه), '
                    f'add "override": "<why>"')
    elif not e.get('rootless'):
        err('root missing (use "root": null together with "rootless": true only for names, loanwords, numbers)')

    if t == 'verb':
        for f in ('form', 'past', 'pres'):
            if not e.get(f):
                err(f'verb needs "{f}"')
        if e.get('form') not in FORMS:
            err('verb form must be I..X')
        if e.get('past') and normalize_arabic(drop_paren(e['past'])) != normalize_arabic(drop_paren(w)):
            err('verb "w" must equal "past" (the 3rd person masculine singular past)')
        if not (e['en'].startswith('to ') or e['en'].startswith('be ')):
            warn('verb gloss should start with "to "')
        if not e.get('masdar'):
            warn('verb without masdar')
    if t in ('masdar', 'participle') and e.get('form') not in FORMS:
        err(f'{t} needs "form" (the verb form it derives from, I..X)')
    if t == 'noun' and kind in ('noun', 'noun of place', 'noun of instrument', 'noun of instance', 'collective noun'):
        if e.get('gender') not in ('m', 'f'):
            err('noun needs "gender": "m" or "f"')
        if not e.get('plural') and not e.get('noplural'):
            warn('noun without plural (add "plural", or "noplural": true for mass/abstract nouns)')
    if e.get('gender') not in (None, 'm', 'f'):
        err('gender must be "m", "f" or absent')

    en = e['en']
    if re.search('[؀-ۿ]', en):
        err('en must be English')
    if len(en.split()) > 7 or len(en) > 60:
        warn('en is long; give the everyday sense in 1 to 5 words')
    if en.endswith('.'):
        err('en must not end with a full stop')

    q = e.get('q')
    if e['src'] == 'quran' and not q:
        err('Qur\'an-attested entry needs an excerpt "q": "c:v:first-last"')
    if q:
        m = re.match(r'^(\d+):(\d+):(\d+)-(\d+)$', q)
        if not m:
            err(f'q "{q}" must look like 2:255:3-6')
        else:
            c, v, i, j = map(int, m.groups())
            vs = work.verses.get(f'{c}:{v}')
            if not vs:
                err(f'q: no verse {c}:{v}')
            elif not (1 <= i <= j <= len(vs['toks'])):
                err(f'q: verse {c}:{v} has {len(vs["toks"])} words; span {i}-{j} is out of range')
            else:
                toks = vs['toks'][i - 1:j]
                if len(toks) > 14:
                    err('q: excerpt longer than 14 words; pick the shortest span that shows the word')
                if root and root == canon_root(root):
                    roots_in = {work.root_of_token(tk) for tk in toks}
                    if canon_root(root) not in {r for r in roots_in if r}:
                        if e.get('override'):
                            warn(f'override ({e["override"]}): the corpus gives no word of {c}:{v}:{i}-{j} the root {root}')
                        else:
                            err(f'q: no word in {c}:{v}:{i}-{j} has root {root} according to the corpus. If you are sure '
                                f'the verse has the word (the corpus assigns another root), add "override": "<why>"')
                if not e.get('qen'):
                    err('q needs "qen", your own English rendering of exactly that span')
    if e.get('qen') and re.search('[؀-ۿ]', e['qen']):
        err('qen must be English')
    if e.get('qen') and not q:
        err('qen without q')

    for field in ('see',):
        for item in e.get(field, []):
            if not isinstance(item, dict) or not item.get('w') or not item.get('label'):
                err(f'"{field}" items need {{"w", "label"}}')


def cmd_check(work, shard_id):
    shard = json.load(open(os.path.join(work.path, 'shards', f'{shard_id}.json'), encoding='utf-8'))
    path = os.path.join(work.path, 'out', f'{shard_id}.jsonl')
    if not os.path.exists(path):
        sys.exit(f'{path} does not exist yet')
    roots_by_n = {r['n']: r for r in work.roots}
    shard_roots = {roots_by_n[n]['fold'] for n in shard.get('roots', [])}
    errors, warns, entries, skips = [], [], [], []
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as ex:
            errors.append(f'line {ln}: invalid JSON ({ex})')
            continue
        if 'skip' in obj:
            skips.append(obj)
            if not obj.get('why'):
                errors.append(f'line {ln}: skip needs "why"')
            continue
        if shard.get('rootless'):
            obj.setdefault('rootless', True)
        entries.append((ln, obj))

    keys = {}
    bank = {w['key']: w for w in work.existing}
    for ln, e in entries:
        where = f'line {ln} ({e.get("w", "?")})'
        before = len(errors)
        if not shard.get('rootless'):
            check_entry(work, e, shard_roots, errors, warns, where)
        else:
            e['rootless'] = True
            e.setdefault('root', None)
            check_entry(work, e, set(), errors, warns, where)
        if len(errors) > before:
            continue
        k = normalize_arabic(e['w'])
        if k in keys:
            warns.append(f'{where}: same bare spelling as line {keys[k]}; the merge step will add (فعل)/(اسم)/... '
                         f'to the rarer one, nothing to do unless it is the same word twice (then delete one)')
        keys[k] = ln
        if k in bank:
            b = bank[k]
            warns.append(f'{where}: the bank already holds "{b["word_voweled"] or b["word"]}" [{b["word_type"]}] '
                         f'{b["english"]} with this spelling. If it is the same word, delete this line; '
                         f'if it is a different word, keep it (merge adds a disambiguator)')

    # Coverage: every Qur'an verb form and lemma for the shard's roots is either an entry or a stated skip.
    skip_keys = {normalize_arabic(s['skip']) for s in skips} | {s['skip'] for s in skips}
    forms_have = collections.defaultdict(set)
    spell = collections.defaultdict(set)
    for _, e in entries:
        r = fold_root(e.get('root') or '')
        if e.get('type') == 'verb':
            forms_have[r].add(e.get('form'))
        spell[r] |= entry_forms(e)
    uncovered = []
    if shard.get('rootless'):
        have = set().union(*spell.values()) if spell else set()
        for lem, n in rootless_lemmas(work).items():
            if normalize_arabic(lem) not in have and normalize_arabic(lem) not in skip_keys:
                uncovered.append(f'lemma {lem} (x{n})')
    else:
        for fold in sorted(shard_roots):
            vf, lemmas = quran_groups(work, fold)
            for f in sorted(vf, key=lambda x: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].index(x)
                            if x in FORMS else 99):
                if f not in forms_have[fold] and f'V:{f}:{fold}' not in skip_keys and f'V:{f}' not in skip_keys:
                    uncovered.append(f'root {next(r["root"] for r in work.roots if r["fold"] == fold)}: verb form {f}')
            for lem, n in lemmas.items():
                nl = normalize_arabic(lem)
                if nl not in spell[fold] and nl not in skip_keys:
                    uncovered.append(f'root {next(r["root"] for r in work.roots if r["fold"] == fold)}: lemma {lem} (x{n})')
    for u in uncovered:
        errors.append(f'UNCOVERED Qur\'an word, add an entry or {{"skip": "...", "why": "..."}}: {u}')

    print(f'shard {shard_id}: {len(entries)} entries, {len(skips)} skips, {len(errors)} errors, {len(warns)} warnings')
    for m in errors[:80]:
        print('ERROR', m)
    if len(errors) > 80:
        print(f'... and {len(errors) - 80} more errors')
    for m in warns[:25]:
        print('warn ', m)
    if len(warns) > 25:
        print(f'... and {len(warns) - 25} more warnings')
    sys.exit(1 if errors else 0)


def rootless_lemmas(work):
    """Content words with no root: names, loanwords, numbers. More than four radicals is not a root."""
    out = collections.Counter()
    for t in work.tokens:
        for s in t['segs']:
            if s['pos'] in GRAMMAR or (s.get('root') and len(fold_root(s['root'])) <= 4):
                continue
            if s['pos'] in ('N', 'ADJ', 'PN', 'NUM', 'LOC', 'T'):
                out[s.get('lem') or strip_marks(t['ar'])] += 1
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['verse', 'root', 'check'])
    ap.add_argument('arg')
    ap.add_argument('--work', required=True)
    a = ap.parse_args()
    work = Work(a.work)
    {'verse': cmd_verse, 'root': cmd_root, 'check': cmd_check}[a.cmd](work, a.arg)


if __name__ == '__main__':
    main()
