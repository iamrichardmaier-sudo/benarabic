import { createContext, useContext } from 'react';
import type { DeckIndex } from '@/lib/reader-status';

/**
 * The deck, indexed for a reader, or null when words are not being marked.
 *
 * A context for the same reason DeckContext is one: there is a popover per
 * word on the page, several levels below the screen that owns the index, and
 * building it per word would be building it thousands of times.
 */
export const ReaderStatusContext = createContext<DeckIndex | null>(null);

export function useReaderIndex(): DeckIndex | null {
  return useContext(ReaderStatusContext);
}
