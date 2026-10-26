#!/usr/bin/env python3
"""
Build Wazn's dictionary data from Wiktionary.

Wiktionary's Arabic entries (CC BY-SA 4.0) are published as a machine-readable
dump by kaikki.org. This script reduces that ~870 MB dump to the few fields the
word pages use, and writes one compact file that the page generator reads at
build time, so the Netlify build needs no network and no database login.

    # 1. download the dump (once, ~870 MB, not committed)
    curl -o /tmp/ar.jsonl https://kaikki.org/dictionary/Arabic/kaikki.org-dictionary-Arabic.jsonl
    # 2. read each page's root from the full Wiktionary dump (~1.6 GB, not committed)
    curl -o /tmp/enwiktionary.xml.bz2 https://dumps.wikimedia.org/enwiktionary/latest/enwiktionary-latest-pages-articles.xml.bz2
    python3 scripts/seo/wiktionary/build.py roots /tmp/ar.jsonl /tmp/enwiktionary.xml.bz2
    # 3. fetch the frequency list (once, not committed)
    curl -o /tmp/ar_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ar/ar_50k.txt
    # 4. write scripts/seo/data/dictionary.json.gz
    python3 scripts/seo/wiktionary/build.py extract /tmp/ar.jsonl /tmp/ar_50k.txt

Why roots need a second step: the dump only records a word's root when a sense
happens to carry the "belonging to the root" category. Wiktionary's pages state
it reliably in an {{ar-rootbox}} template per etymology, so we read those from
Wikimedia's full page dump (the live API is rate-limited far too tightly for
~20,000 pages) and store the result in scripts/seo/data/wiktionary-roots.json.

Every root is checked against the word's own consonants before it is used
(see root_fits_word), so a template placed under the wrong etymology on a
Wiktionary page cannot attach a word to an unrelated root.
"""

import gzip
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
ROOTS_CACHE = os.path.join(DATA, 'wiktionary-roots.json')
OUT = os.path.join(DATA, 'dictionary.json.gz')

# ----------------------------------------------------------------- arabic text

DIACRITICS = re.compile('[ً-ْٰـٓ-ٟۖ-ۭ]')


def strip_diacritics(s):
    return DIACRITICS.sub('', s)


def normalize(s):
    """Mirrors normalizeArabic() in src/lib/arabic-normalize.ts."""
    s = strip_diacritics(s)
    s = re.sub('[أإآٱ]', 'ا', s)
    return s.replace('ى', 'ي').replace('ة', 'ه').strip()


HAMZA_SEATS = set('ءأإآؤئٱا')
WEAK = set('ويا') | HAMZA_SEATS | {'ى'}


def root_fits_word(root, word):
    """True if the root's strong letters appear in the word, in order.

    Weak letters (و ي) and hamza may vanish or change shape (قال from ق-و-ل,
    اتخذ from أ-خ-ذ), and a repeated radical may be written once with a
    shadda (مد from م-د-د), so those are skipped. Every other root letter
    must be present. This rejects a root attached to an unrelated word while
    accepting the irregular-looking correct ones.
    """
    w = strip_diacritics(word)
    strong = []
    for r in root:
        if r in WEAK or r == 'ء' or (strong and strong[-1] == r):
            continue
        strong.append(r)
    i = 0
    for r in strong:
        j = w.find(r, i)
        if j == -1:
            return False
        i = j + 1
    return True


def in_order(root, word):
    w = strip_diacritics(word)
    i = 0
    for r in root:
        options = HAMZA_SEATS | {'ء'} if r == 'ء' else {r}
        j = min((w.find(c, i) for c in options if w.find(c, i) != -1), default=-1)
        if j == -1:
            # Present, but earlier in the word: the order is wrong.
            if any(c in w for c in options):
                return False
            if r in WEAK or r == 'ء':
                continue
            return False
        i = j + 1
    return True


