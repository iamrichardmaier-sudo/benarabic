import { useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Loader2, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import {
  available, tracksFor, clock, lengthOf, REGISTER_LABEL,
  type Podcast, type Register,
} from '@/lib/podcasts';

/**
 * A podcast, and the choice of which register to hear it in.
 *
 * Nothing loads until a register is picked, because the choice is the point:
 * the same lesson twice over, Levantine and Fusha, and picking "both" plays
 * one straight into the other.
 */
const PodcastPlayer = ({ podcast, onBack }: { podcast: Podcast; onBack: () => void }) => {
  const [register, setRegister] = useState<Register | null>(null);
  const { state, tracks, start, toggle, seek, skip, jumpTo, stop } =
    usePodcastPlayer(podcast.title);

  const choices = available(podcast);
  const begin = (r: Register) => {
    setRegister(r);
    start(tracksFor(podcast, r));
  };

  const total = state.duration || 0;
  const done = state.position;

  return (
    <div className="space-y-5">
      <BackButton
        onClick={() => { stop(); onBack(); }}
        label="Learn"
      />

      <div className="flex items-center gap-4">
        <DeckIcon icon={podcast.icon} iconUrl={podcast.iconUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{podcast.title}</h1>
          {podcast.subtitle && (
            <p className="text-sm text-muted-foreground">{podcast.subtitle}</p>
          )}
        </div>
      </div>

      {choices.length === 0 && (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          The audio for this one has not been uploaded yet.
        </p>
      )}

      {!register && choices.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Listen in
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
            {choices.map((r) => (
              <button
                key={r}
                onClick={() => begin(r)}
                className="flex w-full items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-muted/40"
              >
                <Play className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{REGISTER_LABEL[r]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {clock(lengthOf(podcast, r))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {register && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {tracks[state.index]?.label ?? REGISTER_LABEL[register]}
              {tracks.length > 1 && (
                <span className="text-muted-foreground"> · part {state.index + 1} of {tracks.length}</span>
              )}
            </p>
            <button
              onClick={() => { stop(); setRegister(null); }}
              aria-label="Choose a different register"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(total, 1)}
            value={Math.min(done, total)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position"
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{clock(done)}</span>
            <span>{clock(total)}</span>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button onClick={() => skip(-10)} aria-label="Back ten seconds"
                    className="text-muted-foreground transition-colors hover:text-foreground">
              <RotateCcw className="h-6 w-6" />
            </button>
            <button
              onClick={toggle}
              aria-label={state.playing ? 'Pause' : 'Play'}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all active:scale-95"
            >
              {state.loading ? <Loader2 className="h-7 w-7 animate-spin" />
                : state.playing ? <Pause className="h-7 w-7" />
                : <Play className="h-7 w-7 ps-1" />}
            </button>
            <button onClick={() => skip(30)} aria-label="Forward thirty seconds"
                    className="text-muted-foreground transition-colors hover:text-foreground">
              <RotateCw className="h-6 w-6" />
            </button>
          </div>

          {/* Skipping to Fusha is the whole reason the hour is two files. */}
          {tracks.length > 1 && state.index === 0 && (
            <button
              onClick={() => jumpTo(1)}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Skip to {tracks[1].label}
            </button>
          )}

          {state.error && (
            <p className="text-center text-xs text-destructive">{state.error}</p>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            Keeps playing with the screen off. Use your phone&rsquo;s own controls from the lock screen.
          </p>
        </div>
      )}
    </div>
  );
};

export default PodcastPlayer;
