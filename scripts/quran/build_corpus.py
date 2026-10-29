#!/usr/bin/env python3
"""
Build one aligned Qur'an token table from three public sources.

    python3 -I scripts/quran/build_corpus.py WORKDIR

Nothing in WORKDIR is committed. The sources are fetched from the PyPI and npm
registries and only ever *read* as data; no code from them is run.

Sources
-------
1. Quranic Arabic Corpus morphology (qurancorpus 0.2.1 on PyPI, Kais Dukes,
   GPL, text by Tanzil, CC BY-ND). Per-word part of speech, lemma, root,
   verb form, aspect, participle type. It is an early release: it omits the
   last verse of every surah (114 verses), and gives verbs no lemma.
2. quran-search-engine 0.3.2 on npm (MIT). Bundles the complete Qur'an text in
   three scripts and a form -> {lemma, root} lexicon from QAC v4.0 covering
   every surface form, which is what fills the 114 missing verses.
3. @kmaslesa/holy-quran-word-by-word-full-data 1.0.6 on npm (ISC). The
   quran.com word-by-word English, aligned to (1) by (surah, verse, position).
   Used as a hint when annotating; never copied into the database.

Output (WORKDIR/corpus/)
------------------------
    verses.json   {"c:v": {"text": ..., "toks": [...], "uth": ...}}  text is the
                  tashkeel script the app already stores in quran_example
    suras.json    [{"id", "ar", "en", "rom"}]
    wordmap.json  {bare form: {"lemma", "root"}}   from QAC 4.0
    tokens.json   one record per QAC word, plus records for the 114 verses QAC
                  0.1 lacks (source "wordmap", no part of speech)
"""

import html
import io
import json
import os
import re
import sys
import tarfile
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

PYPI_EGG = ('https://files.pythonhosted.org/packages/4c/14/3ad3fd470f4de133f6970070595f43ae29d54d3c1e302631306359f1d9f2/'
            'qurancorpus-0.2.1-py2.7.egg')
NPM_SEARCH = 'https://registry.npmjs.org/quran-search-engine/-/quran-search-engine-0.3.2.tgz'
NPM_WBW = ('https://registry.npmjs.org/@kmaslesa/holy-quran-word-by-word-full-data/-/'
           'holy-quran-word-by-word-full-data-1.0.6.tgz')

BW = {"'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', 'A': 'ا', 'b': 'ب', 'p': 'ة', 't': 'ت',
      'v': 'ث', 'j': 'ج', 'H': 'ح', 'x': 'خ', 'd': 'د', '*': 'ذ', 'r': 'ر', 'z': 'ز', 's': 'س', '$': 'ش',
      'S': 'ص', 'D': 'ض', 'T': 'ط', 'Z': 'ظ', 'E': 'ع', 'g': 'غ', '_': 'ـ', 'f': 'ف', 'q': 'ق', 'k': 'ك',
      'l': 'ل', 'm': 'م', 'n': 'ن', 'h': 'ه', 'w': 'و', 'Y': 'ى', 'y': 'ي', 'F': 'ً', 'N': 'ٌ', 'K': 'ٍ',
      'a': 'َ', 'u': 'ُ', 'i': 'ِ', '~': 'ّ', 'o': 'ْ', '`': 'ٰ', '{': 'ٱ', '^': 'ٓ', '#': 'ٔ'}

TASHKEEL = re.compile('[ً-ٰٟـۖ-ۭ]')


def bw2ar(s):
    return ''.join(BW.get(ch, ch) for ch in s)


def root_ar(bw_root):
    """Buckwalter root -> 'ك-ت-ب'. A radical alef in QAC roots is always a hamza."""
    letters = []
    for ch in bw_root:
        letters.append('أ' if ch == 'A' else BW.get(ch, ch))
    return '-'.join(letters)


def fetch(url, dest):
    if os.path.exists(dest):
        return
    req = urllib.request.Request(url, headers={'User-Agent': 'benarabic-corpus-build'})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, 'wb') as f:
        f.write(r.read())


def safe_extract_tar(path, member_suffixes):
    """Read named members of a tarball into memory (no extraction to disk)."""
    out = {}
    with tarfile.open(path) as t:
        for m in t.getmembers():
            for suf in member_suffixes:
                if m.isfile() and m.name.endswith(suf):
                    out[suf] = t.extractfile(m).read()
    return out


# ---------------------------------------------------------------- JS data modules

