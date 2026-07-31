import { supabase } from '@/integrations/supabase/client';
import { isOnline } from '@/hooks/useOnlineStatus';
import { readNeedsImage, unmarkNeedsImage, type CacheScope } from '@/lib/offline-cache';
import type { FlashCard } from '@/lib/spaced-repetition';

export interface ImageLookup {
  imageUrl: string | null;
  /** Human-readable reason the lookup failed, or null when it succeeded. */
  error: string | null;
  /** True when the lookup was skipped because there is no connection. */
  deferred?: boolean;
}

/**
 * Look up a stock image for a word. Failures are returned rather than
 * swallowed: a broken PEXELS_API_KEY otherwise surfaces only as "0 images
 * found", which gives no clue what needs fixing.
 *
 * With no connection the call is skipped entirely — the card is still worth
 * creating without a picture, and `backfillMissingImages` fetches it later.
 */
export async function searchImage(query: string): Promise<ImageLookup> {
  if (!isOnline()) return { imageUrl: null, error: null, deferred: true };

  try {
    const { data, error } = await supabase.functions.invoke('pexels-search', {
      body: { query },
    });

    if (error) {
      // The edge function's JSON body carries the useful message; the
      // FunctionsHttpError wrapper only says "non-2xx status code".
      let detail = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) detail = String(body.error);
      } catch {
        /* body unavailable — keep the wrapper message */
      }
      console.error('Pexels search error:', detail);
      return { imageUrl: null, error: detail };
    }

    return { imageUrl: data?.imageUrl || null, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Image lookup failed';
    console.error('Failed to fetch image:', detail);
    return { imageUrl: null, error: detail };
  }
}

/** Convenience wrapper for callers that only need the URL. */
export async function searchUnsplashImage(query: string): Promise<string | null> {
  return (await searchImage(query)).imageUrl;
}

/**
 * Fetch pictures for cards that were created without a connection. Only ids
 * parked by the offline path are considered, so cards that genuinely have no
 * matching stock photo aren't retried on every load.
 */
export async function backfillMissingImages(
  scope: CacheScope,
  cards: FlashCard[],
  updateCard: (id: string, updates: Partial<FlashCard>) => Promise<void>,
): Promise<number> {
  if (!isOnline()) return 0;
  const pending = readNeedsImage(scope);
  if (pending.length === 0) return 0;

  const byId = new Map(cards.map((c) => [c.id, c]));
  const settled: string[] = [];
  let filled = 0;

  for (const id of pending) {
    const card = byId.get(id);
    // Deleted since, or already has a picture — either way it's done.
    if (!card || card.imageUrl) {
      settled.push(id);
      continue;
    }
    const { imageUrl, error } = await searchImage(card.english || card.word);
    // The image service itself is failing; leave the rest queued for next time.
    if (error) break;
    if (imageUrl) {
      await updateCard(id, { imageUrl });
      filled++;
    }
    // "No match" is a final answer, not something to retry forever.
    settled.push(id);
  }

  unmarkNeedsImage(scope, settled);
  return filled;
}