def best_root(candidates, word, forms):
    """Pick the candidate root that fits the word and best matches its forms.

    Wiktionary pages often hold several words spelled alike (قَالَ "to say",
    root ق-و-ل, and قَالَ "to nap", root ق-ي-ل). When more than one root is on
    offer, the one whose letters show up most in this word's own forms wins:
    يَقُولُ, قَوْل and مَقُول all carry the و. Ties keep the source's order.
    (A weak letter alone can't rule a root out: و-roots often surface as ي,
    as in يَسْتَجِيبُ from ج-و-ب.)"""
    text = ''.join(strip_diacritics(f) for f in forms)
    best, best_score = None, -1
    for r in candidates:
        # The letters may show only in another form of the same word: the ه
        # of م-و-ه is in the plural مِيَاه, not in مَاء.
        if not any(root_fits_word(r, f) for f in [word] + list(forms)):
            continue
        # Letters found in the forms, then (tie-break) whether the root's
        # letters run in the same order as the word's: أدب is ء-د-ب, not د-ء-ب.
        score = sum(1 for x in set(r) if x in text) + (0.5 if in_order(r, word) else 0)
        if score > best_score:
            best, best_score = r, score
    return best


def parse_root(text):
    """'ك ت ب' / 'ك-ت-ب' / 'كتب' -> ('ك','ت','ب') or None."""
    t = strip_diacritics(text).strip()
    parts = [p for p in re.split(r'[\s\-|]+', t) if p]
    if len(parts) == 1 and 3 <= len(parts[0]) <= 4:
        parts = list(parts[0])
    if not (3 <= len(parts) <= 4) or any(len(p) != 1 for p in parts):
        return None
    if not all('ء' <= p <= 'ي' for p in parts):
        return None
    return tuple(parts)


# ---------------------------------------------------------- lexeme selection

SKIP_HEADS = {'ar-verb form', 'ar-noun form', 'ar-adj form'}
KEEP_POS = {'noun', 'verb', 'adj', 'adv', 'num', 'prep', 'conj', 'pron',
            'intj', 'particle', 'det'}
NON_DEFINITION_TAGS = {'form-of', 'alt-of', 'error-lua-exec', 'no-gloss',
                       'misspelling'}


def head_name(d):
    h = d.get('head_templates') or []
    return h[0].get('name', '') if h else ''


def is_definition(s):
    if not s.get('glosses'):
        return False
    return not (set(s.get('tags') or []) & NON_DEFINITION_TAGS)


def is_masdar_sense(s):
    t = set(s.get('tags') or [])
    return 'noun-from-verb' in t and 'form-of' in t


def selectable(d):
    if d.get('lang_code') != 'ar' or d.get('pos') not in KEEP_POS:
        return False
    if head_name(d) in SKIP_HEADS:
        return False
    senses = d.get('senses') or []
    # Keep real definitions, and also bare verbal nouns ("verbal noun of
    # اِسْتَقْبَلَ"): they are among the most-searched words and the page can
    # define them through their verb.
    return any(is_definition(s) or is_masdar_sense(s) for s in senses)


def iter_dump(path):
    with open(path, encoding='utf8') as f:
        for line in f:
            try:
                yield json.loads(line)
            except ValueError:
                continue


# ------------------------------------------------------------------ roots

