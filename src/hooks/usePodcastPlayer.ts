import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { registerMedia, setRate } from '@/lib/now-playing';
import { readPreferences, subscribePreferences } from '@/lib/preferences';

export interface Track {
  url: string;
  label: string;
}

/** How far the skip buttons, and the lock-screen seek buttons, jump. */
export const SKIP_SECONDS = 15;

/** The playback speeds on offer, slowest first. */
export const SPEEDS = [0.5, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 2] as const;

/** One listening speed for everything in the app: the audioRate preference. */
const savedSpeed = (): number => readPreferences().audioRate;

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

interface Shared {
  tracks: Track[];
  state: PlayerState;
  speed: number;
}

const IDLE: PlayerState = {
  playing: false, index: 0, position: 0, duration: 0,
  offset: 0, loading: false, error: null,
};

/*
 * Everything about what is playing lives here, beside the element, rather
 * than in a component's state. Every screen that shows the player — the Home
 * shelves, the play bar, the video view — reads the same queue and clock, so
 * a screen that mounts mid-episode sees it already playing.
 */
let shared: Shared = { tracks: [], state: IDLE, speed: savedSpeed() };
const subscribers = new Set<() => void>();
let queue: Track[] = [];
let at = 0;
let lengths: number[] = [];
let title = '';
/** Where to start the track being loaded, once its length is known. */
let pendingSeek: number | null = null;

function set(next: Partial<Shared>) {
  shared = { ...shared, ...next };
  subscribers.forEach((s) => s());
}
const patch = (p: Partial<PlayerState>) => set({ state: { ...shared.state, ...p } });

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
    listen(element);
    // It never joins the page, so the play bar is told about it directly.
    registerMedia(element);
    // A speed changed anywhere (the bar, Settings, the reader) shows here too.
    subscribePreferences(() => {
      if (shared.speed !== savedSpeed()) set({ speed: savedSpeed() });
    });
  }
  return element;
}

/** The element's events, wired once for as long as it lives. */
function listen(el: HTMLAudioElement) {
  el.addEventListener('timeupdate', () => patch({ position: el.currentTime }));
  el.addEventListener('loadedmetadata', () => {
    lengths[at] = el.duration;
    if (pendingSeek !== null) {
      el.currentTime = Math.min(pendingSeek, el.duration || pendingSeek);
      pendingSeek = null;
    }
    patch({ duration: el.duration, loading: false });
  });
  el.addEventListener('play', () => {
    patch({ playing: true });
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
  });
  el.addEventListener('pause', () => {
    patch({ playing: false });
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
  });
  el.addEventListener('error', () => {
    // Clearing the source on stop fires an error too; that is not one.
    if (queue.length) patch({ error: 'That audio could not be loaded.', loading: false });
  });
  // Playing "both" is two files, so the end of one starts the next rather
  // than ending the session.
  el.addEventListener('ended', () => {
    if (at + 1 < queue.length) load(at + 1, true);
    else patch({ playing: false });
  });
}

/** Applies the chosen speed. A new source resets playbackRate to the
 *  default rate, so the default is set too — that is what carries the speed
 *  over to the next track in a queue. */
function applySpeed(el: HTMLMediaElement, rate: number) {
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
}

function load(i: number, autoplay: boolean, startAt = 0) {
  const track = queue[i];
  if (!track) return;
  const el = audio();
  at = i;
  pendingSeek = startAt > 0 ? startAt : null;
  // What the play bar shows.
  el.dataset.title = track.label;
  el.dataset.subtitle = title;
  el.src = track.url;
  el.load();
  applySpeed(el, savedSpeed());
  patch({
    index: i,
    loading: true,
    position: startAt,
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  });
  syncSession();
  if (autoplay) el.play()?.catch((e) => patch({ error: String(e), playing: false }));
}

function seek(seconds: number) {
  const el = audio();
  if (Number.isFinite(el.duration)) {
    el.currentTime = Math.max(0, Math.min(seconds, el.duration));
  }
}

const skip = (by: number) => seek(audio().currentTime + by);

const SESSION_ACTIONS = ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack'] as const;

/**
 * Lock-screen controls. Without these the phone shows a generic player and
 * the hardware buttons do nothing useful. Set again on every track, since
 * the card-listening player shares the one media session and clears it.
 */
function syncSession() {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!ms) return;
  if (queue.length === 0) {
    for (const a of SESSION_ACTIONS) {
      try { ms.setActionHandler(a, null); } catch { /* not all are supported */ }
    }
    return;
  }
  if (typeof MediaMetadata !== 'undefined') {
    ms.metadata = new MediaMetadata({ title, artist: queue[at]?.label ?? '', album: 'Wazn' });
  }
  const handlers: Record<(typeof SESSION_ACTIONS)[number], () => void> = {
    play: () => { audio().play()?.catch(() => {}); },
    pause: () => audio().pause(),
    seekbackward: () => skip(-SKIP_SECONDS),
    seekforward: () => skip(SKIP_SECONDS),
    previoustrack: () => (at > 0 ? load(at - 1, true) : seek(0)),
    nexttrack: () => { if (at + 1 < queue.length) load(at + 1, true); },
  };
  for (const a of SESSION_ACTIONS) {
    try { ms.setActionHandler(a, handlers[a]); } catch { /* not all are supported */ }
  }
}

export interface StartOptions {
  /** Seconds into the first track to begin at. */
  at?: number;
  /** Start paused rather than playing. Defaults to playing. */
  autoplay?: boolean;
}

/**
 * The app's shared audio player. Any number of screens can use it at once;
 * they all drive, and see, the one element.
 */
export function usePodcastPlayer(sessionTitle: string) {
  const { tracks, state, speed } = useSyncExternalStore(
    (cb) => { subscribers.add(cb); return () => { subscribers.delete(cb); }; },
    () => shared,
  );
  const titleRef = useRef(sessionTitle);
  useEffect(() => { titleRef.current = sessionTitle; }, [sessionTitle]);

  /** Start a queue from the beginning (or from `options.at`). */
  const start = useCallback((next: Track[], options: StartOptions = {}) => {
    queue = next;
    lengths = [];
    title = titleRef.current;
    set({ tracks: next });
    patch({ error: null });
    load(0, options.autoplay ?? true, options.at ?? 0);
  }, []);

  const toggle = useCallback(() => {
    const el = audio();
    if (el.paused) el.play()?.catch((e) => patch({ error: String(e) }));
    else el.pause();
  }, []);

  /** Jump straight to a track — this is what the Fusha button does. */
  const jumpTo = useCallback((i: number) => load(i, true), []);

  /** Live, and kept for every track after this one: it is the app-wide speed. */
  const setSpeed = useCallback((rate: number) => {
    setRate(rate);
    applySpeed(audio(), savedSpeed());
    set({ speed: savedSpeed() });
  }, []);

  const stop = useCallback(() => {
    const el = audio();
    queue = [];
    pendingSeek = null;
    el.pause();
    el.removeAttribute('src');
    el.load();
    set({ tracks: [], state: { ...IDLE } });
    syncSession();
  }, []);

  return { state, tracks, speed, start, toggle, seek, skip, jumpTo, setSpeed, stop };
}
