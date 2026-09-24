import { useCallback, useEffect, useRef, useState } from 'react';

export interface Track {
  url: string;
  label: string;
}

/**
 * One audio element, kept alive for the life of the app.
 *
 * It is created outside React and never unmounted, which is what lets a
 * lesson keep playing while you move around the app — or lock the phone.
 * A player rendered as a component would stop the moment its screen closed.
 */
let element: HTMLAudioElement | null = null;
function audio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'metadata';
    // Tells iOS this is a long-form listen rather than an effect, which is
    // part of what keeps it running with the screen off.
    element.setAttribute('playsinline', '');
  }
  return element;
}

export interface PlayerState {
  playing: boolean;
  /** Index into the queue — 0 is Shaami, 1 is Fusha, when playing both. */
  index: number;
  position: number;
  duration: number;
  /** Seconds already played by earlier tracks in the queue. */
  offset: number;
  loading: boolean;
  error: string | null;
}

export function usePodcastPlayer(title: string) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [state, setState] = useState<PlayerState>({
    playing: false, index: 0, position: 0, duration: 0,
    offset: 0, loading: false, error: null,
  });
  const queue = useRef<Track[]>([]);
  const at = useRef(0);
  const lengths = useRef<number[]>([]);

  const patch = (p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p }));

  const load = useCallback((i: number, autoplay: boolean) => {
    const track = queue.current[i];
    if (!track) return;
    const el = audio();
    at.current = i;
    el.src = track.url;
    el.load();
    patch({
      index: i,
      loading: true,
      position: 0,
      offset: lengths.current.slice(0, i).reduce((a, b) => a + b, 0),
    });
    if (autoplay) el.play().catch((e) => patch({ error: String(e), playing: false }));
  }, []);

  /** Start a queue from the beginning. */
  const start = useCallback((next: Track[]) => {
    queue.current = next;
    lengths.current = [];
    setTracks(next);
    patch({ error: null });
    load(0, true);
  }, [load]);

  const toggle = useCallback(() => {
    const el = audio();
    if (el.paused) el.play().catch((e) => patch({ error: String(e) }));
    else el.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = audio();
    if (Number.isFinite(el.duration)) {
      el.currentTime = Math.max(0, Math.min(seconds, el.duration));
    }
  }, []);

  const skip = useCallback((by: number) => seek(audio().currentTime + by), [seek]);

  /** Jump straight to a track — this is what the Fusha button does. */
  const jumpTo = useCallback((i: number) => load(i, true), [load]);

  const stop = useCallback(() => {
    const el = audio();
    el.pause();
    el.removeAttribute('src');
    el.load();
    queue.current = [];
    setTracks([]);
    patch({ playing: false, position: 0, duration: 0, offset: 0, index: 0 });
  }, []);

  useEffect(() => {
    const el = audio();
    const onTime = () => patch({ position: el.currentTime });
    const onMeta = () => {
      lengths.current[at.current] = el.duration;
      patch({ duration: el.duration, loading: false });
    };
    const onPlay = () => patch({ playing: true });
    const onPause = () => patch({ playing: false });
    const onError = () => patch({ error: 'That audio could not be loaded.', loading: false });
    // Playing "both" is two files, so the end of one starts the next rather
    // than ending the session.
    const onEnded = () => {
      if (at.current + 1 < queue.current.length) load(at.current + 1, true);
      else patch({ playing: false });
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
      el.removeEventListener('ended', onEnded);
    };
  }, [load]);

  // Lock-screen controls. Without these the phone shows a generic player and
  // the hardware buttons do nothing useful.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || tracks.length === 0) return;
    const track = tracks[state.index];
    ms.metadata = new MediaMetadata({
      title,
      artist: track?.label ?? '',
      album: 'Wazn',
    });
    ms.setActionHandler('play', () => audio().play());
    ms.setActionHandler('pause', () => audio().pause());
    ms.setActionHandler('seekbackward', () => skip(-10));
    ms.setActionHandler('seekforward', () => skip(30));
    ms.setActionHandler('previoustrack', () => (at.current > 0 ? load(at.current - 1, true) : seek(0)));
    ms.setActionHandler('nexttrack', () =>
      at.current + 1 < queue.current.length ? load(at.current + 1, true) : undefined);
    return () => {
      for (const a of ['play', 'pause', 'seekbackward', 'seekforward',
                       'previoustrack', 'nexttrack'] as const) {
        try { ms.setActionHandler(a, null); } catch { /* not all are supported */ }
      }
    };
  }, [title, tracks, state.index, skip, seek, load]);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (ms) ms.playbackState = state.playing ? 'playing' : 'paused';
  }, [state.playing]);

  return { state, tracks, start, toggle, seek, skip, jumpTo, stop };
}