def wikitext_roots(text, debug=None):
    """Return {etymology_number_or_0: [root, ...]} from a page's Arabic section.

    Key 0 holds roots stated before any numbered etymology, which apply to the
    whole page. Only {{ar-rootbox}} counts, plus {{ar-root}} written as the
    etymology itself ("From the root {{ar-root|...}}"). An {{ar-root}} met in
    passing ("compare", "related to", a cognate) names some other word's root
    and is ignored."""
    a = re.search(r'^==\s*Arabic\s*==\s*$', text, re.M)
    if not a:
        return {}
    rest = text[a.end():]
    b = re.search(r'^==[^=].*?==\s*$', rest, re.M)
    section = rest[:b.start()] if b else rest
    out = {}
    mentions = []  # roots only mentioned in passing, recorded under key 'mentioned'
    current = 0
    for line in section.split('\n'):
        m = re.match(r'^===\s*Etymology\s*(\d*)\s*===', line)
        if m:
            current = int(m.group(1)) if m.group(1) else 0
            continue
        for t in re.finditer(r'\{\{\s*(ar-rootbox|ar-root)\s*\|([^}]*)\}\}', line):
            before = line[:t.start()].lower()
            # nocat=1 is Wiktionary's own marker for "mentioned, not this
            # word's root" (e.g. a speculative derivation in an etymology).
            if 'nocat' in t.group(2):
                if debug is not None:
                    debug.append(f'skip [{current}] {line[:200]}')
                mentions.append(t.group(2))
                continue
            if t.group(1) == 'ar-root' and (
                    re.search(r'compar|cognate|related|see also|cf\.|akin|influenc|contaminat|confus'
                              r'|extension|derivation|possibl|perhaps|presumabl|maybe|might|\bmay\b'
                              r'|probabl|uncertain|doubtful|rather than|instead of|not from', before)
                    or before.strip().startswith(('*', '#', ':'))):
                if debug is not None:
                    debug.append(f'skip [{current}] {line[:200]}')
                mentions.append(t.group(2))
                continue
            args = [x for x in t.group(2).split('|') if '=' not in x]
            r = parse_root(' '.join(args))
            if debug is not None:
                debug.append(f'take [{current}] {line[:200]}')
            if r and r not in out.setdefault(current, []):
                out[current].append(r)
    # Mentioned roots still put the page in Wiktionary's "belonging to the
    # root" category, which the dump copies onto the entry; remember them so
    # that category isn't mistaken for the word's root.
    for arg in mentions:
        r = parse_root(' '.join(x for x in arg.split('|') if '=' not in x))
        if r and not any(r in v for v in out.values()):
            out.setdefault('mentioned', [])
            if r not in out['mentioned']:
                out['mentioned'].append(r)
    return out


def iter_wikitext_pages(xml_bz2, wanted):
    """Stream (title, wikitext) for wanted main-namespace pages in the dump."""
    import bz2
    import xml.etree.ElementTree as ET
    with bz2.open(xml_bz2, 'rb') as f:
        title = ns = None
        for _, el in ET.iterparse(f, events=('end',)):
            tag = el.tag.rsplit('}', 1)[-1]
            if tag == 'title':
                title = el.text
            elif tag == 'ns':
                ns = el.text
            elif tag == 'text':
                if ns == '0' and title in wanted and el.text:
                    yield title, el.text
            elif tag == 'page':
                el.clear()
                title = ns = None


def cmd_roots(dump, xml_bz2):
    titles = {d['word'] for d in iter_dump(dump) if selectable(d)}
    print(f'{len(titles)} pages to read')
    cache = {}
    debug_titles = set(os.environ.get('ROOT_DEBUG', '').split(',')) - {''}
    for title, text in iter_wikitext_pages(xml_bz2, titles):
        dbg = [] if title in debug_titles else None
        roots = wikitext_roots(text, dbg)
        if dbg is not None:
            print(f'## {title}', *dbg, sep='\n  ')
        if roots:
            cache[title] = {str(k): ['-'.join(r) for r in v] for k, v in roots.items()}
    save_json(ROOTS_CACHE, cache)
    print(f'roots found on {len(cache)} of {len(titles)} pages → {ROOTS_CACHE}')


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False, sort_keys=True, indent=0)


# ---------------------------------------------------------------- extract

FORM_TAGS = {f'form-{r.lower()}': r for r in
             ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
              'XI', 'XII', 'XIII', 'XIV', 'XV', 'Iq', 'IIq', 'IIIq', 'IVq']}

