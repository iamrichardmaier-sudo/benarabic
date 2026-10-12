import { useEffect, useState } from 'react';

export interface DailyAudio {
  id: string;
  /** The day the episode is for, as yyyy-mm-dd. */
  audioDate: string;
  title: string;
  audioUrl: string;
  imageUrl: string | null;
  durationSecs: number | null;
}

/** How many of the latest daily episodes the Daily Audios shelf lists. */
export const EPISODE_LIMIT = 14;

/**
 * Where the publisher puts the episode list.
 *
 * The daily job runs somewhere that cannot reach Supabase, so it publishes to
 * a public GitHub Pages site instead and this app reads that — no database,
 * no table, nothing here to migrate. A new episode is a new line in the JSON.
 */
export const MANIFEST_URL = 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/episodes.json';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/**
 * One manifest entry, or null when it cannot be played.
 *
 * An episode with no audio, title or date is dropped rather than shown as a
 * dead row; a bad cover or duration only costs that detail.
 */
function toEpisode(raw: unknown): DailyAudio | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const audioUrl = text(e.audio_url);
  const title = text(e.title);
  const audioDate = text(e.date);
  if (!audioUrl || !title || !audioDate) return null;
  const secs = typeof e.duration_secs === 'number' && Number.isFinite(e.duration_secs) ? e.duration_secs : null;
  return {
    id: text(e.id) ?? audioDate,
    audioDate,
    title,
    audioUrl,
    imageUrl: text(e.image_url),
    durationSecs: secs,
  };
}

/** Every playable episode in a manifest, newest first. */
export function parseManifest(json: unknown): DailyAudio[] {
  const list = json && typeof json === 'object' ? (json as { episodes?: unknown }).episodes : null;
  if (!Array.isArray(list)) throw new Error('The daily audio list is not in the expected format.');
  return list
    .map(toEpisode)
    .filter((e): e is DailyAudio => e !== null)
    // The publisher writes newest first, but order is cheap to guarantee.
    .sort((a, b) => b.audioDate.localeCompare(a.audioDate));
}

/**
 * A textbook chapter's audio exercises (e.g. `2026-10-08-chapter-ii`) rather
 * than a daily lesson. Matched on the id, so newly published chapters are
 * picked up with no change to the app.
 */
export const isChapterAudio = (episode: DailyAudio): boolean => /chapter/i.test(episode.id);

/**
 * The manifest split into its two shelves: the latest daily lessons, capped
 * at the shelf size, and every chapter audio.
 */
export function splitEpisodes(all: DailyAudio[]): { daily: DailyAudio[]; chapters: DailyAudio[] } {
  return {
    daily: all.filter((e) => !isChapterAudio(e)).slice(0, EPISODE_LIMIT),
    chapters: all.filter(isChapterAudio),
  };
}

/**
 * The latest daily audios and the chapter audios, each newest first.
 *
 * Whatever the manifest lists is what shows, so a new episode appears on the
 * next load with no change to the app.
 */
export function useDailyAudios() {
  const [episodes, setEpisodes] = useState<{ daily: DailyAudio[]; chapters: DailyAudio[] }>({
    daily: [],
    chapters: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Bypass the HTTP cache: the manifest updates daily and GitHub Pages
    // serves it with a 10-minute max-age, which hides new episodes.
    fetch(MANIFEST_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the daily audios (${res.status}).`);
        return res.json() as Promise<unknown>;
      })
      .then((json) => {
        if (cancelled) return;
        setEpisodes(splitEpisodes(parseManifest(json)));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load the daily audios:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...episodes, loading, error };
}
