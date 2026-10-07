import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyAudio {
  id: string;
  /** The day the episode is for, as yyyy-mm-dd. */
  audioDate: string;
  title: string;
  audioUrl: string;
  imageUrl: string | null;
  durationSecs: number | null;
}

/** How many of the latest episodes the Home section lists. */
export const EPISODE_LIMIT = 14;

interface Row {
  id: string;
  audio_date: string;
  title: string;
  audio_url: string;
  image_url: string | null;
  duration_secs: number | null;
}

const toEpisode = (row: Row): DailyAudio => ({
  id: row.id,
  audioDate: row.audio_date,
  title: row.title,
  audioUrl: row.audio_url,
  imageUrl: row.image_url,
  durationSecs: row.duration_secs,
});

/**
 * The latest daily audios, newest first.
 *
 * Whatever the publisher has inserted is what shows: nothing here knows about
 * filenames or dates, so a new row appears on the next load with no deploy.
 */
export function useDailyAudios() {
  const [episodes, setEpisodes] = useState<DailyAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('daily_audios')
      .select('id, audio_date, title, audio_url, image_url, duration_secs')
      .order('audio_date', { ascending: false })
      .limit(EPISODE_LIMIT)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error('Could not load the daily audios:', err);
          setError(err.message);
        } else {
          setEpisodes(((data ?? []) as Row[]).map(toEpisode));
          setError(null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { episodes, loading, error };
}
