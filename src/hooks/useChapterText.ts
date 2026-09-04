import { useState, useEffect } from 'react';
import type { BibleVerse } from '@/lib/bible-types';

/**
 * A chapter of whichever work is being read.
 *
 * Both works ship as static JSON under their own directory and are fetched the
 * same way, so the reader does not care which it is looking at. The split
 * exists because they live in different folders, not because they load
 * differently.
 */
export type Work = 'bible' | 'bom';

const cache = new Map<string, BibleVerse[]>();
const inflight = new Map<string, Promise<BibleVerse[]>>();

function cacheKey(work: Work, bookCode: string, chapter: number): string {
  return `${work}/${bookCode}/${chapter}`;
}

async function fetchChapter(work: Work, bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const dir = work === 'bible' ? 'bible' : 'bom';
  const res = await fetch(`${import.meta.env.BASE_URL}${dir}/${bookCode}/${chapter}.json`);
  if (!res.ok) throw new Error(`Could not load ${bookCode} ${chapter} (${res.status})`);
  return (await res.json()) as BibleVerse[];
}

function loadChapter(work: Work, bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const key = cacheKey(work, bookCode, chapter);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let promise = inflight.get(key);
  if (!promise) {
    promise = fetchChapter(work, bookCode, chapter)
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
