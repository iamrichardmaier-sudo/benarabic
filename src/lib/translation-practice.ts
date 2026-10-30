/**
 * Daily translation practice, as the app sees it: today's three sentences,
 * the attempts at them, and the feedback each got. The work happens in the
 * `translation-practice` edge function; this is the thin client over it.
 */
import { supabase } from '@/integrations/supabase/client';
import { today } from '@/lib/day';

export type WordStatus = 'ok' | 'fix' | 'add' | 'remove' | 'alternative';
export type Verdict = 'correct' | 'minor' | 'errors' | 'meaning';

export interface WordNote {
  yours: string;
  correct: string;
  status: WordStatus;
  rule: string;
  note: string;
}

export interface Feedback {
  verdict: Verdict;
  summary: string;
  closest_correct: string;
  closest_reference: string;
  words: WordNote[];
  tips: string[];
  verified: boolean;
  exact_match?: boolean;
}

export interface Challenge {
  id: string;
  day: string;
  position: number;
  english: string;
  grammar_focus: string;
  target_words: string[];
  reference_translations: string[];
  pitfalls: string[];
}

export interface Attempt {
  id: string;
  challenge_id: string;
  attempt: string;
  feedback: Feedback;
  flagged: boolean;
  created_at: string;
}

/** The function's own error message when it sent one, rather than a bare status. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('translation-practice', { body });
  if (error) {
    const sent = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(sent?.error ?? error.message);
  }
  return data as T;
}

type TodaySet = { challenges: Challenge[]; attempts: Attempt[] };

// Writing a day's sentences takes the model several seconds, so the daily
// prompt starts it as soon as it appears; opening the challenge then picks up
// the same request instead of starting a second one.
let prefetched: { day: string; promise: Promise<TodaySet> } | null = null;

export function prefetchToday(day: string = today()): void {
  if (prefetched?.day === day) return;
  const promise = call<TodaySet>({ action: 'today', day });
  prefetched = { day, promise };
  // A failed prefetch is forgotten, so opening the screen tries again.
  promise.catch(() => { if (prefetched?.promise === promise) prefetched = null; });
}

export function loadToday(day: string = today()): Promise<TodaySet> {
  if (prefetched?.day === day) {
    const { promise } = prefetched;
    // Used once: attempts made after it was fetched must come from a fresh read.
    prefetched = null;
    return promise;
  }
  return call({ action: 'today', day });
}

// The generated Supabase types predate these tables; this is the slice read here.
type ProgressClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => Promise<{ data: { id: string }[] | null; error: { message?: string } | null }>;
      in: (col: string, v: string[]) => Promise<{ data: { challenge_id: string }[] | null; error: { message?: string } | null }>;
    };
  };
};

export interface DayProgress {
  /** Whether today's sentences have been written yet. */
  ready: boolean;
  /** Sentences with at least one attempt. */
  done: number;
  total: number;
}

/**
 * How far today's challenge has got, read straight from the tables so Home
 * can show it without asking the model to write anything.
 */
export async function todayProgress(day: string = today()): Promise<DayProgress> {
  const db = supabase as unknown as ProgressClient;
  const { data: challenges, error } = await db.from('translation_challenges').select('id').eq('day', day);
  if (error) throw new Error(error.message ?? 'Could not read today’s challenge');
  const ids = (challenges ?? []).map((c) => c.id);
  if (ids.length === 0) return { ready: false, done: 0, total: 3 };
  const { data: attempts, error: attemptsError } = await db
    .from('translation_attempts').select('challenge_id').in('challenge_id', ids);
  if (attemptsError) throw new Error(attemptsError.message ?? 'Could not read today’s attempts');
  return { ready: true, done: new Set((attempts ?? []).map((a) => a.challenge_id)).size, total: ids.length };
}

const PROMPTED_KEY = 'translation-challenge-prompted';

/** True the first time it is asked on each local day; the daily prompt shows then. */
export function takeDailyPrompt(day: string = today()): boolean {
  try {
    if (localStorage.getItem(PROMPTED_KEY) === day) return false;
    localStorage.setItem(PROMPTED_KEY, day);
    return true;
  } catch {
    // Without storage the prompt would show on every load; Home's card is enough.
    return false;
  }
}

/** Records today's prompt as shown, e.g. when the app opened straight onto the challenge. */
export function markDailyPromptShown(day: string = today()): void {
  try { localStorage.setItem(PROMPTED_KEY, day); } catch { /* the card on Home still shows */ }
}

export function gradeAttempt(challengeId: string, attempt: string): Promise<Attempt> {
  return call({ action: 'grade', challengeId, attempt });
}

// The generated Supabase types predate this table; this is the slice used here.
type LooseClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, v: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Marks feedback the learner believes is wrong, so it is kept out of their weak spots. */
export async function flagAttempt(id: string, note: string): Promise<void> {
  const { error } = await (supabase as unknown as LooseClient)
    .from('translation_attempts')
    .update({ flagged: true, flag_note: note || null })
    .eq('id', id);
  if (error) throw new Error(error.message ?? 'Could not save the flag');
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  correct: 'Correct',
  minor: 'Almost — small slips',
  errors: 'Some grammar to fix',
  meaning: 'The meaning drifted',
};

export function isCorrection(status: WordStatus): boolean {
  return status === 'fix' || status === 'add' || status === 'remove';
}

/** Whether any attempt at a sentence has come back correct. */
export function solved(attempts: Attempt[]): boolean {
  return attempts.some((a) => a.feedback.verdict === 'correct');
}

/**
 * The other correct translations worth showing after an attempt: every stored
 * one except the one already shown as closest.
 */
export function otherWays(challenge: Challenge, feedback: Feedback): string[] {
  return challenge.reference_translations.filter((r) => r !== feedback.closest_reference);
}
