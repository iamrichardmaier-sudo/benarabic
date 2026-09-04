import { describe, it, expect } from 'vitest';
import { mergeResults, markOwned, recentRoots } from './lookup';
import type { DictionaryEntry } from './dictionary';
import type { FlashCard } from './spaced-repetition';

const card = (o: Partial<FlashCard> & { id: string; word: string }): FlashCard =>
  ({ english: null, imageUrl: null, nextReviewDate: '2026-01-01', intervalDays: 1,
     easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0,
     ...o } as FlashCard);

const entry = (o: Partial<DictionaryEntry> & { id: string; lemma: string }): DictionaryEntry =>
  ({ root: null, pos: null, verbForm: null, glosses: [], occurrences: 0, ...o });

describe('mergeResults', () => {
  it('puts the learner’s own words first', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'مَجَلَّة', english: 'magazine' })],
      [entry({ id: '1', lemma: 'كِتاب', glosses: ['book'] })],
    );
    expect(merged.map((r) => r.lemma)).toEqual(['مَجَلَّة', 'كِتاب']);
  });

  it('folds the same word from both sources into one row', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write' })],
      [entry({ id: '1', lemma: 'كَتَبَ', root: 'ك-ت-ب', glosses: ['wrote'], occurrences: 11 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(['deck', 'bible']);
  });

  it('keeps the learner’s own gloss when folding', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كَتَبَ', english: 'to write' })],
      [entry({ id: '1', lemma: 'كَتَبَ', glosses: ['wrote', 'I wrote'] })],
    );
    expect(merged[0].glosses).toEqual(['to write']);
  });

  it('borrows the corpus gloss when the card has none', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كَتَبَ' })],
      [entry({ id: '1', lemma: 'كَتَبَ', glosses: ['wrote'] })],
    );
    expect(merged[0].glosses).toEqual(['wrote']);
  });

  it('borrows the root and form for a card that was never tagged', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كَتَبَ', english: 'to write' })],
      [entry({ id: '1', lemma: 'كَتَبَ', root: 'ك-ت-ب', verbForm: 'I', occurrences: 11 })],
    );
    expect(merged[0].root).toBe('ك-ت-ب');
    expect(merged[0].verbForm).toBe('I');
    expect(merged[0].occurrences).toBe(11);
  });

  it('matches across spellings, so a vowelled card folds with a bare entry', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كَتَبَ', english: 'to write' })],
      [entry({ id: '1', lemma: 'كتب' })],
    );
    expect(merged).toHaveLength(1);
  });

  it('does not list the same deck card twice', () => {
    const merged = mergeResults(
      [card({ id: 'a', word: 'كتب' }), card({ id: 'b', word: 'كَتَبَ' })],
      [],
    );
    expect(merged).toHaveLength(1);
  });
});

describe('markOwned', () => {
  it('marks a corpus result the learner already has, despite a different spelling', () => {
    const results = mergeResults([], [entry({ id: '1', lemma: 'كَتَبَ' })]);
    const marked = markOwned(results, [card({ id: 'a', word: 'كتب' })]);
    expect(marked[0].inDeck).toBe(true);
  });

  it('leaves a word the learner does not have unmarked', () => {
    const results = mergeResults([], [entry({ id: '1', lemma: 'كَتَبَ' })]);
    expect(markOwned(results, [card({ id: 'a', word: 'مجلة' })])[0].inDeck).toBe(false);
  });
});

describe('recentRoots', () => {
  const deck = [
    card({ id: '1', word: 'a', root: 'ك-ت-ب' }),
    card({ id: '2', word: 'b', root: 'ق-ر-أ' }),
    card({ id: '3', word: 'c', root: 'ق-ر-أ' }),
    card({ id: '4', word: 'd' }),
    card({ id: '5', word: 'e', root: 'د-ر-س' }),
  ];

  it('reads newest first, since the deck arrives oldest first', () => {
    expect(recentRoots(deck)).toEqual(['د-ر-س', 'ق-ر-أ', 'ك-ت-ب']);
  });

  it('skips cards with no root', () => {
    expect(recentRoots(deck)).not.toContain(undefined);
  });

  it('honours the limit', () => {
    expect(recentRoots(deck, 2)).toEqual(['د-ر-س', 'ق-ر-أ']);
  });

  it('returns nothing for a deck with no roots at all', () => {
    expect(recentRoots([card({ id: '1', word: 'a' })])).toEqual([]);
  });
});
