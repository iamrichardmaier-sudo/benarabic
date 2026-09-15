import { describe, it, expect } from 'vitest';
import { queueAfterGrade, cardsCovered } from './review-queue';

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
