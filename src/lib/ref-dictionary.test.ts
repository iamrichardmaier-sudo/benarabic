import { describe, it, expect } from 'vitest';
import { findHit, searchIndex, toHit, type IndexRow } from './ref-dictionary';
import { toNewWord } from './ref-dictionary-cards';

// Most common first, as the generator writes it.
const rows: IndexRow[] = [
  [1, 'كَتَبَ', 'kataba', 'to write', 'verb', 'I', 3, 900, 'kataba', 'ك-ت-ب'],
  [2, 'كِتَاب', 'kitab', 'book', 'noun', '', 3, 800, 'kitab', 'ك-ت-ب'],
  [3, 'حَرِير', 'harir', 'silk', 'noun', '', 9, 50, 'harir', 'ح-ر-ر'],
  [4, 'سِلْك', 'silk', 'thread', 'noun', '', 7, 40, '', 'س-ل-ك'],
  [5, 'مَكْتَبَة', 'maktaba', 'library', 'noun', '', 3, 30, '', 'ك-ت-ب'],
  [6, 'كِتَاب', 'kitab', 'letter', 'noun', '', 3, 5, '', 'ك-ت-ب'],
];
const index = rows.map(toHit);
const words = (q: string) => searchIndex(index, q).map((h) => h.id);

describe('searching the reference dictionary', () => {
  it('finds Arabic with or without vowels, the exact spelling first', () => {
    expect(words('كتاب')[0]).toBe(2);
    expect(words('كِتَاب')[0]).toBe(2);
  });

  it('finds every word on a root typed bare or hyphenated', () => {
    expect(words('ك-ت-ب')).toEqual(expect.arrayContaining([1, 2, 5]));
  });

  it('puts a meaning before a sound-alike', () => {
    expect(words('silk')).toEqual([3, 4]);
  });

  it('finds a verb by "to …" and by transliteration', () => {
    expect(words('write')[0]).toBe(1);
    expect(words('kitab')[0]).toBe(2);
  });

  it('matches nothing for an empty query', () => {
    expect(words('  ')).toEqual([]);
  });
});

describe('finding the entry an address names', () => {
  it('by id, by slug, and by the Arabic itself', () => {
    expect(findHit(index, '5')?.id).toBe(5);
    expect(findHit(index, 'harir')?.id).toBe(3);
    expect(findHit(index, 'كِتَاب')?.id).toBe(2);
    // Unvoweled: the most common entry spelled the same.
    expect(findHit(index, 'كتاب')?.id).toBe(2);
    expect(findHit(index, 'nothing-here')).toBeNull();
  });
});

describe('a dictionary entry as a card', () => {
  it('carries the forms a card has fields for', () => {
    const w = toNewWord(
      { id: 1, w: 'كَتَبَ', page: 'كتب', pos: 'verb', freq: 1, root: 'ك-ت-ب', form: 'I', present: ['يَكْتُبُ'], masdar: ['كِتَابَة'] },
      'to write',
    );
    expect(w).toMatchObject({
      word: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب', wordType: 'verb', verbForm: 'I',
      pastTense: 'كَتَبَ', presentTense: 'يَكْتُبُ', masdarForm: 'كِتَابَة',
    });
    const n = toNewWord({ id: 2, w: 'كِتَاب', page: 'كتاب', pos: 'noun', freq: 1, pl: ['كُتُب'] }, 'book');
    expect(n).toMatchObject({ wordType: 'noun', fushaPlural: 'كُتُب', pastTense: null });
  });
});
