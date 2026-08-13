import { useState, useEffect } from 'react';
import { normalizeArabic } from '@/lib/arabic-normalize';

export interface WordSense {
  root: string | null;
  lemma: string;
  pos: string;
  verbForm: string | null;
  gloss: string;
}

type SkeletonIndex = Record<string, WordSense[]>;

// Module-scoped: derived from the Bible word-tagging database, fixed and
// identical for everyone, so one fetch per page load is all it ever needs.
let cache: SkeletonIndex | null = null;
let inflight: Promise<SkeletonIndex> | null = null;

async function loadIndex(): Promise<SkeletonIndex> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}bible/word-skeleton-index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the word index (${res.status})`);
        return res.json() as Promise<SkeletonIndex>;
      })
      .then((index) => {
        cache = index;
        return index;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Undiacritized text (news articles, unlike the fully-voweled Bible text)
 * matches a tagged word by its consonant skeleton -- the same normalization
 * already used to grade plural answers leniently. */
export function skeletonOf(word: string): string {
  return normalizeArabic(word);
}

/** Loads the skeleton-keyed word index once, and exposes a lookup by raw
 * (unvoweled or voweled) surface text. A skeleton can carry more than one
 * sense -- Arabic without diacritics is genuinely ambiguous -- so a lookup
 * returns every candidate reading rather than picking one. */
export function useWordSkeletonIndex() {
  const [index, setIndex] = useState<SkeletonIndex | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadIndex()
      .then((i) => {
        if (!cancelled) setIndex(i);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lookup = (word: string): WordSense[] | null => {
    if (!index) return null;
    return index[skeletonOf(word)] ?? null;
  };

  return { ready: !!index, error, lookup };
}
