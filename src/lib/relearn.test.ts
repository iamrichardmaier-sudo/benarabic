import { describe, it, expect } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import { NOT_IN_A_DECK, practiceCopy, sectionsByDeck, type DeckMembership } from './relearn';

const card = (word: string, wordId: string | null): FlashCard => ({ ...createCard(word, word), wordId });
const deck = (id: string, title: string, ...wordIds: string[]): DeckMembership => ({ id, title, wordIds: new Set(wordIds) });

const house = card('بيت', 'w1');
const book = card('كتاب', 'w2');
const wedding = card('عرس', 'w3');
const typed = card('شمس', null);

describe('sectionsByDeck', () => {
  it('puts each card under the deck that holds its word, then the rest', () => {
    const s = sectionsByDeck([house, book, wedding, typed], [deck('d2', 'Celebrations', 'w3'), deck('d1', 'Home', 'w1', 'w2')]);
    expect(s.map((x) => [x.name, x.cards.map((c) => c.word)])).toEqual([
      ['Celebrations', ['عرس']],
      ['Home', ['بيت', 'كتاب']],
      ['Not in a deck', ['شمس']],
    ]);
    expect(s[2].id).toBe(NOT_IN_A_DECK);
  });

  it('orders decks by chapter, not alphabetically', () => {
    const s = sectionsByDeck([house, book, wedding], [
      deck('a', 'Chapter 10', 'w3'),
      deck('b', 'Chapter 2', 'w1'),
      deck('c', 'Chapter 1', 'w2'),
    ]);
    expect(s.map((x) => x.name)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 10']);
  });

  it('lists a card under every deck that holds it', () => {
    const s = sectionsByDeck([house], [deck('a', 'A', 'w1'), deck('b', 'B', 'w1')]);
    expect(s.map((x) => x.name)).toEqual(['A', 'B']);
    expect(s[0].cards[0]).toBe(s[1].cards[0]);
  });

  it('leaves out a deck with none of the learner\'s cards, and has no "not in a deck" when all are placed', () => {
    const s = sectionsByDeck([house], [deck('a', 'A', 'w1'), deck('b', 'Empty', 'zzz')]);
    expect(s.map((x) => x.name)).toEqual(['A']);
  });

  it('keeps two decks with the same title apart', () => {
    const s = sectionsByDeck([house, book], [deck('a', 'Same', 'w1'), deck('b', 'Same', 'w2')]);
    expect(s.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('puts everything under "not in a deck" when no deck is known', () => {
    const s = sectionsByDeck([house, typed], []);
    expect(s).toHaveLength(1);
    expect(s[0].cards).toHaveLength(2);
  });
});

describe('practiceCopy', () => {
  it('starts the card over in memory and leaves the stored schedule alone', () => {
    const stored: FlashCard = {
      ...house, learningStage: 'graduated', intervalDays: 30, easeFactor: 2.1,
      nextReviewDate: '2026-12-01', stage1Attempts: 4, stage2Attempts: 3,
    };
    const copy = practiceCopy(stored);
    expect([copy.learningStage, copy.stage1Attempts, copy.stage2Attempts]).toEqual(['new', 0, 0]);
    // The schedule fields come through unchanged, and the original is untouched.
    expect([copy.intervalDays, copy.easeFactor, copy.nextReviewDate]).toEqual([30, 2.1, '2026-12-01']);
    expect([stored.learningStage, stored.stage1Attempts, stored.stage2Attempts]).toEqual(['graduated', 4, 3]);
  });
});
