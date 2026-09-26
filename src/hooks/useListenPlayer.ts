import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One audio element, kept alive for the life of the app -- the same trick
 * `usePodcastPlayer` uses, and for the same reason: created outside React
 * and never unmounted, so the loop keeps going while the phone is locked. A
 * separate element from the podcast player's, so listening to a set of
 * cards and a podcast never fight over one `<audio>`.
 */
let element: HTMLAudioElement | null = null;
function audio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.loop = true;
    element.setAttribute('playsinline', '');
  }
  return element;
}

export interface ListenPlayerState {
  playing: boolean;
  loading: boolean;
  error: string | null;
  speed: number;
}

export function useListenPlayer(title: string) {
  const [state, setState] = useState<ListenPlayerState>({
    playing: false, loading: false, error: null, speed: 1,
  });
  const urlRef = useRef<string | null>(null);

  const patch = (p: Partial<ListenPlayerState>) => setState((s) => ({ ...s, ...p }));

  /** Start looping a freshly generated track. Takes ownership of the URL --
   *  it is revoked when a new one replaces it or `stop` is called. The
   *  element's playbackRate is untouched here on purpose: it is a property
   *  of the persistent singleton, so a speed chosen for one track carries
   *  over to the next rather than resetting to 1x every time. */
  const play = useCallback((url: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    const el = audio();
    el.src = url;
    el.load();
    patch({ loading: true, error: null });
    el.play().catch((e) => patch({ error: String(e), playing: false }));
  }, []);

  /** Live-adjustable, since it is a property of already-generated audio --
   *  no need to regenerate anything to hear it faster or slower. */
  const setSpeed = useCallback((rate: number) => {
    audio().playbackRate = rate;
    patch({ speed: rate });
  }, []);

  const toggle = useCallback(() => {
    const el = audio();
    if (el.paused) el.play().catch((e) => patch({ error: String(e) }));
    else el.pause();
  }, []);

  const stop = useCallback(() => {
    const el = audio();
    el.pause();
    el.removeAttribute('src');
    el.load();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    patch({ playing: false, loading: false });
  }, []);

  useEffect(() => {
    const el = audio();
    const onPlay = () => patch({ playing: true });
    const onPause = () => patch({ playing: false });
    const onCanPlay = () => patch({ loading: false });
    const onError = () => patch({ error: 'That audio could not be played.', loading: false });
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onError);
    };
  }, []);

  // Lock-screen controls -- play/pause only, since there is nothing to skip
  // between in a single looping track.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    ms.metadata = new MediaMetadata({ title, artist: 'Listen to cards', album: 'Wazn' });
    ms.setActionHandler('play', () => audio().play());
    ms.setActionHandler('pause', () => audio().pause());
    return () => {
      for (const a of ['play', 'pause'] as const) {
        try { ms.setActionHandler(a, null); } catch { /* not all are supported */ }
      }
    };
  }, [title]);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (ms) ms.playbackState = state.playing ? 'playing' : 'paused';
  }, [state.playing]);

  // Revoking on unmount would cut off playback that is meant to survive the
  // screen closing, so this deliberately does not clean up the object URL --
  // only `stop` (called when the user leaves the screen on purpose) does.

  return { state, play, toggle, stop, setSpeed };
}
