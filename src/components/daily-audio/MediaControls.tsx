import { useState } from 'react';
import { Loader2, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SKIP_SECONDS, SPEEDS } from '@/hooks/usePodcastPlayer';
import { formatDuration, formatSpeed as speedLabel } from '@/lib/daily-audio';
import { cn } from '@/lib/utils';

interface SeekBarProps {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * A slim progress track with a thumb, seekable by drag or tap. A native range
 * input sits invisibly on top, so it works by touch, mouse and keyboard and
 * reads properly to a screen reader.
 */
export const SeekBar = ({ position, duration, onSeek, className }: SeekBarProps) => {
  const known = duration > 0;
  const at = known ? Math.min(position, duration) : 0;
  const pct = known ? (at / duration) * 100 : 0;
  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex h-5 items-center">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        {known && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-primary shadow ring-2 ring-background"
            style={{ left: `${pct}%` }}
          />
        )}
        <input
          type="range"
          min={0}
          max={known ? duration : 1}
          step={0.1}
          value={at}
          disabled={!known}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatDuration(at)} of ${formatDuration(duration)}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
      <div className="flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
        <span>{formatDuration(at)}</span>
        <span>{known ? `-${formatDuration(duration - at)}` : '--:--'}</span>
      </div>
    </div>
  );
};

interface SkipButtonProps {
  direction: 'back' | 'forward';
  onSkip: (by: number) => void;
  size?: 'sm' | 'lg';
}

/** A circular-arrow skip button with the seconds printed inside it. */
export const SkipButton = ({ direction, onSkip, size = 'sm' }: SkipButtonProps) => {
  const Icon = direction === 'back' ? RotateCcw : RotateCw;
  return (
    <button
      type="button"
      onClick={() => onSkip(direction === 'back' ? -SKIP_SECONDS : SKIP_SECONDS)}
      aria-label={`${direction === 'back' ? 'Back' : 'Forward'} ${SKIP_SECONDS} seconds`}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full text-foreground/80 transition-all hover:bg-muted hover:text-foreground active:scale-90',
        size === 'lg' ? 'h-12 w-12' : 'h-9 w-9',
      )}
    >
      <Icon className={size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'} strokeWidth={1.75} />
      <span
        aria-hidden="true"
        className={cn(
          'absolute pt-px font-bold tabular-nums',
          size === 'lg' ? 'text-[11px]' : 'text-[8.5px]',
        )}
      >
        {SKIP_SECONDS}
      </span>
    </button>
  );
};

interface PlayButtonProps {
  playing: boolean;
  loading?: boolean;
  onToggle: () => void;
  size?: 'sm' | 'lg';
}

export const PlayButton = ({ playing, loading, onToggle, size = 'sm' }: PlayButtonProps) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={playing ? 'Pause' : 'Play'}
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-90',
      size === 'lg' ? 'h-16 w-16' : 'h-11 w-11',
    )}
  >
    {loading && !playing ? (
      <Loader2 className={cn('animate-spin', size === 'lg' ? 'h-7 w-7' : 'h-5 w-5')} />
    ) : playing ? (
      <Pause className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} fill="currentColor" />
    ) : (
      <Play className={cn('translate-x-px', size === 'lg' ? 'h-7 w-7' : 'h-5 w-5')} fill="currentColor" />
    )}
  </button>
);

interface SpeedControlProps {
  speed: number;
  onChange: (rate: number) => void;
  className?: string;
}

/** A speed pill that opens a grid of every rate on offer. */
export const SpeedControl = ({ speed, onChange, className }: SpeedControlProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Playback speed, ${speedLabel(speed)}`}
          className={cn(
            'h-8 shrink-0 rounded-full px-2.5 text-xs font-bold tabular-nums transition-all active:scale-95',
            speed === 1
              ? 'bg-muted text-muted-foreground hover:text-foreground'
              : 'bg-primary/15 text-primary',
            className,
          )}
        >
          {speedLabel(speed)}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto rounded-2xl p-2">
        <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Playback speed
        </p>
        <div role="group" aria-label="Playback speed" className="grid grid-cols-4 gap-1.5">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-pressed={rate === speed}
              onClick={() => { onChange(rate); setOpen(false); }}
              className={cn(
                'h-9 min-w-[3.25rem] rounded-xl text-sm font-semibold tabular-nums transition-all active:scale-95',
                rate === speed
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-muted/60 text-foreground hover:bg-muted',
              )}
            >
              {speedLabel(rate)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
