/**
 * The history of graded answers: one entry each time a card is rated in
 * review, and each time a practice mode (fill-in-the-blank, ear training)
 * marks an answer right or wrong.
 *
 * A card keeps only its current schedule, which cannot say how often a word
 * was forgotten or what share of reviews are remembered. Those are worked out
 * from this (see review-stats).
 *
 * Entries wait on the device until the database has them, so a review done
 * offline, or before the table exists, is still counted later.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Rating } from './spaced-repetition';

export type ReviewKind = 'review' | 'ladder' | 'cloze' | 'listen' | 'dictation' | 'pairs';

export interface ReviewEntry {
  id: string;
  cardId: string;
  /** ISO time the answer was graded. */
  at: string;
  kind: ReviewKind;
  rating: Rating;
  intervalBefore?: number | null;
  intervalAfter?: number | null;
}

/** Enough for months of offline study, small enough for storage. */
const MAX_WAITING = 3000;
const keyFor = (userId: string) => `wazn-review-log:${userId}`;

function readWaiting(userId: string): ReviewEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as ReviewEntry[]) : [];
  } catch {
    return [];
  }
}

function writeWaiting(userId: string, entries: ReviewEntry[]): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(entries.slice(-MAX_WAITING)));
  } catch {
    /* storage full or unavailable: the history is a nicety, studying goes on */
  }
}

const toRow = (e: ReviewEntry) => ({
  id: e.id,
  card_id: e.cardId,
  reviewed_at: e.at,
  kind: e.kind,
  rating: e.rating,
  interval_before: e.intervalBefore ?? null,
  interval_after: e.intervalAfter ?? null,
});

let sending = false;

/** Send what is waiting. Safe to call at any time. */
export async function flushReviewLog(userId: string | undefined): Promise<void> {
  if (!userId || sending) return;
  const waiting = readWaiting(userId);
  if (waiting.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  sending = true;
  try {
    // Upsert on the device-made id, so a batch that half-arrived is safe to resend.
    const { error } = await supabase
      .from('review_log' as never)
      .upsert(waiting.map(toRow) as never, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return;
    const sent = new Set(waiting.map((e) => e.id));
    writeWaiting(userId, readWaiting(userId).filter((e) => !sent.has(e.id)));
  } catch {
    /* left waiting for the next attempt */
  } finally {
    sending = false;
  }
}

/** Record one graded answer. Never throws and never blocks the next card. */
export function logReview(
  userId: string | undefined,
  entry: Omit<ReviewEntry, 'id' | 'at'> & { at?: string },
): void {
  if (!userId) return;
  const full: ReviewEntry = { ...entry, id: crypto.randomUUID(), at: entry.at ?? new Date().toISOString() };
  writeWaiting(userId, [...readWaiting(userId), full]);
  void flushReviewLog(userId);
}

interface LogRow {
  id: string;
  card_id: string;
  reviewed_at: string;
  kind: ReviewKind;
  rating: Rating;
  interval_before: number | null;
  interval_after: number | null;
}

/** The last `days` days of history, oldest first, including what has not been sent yet. */
export async function fetchReviewLog(userId: string, days = 90): Promise<ReviewEntry[]> {
  await flushReviewLog(userId);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const waiting = readWaiting(userId).filter((e) => e.at >= since);
  let stored: ReviewEntry[] = [];
  try {
    const { data, error } = await supabase
      .from('review_log' as never)
      .select('id, card_id, reviewed_at, kind, rating, interval_before, interval_after')
      .gte('reviewed_at', since)
      .order('reviewed_at', { ascending: true })
      .limit(20000);
    if (!error && data) {
      stored = (data as unknown as LogRow[]).map((r) => ({
        id: r.id,
        cardId: r.card_id,
        at: r.reviewed_at,
        kind: r.kind,
        rating: r.rating,
        intervalBefore: r.interval_before,
        intervalAfter: r.interval_after,
      }));
    }
  } catch {
    /* offline: what is on the device is still shown */
  }
  const have = new Set(stored.map((e) => e.id));
  return [...stored, ...waiting.filter((e) => !have.has(e.id))].sort((a, b) => a.at.localeCompare(b.at));
}