# Sense labels worth showing to a learner, in display form.
LABELS = {
    'transitive': 'transitive', 'intransitive': 'intransitive',
    'ditransitive': 'ditransitive', 'ambitransitive': 'transitive or intransitive',
    'colloquial': 'colloquial', 'informal': 'informal', 'formal': 'formal',
    'literary': 'literary', 'poetic': 'poetic', 'archaic': 'archaic',
    'obsolete': 'obsolete', 'dated': 'dated', 'rare': 'rare', 'uncommon': 'uncommon',
    'historical': 'historical', 'figuratively': 'figurative', 'idiomatic': 'idiomatic',
    'derogatory': 'derogatory', 'offensive': 'offensive', 'slur': 'slur',
    'vulgar': 'vulgar', 'neologism': 'neologism', 'Internet': 'Internet',
    'Classical': 'Classical Arabic', 'Modern': None, 'Standard': None,
    'Egypt': 'Egypt', 'Levantine': 'Levantine', 'Iraq': 'Iraq', 'Gulf': 'Gulf',
    'Morocco': 'Morocco', 'Yemen': 'Yemen', 'Hejazi': 'Hejazi',
    'al-Andalus': 'al-Andalus', 'dialectal': 'dialectal', 'regional': 'regional',
    'reciprocal': 'reciprocal', 'reflexive': 'reflexive', 'causative': 'causative',
    'stative': 'stative', 'uncountable': 'uncountable', 'collective': 'collective',
    'plural-only': 'plural only', 'in-plural': 'in the plural',
    'with-definite-article': 'with the definite article', 'Islam': 'Islam',
    'Christianity': 'Christianity', 'Judaism': 'Judaism',
}

PERSONS = [  # display order, key → tags it must carry
    ('1s', {'first-person', 'singular'}),
    ('2ms', {'second-person', 'masculine', 'singular'}),
    ('2fs', {'second-person', 'feminine', 'singular'}),
    ('3ms', {'third-person', 'masculine', 'singular'}),
    ('3fs', {'third-person', 'feminine', 'singular'}),
    ('2d', {'second-person', 'dual'}),
    ('3md', {'third-person', 'masculine', 'dual'}),
    ('3fd', {'third-person', 'feminine', 'dual'}),
    ('1p', {'first-person', 'plural'}),
    ('2mp', {'second-person', 'masculine', 'plural'}),
    ('2fp', {'second-person', 'feminine', 'plural'}),
    ('3mp', {'third-person', 'masculine', 'plural'}),
    ('3fp', {'third-person', 'feminine', 'plural'}),
]
MOODS = {
    'past': {'past', 'perfective', 'active'},
    'present': {'non-past', 'imperfective', 'indicative', 'active'},
    'subjunctive': {'subjunctive', 'active'},
    'jussive': {'jussive', 'active'},
    'imperative': {'imperative', 'active'},
}


def person_key(tags):
    for key, need in PERSONS:
        if need <= tags:
            return key
    return None


def head_forms(d):
    """Forms listed in the headword line (before the inflection tables)."""
    out = []
    for f in d.get('forms') or []:
        tags = f.get('tags') or []
        if 'table-tags' in tags or 'inflection-template' in tags:
            break
        out.append((f.get('form', ''), set(tags)))
    return out


def table_forms(d):
    started = False
    for f in d.get('forms') or []:
        tags = set(f.get('tags') or [])
        if 'table-tags' in tags or 'inflection-template' in tags:
            started = True
            continue
        if started:
            yield f.get('form', ''), tags


def is_arabic(s):
    return bool(s) and bool(re.search('[ء-ي]', s)) and not re.search('[A-Za-z]', s)


def arabic_form(f):
    f = re.sub(r'\s*\([^)]*\)\s*$', '', f or '').strip()
    return f if is_arabic(f) else ''


def uniq(seq):
    seen, out = set(), []
    for x in seq:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def clean_gloss(g):
    g = re.sub(r'\s+', ' ', g).strip()
    return g


