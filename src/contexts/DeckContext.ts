import { createContext, useContext } from 'react';
import type { FlashCard } from '@/lib/spaced-repetition';

/**
 * The learner's own cards, for screens that want to say "you already know a
 * word on this root".
 *
 * A context rather than a prop because the reader's word popover sits four
 * levels below the deck (Index → Library → ChapterReader → ArabicWithTags),
 * and because there is one popover per word on the page: each fetching its own
 * copy of the deck would be absurd. The deck is already loaded once at the top
 * of the app, so this only hands out what is there.
 *
 * Defaults to empty, so anything rendered outside the provider — a test, a
 * signed-out view — shows no deck section rather than failing.
 */
export const DeckContext = createContext<FlashCard[]>([]);

export function useDeck(): FlashCard[] {
  return useContext(DeckContext);
}
