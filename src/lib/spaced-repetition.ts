export type LearningStage = 'new' | 'stage1' | 'stage2' | 'graduated';
export type WordType = 'verb' | 'masdar' | 'other';
export type VerbForm = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

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

export function createCard(word: string, english: string | null = null, imageUrl: string | null = null): FlashCard {
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
  };
}

/** Parse input line: "كتاب | book" or just "كتاب" */
export function parseWordLine(line: string): { arabic: string; english: string | null } {
  const trimmed = line.trim();
  if (!trimmed) return { arabic: '', english: null };

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim());
    return { arabic: parts[0], english: parts[1] || null };
  }

  return { arabic: trimmed, english: null };
}
