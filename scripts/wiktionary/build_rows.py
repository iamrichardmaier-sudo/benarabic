"""Wiktionary (kaikki.org extract) -> one clean row per Arabic headword."""
import json, re, sys, unicodedata, collections

SRC, OUT = sys.argv[1], sys.argv[2]
POS = {'verb': 'verb', 'noun': 'noun', 'adj': 'adjective', 'name': 'proper_noun', 'adv': 'adverb',
       'pron': 'pronoun', 'prep': 'particle', 'conj': 'particle', 'particle': 'particle', 'det': 'particle',
       'article': 'particle', 'intj': 'interjection', 'num': 'numeral', 'phrase': 'phrase',
       'proverb': 'phrase', 'prep_phrase': 'phrase'}
FORMS = {'form-' + f.lower(): f for f in ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']}
LABELS = ['obsolete', 'archaic', 'dated', 'rare', 'Classical', 'colloquial', 'dialectal', 'figuratively',
          'historical', 'idiomatic', 'slang', 'vulgar', 'derogatory', 'Islam', 'Christianity']
LATE = {'obsolete', 'archaic', 'dated', 'rare'}
DROP = {'no-gloss', 'misspelling'}
ARABIC = re.compile('[؀-ۿ]')
ROOT_CAT = re.compile(r'^Arabic terms belonging to the root (.+)$')

def nfc(s): return unicodedata.normalize('NFC', s).strip()

def cats(e):
    out = set()
    for c in (e.get('categories') or []): out.add(c['name'] if isinstance(c, dict) else c)
    for s in e.get('senses', []):
        for c in (s.get('categories') or []): out.add(c['name'] if isinstance(c, dict) else c)
    return out

def root_of(e):
    found = []
    for t in e.get('etymology_templates') or []:
        if t.get('name') in ('ar-root', 'ar-rootbox'):
            a = t.get('args', {})
            r = a.get('1', '')
            if r and ' ' not in r.strip() and a.get('2'):  # letters given one per arg
                r = ' '.join(a[k] for k in sorted(a, key=lambda k: int(k) if k.isdigit() else 99) if k.isdigit())
            r = r.split(',')[0].strip()
            if r and ARABIC.search(r) and r not in found: found.append(r)
    if len(found) == 1: return found[0]
    if found: return None  # Wiktionary itself is unsure between roots
    roots = sorted({m.group(1) for c in cats(e) if (m := ROOT_CAT.match(c))})
    return roots[0] if len(roots) == 1 else None

def head(e):
    for f in e.get('forms') or []:
        if 'canonical' in (f.get('tags') or []) and ARABIC.search(f['form']): return nfc(f['form']), f.get('tags') or []
    for h in e.get('head_templates') or []:
        x = (h.get('expansion') or '').split(' •')[0].strip()
        if ARABIC.search(x) and ' ' not in x: return nfc(x), []
    return nfc(e['word']), []

def table_forms(e):
    """Forms listed in the headword line (before the declension/conjugation table)."""
    out = []
    for f in e.get('forms') or []:
        t = f.get('tags') or []
        if 'table-tags' in t or 'inflection-template' in t: break
        if ARABIC.search(f['form']) and 'canonical' not in t: out.append((nfc(f['form']), set(t)))
    return out

def clean(g):
    g = re.sub(r'\s+', ' ', g).strip()
    return g[:1].lower() + g[1:] if g[:2] != g[:2].upper() else g

def senses(e):
    real, derived = [], []
    for s in e.get('senses', []):
        tags = set(s.get('tags') or [])
        gl = [clean(g) for g in (s.get('glosses') or []) if g.strip()]
        if not gl or tags & DROP: continue
        is_form = 'form-of' in tags or 'alt-of' in tags or 'form_of' in s or 'alt_of' in s
        if is_form and not (tags & {'participle', 'noun-from-verb'}): continue
        label = [l for l in LABELS if l in tags or l.lower() in tags]
        prefix = f"({', '.join(label)}) " if label else ''
        late = bool(set(label) & LATE)
        # Nested senses: the parent gloss once, then each specific one.
        for g in gl:
            (derived if is_form else real).append((late, prefix + g, tags))
        continue
        (derived if is_form else real).append(item)
    real.sort(key=lambda x: x[0]); derived.sort(key=lambda x: x[0])
    return real, derived

def headline(defs):
    for d in defs:
        x = re.sub(r'^\([^)]*\)\s*', '', d)
        if ':' in x and re.search(r'participle of|verbal noun of', x): x = x.split(':', 1)[1]
        elif re.search(r'participle of|verbal noun of', x):
            m = re.search(r'\(([^()]*)\)\s*$', x)
            if m and not re.search(r'form [IVX]+', m.group(1)): return (('verbal noun: ' if 'verbal noun' in x else 'participle: ') + m.group(1))[:80]
            continue
        x = re.sub(r'\s*\([^)]*\)', '', x).strip(' ;,.')
        parts = [p.strip() for p in re.split(r'[;,]', x) if p.strip()]
        if parts: return ', '.join(parts[:3])[:80]
    return None

groups = collections.OrderedDict(); stats = collections.Counter()
derived_by_root = collections.defaultdict(set)  # root -> words its entries list as derived/related
TASHKEEL = re.compile('[\u064b-\u065f\u0670\u0640]')
def bare(w): return TASHKEEL.sub('', w or '')
for line in open(SRC, encoding='utf-8'):
    e = json.loads(line); stats['entries'] += 1
    pos = POS.get(e.get('pos'))
    if not pos: stats['skip_pos'] += 1; continue
    real, derived = senses(e)
    if not real and not derived: stats['skip_no_sense'] += 1; continue
    lemma, ctags = head(e)
    if not ARABIC.search(lemma): stats['skip_nonarabic'] += 1; continue
    r = root_of(e)
    root = '-'.join(r.split()) if r else None
    alltags = set().union(*[t for _, _, t in real + derived])
    form = next((FORMS[t] for t in FORMS if t in alltags), None)
    if pos == 'verb':
        for h in e.get('head_templates') or []:
            if h.get('name') == 'ar-verb':
                m = re.match(r'^(X|IX|VIII|VII|VI|V|IV|III|II|I)(?![IVXq])', h.get('args', {}).get('1', ''))
                if m: form = m.group(1)
    kind = pos
    if pos in ('noun', 'adjective'):
        if any('participle' in t for _, _, t in derived): kind = 'participle'
        elif any('noun-from-verb' in t for _, _, t in derived): kind = 'masdar'
    tf = table_forms(e)
    details = {}
    pl = [f for f, t in tf if 'plural' in t and 'feminine' not in t]
    if pl: details['plurals'] = list(dict.fromkeys(pl))[:4]
    fem = [f for f, t in tf if 'feminine' in t and 'plural' not in t]
    if fem and pos == 'adj' or (fem and kind == 'participle'): details['feminine'] = fem[0]
    g = 'f' if 'feminine' in ctags else 'm' if 'masculine' in ctags else None
    if g and pos == 'noun': details['gender'] = g
    if pos == 'verb':
        for key, want in (('nonPast', {'non-past'}), ('masdar', {'noun-from-verb'})):
            v = [f for f, t in tf if want <= t]
            if v: details[key] = v[0]
        ap = [f for f, t in tf if {'active', 'participle'} <= t]; pp = [f for f, t in tf if {'passive', 'participle'} <= t]
        if ap: details['activeParticiple'] = ap[0]
        if pp: details['passiveParticiple'] = pp[0]
    defs = [t for _, t, _ in real] + [t for _, t, _ in derived]
    of = [nfc(fo['word']) for s_ in e.get('senses', []) for fo in (s_.get('form_of') or [])
          if {'participle', 'noun-from-verb'} & set(s_.get('tags') or [])]
    if root:
        for rel in (e.get('derived') or []):
            w = rel.get('word') if isinstance(rel, dict) else None
            if w and ARABIC.search(w): derived_by_root[root].add(nfc(w))
    k = (lemma, root, 'nominal' if kind in ('noun', 'adjective', 'participle', 'masdar') else kind)
    if k in groups:
        gr = groups[k]; stats['merged'] += 1
        gr['real'] += [t for _, t, _ in real if t not in gr['real']]
        gr['derived'] += [t for _, t, _ in derived if t not in gr['derived']]
        for kk, vv in details.items(): gr['details'].setdefault(kk, vv)
        gr['verb_form'] = gr['verb_form'] or form
        rank = ['participle', 'masdar', 'noun', 'adjective']
        if kind in rank and gr['pos'] in rank and rank.index(kind) < rank.index(gr['pos']): gr['pos'] = kind
    else:
        groups[k] = {'lemma': lemma, 'root': root, 'pos': kind, 'verb_form': form,
                     'real': list(dict.fromkeys(t for _, t, _ in real)), 'derived': list(dict.fromkeys(t for _, t, _ in derived)),
                     'details': details, 'page': e['word'], 'of': of}
    if k in groups and of: groups[k]['of'] = list(dict.fromkeys(groups[k].get('of', []) + of))
for gr in groups.values():
    gr['definitions'] = gr.pop('real') + gr.pop('derived')
# Roots: pass them along Wiktionary's own links, only where the answer is unambiguous.
by_lemma = collections.defaultdict(set)
for gr in groups.values():
    if gr['root']: by_lemma[gr['lemma']].add(gr['root'])
cand = collections.defaultdict(set)
for r_, words in derived_by_root.items():
    for w in words: cand[w].add(r_)
verbs = {}
for gr in groups.values():
    if gr['pos'] == 'verb': verbs.setdefault(gr['lemma'], []).append(gr)
filled = collections.Counter()
for gr in list(groups.values()):
    if gr['root']: continue
    via_of = set().union(*[by_lemma.get(o, set()) for o in gr.get('of', [])]) if gr.get('of') else set()
    if len(via_of) == 1: gr['root'] = next(iter(via_of)); filled['of'] += 1; continue
    c = cand.get(gr['lemma'], set())
    if len(c) == 1 and gr['pos'] in ('noun', 'adjective', 'masdar', 'participle', 'verb'): gr['root'] = next(iter(c)); filled['derived'] += 1
CONTENT = ('noun', 'adjective', 'masdar', 'participle', 'verb')
# The same headword spelled the same way under another part of speech (جَمِيل the
# adjective and جَمِيل the name) shares its root when there is only one candidate.
by_lemma = collections.defaultdict(set)
for gr in groups.values():
    if gr['root']: by_lemma[gr['lemma']].add(gr['root'])
for gr in groups.values():
    if not gr['root'] and gr['pos'] in CONTENT and len(by_lemma.get(gr['lemma'], ())) == 1:
        gr['root'] = next(iter(by_lemma[gr['lemma']])); filled['same_lemma'] += 1
HAMZA = str.maketrans('أإؤئآ', 'ءءءءء')
def verb_root(lemma, form):
    w = bare(lemma).translate(HAMZA)
    strip = {'II': (0, ''), 'III': (0, 'ا@1'), 'IV': (1, ''), 'V': (1, ''), 'VI': (1, 'ا@1'),
             'VII': (2, ''), 'VIII': (1, 'ت@1'), 'IX': (1, ''), 'X': (3, '')}
    if form not in strip: return None
    n, mid = strip[form]
    if form == 'IV' and not w.startswith('ء'): return None
    if form in ('V', 'VI') and not w.startswith('ت'): return None
    if form == 'VII' and not w.startswith('ان'): return None
    if form in ('VIII', 'IX') and not w.startswith('ا'): return None
    if form == 'X' and not w.startswith('است'): return None
    w = w[n:]
    if mid:
        ch, at = mid.split('@'); at = int(at)
        if len(w) <= at or w[at] != ch: return None
        w = w[:at] + w[at + 1:]
    if len(w) != 3 or set(w) & set('اىويء'): return None  # weak/hamza roots are ambiguous on the surface
    return '-'.join(w)
for gr in groups.values():
    if not gr['root'] and gr['pos'] == 'verb' and gr['verb_form']:
        r = verb_root(gr['lemma'], gr['verb_form'])
        if r: gr['root'] = r; filled['verb_pattern'] += 1
# Last resort, high precision only: a word whose consonants are exactly a known
# root (بيت -> ب-ي-ت), or م + exactly a known root on a mim-pattern (مَوْقِع).
known = collections.defaultdict(set)
for gr in groups.values():
    if gr['root'] and len(gr['root'].split('-')) == 3: known[gr['root'].replace('-', '')].add(gr['root'])
for gr in groups.values():
    if gr['root'] or ' ' in gr['lemma'] or gr['pos'] not in CONTENT: continue
    sk = bare(gr['lemma']).replace('ة', '')
    sk = sk[2:] if sk.startswith('ال') else sk
    hit = known.get(sk) or (known.get(sk[1:]) if sk[:1] == 'م' and len(sk) == 4 and gr['lemma'][:2] in ('مَ', 'مُ', 'مِ') else None)
    if hit and len(hit) == 1: gr['root'] = next(iter(hit)); filled['skeleton'] += 1
stats.update({'root_from_' + k: v for k, v in filled.items()})
# Verbal nouns and participles that only point at their verb borrow its form and meaning.
for gr in groups.values():
    for o in gr.get('of', []):
        v = verbs.get(o)
        if not v: continue
        v = v[0]
        gr['verb_form'] = gr['verb_form'] or v['verb_form']
        vh = headline(v['definitions'])
        if vh:
            gr['definitions'] = [d + f' ({vh})' if d.startswith(('verbal noun of', 'active participle of', 'passive participle of')) and o in d and ':' not in d else d for d in gr['definitions']]
    gr.pop('of', None)
# Filling roots can make two groups land on the same (lemma, root, pos): fold them.
final = collections.OrderedDict()
for gr in groups.values():
    k = (gr['lemma'], gr['root'], gr['pos'])
    if k not in final: final[k] = gr; continue
    f = final[k]; stats['merged_after_roots'] += 1
    f['definitions'] += [d for d in gr['definitions'] if d not in f['definitions']]
    for kk, vv in gr['details'].items(): f['details'].setdefault(kk, vv)
    f['verb_form'] = f['verb_form'] or gr['verb_form']
groups = final
rows = []
for gr in groups.values():
    gr['headline'] = headline(gr['definitions'])
    if not gr['headline']: stats['no_headline'] += 1
    rows.append(gr)
with open(OUT, 'w', encoding='utf-8') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
stats['rows'] = len(rows); stats['with_root'] = sum(1 for r in rows if r['root'])
stats.update(collections.Counter('pos:' + r['pos'] for r in rows))
print(dict(stats))
