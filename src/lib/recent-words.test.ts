import { describe, it, expect } from 'vitest';
import { learnedRecently, RECENT_DAYS } from './recent-words';
import { createCard, type FlashCard } from './spaced-repetition';

const NOW = new Date(2026, 8, 17, 12, 0, 0);

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function card(over: Partial<FlashCard>): FlashCard {
  return {
    ...createCard('كَلِمة', 'word'),
    learningStage: 'graduated',
    createdAt: daysAgo(1),
    ...over,
  };
}

describe('learnedRecently', () => {
  it('takes the words learned inside the window', () => {
    const got = learnedRecently([card({ id: 'a', createdAt: daysAgo(2) })], RECENT_DAYS, NOW);
    expect(got.map((c) => c.id)).toEqual(['a']);
  });

  it('leaves out anything older than the window', () => {
    expect(learnedRecently([card({ createdAt: daysAgo(9) })], RECENT_DAYS, NOW)).toHaveLength(0);
  });

  it('leaves out a card that has not been learned yet', () => {
    // Added this week but still in the learning stages, so there is nothing
    // to practise — it is already in the Learn queue.
    expect(learnedRecently([card({ learningStage: 'stage1' })], RECENT_DAYS, NOW)).toHaveLength(0);
  });

  it('takes them newest first', () => {
    const got = learnedRecently(
      [
        card({ id: 'old', createdAt: daysAgo(5) }),
        card({ id: 'new', createdAt: daysAgo(1) }),
        card({ id: 'mid', createdAt: daysAgo(3) }),
      ],
      RECENT_DAYS,
      NOW,
    );
    expect(got.map((c) => c.id)).toEqual(['new', 'mid', 'old']);
  });

  it('ignores a card with no date rather than guessing', () => {
    expect(learnedRecently([card({ createdAt: null })], RECENT_DAYS, NOW)).toHaveLength(0);
  });

  it('does not let an unreadable date pull an old card in', () => {
    expect(learnedRecently([card({ createdAt: 'not a date' })], RECENT_DAYS, NOW)).toHaveLength(0);
  });

  it('includes a card regardless of whether it is due', () => {
    // The whole point: these come up on demand, not when the schedule says so.
    const far = card({ id: 'far', nextReviewDate: '2027-01-01', intervalDays: 90 });
    expect(learnedRecently([far], RECENT_DAYS, NOW).map((c) => c.id)).toEqual(['far']);
  });
});
