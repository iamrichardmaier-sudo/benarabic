import { useState, useEffect } from 'react';

type AudioIndex = Record<string, Record<string, string>>;

// Module-scoped: the audio index is fixed and identical for everyone, so one
// fetch per page load (not per component) is all it ever needs.
let cache: AudioIndex | null = null;
let inflight: Promise<AudioIndex> | null = null;

async function loadIndex(): Promise<AudioIndex> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}bible/audio-index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the audio index (${res.status})`);
        return res.json() as Promise<AudioIndex>;
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

/** The chapter-audio URL for a book/chapter, or null if none is available
 * yet (audio currently only covers the four Gospels) or the index hasn't
 * loaded. */
export function useBibleAudio(bookCode: string | null, chapter: number | null): string | null {
  const [index, setIndex] = useState<AudioIndex | null>(cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadIndex()
      .then((i) => {
        if (!cancelled) setIndex(i);
      })
      .catch(() => {
        /* no audio for this session; the reader works fine without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!index || !bookCode || !chapter) return null;
  return index[bookCode]?.[String(chapter)] ?? null;
}
