import { describe, it, expect } from 'vitest';
import { asciiTranslit, vocalKey, shortGloss, rootSlugBase } from './text.mjs';
import { family, makeSlugger, isPageWorthy, mainGloss, headline } from './dictionary.mjs';
import { validate } from './validate.mjs';

function dictOf(entries) {
  const list = entries.map((e, id) => ({ et: '0', freq: 0, ...e, id }));
  const byRoot = new Map();
  for (const e of list) {
    if (!byRoot.has(e.root)) byRoot.set(e.root, []);
    byRoot.get(e.root).push(e);
  }
  return { entries: list, byRoot };
}

describe('text helpers', () => {
  it('turns Wiktionary romanization into what people type', () => {
    expect(asciiTranslit('kitāb')).toBe('kitab');
    expect(asciiTranslit('ʔistiqbāl')).toBe('istiqbal');
    expect(asciiTranslit('maḵzan')).toBe('makhzan');
    expect(asciiTranslit('ḏahaba')).toBe('dhahaba');
    expect(asciiTranslit('šams')).toBe('shams');
    expect(asciiTranslit('al-ʕarabiyya')).toBe('al-arabiyya');
  });

  it('keeps vowels when comparing words, but ignores spelling variants', () => {
    expect(vocalKey('كِتَاب')).not.toBe(vocalKey('كُتَّاب'));
    expect(vocalKey('اِسْتَقْبَلَ')).toBe(vocalKey('اِستَقبَلَ'));
    expect(vocalKey('كَتَّبَ')).toBe(vocalKey('كَتَّبَ'.replace('َّ', 'َّ')));
  });

  it('makes short glosses and root slugs', () => {
    expect(shortGloss('letter, note, paper')).toBe('letter');
    expect(shortGloss('to receive (a person)')).toBe('to receive');
    expect(rootSlugBase('ك-ت-ب')).toBe('k-t-b');
  });
});

describe('root families', () => {
  const dict = dictOf([
    { w: 'كَتَبَ', pos: 'verb', form: 'I', root: 'ك-ت-ب', masdar: ['كِتَابَة'], ap: ['كَاتِب'], pp: ['مَكْتُوب'], senses: [{ head: 'to write' }] },
    { w: 'كَاتَبَ', pos: 'verb', form: 'III', root: 'ك-ت-ب', masdar: ['مُكَاتَبَة'], senses: [{ head: 'to correspond' }] },
    { w: 'كَاتِب', pos: 'noun', root: 'ك-ت-ب', senses: [{ head: 'writer' }] },
    { w: 'كِتَاب', pos: 'noun', root: 'ك-ت-ب', masdarOf: ['كَتَبَ'], senses: [{ head: 'book' }] },
    { w: 'مَكْتَبَة', pos: 'noun', root: 'ك-ت-ب', ety: 'Noun of place from the root ك ت ب', senses: [{ head: 'library' }] },
    { w: 'مُكَاتَبَة', pos: 'noun', root: 'ك-ت-ب', ety: 'Verbal noun of كَاتَبَ (kātaba)', senses: [{ head: 'correspondence' }] },
  ]);
  const fam = family(dict, 'ك-ت-ب');
  const under = (verb) => fam.groups.find((g) => g.verb.w === verb).connected.map((c) => [c.word, c.role]);

  it('puts each noun under the verb Wiktionary links it to', () => {
    expect(under('كَتَبَ')).toEqual([
      ['كِتَابَة', 'verbal noun'], ['كِتَاب', 'verbal noun'],
      ['كَاتِب', 'active participle'], ['مَكْتُوب', 'passive participle'],
    ]);
    expect(under('كَاتَبَ')).toEqual([['مُكَاتَبَة', 'verbal noun']]);
  });

  it('leaves nouns with no stated link to a verb on their own', () => {
    expect(fam.others.map((e) => e.w)).toEqual(['مَكْتَبَة']);
  });

  it('orders verbs by form', () => {
    expect(fam.groups.map((g) => g.verb.form)).toEqual(['I', 'III']);
  });
});

