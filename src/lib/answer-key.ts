/**
 * Grading a translation against the answer key prepared for its sentence,
 * with no model call: instant, free, and the same every time.
 *
 * A key splits the sentence into chunks (its clauses). For each chunk it
 * lists the accepted wordings and the mistakes a learner is likely to make,
 * each with the rule it breaks. A chunk of the attempt is:
 *   - correct when an accepted wording appears in it,
 *   - a mistake when a predicted mistake appears (every one found is shown),
 *   - "also correct" for predicted wordings that are valid but unexpected,
 *   - unchecked when nothing matches. Unpredicted text is never called wrong.
 *
 * Matching is on whole words, after removing vowels and the spelling
 * variants nobody should be marked down for (alef/hamza seats, ة/ه, ى/ي). The
 * first word of a form may carry a joined و or ف. Mistakes marked `strict`
 * are matched with hamza seats kept, for errors that differ only there
 * (تقول أنّ for تقول إنّ). See supabase/answer-keys/README.md.
 */
import type { Feedback, WordNote } from './translation-practice';

export interface KeyMistake {
  text: string;
  rule: string;
  note: string;
  /** Matched with hamza seats kept. */
  strict?: boolean;
  /** "alternative": valid Arabic, shown as also correct. */
  status?: 'alternative';
}

export interface KeyChunk {
  /** The English this chunk translates. */
  en: string;
  accept: string[];
  mistakes: KeyMistake[];
}

export interface AnswerKey {
  /** One correct translation with full vowels, for display. */
  model_answer: string;
  chunks: KeyChunk[];
}

