import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Headphones, X } from 'lucide-react';
import type { DailyAudio } from '@/hooks/useDailyAudios';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import {
  getShelfPlayback, listenAsAudio, setShelfPlayback, showVideo, stopAll, useShelfPlayback,
} from '@/hooks/useShelfPlayback';
import { formatEpisodeDate } from '@/lib/daily-audio';
import { PlayButton, SeekBar, SkipButton, SpeedControl } from './MediaControls';

const VideoStage = ({ episode }: { episode: DailyAudio }) => {
  const { mode } = useShelfPlayback();
  const player = usePodcastPlayer('Daily Audio');
  const ref = useRef<HTMLVideoElement>(null);
  const [clock, setClock] = useState(() => ({
    position: getShelfPlayback().resume.position,
    duration: getShelfPlayback().video.duration,
    playing: false,
  }));
  /** A resume position still to apply once the video knows its length. */
  const pending = useRef<number | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const audioOnly = mode === 'audio';

  // Each time the picture takes over — on opening, and on coming back from
  // audio only — pick up exactly where the track was, playing or paused as
  // it was. A layout effect, so play() runs inside the tap that asked for it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (audioOnly || !el) return;
    const { position, playing } = getShelfPlayback().resume;
    pending.current = position;
    try { el.currentTime = position; } catch { /* applied on loadedmetadata */ }
    sync({ position });
    if (playing) el.play()?.catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioOnly]);

  // The one speed setting covers the video as well as the audio.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.defaultPlaybackRate = player.speed;
    el.playbackRate = player.speed;
  }, [player.speed]);

  const latest = useRef(clock);
  /** The video's clock, here and in the store the shelf card reads. */
  const sync = (next: Partial<typeof clock>) => {
    latest.current = { ...latest.current, ...next };
    setClock(latest.current);
    setShelfPlayback({ video: latest.current });
  };

  const controls = audioOnly
    ? {
      playing: player.state.playing,
      loading: player.state.loading,
      position: player.state.position,
      duration: player.state.duration,
      toggle: player.toggle,
      seek: player.seek,
      skip: player.skip,
    }
    : {
      playing: clock.playing,
      loading: false,
      position: clock.position,
      duration: clock.duration,
      toggle: () => {
        const video = ref.current;
        if (!video) return;
        if (video.paused) video.play()?.catch(() => {});
        else video.pause();
      },
      seek: (s: number) => {
        const video = ref.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(s, clock.duration || s));
        sync({ position: video.currentTime });
      },
      skip: (by: number) => {
        const video = ref.current;
        if (!video) return;
        const end = Number.isFinite(video.duration) ? video.duration : clock.duration || Infinity;
        video.currentTime = Math.max(0, Math.min(video.currentTime + by, end));
        sync({ position: video.currentTime });
      },
    };

  /** Same track, same moment, same play/pause state — just no picture. */
  const toAudio = () => {
    const el = ref.current;
    const from = el
      ? { position: el.currentTime, playing: !el.paused }
      : { position: clock.position, playing: clock.playing };
    el?.pause();
    listenAsAudio(player, from);
  };

  const toggleMode = () => (audioOnly ? showVideo(player) : toAudio());

  /** Put the view away; a video carries on as audio in the play bar. */
  const minimize = () => {
    if (!audioOnly) toAudio();
    setShelfPlayback({ videoOpen: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') minimize(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={episode.title}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background"
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
        <p className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {audioOnly ? 'Audio only' : 'Now watching'}
        </p>
        <button
          type="button"
          onClick={() => stopAll(player)}
          aria-label="Close video"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-black shadow-lg">
          <video
            ref={ref}
            src={episode.videoUrl}
            poster={episode.imageUrl ?? undefined}
            playsInline
            preload="metadata"
            aria-label={`Video: ${episode.title}`}
            onClick={controls.toggle}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (pending.current !== null && Math.abs(el.currentTime - pending.current) > 0.5) {
                el.currentTime = pending.current;
              }
              pending.current = null;
              el.playbackRate = player.speed;
              sync({ duration: el.duration, position: el.currentTime });
            }}
            onTimeUpdate={(e) => sync({ position: e.currentTarget.currentTime })}
            onPlay={() => sync({ playing: true })}
            onPause={() => sync({ playing: false })}
            onEnded={() => sync({ playing: false })}
            className={audioOnly ? 'hidden' : 'h-full w-full object-contain'}
          />
          {audioOnly && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
              {episode.imageUrl && !coverFailed ? (
                <img
                  src={episode.imageUrl}
                  alt=""
                  onError={() => setCoverFailed(true)}
                  className="h-1/2 max-h-48 rounded-xl object-cover shadow-xl"
                />
              ) : (
                <Headphones className="h-14 w-14" />
              )}
              <p className="px-6 text-center text-xs font-medium opacity-90">
                Playing as audio — keeps going with the screen locked
              </p>
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <h2 className="text-lg font-bold leading-snug text-foreground">{episode.title}</h2>
          <p className="text-sm text-muted-foreground">{formatEpisodeDate(episode.audioDate)}</p>
        </div>

        <SeekBar position={controls.position} duration={controls.duration} onSeek={controls.seek} />

        <div className="flex items-center justify-between">
          <SpeedControl speed={player.speed} onChange={player.setSpeed} className="w-14" />
          <div className="flex items-center gap-4">
            <SkipButton direction="back" onSkip={controls.skip} size="lg" />
            <PlayButton playing={controls.playing} loading={controls.loading} onToggle={controls.toggle} size="lg" />
            <SkipButton direction="forward" onSkip={controls.skip} size="lg" />
          </div>
          <span className="w-14" aria-hidden="true" />
        </div>

        <button
          type="button"
          onClick={toggleMode}
          aria-pressed={audioOnly}
          className={`mx-auto flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
            audioOnly
              ? 'border-primary bg-primary text-primary-foreground shadow'
              : 'border-border bg-card text-foreground hover:bg-muted/60'
          }`}
        >
          <Headphones className="h-4 w-4" />
          Audio only
        </button>
      </div>
    </div>
  );
};

/** The full-screen video player, shown while a shelf video is open. */
const VideoPlayerView = () => {
  const { episode, videoOpen } = useShelfPlayback();
  if (!videoOpen || !episode?.videoUrl) return null;
  return <VideoStage key={episode.id} episode={episode} />;
};

export default VideoPlayerView;
