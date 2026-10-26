import { describe, it, expect } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import { cardStatus, countByStatus, dueIdSet, filterDeck, sortDeck } from './deck-view';

const NOW = new Date('2026-10-26T12:00:00');
const mk = (word: string, extra: Partial<FlashCard> = {}): FlashCard => ({ ...createCard(word, word), ...extra });

const deck = [
  mk('كِتاب', { learningStage: 'new', createdAt: '2026-10-20T00:00:00Z', root: 'ك-ت-ب' }),
  mk('بَيت', { learningStage: 'stage1', createdAt: '2026-10-22T00:00:00Z', root: 'ب-ي-ت' }),
  mk('أَمام', { learningStage: 'graduated', nextReviewDate: '2026-10-25', createdAt: '2026-10-21T00:00:00Z', root: 'أ-م-م' }),
  mk('جَديد', { learningStage: 'graduated', nextReviewDate: '2026-11-03', createdAt: null, root: null }),
];

describe('deck view', () => {
  const due = dueIdSet(deck, NOW);

  it('labels each card the way Review and Learn see it', () => {
    expect(deck.map((c) => cardStatus(c, due, NOW).key)).toEqual(['new', 'learning', 'due', 'known']);
    expect(cardStatus(deck[3], due, NOW).label).toBe('Nov 3');
  });

  it('counts and filters by status', () => {
    expect(countByStatus(deck, due, NOW)).toEqual({ all: 4, due: 1, new: 1, learning: 1, known: 1 });
    expect(filterDeck(deck, 'due', due, NOW).map((c) => c.word)).toEqual(['أَمام']);
  });

  it('sorts newest first, keeping undated cards last', () => {
    expect(sortDeck(deck, 'recent').map((c) => c.word)).toEqual(['بَيت', 'أَمام', 'كِتاب', 'جَديد']);
  });

  it('sorts alphabetically ignoring vowels', () => {
    expect(sortDeck(deck, 'az').map((c) => c.word)).toEqual(['أَمام', 'بَيت', 'جَديد', 'كِتاب']);
  });

  it('sorts by next review with words in progress first', () => {
    expect(sortDeck(deck, 'next').map((c) => c.word)).toEqual(['بَيت', 'كِتاب', 'أَمام', 'جَديد']);
  });

  it('groups by root with rootless words last', () => {
    expect(sortDeck(deck, 'root').map((c) => c.word)).toEqual(['أَمام', 'بَيت', 'كِتاب', 'جَديد']);
  });
});
