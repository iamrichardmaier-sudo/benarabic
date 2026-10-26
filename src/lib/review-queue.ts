import { isSentence, type FlashCard, type Rating } from './spaced-repetition';
import { byMix, type CardMix } from './learn-filter';

/** One prompt in a review session: a card asked in one direction. */
export interface QueueItem<C extends { id: string }> {
  card: C;
}

/**
 * The session queue after a grade.
 *
 * "Again" means the card wasn't known, so it goes to the back and comes round
 * again before the session ends rather than vanishing until its next due date.
 * The item is requeued as it was, carrying the card from before the grade, so
 * answering it the second time overwrites the lapse instead of counting as a
 * further repetition of it.
 */
export function queueAfterGrade<T extends QueueItem<{ id: string }>>(
  items: T[],
  index: number,
  rating: Rating,
): T[] {
  if (rating !== 'again') return items;
  const item = items[index];
  if (!item) return items;
  return [...items, item];
}

/**
 * How many cards a session actually covered.
 *
 * Not the length of the queue: a card sent to the back by "Again" appears in
 * it more than once, and "12 cards reviewed" should not count it twice.
 */
export function cardsCovered<T extends QueueItem<{ id: string }>>(items: T[]): number {
  return new Set(items.map((i) => i.card.id)).size;
}

/**
 * A review session over `pool`: just the vocab, just the sentences, or both,
 * shuffled. A word is asked both ways; a sentence is one item, not one per
 * direction, since its exercise is the word ordering, which it runs twice by
 * itself.
 */
export function sessionItems(
  pool: FlashCard[],
  mix: CardMix,
  random: () => number = Math.random,
): { card: FlashCard; direction: 'ar-to-en' | 'en-to-ar' }[] {
  const items: { card: FlashCard; direction: 'ar-to-en' | 'en-to-ar' }[] = [];
  for (const card of byMix(pool, mix)) {
    items.push({ card, direction: 'ar-to-en' });
    if (!isSentence(card)) items.push({ card, direction: 'en-to-ar' });
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
