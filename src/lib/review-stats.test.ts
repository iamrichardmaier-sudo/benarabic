import { describe, it, expect } from 'vitest';
import { dailyCounts, forecast, leeches, lowEase, retention } from './review-stats';
import { daysFromNow, today } from './day';
import type { ReviewEntry } from './review-log';
import type { FlashCard } from './spaced-repetition';

const now = new Date(2026, 10, 10, 15, 0, 0);
const ago = (days: number, hour = 12) => new Date(2026, 10, 10 - days, hour).toISOString();
let n = 0;
const entry = (cardId: string, rating: ReviewEntry['rating'], days: number, kind: ReviewEntry['kind'] = 'review', hour = 12): ReviewEntry =>
  ({ id: `e${n++}`, cardId, rating, kind, at: ago(days, hour) });
const card = (id: string, fields: Partial<FlashCard> = {}): FlashCard => ({
  id, word: id, english: id, imageUrl: null, nextReviewDate: today(now), intervalDays: 5,
  easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0, ...fields,
});

describe('retention', () => {
  it('is the share of timed reviews not answered Again', () => {
    const log = [entry('a', 'good', 1), entry('b', 'again', 1), entry('c', 'easy', 2), entry('d', 'hard', 3)];
    expect(retention(log, 30, now)).toEqual({ reviews: 4, remembered: 3, rate: 0.75 });
  });

  it('counts a card once a day, by its first answer, and leaves practice out', () => {
    const log = [
      entry('a', 'again', 1, 'review', 9), entry('a', 'good', 1, 'review', 10),
      entry('b', 'again', 1, 'cloze'), entry('c', 'good', 40),
    ];
    expect(retention(log, 30, now)).toEqual({ reviews: 1, remembered: 0, rate: 0 });
    expect(retention([], 30, now).rate).toBeNull();
  });
});

describe('dailyCounts', () => {
  it('gives every day of the window, empty ones included', () => {
    const days = dailyCounts([entry('a', 'good', 0), entry('b', 'again', 0), entry('c', 'good', 2)], 7, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ day: today(now), total: 2, forgotten: 1 });
    expect(days[4].total).toBe(1);
    expect(days[5].total).toBe(0);
  });
});

describe('forecast', () => {
  it('puts overdue cards on today and leaves out cards not yet learned', () => {
    const cards = [
      card('late', { nextReviewDate: daysFromNow(-5, now) }),
      card('today'),
      card('soon', { nextReviewDate: daysFromNow(3, now) }),
      card('far', { nextReviewDate: daysFromNow(40, now) }),
      card('new', { learningStage: 'stage1' }),
    ];
    const f = forecast(cards, 14, now);
    expect(f).toHaveLength(14);
    expect(f[0].due).toBe(2);
    expect(f[3].due).toBe(1);
    expect(f.reduce((s, d) => s + d.due, 0)).toBe(3);
  });
});

describe('hard words', () => {
  it('lists cards missed three times or more, most-missed first, practice included', () => {
    const log = [
      entry('a', 'again', 1), entry('a', 'again', 5), entry('a', 'again', 9, 'cloze'), entry('a', 'good', 10),
      entry('b', 'again', 1), entry('b', 'again', 2),
      entry('c', 'again', 1), entry('c', 'again', 2), entry('c', 'again', 3), entry('c', 'again', 4),
      entry('gone', 'again', 1), entry('gone', 'again', 2), entry('gone', 'again', 3),
    ];
    const out = leeches(log, [card('a'), card('b'), card('c')], { now });
    expect(out.map((l) => [l.card.id, l.misses, l.asked])).toEqual([['c', 4, 4], ['a', 3, 4]]);
  });

  it('falls back on ease for cards the scheduler has worn down', () => {
    const out = lowEase([card('easy'), card('hard', { easeFactor: 1.3 }), card('mid', { easeFactor: 1.6 }), card('new', { easeFactor: 1.3, learningStage: 'new' })]);
    expect(out.map((c) => c.id)).toEqual(['hard', 'mid']);
  });
});