def build_senses(d):
    """Wiktionary nests sub-senses by repeating the parent gloss:
    ['to write, to inscribe', 'to draw (figures)']. Group consecutive senses
    that share a parent into one numbered sense with lettered sub-senses,
    the way a printed dictionary lays them out."""
    groups = []
    for s in d.get('senses') or []:
        if not is_definition(s):
            continue
        glosses = [clean_gloss(g) for g in s['glosses'] if g.strip()]
        if not glosses:
            continue
        labels = uniq(LABELS[t] for t in (s.get('tags') or []) if LABELS.get(t))
        examples = []
        for e in s.get('examples') or []:
            ar = (e.get('text') or '').strip()
            en = (e.get('english') or e.get('translation') or '').strip()
            # Arabic only: skip examples with a transliteration or a
            # "(var. …)" note mixed into the Arabic line.
            if not ar or not en or re.search('[A-Za-z]', ar) or len(ar) > 260:
                continue
            ex = {'ar': ar, 'en': en}
            if e.get('ref'):
                ex['ref'] = e['ref'][:160]
            examples.append(ex)
        parent = glosses[0] if len(glosses) > 1 else None
        leaf = glosses[-1]
        if parent and groups and groups[-1]['head'] == parent:
            groups[-1]['subs'].append({'g': leaf, 'labels': labels, 'ex': examples[:3]})
        elif parent:
            groups.append({'head': parent, 'labels': [],
                           'subs': [{'g': leaf, 'labels': labels, 'ex': examples[:3]}]})
        else:
            groups.append({'head': leaf, 'labels': labels, 'subs': [], 'ex': examples[:3]})
    # Drop empty containers and trim to keep pages readable.
    for g in groups:
        if not g['subs']:
            g.pop('subs')
        elif 'ex' in g:
            g.pop('ex')
    return groups[:24]


def masdar_of(d):
    """For a bare verbal-noun entry, the verb(s) it is the verbal noun of."""
    out = []
    for s in d.get('senses') or []:
        if is_masdar_sense(s):
            for fo in s.get('form_of') or []:
                if fo.get('word'):
                    out.append(fo['word'])
    return uniq(out)


def entry_roots(d, cache):
    """Candidate roots for this entry, most trustworthy first.

    1. The {{ar-rootbox}} in this entry's own etymology section (or one placed
       before any numbered etymology, which covers the whole page). This is
       exact: on the page for صار, etymology 1 is ص-ي-ر "to become",
       2 is ص-و-ر, 3 is ص-ر-ي.
    2. Otherwise the "belonging to the root" category, but only when it names a
       single root: in the dump these categories leak between the different
       words on one page, so two of them means we can't tell which is ours.
    Roots from a different etymology on the same page are never borrowed:
    letters alone can't tell دَوَّنَ (د-و-ن) from دُون (د-ن-و)."""
    page = cache.get(d['word'], {})
    n = str(d.get('etymology_number') or 0).split('.')[0]
    cats = []
    for s in d.get('senses') or []:
        for c in s.get('categories') or []:
            name = c if isinstance(c, str) else c.get('name', '')
            m = re.search(r'belonging to the root (.+)$', name)
            if m:
                r = parse_root(m.group(1))
                if r:
                    cats.append(r)
    mentioned = {tuple(r.split('-')) for r in page.get('mentioned', [])}
    cats = [c for c in uniq(cats) if c not in mentioned]
    own = []
    for key in (n, '0'):
        for r in page.get(key, []):
            own.append(tuple(r.split('-')))
    own = uniq(own)
    if own:
        # Two roots in one etymology (مَحَلّ: ح-ل-ل and م-ح-ل): prefer the
        # one this word's own category confirms.
        confirmed = [r for r in own if r in cats]
        return confirmed or own
    return cats if len(cats) == 1 else []


def surface(s):
    """Spelling as it appears in running text: vowels dropped, letters kept.

    Deliberately stricter than normalize(): أ/إ/آ/ا and ى/ي stay distinct,
    otherwise آنَ "to be time" would collect every أن and ان."""
    return strip_diacritics(s).replace('ٱ', 'ا').strip()