describe('page selection', () => {
  it('skips words with no root or only rare senses', () => {
    expect(isPageWorthy({ w: 'x', pos: 'noun', senses: [{ head: 'a' }] })).toBe(false);
    expect(isPageWorthy({ w: 'x', pos: 'verb', root: 'ح-ب-ب', senses: [{ head: 'to love', labels: ['rare'] }] })).toBe(false);
    expect(isPageWorthy({ w: 'x', pos: 'noun', root: 'ك-ت-ب', senses: [{ head: 'book' }] })).toBe(true);
  });

  it('picks a concise headline from a long first sense', () => {
    expect(headline({ senses: [{ head: 'to mark (symbols, shapes, graphs, and the like) on a surface, to write, to inscribe' }] })).toBe('to write');
    expect(headline({ senses: [{ head: 'book' }] })).toBe('book');
    expect(headline({ senses: [{ head: 'letter, note, paper' }] })).toBe('letter');
    expect(headline({ senses: [{ head: 'to make (someone) laugh (مِن (min) about)' }] })).toBe('to make laugh');
  });

  it('skips grammar notes for the headline meaning', () => {
    expect(mainGloss({ senses: [{ head: 'instance noun of حَرُكَ (ḥaruka)' }, { head: 'movement' }] })).toBe('movement');
    expect(mainGloss({ senses: [{ head: 'instance noun of حَرُكَ (ḥaruka): an instance of movement' }] })).toBe('an instance of movement');
    expect(mainGloss({ senses: [{ head: 'plural of مَاء (māʔ)' }] })).toBe('plural of مَاء (māʔ)');
  });

  it('prefers a current sense for the headline meaning', () => {
    expect(mainGloss({ senses: [{ head: 'old thing', labels: ['obsolete'] }, { head: 'book', labels: [] }] })).toBe('book');
  });
});

describe('slugs', () => {
  const kitab = { id: 1, page: 'كتاب', et: '1', pos: 'noun', w: 'كِتَاب', rom: 'kitāb', root: 'ك-ت-ب' };
  const kuttab = { id: 2, page: 'كتاب', et: '2', pos: 'noun', w: 'كُتَّاب', rom: 'kuttāb', root: 'ك-ت-ب' };

  it('gives common words the clean slug and numbers collisions', () => {
    const map = {};
    const s = makeSlugger(map);
    expect(s.word(kitab)).toBe('kitab');
    expect(s.word({ ...kitab, id: 3, et: '3', w: 'كِتٰب' })).toBe('kitab-2');
    expect(s.word(kuttab)).toBe('kuttab');
  });

  it('keeps a published URL when Wiktionary renumbers the etymology', () => {
    const map = { 'كتاب|1|noun|كِتَاب': 'kitab' };
    const s = makeSlugger(map);
    const renumbered = { ...kitab, et: '2' };
    s.reserve([renumbered]);
    expect(s.word(renumbered)).toBe('kitab');
  });
});

describe('validate', () => {
  const page = (path, extra = '') => ({
    path,
    html: `<title>T ${path}</title><meta name="description" content="A description that is long enough to pass the check ${path}">
<link rel="canonical" href="https://x.test${path}"><h1>H</h1>${extra}`,
  });

  it('passes clean pages', () => {
    expect(validate([page('/a/'), page('/b/', '<a href="/a/">a</a>')], { site: 'https://x.test' })).toEqual([]);
  });

  it('catches broken links, missing h1 and duplicate titles', () => {
    const errs = validate([
      page('/a/', '<a href="/missing/">x</a>'),
      { path: '/b/', html: page('/b/').html.replace('<h1>H</h1>', '').replace('T /b/', 'T /a/') },
    ], { site: 'https://x.test' });
    expect(errs.some((e) => e.includes('broken internal link /missing/'))).toBe(true);
    expect(errs.some((e) => e.includes('0 <h1>'))).toBe(true);
    expect(errs.some((e) => e.includes('duplicate title'))).toBe(true);
  });
});
