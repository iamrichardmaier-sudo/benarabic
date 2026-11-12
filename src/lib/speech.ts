/**
 * Saying a line aloud, in a recorded voice.
 *
 * Every speaker button and every drill that plays audio comes through here.
 * The line is asked of generate-speech, which keeps what it makes: a text is
 * paid for the first time anyone hears it and is a stored file from then on,
 * for every learner. So the cost of this is the size of what is listened to,
 * once, not how often it is played.
 *
 * Where the recorded voice cannot be had (offline, the service down or out of
 * credit) the browser's own voice says the line instead. A worse voice beats
 * a silent button.
 */
import { supabase } from '@/integrations/supabase/client';

/** 'ar' is the Fusha narrator, 'ar-shami' a Syrian voice for dialect forms. */
export type SpeechVoice = 'ar' | 'ar-shami' | 'en';

export interface SpeechOptions {
  voice?: SpeechVoice;
  /** Playback speed. Pitch is kept, so 0.6 is slower, not lower. */
  rate?: number;
}

/**
 * A card field as it should be said.
 *
 * Cards hold more than the word: two spellings ("طول / طِوال"), a plural note
 * ("نادي ج. نَوادي"), a feminine ending ("مَجنون/ة"). Read as written, the voice
 * says the word twice or stumbles over the note; only the first form is said.
 */
export function speakable(text: string): string {
  return (text || '')
    .split(/\s+\/\s+|\s+ج\.\s*|\s+—\s+/)[0]
    .replace(/\/\s*ة/g, '')
    .replace(/[ـ]+/g, '')
    .trim();
}

/** Longer than this is a passage, not a line, and is not sent. */
export const MAX_SPEECH_CHARS = 400;

// Object URLs for the lines heard this visit, so a replay is instant and a
// drill that plays one word five times asks for it once.
const clips = new Map<string, Promise<string>>();

/** jsdom has no audio and no network; tests get the browser path. */
const RECORDED = import.meta.env.MODE !== 'test';

/**
 * The voice service allows five lines to be made at once and refuses the
 * sixth, so a screen that asks for twelve (a drill fetching its session ahead)
 * is fed through three at a time.
 */
const MAX_AT_ONCE = 3;
let running = 0;
const waiting: (() => void)[] = [];

async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_AT_ONCE) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** Why the recorded voice is off, and until when it is not asked again. */
let outage: { reason: string; until: number } | null = null;
const outageListeners = new Set<(reason: string) => void>();

/** Be told (once per outage) that lines are being read by the browser's voice, and why. */
export function onSpeechOutage(listener: (reason: string) => void): () => void {
  outageListeners.add(listener);
  return () => outageListeners.delete(listener);
}

/** True while the recorded voice is known to be unavailable. */
export function recordedVoiceDown(): boolean {
  if (outage && Date.now() > outage.until) outage = null;
  return outage !== null;
}

/** True if the outage has already been announced today; marks it as announced otherwise. */
function toldToday(): boolean {
  const day = new Date().toDateString();
  try {
    if (localStorage.getItem('wazn-speech-outage-told') === day) return true;
    localStorage.setItem('wazn-speech-outage-told', day);
  } catch {
    /* no storage: say it */
  }
  return false;
}

interface ServiceError {
  status: number;
  message: string;
}

