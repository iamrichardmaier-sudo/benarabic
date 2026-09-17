import { today, daysFromNow } from '@/lib/day';

/**
 * How a deck joins a learner's collection.
 *
 * Taking up a deck used to mean one thing: every word in it queued up as new,
 * to be learned from scratch. That is wrong for a chapter you have already
 * sat through — the words are not new, they just are not in the app yet — and
 * wrong again for vocabulary you knew years ago and only want kept warm.
 *
 * So a deck arrives in one of three states. None of them changes how the
 * schedule works afterwards: each one only decides where the card starts, and
 * SM-2 takes it from there exactly as it always has.
 */
export type DeckPlacement = 'learn' | 'review' | 'mastered';

/**
 * Where a mastered card's schedule begins.
 *
 * Far enough out to stay out of the way — a month rather than the day a new
 * card gets — but not so far that a word you were wrong about sits unchecked
 * for a year. The first correct answer multiplies it by the ease factor, so a
 * genuinely known word walks out to a quarter and beyond on its own.
 */
export const MASTERED_INTERVAL_DAYS = 30;

/** The flashcard columns a placement decides. */
export interface PlacementFields {
  learning_stage: 'new' | 'graduated';
  next_review_date: string;
  interval_days: number;
  ease_factor: number;
  intensive_day: number | null;
  intensive_reps_done: number;
  next_review_at: string | null;
  placed_as: 'review' | 'mastered' | null;
}

/**
 * The starting state for a card arriving by `placement`.
 *
 * Note that neither of the two shortcuts enters the front-loaded phase. That
 * phase exists to catch a word at its most fragile, in the hours after it was
 * first learned; a word the learner says they already know has no such moment
 * to catch, and four reps a day of it would be exactly the drilling they were
 * trying to avoid.
 */
export function placementFields(
  placement: DeckPlacement,
  now: Date = new Date(),
): PlacementFields {
  const base = {
    ease_factor: 2.5,
    intensive_day: null,
    intensive_reps_done: 0,
    next_review_at: null,
  };

  switch (placement) {
    case 'review':
      return {
        ...base,
        learning_stage: 'graduated',
        next_review_date: today(now),
        interval_days: 1,
        placed_as: 'review',
      };
    case 'mastered':
      return {
        ...base,
        learning_stage: 'graduated',
        next_review_date: daysFromNow(MASTERED_INTERVAL_DAYS, now),
        interval_days: MASTERED_INTERVAL_DAYS,
        placed_as: 'mastered',
      };
    case 'learn':
    default:
      // Unchanged from before placements existed, down to the interval.
      return {
        ...base,
        learning_stage: 'new',
        next_review_date: today(now),
        interval_days: 1,
        placed_as: null,
      };
  }
}

/** The choice as it is offered, in the order it is offered. */
export const PLACEMENTS: { id: DeckPlacement; label: string; hint: string }[] = [
  {
    id: 'learn',
    label: 'Learn',
    hint: 'New words, learned from scratch',
  },
  {
    id: 'review',
    label: 'Review',
    hint: 'Already known — start reviewing today',
  },
  {
    id: 'mastered',
    label: 'Mastered',
    hint: `Kept warm, roughly every ${MASTERED_INTERVAL_DAYS} days`,
  },
];

/** Where the words went, for the line shown after adding. */
export function placementNote(placement: DeckPlacement, cards: number): string {
  const words = `${cards} new word${cards === 1 ? '' : 's'}`;
  switch (placement) {
    case 'review':
      return `${words} in your review rotation, due today`;
    case 'mastered':
      return `${words} parked as mastered, back in ${MASTERED_INTERVAL_DAYS} days`;
    case 'learn':
    default:
      return `${words} waiting in Learn`;
  }
}
