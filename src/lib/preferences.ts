/**
 * App-wide reading/audio preferences.
 *
 * These live in one place because the same value is adjustable from two
 * screens: the global Settings page and the contextual controls inside the
 * reader. A learner who bumps the font size while reading expects Settings to
 * agree, and vice versa — so both read and write through here rather than
 * keeping private copies of the same localStorage key.
 *
 * Backed by localStorage with a tiny subscription so open screens re-render
 * when a value changes elsewhere in the app.
 */

export type Theme = 'light' | 'dark' | 'system';

/**
 * Which Arabic a flashcard leads with.
 *
 * A card carries a Fusha form and, where one was recorded, a Shaami
 * equivalent. Plenty of words are the same in both, so 'shaami' falls back to
 * the Fusha rather than hiding a card that has no separate dialect form —
 * studying one dialect should never shrink the deck.
 */
export type Dialect = 'msa' | 'shaami' | 'both';

export interface Preferences {
  /** Reading text scale, 0.8–1.3. */
  textScale: number;
  /** Chapter-audio playback rate, 0.75–1.0. */
  audioRate: number;
  theme: Theme;
  dialect: Dialect;
}

export const DIALECT_LABELS: Record<Dialect, string> = {
  msa: 'MSA',
  shaami: 'Shaami',
  both: 'Both',
};

export const TEXT_SCALE_MIN = 0.8;
export const TEXT_SCALE_MAX = 1.3;
export const TEXT_SCALE_STEP = 0.1;

export const AUDIO_RATE_MIN = 0.75;
export const AUDIO_RATE_MAX = 1;
export const AUDIO_RATE_STEP = 0.05;

// Existing keys are kept verbatim so preferences already saved on a device
// survive this refactor rather than silently resetting.
const KEYS = {
  textScale: 'arabic-flashcards-bible-text-scale',
  audioRate: 'arabic-flashcards-bible-audio-rate',
  theme: 'wazn-theme',
  dialect: 'wazn-dialect',
} as const;

const DEFAULTS: Preferences = { textScale: 1, audioRate: 1, theme: 'system', dialect: 'both' };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function readNumber(key: string, fallback: number, lo: number, hi: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
  } catch {
    return fallback;
  }
}

export function readPreferences(): Preferences {
  let theme: Theme = DEFAULTS.theme;
  try {
    const t = localStorage.getItem(KEYS.theme);
    if (t === 'light' || t === 'dark' || t === 'system') theme = t;
  } catch {
    /* fall through to default */
  }
  let dialect: Dialect = DEFAULTS.dialect;
  try {
    const d = localStorage.getItem(KEYS.dialect);
    if (d === 'msa' || d === 'shaami' || d === 'both') dialect = d;
  } catch {
    /* fall through to default */
  }
  return {
    textScale: readNumber(KEYS.textScale, DEFAULTS.textScale, TEXT_SCALE_MIN, TEXT_SCALE_MAX),
    audioRate: readNumber(KEYS.audioRate, DEFAULTS.audioRate, AUDIO_RATE_MIN, AUDIO_RATE_MAX),
    theme,
    dialect,
  };
}

const listeners = new Set<() => void>();

export function subscribePreferences(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference just won't persist */
  }
  emit();
}

export function setTextScale(value: number): number {
  const next = Math.round(clamp(value, TEXT_SCALE_MIN, TEXT_SCALE_MAX) * 100) / 100;
  write(KEYS.textScale, String(next));
  return next;
}

export function setAudioRate(value: number): number {
  const next = Math.round(clamp(value, AUDIO_RATE_MIN, AUDIO_RATE_MAX) * 100) / 100;
  write(KEYS.audioRate, String(next));
  return next;
}

export function setDialect(dialect: Dialect): void {
  write(KEYS.dialect, dialect);
}

export function setTheme(theme: Theme): void {
  write(KEYS.theme, theme);
  applyTheme(theme);
}

/**
 * Reflects the chosen theme onto the document. "system" follows the OS and
 * keeps following it as the OS setting changes, which is why the media query
 * is consulted here rather than resolved once at startup.
 */
export function applyTheme(theme: Theme = readPreferences().theme): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

/** Call once at startup: applies the saved theme and tracks OS changes. */
export function initTheme(): void {
  applyTheme();
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readPreferences().theme === 'system') applyTheme('system');
  });
}
