import { describe, it, expect } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import { daysFromNow } from './day';
import {
  ADVANCE_DAYS, advanceAsEasy, parkAsMastered, reviewCounts, scheduleSnapshot,
} from './deck-review';

const NOW = new Date(2026, 10, 3, 12);
const reviewed = (over: Partial<FlashCard> = {}): FlashCard => ({
  ...createCard('بيت', 'house'),
  learningStage: 'graduated',
  intervalDays: 1,
  easeFactor: 2.5,
  nextReviewDate: daysFromNow(0, NOW),
  ...over,
});

describe('advanceAsEasy', () => {
  it('replays three weeks of Easy reviews: 1 day becomes a 33-day interval, due in 25 days', () => {
    // 1 -> 3 (day 3) -> 10 (day 13) -> 33 (day 46), which is 25 days past the 21.
    const out = advanceAsEasy(reviewed(), ADVANCE_DAYS, NOW)!;
    expect(out.intervalDays).toBe(33);
    expect(out.nextReviewDate).toBe(daysFromNow(25, NOW));
    expect(out.learningStage).toBe('graduated');
  });

  it('starts from the card\'s due date: one due in 5 days with a 4-day interval ends 39 days out', () => {
    // Review on day 5 -> 13 (day 18) -> 42 (day 60), 39 days past the 21.
    const out = advanceAsEasy(reviewed({ intervalDays: 4, nextReviewDate: daysFromNow(5, NOW) }), ADVANCE_DAYS, NOW)!;
    expect(out.intervalDays).toBe(42);
    expect(out.nextReviewDate).toBe(daysFromNow(39, NOW));
  });

  it('leaves a card alone that would not have been reviewed in those three weeks', () => {
    expect(advanceAsEasy(reviewed({ intervalDays: 150, nextReviewDate: daysFromNow(200, NOW) }), ADVANCE_DAYS, NOW)).toBeNull();
    expect(advanceAsEasy(reviewed({ nextReviewDate: daysFromNow(22, NOW) }), ADVANCE_DAYS, NOW)).toBeNull();
  });

  it('treats an overdue card as due today', () => {
    const out = advanceAsEasy(reviewed({ nextReviewDate: daysFromNow(-9, NOW) }), ADVANCE_DAYS, NOW)!;
    expect(out.nextReviewDate).toBe(daysFromNow(25, NOW));
  });

  it('takes a card out of the front-loaded first days', () => {
    const out = advanceAsEasy(reviewed({ intensiveDay: 2, intensiveRepsDone: 1, nextReviewAt: '2026-11-03T18:00:00Z' }), ADVANCE_DAYS, NOW)!;
    expect([out.intensiveDay, out.intensiveRepsDone, out.nextReviewAt]).toEqual([null, 0, null]);
  });

  it('keeps the ease within the scheduler\'s ceiling', () => {
    expect((advanceAsEasy(reviewed({ easeFactor: 1.4 }), ADVANCE_DAYS, NOW)!.easeFactor as number) <= 2.5).toBe(true);
  });

  it('always lands at least a day out', () => {
    const out = advanceAsEasy(reviewed({ intervalDays: 7 }), 0, NOW)!;
    expect((out.nextReviewDate as string) > daysFromNow(0, NOW)).toBe(true);
  });
});

describe('parkAsMastered', () => {
  it('moves a due card out for 30 days and marks it mastered', () => {
    const out = parkAsMastered(reviewed({ intervalDays: 4 }), NOW);
    expect(out.nextReviewDate).toBe(daysFromNow(30, NOW));
    expect(out.intervalDays).toBe(30);
    expect(out.placedAs).toBe('mastered');
  });

  it('leaves a card that is already due later than that where it is', () => {
    const far = daysFromNow(90, NOW);
    const out = parkAsMastered(reviewed({ intervalDays: 90, nextReviewDate: far }), NOW);
    expect(out.nextReviewDate).toBe(far);
    expect(out.intervalDays).toBe(90);
  });
});

describe('reviewCounts', () => {
  it('counts what is in review, what is due, and what is still being learned', () => {
    const cards = [
      reviewed({ nextReviewDate: daysFromNow(-1, NOW) }),
      reviewed({ nextReviewDate: daysFromNow(5, NOW) }),
      { ...createCard('كتاب', 'book'), learningStage: 'stage1' as const },
    ];
    expect(reviewCounts(cards, NOW)).toEqual({ inReview: 2, due: 1, learning: 1 });
  });
});

describe('scheduleSnapshot', () => {
  it('captures the schedule so an action can be put back exactly', () => {
    const card = reviewed({ intervalDays: 12, easeFactor: 2.1, nextReviewDate: '2026-11-20', placedAs: 'review' });
    const snap = scheduleSnapshot(card);
    expect([snap.intervalDays, snap.easeFactor, snap.nextReviewDate, snap.placedAs]).toEqual([12, 2.1, '2026-11-20', 'review']);
    expect(scheduleSnapshot(reviewed()).placedAs).toBeNull();
  });
});
