import { describe, it, expect } from 'vitest';
import { attestedIn, entryToCardFields, type DictionaryEntry } from './dictionary';

const entry = (over: Partial<DictionaryEntry>): DictionaryEntry => ({
  id: '1', lemma: 'وَلَدَ', root: 'و-ل-د', pos: 'verb', verbForm: 'I',
  glosses: ['she gives birth', 'you will give birth'], occurrences: 16,
  bibleOccurrences: 16, bomOccurrences: 0, ...over,
});

describe('entryToCardFields', () => {
  it('carries the lemma, root and form onto the card', () => {
    const f = entryToCardFields(entry({}));
    expect(f.word).toBe('وَلَدَ');
    expect(f.root).toBe('و-ل-د');
    expect(f.verbForm).toBe('I');
    expect(f.wordType).toBe('verb');
  });

  it('takes the commonest gloss as the headword', () => {
    // The corpus glosses words in context, so the rest are dropped rather
    // than crammed onto the card.
    expect(entryToCardFields(entry({})).english).toBe('she gives birth');
  });

  it('maps a part of speech the card model does not have onto "other"', () => {
    expect(entryToCardFields(entry({ pos: 'particle' })).wordType).toBe('other');
    expect(entryToCardFields(entry({ pos: 'proper_noun' })).wordType).toBe('other');
    expect(entryToCardFields(entry({ pos: null })).wordType).toBe('other');
  });

  it('keeps the participle and masdar types the card model does have', () => {
    expect(entryToCardFields(entry({ pos: 'participle' })).wordType).toBe('participle');
    expect(entryToCardFields(entry({ pos: 'masdar' })).wordType).toBe('masdar');
  });

  it('survives an entry with no glosses at all', () => {
    expect(entryToCardFields(entry({ glosses: [] })).english).toBe('');
  });

  it('leaves the verb form null for a word that has none', () => {
    expect(entryToCardFields(entry({ verbForm: null })).verbForm).toBeNull();
  });
});

describe('attestedIn', () => {
  it('names the Bible for a word only the Bible has', () => {
    expect(attestedIn({ bibleOccurrences: 12, bomOccurrences: 0 })).toBe('in the Bible');
  });

  it('names the Book of Mormon for a word only it has', () => {
    // Nephite names and the vocabulary the translation reaches for are not in
    // the Bible at all, and sending a learner there to find them is worse than
    // saying nothing.
    expect(attestedIn({ bibleOccurrences: 0, bomOccurrences: 57 })).toBe('in the Book of Mormon');
  });

  it('names neither when both have it', () => {
    expect(attestedIn({ bibleOccurrences: 3, bomOccurrences: 4 })).toBe('in scripture');
  });
});
