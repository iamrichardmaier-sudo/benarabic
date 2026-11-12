import { daysFromNow } from './day';
import { MASTERED_INTERVAL_DAYS } from './deck-placement';
import { getDueCards, scheduleFields, type FlashCard } from './spaced-repetition';

/**
 * Taking a deck's cards out of the daily review, or moving them along.
 *
 * Both are done with the schedule fields every part of the app (and the phone
 * widget) already reads — interval, due date, ease — rather than a new flag
 * that each of them would have to learn about. Only cards that are in the
 * review rotation (graduated) are touched; a card still being learned has no
 * review schedule to move.
 */

/** "As though it had been easy for three weeks." */
export const ADVANCE_DAYS = 21;

const MAX_EASE = 2.5;

/** The same growth an Easy rating gives in reviewCard. */
const EASY_FACTOR = 1.3;

/** Cards that are in the review rotation. */
export const inRotation = (cards: FlashCard[]) => cards.filter((c) => c.learningStage === 'graduated');

export interface ReviewCounts {
  /** In the review rotation. */
  inReview: number;
  /** Of those, due today or earlier. */
  due: number;
  /** Still being learned, so untouched by anything here. */
  learning: number;
}

export function reviewCounts(cards: FlashCard[], now: Date = new Date()): ReviewCounts {
  const rotation = inRotation(cards);
  const dueIds = new Set(getDueCards(rotation, now).map((c) => c.id));
  return { inReview: rotation.length, due: dueIds.size, learning: cards.length - rotation.length };
}

/** The later of two yyyy-mm-dd days. */
const later = (a: string, b: string) => (a > b ? a : b);

/** Whole days from today to a yyyy-mm-dd day (negative once it has passed). */
function daysUntil(day: string, now: Date): number {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(y, m - 1, d).getTime() - start) / 86_400_000);
}

/**
 * Where a card would be if the next three weeks of its reviews had all been
 * Easy. Reviews happen when a card falls due, so the first is on its due date;
 * each one multiplies the interval, the next falls when that interval is up,
 * and so on until the next due date lands past the three weeks. That date,
 * counted from today, is when the card actually comes back.
 *
 * Returns null for a card that would not have been reviewed at all in that
 * time (it is not due for longer than that), since there is nothing to move.
 * A card in the front-loaded first days is taken out of that phase, since the
 * point is fewer reviews.
 */
export function advanceAsEasy(card: FlashCard, days: number = ADVANCE_DAYS, now: Date = new Date()): Partial<FlashCard> | null {
  let elapsed = Math.max(0, daysUntil(card.nextReviewDate, now));
  if (elapsed > days) return null;
  let interval = Math.max(1, card.intervalDays);
  let ease = card.easeFactor;
  for (let guard = 0; guard < 60; guard++) {
    interval = Math.max(1, Math.round(interval * ease * EASY_FACTOR));
    ease = Math.min(MAX_EASE, ease + 0.1);
    if (elapsed + interval > days) break;
    elapsed += interval;
  }
  const remaining = Math.max(1, elapsed + interval - days);
  return {
    learningStage: 'graduated',
    intervalDays: Math.max(interval, card.intervalDays),
    easeFactor: ease,
    nextReviewDate: daysFromNow(remaining, now),
    intensiveDay: null,
    intensiveRepsDone: 0,
    nextReviewAt: null,
  };
}

/**
 * Out of the daily review for about a month: the same standing a deck added as
 * "mastered" gets. It comes back for a check then, and a word that is truly
 * known walks out further on its own from there. A card already due later than
 * that stays where it is.
 */
export function parkAsMastered(card: FlashCard, now: Date = new Date()): Partial<FlashCard> {
  return {
    learningStage: 'graduated',
    intervalDays: Math.max(card.intervalDays, MASTERED_INTERVAL_DAYS),
    nextReviewDate: later(daysFromNow(MASTERED_INTERVAL_DAYS, now), card.nextReviewDate),
    placedAs: 'mastered',
    intensiveDay: null,
    intensiveRepsDone: 0,
    nextReviewAt: null,
  };
}

/** What a card's schedule was, so an action can be undone exactly. */
export function scheduleSnapshot(card: FlashCard): Partial<FlashCard> {
  return { ...scheduleFields(card), placedAs: card.placedAs ?? null };
}
