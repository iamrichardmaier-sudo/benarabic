import { useEffect, useState } from 'react';
import { Headphones, MonitorPlay, X } from 'lucide-react';
import type { DailyAudio } from '@/hooks/useDailyAudios';
import { formatEpisodeDate, isVideo } from '@/lib/daily-audio';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import { openVideo, stopAll, useBarEpisode } from '@/hooks/useNowPlaying';
import { PlayButton, SeekBar, SkipButton, SpeedControl } from './MediaControls';

/** Three bouncing bars over the cover while it plays. */
const Equalizer = () => (
  <span aria-hidden="true" className="absolute inset-0 flex items-end justify-center gap-[3px] rounded-xl bg-black/35 pb-2.5">
    {[0, 0.25, 0.5].map((delay) => (
      <span
        key={delay}
        className="h-4 w-[3px] origin-bottom animate-equalize rounded-full bg-white"
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
  </span>
);

const Thumb = ({ episode, playing }: { episode: DailyAudio; playing: boolean }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-primary text-primary-foreground shadow-sm">
      {episode.imageUrl && !failed ? (
        <img src={episode.imageUrl} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Headphones className="h-5 w-5" />
        </span>
      )}
      {playing && <Equalizer />}
    </span>
  );
};

/**
 * The play bar that sits above the tab bar whenever a shelf episode is
 * playing, on every screen: cover and title, play/pause, 15-second skips, a
 * seekable progress bar, speed and stop. A video being listened to as audio
 * shows here too; tapping its cover brings the picture back.
 */
const NowPlayingBar = () => {
  const episode = useBarEpisode();
  const player = usePodcastPlayer('Daily Audio');
  const { state, speed, toggle, seek, skip, setSpeed } = player;

  // The lock screen shows the episode itself rather than a generic title.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!episode || !ms || typeof MediaMetadata === 'undefined') return;
    ms.metadata = new MediaMetadata({
      title: episode.title,
      artist: 'Wazn',
      album: 'Daily Audio',
      artwork: episode.imageUrl ? [{ src: episode.imageUrl, sizes: '512x512' }] : [],
    });
  }, [episode, state.index]);

  if (!episode) return null;
  const video = isVideo(episode);

  return (
    <div className="mx-auto max-w-lg px-2 pt-2">
      <section
        aria-label="Now playing"
        className="rounded-2xl border border-border bg-card/95 p-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur"
      >
        <div className="flex items-center gap-2.5">
          {video ? (
            <button
              type="button"
              onClick={() => openVideo(episode, player)}
              aria-label="Watch video"
              className="relative shrink-0 transition-transform active:scale-95"
            >
              <Thumb episode={episode} playing={state.playing} />
              <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card">
                <MonitorPlay className="h-3 w-3" />
              </span>
            </button>
          ) : (
            <Thumb episode={episode} playing={state.playing} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{episode.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {formatEpisodeDate(episode.audioDate)}{video ? ' · Video, audio only' : ''}
              {state.error && <span className="text-destructive"> · {state.error}</span>}
            </p>
          </div>
          <SkipButton direction="back" onSkip={skip} />
          <PlayButton playing={state.playing} loading={state.loading} onToggle={toggle} />
          <SkipButton direction="forward" onSkip={skip} />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <SpeedControl speed={speed} onChange={setSpeed} />
          <SeekBar position={state.position} duration={state.duration} onSeek={seek} className="flex-1" />
          <button
            type="button"
            onClick={() => stopAll(player)}
            aria-label="Stop and close player"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default NowPlayingBar;
