import { describe, it, expect, afterEach, vi } from 'vitest';
import { today, isoDay, daysFromNow } from './day';
import { getDueCards, type FlashCard } from './spaced-repetition';

/**
 * The evening rollover, pinned.
 *
 * A review date in the deck is a bare calendar day, so "is this card due?"
 * has to be asked against the reader's own day. Asking in UTC made the site
 * roll over at 6pm in Utah: it served tomorrow's cards all evening while the
 * Scriptable widget, which had always read the local clock, correctly said
 * nothing was left. Node re-reads process.env.TZ per call, so the two zones
 * can be put side by side here rather than described.
 */
const REAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = REAL_TZ;
});

/** 5 September 2026, 02:25 UTC — the night the two disagreed. */
const INSTANT = Date.UTC(2026, 8, 5, 2, 25);

describe('today', () => {
  it('is still the 4th at 8:25pm in Utah', () => {
    process.env.TZ = 'America/Denver';
    expect(today(new Date(INSTANT))).toBe('2026-09-04');
  });

  it('is the 5th at the same instant in London', () => {
    process.env.TZ = 'Europe/London';
    expect(today(new Date(INSTANT))).toBe('2026-09-05');
  });

  it('does not change as the evening wears on', () => {
    process.env.TZ = 'America/Denver';
    const hours = Array.from({ length: 24 }, (_, h) =>
      today(new Date(2026, 8, 4, h, 30)),
    );
    expect(new Set(hours)).toEqual(new Set(['2026-09-04']));
  });
});

describe('isoDay', () => {
  it('pads a single-digit month and day', () => {
    expect(isoDay(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });
});

describe('daysFromNow', () => {
  it('counts calendar days, not 24-hour spans', () => {
    process.env.TZ = 'America/Denver';
    // Late on the 4th plus one day is the 5th, not the 6th — which is what
    // the UTC conversion used to produce for an evening review.
    expect(daysFromNow(1, new Date(INSTANT))).toBe('2026-09-05');
  });

  it('crosses a month boundary', () => {
    expect(daysFromNow(3, new Date(2026, 8, 29, 9))).toBe('2026-10-02');
  });
});

describe('getDueCards across the rollover', () => {
  const card = (nextReviewDate: string): FlashCard =>
    ({
      id: nextReviewDate, word: 'كَتَبَ', english: 'to write', imageUrl: null,
      nextReviewDate, intervalDays: 1, easeFactor: 2.5,
      learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0,
    }) as FlashCard;

  const deck = [card('2026-09-03'), card('2026-09-04'), card('2026-09-05')];

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not hand out the 5th while it is still the 4th in Utah', () => {
    process.env.TZ = 'America/Denver';
    vi.useFakeTimers();
    vi.setSystemTime(INSTANT);
    expect(getDueCards(deck).map((c) => c.nextReviewDate))
      .toEqual(['2026-09-03', '2026-09-04']);
  });

  it('hands it out once local midnight passes', () => {
    process.env.TZ = 'America/Denver';
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 8, 5, 6, 5)); // 12:05am on the 5th
    expect(getDueCards(deck)).toHaveLength(3);
  });

  it('would have handed it out early under the old UTC reading', () => {
    // The same instant, read in UTC, is already the 5th — which is what the
    // site was comparing against, six hours ahead of the learner.
    expect(new Date(INSTANT).toISOString().slice(0, 10)).toBe('2026-09-05');
  });
});
