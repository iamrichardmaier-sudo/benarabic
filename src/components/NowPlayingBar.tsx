import { useEffect, useState } from 'react';
import { Gauge, Headphones, Minus, MonitorPlay, Pause, Play, Plus, RotateCcw, RotateCw, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { dismiss, seekTo, setRate, skipBy, togglePlay } from '@/lib/now-playing';
import { AUDIO_RATE_MAX, AUDIO_RATE_MIN, AUDIO_RATE_STEP, formatRate } from '@/lib/preferences';
import { openVideo, useBarEpisode, useShelfPlayback } from '@/hooks/useShelfPlayback';
import { SKIP_SECONDS, usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import { isVideo } from '@/lib/daily-audio';

const PRESETS = [0.5, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 2];

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Listening speed: presets, a fine slider, and a step either way. */
const SpeedControl = ({ rate }: { rate: number }) => {
  const step = (by: number) =>
    setRate(Math.round(Math.min(AUDIO_RATE_MAX, Math.max(AUDIO_RATE_MIN, rate + by)) * 100) / 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => step(-AUDIO_RATE_STEP)}
          disabled={rate <= AUDIO_RATE_MIN}
          aria-label="Slower"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-center">
          <span className="block text-2xl font-bold tabular-nums text-foreground">{formatRate(rate)}</span>
          <span className="block text-[11px] text-muted-foreground">
            {rate < 1 ? 'Slower' : rate > 1 ? 'Faster' : 'Normal speed'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => step(AUDIO_RATE_STEP)}
          disabled={rate >= AUDIO_RATE_MAX}
          aria-label="Faster"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <Slider
        min={AUDIO_RATE_MIN}
        max={AUDIO_RATE_MAX}
        step={AUDIO_RATE_STEP}
        value={[rate]}
        onValueChange={([v]) => setRate(v)}
        thumbLabel="Speed"
        thumbValueText={formatRate(rate)}
      />
      <div className="flex flex-wrap justify-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setRate(p)}
            aria-pressed={Math.abs(rate - p) < 0.001}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
              Math.abs(rate - p) < 0.001 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
            }`}
          >
            {formatRate(p)}
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Applies to every audio and video in the app.</p>
    </div>
  );
};

/**
 * The play bar: appears once any audio or video starts, and stays above the
 * tab bar on every screen until closed, so playback can be paused, moved
 * through and slowed down from anywhere.
 */
/** The cover of what is playing, or a plain tile when there is none. */
const Cover = ({ src }: { src: string }) => {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Headphones className="h-4 w-4" />
    </span>
  );
};

const NowPlayingBar = ({ hidden = false }: { hidden?: boolean }) => {
  const np = useNowPlaying();
  // A shelf video being listened to as audio can go back to its picture.
  const shelfEpisode = useBarEpisode();
  const { videoOpen } = useShelfPlayback();
  const player = usePodcastPlayer('Daily Audio');
  const video = shelfEpisode && isVideo(shelfEpisode) ? shelfEpisode : null;

  // The lock screen shows a shelf episode's own title and cover.
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!shelfEpisode || !ms || typeof MediaMetadata === 'undefined') return;
    ms.metadata = new MediaMetadata({
      title: shelfEpisode.title,
      artist: 'Wazn',
      album: 'Daily Audio',
      artwork: shelfEpisode.imageUrl ? [{ src: shelfEpisode.imageUrl, sizes: '512x512' }] : [],
    });
  }, [shelfEpisode, player.state.index]);

  // The full-screen video player has every control already.
  if (!np.active || hidden || videoOpen) return null;
  const fraction = np.duration > 0 ? Math.min(np.position / np.duration, 1) : 0;

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="fixed inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-30 px-2 lg:bottom-4 lg:start-60 lg:px-8"
    >
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm lg:max-w-2xl">
        {/* The progress line doubles as a scrubber. */}
        <input
          type="range"
          min={0}
          max={Math.max(np.duration, 1)}
          step={1}
          value={Math.min(np.position, np.duration || 0)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Position"
          aria-valuetext={`${clock(np.position)} of ${clock(np.duration)}`}
          className="wz-scrub block h-3 w-full cursor-pointer"
          style={{ ['--wz-fill' as string]: `${fraction * 100}%` }}
          disabled={np.duration <= 0}
        />
        <div className="flex items-center gap-1 px-2.5 pb-2 pt-0.5">
          {video ? (
            <button
              type="button"
              onClick={() => openVideo(video, player)}
              aria-label="Watch video"
              className="relative shrink-0 transition-transform active:scale-95"
            >
              <Cover src={np.artwork} />
              <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card">
                <MonitorPlay className="h-3 w-3" />
              </span>
            </button>
          ) : (
            np.artwork && <Cover src={np.artwork} />
          )}
          <div className="min-w-0 flex-1 ps-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{np.title}</p>
            <p className="truncate text-[11px] tabular-nums text-muted-foreground">
              {np.subtitle && <>{np.subtitle} · </>}
              {clock(np.position)}
              {np.duration > 0 && ` / ${clock(np.duration)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => skipBy(-SKIP_SECONDS)}
            aria-label={`Back ${SKIP_SECONDS} seconds`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={np.playing ? 'Pause' : 'Play'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            {np.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-px" />}
          </button>
          <button
            type="button"
            onClick={() => skipBy(SKIP_SECONDS)}
            aria-label={`Forward ${SKIP_SECONDS} seconds`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="h-[18px] w-[18px]" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Speed ${formatRate(np.rate)}. Change speed`}
                className={`flex h-9 min-w-[3rem] items-center justify-center gap-1 rounded-full px-2 text-xs font-bold tabular-nums ${
                  np.rate === 1 ? 'bg-muted text-foreground' : 'bg-primary/15 text-primary'
                }`}
              >
                <Gauge className="h-3.5 w-3.5" />
                {formatRate(np.rate)}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64">
              <SpeedControl rate={np.rate} />
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close player"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingBar;
