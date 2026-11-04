import { useEffect, useMemo, useState } from 'react';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { fetchDeckMemberships } from '@/lib/deck-store';
import type { DeckMembership } from '@/lib/relearn';

/**
 * The decks the learner holds and the words each one contains, for the
 * Relearn picker. Fetched only while `enabled` (the picker is open), so the
 * membership query is not paid for on every visit to the app.
 *
 * `decks` is null until the first load finishes, and stays null if it fails:
 * the picker then falls back to grouping by chapter rather than showing
 * nothing.
 */
export function useRelearnDecks(enabled: boolean) {
  const { decks, mine } = useDeckLibrary();
  const [memberships, setMemberships] = useState<Map<string, Set<string>> | null>(null);
  const [loading, setLoading] = useState(false);

  const heldKey = useMemo(() => [...mine.keys()].sort().join(','), [mine]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetchDeckMemberships(heldKey ? heldKey.split(',') : [])
      .then((m) => {
        if (!cancelled) setMemberships(m);
      })
      .catch((err) => {
        console.error('Could not load which words are in each deck:', err);
        if (!cancelled) setMemberships(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, heldKey]);

  const held = useMemo<DeckMembership[] | null>(() => {
    if (!memberships) return null;
    const out: DeckMembership[] = [];
    for (const deck of decks) {
      const wordIds = memberships.get(deck.id);
      if (!wordIds) continue;
      // The learner's own name for a deck wins over the published one.
      out.push({ id: deck.id, title: mine.get(deck.id) || deck.title, wordIds });
    }
    return out;
  }, [memberships, decks, mine]);

  return { decks: held, loading };
}
