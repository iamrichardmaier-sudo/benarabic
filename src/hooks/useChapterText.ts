import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BibleVerse } from '@/lib/bible-types';

/**
 * A chapter of whichever work is being read.
 *
 * Two sources, deliberately different. The Bible is public domain, so it ships
 * as static JSON in the bundle and is fetched over HTTP. A private text is not
 * the app's to ship, so it is read from `private_texts`, where row-level
 * security scopes it to whoever loaded it.
 *
 * Both return the same [{v, a, e}] shape, so the reader does not care which it
 * is looking at.
 */
export type Work = 'bible' | 'bom';

const cache = new Map<string, BibleVerse[]>();
const inflight = new Map<string, Promise<BibleVerse[]>>();

function cacheKey(work: Work, bookCode: string, chapter: number): string {
  return `${work}/${bookCode}/${chapter}`;
}

/** Thrown when a private text simply has not been loaded yet, which is an
 *  empty state rather than a failure and reads differently on screen. */
export const NOT_LOADED = 'NOT_LOADED';

async function fetchBible(bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}bible/${bookCode}/${chapter}.json`);
  if (!res.ok) throw new Error(`Could not load ${bookCode} ${chapter} (${res.status})`);
  return (await res.json()) as BibleVerse[];
}

async function fetchPrivate(work: Work, bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const { data, error } = await supabase
    .from('private_texts')
    .select('verses')
    .eq('work', work)
    .eq('book_code', bookCode)
    .eq('chapter', chapter)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(NOT_LOADED);
  return (data as unknown as { verses: BibleVerse[] }).verses;
}

function loadChapter(work: Work, bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const key = cacheKey(work, bookCode, chapter);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let promise = inflight.get(key);
  if (!promise) {
    promise = (work === 'bible' ? fetchBible(bookCode, chapter) : fetchPrivate(work, bookCode, chapter))
      .then((verses) => {
        cache.set(key, verses);
        return verses;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, promise);
  }
  return promise;
}

export function useChapterText(work: Work, bookCode: string | null, chapter: number | null) {
  const key = bookCode && chapter ? cacheKey(work, bookCode, chapter) : null;
  const cached = key ? cache.get(key) ?? null : null;
  const [verses, setVerses] = useState<BibleVerse[] | null>(cached);
  const [loading, setLoading] = useState(!!key && !cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookCode || !chapter) {
      setVerses(null);
      setLoading(false);
      return;
    }
    const already = cache.get(cacheKey(work, bookCode, chapter));
    if (already) {
      setVerses(already);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadChapter(work, bookCode, chapter)
      .then((v) => {
        if (!cancelled) {
          setVerses(v);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [work, bookCode, chapter]);

  return { verses, loading, error };
}

/** Kept so existing Bible callers read the same as they always did. */
export function useBibleChapter(bookCode: string | null, chapter: number | null) {
  return useChapterText('bible', bookCode, chapter);
}
