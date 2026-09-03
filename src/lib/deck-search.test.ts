import { describe, it, expect } from 'vitest';
import { searchDeck, matchesQuery } from './deck-search';
import type { FlashCard } from './spaced-repetition';

const mk = (o: Partial<FlashCard> & { id: string; word: string }): FlashCard =>
  ({ english: null, imageUrl: null, nextReviewDate: '2026-01-01', intervalDays: 1,
     easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0,
     ...o } as FlashCard);

const kataba = mk({
  id: '1', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب',
  wordType: 'verb', verbForm: 'I', masdarForm: 'كِتابة',
  companionForms: [{ form: 'مَكتَب', label: 'Noun (office)' }],
});
const majalla = mk({
  id: '2', word: 'مجلّة', wordVoweled: 'مَجَلَّة', english: 'magazine, journal',
  root: 'ج-ل-ل', wordType: 'noun', fushaPlural: 'مَجَلّات',
});
const raja = mk({
  id: '3', word: 'رجع', wordVoweled: 'رَجَعَ', english: 'to return', root: 'ر-ج-ع',
  wordType: 'verb', verbForm: 'I', shaami: 'رِجِع ، يرجَع عَ',
});
const deck = [kataba, majalla, raja];

describe('searchDeck', () => {
  it('returns everything for an empty query', () => {
    expect(searchDeck(deck, '   ')).toHaveLength(3);
  });

  it('finds a card by its English gloss', () => {
    expect(searchDeck(deck, 'magazine').map((c) => c.id)).toEqual(['2']);
  });

  it('is case insensitive', () => {
    expect(searchDeck(deck, 'MAGAZINE').map((c) => c.id)).toEqual(['2']);
  });

  it('finds a card by bare Arabic when the card is stored vowelled', () => {
    // The learner types what they hear; the deck stores كَتَبَ.
    expect(searchDeck(deck, 'كتب').map((c) => c.id)).toEqual(['1']);
  });

  it('finds a card by vowelled Arabic when the query carries vowels', () => {
    expect(searchDeck(deck, 'مَجَلَّة').map((c) => c.id)).toEqual(['2']);
  });

  it('finds a card by its root, with or without the hyphens', () => {
    expect(searchDeck(deck, 'ر-ج-ع').map((c) => c.id)).toEqual(['3']);
    expect(searchDeck(deck, 'رجع').map((c) => c.id)).toEqual(['3']);
  });

  it('finds a card by its Shaami form', () => {
    expect(searchDeck(deck, 'يرجع').map((c) => c.id)).toEqual(['3']);
  });

  it('finds a card by a companion form', () => {
    expect(searchDeck(deck, 'مكتب').map((c) => c.id)).toEqual(['1']);
  });

  it('finds a card by its plural', () => {
    expect(searchDeck(deck, 'مجلات').map((c) => c.id)).toEqual(['2']);
  });

  it('searches the verb form', () => {
    expect(searchDeck(deck, 'form i').map((c) => c.id)).toEqual(['1', '3']);
  });

  it('searches companion form labels, so a family member can be looked up', () => {
    expect(searchDeck(deck, 'office').map((c) => c.id)).toEqual(['1']);
  });

  it('matches a part of speech named anywhere on the card, family included', () => {
    // كتب is a verb, but its family holds "Noun (office)", so a search for
    // "noun" reaches it. Widening a search to the word family is the point of
    // the deck being root-organised — it is not a mis-hit.
    expect(searchDeck(deck, 'noun').map((c) => c.id)).toEqual(['1', '2']);
  });

  it('matches a substring of the gloss, not just a prefix', () => {
    expect(matchesQuery(majalla, 'journal')).toBe(true);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchDeck(deck, 'zzzz')).toEqual([]);
  });
});
