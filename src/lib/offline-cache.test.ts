import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheDeck,
  readCachedDeck,
  readQueue,
  queueMutation,
  writeQueue,
  markNeedsImage,
  readNeedsImage,
  unmarkNeedsImage,
  isNetworkError,
} from './offline-cache';
import { createCard } from './spaced-repetition';

const ALICE = 'user-alice';
const BOB = 'user-bob';

beforeEach(() => {
  localStorage.clear();
});

describe('deck cache', () => {
  it('round-trips a deck', () => {
    const deck = [createCard('كِتاب', 'book'), createCard('قَلَم', 'pen')];
    cacheDeck(ALICE, deck);
    expect(readCachedDeck(ALICE).map((c) => c.word)).toEqual(['كِتاب', 'قَلَم']);
  });

  it('returns an empty deck for an unknown user', () => {
    expect(readCachedDeck(ALICE)).toEqual([]);
  });

  it('keeps each account isolated', () => {
    cacheDeck(ALICE, [createCard('كِتاب', 'book')]);
    cacheDeck(BOB, [createCard('جَبَل', 'mountain'), createCard('بَحر', 'sea')]);
    expect(readCachedDeck(ALICE)).toHaveLength(1);
    expect(readCachedDeck(BOB)).toHaveLength(2);
  });

  it('survives corrupted storage without throwing', () => {
    localStorage.setItem('arabic-flashcards-deck-cache:user-alice', '{not json');
    expect(readCachedDeck(ALICE)).toEqual([]);
  });
});

describe('pending mutation queue', () => {
  it('replays oldest first', () => {
    queueMutation(ALICE, { kind: 'upsert', cards: [createCard('كِتاب', 'book')] });
    queueMutation(ALICE, { kind: 'update', id: 'abc', updates: { easeFactor: 2 } });
    queueMutation(ALICE, { kind: 'delete', id: 'xyz' });

    expect(readQueue(ALICE).map((m) => m.kind)).toEqual(['upsert', 'update', 'delete']);
  });

  it('reports the queue depth as it grows', () => {
    expect(queueMutation(ALICE, { kind: 'delete', id: 'a' })).toBe(1);
    expect(queueMutation(ALICE, { kind: 'delete', id: 'b' })).toBe(2);
  });

  it('does not leak between accounts', () => {
    queueMutation(ALICE, { kind: 'delete', id: 'a' });
    expect(readQueue(BOB)).toEqual([]);
  });

  it('persists a drained queue', () => {
    queueMutation(ALICE, { kind: 'delete', id: 'a' });
    writeQueue(ALICE, []);
    expect(readQueue(ALICE)).toEqual([]);
  });
});

describe('image backfill list', () => {
  it('dedupes repeated marks', () => {
    markNeedsImage(ALICE, ['a', 'b']);
    markNeedsImage(ALICE, ['b', 'c']);
    expect(readNeedsImage(ALICE).sort()).toEqual(['a', 'b', 'c']);
  });

  it('removes only the settled ids', () => {
    markNeedsImage(ALICE, ['a', 'b', 'c']);
    unmarkNeedsImage(ALICE, ['b']);
    expect(readNeedsImage(ALICE).sort()).toEqual(['a', 'c']);
  });

  it('ignores empty updates', () => {
    markNeedsImage(ALICE, []);
    expect(readNeedsImage(ALICE)).toEqual([]);
  });
});

describe('isNetworkError', () => {
  it('treats a coded Postgres error as a data problem, not connectivity', () => {
    expect(isNetworkError({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isNetworkError({ code: 'PGRST116', message: 'no rows' })).toBe(false);
  });

  it('treats a codeless fetch failure as a connectivity problem', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'NetworkError when attempting to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'Load failed' })).toBe(true);
  });

  it('does not misread an unrelated codeless error as offline', () => {
    expect(isNetworkError({ message: 'row level security violation' })).toBe(false);
  });
});
