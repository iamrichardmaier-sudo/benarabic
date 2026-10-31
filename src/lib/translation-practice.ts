/**
 * Daily translation practice, as the app sees it: today's three sentences,
 * the attempts at them, and the feedback each got.
 *
 * Each day's sentences come with an answer key, written and checked ahead of
 * time (supabase/answer-keys/README.md). Grading runs here, against the key,
 * with no model call, and the attempt is saved straight to the table.
 */
import { supabase } from '@/integrations/supabase/client';
import { today } from '@/lib/day';
import { gradeWithKey, type AnswerKey } from '@/lib/answer-key';

export type WordStatus = 'ok' | 'fix' | 'add' | 'remove' | 'alternative' | 'unknown';
export type Verdict = 'correct' | 'minor' | 'errors' | 'meaning' | 'unchecked';

export interface WordNote {
  /** The English the note is about, when grading went part by part. */
  part?: string;
  yours: string;
  correct: string;
  status: WordStatus;
  rule: string;
  note: string;
  /** Correct ways to say a part that could not be checked. */
  options?: string[];
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
  answer_key: AnswerKey | null;
}

export interface Attempt {
  id: string;
  challenge_id: string;
  attempt: string;
  feedback: Feedback;
  flagged: boolean;
  created_at: string;
}

// The generated Supabase types predate these tables; this is the slice used here.
type DbError = { message?: string } | null;
interface Query<T> extends PromiseLike<{ data: T[] | null; error: DbError }> {
  eq: (col: string, v: string) => Query<T>;
  in: (col: string, v: string[]) => Query<T>;
  order: (col: string, opts?: { ascending?: boolean }) => Query<T>;
}
type LooseClient = {
  from: (table: string) => {
    select: <T>(cols: string) => Query<T>;
    insert: (values: Record<string, unknown>) => {
      select: (cols: string) => { single: <T>() => PromiseLike<{ data: T | null; error: DbError }> };
    };
    update: (values: Record<string, unknown>) => {
      eq: (col: string, v: string) => PromiseLike<{ error: DbError }>;
    };
  };
};
const db = supabase as unknown as LooseClient;

const CHALLENGE_COLUMNS = 'id, day, position, english, grammar_focus, target_words, reference_translations, pitfalls, answer_key';
const ATTEMPT_COLUMNS = 'id, challenge_id, attempt, feedback, flagged, created_at';

type TodaySet = { challenges: Challenge[]; attempts: Attempt[] };

async function readDay(day: string): Promise<TodaySet> {
  const { data: challenges, error } = await db
    .from('translation_challenges').select<Challenge>(CHALLENGE_COLUMNS).eq('day', day).order('position');
  if (error) throw new Error(error.message ?? 'Could not read today’s sentences');
  const ids = (challenges ?? []).map((c) => c.id);
  if (ids.length === 0) return { challenges: [], attempts: [] };
  const { data: attempts, error: attemptsError } = await db
    .from('translation_attempts').select<Attempt>(ATTEMPT_COLUMNS).in('challenge_id', ids).order('created_at');
  if (attemptsError) throw new Error(attemptsError.message ?? 'Could not read your attempts');
  return { challenges: challenges ?? [], attempts: attempts ?? [] };
}

// The daily prompt starts the read as it appears, so the screen opens on it.
let prefetched: { day: string; promise: Promise<TodaySet> } | null = null;

export function prefetchToday(day: string = today()): void {
  if (prefetched?.day === day) return;
  const promise = readDay(day);
  prefetched = { day, promise };
  // A failed prefetch is forgotten, so opening the screen tries again.
  promise.catch(() => { if (prefetched?.promise === promise) prefetched = null; });
}

export function loadToday(day: string = today()): Promise<TodaySet> {
  if (prefetched?.day === day) {
    const { promise } = prefetched;
    // Used once: attempts made after it was read must come from a fresh read.
    prefetched = null;
    return promise;
  }
  return readDay(day);
}

export interface DayProgress {
  /** Whether today's sentences have been written yet. */
  ready: boolean;
  /** Sentences with at least one attempt. */
  done: number;
  total: number;
}

/** How far today's challenge has got, for the card on Home. */
export async function todayProgress(day: string = today()): Promise<DayProgress> {
  const { data: challenges, error } = await db.from('translation_challenges').select<{ id: string }>('id').eq('day', day);
  if (error) throw new Error(error.message ?? 'Could not read today’s challenge');
  const ids = (challenges ?? []).map((c) => c.id);
  if (ids.length === 0) return { ready: false, done: 0, total: 3 };
  const { data: attempts, error: attemptsError } = await db
    .from('translation_attempts').select<{ challenge_id: string }>('challenge_id').in('challenge_id', ids);
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

/** Grades an attempt against the sentence's answer key and saves it. */
export async function gradeAttempt(challenge: Challenge, attempt: string): Promise<Attempt> {
  if (!challenge.answer_key) throw new Error('This sentence has no answer key, so it can’t be checked.');
  const feedback = gradeWithKey(challenge.answer_key, challenge.reference_translations, attempt);
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Sign in again to save your attempt.');
  const { data, error } = await db
    .from('translation_attempts')
    .insert({ user_id: userId, challenge_id: challenge.id, attempt, feedback })
    .select(ATTEMPT_COLUMNS)
    .single<Attempt>();
  if (error || !data) throw new Error(error?.message ?? 'Could not save your attempt');
  return data;
}

/** Marks feedback the learner believes is wrong, so the answer key is reviewed. */
export async function flagAttempt(id: string, note: string): Promise<void> {
  const { error } = await db
    .from('translation_attempts')
    .update({ flagged: true, flag_note: note || null })
    .eq('id', id);
  if (error) throw new Error(error.message ?? 'Could not save the flag');
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  correct: 'Correct',
  minor: 'Almost: one thing to fix',
  errors: 'Some grammar to fix',
  meaning: 'The meaning drifted',
  unchecked: 'Partly checked',
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
