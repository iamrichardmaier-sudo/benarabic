import { describe, it, expect } from 'vitest';
import {
  placementFields, placementNote, PLACEMENTS,
  MASTERED_INTERVAL_DAYS, type DeckPlacement,
} from './deck-placement';
import { getDueCards, getLearnableCards, createCard, type FlashCard } from './spaced-repetition';
import { today, daysFromNow } from './day';

const NOW = new Date(2026, 8, 17, 12, 0, 0);

/** A card as it would be written by an add, read back through the app's shape. */
function placed(placement: DeckPlacement): FlashCard {
  const f = placementFields(placement, NOW);
  return {
    ...createCard('كَلِمة', 'word'),
    learningStage: f.learning_stage,
    nextReviewDate: f.next_review_date,
    intervalDays: f.interval_days,
    easeFactor: f.ease_factor,
    intensiveDay: f.intensive_day,
    intensiveRepsDone: f.intensive_reps_done,
    nextReviewAt: f.next_review_at,
    placedAs: f.placed_as,
  };
}

describe('placementFields', () => {
  it('leaves the learn path exactly as it was before placements existed', () => {
    // This is the regression guard: taking a deck up the ordinary way must
    // still write a brand-new card due today on a one-day interval.
    expect(placementFields('learn', NOW)).toEqual({
      learning_stage: 'new',
      next_review_date: today(NOW),
      interval_days: 1,
      ease_factor: 2.5,
      intensive_day: null,
      intensive_reps_done: 0,
      next_review_at: null,
      placed_as: null,
    });
  });

  it('puts a review deck straight into the rotation, due today', () => {
    const f = placementFields('review', NOW);
    expect(f.learning_stage).toBe('graduated');
    expect(f.next_review_date).toBe(today(NOW));
    expect(f.placed_as).toBe('review');
  });

  it('parks a mastered deck a month out', () => {
    const f = placementFields('mastered', NOW);
    expect(f.learning_stage).toBe('graduated');
    expect(f.next_review_date).toBe(daysFromNow(MASTERED_INTERVAL_DAYS, NOW));
    expect(f.interval_days).toBe(MASTERED_INTERVAL_DAYS);
    expect(f.placed_as).toBe('mastered');
  });

  it('never starts the front-loaded phase for a deck the learner already knows', () => {
    // Four reps a day is for a word just learned. Drilling a deck that was
    // added *because* it is known would be the opposite of what was asked.
    for (const p of ['review', 'mastered'] as DeckPlacement[]) {
      const f = placementFields(p, NOW);
      expect(f.intensive_day).toBeNull();
      expect(f.next_review_at).toBeNull();
    }
  });

  it('a mastered deck comes back later than a review deck', () => {
    expect(placementFields('mastered', NOW).next_review_date > placementFields('review', NOW).next_review_date)
      .toBe(true);
  });
});

describe('what the queues do with each placement', () => {
  it('sends a learn deck to Learn and not to Review', () => {
    const card = placed('learn');
    expect(getLearnableCards([card])).toHaveLength(1);
    expect(getDueCards([card], NOW)).toHaveLength(0);
  });

  it('sends a review deck to Review and not to Learn', () => {
    const card = placed('review');
    expect(getLearnableCards([card])).toHaveLength(0);
    expect(getDueCards([card], NOW)).toHaveLength(1);
  });

  it('keeps a mastered deck out of both until its month is up', () => {
    const card = placed('mastered');
    expect(getLearnableCards([card])).toHaveLength(0);
    expect(getDueCards([card], NOW)).toHaveLength(0);

    const later = new Date(NOW.getTime() + MASTERED_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    expect(getDueCards([card], later)).toHaveLength(1);
  });
});

describe('the choice as it is offered', () => {
  it('offers the three, learn first', () => {
    expect(PLACEMENTS.map((p) => p.id)).toEqual(['learn', 'review', 'mastered']);
  });

  it('says where the words went, in words', () => {
    expect(placementNote('learn', 3)).toContain('waiting in Learn');
    expect(placementNote('review', 3)).toContain('due today');
    expect(placementNote('mastered', 3)).toContain(String(MASTERED_INTERVAL_DAYS));
  });

  it('counts one word as one word', () => {
    expect(placementNote('learn', 1)).toContain('1 new word ');
    expect(placementNote('learn', 2)).toContain('2 new words');
  });
});
