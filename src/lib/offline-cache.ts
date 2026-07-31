// Local persistence so the deck is usable with no network: a mirror of the
// user's cards, a FIFO queue of writes made while offline, and the list of
// cards still owed a picture. Everything lives in localStorage — the deck is
// small (hundreds of rows) and synchronous reads keep first paint instant.
//
// Every key is namespaced by user id. This project has more than one account,
// and an unscoped cache would show the previous signer-in's deck while offline.

import type { FlashCard } from './spaced-repetition';
import { isOnline } from '@/hooks/useOnlineStatus';

const DECK_KEY = 'arabic-flashcards-deck-cache';
const QUEUE_KEY = 'arabic-flashcards-pending-mutations';
const NEEDS_IMAGE_KEY = 'arabic-flashcards-needs-image';

/** A write that could not reach Supabase yet. Replayed in FIFO order. */
export type PendingMutation =
  | { kind: 'upsert'; cards: FlashCard[] }
  | { kind: 'update'; id: string; updates: Partial<FlashCard> }
  | { kind: 'delete'; id: string };

/** Signed-out sessions still get a slot so nothing leaks into a real account. */
export type CacheScope = string | null | undefined;

function keyFor(base: string, scope: CacheScope): string {
  return `${base}:${scope || 'anonymous'}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded or storage disabled. The app still works while online,
    // so degrade instead of breaking the action the user just took.
    console.error('Offline cache write failed:', err);
  }
}

/**
 * Distinguishes "couldn't reach the server" from "the server rejected this".
 * Postgres and PostgREST errors always carry a code and will fail identically
 * on every retry, so only codeless failures are worth queueing.
 */
export function isNetworkError(err: unknown): boolean {
  if (!isOnline()) return true;
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  if (typeof e.code === 'string' && e.code !== '') return false;
  const message = String(e.message ?? '').toLowerCase();
  return message.includes('fetch') || message.includes('network') || message.includes('load failed');
}

/* ---------------------------------------------------------------- deck --- */

export function readCachedDeck(scope: CacheScope): FlashCard[] {
  return read<FlashCard[]>(keyFor(DECK_KEY, scope), []);
}

export function cacheDeck(scope: CacheScope, cards: FlashCard[]): void {
  write(keyFor(DECK_KEY, scope), cards);
}

/* --------------------------------------------------------------- queue --- */

export function readQueue(scope: CacheScope): PendingMutation[] {
  return read<PendingMutation[]>(keyFor(QUEUE_KEY, scope), []);
}

export function writeQueue(scope: CacheScope, queue: PendingMutation[]): void {
  write(keyFor(QUEUE_KEY, scope), queue);
}

export function queueMutation(scope: CacheScope, mutation: PendingMutation): number {
  const queue = readQueue(scope);
  queue.push(mutation);
  writeQueue(scope, queue);
  return queue.length;
}

/* ------------------------------------------------------- image backfill --- */

/**
 * Cards created while offline have no picture. Their ids are parked here so a
 * later online session can fetch the image without re-checking every card that
 * legitimately has none.
 */
export function readNeedsImage(scope: CacheScope): string[] {
  return read<string[]>(keyFor(NEEDS_IMAGE_KEY, scope), []);
}

export function markNeedsImage(scope: CacheScope, ids: string[]): void {
  if (ids.length === 0) return;
  const merged = new Set([...readNeedsImage(scope), ...ids]);
  write(keyFor(NEEDS_IMAGE_KEY, scope), Array.from(merged));
}

export function unmarkNeedsImage(scope: CacheScope, ids: string[]): void {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  write(keyFor(NEEDS_IMAGE_KEY, scope), readNeedsImage(scope).filter((id) => !drop.has(id)));
}
