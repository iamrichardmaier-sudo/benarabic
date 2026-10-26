import { useState } from 'react';
import { Headphones, MonitorPlay, Pause, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { DailyAudio } from '@/hooks/useDailyAudios';
import { openVideo, playAudio, useNowPlaying } from '@/hooks/useNowPlaying';
import type { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import { formatDuration, formatEpisodeDate, isVideo } from '@/lib/daily-audio';

/** A small "Video" tag in the cover's corner. */
const VideoBadge = () => (
  <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
    <MonitorPlay className="h-3 w-3" aria-hidden="true" />
    Video
  </span>
);

const Cover = ({ episode }: { episode: DailyAudio }) => (
  <span className="relative block w-full">
    <CoverArt episode={episode} />
    {isVideo(episode) && <VideoBadge />}
  </span>
);

const CoverArt = ({ episode }: { episode: DailyAudio }) => {
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

const Notice = ({ children }: { children: string }) => (
  <p className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
    {children}
  </p>
);

interface AudioShelfProps {
  title: string;
  /** Unique per shelf; labels the section. */
  headingId: string;
  episodes: DailyAudio[];
  loading: boolean;
  error: string | null;
  player: ReturnType<typeof usePodcastPlayer>;
  /** Shown when the list could not be loaded; without it the shelf hides. */
  errorText?: string;
  /** Shown when there are no episodes; without it the shelf hides. */
  emptyText?: string;
}

/**
 * A row of episodes as a swipeable deck: four across on desktop with arrow
 * buttons, swipe-to-scroll on touch, in the order given.
 */
const AudioShelf = ({ title, headingId, episodes, loading, error, player, errorText, emptyText }: AudioShelfProps) => {
  const { state, tracks, toggle } = player;
  const activeUrl = tracks[0]?.url ?? null;
  const now = useNowPlaying();

  // What to say instead of the deck, if anything; a state with nothing to say hides the shelf.
  const notice = error ? errorText : episodes.length === 0 ? emptyText : null;
  if (!loading && notice === undefined) return null;

  const press = (episode: DailyAudio) => {
    // A video opens its player — picking up where it is if already going.
    if (isVideo(episode)) openVideo(episode, player);
    else if (activeUrl === episode.audioUrl) toggle();
    else playAudio(episode, player);
  };

  /** Whether this card is the episode playing, and its clock. */
  const clockFor = (episode: DailyAudio) => {
    if (isVideo(episode)) {
      if (now.episode?.id !== episode.id) return null;
      if (now.mode === 'video') return now.video;
      if (activeUrl !== episode.audioUrl) return null;
    } else if (activeUrl !== episode.audioUrl) {
      return null;
    }
    return state;
  };

  const heading = (
    <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h2>
  );

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      {loading ? (
        <>
          <div className="mb-1 px-1">{heading}</div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] shrink-0 grow-0 basis-1/4 rounded-2xl" />
            ))}
          </div>
        </>
      ) : notice ? (
        <>
          <div className="mb-1 px-1">{heading}</div>
          <Notice>{notice}</Notice>
        </>
      ) : (
        <Carousel opts={{ align: 'start' }} className="w-full">
          <div className="mb-1 flex items-center justify-between px-1">
            {heading}
            <div className="hidden gap-1 md:flex">
              <CarouselPrevious className="static h-7 w-7 translate-y-0" />
              <CarouselNext className="static h-7 w-7 translate-y-0" />
            </div>
          </div>
          <CarouselContent>
            {episodes.map((episode) => {
              const clock = clockFor(episode);
              const active = clock !== null;
              const playing = active && clock.playing;
              const length = active && clock.duration > 0 ? clock.duration : episode.durationSecs ?? 0;
              const progress = active && length > 0 ? Math.min(1, clock.position / length) : 0;
              const video = isVideo(episode);
              return (
                <CarouselItem key={episode.id} className="basis-[46%] sm:basis-[31%] lg:basis-1/4">
                  <button
                    onClick={() => press(episode)}
                    aria-label={video ? `Watch ${episode.title}` : `${playing ? 'Pause' : 'Play'} ${episode.title}`}
                    aria-pressed={video ? undefined : playing}
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
                        {playing && !video ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
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
                    {clock === state && state.error && (
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

export default AudioShelf;
