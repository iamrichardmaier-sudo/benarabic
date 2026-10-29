import { describe, it, expect } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import { formCounts, formGroups } from './form-browse';
import { rankDeck } from './deck-search';

const card = (word: string, english: string, over: Partial<FlashCard> = {}): FlashCard => ({
  ...createCard(word, english), id: `${word}-${english}`, ...over,
});

const deck = [
  card('عَلَّمَ', 'to teach', { verbForm: 'II', wordType: 'verb', root: 'ع-ل-م' }),
  card('تَعْلِيم', 'education', { verbForm: 'II', wordType: 'masdar', root: 'ع-ل-م' }),
  card('مُعَلِّم', 'teacher', { verbForm: 'II', wordType: 'participle', root: 'ع-ل-م' }),
  card('كَتَبَ', 'to write', { verbForm: 'I', wordType: 'verb', root: 'ك-ت-ب' }),
  card('اِسْتَخْدَمَ', 'to use', { verbForm: 'X', wordType: 'verb', root: 'خ-د-م' }),
  card('بَيْت', 'house', { wordType: 'noun' }),
];

describe('formCounts', () => {
  it('counts the words tagged with each form, zero for the rest', () => {
    const counts = formCounts(deck);
    expect(counts.II).toBe(3);
    expect(counts.I).toBe(1);
    expect(counts.X).toBe(1);
    expect(counts.V).toBe(0);
  });
});

describe('formGroups', () => {
  it('groups one form into verbs, verbal nouns and participles', () => {
    expect(formGroups(deck, 'II').map((g) => [g.title, g.cards.map((c) => c.english)])).toEqual([
      ['Verbs', ['to teach']],
      ['Verbal nouns', ['education']],
      ['Participles', ['teacher']],
    ]);
  });

  it('is empty for a form the deck holds nothing in', () => {
    expect(formGroups(deck, 'IX')).toEqual([]);
  });
});

describe('rankDeck', () => {
  it('puts an exact meaning first, then ones starting with the query', () => {
    const cards = [
      card('مُعَلِّم', 'schoolteacher'),
      card('عَلَّمَ', 'to teach'),
      card('مُدَرِّس', 'teacher (secondary)'),
    ];
    expect(rankDeck(cards, 'teacher').map((c) => c.english)).toEqual(['teacher (secondary)', 'schoolteacher']);
    expect(rankDeck(cards, 'teach').map((c) => c.english)).toEqual(['to teach', 'teacher (secondary)', 'schoolteacher']);
  });

  it('matches Arabic without vowels, exact word first', () => {
    const cards = [card('مَكْتَبَة', 'library'), card('كِتاب', 'book'), card('كَتَبَ', 'to write', { root: 'ك-ت-ب' })];
    expect(rankDeck(cards, 'كتاب')[0].english).toBe('book');
    expect(rankDeck(cards, 'كتب')[0].english).toBe('to write');
  });

  it('returns nothing for an empty query', () => {
    expect(rankDeck(deck, '  ')).toEqual([]);
  });
});