const VOWELS = /[ً-ٰٟـ]/g;
const PUNCTUATION = /[.,!?؟،؛:;"'«»()\-–—]/g;

function normWord(w: string, keepHamza: boolean): string {
  let s = w.replace(VOWELS, '');
  if (!keepHamza) s = s.replace(/[أإآٱ]/g, 'ا');
  return s.replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

/** The words of a text as written, and as compared. */
function words(text: string, keepHamza = false): { raw: string[]; norm: string[] } {
  // A stray vowel mark or tatweel on its own is not a word.
  const raw = text.replace(PUNCTUATION, ' ').split(/\s+/).filter((w) => normWord(w, keepHamza) !== '');
  return { raw, norm: raw.map((w) => normWord(w, keepHamza)) };
}

/**
 * Where `form` appears in `text` as whole words, as the words of `text` it
 * covers, or null. The first word may carry a joined و or ف.
 */
export function findForm(text: string, form: string, keepHamza = false): string | null {
  const t = words(text, keepHamza);
  const f = words(form, keepHamza).norm;
  if (f.length === 0) return null;
  for (let i = 0; i + f.length <= t.norm.length; i++) {
    const first = t.norm[i];
    const firstOk = first === f[0] || ((first[0] === 'و' || first[0] === 'ف') && first.slice(1) === f[0]);
    if (firstOk && f.every((w, k) => k === 0 || t.norm[i + k] === w)) {
      return t.raw.slice(i, i + f.length).join(' ');
    }
  }
  return null;
}

export type ChunkStatus = 'ok' | 'mistake' | 'alternative' | 'unchecked';

export interface ChunkResult {
  chunk: KeyChunk;
  status: ChunkStatus;
  /** The learner's words the result is about. */
  found: string;
  /** Mistakes (or valid alternatives) found in this chunk. */
  mistakes: { mistake: KeyMistake; found: string }[];
}

/**
 * A mistake that contains an accepted form is more specific than it
 * (إلا الرمادية المناشف holds إلا الرمادية), so it is looked for first, or
 * the accepted form would match and hide it.
 */
const outranksAccept = (chunk: KeyChunk, m: KeyMistake) =>
  Boolean(m.strict) || chunk.accept.some((a) => findForm(m.text, a) !== null);

/** Each chunk of the key, checked against the attempt. */
export function checkChunks(key: AnswerKey, attempt: string): ChunkResult[] {
  return key.chunks.map((chunk) => {
    const strict = chunk.mistakes
      .filter((m) => outranksAccept(chunk, m))
      .map((m) => ({ mistake: m, found: findForm(attempt, m.text, Boolean(m.strict)) }))
      .filter((x): x is { mistake: KeyMistake; found: string } => x.found !== null);
    if (strict.length === 0) {
      for (const form of chunk.accept) {
        const found = findForm(attempt, form);
        if (found) return { chunk, status: 'ok', found, mistakes: [] };
      }
    }
    const loose = chunk.mistakes
      .filter((m) => !outranksAccept(chunk, m))
      .map((m) => ({ mistake: m, found: findForm(attempt, m.text) }))
      .filter((x): x is { mistake: KeyMistake; found: string } => x.found !== null);
    const all = [...strict, ...loose];
    const errors = all.filter((x) => x.mistake.status !== 'alternative');
    if (errors.length > 0) return { chunk, status: 'mistake', found: errors[0].found, mistakes: errors };
    if (all.length > 0) return { chunk, status: 'alternative', found: all[0].found, mistakes: all };
    return { chunk, status: 'unchecked', found: '', mistakes: [] };
  });
}

/** Dice overlap of two sentences' words, 0–1. */
export function similarity(a: string, b: string): number {
  const ta = words(a).norm;
  const tb = words(b).norm;
  if (ta.length === 0 || tb.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const t of tb) pool.set(t, (pool.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of ta) {
    const left = pool.get(t) ?? 0;
    if (left > 0) {
      shared++;
      pool.set(t, left - 1);
    }
  }
  return (2 * shared) / (ta.length + tb.length);
}

/** The correct translation nearest the attempt, or "" when there are none. */
export function closestReference(attempt: string, references: string[]): string {
  let best = '';
  let bestScore = -1;
  for (const r of references) {
    const score = similarity(attempt, r);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

const sameSentence = (a: string, b: string) => words(a).norm.join(' ') === words(b).norm.join(' ');

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The feedback for an attempt, built from the key alone. */
export function gradeWithKey(key: AnswerKey, references: string[], attempt: string): Feedback {
  const nearest = closestReference(attempt, references);
  const exact = references.some((r) => sameSentence(r, attempt)) || sameSentence(key.model_answer, attempt);
  const results = checkChunks(key, attempt);

  const notes: WordNote[] = results.flatMap((r): WordNote[] => {
    const best = r.chunk.accept[0] ?? '';
    if (r.status === 'ok') {
      return [{ part: r.chunk.en, yours: r.found, correct: r.found, status: 'ok', rule: '', note: '' }];
    }
    if (r.status === 'unchecked') {
      return [{
        part: r.chunk.en, yours: '', correct: best, status: 'unknown', rule: '',
        note: 'This part didn’t match anything in the answer key, so it wasn’t checked. Compare yours with these:',
        options: r.chunk.accept.slice(0, 4),
      }];
    }
    return r.mistakes.map(({ mistake, found }) => ({
      part: r.chunk.en,
      yours: found,
      correct: mistake.status === 'alternative' ? found : best,
      status: mistake.status === 'alternative' ? 'alternative' : 'fix',
      rule: mistake.rule,
      note: mistake.note,
    }));
  });

  const errors = notes.filter((n) => n.status === 'fix').length;
  const unchecked = notes.filter((n) => n.status === 'unknown').length;
  const verdict = exact ? 'correct'
    : errors >= 2 ? 'errors'
      : errors === 1 ? 'minor'
        : unchecked > 0 ? 'unchecked'
          : 'correct';
  const summary = exact
    ? 'Exactly right: this matches one of the correct translations.'
    : verdict === 'correct'
      ? 'Every part matches a correct translation.'
      : errors > 0
        ? `${plural(errors, 'thing', 'things')} to fix below${unchecked > 0 ? `, and ${plural(unchecked, 'part', 'parts')} the key couldn’t check` : ''}.`
        : `No mistakes found, but ${plural(unchecked, 'part', 'parts')} didn’t match the answer key. Compare ${unchecked === 1 ? 'it' : 'them'} with the correct versions below.`;

  return {
    verdict,
    summary,
    closest_correct: errors > 0 || unchecked > 0 ? nearest : '',
    closest_reference: nearest,
    words: exact ? notes.map((n) => ({ ...n, status: 'ok' as const })) : notes,
    tips: [],
    verified: true,
    exact_match: exact,
  };
}