def load_freq(path):
    freq = {}
    if not path or not os.path.exists(path):
        return freq
    with open(path, encoding='utf8') as f:
        for line in f:
            parts = line.rstrip('\n').rsplit(' ', 1)
            if len(parts) == 2 and parts[1].isdigit():
                k = surface(parts[0])
                freq[k] = freq.get(k, 0) + int(parts[1])
    return freq


FUNCTION_POS = {'prep', 'pron', 'conj', 'particle', 'det', 'intj'}


def vocal_key(s):
    """Mirrors vocalKey() in scripts/seo/lib/text.mjs."""
    import unicodedata
    s = unicodedata.normalize('NFC', s or '').replace('ٱ', 'ا').replace('\u0670', 'ا')
    s = re.sub('[\u0652\u0640]', '', s)
    s = re.sub('([\u064B-\u0650])\u0651', '\u0651\\1', s)
    return s.strip()


def corpus_lemma_counts(repo):
    """How often each lemma occurs in the app's tagged Bible text.

    The tagging (STEPBible) says which word each occurrence is, so it can tell
    رَجُل "man" from رَجِل "pedestrian", which subtitles cannot. Only word forms
    that the tags tie to a single lemma are counted."""
    try:
        with open(os.path.join(repo, 'public/bible/word-skeleton-index.json'), encoding='utf8') as f:
            index = json.load(f)
        with open(os.path.join(repo, 'scripts/bible/bible-frequencies.json'), encoding='utf8') as f:
            surface_counts = json.load(f)
    except OSError:
        return {}
    counts = {}
    for surf, n in surface_counts.items():
        senses = index.get(normalize(surf)) or []
        lemmas = {(x.get('lemma'), x.get('root')) for x in senses if x.get('root')}
        if len(lemmas) == 1:
            lemma, root = lemmas.pop()
            key = (vocal_key(lemma), root)
            counts[key] = counts.get(key, 0) + n
    return counts

# Everyday spellings of function words that drop the hamza or the alif
# maqsura, as subtitles usually do (لان for لأن, الى for إلى).
INFORMAL_FUNCTION_WORDS = set('''
ان انا انت انتي انتم انتما انتن انه انها انهم انك انني اني اننا اذا الى او اي ايه اين اذن
لان لانه لانها لانك لاني اما الا انما ايضا اول اخر على علي عليه عليك عليها الي اليه اليك
هو هي هم هن هما نحن هذا هذه ذلك تلك هنا هناك ما ماذا لماذا متى كيف كم من في عن مع لا لم لن
قد كل بعد قبل حتى عند منذ بين ثم بل لكن
'''.split())
CLITICS = ('و', 'ف', 'ب', 'ل', 'ك')


