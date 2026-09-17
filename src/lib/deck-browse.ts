import type { Deck } from '@/lib/deck-store';

/**
 * Matches a deck against what someone typed in the browse search.
 *
 * Chapter numbers are what people actually reach for, and "12" should find
 * "I Chapter 12" without them typing the prefix — so the chapter range and
 * the book part are searched as well as the title.
 *
 * Distinct from deck-search.ts, which searches the cards inside a learner's
 * own deck. This one searches the shelf of decks.
 */
export function matchesDeck(deck: Deck, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    deck.title.toLowerCase().includes(q) ||
    (deck.chapterRange ?? '').toLowerCase().includes(q) ||
    (deck.bookPartPrefix ?? '').toLowerCase().includes(q)
  );
}
