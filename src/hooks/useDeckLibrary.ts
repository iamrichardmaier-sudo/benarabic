import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchDecks, fetchUserDecks, addDecksToLearn, removeDeckFromLearn,
  isDeckAdmin, type Deck,
} from '@/lib/deck-store';

/**
 * The deck library: what exists, and what this learner has taken up.
 *
 * Both are loaded together because the browse list is meaningless without the
 * second — a deck already in someone's Learn section has to look different
 * from one they have never seen.
 */
export function useDeckLibrary() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [mine, setMine] = useState<Map<string, string | null>>(new Map());
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setDecks([]);
      setMine(new Map());
      setLoading(false);
      return;
    }
    try {
      const [all, taken, isAdmin] = await Promise.all([
        fetchDecks(),
        fetchUserDecks(),
        isDeckAdmin(),
      ]);
      setDecks(all);
      setMine(taken);
      setAdmin(isAdmin);
      setError(null);
    } catch (err) {
      // The list already on screen is left alone: a failed reload means the
      // library could not be refreshed, not that the decks are gone.
      console.error('Could not load the deck library:', err);
      setError(err instanceof Error ? err.message : 'The decks could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addDecks = useCallback(
    async (deckIds: string[]) => {
      if (!user) throw new Error('Sign in to add decks.');
      const result = await addDecksToLearn(deckIds, user.id);
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