def js_literal_to_json(body):
    """Turn a JS object/array literal with bare keys into JSON. Parsing only."""
    out, i, n, in_str = [], 0, len(body), False
    ident = lambda ch: ch.isalnum() or ch in '_$\\'
    while i < n:
        c = body[i]
        if in_str:
            out.append(c)
            if c == '\\':
                out.append(body[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c.isalpha() or c in '_$\\':
            j = i
            while j < n and ident(body[j]):
                j += 1
            k = j
            while k < n and body[k] in ' \t\n':
                k += 1
            out.append('"' + body[i:j] + '"' if (k < n and body[k] == ':') else body[i:j])
            i = j
            continue
        out.append(c)
        i += 1
    return re.sub(r',(\s*[\]}])', r'\1', ''.join(out))


def bundle_modules(js):
    spans = [(m.group(1), m.end()) for m in re.finditer(r'// src/data/([\w-]+)\.json\n', js)]
    mods = {}
    for idx, (name, start) in enumerate(spans):
        if name not in ('word-map', 'quran'):
            continue
        end = spans[idx + 1][1] if idx + 1 < len(spans) else len(js)
        body = js[start:end]
        a = body.index('module.exports = ') + len('module.exports = ')
        z = body.rfind(';\n  }\n});')
        mods[name] = json.loads(js_literal_to_json(body[a:z]))
    return mods


# ---------------------------------------------------------------- QAC parsing

CONTENT_POS = {'N', 'ADJ', 'V', 'PN', 'NUM', 'LOC', 'T'}
FORM_RE = re.compile(r'^\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)$')


def parse_morph(m):
    """One QAC morphology string -> list of segments (one per POS tag)."""
    parts = html.unescape(html.unescape(m)).split()
    segs, cur, pre = [], None, []
    for p in parts:
        if p.startswith('POS:'):
            cur = {'pos': p[4:], 'pre': pre, 'tags': []}
            pre = []
            segs.append(cur)
        elif cur is None:
            pre.append(p)
        elif p.startswith('LEM:'):
            cur['lem'] = bw2ar(p[4:])
        elif p.startswith('ROOT:'):
            cur['root'] = root_ar(p[5:])
        elif FORM_RE.match(p):
            cur['form'] = p[1:-1]
        elif p.startswith('PRON:'):
            cur['pron'] = p[5:]
        elif p.startswith('MOOD:'):
            cur['mood'] = p[5:]
        elif p.startswith('SP:'):
            cur['sp'] = bw2ar(p[3:])
        elif p in ('PERF', 'IMPF', 'IMPV'):
            cur['asp'] = p
        elif p in ('ACT', 'PASS'):
            cur['voice'] = p
        elif p == 'PCPL':
            cur['pcpl'] = True
        elif p == 'VN':
            cur['vn'] = True
        else:
            cur['tags'].append(p)
    return segs


def bare(s):
    s = TASHKEEL.sub('', s)
    s = re.sub('[أإآٱ]', 'ا', s)
    return s.replace('ى', 'ي').replace('ة', 'ه').strip()


def main(work):
    os.makedirs(work, exist_ok=True)
    out_dir = os.path.join(work, 'corpus')
    os.makedirs(out_dir, exist_ok=True)

    egg = os.path.join(work, 'qurancorpus.egg')
    se = os.path.join(work, 'quran-search-engine.tgz')
    wbw = os.path.join(work, 'wbw.tgz')
    fetch(PYPI_EGG, egg)
    fetch(NPM_SEARCH, se)
    fetch(NPM_WBW, wbw)

    with zipfile.ZipFile(egg) as z:
        xml_bytes = z.read('qurancorpus/quranic-corpus-morpology.xml')
    qac_root = ET.fromstring(xml_bytes)

    mods = bundle_modules(safe_extract_tar(se, ['dist/index.mjs'])['dist/index.mjs'].decode('utf-8'))
    wordmap, quran = mods['word-map'], mods['quran']
    wbw_pages = json.loads(safe_extract_tar(wbw, ['package/data.json'])['package/data.json'])

    suras, verses = {}, {}
    for r in quran:
        c, v = r['sura_id'], r['aya_id']
        suras.setdefault(c, {'id': c, 'ar': r['sura_name'], 'en': r['sura_name_en'], 'rom': r['sura_name_romanization']})
        verses[f'{c}:{v}'] = {'text': r['standard_full'], 'toks': r['standard_full'].split(), 'uth': r['uthmani']}

    glosses = {}
    for page in wbw_pages:
        for ay in page['ayahs']:
            for w in ay['words']:
                if w and w.get('char_type_name') == 'word':
                    c, v = map(int, w['parentAyahVerseKey'].split(':'))
                    glosses[(c, v, w['position'])] = w['translation']['text']

    tokens, have = [], set()
    for ch in qac_root.iter('chapter'):
        c = int(ch.get('number'))
        for ve in ch.iter('verse'):
            v = int(ve.get('number'))
            have.add((c, v))
            for w in ve.iter('word'):
                n = int(w.get('number'))
                tokens.append({'c': c, 'v': v, 'n': n, 'ar': w.get('token'), 'src': 'qac',
                               'segs': parse_morph(w.get('morphology')), 'gloss': glosses.get((c, v, n))})

    # The verses QAC 0.1 lacks: take each word's lemma and root from the QAC 4.0 lexicon.
    filled = 0
    for key, vs in verses.items():
        c, v = map(int, key.split(':'))
        if (c, v) in have:
            continue
        for n, tok in enumerate(vs['toks'], 1):
            hit = wordmap.get(bare(tok))
            seg = {'pos': '?', 'pre': [], 'tags': []}
            if hit:
                # A few forms carry a lemma but no root (particles) or the reverse.
                if hit.get('lemma'):
                    seg['lem'] = hit['lemma']
                if hit.get('root'):
                    seg['root'] = hit['root']
            tokens.append({'c': c, 'v': v, 'n': n, 'ar': tok, 'src': 'wordmap', 'segs': [seg],
                           'gloss': glosses.get((c, v, n))})
        filled += 1

    tokens.sort(key=lambda t: (t['c'], t['v'], t['n']))
    json.dump(tokens, open(os.path.join(out_dir, 'tokens.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(verses, open(os.path.join(out_dir, 'verses.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump([suras[k] for k in sorted(suras)], open(os.path.join(out_dir, 'suras.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(wordmap, open(os.path.join(out_dir, 'wordmap.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(tokens)} tokens; {len(verses)} verses; {filled} verses filled from the QAC 4.0 lexicon; '
          f'{len(wordmap)} lexicon forms')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
