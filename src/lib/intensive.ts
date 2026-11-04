import { isoDay, daysFromNow } from './day';

/**
 * The ladder a freshly-graduated card climbs before it joins the long-term
 * rotation: a rep after 12 hours, another after 12 more, then daily, then
 * every other day and a bit — seven looks, the first three inside a day and a
 * half, so a word from this week keeps coming back often.
 *
 * It is measured in time, not in reps-per-day. The earlier version asked for
 * sixteen reps over five days, gave a card one rep per session, and only moved
 * to the next day once that day's reps were done — so it took five days only
 * for someone who opened the app four times a day, sixteen for someone who
 * opened it once, and a card could sit in it for weeks, due every day. Here
 * each rep is scheduled a fixed time after the last one was done, so the
 * ladder is a fixed length however often the app is opened.
 *
 * (The columns are the same as before: `intensive_day` now holds which rep the
 * card is due for, 1 to 7, and `intensive_reps_done` is no longer used.)
 */
export const LADDER_HOURS = [12, 12, 24, 24, 24, 48, 72] as const;

/** How many reps the ladder has. */
export const LADDER_STEPS = LADDER_HOURS.length;

/**
 * Where SM-2 picks up once the ladder is climbed.
 *
 * Seven well-spaced looks is a known card, so it starts a week out.
 */
export const EXIT_INTERVAL_DAYS = 7;

const HOUR_MS = 60 * 60 * 1000;

/** The part of a card this module owns. */
export interface IntensiveState {
  /** The rep the card is due for (1-based), or null for a card in the long-term rotation. */
  intensiveDay: number | null;
  /** No longer used; always 0. Kept so older clients reading the column are not surprised. */
  intensiveRepsDone: number;
  /**
   * The moment the next rep is wanted. Null means the date alone decides, as
   * it always did.
   */
  nextReviewAt: string | null;
}

/** The scheduling fields a review writes. */
export interface IntensiveSchedule extends IntensiveState {
  nextReviewDate: string;
  intervalDays: number;
}

export function isIntensive(card: { intensiveDay?: number | null }): boolean {
  return card.intensiveDay != null;
}

/** The state after a rep is done: due again `hours` from now. */
function dueIn(step: number, hours: number, now: Date): IntensiveSchedule {
  const at = new Date(now.getTime() + hours * HOUR_MS);
  return {
    intensiveDay: step,
    intensiveRepsDone: 0,
    nextReviewAt: at.toISOString(),
    // Usually today or tomorrow; the day the gap lands in.
    nextReviewDate: isoDay(at),
    intervalDays: 1,
  };
}

/**
 * The state a card enters the ladder in when it is learned. Learning it was
 * the first look, so the first rep is a gap away, not at once.
 */
export function startIntensive(now: Date = new Date()): IntensiveSchedule {
  return dueIn(1, LADDER_HOURS[0], now);
}

/**
 * The schedule after one rep of the ladder.
 *
 * Every grade counts as a rep whatever the rating — the ladder is a fixed
 * number of exposures, and the rating shapes the ease the card carries out of
 * it rather than the number of looks it gets inside it.
 */
export function advanceIntensive(
  card: { intensiveDay?: number | null },
  now: Date = new Date(),
): IntensiveSchedule {
  const step = card.intensiveDay ?? 1;

  if (step >= LADDER_STEPS) {
    // The last rep is done. Null the time so the date alone decides, which is
    // what every client that predates the ladder already understands.
    return {
      intensiveDay: null,
      intensiveRepsDone: 0,
      nextReviewAt: null,
      nextReviewDate: daysFromNow(EXIT_INTERVAL_DAYS, now),
      intervalDays: EXIT_INTERVAL_DAYS,
    };
  }
  return dueIn(step + 1, LADDER_HOURS[step], now);
}

/**
 * Whether a card's next-rep time has arrived.
 *
 * Compared as instants, not strings: the app writes `2026-09-15T20:00:00.000Z`
 * and Postgres hands back `2026-09-15T20:00:00+00:00`, which are the same
 * moment and different text.
 */
export function timeHasCome(nextReviewAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!nextReviewAt) return true;
  const at = new Date(nextReviewAt).getTime();
  return Number.isNaN(at) || at <= now.getTime();
}

/** How far up the ladder a card is, for a progress line in the UI. */
export function intensiveProgress(card: {
  intensiveDay?: number | null;
}): { rep: number; totalReps: number } | null {
  if (card.intensiveDay == null) return null;
  return { rep: card.intensiveDay, totalReps: LADDER_STEPS };
}
