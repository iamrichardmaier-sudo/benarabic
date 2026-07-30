import { supabase } from '@/integrations/supabase/client';

export interface ImageLookup {
  imageUrl: string | null;
  /** Human-readable reason the lookup failed, or null when it succeeded. */
  error: string | null;
}

/**
 * Look up a stock image for a word. Failures are returned rather than
 * swallowed: a broken PEXELS_API_KEY otherwise surfaces only as "0 images
 * found", which gives no clue what needs fixing.
 */
export async function searchImage(query: string): Promise<ImageLookup> {
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
