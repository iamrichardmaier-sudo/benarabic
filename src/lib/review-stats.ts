/**
 * What the review history says: how much is remembered, how much work is
 * coming, and which words keep being forgotten.
 *
 * Pure: everything is worked out from the entries and cards handed in, so the
 * screen can show it offline and the arithmetic can be tested.
 */
import { today, daysFromNow } from './day';
import type { FlashCard } from './spaced-repetition';
import type { ReviewEntry } from './review-log';

const DAY_MS = 86_400_000;

/** A timed review, as opposed to a practice mode that reschedules nothing. */
export const isScheduled = (e: ReviewEntry) => e.kind === 'review' || e.kind === 'ladder';

const since = (entries: ReviewEntry[], days: number, now: Date) => {
  const cutoff = new Date(now.getTime() - days * DAY_MS).toISOString();
  return entries.filter((e) => e.at >= cutoff);
};

export interface Retention {
  reviews: number;
  remembered: number;
  /** 0 to 1, or null when there is nothing to judge by. */
  rate: number | null;
}

/**
 * The share of timed reviews that were remembered (anything but Again).
 *
 * A card sent to the back of a session by Again is graded a second time
 * minutes later; only the first answer for a card on a day counts, since the
 * second is not a test of memory.
 */
export function retention(entries: ReviewEntry[], days = 30, now: Date = new Date()): Retention {
  const seen = new Set<string>();
  let reviews = 0;
  let remembered = 0;
  for (const e of since(entries, days, now)) {
    if (!isScheduled(e)) continue;
    const key = `${e.cardId}:${today(new Date(e.at))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reviews++;
    if (e.rating !== 'again') remembered++;
  }
  return { reviews, remembered, rate: reviews ? remembered / reviews : null };
}

export interface DayCount {
  /** yyyy-mm-dd, local. */
  day: string;
  total: number;
  forgotten: number;
}

/** Answers graded on each of the last `days` days, oldest first, empty days included. */
export function dailyCounts(entries: ReviewEntry[], days = 30, now: Date = new Date()): DayCount[] {
  const byDay = new Map<string, DayCount>();
  for (let i = days - 1; i >= 0; i--) {
    const day = today(new Date(now.getTime() - i * DAY_MS));
    byDay.set(day, { day, total: 0, forgotten: 0 });
  }
  for (const e of entries) {
    const slot = byDay.get(today(new Date(e.at)));
    if (!slot) continue;
    slot.total++;
    if (e.rating === 'again') slot.forgotten++;
  }
  return [...byDay.values()];
}

export interface DueCount {
  day: string;
  due: number;
}

/**
 * Cards falling due on each of the next `days` days. Today includes
 * everything overdue, since that is what today's session will hold.
 */
export function forecast(cards: FlashCard[], days = 14, now: Date = new Date()): DueCount[] {
  const out: DueCount[] = [];
  const index = new Map<string, DueCount>();
  for (let i = 0; i < days; i++) {
    const slot = { day: daysFromNow(i, now), due: 0 };
    out.push(slot);
    index.set(slot.day, slot);
  }
  const first = out[0].day;
  for (const c of cards) {
    if (c.learningStage !== 'graduated' || !c.nextReviewDate) continue;
    const slot = c.nextReviewDate <= first ? out[0] : index.get(c.nextReviewDate);
    if (slot) slot.due++;
  }
  return out;
}

export interface Leech {
  card: FlashCard;
  /** Times forgotten in the window. */
  misses: number;
  /** Times asked in the window. */
  asked: number;
}

/**
 * Words that keep being forgotten: missed at least `minMisses` times in the
 * window, most-missed first. Practice modes count too — a word missed in a
 * fill-in-the-blank is a word not known.
 */
export function leeches(
  entries: ReviewEntry[],
  cards: FlashCard[],
  { days = 60, minMisses = 3, now = new Date() }: { days?: number; minMisses?: number; now?: Date } = {},
): Leech[] {
  const tally = new Map<string, { misses: number; asked: number }>();
  for (const e of since(entries, days, now)) {
    const t = tally.get(e.cardId) ?? { misses: 0, asked: 0 };
    t.asked++;
    if (e.rating === 'again') t.misses++;
    tally.set(e.cardId, t);
  }
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out: Leech[] = [];
  for (const [id, t] of tally) {
    const card = byId.get(id);
    if (card && t.misses >= minMisses) out.push({ card, ...t });
  }
  return out.sort((a, b) => b.misses - a.misses || b.asked - a.asked);
}

/**
 * Words the scheduler itself has marked as hard: ease worn down close to its
 * floor. This needs no history, so it can name trouble from before the
 * history began.
 */
export function lowEase(cards: FlashCard[], limit = 20): FlashCard[] {
  return cards
    .filter((c) => c.learningStage === 'graduated' && c.easeFactor > 0 && c.easeFactor <= 1.6)
    .sort((a, b) => a.easeFactor - b.easeFactor)
    .slice(0, limit);
}
