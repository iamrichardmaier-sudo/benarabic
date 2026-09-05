/**
 * The calendar day a learner is actually living in.
 *
 * Every review date in the deck is a bare `yyyy-mm-dd` with no time and no
 * zone — "the day this card comes back" — so the day it is compared against
 * has to be the reader's own. `toISOString()` gives the day in UTC, which is
 * a different day for most of the world for part of every day: in Utah it
 * rolls over at 6pm, so an evening study session was served tomorrow's cards
 * and stamped its answers with tomorrow's date.
 *
 * The Scriptable widget has always computed the day this way, which is why it
 * and the web app disagreed for the last six hours of each day.
 */
export function today(now: Date = new Date()): string {
  return isoDay(now);
}

/** `date` as a local `yyyy-mm-dd`, ignoring the time of day entirely. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The local day `days` days from now — how a new interval becomes a date. */
export function daysFromNow(days: number, now: Date = new Date()): string {
  const then = new Date(now);
  then.setDate(then.getDate() + days);
  return isoDay(then);
}
