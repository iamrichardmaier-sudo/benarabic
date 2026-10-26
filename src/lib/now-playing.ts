/**
 * What is playing, for the play bar at the bottom of the app.
 *
 * Whatever audio or video starts playing becomes the current one: the daily
 * audios and podcasts (one shared element, registered below), the chapter
 * narration and the course videos (found by listening for "play" on the
 * page, which media events reach only in the capture phase). One listening
 * speed (the audioRate preference, also in Settings and the reader) applies
 * to all of them.
 */
import { readPreferences, setAudioRate, subscribePreferences } from './preferences';

export interface NowPlaying {
  /** False once nothing is loaded, or the bar was closed. */
  active: boolean;
  title: string;
  subtitle: string;
  kind: 'audio' | 'video';
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
}

const EMPTY: NowPlaying = {
  active: false, title: '', subtitle: '', kind: 'audio', playing: false, position: 0, duration: 0, rate: 1,
};

let current: HTMLMediaElement | null = null;
let dismissed = false;
let snapshot: NowPlaying = { ...EMPTY, rate: readPreferences().audioRate };
const listeners = new Set<() => void>();

function describe(el: HTMLMediaElement): { title: string; subtitle: string } {
  const title = el.dataset.title || el.getAttribute('aria-label') || el.getAttribute('title') || '';
  return {
    title: title || (el instanceof HTMLVideoElement ? 'Video' : 'Audio'),
    subtitle: el.dataset.subtitle || '',
  };
}

function emit() {
  const el = current;
  const rate = readPreferences().audioRate;
  snapshot = el && !dismissed && (el.currentSrc || el.getAttribute('src'))
    ? {
      active: true,
      ...describe(el),
      kind: el instanceof HTMLVideoElement ? 'video' : 'audio',
      playing: !el.paused && !el.ended,
      position: el.currentTime || 0,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      rate,
    }
    : { ...EMPTY, rate };
  for (const l of listeners) l();
}

const EVENTS = ['timeupdate', 'play', 'pause', 'ended', 'durationchange', 'loadedmetadata', 'emptied', 'ratechange'] as const;

function makeCurrent(el: HTMLMediaElement) {
  if (el !== current) {
    for (const e of EVENTS) current?.removeEventListener(e, emit);
    current = el;
    for (const e of EVENTS) el.addEventListener(e, emit);
  }
  dismissed = false;
  // The chosen speed, whatever this element was set to before.
  const rate = readPreferences().audioRate;
  if (el.playbackRate !== rate) el.playbackRate = rate;
  emit();
}

/** For media that never joins the page (the shared podcast element). */
export function registerMedia(el: HTMLMediaElement): void {
  el.addEventListener('play', () => makeCurrent(el));
}

let installed = false;
/** Call once: follows every audio and video on the page. */
export function installMediaWatcher(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLMediaElement) makeCurrent(e.target);
  }, true);
  // A speed changed in Settings or in the reader applies at once.
  subscribePreferences(() => {
    const rate = readPreferences().audioRate;
    if (current && current.playbackRate !== rate) current.playbackRate = rate;
    emit();
  });
}

export function subscribeNowPlaying(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNowPlaying(): NowPlaying {
  return snapshot;
}

export function togglePlay(): void {
  if (!current) return;
  if (current.paused) void current.play().catch(() => undefined);
  else current.pause();
}

export function seekTo(seconds: number): void {
  if (!current || !Number.isFinite(current.duration)) return;
  current.currentTime = Math.max(0, Math.min(seconds, current.duration));
}

export function skipBy(seconds: number): void {
  if (current) seekTo(current.currentTime + seconds);
}

/** Sets the listening speed for everything (saved, like the Settings slider). */
export function setRate(rate: number): void {
  const saved = setAudioRate(rate);
  if (current) current.playbackRate = saved;
}

/** Closes the bar: pauses, and hides it until something plays again. */
export function dismiss(): void {
  current?.pause();
  dismissed = true;
  emit();
}
