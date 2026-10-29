import { describe, it, expect } from 'vitest';
import { queueAfterGrade, cardsCovered, sessionItems } from './review-queue';
import { createCard, type FlashCard } from './spaced-repetition';

const items = [
  { card: { id: 'a' }, direction: 'ar-to-en' },
  { card: { id: 'b' }, direction: 'ar-to-en' },
  { card: { id: 'a' }, direction: 'en-to-ar' },
];

describe('queueAfterGrade', () => {
  it('sends an "Again" card to the back so it comes round this session', () => {
    const next = queueAfterGrade(items, 0, 'again');
    expect(next.map((i) => i.card.id)).toEqual(['a', 'b', 'a', 'a']);
    // Requeued in the same direction it was asked in, not a fresh one.
    expect(next[3].direction).toBe('ar-to-en');
  });

  it('requeues the item as it was, so the retry overwrites the lapse', () => {
    // Same object: it carries the card from before the grade, so grading it
    // again computes from the same starting point rather than compounding.
    const next = queueAfterGrade(items, 1, 'again');
    expect(next[3]).toBe(items[1]);
  });

  it('leaves the queue alone for every other rating', () => {
    for (const rating of ['hard', 'good', 'easy'] as const) {
      expect(queueAfterGrade(items, 0, rating)).toBe(items);
    }
  });

  it('does not grow the queue when the index is past the end', () => {
    expect(queueAfterGrade(items, 9, 'again')).toBe(items);
  });

  it('can requeue the same card more than once', () => {
    let q = queueAfterGrade(items, 0, 'again');
    q = queueAfterGrade(q, 3, 'again');
    expect(q.map((i) => i.card.id)).toEqual(['a', 'b', 'a', 'a', 'a']);
  });
});

describe('cardsCovered', () => {
  it('counts cards, not prompts', () => {
    // Two directions of "a" plus one of "b" is two cards.
    expect(cardsCovered(items)).toBe(2);
  });

  it('does not count a requeued card twice', () => {
    expect(cardsCovered(queueAfterGrade(items, 0, 'again'))).toBe(2);
  });

  it('is zero for an empty session', () => {
    expect(cardsCovered([])).toBe(0);
  });
});

describe('sessionItems', () => {
  const word = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'noun' });
  const sentence = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'sentence' });
  const due = [word('بيت'), sentence('شو بدك'), word('كتاب')];
  const words = (items: { card: FlashCard }[]) => [...new Set(items.map((i) => i.card.word))].sort();

  it('reviews both kinds: a word each way, a sentence once', () => {
    const items = sessionItems(due, 'both');
    expect(items).toHaveLength(5);
    expect(words(items)).toEqual(['بيت', 'شو بدك', 'كتاب']);
    expect(items.filter((i) => i.card.word === 'شو بدك')).toHaveLength(1);
  });

  it('reviews just the vocab', () => {
    const items = sessionItems(due, 'words');
    expect(words(items)).toEqual(['بيت', 'كتاب']);
    expect(items.map((i) => i.direction).sort()).toEqual(['ar-to-en', 'ar-to-en', 'en-to-ar', 'en-to-ar']);
  });

  it('reviews just the sentences', () => {
    expect(words(sessionItems(due, 'sentences'))).toEqual(['شو بدك']);
    expect(sessionItems([word('بيت')], 'sentences')).toEqual([]);
  });
});
