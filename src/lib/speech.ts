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

/** Longer than this is a passage, not a line, and is not sent. */
export const MAX_SPEECH_CHARS = 400;

// Object URLs for the lines heard this visit, so a replay is instant and a
// drill that plays one word five times asks for it once.
const clips = new Map<string, Promise<string>>();

/** jsdom has no audio and no network; tests get the browser path. */
const RECORDED = import.meta.env.MODE !== 'test';

function clipUrl(text: string, voice: SpeechVoice): Promise<string> {
  const key = `${voice}\0${text}`;
  let clip = clips.get(key);
  if (!clip) {
    clip = supabase.functions
      .invoke('generate-speech', { body: { text, voice } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!(data instanceof Blob)) throw new Error('The speech service returned something unexpected.');
        return URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
      });
    // A failure is not kept: the next press should try again.
    clip.catch(() => clips.delete(key));
    clips.set(key, clip);
  }
  return clip;
}

/** Fetch lines ahead of need, so the first play of each has no wait. */
export function preloadSpeech(texts: string[], voice: SpeechVoice = 'ar'): void {
  if (!RECORDED || typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const text of texts) {
    const line = text.trim();
    if (line && line.length <= MAX_SPEECH_CHARS) clipUrl(line, voice).catch(() => {});
  }
}

let playing: HTMLAudioElement | null = null;
/** Counts requests, so a line that arrives after a newer one was asked for stays silent. */
let turn = 0;

/** Stop whatever is being said. */
export function stopSpeech(): void {
  turn++;
  if (playing) {
    playing.pause();
    playing = null;
  }
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
  const line = (text || '').trim();
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
      const audio = new Audio(url);
      audio.preservesPitch = true;
      audio.playbackRate = rate;
      playing = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onpause = () => resolve();
        audio.onerror = () => reject(new Error('The clip would not play.'));
        audio.play().catch(reject);
      });
      if (playing === audio) playing = null;
      return;
    } catch (err) {
      if (mine !== turn) return;
      console.error('Recorded speech failed, using the browser voice:', err);
    }
  }
  await browserSpeak(line, voice, rate);
}
