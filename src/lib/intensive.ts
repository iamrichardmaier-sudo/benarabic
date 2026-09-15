import { isoDay, daysFromNow } from './day';

/**
 * The front-loaded schedule a freshly-graduated card runs before it joins the
 * long-term rotation.
 *
 * A card that has just been learned is at its most fragile, and the old
 * schedule gave it one look a day from the start. These five days give it
 * sixteen, spaced through each day rather than massed into one sitting —
 * after which the card hands over to SM-2 and behaves exactly as it always
 * has. Cards already in the long-term rotation never enter this phase.
 */
export const REPS_PER_DAY = [4, 4, 4, 2, 2] as const;

/** How long the phase lasts, in days. */
export const INTENSIVE_DAYS = REPS_PER_DAY.length;

/**
 * The wait between one rep and the next within a day.
 *
 * Three looks in one sitting is worth little more than one look; the gap is
 * what makes the repetition count. Four reps three hours apart spans a normal
 * waking day.
 */
export const GAP_HOURS = 3;

/**
 * Where SM-2 picks up once the phase is over.
 *
 * Sixteen exposures across five days is a well-known card, so it starts
 * further out than the one day a graduating card used to get.
 */
export const EXIT_INTERVAL_DAYS = 3;

/** The part of a card this module owns. */
export interface IntensiveState {
  /** 1-based day of the phase, or null for a card in the long-term rotation. */
  intensiveDay: number | null;
  /** Reps already done on the current day of the phase. */
  intensiveRepsDone: number;
  /**
   * The moment the card is next wanted, for a card whose next rep is later
   * today. Null means the date alone decides, as it always did.
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

/** How many reps the given day of the phase asks for. */
export function repsForDay(day: number): number {
  return REPS_PER_DAY[day - 1] ?? 0;
}

/** The state a card enters the phase in: day one, due immediately. */
export function startIntensive(now: Date = new Date()): IntensiveSchedule {
  return {
    intensiveDay: 1,
    intensiveRepsDone: 0,
    nextReviewAt: now.toISOString(),
    nextReviewDate: isoDay(now),
    intervalDays: 1,
  };
}

/**
 * The schedule after one rep of the phase.
 *
 * Every grade counts as a rep whatever the rating — the phase is a fixed
 * number of exposures, and the rating shapes the ease the card carries out of
 * it rather than the number of looks it gets inside it.
 */
export function advanceIntensive(
  card: { intensiveDay?: number | null; intensiveRepsDone?: number },
  now: Date = new Date(),
): IntensiveSchedule {
  const day = card.intensiveDay ?? 1;
  const reps = (card.intensiveRepsDone ?? 0) + 1;

  if (reps < repsForDay(day)) {
    const at = new Date(now.getTime() + GAP_HOURS * 60 * 60 * 1000);
    return {
      intensiveDay: day,
      intensiveRepsDone: reps,
      nextReviewAt: at.toISOString(),
      // Usually today; the day the gap lands in, when it crosses midnight.
      nextReviewDate: isoDay(at),
      intervalDays: 1,
    };
  }

  // The day is done. Null the time so the date alone decides, which is what
  // every client that predates this phase already understands.
  const nextDay = day + 1;
  if (nextDay > INTENSIVE_DAYS) {
    return {
      intensiveDay: null,
      intensiveRepsDone: 0,
      nextReviewAt: null,
      nextReviewDate: daysFromNow(EXIT_INTERVAL_DAYS, now),
      intervalDays: EXIT_INTERVAL_DAYS,
    };
  }
  return {
    intensiveDay: nextDay,
    intensiveRepsDone: 0,
    nextReviewAt: null,
    nextReviewDate: daysFromNow(1, now),
    intervalDays: 1,
  };
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

/** How far through the phase a card is, for the progress line in the UI. */
export function intensiveProgress(card: {
  intensiveDay?: number | null;
  intensiveRepsDone?: number;
}): { day: number; totalDays: number; repsDone: number; repsToday: number } | null {
  if (card.intensiveDay == null) return null;
  return {
    day: card.intensiveDay,
    totalDays: INTENSIVE_DAYS,
    repsDone: card.intensiveRepsDone ?? 0,
    repsToday: repsForDay(card.intensiveDay),
  };
}