/** What the service said went wrong, from the error supabase-js hands back. */
async function readError(error: unknown): Promise<ServiceError> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    let message = '';
    try {
      message = ((await context.clone().json()) as { error?: string }).error ?? '';
    } catch {
      /* not JSON */
    }
    return { status: context.status, message };
  }
  return { status: 0, message: error instanceof Error ? error.message : '' };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STORE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/word-audio`;

/** The name a line's clip is stored under: sha256 of voice, a NUL, and the text (as generate-speech names it). */
async function clipName(text: string, voice: SpeechVoice): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}\0${text}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A clip that has already been made, read straight from storage.
 *
 * This is what keeps the audio working with no voice service behind it: a
 * banked line is a public file, and playing it needs no key, no function and
 * no credit. Null when the line has never been made.
 */
async function storedClip(text: string, voice: SpeechVoice): Promise<string | null> {
  try {
    if (!crypto?.subtle) return null;
    const response = await fetch(`${STORE}/${await clipName(text, voice)}.mp3`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size > 0 ? URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' })) : null;
  } catch {
    return null;
  }
}

async function requestClip(text: string, voice: SpeechVoice): Promise<string> {
  const stored = await storedClip(text, voice);
  if (stored) return stored;
  // Not banked. With the voice service known to be off there is nobody to make it.
  if (recordedVoiceDown()) throw new Error('This line has no recording.');
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase.functions.invoke('generate-speech', { body: { text, voice } });
    if (!error) {
      if (!(data instanceof Blob)) throw new Error('The speech service returned something unexpected.');
      return URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
    }
    const failure = await readError(error);
    // Busy is worth waiting out; it clears in a second or two.
    if (failure.status === 429 && attempt < 3) {
      await wait(700 * (attempt + 1));
      continue;
    }
    // Not set up, key refused, or out of credit: every line would fail the
    // same way, so stop asking for a while instead of failing each one slowly.
    if (failure.status === 401 || failure.status === 402 || /not configured|quota|credit|rejected/i.test(failure.message)) {
      const reason = failure.message || 'The voice service refused the request.';
      const fresh = !recordedVoiceDown();
      outage = { reason, until: Date.now() + 6 * 3_600_000 };
      if (fresh && !toldToday()) outageListeners.forEach((fn) => fn(reason));
    }
    throw new Error(failure.message || `The speech service failed (${failure.status}).`);
  }
}

function clipUrl(text: string, voice: SpeechVoice): Promise<string> {
  const key = `${voice}\0${text}`;
  let clip = clips.get(key);
  if (!clip) {
    clip = inTurn(() => requestClip(text, voice));
    // A failure is not kept: the next press should try again.
    clip.catch(() => clips.delete(key));
    clips.set(key, clip);
  }
  return clip;
}

/** Fetch lines ahead of need, so the first play of each has no wait. */
export function preloadSpeech(texts: string[], voice: SpeechVoice = 'ar'): void {
  if (!RECORDED || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  for (const text of texts) {
    const line = speakable(text);
    if (line && line.length <= MAX_SPEECH_CHARS) clipUrl(line, voice).catch(() => {});
  }
}

/**
 * One audio element for every line.
 *
 * A phone only lets a page start sound from inside a tap. A line is fetched
 * first and played after, by which time the tap is over, so a fresh element
 * made at that point is refused and nothing is heard. An element that has
 * played once inside a tap stays allowed, so this one is started silently on
 * the first touch or key press and used for everything after.
 */
let player: HTMLAudioElement | null = null;
let unlocked = false;
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
    player.setAttribute('playsinline', '');
  }
  return player;
}

function unlock(): void {
  if (unlocked || !RECORDED) return;
  unlocked = true;
  const audio = getPlayer();
  // Only when idle: a line already playing has done the unlocking itself.
  if (!audio.src) {
    audio.src = SILENCE;
    audio.play().catch(() => {
      unlocked = false;
    });
  }
}

if (typeof window !== 'undefined' && RECORDED) {
  for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

/** Counts requests, so a line that arrives after a newer one was asked for stays silent. */
let turn = 0;

/** Stop whatever is being said. */
export function stopSpeech(): void {
  turn++;
  // The silent clip that unlocks sound is left to finish: cutting it short can leave a phone still locked.
  if (player && !player.paused && player.src !== SILENCE) player.pause();
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

let browserVoice: SpeechSynthesisVoice | null = null;

function browserSpeak(text: string, voice: SpeechVoice, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice === 'en') {
      utterance.lang = 'en-US';
    } else {
      utterance.lang = 'ar-SA';
      if (!browserVoice) {
        const voices = window.speechSynthesis.getVoices();
        browserVoice = voices.find((v) => v.lang === 'ar-SA') || voices.find((v) => v.lang.startsWith('ar')) || null;
      }
      if (browserVoice) utterance.voice = browserVoice;
    }
    utterance.rate = 0.8 * rate;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Say `text`. Resolves when it has finished, was replaced by a newer line, or
 * could not be said at all; it never rejects, since nothing a caller does
 * should depend on a speaker having worked.
 */
export async function playSpeech(text: string, options: SpeechOptions = {}): Promise<void> {
  const line = speakable(text);
  if (!line || typeof window === 'undefined') return;
  const voice = options.voice ?? 'ar';
  const rate = options.rate ?? 1;

  stopSpeech();
  const mine = turn;

  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (RECORDED && online && line.length <= MAX_SPEECH_CHARS) {
    try {
      const url = await clipUrl(line, voice);
      if (mine !== turn) return;
      const audio = getPlayer();
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('pause', done);
          audio.removeEventListener('error', failed);
          resolve();
        };
        const failed = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('pause', done);
          audio.removeEventListener('error', failed);
          reject(new Error('The clip would not play.'));
        };
        audio.addEventListener('ended', done);
        audio.addEventListener('pause', done);
        audio.addEventListener('error', failed);
        audio.src = url;
        // Set after the source: loading a new one puts the speed back to 1.
        audio.preservesPitch = true;
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        audio.play().catch(failed);
      });
      return;
    } catch (err) {
      if (mine !== turn) return;
      if (!recordedVoiceDown()) console.error('Recorded speech failed, using the browser voice:', err);
    }
  }
  await browserSpeak(line, voice, rate);
}
