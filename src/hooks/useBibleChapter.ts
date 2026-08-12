import { useState, useEffect } from 'react';
import type { BibleVerse } from '@/lib/bible-types';

// Module-scoped cache: once a chapter's been read this session there's no
// reason to re-fetch it on every visit (flipping back and forth is common
// when comparing verses).
const cache = new Map<string, BibleVerse[]>();
const inflight = new Map<string, Promise<BibleVerse[]>>();

function cacheKey(bookCode: string, chapter: number): string {
  return `${bookCode}/${chapter}`;
}

async function loadChapter(bookCode: string, chapter: number): Promise<BibleVerse[]> {
  const key = cacheKey(bookCode, chapter);
  const cached = cache.get(key);
  if (cached) return cached;

  let promise = inflight.get(key);
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}bible/${bookCode}/${chapter}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${bookCode} ${chapter} (${res.status})`);
        return res.json() as Promise<BibleVerse[]>;
      })
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

export function useBibleChapter(bookCode: string | null, chapter: number | null) {
  const cached = bookCode && chapter ? cache.get(cacheKey(bookCode, chapter)) ?? null : null;
  const [verses, setVerses] = useState<BibleVerse[] | null>(cached);
  const [loading, setLoading] = useState(!!bookCode && !!chapter && !cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookCode || !chapter) {
      setVerses(null);
      setLoading(false);
      return;
    }
    const already = cache.get(cacheKey(bookCode, chapter));
    if (already) {
      setVerses(already);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadChapter(bookCode, chapter)
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
  }, [bookCode, chapter]);

  return { verses, loading, error };
}