def assign_frequencies(entries, spellings, freq):
    """Credit each counted spelling to the words it can be.

    A spelling shared with a preposition, pronoun or particle is skipped for
    everyone (those little words dominate: على is almost never the verb
    عَلَا). Any other shared spelling is split between its words."""
    owners = {}
    for i, sp in enumerate(spellings):
        for s in sp:
            owners.setdefault(s, []).append(i)
    function_words = set(INFORMAL_FUNCTION_WORDS)
    for e, sp in zip(entries, spellings):
        # Adverbs count here too: أَيْضًا "also" must not feed أَيْض "metabolism".
        if e['pos'] in FUNCTION_POS or e['pos'] == 'adv':
            function_words |= sp
    # و/ف/ب/ل/ك + a function word (وهن "and they", لان "because") is still
    # a function word, however much it looks like a verb.
    function_words |= {c + f for c in CLITICS for f in list(function_words)}
    # Shared spellings are split in proportion to each word's evidence,
    # re-estimated a few times: a word with plenty of spellings of its own
    # (كَانَ: يكون، كانت، كانوا …) earns most of a shared one (كنت), while a
    # rare word that merely shares it (كَنَّ "to cover") keeps little. The
    # first round uses how much Wiktionary says about each word (the everyday
    # word has many senses, a rare homograph few); every round also weighs in
    # how often the tagged corpus uses each one.
    corpus = corpus_lemma_counts(os.path.join(HERE, '..', '..', '..'))
    norm_root = lambda r: (r or '').replace('أ', 'ء').replace('إ', 'ء').replace('آ', 'ء')
    corpus = {(k, norm_root(r)): n for (k, r), n in corpus.items()}
    prior = [1 + corpus.get((vocal_key(e['w']), norm_root(e.get('root'))), 0) for e in entries]
    weight = [(1 + sum(1 + len(x.get('subs', [])) for x in e.get('senses', []))) * p
              for e, p in zip(entries, prior)]
    shared = []
    totals = [0.0] * len(entries)
    for s, count in freq.items():
        ids = owners.get(s)
        if not ids or s in function_words:
            continue
        if len(ids) == 1:
            totals[ids[0]] += count
        else:
            shared.append((ids, count))
    unique = totals[:]
    for _ in range(5):
        totals = unique[:]
        for ids, count in shared:
            ws = [weight[i] for i in ids]
            tw = sum(ws)
            for i, w in zip(ids, ws):
                totals[i] += count * w / tw
        weight = [(1 + t) * p for t, p in zip(totals, prior)]
    for e, t in zip(entries, totals):
        e['freq'] = int(round(t))


