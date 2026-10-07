import { useState } from 'react';
import { Headphones, Pause, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyAudios, type DailyAudio } from '@/hooks/useDailyAudios';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import { formatDuration, formatEpisodeDate } from '@/lib/daily-audio';

const Cover = ({ episode }: { episode: DailyAudio }) => {
  const [failed, setFailed] = useState(false);
  if (episode.imageUrl && !failed) {
    return (
      <img
        src={episode.imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
    >
      <Headphones className="h-6 w-6" />
    </span>
  );
};

/**
 * The daily lessons, newest first.
 *
 * Playback goes through the app's one shared audio element, so an episode
 * keeps playing when you leave Home or lock the phone. Rows come straight
 * from the table — nothing here assumes a filename or a date.
 */
const DailyAudios = () => {
  const { episodes, loading, error } = useDailyAudios();
  const { state, tracks, start, toggle } = usePodcastPlayer('Daily Audio');

  const activeUrl = tracks[0]?.url ?? null;

  const press = (episode: DailyAudio) => {
    if (activeUrl === episode.audioUrl) toggle();
    else start([{ url: episode.audioUrl, label: episode.title }]);
  };

  return (
    <section className="space-y-2" aria-labelledby="daily-audios-heading">
      <h2
        id="daily-audios-heading"
        className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Daily Audios
      </h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[4.75rem] w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
          The daily audios could not be loaded.
        </p>
      ) : episodes.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
          Your first daily audio arrives tomorrow at 4 AM.
        </p>
      ) : (
        <ul className="space-y-2">
          {episodes.map((episode) => {
            const active = activeUrl === episode.audioUrl;
            const playing = active && state.playing;
            const length = active && state.duration > 0 ? state.duration : episode.durationSecs ?? 0;
            const progress = active && length > 0 ? Math.min(1, state.position / length) : 0;
            return (
              <li key={episode.id}>
                <button
                  onClick={() => press(episode)}
                  aria-label={`${playing ? 'Pause' : 'Play'} ${episode.title}`}
                  aria-pressed={playing}
                  className={`w-full overflow-hidden rounded-2xl border bg-card text-start transition-all active:scale-[0.98] ${
                    active ? 'border-primary/60' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <span className="flex items-center gap-3 p-2.5">
                    <Cover episode={episode} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {episode.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatEpisodeDate(episode.audioDate)}
                        {episode.durationSecs ? ` · ${formatDuration(episode.durationSecs)}` : ''}
                        {playing && <span className="font-semibold text-primary"> · Playing</span>}
                      </span>
                      {active && state.error && (
                        <span className="block text-xs text-destructive">{state.error}</span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
                    </span>
                  </span>
                  {active && (
                    <span
                      role="progressbar"
                      aria-label="Progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      className="block h-1 bg-muted"
                    >
                      <span
                        className="block h-full bg-primary transition-[width]"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default DailyAudios;
