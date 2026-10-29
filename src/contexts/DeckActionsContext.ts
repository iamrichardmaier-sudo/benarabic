import { createContext, useContext } from 'react';

/** The fields a word carries when it is sent from a reader to the deck. */
export interface NewWord {
  word: string;
  english?: string | null;
  root?: string | null;
  wordType?: string | null;
  verbForm?: string | null;
  /** The voweled spelling, when `word` is not already voweled. */
  wordVoweled?: string | null;
  fushaPlural?: string | null;
  pastTense?: string | null;
  presentTense?: string | null;
  masdarForm?: string | null;
}

interface DeckActions {
  /**
   * Put a word from whatever is being read into the deck, as a new card.
   *
   * Undefined outside the provider — a test, or a screen with no deck behind
   * it — and the button that calls it is simply not rendered there.
   */
  addWord?: (word: NewWord) => Promise<void>;
  /**
   * Open the dictionary: on a search (pass the query),
   * a word (its slug or id), or a root ("root/ك-ت-ب"). Undefined where there
   * is no app around the component, and the link is then not shown.
   */
  openDictionary?: (target: { word?: string; root?: string; query?: string }) => void;
}

/**
 * Sending a word to the deck, for the reader's word popovers.
 *
 * Separate from DeckContext, which hands out the cards themselves: that one is
 * read by every popover on the page to say "you already know a word on this
 * root", and widening it to carry actions would change a type that a good deal
 * already depends on.
 */
export const DeckActionsContext = createContext<DeckActions>({});

export function useDeckActions(): DeckActions {
  return useContext(DeckActionsContext);
}
