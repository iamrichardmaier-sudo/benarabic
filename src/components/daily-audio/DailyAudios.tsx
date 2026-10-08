import { useState } from 'react';
import { Headphones, Pause, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
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
        className="aspect-square w-full rounded-xl border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex aspect-square w-full items-center justify-center rounded-xl bg-primary text-primary-foreground"
    >
      <Headphones className="h-8 w-8" />
    </span>
  );
};

/**
 * The daily lessons as a swipeable deck: four across on desktop with arrow
 * buttons, swipe-to-scroll on touch. Newest first.
 *
 * Playback goes through the app's one shared audio element, so an episode
 * keeps playing when you leave Home or lock the phone.
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
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] shrink-0 grow-0 basis-1/4 rounded-2xl" />
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
        <Carousel opts={{ align: 'start' }} className="w-full">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2
              id="daily-audios-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Daily Audios
            </h2>
            <div className="hidden gap-1 md:flex">
              <CarouselPrevious className="static h-7 w-7 translate-y-0" />
              <CarouselNext className="static h-7 w-7 translate-y-0" />
            </div>
          </div>
          <CarouselContent>
            {episodes.map((episode) => {
              const active = activeUrl === episode.audioUrl;
              const playing = active && state.playing;
              const length = active && state.duration > 0 ? state.duration : episode.durationSecs ?? 0;
              const progress = active && length > 0 ? Math.min(1, state.position / length) : 0;
              return (
                <CarouselItem key={episode.id} className="basis-[46%] sm:basis-[31%] lg:basis-1/4">
                  <button
                    onClick={() => press(episode)}
                    aria-label={`${playing ? 'Pause' : 'Play'} ${episode.title}`}
                    aria-pressed={playing}
                    className={`flex w-full flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-2.5 text-start transition-all active:scale-[0.98] ${
                      active ? 'border-primary/60' : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Cover episode={episode} />
                    <span className="block min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground line-clamp-2">
                      {episode.title}
                    </span>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatEpisodeDate(episode.audioDate)}
                        {episode.durationSecs ? ` · ${formatDuration(episode.durationSecs)}` : ''}
                        {playing && <span className="font-semibold text-primary"> · Playing</span>}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
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
                        className="block h-1 w-full rounded bg-muted"
                      >
                        <span
                          className="block h-full rounded bg-primary transition-[width]"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </span>
                    )}
                    {active && state.error && (
                      <span className="block text-xs text-destructive">{state.error}</span>
                    )}
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
};

export default DailyAudios;
