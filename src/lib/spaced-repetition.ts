import { today, daysFromNow } from './day';
import { advanceIntensive, isIntensive, startIntensive, timeHasCome } from './intensive';

export type LearningStage = 'new' | 'stage1' | 'stage2' | 'graduated';
export type WordType = 'verb' | 'masdar' | 'noun' | 'adjective' | 'participle' | 'other';
export type VerbForm = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

export interface CompanionForm {
  form: string;
  label: string;
}

export interface FlashCard {
  id: string;
  word: string;
  english: string | null;
  imageUrl: string | null;
  nextReviewDate: string;
  intervalDays: number;
  easeFactor: number;
  learningStage: LearningStage;
  stage1Attempts: number;
  stage2Attempts: number;
  root?: string | null;
  wordType?: WordType | null;
  verbForm?: VerbForm | null;
  pairedWordId?: string | null;
  needsReview?: boolean;
  shaami?: string | null;
  fushaPlural?: string | null;
  shaamiPlural?: string | null;
  /** Grammatical gender of a noun, which the numbers drill agrees with. */
  gender?: 'm' | 'f' | null;
  wordVoweled?: string | null;
  pastTense?: string | null;
  presentTense?: string | null;
  masdarForm?: string | null;
  companionForms?: CompanionForm[] | null;
  taggedAt?: string | null;
  /** Named batch this card belongs to, e.g. "Chapter 12". Null means ungrouped. */
  group?: string | null;
  /** The preposition that always follows this word, e.g. "في" for نَجَحَ في. */
  fixedPreposition?: string | null;
  /** A sentence using this word with "___" standing in for fixedPreposition. */
  prepositionSentence?: string | null;
  /**
   * 1-based day of the front-loaded phase a newly-graduated card runs, or
   * null once it has joined the long-term rotation. See ./intensive.
   */
  intensiveDay?: number | null;
  /** Reps already done on the current day of that phase. */
  intensiveRepsDone?: number;
  /** The moment the next rep is wanted, when it falls later the same day. */
  nextReviewAt?: string | null;
  /** When the card was added, which is when its learning started. */
  createdAt?: string | null;
  /** English translation of prepositionSentence, with the blank filled in. */
  prepositionSentenceEn?: string | null;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const MIN_INTERVAL = 1;

export function reviewCard(card: FlashCard, rating: Rating, now: Date = new Date()): FlashCard {
  let { intervalDays, easeFactor } = card;

  switch (rating) {
    case 'again':
      intervalDays = 1;
      easeFactor -= 0.2;
      break;
    case 'hard':
      intervalDays = Math.max(MIN_INTERVAL, Math.round(intervalDays * 1.2));
      easeFactor -= 0.15;
      break;
    case 'good':
      intervalDays = Math.max(MIN_INTERVAL, Math.round(intervalDays * easeFactor));
      break;
    case 'easy':
      intervalDays = Math.max(MIN_INTERVAL, Math.round(intervalDays * easeFactor * 1.3));
      easeFactor += 0.1;
      break;
  }

  easeFactor = Math.max(MIN_EASE, Math.min(MAX_EASE, easeFactor));

  // A card still in its first five days runs a fixed number of exposures
  // rather than a growing interval. The rating is not ignored — it moves the
  // ease the card will carry into the long-term rotation — but it does not
  // decide when the next rep comes.
  if (isIntensive(card)) {
    return { ...card, easeFactor, ...advanceIntensive(card, now) };
  }

  return {
    ...card,
    intervalDays,
    easeFactor,
    nextReviewDate: daysFromNow(intervalDays, now),
  };
}

/**
 * Everything the schedule owns, for persisting a review or a graduation.
 *
 * The call sites used to list these fields by hand, which is exactly how a
 * newly-added scheduling field ends up written in one place and not the other.
 */
export function scheduleFields(card: FlashCard): Partial<FlashCard> {
  return {
    learningStage: card.learningStage,
    nextReviewDate: card.nextReviewDate,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
    intensiveDay: card.intensiveDay ?? null,
    intensiveRepsDone: card.intensiveRepsDone ?? 0,
    nextReviewAt: card.nextReviewAt ?? null,
  };
}

export function getDueCards(cards: FlashCard[], now: Date = new Date()): FlashCard[] {
  const cutoff = today(now);
  return cards.filter(
    (c) =>
      c.learningStage === 'graduated' &&
      c.nextReviewDate <= cutoff &&
      // A card mid-phase is due on its day but not until its gap has run out,
      // so the four reps land across the day instead of back to back.
      timeHasCome(c.nextReviewAt, now),
  );
}

/**
 * The next batch of cards waiting on their gap, if the queue is empty only
 * because it is too soon.
 *
 * Without this the app would say "nothing to review" three hours after a
 * session and look broken, which is exactly how the widget looked the last
 * time a scheduling change went unexplained.
 */
export function nextWave(
  cards: FlashCard[],
  now: Date = new Date(),
): { at: Date; count: number } | null {
  const cutoff = today(now);
  const waiting = cards
    .filter(
      (c) =>
        c.learningStage === 'graduated' &&
        c.nextReviewDate <= cutoff &&
        !timeHasCome(c.nextReviewAt, now),
    )
    .map((c) => new Date(c.nextReviewAt as string).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (waiting.length === 0) return null;
  const at = waiting[0];
  // Everything within a few minutes of the first is one batch, not several.
  const count = waiting.filter((t) => t - at < 5 * 60 * 1000).length;
  return { at: new Date(at), count };
}

export function getLearnableCards(cards: FlashCard[]): FlashCard[] {
  return cards.filter((c) => c.learningStage !== 'graduated');
}

export function graduateCard(card: FlashCard, now: Date = new Date()): FlashCard {
  // Straight into the front-loaded phase, due at once: the first of today's
  // four reps is the one just earned by graduating.
  return {
    ...card,
    learningStage: 'graduated',
    easeFactor: 2.5,
    ...startIntensive(now),
  };
}

export function createCard(
  word: string,
  english: string | null = null,
  imageUrl: string | null = null,
  shaami: string | null = null,
): FlashCard {
  return {
    id: crypto.randomUUID(),
    word: word.trim(),
    english: english?.trim() || null,
    imageUrl,
    nextReviewDate: today(),
    intervalDays: 1,
    easeFactor: 2.5,
    learningStage: 'new',
    stage1Attempts: 0,
    stage2Attempts: 0,
    intensiveDay: null,
    intensiveRepsDone: 0,
    nextReviewAt: null,
    shaami: shaami?.trim() || null,
  };
}

const TAA_MARBUTA = 'ة'; // ة
const PLURAL_MARKER = /\s*ج\.\s*/; // ج.

export interface ParsedWordEntry {
  fusha: string;
  shaami: string | null;
  english: string | null;
}

/**
 * Splits "Fusha / Shaami" on the divider "/", except when "/" is
 * immediately followed by ة (taa marbuta) — that marks a masc/fem
 * variant of a single word (e.g. مُفَضَّل/ة), not a Shaami translation.
 */
function splitFushaShaami(expr: string): { fusha: string; shaami: string | null } {
  const trimmed = expr.trim();
  let dividerIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '/' && trimmed[i + 1] !== TAA_MARBUTA) {
      dividerIdx = i;
      break;
    }
  }
  if (dividerIdx === -1) return { fusha: trimmed, shaami: null };
  return {
    fusha: trimmed.slice(0, dividerIdx).trim(),
    shaami: trimmed.slice(dividerIdx + 1).trim() || null,
  };
}

