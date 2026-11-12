import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { readPreferences } from '@/lib/preferences';
import type { NarrationWord } from '@/hooks/useLibraryTexts';
import { wordAt } from '@/lib/narration';

interface Props {
  /** The narration's path in the private text-audio bucket. */
  path: string;
  words: NarrationWord[];
  title: string;
  /** The index of the word being spoken, or null between words and when stopped. */
  onWord: (index: number | null) => void;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A saved text read aloud, with the word being spoken reported as it plays
 * so the reader can light it up.
 *
 * The file is private (it is the reader's copy of someone else's writing),
 * so it is played through a signed address. The element carries a title, so
 * the app's play bar picks it up and it keeps playing under the lock screen.
 */
const TextNarration = ({ path, words, title, onWord }: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const onWordRef = useRef(onWord);
  onWordRef.current = onWord;

  useEffect(() => {
    let live = true;
    supabase.storage
      .from('text-audio')
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data, error }) => {
        if (!live) return;
        if (error || !data?.signedUrl) setFailed(true);
        else setSrc(data.signedUrl);
      });
    return () => {
      live = false;
    };
  }, [path]);

  // timeupdate fires only a few times a second, which is too coarse for
  // word-by-word highlighting; follow the clock every frame while playing.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playing) return;
    let frame = 0;
    let last: number | null = -1;
    const tick = () => {
      const index = wordAt(words, el.currentTime);
      if (index !== last) {
        last = index;
        onWordRef.current(index);
      }
      setPosition(el.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, words]);

  useEffect(() => () => onWordRef.current(null), []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (t: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = t;
    setPosition(t);
    onWordRef.current(wordAt(words, t));
  };

  if (failed) {
    return <p className="text-center text-xs text-muted-foreground">The narration could not be loaded.</p>;
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? 'Pause narration' : 'Play narration'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
      >
        {!src ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-px" />
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(position, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!duration}
          aria-label="Position in the narration"
          className="block w-full accent-primary"
        />
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{clock(position)}</span>
          <span>{duration ? clock(duration) : '–:––'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => seek(0)}
        disabled={!duration}
        aria-label="Back to the start"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          data-title={title}
          data-subtitle="Narration"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            e.currentTarget.playbackRate = readPreferences().audioRate;
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            onWordRef.current(null);
          }}
          onSeeked={(e) => setPosition(e.currentTarget.currentTime)}
        />
      )}
    </div>
  );
};

export default TextNarration;