def cmd_extract(dump, freq_path):
    cache = {}
    if os.path.exists(ROOTS_CACHE):
        with open(ROOTS_CACHE, encoding='utf8') as f:
            cache = json.load(f)
    freq = load_freq(freq_path)
    entries = []
    spellings = []
    stats = {'selected': 0, 'with_root': 0, 'root_rejected': 0, 'no_canonical': 0}

    for d in iter_dump(dump):
        if not selectable(d):
            continue
        hf = head_forms(d)
        canon = next((f for f, t in hf if 'canonical' in t), None) or d['word']
        if not is_arabic(canon):
            stats['no_canonical'] += 1
            continue
        stats['selected'] += 1
        tags_canon = next((t for f, t in hf if 'canonical' in t), set())
        roman = next((f for f, t in hf if 'romanization' in t), '')

        e = {
            'w': canon,
            'page': d['word'],
            'et': str(d.get('etymology_number') or 0),
            'pos': d['pos'],
            'rom': roman,
            'senses': build_senses(d),
        }
        if not e['senses']:
            e.pop('senses')
        form = next((FORM_TAGS[t] for t in tags_canon if t in FORM_TAGS), None)
        if form:
            e['form'] = form
        if 'masculine' in tags_canon and 'feminine' not in tags_canon:
            e['gender'] = 'm'
        elif 'feminine' in tags_canon and 'masculine' not in tags_canon:
            e['gender'] = 'f'

        # Headword-line forms: plurals, feminine, elative, singulative …
        pl = [f for f, t in hf if 'plural' in t and 'canonical' not in t
              and not ({'feminine', 'masculine'} & t and d['pos'] == 'adj')]
        if d['pos'] == 'adj':
            e['fem'] = uniq(f for f, t in hf if t == {'feminine'})
            e['mpl'] = uniq(f for f, t in hf if t == {'masculine', 'plural'})
            e['fpl'] = uniq(f for f, t in hf if t == {'feminine', 'plural'})
            e['elative'] = uniq(f for f, t in hf if 'elative' in t)
            e['pl'] = uniq(f for f, t in hf if t in ({'plural'}, {'common', 'plural'}))
        else:
            e['pl'] = uniq(f for f in pl if is_arabic(f))
            e['fem'] = uniq(f for f, t in hf if t == {'feminine'})
        e['sing'] = uniq(f for f, t in hf if 'singulative' in t)
        e['coll'] = uniq(f for f, t in hf if 'collective' in t and 'canonical' not in t)

        if d['pos'] == 'verb':
            e['present'] = uniq(f for f, t in hf if 'non-past' in t)
            e['masdar'] = uniq(f for f, t in hf if 'noun-from-verb' in t)
            tf = list(table_forms(d))
            e['ap'] = uniq(f for f, t in tf if t == {'active', 'participle'})
            e['pp'] = uniq(f for f, t in tf if t == {'participle', 'passive'})
            conj = {}
            for f, t in tf:
                if 'passive' in t or not is_arabic(f):
                    continue
                for mood, need in MOODS.items():
                    if need <= t:
                        pk = person_key(t)
                        if pk:
                            conj.setdefault(mood, {}).setdefault(pk, [])
                            if f not in conj[mood][pk]:
                                conj[mood][pk].append(f)
                        break
            if conj.get('past') and conj.get('present'):
                e['conj'] = conj
        else:
            m = masdar_of(d)
            if m:
                e['masdarOf'] = m

        # Pronunciation
        for snd in d.get('sounds') or []:
            if 'ipa' in snd and 'ipa' not in e and not snd.get('tags'):
                e['ipa'] = snd['ipa']
            if snd.get('mp3_url') and 'audio' not in e:
                e['audio'] = snd['mp3_url']
                e['audioFile'] = snd.get('audio', '')

        ety = (d.get('etymology_text') or '').strip()
        if ety and len(ety) <= 400:
            e['ety'] = ety
        rel = uniq((x.get('word') or '') for x in (d.get('derived') or []) + (d.get('related') or []))
        rel = [x for x in rel if is_arabic(x)][:20]
        if rel:
            e['rel'] = rel

        # Root, verified against the word's own letters and its forms.
        cands = entry_roots(d, cache)
        # Present forms lose their tense prefix (the ي of يَقُولُ is not a
        # root letter).
        stems = [strip_diacritics(f)[1:] for f in e.get('present', [])]
        r = best_root(cands, canon, [canon] + stems + [f for k in (
            'masdar', 'ap', 'pp', 'pl', 'fem', 'sing') for f in e.get(k, [])])
        if r:
            e['root'] = '-'.join(r)
            stats['with_root'] += 1
        elif cands:
            stats['root_rejected'] += 1

        # Every inflected spelling of the word (without clitics), for the
        # frequency ranking that orders "most common" lists.
        sp = {surface(canon)}
        for f, t in table_forms(d):
            if is_arabic(f):
                sp.add(surface(f))
        for f in e.get('pl', []):
            sp.add(surface(f))

        # Every form list holds Arabic only: Wiktionary sometimes appends a
        # transliteration "(al-ḥuqūq)" or lists a romanized form in the table.
        for key in ('pl', 'fem', 'mpl', 'fpl', 'elative', 'sing', 'coll',
                    'present', 'masdar', 'ap', 'pp', 'masdarOf', 'rel'):
            if key in e:
                e[key] = uniq(arabic_form(f) for f in e[key])

        # Drop empty fields to keep the file small.
        entries.append({k: v for k, v in e.items() if v not in ([], '', None, {})})
        spellings.append(sp)

    assign_frequencies(entries, spellings, freq)

    os.makedirs(DATA, exist_ok=True)
    with gzip.open(OUT, 'wt', encoding='utf8') as f:
        json.dump({'source': 'en.wiktionary.org via kaikki.org',
                   'license': 'CC BY-SA 4.0',
                   'frequency': 'hermitdave/FrequencyWords 2018 (OpenSubtitles), CC BY-SA 4.0',
                   'entries': entries}, f, ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(stats))
    print(f'{len(entries)} entries → {OUT} ({os.path.getsize(OUT) / 1e6:.1f} MB)')


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'roots':
        cmd_roots(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'extract':
        cmd_extract(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        print(__doc__)
        sys.exit(1)
