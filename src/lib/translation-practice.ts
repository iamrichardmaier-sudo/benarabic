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

export function loadToday(day: string = today()): Promise<{ challenges: Challenge[]; attempts: Attempt[] }> {
  return call({ action: 'today', day });
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
