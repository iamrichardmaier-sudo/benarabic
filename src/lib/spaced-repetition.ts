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
  wordVoweled?: string | null;
  pastTense?: string | null;
  presentTense?: string | null;
  masdarForm?: string | null;
  companionForms?: CompanionForm[] | null;
  taggedAt?: string | null;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const MIN_INTERVAL = 1;

export function reviewCard(card: FlashCard, rating: Rating): FlashCard {
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

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    ...card,
    intervalDays,
    easeFactor,
    nextReviewDate: nextReview.toISOString().split('T')[0],
  };
}

export function getDueCards(cards: FlashCard[]): FlashCard[] {
  const today = new Date().toISOString().split('T')[0];
  return cards.filter((c) => c.learningStage === 'graduated' && c.nextReviewDate <= today);
}

export function getLearnableCards(cards: FlashCard[]): FlashCard[] {
  return cards.filter((c) => c.learningStage !== 'graduated');
}

export function graduateCard(card: FlashCard): FlashCard {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    ...card,
    learningStage: 'graduated',
    nextReviewDate: tomorrow.toISOString().split('T')[0],
    intervalDays: 1,
    easeFactor: 2.5,
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
    nextReviewDate: new Date().toISOString().split('T')[0],
    intervalDays: 1,
    easeFactor: 2.5,
    learningStage: 'new',
    stage1Attempts: 0,
    stage2Attempts: 0,
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
