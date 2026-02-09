export interface FlashCard {
  id: string;
  word: string;
  imageUrl: string | null;
  nextReviewDate: string;
  intervalDays: number;
  easeFactor: number;
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
  return cards.filter((c) => c.nextReviewDate <= today);
}

export function createCard(word: string, imageUrl: string | null = null): FlashCard {
  return {
    id: crypto.randomUUID(),
    word: word.trim(),
    imageUrl,
    nextReviewDate: new Date().toISOString().split('T')[0],
    intervalDays: 1,
    easeFactor: 2.5,
  };
}