/**
 * Parse one line from the Add Words box: "Fusha/Shaami | English", where
 * "ج." between two Arabic expressions marks the second as the plural of
 * the first — that becomes a second, separate entry sharing the English gloss.
 */
export function parseWordLine(line: string): ParsedWordEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const pipeIdx = trimmed.indexOf('|');
  const arabicPart = pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx).trim();
  const english = pipeIdx === -1 ? null : trimmed.slice(pipeIdx + 1).trim() || null;

  const pluralSplit = arabicPart.split(PLURAL_MARKER);
  const singularExpr = pluralSplit[0];
  const pluralExpr = pluralSplit.length > 1 ? pluralSplit[1] : null;

  const entries: ParsedWordEntry[] = [{ ...splitFushaShaami(singularExpr), english }];
  if (pluralExpr) {
    entries.push({ ...splitFushaShaami(pluralExpr), english });
  }
  return entries;
}

/**
 * Expand a stored word into its accepted answer variants. A word is only
 * ever stored with "/" left in it for the masc/fem marker (e.g. مُفَضَّل/ة) —
 * every other "/" divider is split apart into fusha/shaami at add-time — so
 * this always means "accept either the base or the ة-suffixed form".
 */
export function expandGenderVariants(word: string): string[] {
  if (!word.includes(`/${TAA_MARBUTA}`)) return [word];
  const marker = new RegExp(`/${TAA_MARBUTA}`, 'g');
  return [word.replace(marker, ''), word.replace(marker, TAA_MARBUTA)];
}

/**
 * Every spelling that counts as a correct typed answer for a card: the Fusha
 * and Shaami forms, each in singular and plural, and each further expanded
 * into its masc/fem variants. Callers still normalize (strip harakat, unify
 * alef/yaa) before comparing.
 */
export function acceptedAnswers(card: FlashCard): string[] {
  const sources = [card.word, card.shaami, card.fushaPlural, card.shaamiPlural];
  const out: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    // A single field may still hold several listed forms (e.g. "سِتّ، تيتة").
    for (const piece of source.split(/[،,؛;]/)) {
      for (const variant of expandGenderVariants(piece.trim())) {
        const cleaned = variant.trim();
        if (cleaned && !out.includes(cleaned)) out.push(cleaned);
      }
    }
  }
  return out;
}
