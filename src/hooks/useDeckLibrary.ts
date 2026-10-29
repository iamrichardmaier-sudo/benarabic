import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  fetchDecks, fetchUserDecks, addDecksToLearn, removeDeckFromLearn,
  isDeckAdmin, type Deck,
} from '@/lib/deck-store';
import type { DeckPlacement } from '@/lib/deck-placement';
import type { CardMix } from '@/lib/learn-filter';

type Library = [Deck[], Map<string, string | null>, boolean];

/**
 * Several screens use this hook at once (Home's shelves, the desktop columns,
 * the page itself). Loads that overlap share one request instead of each
 * firing three queries of their own; once it settles the next call fetches
 * fresh, so an explicit refresh still sees new data.
 */
let inflight: Promise<Library> | null = null;
function loadLibrary(): Promise<Library> {
  if (!inflight) {
    inflight = Promise.all([fetchDecks(), fetchUserDecks(), isDeckAdmin()]).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** One failure, one message: every instance hears about the same failed load. */
let lastFailureToast = 0;

/**
 * The deck library: what exists, and what this learner has taken up.
 *
 * Both are loaded together because the browse list is meaningless without the
 * second — a deck already in someone's Learn section has to look different
 * from one they have never seen.
 */
export function useDeckLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [mine, setMine] = useState<Map<string, string | null>>(new Map());
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keyed on the id, not the user object: the auth listener hands out a new
  // object for the same person on every session event, and depending on the
  // object made each one reload the library (a tight loop while offline).
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setDecks([]);
      setMine(new Map());
      setLoading(false);
      return;
    }
    try {
      const [all, taken, isAdmin] = await loadLibrary();
      setDecks(all);
      setMine(taken);
      setAdmin(isAdmin);
      setError(null);
    } catch (err) {
      // The list already on screen is left alone: a failed reload means the
      // library could not be refreshed, not that the decks are gone. Several
      // screens read this hook and not all of them render `error` — Home's
      // deck shelves, for one — so the toast is what makes the failure
      // visible no matter which of them was on screen when it happened.
      console.error('Could not load the deck library:', err);
      setError(err instanceof Error ? err.message : 'The decks could not be loaded.');
      if (Date.now() - lastFailureToast > 30_000) {
        lastFailureToast = Date.now();
        toast({ title: 'Your decks could not be loaded', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addDecks = useCallback(
    async (deckIds: string[], placement: DeckPlacement = 'learn', mix: CardMix = 'both') => {
      if (!user) throw new Error('Sign in to add decks.');
      const result = await addDecksToLearn(deckIds, user.id, placement, mix);
      await refresh();
      return result;
    },
    [user, refresh],
  );

  const removeDeck = useCallback(
    async (deckId: string) => {
      if (!user) throw new Error('Sign in to change your decks.');
      await removeDeckFromLearn(deckId, user.id);
      await refresh();
    },
    [user, refresh],
  );

  return { decks, mine, admin, loading, error, refresh, addDecks, removeDeck };
}
